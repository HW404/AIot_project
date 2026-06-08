"""
TCP 클라이언트 - 노트북 서버에 연결

기능:
  - 노트북 TCP 서버에 연결
  - JSON 메시지 송신 (라파 → 노트북)  ← 큐 기반, 비블로킹
  - JSON 메시지 수신 (노트북 → 라파, 시작/재시작 명령)
  - 연결 끊기면 자동 재시도

메시지 형식: 한 줄 JSON + 개행문자

개선점 (v0.0.8):
  - 송신 큐 + 별도 송신 스레드 (시리얼 스레드 블로킹 방지)
  - 재연결 시 이전 소켓 명시적 정리 (누수 방지)
  - 데드락 방지 (송신 락 제거 - 송신은 단일 스레드)
  - 명확한 스레드 이름
"""

import json
import queue
import socket
import threading
import time
from typing import Callable, Optional

import config


# 송신 큐 최대 크기 (오래된 메시지 버림)
SEND_QUEUE_MAX = 1000

# 송신 타임아웃 (네트워크가 느려도 무한정 블로킹 안 되게)
SEND_TIMEOUT = 5.0


class TCPClient:
    def __init__(
        self,
        host: str = config.SERVER_HOST,
        port: int = config.SERVER_PORT,
        on_message: Optional[Callable[[dict], None]] = None,
    ):
        self.host = host
        self.port = port
        self.on_message = on_message or (lambda msg: None)

        self.sock: Optional[socket.socket] = None
        self.connected = False

        self._stop = threading.Event()
        self._send_queue: "queue.Queue[dict]" = queue.Queue(maxsize=SEND_QUEUE_MAX)

        self._conn_thread: Optional[threading.Thread] = None
        self._send_thread: Optional[threading.Thread] = None
        self._recv_thread: Optional[threading.Thread] = None

    # ============================================================
    # 공개 인터페이스
    # ============================================================

    def start(self):
        """연결 관리 + 송신 + 수신 스레드 시작"""
        self._stop.clear()

        self._conn_thread = threading.Thread(
            target=self._connect_loop, name="TCPClient-Conn", daemon=True
        )
        self._conn_thread.start()

        self._send_thread = threading.Thread(
            target=self._send_loop, name="TCPClient-Send", daemon=True
        )
        self._send_thread.start()

        print(f"[TCPClient] 시작 → {self.host}:{self.port}")

    def stop(self):
        self._stop.set()
        # 송신 스레드 깨우기 위해 None 넣음
        try:
            self._send_queue.put_nowait(None)
        except queue.Full:
            pass
        self._close_sock()
        print("[TCPClient] 종료")

    def send(self, message: dict) -> bool:
        """
        JSON 메시지 송신 (큐에 넣음).
        실제 송신은 별도 스레드에서 처리되므로 블로킹 없음.
        큐가 가득 차면 가장 오래된 메시지를 버리고 새 메시지 넣음.
        """
        if self._stop.is_set():
            return False

        try:
            self._send_queue.put_nowait(message)
            return True
        except queue.Full:
            # 큐 풀: 가장 오래된 거 하나 버리고 다시 시도
            try:
                self._send_queue.get_nowait()
            except queue.Empty:
                pass
            try:
                self._send_queue.put_nowait(message)
                print("[TCPClient] 송신 큐 가득 참 - 오래된 메시지 1개 버림")
                return True
            except queue.Full:
                return False

    # ============================================================
    # 연결 관리 스레드
    # ============================================================

    def _connect_loop(self):
        """연결 안 됐을 때 주기적으로 재시도"""
        while not self._stop.is_set():
            if not self.connected:
                self._try_connect()
            # _stop.wait()를 쓰면 stop() 호출 즉시 깨어남
            if self._stop.wait(timeout=config.RECONNECT_INTERVAL):
                break

    def _try_connect(self):
        """단일 연결 시도. 성공 시 수신 스레드 시작."""
        # 이전 소켓 정리 (누수 방지)
        self._close_sock()

        new_sock = None
        try:
            new_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            new_sock.settimeout(SEND_TIMEOUT)
            new_sock.connect((self.host, self.port))
            # 연결 후엔 타임아웃 해제 (recv는 블로킹, send는 별도 처리)
            new_sock.settimeout(None)

            self.sock = new_sock
            self.connected = True
            print(f"[TCPClient] 연결 성공: {self.host}:{self.port}")

            # 수신 스레드 시작
            self._recv_thread = threading.Thread(
                target=self._recv_loop, name="TCPClient-Recv", daemon=True
            )
            self._recv_thread.start()

        except (OSError, socket.timeout) as e:
            print(f"[TCPClient] 연결 실패 ({self.host}:{self.port}): {e}")
            if new_sock is not None:
                try:
                    new_sock.close()
                except Exception:
                    pass

    # ============================================================
    # 송신 스레드
    # ============================================================

    def _send_loop(self):
        """송신 큐에서 메시지 꺼내 실제 전송"""
        while not self._stop.is_set():
            try:
                msg = self._send_queue.get(timeout=0.5)
            except queue.Empty:
                continue

            if msg is None:
                # stop 신호
                break

            # 연결이 아직 안 됐으면 메시지 버림 (큐에 다시 안 넣음 - 무한 루프 방지)
            if not self.connected or self.sock is None:
                continue

            try:
                payload = (json.dumps(msg, ensure_ascii=False) + "\n").encode("utf-8")
                # sendall은 블로킹이지만 settimeout=None이라 OS가 알아서
                # 만약 매우 느린 네트워크 우려되면 여기에 select() 추가 가능
                self.sock.sendall(payload)
            except (OSError, socket.error) as e:
                print(f"[TCPClient] 송신 실패: {e}")
                self.connected = False
                # sock은 _try_connect에서 정리됨

    # ============================================================
    # 수신 스레드
    # ============================================================

    def _recv_loop(self):
        """수신 루프 - 노트북 → 라파 메시지 처리"""
        sock = self.sock   # 로컬에 캡쳐 (재연결 시 self.sock이 바뀔 수 있음)
        if sock is None:
            return

        buffer = b""
        while not self._stop.is_set() and self.connected and sock is self.sock:
            try:
                data = sock.recv(4096)
            except (OSError, socket.error) as e:
                if not self._stop.is_set():
                    print(f"[TCPClient] 수신 오류: {e}")
                self.connected = False
                break

            if not data:
                print("[TCPClient] 서버 연결 종료")
                self.connected = False
                break

            buffer += data

            # 개행 단위로 메시지 분리
            while b"\n" in buffer:
                line_bytes, buffer = buffer.split(b"\n", 1)
                line = line_bytes.decode("utf-8", errors="ignore").strip()
                if not line:
                    continue
                try:
                    msg = json.loads(line)
                except json.JSONDecodeError:
                    print(f"[TCPClient] JSON 파싱 실패: {line}")
                    continue
                try:
                    self.on_message(msg)
                except Exception as e:
                    print(f"[TCPClient] on_message 콜백 오류: {e}")

    # ============================================================
    # 정리
    # ============================================================

    def _close_sock(self):
        if self.sock is not None:
            try:
                self.sock.shutdown(socket.SHUT_RDWR)
            except Exception:
                pass
            try:
                self.sock.close()
            except Exception:
                pass
            self.sock = None
        self.connected = False
