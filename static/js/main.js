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
        
        // 모듈 초기화
        Flashlight.init();
        LeftWallPuzzle.init();
        RightWallPuzzle.init();
        BackWallPuzzle.init();
        FrontWallPuzzle.init();
        
        // 서비스 이벤트 → GameState 반영
        gameService.on('hint', (hint) => {
            GameState.addHint(hint);
            this.showHint(hint);
        });
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
            this.stopTimer();
            this.switchScreen('lobby-screen');
            GameState.reset();
        });
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
    bindKeyboard() {
        document.addEventListener('keydown', (e) => {
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
        // 인벤토리 변경
        GameState.on('inventory', (items) => {
            const list = document.getElementById('inventory-list');
            list.innerHTML = items.map(item => 
                `<li title="${item.description}">• ${item.name}</li>`
            ).join('');
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
            this.stopTimer();
            GameState.reset();
            this.switchScreen('lobby-screen');
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
