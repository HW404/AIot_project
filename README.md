# SensorEscape

> AIoT 퍼즐 탈출 게임 - 폐창고에서 센서로 탈출하라

**현재 버전: 0.0.13**

---

## 프로젝트 개요

폐창고를 배경으로, 센서 입력으로 퍼즐을 푸는 인터랙티브 AIoT 시스템.
한 방의 다섯 면(앞/뒤/좌/우/천장)에서 일어나는 1인칭 시점 게임.

**시스템 구조 (v0.0.13 기준 완성)**

```
아두이노 (6센서) → USB 시리얼 → 라즈베리파이 → TCP 소켓 → 노트북 서버 → WebSocket → 웹 브라우저
```

**현재 단계**: 게임 전체 흐름 완성 (탈출까지 가능). 아두이노↔라파↔노트북↔브라우저 4계층 통신 검증 완료. LLM 연동은 미사용으로 변경.

**게임 흐름 (1357 탈출)**
1. 어두운 방에서 시작 → 손전등(CDS)으로 비추기
2. 좌측벽 → DHT11 손으로 감싸 30°C 도달 → 전력 복구
3. 좌측벽 다시 → 벽에서 단서 **1** 발견
4. 천장 → 단서 **7** 발견
5. 우측벽 망원경 → 초음파 25cm 맞추기 → 단서 **3**
6. 뒷벽 무전기 → 가변저항 700 맞추기 → 부저 똑똑 5번 → 단서 **5**
7. 앞벽 키패드 → **1357** 입력 → 탈출!

---

## 사용 기술 스택

### 하드웨어
- **Arduino Uno R3** + 센서 6종 (CDS, 사운드, 가변저항, DHT11, 초음파, 부저)
- **Raspberry Pi** (게임 엔진 - 센서 판정, 상태 관리)
- **노트북** (FastAPI 서버 + 웹 호스팅)

### 백엔드
- **Python 3.x** (라파 게임 엔진 + 노트북 서버)
- **FastAPI** (웹 서버)
- **Uvicorn** (ASGI 서버)
- **Jinja2** (HTML 템플릿)
- **pyserial** (라파 ↔ 아두이노 시리얼)
- **소켓 통신** (TCP 9000번 포트, 라파 ↔ 노트북)

### 프론트엔드
- **HTML5 / CSS3 / Vanilla JavaScript**
- 별도 빌드 도구 없음 (React/Vite 미사용)
- 단일 페이지에서 JS로 화면 전환
- **WebSocket** (서버 ↔ 웹 실시간 통신)
- **Web Audio API** (모스 부호 부저 재생)

---

## 필수 패키지 설치

```bash
# 가상환경 권장
python -m venv venv
source venv/bin/activate          # Linux/Mac
venv\Scripts\activate             # Windows

# 패키지 설치
pip install -r requirements.txt
```

`requirements.txt`:
```
fastapi==0.115.0
uvicorn[standard]==0.32.0
jinja2==3.1.4
pyserial==3.5
```

---

## 실행 방법

```bash
python main.py
```

또는

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

브라우저에서 접속:
- 메인 게임: `http://localhost:8000`
- **연결 테스트**: `http://localhost:8000/test`

### 트러블슈팅

**`RuntimeError: Directory 'static' does not exist` 에러가 나는 경우**

v0.0.2부터 절대경로 기반으로 동작하므로 이 에러는 거의 발생하지 않지만, 만약 발생한다면:

1. `main.py`와 같은 폴더에 `static/`, `templates/` 폴더가 있는지 확인
2. 압축 해제 시 폴더 구조가 깨졌을 가능성 → 다시 받아서 폴더째 복사
3. 실행 명령은 어느 위치에서든 가능 (예: `python C:\path\to\main.py`)

---

## 폴더 구조

```
sensor-escape/
├── README.md
├── requirements.txt
├── main.py                    # FastAPI 진입점 (USB/TCP 모드 토글)
├── serial_bridge.py           # USB 모드용 시리얼 브릿지
├── tcp_server.py              # TCP 모드용 서버 (라파 연결 수신)
├── raspberry/                 # 라즈베리파이에서 실행할 코드 (v0.0.6 신규)
│   ├── pi_bridge.py           # 시리얼 수신 → TCP 송신
│   └── pi_config.py           # 노트북 IP 등 설정
├── arduino/
│   ├── connection_test/
│   │   └── connection_test.ino    # 아두이노 연결 테스트 (USB만)
│   ├── sensor_check/
│   │   └── sensor_check.ino       # 6개 센서 진단 (v0.0.5)
│   └── all_sensors/
│       └── all_sensors.ino        # 통합 센서 스케치 (매크로로 켜고 끄기)
├── docs/
│   └── HARDWARE_GUIDE.md          # ★ 7종 센서 배선 가이드
├── static/
│   ├── css/
│   │   ├── style.css          # 메인 게임 스타일
│   │   └── test.css           # 테스트 페이지 스타일
│   ├── js/
│   │   ├── gameState.js       # 전역 상태 관리
│   │   ├── gameService.js     # ★ Mock/Real 추상화 계층
│   │   ├── flashlight.js      # 손전등 제어
│   │   ├── test.js            # 테스트 페이지 WebSocket 클라이언트
│   │   ├── puzzles/
│   │   │   ├── leftWall.js
│   │   │   ├── rightWall.js
│   │   │   ├── backWall.js
│   │   │   └── frontWall.js
│   │   └── main.js
│   └── images/                # ★ 사용자가 그림 추가하는 폴더
│       ├── walls/
│       ├── items/
│       └── ui/
└── templates/
    ├── index.html             # 메인 게임 페이지
    └── test.html              # 연결 테스트 페이지
```

---

## 아두이노 연결 테스트 (v0.0.3 신규)

프로토타입 단계에서 **아두이노 ↔ 노트북 시리얼 통신**이 제대로 동작하는지 확인하는 페이지.

### 통신 구조

```
[아두이노] --USB 시리얼--> [노트북 Python] --WebSocket--> [브라우저]
```

