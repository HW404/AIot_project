/**
 * 연결 테스트 페이지
 * - WebSocket으로 서버 연결
 * - 시리얼/TCP 모드 모두 처리
 * - 자동 재연결
 * - 각 센서별 상태 카드 (개선 v0.0.11)
 * - 게임 이벤트 상태 카드 (개선 v0.0.11)
 *
 * 처리하는 메시지 타입:
 *   시리얼 모드:
 *     - serial: 시리얼 한 줄 (raw 텍스트)
 *   TCP 모드 (라파 → 노트북 → 브라우저):
 *     - sensor:        { name, value }       센서값 → 센서 카드 갱신
 *     - flashlight:    { on }                손전등 토글
 *     - puzzle_solved: { puzzle }            퍼즐 해결
 *     - power:         { restored }          전력 복구
 *     - stage_enter:   { stage, name }       단계 진입
 *     - game_state:    { phase, ... }        전체 상태
 *   공통:
 *     - status:        { mode, ... }
 *     - command_result: { ok, reason }
 */

// 센서 상태 추적 (마지막 수신 시각 기준 online/stale/offline 판정)
const SENSOR_TIMEOUT_ONLINE = 3000;  // 3초 이내 = online
const SENSOR_TIMEOUT_STALE  = 10000; // 3~10초 = stale (오래됨)
                                      // 10초 초과 = offline

