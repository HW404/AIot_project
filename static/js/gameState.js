/**
 * 게임 전체 상태 관리
 * 모든 컴포넌트가 이 객체를 통해 상태 공유
 */
const GameState = {
    // 게임 단계
    phase: 'lobby',           // 'lobby' | 'playing' | 'ended'
    
    // 시점
    currentView: 'front',     // 'front' | 'back' | 'left' | 'right' | 'ceiling'
    
    // 환경 상태
    powerRestored: false,     // 전력 복구 여부
    flashlightOn: false,      // 손전등 on/off
    
    // 시간
    startTime: null,
    elapsedSeconds: 0,
    
    // 퍼즐 진행 상태
    puzzles: {
        leftWall:        { solved: false, progress: 0 },           // 온도 퍼즐
        rightWall:       { solved: false, code: null },            // 망원경 퍼즐
        backWall_radio:  { solved: false, frequency: 0 },          // 무전기 주파수
        backWall_morse:  { solved: false },                        // 모스 신호
        backWall_keypad: { solved: false, attempts: 0, input: '' } // 키패드
    },
    
    // 인벤토리 (손전등으로 발견한 단서)
    inventory: [],
    
    // AI 힌트
    hints: [],
    hintCount: 0,
    
    // 센서 실시간 값 (Mock 또는 실제 센서)
    sensors: {
        cds: 0,             // 0~1023 (조도)
        temp: 0,            // -10~50 (온도)
        humidity: 0,        // 0~100 (습도)
        distance: 50,       // 0~100 cm (초음파)
        potentiometer: 0,   // 0~1023 (가변저항)
        sound: 0,           // 0~1023 (사운드)
        keypad: ''          // 키패드 입력 문자열
    },
    
    // 연결 상태
    connection: 'mock',     // 'mock' | 'connected' | 'disconnected'
    
    // ============================================================
    // 상태 변경 메서드
    // ============================================================
    
    setPhase(phase) {
        this.phase = phase;
        this._notify('phase', phase);
    },
    
    setView(view) {
        this.currentView = view;
        this._notify('view', view);
    },
    
    setPower(restored) {
        this.powerRestored = restored;
        if (restored) {
            this.flashlightOn = false;
        }
        // v0.0.18: body 클래스로 CSS에서 dark-msg 강제 숨김
        if (restored) {
            document.body.classList.add('power-restored');
        } else {
            document.body.classList.remove('power-restored');
        }
        this._notify('power', restored);
    },
    
    setFlashlight(on) {
        // 전력 복구되면 손전등 사용 불가
        if (this.powerRestored) {
            this.flashlightOn = false;
            return;
        }
        this.flashlightOn = on;
        this._notify('flashlight', on);
    },
    
    updateSensor(name, value) {
        this.sensors[name] = value;
        this._notify('sensor', { name, value });
    },
    
    addToInventory(item) {
        // 중복 방지
        if (this.inventory.find(i => i.id === item.id)) return;
        this.inventory.push(item);
        this._notify('inventory', this.inventory);
    },
    
    addHint(hint) {
        this.hints.push(hint);
        this.hintCount++;
        this._notify('hint', hint);
    },
    
    solvePuzzle(puzzleName) {
        if (this.puzzles[puzzleName]) {
            this.puzzles[puzzleName].solved = true;
            this._notify('puzzleSolved', puzzleName);
        }
    },
    
    isAllPuzzlesSolved() {
        return Object.values(this.puzzles).every(p => p.solved);
    },
    
    reset() {
        this.phase = 'lobby';
        this.currentView = 'front';
        this.powerRestored = false;
        this.flashlightOn = false;
        // v0.0.18: 리셋 시 body 클래스 제거
        document.body.classList.remove('power-restored');
        this.startTime = null;
        this.elapsedSeconds = 0;
        this.inventory = [];
        this.hints = [];
        this.hintCount = 0;
        Object.keys(this.puzzles).forEach(k => {
            this.puzzles[k].solved = false;
            if ('progress' in this.puzzles[k]) this.puzzles[k].progress = 0;
            if ('attempts' in this.puzzles[k]) this.puzzles[k].attempts = 0;
            if ('input' in this.puzzles[k]) this.puzzles[k].input = '';
        });
        Object.keys(this.sensors).forEach(k => {
            this.sensors[k] = (k === 'distance') ? 50 : (k === 'keypad') ? '' : 0;
        });
        this._notify('reset', null);
    },
    
    // ============================================================
    // 이벤트 시스템 (Pub/Sub)
    // ============================================================
    _listeners: {},
    
    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
    },
    
    _notify(event, data) {
        if (this._listeners[event]) {
            this._listeners[event].forEach(cb => cb(data));
        }
        // 'all' 이벤트는 모든 변경에 대해 호출
        if (this._listeners['all']) {
            this._listeners['all'].forEach(cb => cb({ event, data }));
        }
    }
};