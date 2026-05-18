# SensorEscape

> AIoT 퍼즐 탈출 게임 - 폐창고에서 센서로 탈출하라

**현재 버전: 0.0.3**

---

## 프로젝트 개요

폐창고를 배경으로, 센서 입력으로 퍼즐을 푸는 인터랙티브 AIoT 시스템.
한 방의 다섯 면(앞/뒤/좌/우/천장)에서 일어나는 1인칭 시점 게임.

**최종 구조 (목표)**

```
아두이노 → 블루투스 → 라즈베리파이 → TCP소켓 → 서버 → WebSocket → 웹
```

**현재 단계**: 웹 프레임만 구축 (Mock 모드, 라파/서버 미연결)

---

## 사용 기술 스택

### 백엔드
- **Python 3.x**
- **FastAPI** (웹 서버)
- **Uvicorn** (ASGI 서버)
- **Jinja2** (HTML 템플릿)

### 프론트엔드
- **HTML5 / CSS3 / Vanilla JavaScript**
- 별도 빌드 도구 없음 (React/Vite 미사용)
- 단일 페이지에서 JS로 화면 전환

### 추후 추가 예정
- **WebSocket** (서버 ↔ 웹 실시간 통신)
- **SQLite** (게임 세션 기록)
- **LLM API** (AI 힌트 생성, 모델 추후 선정)

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
├── main.py                    # FastAPI 진입점
├── serial_bridge.py           # 아두이노 시리얼 → WebSocket 브릿지
├── arduino/
│   └── connection_test/
│       └── connection_test.ino    # 아두이노 연결 테스트 스케치
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

## 변경 이력

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
