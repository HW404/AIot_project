"""
라파 게임 엔진 진입점

실행:
  python main.py

종료: Ctrl+C

동작:
  1. 게임 엔진 초기화
  2. TCP 클라이언트 시작 (노트북에 자동 재연결)
  3. 시리얼 리더 시작 (아두이노 USB)
  4. 시리얼 데이터 → 게임 엔진 → TCP로 노트북 송신
  5. 노트북 명령 → 게임 엔진 처리

개선점 (v0.0.8):
  - 변수명에서 'serial' 안 씀 (Python 표준 lib와 충돌 방지)
  - 시리얼 첫 연결 실패해도 백그라운드 재시도 (USB 늦게 꽂아도 OK)
  - 종료 시 stop 플래그만 세팅, 메인 루프가 깨어나 정상 종료
"""

import signal
import sys
import time

import config
from serial_reader import SerialReader
from tcp_client import TCPClient
from game_engine import GameEngine


# 종료 플래그 (signal 핸들러에서 세팅 → 메인 루프가 감지)
_shutdown_requested = False


def main():
    global _shutdown_requested

    print("=" * 60)
    print("  SensorEscape - 라즈베리파이 게임 엔진")
    print(f"  시리얼:  {config.SERIAL_PORT} @ {config.SERIAL_BAUDRATE} baud")
    print(f"  서버:    {config.SERVER_HOST}:{config.SERVER_PORT}")
    print("=" * 60)

    # ============================================================
    # 모듈 생성 + 의존성 주입
    # ============================================================
    # 1) 엔진은 콜백을 통해 TCP로 메시지 송신 → TCP 클라이언트 먼저
    tcp = TCPClient(host=config.SERVER_HOST, port=config.SERVER_PORT)

    # 2) 엔진: TCP 송신 콜백 받음
    engine = GameEngine(on_event=tcp.send)

    # 3) 시리얼 리더: 센서값 → 엔진으로
    reader = SerialReader(
        port=config.SERIAL_PORT,
        baudrate=config.SERIAL_BAUDRATE,
        on_sensor=engine.on_sensor,
    )

    # 4) TCP 수신 메시지 → 엔진 명령 처리
    #    (TCPClient는 on_message를 속성으로 받지만, 생성 후 변경도 안전)
    tcp.on_message = engine.on_command

    # ============================================================
    # 종료 핸들러 (signal 안에서는 가벼운 작업만)
    # ============================================================
    def request_shutdown(signum, frame):
        global _shutdown_requested
        print("\n[Main] 종료 신호 수신 (정리 중...)")
        _shutdown_requested = True

    signal.signal(signal.SIGINT, request_shutdown)
    signal.signal(signal.SIGTERM, request_shutdown)

    # ============================================================
    # 시작
    # ============================================================
    tcp.start()   # 백그라운드에서 연결 시도 (성공/실패 무관하게 계속)

    serial_ok = reader.start()
    if not serial_ok:
        print("[Main] 시리얼 첫 연결 실패 - 백그라운드에서 계속 재시도합니다.")
        print("       아두이노 USB를 꽂으면 자동으로 연결됩니다.")

    print("\n[Main] 실행 중. Ctrl+C로 종료.\n")

    # ============================================================
    # 메인 루프 (그냥 대기 + 종료 감지)
    # ============================================================
    try:
        while not _shutdown_requested:
            time.sleep(0.5)
    except KeyboardInterrupt:
        # signal 핸들러가 먼저 잡을 가능성 높지만 fallback
        pass

    # ============================================================
    # 종료 정리
    # ============================================================
    print("[Main] 모듈 종료 중...")
    reader.stop()
    tcp.stop()
    print("[Main] 종료 완료.")
    sys.exit(0)


if __name__ == "__main__":
    main()
