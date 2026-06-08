/**
 * GameService - 데이터 소스 추상화 계층
 *
 * v0.0.10: WebSocket 실제 연결 추가
 *
 * 동작 모드:
 *   - 'mock':  서버 없이 디버그 패널만으로 동작 (개발용)
 *   - 'ws':    WebSocket으로 노트북 서버에 연결 → 라파 메시지 수신
 *
 * 자동 동작:
 *   - 페이지 로드 시 WebSocket 연결 시도
 *   - 연결 성공: ws 모드로 전환, 라파 메시지를 GameState에 반영
 *   - 연결 실패/끊김: mock 모드 유지, 3초마다 재시도
 *
 * 라파에서 오는 메시지를 GameState에 반영:
 *   {type:"sensor", name, value}      → GameState.updateSensor()
 *   {type:"flashlight", on}            → GameState.setFlashlight()
 *   {type:"power", restored}           → GameState.setPower()
 *   {type:"puzzle_solved", puzzle}     → GameState.solvePuzzle()
 *   {type:"stage_enter", stage, name}  → (로그만)
 *   {type:"game_state", ...}           → 전체 상태 동기화
 *   {type:"status", data}              → 연결 상태 표시
 *   {type:"command_result", ...}       → 명령 결과 (라파 연결 안 됐을 때 알림)
 */

class GameService {
    constructor() {
        this.mode = 'mock';        // 'mock' | 'ws'
        this.ws = null;
        this.reconnectTimer = null;
        this._listeners = {};
        this._connected = false;

        // 자동으로 WebSocket 연결 시도
        this._connectWebSocket();
    }

    // ============================================================
    // 이벤트 시스템 (구독자용)
    // ============================================================
    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
    }

    _emit(event, data) {
        if (this._listeners[event]) {
            this._listeners[event].forEach(cb => {
                try { cb(data); }
                catch (e) { console.error(`[GameService] 콜백 오류 (${event}):`, e); }
            });
        }
    }

    isConnected() {
        return this._connected;
    }

    getMode() {
        return this.mode;
    }

    // ============================================================
    // WebSocket 연결
    // ============================================================
    _connectWebSocket() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${location.host}/ws/game`;

        console.log('[GameService] WebSocket 연결 시도:', url);

        try {
            this.ws = new WebSocket(url);
        } catch (e) {
            console.warn('[GameService] WebSocket 생성 실패:', e);
            this._scheduleReconnect();
            return;
        }

        this.ws.onopen = () => {
            console.log('[GameService] WebSocket 연결 성공');
            this.mode = 'ws';
            this._connected = true;
            this._emit('connection', { connected: true, mode: 'ws' });
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this._handleServerMessage(msg);
            } catch (e) {
                console.warn('[GameService] 메시지 파싱 실패:', event.data);
            }
        };

        this.ws.onclose = () => {
            console.log('[GameService] WebSocket 끊김. Mock 모드로 폴백.');
            this.mode = 'mock';
            this._connected = false;
            this.ws = null;
            this._emit('connection', { connected: false, mode: 'mock' });
            this._scheduleReconnect();
        };

        this.ws.onerror = (err) => {
            console.warn('[GameService] WebSocket 에러:', err);
            // onclose가 뒤따라 호출되므로 여기선 재시도 안 함
        };
    }

    _scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this._connectWebSocket();
        }, 3000);
    }

    // ============================================================
    // 라파 → 브라우저 메시지 처리 (★ 핵심)
    //   라파가 보낸 게임 이벤트를 GameState에 반영
    // ============================================================
    _handleServerMessage(msg) {
        if (!msg || !msg.type) return;

        switch (msg.type) {
            case 'sensor':
                // 센서 원시값 (디버그/모니터링용)
                if (msg.name && msg.value !== undefined) {
                    GameState.updateSensor(msg.name, msg.value);
                }
                break;

            case 'flashlight':
                // 라파가 판정한 손전등 ON/OFF
                console.log(`[GameService] 손전등 ${msg.on ? 'ON' : 'OFF'}`);
                GameState.setFlashlight(msg.on);
                break;

            case 'power':
                // 전력 복구
                console.log(`[GameService] 전력 ${msg.restored ? '복구!' : '차단'}`);
                GameState.setPower(msg.restored);
                break;

            case 'puzzle_solved':
                // 퍼즐 해결
                console.log(`[GameService] 퍼즐 해결: ${msg.puzzle}`);
                GameState.solvePuzzle(msg.puzzle);
                break;

            case 'stage_enter':
                // 단계 진입 (현재는 로그만, 추후 UI 변화 가능)
                console.log(`[GameService] 단계 진입: ${msg.stage} (${msg.name})`);
                this._emit('stage_enter', msg);
                break;

            case 'game_state':
                // 전체 상태 동기화 (라파에서 request_state 응답 등)
                console.log('[GameService] 상태 동기화:', msg);
                // 부분 반영 (이미 일치할 수도 있으므로 멱등)
                if (msg.power !== undefined) GameState.setPower(msg.power);
                if (msg.flashlight !== undefined) GameState.setFlashlight(msg.flashlight);
                if (msg.puzzles) {
                    Object.entries(msg.puzzles).forEach(([name, solved]) => {
                        if (solved && GameState.puzzles[name] && !GameState.puzzles[name].solved) {
                            GameState.solvePuzzle(name);
                        }
                    });
                }
                break;

            case 'hint':
                // AI 힌트 (라파/서버 LLM이 보낸 것)
                this._emit('hint', msg);
                break;

            case 'status':
                // 입력 소스 상태 (TCP 라파 연결 여부 등)
                this._emit('status', msg.data);
                break;

            case 'command_result':
                // 명령 결과 (라파 미연결 등)
                if (!msg.ok) {
                    console.warn(`[GameService] 명령 실패 (${msg.command}): ${msg.reason}`);
                }
                this._emit('command_result', msg);
                break;

            default:
                console.log('[GameService] 알 수 없는 메시지:', msg);
        }
    }

    // ============================================================
    // 브라우저 → 서버 메시지 송신
    // ============================================================
    _sendToServer(message) {
        if (!this._connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('[GameService] (Mock) 송신:', message);
            return false;
        }
        try {
            this.ws.send(JSON.stringify(message));
            return true;
        } catch (e) {
            console.warn('[GameService] 송신 실패:', e);
            return false;
        }
    }

    sendStart() {
        console.log('[GameService] 게임 시작 신호');
        return this._sendToServer({ type: 'start_game' });
    }

    sendRestart() {
        console.log('[GameService] 재시작 신호');
        return this._sendToServer({ type: 'restart' });
    }

    sendHintRequest(puzzleName) {
        console.log('[GameService] 힌트 요청:', puzzleName);
        const sent = this._sendToServer({
            type: 'request_hint',
            puzzle: puzzleName
        });
        // 서버 미연결 시 Mock 힌트로 폴백
        if (!sent) {
            setTimeout(() => {
                this._emit('hint', this._generateMockHint(puzzleName));
            }, 500);
        }
    }

    sendKeypadInput(input) {
        return this._sendToServer({
            type: 'keypad_input',
            value: input
        });
    }

    requestState() {
        return this._sendToServer({ type: 'request_state' });
    }

    // ============================================================
    // Mock 힌트 생성 (서버 미연결 시 폴백)
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
const gameService = new GameService();
