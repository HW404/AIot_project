"""
SensorEscape - AIoT 퍼즐 탈출 게임
FastAPI 기반 웹 서버

현재 단계: 0.0.10
- 시리얼 모드: 아두이노 USB 직접 연결 (기존)
- TCP 모드:    라즈베리파이가 중계 (라파에 게임 엔진 탑재)

모드 전환:
  환경변수 INPUT_MODE 사용
  - INPUT_MODE=serial (기본): USB 시리얼 직결
  - INPUT_MODE=tcp           : 라파 TCP 서버

개선점 (v0.0.9):
  - 버전 문자열 갱신
  - broadcast 시 set 복사본 순회 (동시 변경 안전)
  - status 메시지에 mode 필드 통일 (브라우저가 식별 쉽게)
  - 브라우저 명령 처리 시 라파 미연결 알림
  - import json을 상단으로 이동
"""

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Set

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates


VERSION = "0.0.10"

# ============================================================
# 모드 선택
# ============================================================
INPUT_MODE = os.environ.get("INPUT_MODE", "serial").lower()

if INPUT_MODE == "tcp":
    from tcp_server import tcp_server
else:
    from serial_bridge import bridge


# ============================================================
# 경로 설정
# ============================================================
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"


def check_directories():
    missing = []
    if not STATIC_DIR.exists():
        missing.append(str(STATIC_DIR))
    if not TEMPLATES_DIR.exists():
        missing.append(str(TEMPLATES_DIR))

    if missing:
        print("\n" + "=" * 60)
        print("[ERROR] 필수 폴더가 없습니다:")
        for m in missing:
            print(f"  - {m}")
        print(f"\n현재 폴더: {BASE_DIR}")
        print("=" * 60 + "\n")
        raise SystemExit(1)


check_directories()


# ============================================================
# WebSocket 연결 관리
# ============================================================
class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.add(ws)
        # 접속 즉시 현재 상태 전송 (모드 정보 포함)
        await ws.send_json({"type": "status", "data": _get_input_status()})

    def disconnect(self, ws: WebSocket):
        self.active.discard(ws)

    async def broadcast(self, message: dict):
        """
        모든 연결된 클라이언트에게 메시지 전송.
        set 복사본으로 순회 → 도중에 disconnect/connect 일어나도 안전.
        """
        if not self.active:
            return
        dead = []
        for ws in list(self.active):  # 복사본
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.discard(ws)


manager = ConnectionManager()


def _get_input_status() -> dict:
    """현재 입력 소스 상태 (시리얼/TCP 통합 형식)"""
    if INPUT_MODE == "tcp":
        return tcp_server.get_status()
    return bridge.get_status()


# ============================================================
# 입력 → WebSocket 전달
# ============================================================
async def on_serial_message(line: str):
    """시리얼 모드: 텍스트 한 줄 받음"""
    await manager.broadcast({"type": "serial", "data": line})


async def on_pi_message(msg: dict):
    """
    TCP 모드: 라파에서 JSON 객체 받음 → 그대로 브라우저로 전달.
    
    라파가 보내는 메시지 종류:
      - {type: "sensor", name, value}
      - {type: "flashlight", on}
      - {type: "puzzle_solved", puzzle}
      - {type: "power", restored}
      - {type: "stage_enter", stage, name}
      - {type: "game_state", phase, power, flashlight, puzzles, elapsed}
    """
    await manager.broadcast(msg)


# ============================================================
# Lifespan
# ============================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    if INPUT_MODE == "tcp":
        tcp_server.subscribe(on_pi_message)
        await tcp_server.start()
    else:
        bridge.subscribe(on_serial_message)
        await bridge.start()
    yield
    if INPUT_MODE == "tcp":
        await tcp_server.stop()
    else:
        await bridge.stop()


# ============================================================
# FastAPI 앱
# ============================================================
app = FastAPI(title="SensorEscape", version=VERSION, lifespan=lifespan)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


# ============================================================
# 라우트
# ============================================================
@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/test", response_class=HTMLResponse)
async def test_page(request: Request):
    return templates.TemplateResponse("test.html", {"request": request})


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": VERSION,
        "mode": INPUT_MODE,
        "input": _get_input_status(),
    }


@app.websocket("/ws/test")
async def websocket_test(ws: WebSocket):
    """
    테스트 페이지 WebSocket.
    - 서버 → 브라우저: 시리얼/TCP에서 받은 메시지를 전부 broadcast
    - 브라우저 → 서버: JSON 명령 (TCP 모드에서만 라파로 전달)
    """
    await manager.connect(ws)
    try:
        while True:
            data = await ws.receive_text()
            await _handle_browser_command(ws, data)
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as e:
        print(f"[WS] 처리 오류: {e}")
        manager.disconnect(ws)


@app.websocket("/ws/game")
async def websocket_game(ws: WebSocket):
    """
    메인 게임 페이지 WebSocket.
    /ws/test와 동일하지만 별도 엔드포인트로 분리 (의미 명확화).
    같은 manager를 공유하므로 라파 메시지가 양쪽 모두에 broadcast됨.
    """
    await manager.connect(ws)
    try:
        while True:
            data = await ws.receive_text()
            await _handle_browser_command(ws, data)
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as e:
        print(f"[WS-Game] 처리 오류: {e}")
        manager.disconnect(ws)


async def _handle_browser_command(ws: WebSocket, data: str):
    """브라우저에서 온 명령 처리"""
    try:
        msg = json.loads(data)
    except json.JSONDecodeError:
        print(f"[WS] 브라우저 메시지 파싱 실패: {data[:100]}")
        return

    if INPUT_MODE != "tcp":
        # 시리얼 모드에서는 명령 처리 안 함 (아두이노 → 노트북 단방향)
        try:
            await ws.send_json({
                "type": "command_result",
                "ok": False,
                "reason": "시리얼 모드에서는 명령 송신 불가",
            })
        except Exception:
            pass
        return

    # TCP 모드: 라파에 전달
    sent = await tcp_server.send_to_pi(msg)
    if not sent:
        # 라파가 연결 안 됐거나 송신 실패
        try:
            await ws.send_json({
                "type": "command_result",
                "ok": False,
                "reason": "라파가 연결되지 않음",
                "command": msg.get("type"),
            })
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 60)
    print(f"  SensorEscape v{VERSION}  (모드: {INPUT_MODE.upper()})")
    print(f"  베이스 경로: {BASE_DIR}")
    print("  메인:       http://localhost:8000")
    print("  연결 테스트: http://localhost:8000/test")
    if INPUT_MODE == "tcp":
        print("  TCP 서버:   0.0.0.0:9000 (라파 연결 대기)")
        print("  ※ 라파의 config.py에서 SERVER_HOST를 이 노트북 IP로 설정")
    print("=" * 60 + "\n")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
