/**
 * GameService - 데이터 소스 추상화 계층
 * 
 * ★ 이 파일이 Mock 모드와 Real 모드(WebSocket)의 경계입니다.
 *   나중에 서버 붙일 때 이 파일만 수정하면 됨.
 * 
 * 인터페이스:
 *   - sendStart()        : 게임 시작 신호
 *   - sendHintRequest()  : 힌트 요청
 *   - sendKeypadInput()  : 키패드 입력
 *   - sendRestart()      : 재시작
 *   - on(event, cb)      : 서버로부터의 이벤트 수신
 * 
 * 이벤트:
 *   - sensor_update      : 센서값 변경
 *   - puzzle_result      : 정답/오답 피드백
 *   - hint               : AI 힌트 도착
 *   - stage_change       : 단계 변경
 *   - game_end           : 게임 종료
 */

class GameService {
    constructor(mode = 'mock') {
        this.mode = mode;
        this._listeners = {};
        
        if (mode === 'real') {
            this._initWebSocket();
        }
    }
    
    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
    }
    
    _emit(event, data) {
        if (this._listeners[event]) {
            this._listeners[event].forEach(cb => cb(data));
        }
    }
    
    // ============================================================
    // Real 모드 (TODO: 추후 구현)
    // ============================================================
    _initWebSocket() {
        // TODO: 실제 서버 붙일 때 활성화
        // this.ws = new WebSocket('ws://localhost:8000/ws');
        // this.ws.onmessage = (e) => {
        //     const msg = JSON.parse(e.data);
        //     this._emit(msg.type, msg.data);
        // };
        console.warn('[GameService] Real 모드는 아직 미구현');
    }
    
    // ============================================================
    // 송신 메서드 (웹 → 서버)
    // ============================================================
    sendStart() {
        if (this.mode === 'mock') {
            console.log('[Mock] 게임 시작 신호');
            return;
        }
        // TODO: this.ws.send(JSON.stringify({ type: 'start_request' }));
    }
    
    sendHintRequest(puzzleName) {
        if (this.mode === 'mock') {
            console.log('[Mock] 힌트 요청:', puzzleName);
            // Mock 모드에선 즉석에서 가짜 힌트 생성
            setTimeout(() => {
                this._emit('hint', this._generateMockHint(puzzleName));
            }, 500);
            return;
        }
        // TODO: this.ws.send(JSON.stringify({ 
        //     type: 'hint_request', 
        //     puzzle: puzzleName 
        // }));
    }
    
    sendKeypadInput(input) {
        if (this.mode === 'mock') {
            console.log('[Mock] 키패드 입력:', input);
            return;
        }
        // TODO: WebSocket 송신
    }
    
    sendRestart() {
        if (this.mode === 'mock') {
            console.log('[Mock] 재시작');
            return;
        }
        // TODO: WebSocket 송신
    }
    
    // ============================================================
    // Mock 힌트 생성 (실제론 서버 LLM이 처리)
    // ============================================================
    _generateMockHint(puzzleName) {
        const hints = {
            leftWall: [
                '전선 패널이 차갑다. 무언가로 따뜻하게 해야 할 것 같다.',
                '체온... 손으로 직접 감싸거나 입김을 불어보면?',
                '온도 센서를 손으로 꽉 잡아라.'
            ],
            rightWall: [
                '망원경의 초점이 흐릿하다.',
                '거리를 조절해보라. 너무 가깝거나 멀지 않게.',
                '약 20cm 앞에서 손을 멈춰라.'
            ],
            backWall_radio: [
                '주파수가 맞지 않는다.',
                '다이얼을 천천히 돌려보라.',
                '특정 값에서 신호가 잡힌다.'
            ],
            backWall_keypad: [
                '단서를 다시 살펴봐라.',
                '망원경에서 본 숫자를 확인해라.',
                '암호의 첫 자리는 3이다.'
            ]
        };
        
        const list = hints[puzzleName] || ['단서를 다시 살펴봐라.'];
        const idx = Math.min(GameState.hintCount, list.length - 1);
        return {
            puzzle: puzzleName,
            level: idx + 1,
            text: list[idx]
        };
    }
}

// 전역 인스턴스
const gameService = new GameService('mock');
