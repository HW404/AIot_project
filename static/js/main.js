/**
 * 메인 진입점
 * - 화면 전환 (Lobby → Game → End)
 * - 시점 전환
 * - 타이머
 * - 디버그 패널
 * - 인벤토리/힌트 UI
 */

const App = {
    timerInterval: null,
    
    init() {
        this.bindLobby();
        this.bindEnd();
        this.bindViewControls();
        this.bindHintBox();
        this.bindDebugPanel();
        this.bindStateListeners();
        this.bindKeyboard();
        this.bindHudResetButton();
        
        // 모듈 초기화
        Flashlight.init();
        LeftWallPuzzle.init();
        RightWallPuzzle.init();
        BackWallPuzzle.init();
        MorsePuzzle.init();
        HiddenClues.init();
        FrontWallPuzzle.init();
        
        // 서비스 이벤트 → GameState 반영
        gameService.on('hint', (hint) => {
            GameState.addHint(hint);
            this.showHint(hint);
        });

        // 서버 연결 상태 표시
        gameService.on('connection', (info) => {
            this.updateConnectionStatus(info);
        });

        // 라파 입력 소스 상태 (status 메시지)
        gameService.on('status', (data) => {
            this.updateInputStatus(data);
        });

        // 명령 결과 (라파 미연결 등)
        gameService.on('command_result', (msg) => {
            if (!msg.ok) {
                console.warn(`명령 실패 (${msg.command}): ${msg.reason}`);
                // 화면에 표시할지 여부는 추후 결정 (지금은 콘솔만)
            }
        });
    },

    // ========================================================
    // 연결 상태 UI 업데이트
    // ========================================================
    updateConnectionStatus(info) {
        const el = document.getElementById('connection-text');
        const dot = document.querySelector('.connection-status .status-dot');
        const hudEl = document.getElementById('input-source');

        if (el && dot) {
            if (info.connected) {
                el.textContent = '서버 연결됨 (실제 센서 대기 중)';
                dot.className = 'status-dot connected';
            } else {
                el.textContent = 'Mock 모드 (서버 미연결, 디버그 슬라이더로 조작)';
                dot.className = 'status-dot mock';
            }
        }

        if (hudEl) {
            hudEl.textContent = info.connected ? '서버' : 'Mock';
        }
    },

    updateInputStatus(data) {
        // data 예: {mode:"tcp", pi_connected:true, pi_addr:"192.168..."}
        const el = document.getElementById('connection-text');
        const hudEl = document.getElementById('input-source');

        let lobbyText = '';
        let hudText = '';

        if (data.mode === 'tcp') {
            if (data.pi_connected) {
                lobbyText = `라파 연결됨 (${data.pi_addr || ''})`;
                hudText = '라파';
            } else {
                lobbyText = '서버 연결됨 — 라파 대기 중';
                hudText = '대기';
            }
        } else if (data.mode === 'serial') {
            if (data.connected) {
                lobbyText = `시리얼 직접 연결됨 (${data.port})`;
                hudText = '시리얼';
            } else {
                lobbyText = '서버 연결됨 — 시리얼 미연결';
                hudText = '대기';
            }
        } else {
            return;
        }

        if (el) el.textContent = lobbyText;
        if (hudEl) hudEl.textContent = hudText;
    },

    // ========================================================
    // Lobby
    // ========================================================
    bindLobby() {
        document.getElementById('start-btn').addEventListener('click', () => {
            this.startGame();
        });
    },
    
    startGame() {
        GameState.reset();
        GameState.setPhase('playing');
        GameState.startTime = Date.now();
        gameService.sendStart();
        this.startTimer();
        this.switchScreen('game-screen');
    },
    
    // ========================================================
    // End
    // ========================================================
    bindEnd() {
        document.getElementById('restart-btn').addEventListener('click', () => {
            this.resetGame();
        });
    },

    // ========================================================
    // 게임 리셋 (라파에도 명령 송신)
    // ========================================================
    resetGame() {
        this.stopTimer();
        // 라파에 restart 명령 (TCP 모드일 때만 실제로 전송됨)
        gameService.sendRestart();
        // 브라우저 GameState 초기화
        GameState.reset();
        // 모듈별 초기화
        if (typeof HiddenClues !== 'undefined') HiddenClues.reset();
        if (typeof MorsePuzzle !== 'undefined' && MorsePuzzle.reset) MorsePuzzle.reset();
        if (typeof FrontWallPuzzle !== 'undefined' && FrontWallPuzzle.reset) FrontWallPuzzle.reset();
        // 화면 전환
        this.switchScreen('lobby-screen');
        console.log('[Main] 게임 리셋 완료');
    },
    
    showEndScreen() {
        this.stopTimer();
        document.getElementById('end-time').textContent = this.formatTime(GameState.elapsedSeconds);
        document.getElementById('end-hints').textContent = GameState.hintCount + '회';
        this.switchScreen('end-screen');
    },
    
    // ========================================================
    // 화면 전환
    // ========================================================
    switchScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    },
    
    // ========================================================
    // 시점 전환 (방향 버튼)
    // ========================================================
    bindViewControls() {
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const direction = btn.dataset.direction;
                this.changeView(direction);
            });
        });
    },
    
    changeView(direction) {
        // 정면 기준 시점 회전 매핑
        // up: 천장, down: 뒷벽 (180도), left/right: 좌/우, front: 정면
        const viewMap = {
            'up': 'ceiling',
            'down': 'back',
            'left': 'left',
            'right': 'right',
            'front': 'front'
        };
        const newView = viewMap[direction];
        if (!newView) return;
        
        // 벽 표시 전환
        document.querySelectorAll('.wall').forEach(w => w.classList.remove('active'));
        document.querySelector(`.wall[data-view="${newView}"]`).classList.add('active');
        
        // 활성 버튼 표시
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.view-btn[data-direction="${direction}"]`).classList.add('active');
        
        // HUD 라벨 업데이트
        const labels = { front: '정면', back: '뒷벽', left: '왼쪽', right: '오른쪽', ceiling: '천장' };
        document.getElementById('current-view-label').textContent = labels[newView];
        
        GameState.setView(newView);
    },
    
    // ========================================================
    // 키보드 단축키 (방향키)
    // ========================================================
    // ========================================================
    // HUD의 리셋 버튼
    // ========================================================
    bindHudResetButton() {
        const btn = document.getElementById('hud-reset-btn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (confirm('게임을 리셋하고 처음으로 돌아갈까요?')) {
                this.resetGame();
            }
        });
    },

    bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            // ESC: 게임 중 리셋 (어느 화면에서든 동작)
            if (e.key === 'Escape') {
                if (GameState.phase === 'playing') {
                    if (confirm('게임을 리셋하고 처음으로 돌아갈까요?')) {
                        this.resetGame();
                    }
                }
                return;
            }

            if (GameState.phase !== 'playing') return;

            const keyMap = {
                'ArrowUp': 'up',
                'ArrowDown': 'down',
                'ArrowLeft': 'left',
                'ArrowRight': 'right'
            };

            if (keyMap[e.key]) {
                e.preventDefault();
                this.changeView(keyMap[e.key]);
            } else if (e.key === 'f' || e.key === 'F') {
                Flashlight.toggle();
            }
        });
    },
    
    // ========================================================
    // 타이머
    // ========================================================
    startTimer() {
        this.stopTimer();
        const timerEl = document.getElementById('timer');
        this.timerInterval = setInterval(() => {
            GameState.elapsedSeconds = Math.floor((Date.now() - GameState.startTime) / 1000);
            timerEl.textContent = this.formatTime(GameState.elapsedSeconds);
        }, 1000);
    },
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },
    
    formatTime(seconds) {
        const m = String(Math.floor(seconds / 60)).padStart(2, '0');
        const s = String(seconds % 60).padStart(2, '0');
        return `${m}:${s}`;
    },
    
    // ========================================================
    // GameState 리스너 (UI 동기화)
    // ========================================================
    bindStateListeners() {
        // 인벤토리 변경 - 클릭하면 단서 내용 펼침
        GameState.on('inventory', (items) => {
            const list = document.getElementById('inventory-list');
            if (!list) return;

            if (items.length === 0) {
                list.innerHTML = '<li class="inv-empty">아직 단서가 없다.</li>';
                return;
            }

            list.innerHTML = items.map((item, i) => `
                <li class="inv-item" data-idx="${i}">
                    <div class="inv-name">▸ ${item.name}</div>
                    <div class="inv-desc">${item.description}</div>
                </li>
            `).join('');

            // 클릭으로 펼침/접힘 토글
            list.querySelectorAll('.inv-item').forEach((li) => {
                li.addEventListener('click', () => {
                    li.classList.toggle('open');
                });
            });
        });
        
        // 전력 상태 표시
        GameState.on('power', (restored) => {
            document.getElementById('power-status').textContent = restored ? '복구됨' : '차단됨';
        });
        
        // 게임 종료 감지
        GameState.on('phase', (phase) => {
            if (phase === 'ended') this.showEndScreen();
        });
    },
    
    // ========================================================
    // 힌트 박스
    // ========================================================
    bindHintBox() {
        document.getElementById('hint-close').addEventListener('click', () => {
            document.getElementById('hint-box').classList.add('hidden');
        });
    },
    
    showHint(hint) {
        const box = document.getElementById('hint-box');
        const content = document.getElementById('hint-content');
        content.innerHTML = `
            <p style="margin-bottom: 8px; color: #a08868; font-size: 11px;">
                LEVEL ${hint.level}
            </p>
            <p>${hint.text}</p>
        `;
        box.classList.remove('hidden');
    },
    
    // ========================================================
    // 디버그 패널
    // ========================================================
    bindDebugPanel() {
        const toggle = document.getElementById('debug-toggle');
        const content = document.getElementById('debug-content');
        toggle.addEventListener('click', () => {
            content.classList.toggle('hidden');
        });
        
        // 슬라이더 → 센서값 동기화
        const sliders = [
            { id: 'sim-cds', sensor: 'cds' },
            { id: 'sim-temp', sensor: 'temp' },
            { id: 'sim-distance', sensor: 'distance' },
            { id: 'sim-potentiometer', sensor: 'potentiometer' }
        ];
        
        sliders.forEach(({ id, sensor }) => {
            const slider = document.getElementById(id);
            const valueEl = document.getElementById(id + '-val');
            slider.addEventListener('input', () => {
                const value = parseFloat(slider.value);
                valueEl.textContent = value;
                GameState.updateSensor(sensor, value);
            });
        });
        
        // 강제 조작 버튼
        document.getElementById('force-power').addEventListener('click', () => {
            GameState.setPower(!GameState.powerRestored);
        });
        
        document.getElementById('force-hint').addEventListener('click', () => {
            gameService.sendHintRequest('debug');
        });
        
        document.getElementById('force-clear-puzzle').addEventListener('click', () => {
            const view = GameState.currentView;
            const map = { left: 'leftWall', right: 'rightWall', back: 'backWall_radio' };
            if (map[view]) GameState.solvePuzzle(map[view]);
        });
        
        document.getElementById('force-restart').addEventListener('click', () => {
            this.resetGame();
        });
        
        // 상태 실시간 표시
        GameState.on('all', () => {
            const stateEl = document.getElementById('debug-state');
            if (stateEl) {
                stateEl.textContent = JSON.stringify({
                    phase: GameState.phase,
                    view: GameState.currentView,
                    power: GameState.powerRestored,
                    flashlight: GameState.flashlightOn,
                    sensors: GameState.sensors,
                    puzzles: Object.fromEntries(
                        Object.entries(GameState.puzzles).map(([k, v]) => [k, v.solved])
                    )
                }, null, 2);
            }
        });
    }
};

// 페이지 로드 후 시작
document.addEventListener('DOMContentLoaded', () => App.init());