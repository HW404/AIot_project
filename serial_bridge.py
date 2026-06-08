"""
serial_bridge.py
아두이노 시리얼 → FastAPI 서버로 전달 (시리얼 모드용, INPUT_MODE=serial일 때)

동작:
  1. 시리얼 포트 자동 감지 (Arduino Uno/Nano)
  2. 시리얼에서 한 줄씩 읽기
  3. 구독자(WebSocket broadcast 콜백)에게 전달

FastAPI 서버 내부에서 백그라운드 task로 실행됨.

개선점 (v0.0.9):
  - 시리얼 끊김 시 자동 재오픈 (USB 뺐다 꽂아도 복구)
  - 부팅 직후 reset_input_buffer로 깨진 데이터 제거
  - get_running_loop 사용 (Python 3.10+ 권장)
  - 첫 연결 실패해도 백그라운드 재시도
"""

import asyncio
import sys
from typing import Optional

import serial
import serial.tools.list_ports


REOPEN_INTERVAL = 2.0  # 재오픈 시도 간격


# ============================================================
# 포트 자동 감지
# ============================================================
def find_arduino_port() -> Optional[str]:
    """
    연결된 시리얼 포트 중 아두이노로 추정되는 포트 반환.
    못 찾으면 None.
    """
    ports = serial.tools.list_ports.comports()

    arduino_keywords = [
        "arduino", "ch340", "ch341",
        "wch", "usb-serial", "usb serial",
        "ftdi",
    ]

    for port in ports:
        desc = (port.description or "").lower()
        manuf = (port.manufacturer or "").lower()
        hwid = (port.hwid or "").lower()

        for kw in arduino_keywords:
            if kw in desc or kw in manuf or kw in hwid:
                return port.device

    if ports:
        return ports[0].device

    return None


def list_all_ports() -> list:
    ports = serial.tools.list_ports.comports()
    return [
        {
            "device": p.device,
            "description": p.description,
            "manufacturer": p.manufacturer,
        }
        for p in ports
    ]


# ============================================================
# 시리얼 브릿지 클래스
# ============================================================
class SerialBridge:
    def __init__(self, baudrate: int = 9600):
        self.baudrate = baudrate
        self.ser: Optional[serial.Serial] = None
        self.port: Optional[str] = None
        self.is_running = False
        self.subscribers = []
        self._task: Optional[asyncio.Task] = None

    def subscribe(self, callback):
        """수신 메시지 구독. callback(line: str)"""
        self.subscribers.append(callback)

    async def start(self):
        """백그라운드 읽기 task 시작 (포트 없어도 시작 - 재시도 루프 안에서 처리)"""
        if self.is_running:
            return

        self.is_running = True
        # 첫 연결 시도 (실패해도 task는 시작됨)
        self._open_port()
        if not self.ser:
            print("[SerialBridge] 첫 연결 실패 - 백그라운드에서 재시도합니다.")
            print("[SerialBridge] 연결된 포트 목록:", list_all_ports())

        self._task = asyncio.create_task(self._read_loop())

    async def stop(self):
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
        self._close_port()
        print("[SerialBridge] 종료")

    def _open_port(self) -> bool:
        """시리얼 포트 열기 (블로킹). 동기 함수지만 빠르게 끝남."""
        port = find_arduino_port()
        if not port:
            return False

        try:
            self.ser = serial.Serial(port, self.baudrate, timeout=0.1)
            self.port = port
            # 아두이노 리셋 대기는 짧게 (executor에서 호출되면 OK,
            # 동기 컨텍스트에서 호출돼도 큰 영향 없음)
            # 입력 버퍼 초기화
            try:
                self.ser.reset_input_buffer()
            except Exception:
                pass
            print(f"[SerialBridge] 연결 성공: {port} @ {self.baudrate} baud")
            return True
        except (serial.SerialException, OSError) as e:
            print(f"[SerialBridge] 포트 열기 실패 ({port}): {e}")
            self.ser = None
            self.port = None
            return False

    def _close_port(self):
        if self.ser is not None:
            try:
                if self.ser.is_open:
                    self.ser.close()
            except Exception:
                pass
            self.ser = None

    async def _read_loop(self):
        """백그라운드에서 시리얼 읽기 (논블로킹)"""
        loop = asyncio.get_running_loop()

        while self.is_running:
            # 포트가 안 열려있으면 재오픈 시도
            if self.ser is None or not self.ser.is_open:
                await asyncio.sleep(REOPEN_INTERVAL)
                if not self.is_running:
                    break
                # _open_port는 동기지만 빠름 → executor 안 써도 OK
                opened = self._open_port()
                if not opened:
                    continue

            # 한 줄 읽기 (블로킹) - executor에서
            try:
                line = await loop.run_in_executor(None, self._read_line_safe)
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[SerialBridge] 읽기 오류: {e}")
                self._close_port()
                continue

            if not line:
                # 타임아웃 - 정상
                continue

            # 구독자에게 전달
            for callback in self.subscribers:
                try:
                    result = callback(line)
                    if asyncio.iscoroutine(result):
                        await result
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    print(f"[SerialBridge] 구독자 콜백 오류: {e}")

    def _read_line_safe(self) -> Optional[str]:
        """블로킹 readline (executor에서 호출). 끊기면 ser를 None으로."""
        if not self.ser or not self.ser.is_open:
            return None
        try:
            raw = self.ser.readline()
            if not raw:
                return None
            return raw.decode("utf-8", errors="ignore").strip()
        except (serial.SerialException, OSError) as e:
            print(f"[SerialBridge] 시리얼 오류 (재오픈 예정): {e}")
            self._close_port()
            return None
        except Exception:
            return None

    def get_status(self) -> dict:
        """mode 키 추가 - 브라우저에서 식별 쉽게."""
        return {
            "mode": "serial",
            "connected": self.is_running and self.ser is not None and self.ser.is_open,
            "port": self.port,
            "baudrate": self.baudrate,
        }


# 전역 인스턴스
bridge = SerialBridge(baudrate=9600)


# ============================================================
# 단독 실행 시: 디버깅용 (포트 목록 확인)
# ============================================================
if __name__ == "__main__":
    print("연결된 시리얼 포트:")
    for p in list_all_ports():
        print(f"  - {p['device']}: {p['description']}")

    detected = find_arduino_port()
    print(f"\n자동 감지된 아두이노 포트: {detected}")
