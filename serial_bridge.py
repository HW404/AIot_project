"""
serial_bridge.py
아두이노 시리얼 → FastAPI 서버로 전달

동작:
  1. 시리얼 포트 자동 감지 (Arduino Uno/Nano)
  2. 시리얼에서 한 줄씩 읽기
  3. FastAPI 서버에 등록된 WebSocket 클라이언트들에게 broadcast

별도 프로세스가 아닌, FastAPI 서버 내부에서 백그라운드 task로 실행됨.
"""

import asyncio
import sys
from typing import Optional

import serial
import serial.tools.list_ports


# ============================================================
# 포트 자동 감지
# ============================================================
def find_arduino_port() -> Optional[str]:
    """
    연결된 시리얼 포트 중 아두이노로 추정되는 포트 반환.
    못 찾으면 None.
    """
    ports = serial.tools.list_ports.comports()
    
    # 아두이노 식별 키워드 (벤더명, 칩셋명 등)
    arduino_keywords = [
        "arduino", "ch340", "ch341",  # CH340: 호환보드에 자주 쓰임
        "wch", "usb-serial", "usb serial",
        "ftdi",                        # FTDI: 정품 일부
    ]
    
    for port in ports:
        desc = (port.description or "").lower()
        manuf = (port.manufacturer or "").lower()
        hwid = (port.hwid or "").lower()
        
        for kw in arduino_keywords:
            if kw in desc or kw in manuf or kw in hwid:
                return port.device
    
    # 못 찾으면 첫 번째 포트라도 반환 (사용자가 수동 확인하도록)
    if ports:
        return ports[0].device
    
    return None


def list_all_ports() -> list:
    """디버그용: 연결된 모든 포트 목록"""
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
        self.subscribers = []   # 메시지 수신 콜백 리스트
        self._task: Optional[asyncio.Task] = None
    
    def subscribe(self, callback):
        """수신 메시지 구독 (callback(message: str))"""
        self.subscribers.append(callback)
    
    async def start(self):
        """시리얼 연결 + 백그라운드 읽기 task 시작"""
        if self.is_running:
            return
        
        self.port = find_arduino_port()
        if not self.port:
            print("[SerialBridge] 아두이노 포트를 찾지 못했습니다.")
            print("[SerialBridge] 연결된 포트 목록:", list_all_ports())
            return
        
        try:
            self.ser = serial.Serial(self.port, self.baudrate, timeout=0.1)
            self.is_running = True
            print(f"[SerialBridge] 연결 성공: {self.port} @ {self.baudrate} baud")
            self._task = asyncio.create_task(self._read_loop())
        except serial.SerialException as e:
            print(f"[SerialBridge] 포트 열기 실패: {e}")
    
    async def stop(self):
        """정리"""
        self.is_running = False
        if self._task:
            self._task.cancel()
        if self.ser and self.ser.is_open:
            self.ser.close()
        print("[SerialBridge] 종료")
    
    async def _read_loop(self):
        """백그라운드에서 시리얼 읽기 (논블로킹)"""
        loop = asyncio.get_event_loop()
        
        while self.is_running:
            try:
                # serial.readline()은 블로킹이므로 executor로 실행
                line = await loop.run_in_executor(None, self._read_line_safe)
                
                if line:
                    # 모든 구독자에게 전달
                    for callback in self.subscribers:
                        try:
                            result = callback(line)
                            if asyncio.iscoroutine(result):
                                await result
                        except Exception as e:
                            print(f"[SerialBridge] 구독자 콜백 오류: {e}")
                
                # CPU 양보
                await asyncio.sleep(0.01)
            
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[SerialBridge] 읽기 오류: {e}")
                await asyncio.sleep(0.5)
    
    def _read_line_safe(self) -> Optional[str]:
        """블로킹 readline (executor에서 호출됨)"""
        if not self.ser or not self.ser.is_open:
            return None
        try:
            raw = self.ser.readline()
            if not raw:
                return None
            return raw.decode("utf-8", errors="ignore").strip()
        except Exception:
            return None
    
    def get_status(self) -> dict:
        return {
            "connected": self.is_running and self.ser is not None and self.ser.is_open,
            "port": self.port,
            "baudrate": self.baudrate,
        }


# 전역 인스턴스 (FastAPI에서 import)
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
