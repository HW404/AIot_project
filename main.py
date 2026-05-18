"""
SensorEscape - AIoT 퍼즐 탈출 게임
FastAPI 기반 웹 서버

현재 단계: 0.0.3
- 메인 게임 페이지 (/)
- 시리얼 연결 테스트 페이지 (/test)
- WebSocket 엔드포인트 (/ws/test): 아두이노 시리얼 데이터 실시간 전달
"""

import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Set

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from serial_bridge import bridge

# ============================================================
# 경로 설정 - 어디서 실행하든 main.py 위치 기준으로 동작
# ============================================================
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"


def check_directories():
    """필수 폴더 존재 확인 + 친절한 에러 메시지"""
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
        print("\n현재 폴더 구조는 다음과 같아야 합니다:")
        print(f"  {BASE_DIR}/")
        print("    |-- main.py")
        print("    |-- static/")
        print("    |   |-- css/style.css")
        print("    |   `-- js/...")
        print("    `-- templates/")
        print("        |-- index.html")
        print("        `-- test.html")
        print("\n압축 파일을 풀 때 폴더 구조가 누락됐을 수 있습니다.")
        print("=" * 60 + "\n")
        raise SystemExit(1)


check_directories()


# ============================================================
# WebSocket 연결 관리
# ============================================================
class ConnectionManager:
    """테스트 페이지에 연결된 WebSocket 클라이언트들 관리"""
    
    def __init__(self):
        self.active: Set[WebSocket] = set()
    
    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.add(ws)
        # 접속 즉시 현재 시리얼 상태 전송
        await ws.send_json({
            "type": "status",
            "data": bridge.get_status()
        })
    
    def disconnect(self, ws: WebSocket):
        self.active.discard(ws)
    
    async def broadcast(self, message: dict):
        """모든 연결된 클라이언트에게 메시지 전송"""
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.discard(ws)


manager = ConnectionManager()


# ============================================================
# 시리얼 → WebSocket 브릿지 콜백
# ============================================================
async def on_serial_message(line: str):
    """시리얼에서 한 줄 받을 때마다 호출 → 웹으로 broadcast"""
    await manager.broadcast({
        "type": "serial",
        "data": line
    })


# ============================================================
# Lifespan: 서버 시작/종료 시 시리얼 브릿지 자동 관리
# ============================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작 시
    bridge.subscribe(on_serial_message)
    await bridge.start()
    yield
    # 종료 시
    await bridge.stop()


# ============================================================
# FastAPI 앱
# ============================================================
app = FastAPI(title="SensorEscape", version="0.0.3", lifespan=lifespan)

# 정적 파일 (CSS, JS, 이미지)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# HTML 템플릿
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


# ============================================================
# 라우트
# ============================================================
@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """메인 게임 화면"""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/test", response_class=HTMLResponse)
async def test_page(request: Request):
    """아두이노 연결 테스트 페이지"""
    return templates.TemplateResponse("test.html", {"request": request})


@app.get("/health")
async def health():
    """서버 동작 확인용"""
    return {
        "status": "ok",
        "version": "0.0.3",
        "serial": bridge.get_status()
    }


@app.websocket("/ws/test")
async def websocket_test(ws: WebSocket):
    """테스트 페이지 WebSocket 엔드포인트"""
    await manager.connect(ws)
    try:
        while True:
            # 클라이언트에서 보낸 메시지는 일단 무시 (수신만 테스트)
            # 추후 양방향 필요하면 여기에 처리 로직 추가
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)


# ============================================================
# TODO: 추후 추가 예정
# ============================================================
# - WebSocket /ws/game: 메인 게임용 채널
# - REST API /api/session: 게임 세션 관리
# - LLM 힌트 생성 엔드포인트 /api/hint
# - 라즈베리파이 TCP 소켓 수신부 (시리얼 대체)
# ============================================================


if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 60)
    print("  SensorEscape v0.0.3")
    print(f"  베이스 경로: {BASE_DIR}")
    print("  메인:       http://localhost:8000")
    print("  연결 테스트: http://localhost:8000/test")
    print("=" * 60 + "\n")
    # reload=True 시 시리얼 포트가 두 번 열리는 문제가 있어 끔
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