const TestPage = {
    ws: null,
    msgCount: 0,
    reconnectTimer: null,
    mode: null,

    // 센서별 마지막 수신 시각 + 마지막 값
    sensors: {
        cds:  { lastValue: null, lastTime: 0 },
        snd:  { lastValue: null, lastTime: 0 },
        pot:  { lastValue: null, lastTime: 0 },
        temp: { lastValue: null, lastTime: 0 },
        hum:  { lastValue: null, lastTime: 0 },
        dist: { lastValue: null, lastTime: 0 },
    },

    // 게임 상태
    gameState: {
        flashlight: false,
        power: false,
        stage: null,
        solvedPuzzles: new Set(),
    },

    // ========================================================
    init() {
        this.bindUI();
        this.connect();
        // 1초마다 센서 카드 상태 갱신 (시간 표시, 정상/오래됨/오프라인 색상)
        setInterval(() => this.refreshSensorCards(), 1000);
    },

    bindUI() {
        document.getElementById('clear-log').addEventListener('click', () => {
            this.clearLog();
        });

        // 게임 명령 버튼
        const startBtn = document.getElementById('btn-start-game');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.sendCommand({ type: 'start_game' });
            });
        }

        const restartBtn = document.getElementById('btn-restart');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                if (confirm('게임을 리셋할까요? 라파의 게임 엔진도 함께 초기화됩니다.')) {
                    this.sendCommand({ type: 'restart' });
                    // 브라우저 표시도 즉시 리셋 (실제 응답 안 와도 시각적 피드백)
                    this.resetLocalState();
                }
            });
        }

        const stateBtn = document.getElementById('btn-request-state');
        if (stateBtn) {
            stateBtn.addEventListener('click', () => {
                this.sendCommand({ type: 'request_state' });
            });
        }
    },

    // 로컬 표시만 리셋 (실제 라파 상태와 별개)
    resetLocalState() {
        this.gameState = {
            flashlight: false,
            power: false,
            stage: null,
            solvedPuzzles: new Set(),
        };
        this.updateEventCards();
        this.addLog('event', '로컬 상태 리셋됨');
    },

    // ========================================================
    // WebSocket 연결
    // ========================================================
    connect() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${location.host}/ws/test`;

        this.addLog('system', `WebSocket 연결 시도: ${url}`);
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            this.setWsStatus(true);
            this.addLog('system', 'WebSocket 연결 성공');
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
        };

        this.ws.onmessage = (event) => this.handleMessage(event.data);

        this.ws.onclose = () => {
            this.setWsStatus(false);
            this.addLog('system', 'WebSocket 끊김. 3초 후 재시도...');
            this.scheduleReconnect();
        };

        this.ws.onerror = (err) => {
            console.error('WebSocket 에러:', err);
            this.addLog('system', 'WebSocket 에러 발생');
        };
    },

    scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, 3000);
    },

    // ========================================================
    // 메시지 처리
    // ========================================================
    handleMessage(raw) {
        let msg;
        try { msg = JSON.parse(raw); }
        catch (e) {
            this.addLog('system', `파싱 실패: ${raw}`);
            return;
        }

        const type = msg.type;
        if (!type) return;

        switch (type) {
            case 'serial':
                this.addLog('serial', msg.data);
                this.updateLastReceived(msg.data);
                this.incrementCount();
                // 시리얼 모드에서도 텍스트 파싱해서 센서 카드 갱신 시도
                this.parseSerialAndUpdate(msg.data);
                break;
            case 'sensor':
                this.handleSensor(msg);
                break;
            case 'flashlight':
                this.handleFlashlight(msg);
                break;
            case 'puzzle_solved':
                this.handlePuzzleSolved(msg);
                break;
            case 'power':
                this.handlePower(msg);
                break;
            case 'stage_enter':
                this.handleStageEnter(msg);
                break;
            case 'game_state':
                this.handleGameState(msg);
                break;
            case 'status':
                this.handleStatus(msg.data);
                break;
            case 'command_result':
                this.handleCommandResult(msg);
                break;
            default:
                this.addLog('unknown', `${type}: ${JSON.stringify(msg)}`);
        }
    },

    // ========================================================
    // 센서값 처리 + 카드 갱신 (★ 핵심)
    // ========================================================
    handleSensor(msg) {
        const text = `${msg.name}=${msg.value}`;
        this.addLog('sensor', text);
        this.updateLastReceived(text);
        this.incrementCount();

        // 센서 카드 갱신
        this.updateSensorCard(msg.name, msg.value);
    },

    updateSensorCard(name, value) {
        if (!this.sensors[name]) {
            // 알려지지 않은 센서명 - 무시
            return;
        }

        const now = Date.now();
        const prev = this.sensors[name].lastValue;
        this.sensors[name].lastValue = value;
        this.sensors[name].lastTime = now;

        const card = document.querySelector(`.sensor-card[data-sensor="${name}"]`);
        if (!card) return;

        // 값 갱신
        const valueEl = card.querySelector('.sensor-value');
        valueEl.textContent = value;

        // 상태 갱신
        this.applySensorCardState(card, name);

        // 값이 바뀌었을 때만 깜빡임 (스팸 방지)
        if (prev !== value) {
            card.classList.remove('flash');
            void card.offsetWidth;
            card.classList.add('flash');
        }
    },

    applySensorCardState(card, name) {
        const state = this.sensors[name];
        const dot = card.querySelector('.sensor-dot');
        const timeEl = card.querySelector('.sensor-time');

        if (state.lastTime === 0) {
            // 한 번도 안 받음
            card.classList.remove('online', 'stale');
            card.classList.add('offline');
            dot.className = 'sensor-dot offline';
            timeEl.textContent = '대기 중';
            return;
        }

        const elapsed = Date.now() - state.lastTime;

        if (elapsed < SENSOR_TIMEOUT_ONLINE) {
            card.classList.add('online');
            card.classList.remove('stale', 'offline');
            dot.className = 'sensor-dot online';
        } else if (elapsed < SENSOR_TIMEOUT_STALE) {
            card.classList.add('stale');
            card.classList.remove('online', 'offline');
            dot.className = 'sensor-dot stale';
        } else {
            card.classList.add('offline');
            card.classList.remove('online', 'stale');
            dot.className = 'sensor-dot offline';
        }

        timeEl.textContent = this.formatElapsed(elapsed);
    },

    // 모든 센서 카드 갱신 (1초마다 호출)
    refreshSensorCards() {
        Object.keys(this.sensors).forEach((name) => {
            const card = document.querySelector(`.sensor-card[data-sensor="${name}"]`);
            if (card) this.applySensorCardState(card, name);
        });
    },

    formatElapsed(ms) {
        if (ms < 1000) return `${ms}ms 전`;
        const sec = Math.floor(ms / 1000);
        if (sec < 60) return `${sec}초 전`;
        const min = Math.floor(sec / 60);
        return `${min}분 전`;
    },

    // 시리얼 모드: "CDS=512 SND=120 ..." 같은 텍스트 파싱
    parseSerialAndUpdate(line) {
        // KEY=VALUE 또는 KEY:VALUE 패턴
        const re = /([A-Z]+)[=:]([+-]?\d+(?:\.\d+)?)/g;
        let match;
        while ((match = re.exec(line)) !== null) {
            const name = match[1].toLowerCase();
            const value = parseFloat(match[2]);
            const finalValue = (value === Math.floor(value) && name !== 'temp' && name !== 'hum')
                ? Math.floor(value)
                : value;
            this.updateSensorCard(name, finalValue);
        }
    },

    // ========================================================
    // 게임 이벤트 처리
    // ========================================================
    handleFlashlight(msg) {
        this.gameState.flashlight = msg.on;
        const text = `손전등 ${msg.on ? 'ON' : 'OFF'}`;
        this.addLog('event', text);
        this.updateLastReceived(text);
        this.incrementCount();
        this.updateEventCards();
    },

    handlePower(msg) {
        this.gameState.power = msg.restored;
        const text = msg.restored ? '전력 복구!' : '전력 차단';
        this.addLog('event', text);
        this.updateLastReceived(text);
        this.incrementCount();
        this.updateEventCards();
    },

    handlePuzzleSolved(msg) {
        this.gameState.solvedPuzzles.add(msg.puzzle);
        const text = `퍼즐 해결: ${msg.puzzle}`;
        this.addLog('event', text);
        this.updateLastReceived(text);
        this.incrementCount();
        this.updateEventCards();
    },

    handleStageEnter(msg) {
        this.gameState.stage = `${msg.stage}: ${msg.name}`;
        const text = `단계 진입: ${msg.stage} (${msg.name})`;
        this.addLog('event', text);
        this.updateLastReceived(text);
        this.incrementCount();
        this.updateEventCards();
    },

    handleGameState(msg) {
        // 전체 상태 동기화
        if (msg.flashlight !== undefined) this.gameState.flashlight = msg.flashlight;
        if (msg.power !== undefined) this.gameState.power = msg.power;
        if (msg.puzzles) {
            Object.entries(msg.puzzles).forEach(([name, solved]) => {
                if (solved) this.gameState.solvedPuzzles.add(name);
            });
        }
        if (msg.phase) this.gameState.stage = msg.phase;
        const text = `phase=${msg.phase}, power=${msg.power}, flashlight=${msg.flashlight}`;
        this.addLog('state', text);
        this.updateEventCards();
    },

    updateEventCards() {
        // 손전등
        const fl = document.getElementById('event-flashlight');
        const flVal = fl.querySelector('.event-value');
        flVal.textContent = this.gameState.flashlight ? 'ON' : 'OFF';
        fl.className = this.gameState.flashlight ? 'event-card active' : 'event-card';

        // 전력
        const pw = document.getElementById('event-power');
        const pwVal = pw.querySelector('.event-value');
        pwVal.textContent = this.gameState.power ? '복구됨' : '차단';
        pw.className = this.gameState.power ? 'event-card success' : 'event-card';

        // 단계
        const st = document.getElementById('event-stage');
        const stVal = st.querySelector('.event-value');
        stVal.textContent = this.gameState.stage || '-';
        st.className = this.gameState.stage ? 'event-card active' : 'event-card';

        // 해결한 퍼즐
        const pz = document.getElementById('event-puzzles');
        const pzVal = pz.querySelector('.event-value');
        const count = this.gameState.solvedPuzzles.size;
        pzVal.textContent = `${count}개`;
        pz.className = count > 0 ? 'event-card success' : 'event-card';
    },

    // ========================================================
    handleStatus(data) {
        this.mode = data.mode;
        this.setSerialStatus(data);
        this.addLog('status', `[${data.mode}] ${JSON.stringify(data)}`);
    },

    handleCommandResult(msg) {
        if (msg.ok) {
            this.addLog('event', `명령 성공: ${msg.command}`);
        } else {
            this.addLog('error', `명령 실패 (${msg.command}): ${msg.reason}`);
        }
    },

    // ========================================================
    // 상단 상태 카드 (기존)
    // ========================================================
    setWsStatus(connected) {
        const el = document.getElementById('ws-status');
        const dot = el.querySelector('.dot');
        const text = el.querySelector('.text');
        if (connected) {
            dot.className = 'dot connected';
            text.textContent = '연결됨';
        } else {
            dot.className = 'dot disconnected';
            text.textContent = '끊김';
        }
    },

    setSerialStatus(status) {
        const el = document.getElementById('serial-status');
        const dot = el.querySelector('.dot');
        const text = el.querySelector('.text');
        const portEl = document.getElementById('serial-port');

        if (status.mode === 'tcp') {
            if (status.pi_connected) {
                dot.className = 'dot connected';
                text.textContent = '라파 연결됨';
                portEl.textContent = `${status.pi_addr || '?'} → 포트 ${status.port}`;
            } else if (status.running) {
                dot.className = 'dot idle';
                text.textContent = 'TCP 대기 중';
                portEl.textContent = `포트 ${status.port} (라파 연결 대기)`;
            } else {
                dot.className = 'dot disconnected';
                text.textContent = 'TCP 서버 미실행';
                portEl.textContent = '-';
            }
        } else {
            if (status.connected) {
                dot.className = 'dot connected';
                text.textContent = 'USB 연결됨';
                portEl.textContent = `${status.port} @ ${status.baudrate} baud`;
            } else {
                dot.className = 'dot disconnected';
                text.textContent = '연결 안 됨';
                portEl.textContent = status.port
                    ? `${status.port} (열기 실패)`
                    : '포트 못 찾음';
            }
        }
    },

    updateLastReceived(data) {
        const card = document.getElementById('last-received').parentElement;
        document.getElementById('last-received').querySelector('.text').textContent = data;
        document.getElementById('last-time').textContent = this.formatTime(new Date());

        card.classList.remove('flash');
        void card.offsetWidth;
        card.classList.add('flash');
    },

    incrementCount() {
        this.msgCount++;
        document.getElementById('msg-count').querySelector('.text').textContent = this.msgCount;
    },

    // ========================================================
    // 로그
    // ========================================================
    addLog(tag, msg) {
        const log = document.getElementById('log');

        const placeholder = log.querySelector('.log-placeholder');
        if (placeholder) placeholder.remove();

        const line = document.createElement('div');
        line.className = 'log-line';
        line.innerHTML = `
            <span class="log-time">${this.formatTime(new Date())}</span>
            <span class="log-tag ${tag}">${tag.toUpperCase()}</span>
            <span class="log-msg"></span>
        `;
        line.querySelector('.log-msg').textContent = msg;
        log.appendChild(line);

        if (document.getElementById('auto-scroll').checked) {
            log.scrollTop = log.scrollHeight;
        }

        const MAX_LOGS = 500;
        const lines = log.querySelectorAll('.log-line');
        if (lines.length > MAX_LOGS) {
            for (let i = 0; i < lines.length - MAX_LOGS; i++) {
                lines[i].remove();
            }
        }
    },

    clearLog() {
        const log = document.getElementById('log');
        log.innerHTML = '<div class="log-placeholder">로그가 지워졌습니다.</div>';
    },

    formatTime(date) {
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        return `${h}:${m}:${s}`;
    },

    // ========================================================
    // 디버그용
    // ========================================================
    sendCommand(cmd) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket 연결 안 됨');
            return false;
        }
        this.ws.send(JSON.stringify(cmd));
        this.addLog('event', `명령 송신: ${cmd.type}`);
        return true;
    }
};

document.addEventListener('DOMContentLoaded', () => TestPage.init());
window.TestPage = TestPage;