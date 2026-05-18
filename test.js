/**
 * 연결 테스트 페이지
 * - WebSocket으로 서버 연결
 * - 시리얼 메시지 실시간 표시
 * - 자동 재연결
 */

const TestPage = {
    ws: null,
    msgCount: 0,
    reconnectTimer: null,
    
    init() {
        this.bindUI();
        this.connect();
    },
    
    // ========================================================
    // UI 바인딩
    // ========================================================
    bindUI() {
        document.getElementById('clear-log').addEventListener('click', () => {
            this.clearLog();
        });
    },
    
    // ========================================================
    // WebSocket 연결
    // ========================================================
    connect() {
        // 같은 호스트:포트 사용 (자동)
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${location.host}/ws/test`;
        
        this.addLog('system', `WebSocket 연결 시도: ${url}`);
        this.ws = new WebSocket(url);
        
        this.ws.onopen = () => {
            this.setWsStatus(true);
            this.addLog('system', 'WebSocket 연결 성공');
            // 재연결 타이머 정리
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
        };
        
        this.ws.onmessage = (event) => {
            this.handleMessage(event.data);
        };
        
        this.ws.onclose = () => {
            this.setWsStatus(false);
            this.addLog('system', 'WebSocket 연결 끊김. 3초 후 재시도...');
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
        try {
            msg = JSON.parse(raw);
        } catch (e) {
            this.addLog('system', `파싱 실패: ${raw}`);
            return;
        }
        
        if (msg.type === 'serial') {
            // 아두이노에서 온 시리얼 데이터
            this.addLog('serial', msg.data);
            this.updateLastReceived(msg.data);
            this.incrementCount();
        } else if (msg.type === 'status') {
            // 시리얼 포트 상태
            this.setSerialStatus(msg.data);
            this.addLog('status', JSON.stringify(msg.data));
        }
    },
    
    // ========================================================
    // UI 업데이트
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
        
        if (status.connected) {
            dot.className = 'dot connected';
            text.textContent = '연결됨';
            portEl.textContent = `${status.port} @ ${status.baudrate} baud`;
        } else {
            dot.className = 'dot disconnected';
            text.textContent = '연결 안 됨';
            portEl.textContent = status.port ? `${status.port} (열기 실패)` : '포트 못 찾음';
        }
    },
    
    updateLastReceived(data) {
        const card = document.getElementById('last-received').parentElement;
        document.getElementById('last-received').querySelector('.text').textContent = data;
        document.getElementById('last-time').textContent = this.formatTime(new Date());
        
        // 깜빡임 효과
        card.classList.remove('flash');
        void card.offsetWidth;  // reflow 강제
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
        
        // placeholder 제거
        const placeholder = log.querySelector('.log-placeholder');
        if (placeholder) placeholder.remove();
        
        const line = document.createElement('div');
        line.className = 'log-line';
        line.innerHTML = `
            <span class="log-time">${this.formatTime(new Date())}</span>
            <span class="log-tag ${tag}">${tag.toUpperCase()}</span>
            <span class="log-msg"></span>
        `;
        // 메시지는 textContent로 (XSS 방지)
        line.querySelector('.log-msg').textContent = msg;
        log.appendChild(line);
        
        // 자동 스크롤
        if (document.getElementById('auto-scroll').checked) {
            log.scrollTop = log.scrollHeight;
        }
        
        // 로그 개수 제한 (메모리 보호) - 500개 넘으면 오래된 것부터 삭제
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
    }
};

document.addEventListener('DOMContentLoaded', () => TestPage.init());