추후 라파 붙일 때는 **시리얼 부분만 블루투스로 교체**하면 됨 (나머지 파이프라인은 그대로).

### 준비물

- 아두이노 보드 (Uno R3 또는 Nano)
- USB 케이블
- 추가 부품 없음 (LED는 보드 내장 13번 사용)

### 1. 아두이노 코드 업로드

`arduino/connection_test/connection_test.ino` 파일을 Arduino IDE로 열어 업로드.

**동작**: 1초마다 시리얼로 `HELLO 1`, `HELLO 2`, ... 송신 + 내장 LED 깜빡

### 2. Python 서버 실행

```bash
python main.py
```

서버 시작 시 자동으로 시리얼 포트를 감지해서 연결합니다. 콘솔에 다음과 같이 출력되면 OK:

```
[SerialBridge] 연결 성공: COM3 @ 9600 baud
```

포트를 못 찾는 경우:

```
[SerialBridge] 아두이노 포트를 찾지 못했습니다.
[SerialBridge] 연결된 포트 목록: [...]
```

→ 출력된 포트 목록을 보고 수동으로 확인. (Arduino IDE의 시리얼 모니터가 켜져 있으면 포트가 점유돼서 실패할 수 있음 — 끄고 재시도)

### 3. 테스트 페이지 접속

`http://localhost:8000/test`

성공 시 화면:
- WebSocket: 연결됨 (초록 점)
- 시리얼 포트: 연결됨 (포트명 표시)
- 마지막 수신: `HELLO N` (1초마다 갱신)
- 총 수신 횟수: 카운트 증가
- 로그 영역: `HELLO 1`, `HELLO 2`, ... 줄줄이 표시

### 시리얼 포트 수동 확인 방법

**Windows**: 장치 관리자 → 포트(COM & LPT) → "USB-SERIAL CH340 (COM3)" 같은 항목

**Mac/Linux**: 터미널에서 `ls /dev/tty.*` 또는 `ls /dev/ttyUSB*`

**Python 단독 실행으로 확인**:
```bash
python serial_bridge.py
```
→ 연결된 모든 시리얼 포트 목록 출력

---

## 센서 배선 가이드 (v0.0.4 신규)

7종 센서 + 출력 장치 배선법은 별도 문서 참고:

📖 **[docs/HARDWARE_GUIDE.md](docs/HARDWARE_GUIDE.md)**

### 통합 센서 스케치

`arduino/all_sensors/all_sensors.ino`는 모든 센서를 한 코드에서 관리합니다.

**사용법**: 코드 상단의 매크로에서 사용할 센서만 1로 변경.

```cpp
#define ENABLE_CDS       0    // 조도 센서
#define ENABLE_DHT       1    // ← 사용할 센서만 1로
#define ENABLE_ULTRA     0
#define ENABLE_SOUND     0
#define ENABLE_POT       0
#define ENABLE_KEYPAD    0
#define ENABLE_LCD       0
```

**시리얼 출력 형식** (1초마다):
```
CDS:512
TEMP:23.5
HUMID:45.0
DIST:18
SOUND:120
POT:678
KEY:5      (키패드는 입력 즉시 송신)
```

### 권장 추가 순서

1. CDS 조도 센서 (가장 단순)
2. DHT11 모듈
3. 가변저항
4. 초음파
5. 사운드 센서
6. 부저
7. LCD I2C
8. 키패드 (마지막, 핀 8개 차지)

각 센서 추가 후 동작 확인된 다음에 다음 센서를 추가하세요. 한 번에 다 꽂으면 어디가 잘못됐는지 디버깅이 어렵습니다.

### 센서 진단 스케치 (v0.0.5 신규)

여러 센서를 한꺼번에 연결한 후 **각각 제대로 동작하는지 한 번에 확인**하는 진단 코드.

`arduino/sensor_check/sensor_check.ino` 사용.

**대상 센서 (6종)**: CDS, 사운드, 가변저항, DHT11, 초음파, 부저

**사용법**
1. 아두이노에 업로드
2. 시리얼 모니터 열기 (Tools → Serial Monitor, 9600 baud)
3. 1초마다 다음과 같은 표가 출력됨:

```
=== Sensor Check (5s uptime) ===
[OK]   CDS         :  512 (range 0~1023, low=dark)
[OK]   SOUND       :  120 (clap/talk to test)
[OK]   POT         :  678 (rotate knob, 0~1023)
[      ] ULTRA       : 18 cm  (place hand to test)
[      ] DHT11 TEMP  : 23.5 C  (warm sensor with hand to test)
[      ] DHT11 HUMID : 45.0 %  (breathe near sensor to test)
[----] BUZZER      :      D8 pin set OUTPUT (silent - no tone)
```

**상태 마크 의미**
- `[OK]` — 값이 정상 범위에서 변하고 있음
- `[FAIL]` — 값이 0 또는 1023에서 멈춰있음 (10초 이상) → 배선 점검
- `[WARN]` — 가변저항이 끝에 고정됨 (사용자가 안 돌렸을 수 있음)
- `[----]` — 진단 대상 아님 (부저는 핀 설정만 확인, 소리 안 남)
- 초음파/DHT는 인라인으로 `FAIL` 표시

**테스트 방법**
- CDS: 손으로 가렸다 떼며 값 변화 확인
- 사운드: 박수치거나 말소리 → 값이 잠깐 올라감
- 가변저항: 손잡이 돌리며 0 ↔ 1023 사이 변화 확인
- 초음파: 손을 5cm/30cm 거리에 갖다 댐
- DHT11: 손으로 센서 감싸기 → 온도/습도 상승

**부저는 소리 안 남**: D8 핀이 OUTPUT으로 설정되었는지만 확인. 실제 소리 출력 테스트는 다른 코드 필요.

---

---

## 이미지 추가 방법

이미지는 `static/images/walls/` 폴더에 다음 파일명으로 저장하면 자동 적용됩니다.

