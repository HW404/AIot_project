"""
시리얼 리더 - 아두이노에서 센서값 수신

아두이노 출력 형식 (sensor_check.ino 또는 all_sensors.ino):
  CDS=512  SND=120  POT=678  TEMP=23.5  HUM=45.0  DIST=18  BZR=OK
또는 한 줄 한 항목:
  CDS:512
  TEMP:23.5

두 형식 모두 파싱 가능.

개선점 (v0.0.8):
  - 시리얼 끊김 시 자동 재오픈 (USB 뺐다 꽂아도 복구)
  - 시리얼 열림 직후 입력 버퍼 초기화 (깨진 첫 줄 제거)
  - None/예외 처리 강화
"""

import re
import threading
import time
from typing import Callable, Optional

import serial
import serial.tools.list_ports

import config


# 파싱: KEY=VALUE 또는 KEY:VALUE 형식
# 키는 영문 대문자, 값은 숫자(소수/음수 포함) 또는 영문 대문자(OK 등)
TOKEN_RE = re.compile(r"([A-Z]+)[=:]([+-]?\d+(?:\.\d+)?|[A-Z]+)")

# 재오픈 시도 간격 (초)
REOPEN_INTERVAL = 2.0


def find_arduino_port() -> Optional[str]:
    """아두이노 포트 자동 감지 (config 기본값 못 찾을 때 폴백용)"""
    keywords = ["arduino", "ch340", "ch341", "usb-serial", "ttyacm", "ttyusb"]
    ports = serial.tools.list_ports.comports()
    for p in ports:
        text = f"{p.device} {p.description or ''} {p.manufacturer or ''}".lower()
        if any(k in text for k in keywords):
            return p.device
    return ports[0].device if ports else None


class SerialReader:
    """별도 스레드에서 시리얼 수신 → 콜백으로 전달"""

    def __init__(
        self,
        port: str = config.SERIAL_PORT,
        baudrate: int = config.SERIAL_BAUDRATE,
        on_sensor: Optional[Callable[[str, float], None]] = None,
    ):
        self.port = port
        self.baudrate = baudrate
        self.on_sensor = on_sensor or (lambda name, value: None)
        self.ser: Optional[serial.Serial] = None
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def start(self) -> bool:
        """
        시리얼 연결 후 수신 스레드 시작.
        첫 연결 실패해도 스레드는 시작되어 재시도 함 (USB 늦게 꽂혀도 OK).
        반환값: 첫 연결 성공 여부 (False여도 백그라운드에서 재시도 계속).
        """
        self._stop.clear()
        first_ok = self._open_port()
        if not first_ok:
            print(f"[SerialReader] 첫 연결 실패: {self.port}. 백그라운드에서 재시도.")

        self._thread = threading.Thread(
            target=self._read_loop, name="SerialReader", daemon=True
        )
        self._thread.start()
        return first_ok

    def stop(self):
        self._stop.set()
        self._close_port()
        print("[SerialReader] 종료")

    def _open_port(self) -> bool:
        """시리얼 포트 열기. 실패 시 자동 감지된 포트로 재시도."""
        # 기존 포트 열기 시도
        if self._try_open(self.port):
            return True

        # 자동 감지 시도
        detected = find_arduino_port()
        if detected and detected != self.port:
            print(f"[SerialReader] 자동 감지된 포트로 재시도: {detected}")
            if self._try_open(detected):
                self.port = detected   # 다음 재시도부터는 이걸 사용
                return True

        return False

    def _try_open(self, port: str) -> bool:
        """단일 포트 열기 시도."""
        try:
            self.ser = serial.Serial(port, self.baudrate, timeout=0.5)
            # 아두이노가 리셋되므로 부팅 대기
            time.sleep(2)
            # 부팅 중 들어온 깨진 데이터 버리기
            try:
                self.ser.reset_input_buffer()
            except Exception:
                pass
            print(f"[SerialReader] 연결 성공: {port} @ {self.baudrate} baud")
            return True
        except (serial.SerialException, OSError) as e:
            print(f"[SerialReader] {port} 열기 실패: {e}")
            self.ser = None
            return False

    def _close_port(self):
        if self.ser is not None:
            try:
                if self.ser.is_open:
                    self.ser.close()
            except Exception:
                pass
            self.ser = None

    def _read_loop(self):
        """
        수신 루프 (별도 스레드).
        포트가 끊기면 주기적으로 재오픈 시도.
        """
        while not self._stop.is_set():
            # 포트가 안 열려있으면 재오픈 시도
            if self.ser is None or not self.ser.is_open:
                time.sleep(REOPEN_INTERVAL)
                if self._stop.is_set():
                    break
                print(f"[SerialReader] 재오픈 시도: {self.port}")
                self._open_port()
                continue

            # 한 줄 읽기 시도
            try:
                raw = self.ser.readline()
            except (serial.SerialException, OSError) as e:
                print(f"[SerialReader] 시리얼 오류 (재오픈 예정): {e}")
                self._close_port()
                continue
            except Exception as e:
                print(f"[SerialReader] 예외: {e}")
                time.sleep(0.1)
                continue

            if not raw:
                # 타임아웃 - 정상. 다시 읽기.
                continue

            try:
                line = raw.decode("utf-8", errors="ignore").strip()
            except Exception:
                continue

            if line:
                self._parse_line(line)

    def _parse_line(self, line: str):
        """한 줄에서 KEY=VAL 패턴들을 추출해 콜백 호출"""
        for match in TOKEN_RE.finditer(line):
            key = match.group(1).lower()
            val_str = match.group(2)

            # 숫자 파싱
            value = self._parse_value(val_str)
            if value is None:
                continue   # OK 같은 문자열은 무시

            try:
                self.on_sensor(key, value)
            except Exception as e:
                print(f"[SerialReader] 콜백 오류: {e}")

    @staticmethod
    def _parse_value(val_str: str):
        """
        '512' → 512 (int)
        '23.5' → 23.5 (float)
        'OK' → None (문자열은 무시)
        """
        # 소수점 있으면 float
        if "." in val_str:
            try:
                return float(val_str)
            except ValueError:
                return None
        # 그 외엔 int 시도
        try:
            return int(val_str)
        except ValueError:
            return None
