"""
게임 엔진 - 라파에서 동작하는 게임 로직 본체

현재 버전 (1단계 기본 로직):
  - CDS → 손전등 ON/OFF 판정
  - 온도 → 전선 패널 (전력 복구) 판정

향후 확장 예정:
  - 망원경 (거리)
  - 무전기 (가변저항)
  - 모스 (사운드)
  - 키패드 (4x4)
  - 타이머, 힌트 시스템

설계 원칙:
  - 모든 상태 변경은 _emit()으로 외부에 알림
  - on_event 콜백을 통해 TCP 클라이언트가 노트북으로 송신
  - 모든 상태 접근은 self._lock으로 보호 (시리얼 스레드/TCP 수신 스레드 동시 접근)

개선점 (v0.0.8):
  - threading.RLock으로 상태 보호 (RLock: 재진입 가능, _restore_power가 _check 안에서 호출되는 패턴 대응)
  - 명시적 LOBBY 상태에서는 게임 로직 실행 안 함 (sensor 송신만)
  - 사용 안 하는 hint_count 등 정리
"""

import threading
import time
from enum import Enum
from typing import Callable, Optional

import config


class Phase(str, Enum):
    LOBBY = "lobby"          # 시작 전 (sensor 송신만, 게임 로직 X)
    EXPLORING = "exploring"  # 손전등으로 탐색 중 (전력 차단)
    PLAYING = "playing"      # 전력 복구 후
    ENDED = "ended"