| 파일 경로 | 용도 |
|----------|------|
| `static/images/walls/front_wall.png` | 앞벽 (출구) |
| `static/images/walls/back_wall.png` | 뒷벽 (무전기) |
| `static/images/walls/left_wall.png` | 왼쪽 벽 (전선) |
| `static/images/walls/right_wall.png` | 오른쪽 벽 (망원경) |
| `static/images/walls/ceiling.png` | 천장 |

이미지가 없으면 점선 박스로 placeholder가 표시됨.

---

## 게임 흐름

```
[Lobby 시작 화면]
    ↓ 게임 시작 버튼
[Game 게임 화면]
    - 정면(앞벽) 시점에서 시작
    - 손전등 토글로 어두운 방 탐색
    - 방향키 ←↑→↓ 또는 화면 버튼으로 시점 전환
    - 좌측 벽 온도 퍼즐 → 전력 복구 → 손전등 비활성
    - 우측 벽 망원경 → 암호 단서 획득
    - 뒷벽 무전기 → 모스 → 키패드 (3단계)
    - 모든 퍼즐 클리어 → 앞벽에서 탈출 버튼 활성
    ↓ 탈출
[End 종료 화면]
    - 완주 시간 / 힌트 사용 횟수 표시
```

---

## 조작 방법

| 입력 | 동작 |
|------|------|
| `←` `→` `↑` `↓` 방향키 | 시점 전환 (좌/우/천장/뒷벽) |
| 화면 하단 ⊙ 버튼 | 정면으로 복귀 |
| `F` 키 또는 손전등 버튼 | 손전등 켜기/끄기 |
| 좌측 상단 ≡ DEBUG | 디버그 패널 토글 |

---

## 디버그 패널 (개발용)

좌측 상단의 `≡ DEBUG` 버튼으로 토글:

- **센서 시뮬레이터**: 슬라이더로 CDS/온도/거리/주파수 조작
- **강제 조작**: 전력 복구, 힌트 발생, 퍼즐 클리어, 재시작
- **상태 표시**: 현재 GameState JSON 실시간 표시

실제 센서 연결 시 디버그 패널은 숨김 처리 가능.

---

## 데이터 추상화 (gameService.js)

Mock 모드와 Real 모드(WebSocket) 전환의 경계.
**나중에 서버 붙일 때 이 파일만 수정**하면 됩니다.

```js
const gameService = new GameService('mock');  // ← 'real'로 변경 시 WebSocket 연결
```

### 인터페이스
- 송신: `sendStart()`, `sendHintRequest()`, `sendKeypadInput()`, `sendRestart()`
- 수신: `on('hint')`, `on('sensor_update')`, `on('puzzle_result')`, `on('game_end')`

---

## 퍼즐 설계 (현재 구현 상태)

| 위치 | 센서 | 목표 | 상태 |
|------|------|------|------|
| 좌측 벽 | 온도 센서 | 30°C 이상 | 구현 완료 |
| 우측 벽 | 초음파 센서 | 거리 약 20cm | 구현 완료 |
| 뒷벽 - 무전기 | 포텐셔미터 | 값 약 700 | 구현 완료 |
| 뒷벽 - 모스 | 사운드 센서 | 패턴 매칭 | 골격만 |
| 뒷벽 - 키패드 | 4x4 키패드 | 4자리 암호 | 골격만 |
| 앞벽 | - | 모든 퍼즐 클리어 | 구현 완료 |

---

## 라즈베리파이 연동 (v0.0.6 신규)

발표 자료의 4계층 구조로 가는 1단계: **라파가 데이터 중계자 역할**.

### 통신 구조

```
[아두이노] --USB--> [라파] --TCP--> [노트북: FastAPI + 브라우저]
```

- 아두이노: USB로 라파에 연결 (기존 노트북 연결과 동일 방식)
- 라파: 시리얼 수신 → JSON 파싱 → TCP로 노트북에 송신
- 노트북: TCP 서버로 라파 데이터 받음 → WebSocket으로 브라우저에 전달

### 데이터 소스 모드 선택

`main.py` 상단에서 모드 선택:

```python
DATA_SOURCE_MODE = "tcp"   # "usb" 또는 "tcp"
```

- `"usb"`: 노트북에 아두이노 USB 직결 (기존 프로토타입)
- `"tcp"`: 라파 → TCP 수신 (목표 구조)

### 사전 준비

1. **라파와 노트북이 같은 와이파이에 연결되어 있어야 함**
2. **노트북 IP 확인** (Windows: PowerShell에서 `ipconfig` → `IPv4 주소`)
3. **라파에 코드 복사** (예: SCP, USB, Git 등)
4. **라파에 pyserial 설치**:
   ```bash
   sudo apt install python3-pip
   pip3 install pyserial
   ```

### 실행 순서

**1. 노트북 측 (서버)**

`main.py`에서 `DATA_SOURCE_MODE = "tcp"` 확인 후 실행:

```bash
python main.py
```

콘솔에 다음 출력:
```
SensorEscape v0.0.6
데이터 소스: TCP 모드
TCP 서버: 0.0.0.0:9000 (라파 연결 대기)
메인:       http://localhost:8000
연결 테스트: http://localhost:8000/test
```

**노트북 방화벽**: 9000번 포트 인바운드 허용 필요. Windows 방화벽이 첫 실행 시 알림 띄우면 "허용" 클릭.

**2. 라파 측**

`raspberry/pi_config.py` 열어서 노트북 IP 입력:

```python
SERVER_HOST = "192.168.0.10"   # ← 노트북 IP로 변경
```

아두이노를 라파 USB에 꽂고:

```bash
cd raspberry
python3 pi_bridge.py
```

성공 시 출력:
```
[Serial] 연결 성공: /dev/ttyUSB0 @ 9600 baud
[TCP] 연결 성공: 192.168.0.10:9000
[READY] 데이터 중계 시작
→ CDS=512  SND=68  POT=33  TEMP=26.0 ...
```

**3. 브라우저**

노트북에서 `http://localhost:8000/test` 접속.
1초마다 라파에서 보낸 센서값이 표시됨.

### 트러블슈팅

