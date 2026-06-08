"""
tcp_server.py - 라즈베리파이에서 오는 TCP 메시지 수신

동작:
  - TCP 서버 띄우고 라파의 연결 대기
  - 라파에서 JSON 메시지 받음 → 구독자(WebSocket broadcast)에 전달
  - 브라우저에서 온 명령 → TCP로 라파에 송신

개선점 (v0.0.9):
  - 새 라파 연결 들어오면 기존 연결 명시적 정리
  - send_to_pi에 asyncio.Lock 추가 (동시 호출 race 방지)
  - 송신 실패 시 client_writer 정리 (불일치 상태 방지)
  - CancelledError와 일반 예외 분리 처리 (정상 종료 흐름 보호)
"""

import asyncio
import json
from typing import Callable, Optional


class TCPServer:
    def __init__(self, host: str = "0.0.0.0", port: int = 9000):
        self.host = host
        self.port = port
        self.server: Optional[asyncio.AbstractServer] = None
        self.client_writer: Optional[asyncio.StreamWriter] = None
        self.client_addr: Optional[tuple] = None
        self.is_running = False
        self.subscribers = []
        # 송신 동시 호출 보호 (여러 브라우저가 동시에 명령 보낼 때)
        self._send_lock = asyncio.Lock()

    def subscribe(self, callback: Callable):
        """수신 메시지 구독. callback(message_dict)"""
        self.subscribers.append(callback)

    async def start(self):
        if self.is_running:
            return
        try:
            self.server = await asyncio.start_server(
                self._handle_client, self.host, self.port
            )
            self.is_running = True
            print(f"[TCPServer] 시작: {self.host}:{self.port} (라파 연결 대기)")
        except OSError as e:
            print(f"[TCPServer] 시작 실패: {e}")
            self.is_running = False

    async def stop(self):
        self.is_running = False
        # 기존 라파 연결 정리
        await self._close_current_client()
        if self.server:
            self.server.close()
            try:
                await self.server.wait_closed()
            except Exception:
                pass
        print("[TCPServer] 종료")

    async def _handle_client(self, reader, writer):
        addr = writer.get_extra_info("peername")
        print(f"[TCPServer] 라파 연결됨: {addr}")

        # 이미 다른 라파 연결되어 있으면 정리 후 새 연결로 교체
        # (라파가 끊겼다 재연결하는 경우 잠깐 둘 다 살아있을 수 있음)
        if self.client_writer is not None and self.client_writer is not writer:
            print("[TCPServer] 기존 라파 연결 정리")
            await self._close_current_client()

        self.client_writer = writer
        self.client_addr = addr

        try:
            while self.is_running:
                # readline은 \n까지 또는 EOF까지 대기
                try:
                    line = await reader.readline()
                except (ConnectionResetError, OSError) as e:
                    print(f"[TCPServer] 라파 연결 오류: {e}")
                    break

                if not line:
                    # EOF - 라파가 정상 종료
                    break

                text = line.decode("utf-8", errors="ignore").strip()
                if not text:
                    continue

                try:
                    msg = json.loads(text)
                except json.JSONDecodeError:
                    print(f"[TCPServer] JSON 파싱 실패: {text}")
                    continue

                # 모든 구독자에게 전달
                for cb in self.subscribers:
                    try:
                        result = cb(msg)
                        if asyncio.iscoroutine(result):
                            await result
                    except asyncio.CancelledError:
                        raise  # 취소는 위로 전파
                    except Exception as e:
                        print(f"[TCPServer] 콜백 오류: {e}")

        except asyncio.CancelledError:
            # 서버 종료 시 발생. 정상 흐름.
            raise
        except Exception as e:
            print(f"[TCPServer] 클라이언트 처리 오류: {e}")
        finally:
            # 이 핸들러의 writer만 정리 (다른 라파가 이미 교체했을 수도 있음)
            if self.client_writer is writer:
                print(f"[TCPServer] 라파 연결 종료: {addr}")
                self.client_writer = None
                self.client_addr = None
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

    async def _close_current_client(self):
        """현재 client_writer 명시적 정리 (재연결 또는 종료 시)"""
        w = self.client_writer
        if w is None:
            return
        self.client_writer = None
        self.client_addr = None
        try:
            w.close()
            await w.wait_closed()
        except Exception:
            pass

    async def send_to_pi(self, message: dict) -> bool:
        """
        노트북 → 라파 메시지 송신.
        여러 브라우저가 동시에 호출해도 안전 (asyncio.Lock).
        """
        async with self._send_lock:
            writer = self.client_writer
            if writer is None:
                return False
            try:
                payload = (json.dumps(message, ensure_ascii=False) + "\n").encode("utf-8")
                writer.write(payload)
                await writer.drain()
                return True
            except (ConnectionResetError, OSError) as e:
                print(f"[TCPServer] 송신 실패: {e}")
                # 실패 시 client_writer 정리 (불일치 상태 방지)
                if self.client_writer is writer:
                    self.client_writer = None
                    self.client_addr = None
                try:
                    writer.close()
                except Exception:
                    pass
                return False
            except Exception as e:
                print(f"[TCPServer] 송신 중 예외: {e}")
                return False

    def get_status(self) -> dict:
        """현재 상태. mode 키를 추가해 브라우저가 식별하기 쉽게."""
        return {
            "mode": "tcp",
            "running": self.is_running,
            "host": self.host,
            "port": self.port,
            "pi_connected": self.client_writer is not None,
            "pi_addr": f"{self.client_addr[0]}:{self.client_addr[1]}"
                       if self.client_addr else None,
        }


# 전역 인스턴스
tcp_server = TCPServer(host="0.0.0.0", port=9000)