class GameEngine:
    def __init__(self, on_event: Optional[Callable[[dict], None]] = None):
        self.on_event = on_event or (lambda msg: None)

        # 상태 변경 보호용 락 (시리얼 스레드 ↔ TCP 수신 스레드 동시 접근 방지)
        # RLock: 같은 스레드 내 재진입 허용 (예: _check_left_wall_puzzle 안에서 _restore_power 호출)
        self._lock = threading.RLock()

        # ============================================================
        # 게임 상태 (모두 _lock으로 보호)
        # ============================================================
        self.phase = Phase.LOBBY
        self.power_restored = False
        self.flashlight_on = False

        # 퍼즐 진행 상태
        self.puzzles = {
            "leftWall":        {"solved": False},
            "rightWall":       {"solved": False, "code": None},
            "backWall_radio":  {"solved": False},
            "backWall_morse":  {"solved": False},
            "backWall_keypad": {"solved": False, "attempts": 0},
        }

        # 센서 마지막값 (모니터링용)
        self.sensors = {}

        # 통계
        self.start_time: Optional[float] = None
        self.hint_count = 0   # 향후 LLM 힌트 연동 시 사용

        # 로깅 카운터 (스팸 방지용)
        self._sensor_log_counter = 0

    # ============================================================
    # 외부 인터페이스 (TCP 수신 스레드에서 호출됨)
    # ============================================================

    def start_game(self):
        """게임 시작 신호 (브라우저 시작 → 노트북 → 여기로)"""
        with self._lock:
            print("[GameEngine] 게임 시작")
            self._reset_locked()
            self.phase = Phase.EXPLORING
            self.start_time = time.time()
        # _emit은 락 밖에서 (콜백 안에서 다시 send 호출될 가능성 대비)
        self._emit({"type": "stage_enter", "stage": 1, "name": "exploring"})
        self._emit_state()

    def restart(self):
        """재시작 = 시작과 동일"""
        print("[GameEngine] 재시작")
        self.start_game()

    def reset(self):
        """상태 초기화 (외부에서 호출)"""
        with self._lock:
            self._reset_locked()

    def _reset_locked(self):
        """내부 reset - 이미 락 잡힌 상태에서 호출"""
        self.phase = Phase.LOBBY
        self.power_restored = False
        self.flashlight_on = False
        for k in self.puzzles:
            self.puzzles[k]["solved"] = False
            if "attempts" in self.puzzles[k]:
                self.puzzles[k]["attempts"] = 0
        self.start_time = None
        self.hint_count = 0

    # ============================================================
    # 센서 입력 (시리얼 스레드에서 호출됨)
    # ============================================================

    def on_sensor(self, name: str, value):
        """센서값 1개 도착. 시리얼 리더 스레드에서 호출됨."""
        # 락 안: 상태 갱신 + 로직 판정용 페이즈 캡쳐
        with self._lock:
            self.sensors[name] = value
            current_phase = self.phase

        # 로깅 (스팸 방지)
        if config.LOG_SENSOR_VALUES:
            self._sensor_log_counter += 1
            if self._sensor_log_counter % config.LOG_SENSOR_INTERVAL == 0:
                print(f"[Sensor] {name}={value}")

        # 센서값은 항상 노트북에 모니터링용으로 전달
        self._emit({"type": "sensor", "name": name, "value": value})

        # 게임 단계별 로직 분기
        # LOBBY/ENDED 상태에서는 로직 실행 안 함 (센서값 모니터링만)
        if current_phase == Phase.EXPLORING:
            self._handle_exploring(name, value)
        elif current_phase == Phase.PLAYING:
            self._handle_playing(name, value)

    def _handle_exploring(self, name: str, value):
        """탐색 단계 (전력 차단) - 손전등 + 온도 퍼즐"""
        if name == "cds":
            self._update_flashlight(value)
        elif name == "temp":
            self._check_left_wall_puzzle(value)

    def _handle_playing(self, name: str, value):
        """플레이 단계 (전력 복구 후) - 나머지 퍼즐들"""
        # TODO: 추후 구현
        #   - 거리(dist) → 망원경
        #   - 가변저항(pot) → 무전기
        #   - 사운드(snd) → 모스
        #   - 키패드(key) → 최종 암호
        pass

    # ============================================================
    # 퍼즐별 판정 로직
    # ============================================================

    def _update_flashlight(self, cds_value):
        """
        CDS 값에 따라 손전등 상태 갱신.
        히스테리시스 사용: ON 임계와 OFF 임계가 다름 → 경계값 근처에서 깜빡임 방지.
        """
        # 상태 변경 여부를 락 안에서 결정
        new_state = None
        with self._lock:
            if not self.flashlight_on and cds_value >= config.CDS_FLASHLIGHT_ON_THRESHOLD:
                self.flashlight_on = True
                new_state = True
            elif self.flashlight_on and cds_value <= config.CDS_FLASHLIGHT_OFF_THRESHOLD:
                self.flashlight_on = False
                new_state = False

        if new_state is True:
            print(f"[Puzzle] 손전등 ON (CDS={cds_value})")
            self._emit({"type": "flashlight", "on": True})
        elif new_state is False:
            print(f"[Puzzle] 손전등 OFF (CDS={cds_value})")
            self._emit({"type": "flashlight", "on": False})

    def _check_left_wall_puzzle(self, temp_value):
        """
        온도 임계 도달 시 전력 복구.
        TODO(개선): 노이즈 방지 위해 N회 연속 임계값 초과 시에만 해제하도록.
        """
        with self._lock:
            if self.puzzles["leftWall"]["solved"]:
                return
            if temp_value < config.TEMP_POWER_RESTORE_THRESHOLD:
                return
            # 해제 처리
            self.puzzles["leftWall"]["solved"] = True
            print(f"[Puzzle] 전선 패널 해제 (TEMP={temp_value})")
            # 락 잡은 채로 _restore_power 호출 (RLock이라 재진입 가능)
            self._restore_power_locked()

        # 락 밖에서 emit
        self._emit({"type": "puzzle_solved", "puzzle": "leftWall"})
        self._emit({"type": "power", "restored": True})
        self._emit({"type": "flashlight", "on": False})
        self._emit({"type": "stage_enter", "stage": 2, "name": "playing"})

    def _restore_power_locked(self):
        """전력 복구. 이미 락 잡힌 상태에서 호출."""
        self.power_restored = True
        self.flashlight_on = False
        self.phase = Phase.PLAYING
        print("[GameEngine] 전력 복구! 플레이 단계 진입")

    # ============================================================
    # 노트북 → 라파 명령 처리 (TCP 수신 스레드에서 호출됨)
    # ============================================================

    def on_command(self, msg: dict):
        """노트북에서 온 명령 처리"""
        cmd_type = msg.get("type")

        if cmd_type == "start_game":
            self.start_game()
        elif cmd_type == "restart":
            self.restart()
        elif cmd_type == "request_state":
            self._emit_state()
        else:
            print(f"[GameEngine] 알 수 없는 명령: {cmd_type}")

    # ============================================================
    # 이벤트 발행
    # ============================================================

    def _emit(self, message: dict):
        """노트북으로 메시지 송신 (TCP 클라이언트 콜백)"""
        try:
            self.on_event(message)
        except Exception as e:
            print(f"[GameEngine] _emit 오류: {e}")

    def _emit_state(self):
        """현재 전체 상태 송신 (동기화/디버깅용)"""
        with self._lock:
            elapsed = (time.time() - self.start_time) if self.start_time else 0
            state = {
                "type": "game_state",
                "phase": self.phase.value,
                "power": self.power_restored,
                "flashlight": self.flashlight_on,
                "puzzles": {k: v["solved"] for k, v in self.puzzles.items()},
                "elapsed": int(elapsed),
            }
        self._emit(state)