- **TCP 연결 실패**: 노트북 IP 잘못됨, 또는 방화벽 차단. 라파에서 `ping <노트북IP>` 으로 도달 확인
- **시리얼 못 찾음**: 라파에서 `ls /dev/ttyUSB* /dev/ttyACM*` 로 포트 확인 후 `pi_config.py`의 `SERIAL_PORT_OVERRIDE`에 수동 지정
- **권한 오류 (Permission denied: /dev/ttyUSB0)**: `sudo usermod -a -G dialout $USER` 후 라파 재로그인

---

## 변경 이력

### v0.0.13

**버전업 사유**: 손전등 동작 방식 변경 (환경 적응형)

**변경**: 손전등 ON/OFF가 고정 임계값(CDS ≥ 900)이 아니라 **변화량 기반**으로 작동.

- 게임 시작 시 첫 CDS 측정값을 baseline으로 저장
- 이후 `|현재값 - baseline| ≥ 10` 이면 손전등 ON
- `|현재값 - baseline| ≤ 5` 이면 OFF (히스테리시스)
- 환경 변화(형광등 켜진 방, 어두운 방 등)에 자동 적응
- 폰 손전등으로 비추거나 손으로 가렸다 떼는 것 모두 ON 트리거

**변경 파일**: `static/js/flashlight.js`

---

### v0.0.12

**버전업 사유**: 최종 게임 흐름 완성 (4자리 비밀번호 + 단서 4개 + 키패드)

**핵심 변화**: 게임을 처음부터 끝까지 플레이하고 탈출할 수 있는 완결된 게임 완성.

**비밀번호 시스템**
- 정답: **1357**
- 단서 4개 자리별로 수집:
  - 1번 자리 = **1** (전력 복구 후 좌측벽 다시 가면 자동 발견)
  - 2번 자리 = **3** (망원경 초음파 25cm 맞추기)
  - 3번 자리 = **5** (무전기 주파수 맞추면 자동으로 똑똑 5번 들려줌)
  - 4번 자리 = **7** (전력 복구 후 천장 시점에서 발견)

**신규 파일**
- `static/js/puzzles/hiddenClues.js` — 좌측벽/천장 숨겨진 단서 자동 발견
- `static/js/puzzles/morse.js` (재작성) — 박수 입력 제거, 부저 자동 재생 + "들었다" 버튼

**가상 키패드** (`frontWall.js` 재작성)
- 4×3 키패드 UI (1~9, 0, *, #)
- 마우스 클릭 또는 키보드 0~9 / Backspace(=*) / Enter(=#)
- 4자리 채우면 자동 검증
- 정답: 1.5초 후 ended phase
- 오답: 슬롯 흔들기 + 자동 리셋
- 수집한 단서를 슬롯 위에 미리보기 표시
- 정면 시점에서 항상 보이도록 강제 (`ensureVisibility()`)

**무전기 (`backWall.js`)**
- 주파수 게이지 추가 (가변저항 0~1023을 시각화)
- 목표 영역(670~730) 점선으로 표시
- 근접 시 게이지 색상 초록으로 변화
- 센서 이름 버그 수정: `potentiometer` → `pot`

**망원경 (`rightWall.js`)**
- 센서 이름 버그 수정: `distance` → `dist`
- 목표 거리 20cm → **25cm**
- 허용 오차 ±5 → **±3cm**

**좌측벽 온도 게이지 (`leftWall.js`)**
- 게이지 범위 -10~50°C → **20~30°C**로 좁힘 (변화가 잘 보이게)

**손전등 (`flashlight.js`)**
- 수동 토글 → **CDS 센서 자동 판정**
- 임계값: ON=900, OFF=600 (히스테리시스)
- (v0.0.13에서 변화량 기반으로 재변경)

**모스 단순화**
- 박수 입력 제거 → 듣기만 하면 단서 부여 (외우는 아이템처럼)
- 무전기 클리어 → 1.5초 후 자동 재생 (Web Audio API, 660Hz)
- "들었다" 버튼 클릭 → 인벤토리에 "3번 자리: 5" 추가
- "다시 듣기" 버튼으로 재재생 가능

**숨겨진 단서**
- 좌측벽: 전력 복구 후 다시 가면 1.2초 후 "벽에 새겨진 흔적" + 큰 숫자 "1"
- 천장: 전력 복구 전엔 "어두운 천장", 복구 후엔 "불이 들어오자 숫자가 드러났다" + "7"

**인벤토리 UI 개선** (`main.js`)
- 단서 클릭 시 펼침/접힘
- 펼치면 단서 내용(자리 번호와 숫자)을 초록색 큰 글자로 표시
- 부드러운 펼침 애니메이션 (0.25초)

**기타 개선**
- 게임 중 ESC 키 / HUD 우측 ⟲ 버튼 / 디버그 패널 / 클리어 후 재시작 → 모두 통합된 `resetGame()` 사용
- 라파에도 `restart` 명령 자동 송신
- 모든 모듈의 `reset()` 호출로 깨끗한 초기화

**변경 파일 (11개)**
- `static/js/flashlight.js`
- `static/js/main.js`
- `static/js/puzzles/leftWall.js`
- `static/js/puzzles/rightWall.js`
- `static/js/puzzles/backWall.js`
- `static/js/puzzles/morse.js` (신규/재작성)
- `static/js/puzzles/hiddenClues.js` (신규)
- `static/js/puzzles/frontWall.js` (재작성)
- `templates/index.html`
- `static/css/style.css`

---

### v0.0.11

**버전업 사유**: 테스트 페이지 UI 대폭 개선 (센서별 카드 + 게임 상태 카드 추가)

**핵심 변화**: 각 센서가 살아있는지 한눈에 보이고, 게임 진행 상태도 시각화.

**`templates/test.html`**
- 센서 6종 카드 그리드 추가 (CDS / SND / POT / TEMP / HUM / DIST)
  - 각 카드: 센서명, 현재값, 마지막 수신 시간, 상태 점
- 게임 이벤트 카드 4종 추가 (손전등 / 전력 / 단계 / 해결한 퍼즐 수)
- 도움말 섹션 v0.0.10 구조에 맞게 갱신 (TCP 모드, 라파 설정 안내)

**`static/css/test.css`**
- 센서 카드 스타일 + 색상 상태 (online=초록, stale=노랑, offline=회색)
- 값 변경 시 깜빡임 애니메이션 (`sensor-flash`)
- 게임 이벤트 카드 스타일 (active=노랑, success=초록)
- 반응형 그리드 (1100px 이하 3열, 600px 이하 2열)

**`static/js/test.js`**
- `sensors` 객체로 센서별 마지막값 / 마지막시각 추적
- `updateSensorCard(name, value)`: 센서 메시지 받을 때마다 해당 카드 갱신
- `applySensorCardState(card, name)`: 시간 경과 따라 online/stale/offline 분류
  - 3초 이내 = online (초록)
  - 3~10초 = stale (노랑)
  - 10초 초과 = offline (회색)
- 1초마다 `refreshSensorCards()` 호출하여 시간 표시 + 상태 색상 갱신
- 시리얼 모드에서도 텍스트 파싱(`parseSerialAndUpdate`)으로 카드 갱신
- 게임 이벤트(`flashlight`, `power`, `puzzle_solved`, `stage_enter`) 받을 때마다 이벤트 카드 갱신
- `updateEventCards()`: 게임 상태를 카드 4종에 일괄 반영

**사용 효과**
- "어떤 센서가 동작 안 하는지" 한눈에 파악 (회색 카드 = 미수신)
- 노이즈 많은 센서 디버깅에 유리 (값 변화 깜빡임으로 확인)
- 게임 진행 상태가 실시간으로 보임 → 시연 / 발표 / 디버깅에 모두 활용 가능
- LCD 같은 추가 모니터링 장치 없이도 게임 상태 파악

---

### v0.0.10

**버전업 사유**: 로직 변경 + 코드 100줄 이상 추가 (메인 게임에 라파 메시지 연결)

**핵심 변화**: 지금까지 라파에서 노트북까지만 메시지가 흘렀는데, 이번엔 **메인 게임 페이지(`/`)에서 실제로 그 메시지를 받아 화면을 그리게 됨**.

**노트북 측 (`main.py`)**
- `/ws/game` 엔드포인트 추가 (메인 게임용 WebSocket)
- `/ws/test`와 같은 manager 공유 → 라파 메시지가 양쪽에 broadcast

**브라우저 측**

`static/js/gameService.js` ★ 완전 재작성
- 페이지 로드 시 자동으로 WebSocket 연결 시도
- 연결 성공: `ws` 모드 → 라파 메시지를 GameState에 반영
- 연결 실패/끊김: `mock` 모드 폴백, 3초마다 재시도
- 라파에서 오는 메시지 7종 모두 처리:
  - `sensor` → `GameState.updateSensor()`
  - `flashlight` → `GameState.setFlashlight()`
  - `power` → `GameState.setPower()`
  - `puzzle_solved` → `GameState.solvePuzzle()`
  - `stage_enter` → 이벤트 발행
  - `game_state` → 전체 상태 동기화
  - `status` / `command_result` → UI 알림
- 브라우저 → 서버 명령: `sendStart`, `sendRestart`, `sendHintRequest`, `sendKeypadInput`, `requestState`
- 서버 미연결 시 힌트 요청은 Mock 힌트로 자동 폴백

`static/js/main.js`
- 연결 상태 변화 리스너 추가 (`gameService.on('connection', ...)`)
- 입력 소스 상태 리스너 추가 (`gameService.on('status', ...)`)
- 로비 화면 + HUD에 현재 연결 상태 표시
  - Mock / 라파 / 시리얼 / 대기

`templates/index.html`
- HUD에 "입력" 항목 추가 (Mock / 라파 / 대기 표시)

**디버그 패널은 그대로 유지**
- 라파 연결되어도 슬라이더는 동작 (시뮬레이션 겸용)
- 라파 메시지와 슬라이더 입력이 모두 GameState에 반영됨

**검증된 동작 (통합 테스트)**
- 가상 라파 → 노트북 → 메인 게임 페이지: 손전등/전력/퍼즐 메시지 정상 전달
- 메인 게임 페이지 → 노트북 → 라파: 명령(`start_game`) 정상 전달
- WebSocket 끊김 시 자동 재연결

**실제 동작 시나리오**

1. 라파에서 `python main.py` 실행
2. 노트북에서 `INPUT_MODE=tcp python main.py` 실행
3. 브라우저에서 `http://노트북IP:8000` 접속
4. 로비 화면 하단에 "라파 연결됨" 표시 확인
5. "게임 시작" 클릭 → 라파가 EXPLORING 단계로 진입
6. 손전등으로 CDS 비춤 → 화면 중앙에 원형 빛 자동 표시
7. DHT11을 손으로 감쌈 → 30°C 도달 시 전선 패널 클리어 + 전력 복구

**남은 미구현 (다음 버전 예정)**
- 나머지 퍼즐(망원경, 무전기, 모스, 키패드) 라파 로직
- LLM 힌트 연동
- 블루투스 전환

---

### v0.0.9

**버전업 사유**: 로직 변경 + 코드 100줄 이상 추가 (노트북 측 코드 면밀 검토)

**노트북 측 코드 리팩토링 (v0.0.7~8에서 라파 측만 손봤던 부분 보완)**

`tcp_server.py`
- ★ **새 라파 연결 들어오면 기존 연결 명시적 정리** (잠깐 두 라파가 동시에 있을 때 안전)
- ★ **`send_to_pi`에 `asyncio.Lock` 추가** (여러 브라우저가 동시에 명령 보낼 때 race 방지)
- ★ **송신 실패 시 `client_writer` 정리** (불일치 상태 방지)
- `asyncio.CancelledError`와 일반 예외 분리 (정상 종료 흐름 보호)
- `get_status()`에 `mode: "tcp"`, `pi_addr` 필드 추가 (브라우저 식별용)
- finally 블록에서 자기 writer만 정리 (다른 라파가 교체한 경우 보호)

`serial_bridge.py`
- ★ **시리얼 끊김 시 자동 재오픈** (USB 뺐다 꽂아도 복구. 라파의 serial_reader와 동일 패턴)
- ★ **`reset_input_buffer()` 호출** (부팅 중 깨진 데이터 제거)
- ★ **첫 연결 실패해도 백그라운드에서 재시도**
- `asyncio.get_event_loop()` → `get_running_loop()` (Python 3.10+ 권장)
- `get_status()`에 `mode: "serial"` 필드 추가
- 불필요한 `asyncio.sleep(0.01)` 제거

`main.py`
- ★ **버전 문자열을 `VERSION` 상수로 통일** (지금까지 0.0.5에 멈춰있었음)
- ★ **`broadcast`에서 set 복사본 순회** (동시 변경 안전)
- 상태 메시지 통일: `_get_input_status()` 헬퍼로 시리얼/TCP 공통 형식 보장
- 브라우저 명령 처리를 별도 함수로 분리 (`_handle_browser_command`)
- ★ **라파 미연결 시 브라우저에 알림** (`command_result` 메시지)
- 시리얼 모드에서 명령 시도 시도 시 명시적 거부 응답
- `import json`을 상단으로 (매 호출마다 import 안 함)

`static/js/test.js` ★ **가장 큰 수정**
- v0.0.7~8에서 라파 메시지 형식이 변경됐는데 브라우저는 옛 형식만 처리하던 버그 수정
- 처리하는 메시지 타입을 라파의 실제 출력에 맞춰 재작성:
  - `sensor`: 단일 센서값 (이전엔 `sensors` 복수형으로 잘못 처리)
  - `flashlight`, `puzzle_solved`, `power`, `stage_enter`, `game_state` 신규 핸들러
  - `status` 메시지를 `mode` 필드 기준으로 분기
  - `command_result` 메시지 처리 (명령 성공/실패 알림)
- 메시지 타입별 시각적 구분 (sensor=초록, event=보라, error=빨강 등)
- 디버그용 `sendCommand` 메서드 추가 (브라우저 콘솔에서 직접 명령 송신 가능)
  - 예: `TestPage.sendCommand({type: 'start_game'})`
- 알 수 없는 type도 무시 안 하고 로그로 표시 (디버깅)

`static/css/test.css`
- 새 로그 태그 색상 추가: `sensor`, `event`, `state`, `error`, `unknown`

**검증된 동작 (통합 테스트)**
- 노트북 TCP 서버 ↔ 라파 TCP 클라이언트 양방향 통신
- 6가지 메시지 타입 모두 송수신
- 100개 동시 송신 시 손실 0, 순서 유지
- 라파 끊김 → 자동 감지 (서버 상태 즉시 갱신)
- 라파 재연결 → 정상 통신 복구

**브라우저 사용법 변화**
- 테스트 페이지(`/test`)에서 라파 메시지가 의미 단위로 표시됨
  - 이전: `{"type":"sensor","name":"cds","value":920}` 처리 안 됨
  - 이후: `[SENSOR] cds=920` 형식으로 깔끔 표시
- 브라우저 콘솔에서 라파에 명령 송신 가능 (개발자 도구 F12 → Console)
  ```
  TestPage.sendCommand({type: 'start_game'})
  TestPage.sendCommand({type: 'restart'})
  TestPage.sendCommand({type: 'request_state'})
  ```

---

### v0.0.8

**버전업 사유**: 로직 변경 (라파 코드 면밀 검토 + 안정성 강화)

**라파 코드 리팩토링 (이전 버전 검토 후 발견된 이슈 수정)**

`serial_reader.py`
- ★ **시리얼 끊김 자동 재오픈**: USB 뺐다 꽂아도 복구됨 (기존엔 한번 끊기면 영원히 끊김)
- 첫 연결 실패해도 백그라운드에서 계속 재시도 (USB 늦게 꽂아도 OK)
- 시리얼 열림 직후 `reset_input_buffer()` 호출 (부팅 중 깨진 데이터 제거)
- None 체크 + 정수/실수 변환 안전화 (음수, 가비지 텍스트 등 엣지케이스 대응)
- 정규식 개선: 잘못된 매치 방지

`tcp_client.py`
- ★ **송신 큐 + 별도 송신 스레드** 도입
  - 기존엔 시리얼 콜백에서 직접 sock.sendall → 네트워크 느려지면 시리얼 읽기 멈춤
  - 이제 send()는 큐에 넣기만 (비블로킹), 실제 송신은 별도 스레드
- ★ **재연결 시 이전 소켓 명시적 정리** (누수 방지)
- ★ **스레드 안전성**: send 락 제거 (단일 송신 스레드 구조라 불필요), 데드락 가능성 제거
- 큐 가득 차면 가장 오래된 메시지 버리고 새 메시지 받기 (실시간성 우선)
- `_stop.wait()` 활용해 종료 시 즉시 깨어남
- 스레드 이름 정리 (TCPClient-Conn, TCPClient-Send, TCPClient-Recv)

`game_engine.py`
- ★ **`threading.RLock`으로 상태 보호** (가장 중요)
  - 시리얼 스레드(on_sensor) ↔ TCP 수신 스레드(on_command) 동시 접근 가능
  - 기존 코드는 레이스 컨디션 발생 가능 (예: 게임 시작 중 센서값 도착)
  - RLock 사용 이유: `_check_left_wall_puzzle`이 락 잡은 채 `_restore_power` 호출
- 락은 상태 변경 시만, `_emit`은 락 밖에서 (콜백 안에서 다시 send 호출 대응)
- LOBBY/ENDED 상태에서는 게임 로직 안 돌리고 sensor 메시지만 발행 (명시적)
- 콜백 호출 시 try/except로 보호 (콜백이 예외 던져도 엔진 안 죽음)

`main.py`
- 변수명 `serial` → `reader`로 변경 (Python 표준 lib `serial`과 충돌 방지)
- signal 핸들러는 플래그만 세팅, 메인 루프가 감지하고 정리 (안전한 종료)
- 시리얼 첫 연결 실패해도 죽지 않고 백그라운드 재시도 안내

`config.py`
- CDS 임계값 부분에 회로 구성별 값 방향 주석 추가
- 분압 회로 구성에 따라 비교 부등호 반대일 수 있음 명시

**검증된 동작**
- 게임 엔진 시나리오 6종 통과 (LOBBY 무시, 손전등 토글, 히스테리시스, 전력 복구, 재시작, 알 수 없는 명령)
- TCP 양방향 통신 테스트 통과
- TCP 재연결 시나리오 통과 (서버 늦게 시작해도 자동 연결)
- 시리얼 파싱 8종 (실제 사용자 데이터, 음수, 문자열, 가비지) 통과

**주의 사항 (사용자 환경)**
- 평상시 CDS 값이 ~963으로 측정됨 → 회로 구성에 따라 비교 방향이 반대일 수 있음
- 실제 손전등 비춰서 값 방향 확인 후 config.py의 CDS 임계값 조정 필요
  - 밝을수록 값 ↑이면: ON=850, OFF=700 같이 조정
  - 밝을수록 값 ↓이면: `_update_flashlight`의 `>=`/`<=` 부등호 반대로

---

### v0.0.7

**버전업 사유**: 로직 변경 + 코드 100줄 이상 추가 (라파에 게임 엔진 도입)

**핵심 변화**
- 라파 역할이 **단순 중계자 → 게임 엔진**으로 확장
- 게임 상태(phase, power, 손전등, 퍼즐 진행)를 라파가 소유
- 1단계 기본 로직 구현: CDS → 손전등 ON/OFF, 온도 → 전력 복구

**라파 측 (신규/재구성)**
- **`raspberry/config.py`** — 시리얼 포트, 노트북 IP, 임계값
- **`raspberry/serial_reader.py`** — 아두이노 시리얼 수신 (별도 스레드)
  - 한 줄 다중 토큰(KEY=VAL KEY=VAL) 및 단일 토큰(KEY:VAL) 모두 파싱
  - 자동 포트 감지 폴백
- **`raspberry/tcp_client.py`** — 노트북 TCP 서버에 연결
  - 자동 재연결 (3초 간격)
  - 양방향 통신 (라파 → 노트북, 노트북 → 라파)
- **`raspberry/game_engine.py`** — ★ 게임 엔진 본체
  - `GameEngine` 클래스 + `Phase` Enum
  - 센서값 → 단계별 로직 분기
  - CDS 임계값으로 손전등 토글
  - 온도 임계값으로 전력 복구 + Phase 전환
  - 향후 확장(망원경, 무전기, 모스, 키패드) 위치만 표시
- **`raspberry/main.py`** — 진입점 (시리얼 + TCP + 엔진 연결)
- **`raspberry/requirements.txt`** — pyserial

**노트북 측 (수정)**
- **`main.py`** — `INPUT_MODE` 환경변수로 시리얼/TCP 모드 전환
- **`tcp_server.py`** — 라파 연결 받는 TCP 서버 (asyncio)
- 브라우저에서 온 명령을 라파로 전달하는 경로 추가

**메시지 프로토콜 정의**
- 아두이노 → 라파: 텍스트 (`CDS:920` 또는 `CDS=920 TEMP=23.5`)
- 라파 → 노트북: JSON + 개행 (`{"type":"sensor","name":"cds","value":920}`)
- 노트북 → 라파: JSON + 개행 (`{"type":"start_game"}` 등)

**메시지 타입**
- `sensor`: 센서값 (모니터링용, 항상 송신)
- `flashlight`: 손전등 ON/OFF
- `puzzle_solved`: 퍼즐 해결
- `power`: 전력 복구
- `stage_enter`: 단계 진입
- `game_state`: 전체 상태 (디버깅/동기화)

**실행 방법**
- 노트북: `INPUT_MODE=tcp python main.py` (Windows: `set INPUT_MODE=tcp && python main.py`)
- 라파: `cd raspberry && python main.py`
- 라파의 `config.py`에서 `SERVER_HOST`를 노트북 IP로 변경 필수

---

### v0.0.6

**버전업 사유**: 로직 변경 + 코드 100줄 이상 추가 (라파 연동 1단계)

**추가된 내용**
- **`raspberry/pi_bridge.py`** — 라파에서 실행: USB 시리얼 → TCP 송신
  - 아두이노 포트 자동 감지 (/dev/ttyUSB*, /dev/ttyACM*)
  - 시리얼 라인 → JSON 변환 (sensor_check 형식 파싱)
  - TCP 클라이언트, 연결 끊김 시 자동 재시도
- **`raspberry/pi_config.py`** — 노트북 IP, 포트 등 설정
- **`tcp_server.py`** — 노트북에서 라파 연결 수신하는 TCP 서버
  - asyncio 기반, 라파 한 대 연결 처리
  - 수신 메시지를 콜백으로 전달
- **`main.py`** 수정:
  - `DATA_SOURCE_MODE` 토글 ("usb" / "tcp")
  - 모드에 따라 serial_bridge 또는 tcp_server 자동 시작
  - `/health` 엔드포인트에 모드 정보 포함
- **테스트 페이지** 업데이트:
  - TCP 모드 상태 표시 (라파 연결 상태)
  - `sensors` 타입 메시지 표시 (라파가 파싱한 데이터)

**현재 단계**: 통신 파이프라인만 — 라파는 단순 중계자
**다음 단계 (v0.0.7~)**: 라파에 게임 로직 엔진 추가 (퍼즐 판정, 단계 관리)

---

### v0.0.5

**버전업 사유**: 코드 100줄 이상 추가 (센서 진단 스케치 286줄)

**추가된 내용**
- **`arduino/sensor_check/sensor_check.ino`** — 6개 센서 통합 진단 스케치
  - CDS, 사운드, 가변저항, DHT11, 초음파, 부저 동시 확인
  - 시리얼 모니터에 1초마다 표 형태로 출력
  - 값이 변하지 않으면 자동 `[FAIL]` 판정 (배선 의심)
  - 초음파 timeout, DHT11 NaN 별도 처리
  - 부저는 소리 안 남 (D8 핀 OUTPUT 설정만 확인)
- README에 센서 진단 사용법 + 테스트 방법 섹션 추가

**용도**
- 실제 센서를 연결한 후 모두가 정상 동작하는지 한 번에 검증
- 어느 센서가 안 되는지 빠르게 식별 → 해당 배선만 점검

**의존 라이브러리**
- DHT sensor library (Adafruit) — 사전 설치 필요

---

### v0.0.4

**버전업 사유**: 코드 100줄 이상 추가 (통합 센서 스케치 + 하드웨어 가이드 문서)

**추가된 내용**
- **`docs/HARDWARE_GUIDE.md`** — 7종 센서 + 출력 장치 배선 가이드 (참고용)
  - 핀 배치 종합표 (충돌 없는 권장 배치)
  - 센서별 배선도 (텍스트 다이어그램)
  - CDS, DHT11, HC-SR04, 사운드, 가변저항, 4x4 키패드, LCD I2C, 부저/LED
  - 빵판 사용법 + 트러블슈팅
  - 센서 추가 권장 순서
- **`arduino/all_sensors/all_sensors.ino`** — 통합 센서 스케치
  - 매크로(`#define ENABLE_*`)로 사용할 센서만 켜고 끄기 가능
  - 모든 센서값을 `KEY:VALUE` 형식으로 시리얼 송신
  - 키패드는 이벤트성 즉시 송신, 나머지는 1초 주기 송신
- README에 하드웨어 가이드 링크 + 사용법 섹션 추가

**주의 사항**
- 통합 스케치는 **모든 센서가 연결됐을 때 동작 안 하는 게 아님** — 매크로로 활성화한 센서만 처리하므로 안전
- 초기 상태는 모든 센서 비활성. 사용자가 직접 1로 변경 후 업로드해야 함
- 센서별 라이브러리는 사용 시점에만 설치 필요 (DHT, Keypad, LiquidCrystal_I2C)

---

### v0.0.3

**버전업 사유**: 로직 변경 + 코드 100줄 이상 추가 (시리얼 통신 + WebSocket + 테스트 페이지)

**추가된 기능**
- **아두이노 시리얼 통신** 파이프라인 구축
  - `arduino/connection_test/connection_test.ino`: 1초마다 시리얼 송신 + LED 점멸
  - `serial_bridge.py`: pyserial 기반 포트 자동 감지 + 비동기 읽기 루프
- **FastAPI WebSocket 엔드포인트** (`/ws/test`) 추가
  - `ConnectionManager` 클래스로 다중 클라이언트 관리
  - 시리얼 → WebSocket 브로드캐스트 콜백 연결
- **연결 테스트 페이지** (`/test`) 추가
  - WebSocket 연결 상태 표시
  - 시리얼 포트 상태 표시
  - 마지막 수신 메시지 + 총 수신 횟수
  - 실시간 로그 (자동 스크롤, 메모리 보호용 500개 제한)
  - 자동 재연결 (3초 간격)
- **새 패키지**: `pyserial==3.5`
- 메인 게임 페이지(`/`)와 테스트 페이지(`/test`) 라우트 분리
- `uvicorn reload=False` 설정 (시리얼 포트 중복 점유 방지)

**해결한 이슈**
- 메인 게임 코드에는 영향 없음 (테스트 페이지는 완전히 독립)

---

### v0.0.2

**버전업 사유**: 로직 변경 (경로 처리 방식)

**변경 내용**
- `main.py` 경로 처리 방식을 **상대경로 → 절대경로**로 변경
  - `Path(__file__).resolve().parent` 기준으로 `static`, `templates` 위치 결정
  - 어느 위치에서 `python main.py` 실행해도 동작
- 시작 시 필수 폴더(`static`, `templates`) 존재 확인 + 친절한 에러 메시지 출력
- 서버 시작 시 베이스 경로 / 접속 주소 콘솔 출력 추가
- README에 트러블슈팅 섹션 추가

**해결한 이슈**
- `RuntimeError: Directory 'static' does not exist`
  - 원인: 작업 디렉토리가 `main.py` 위치와 다를 때 상대경로 참조 실패
  - 해결: 절대경로 기반으로 변경

---

### v0.0.1 (최초 빌드)

**구축 내용**
- FastAPI 기반 웹 서버 (`main.py`) 구축
- 단일 HTML 페이지 + 5면 벽 구조 (`templates/index.html`)
- CSS 빈티지 톤 디자인 (`static/css/style.css`)
- 게임 상태 관리 모듈 (`gameState.js`)
- 데이터 소스 추상화 계층 (`gameService.js`) - Mock 모드 동작
- 손전등 토글 (중앙 원형 빛) (`flashlight.js`)
- 좌측 벽 온도 퍼즐 (`leftWall.js`)
- 우측 벽 망원경 퍼즐 (`rightWall.js`)
- 뒷벽 퍼즐 골격 (`backWall.js`) - 무전기까지만
- 앞벽 탈출구 (`frontWall.js`)
- 시점 전환 (방향키/버튼)
- 타이머 / 인벤토리 / AI 힌트 박스 UI
- 디버그 패널 (센서 시뮬레이터)

**미구현 (다음 버전 예정)**
- 모스 신호 패턴 매칭 로직
- 4x4 키패드 입력 UI 및 정답 검증
- 손전등으로 단서 발견하는 인터랙션 (벽별 hidden item)
- 천장 단서
- WebSocket 연결 (서버 붙는 시점에)
- 실제 LLM 힌트 연동

---

## 버전 관리 규칙

- 시작: `0.0.1`
- 코드 100줄 이상 추가 또는 로직 변경 시 → 세 번째 자리 +1 (`0.0.2`, `0.0.3`...)
- 첫/두 번째 자리는 사용자 명시적 지시 시에만 변경
- 매 버전업 시 본 README 변경 이력에 기록