/**
 * 앞벽 - 최종 탈출 (가상 키패드)
 *
 * 4자리 비밀번호 입력으로 탈출.
 * 정답: 1357
 *
 * 단서:
 *   1번 자리 = 1 (좌측벽 벽면)
 *   2번 자리 = 3 (망원경)
 *   3번 자리 = 5 (무전 신호 횟수)
 *   4번 자리 = 7 (천장)
 *
 * 동작:
 *   - 모든 퍼즐 필요 없음. 일찍 입력해도 OK (단서만 모았으면)
 *   - 키패드 버튼 또는 키보드 0~9, Backspace, Enter 가능
 *   - 4자리 채우면 자동 검증
 *   - 정답 → 1.5초 후 ended phase
 *   - 오답 → 흔들기 + 입력 리셋 + 횟수 카운트
 */

const FrontWallPuzzle = {
    CORRECT_CODE: '1357',
    MAX_ATTEMPTS: 99,   // 무한 시도 가능

    exitPanel: null,
    keypadEl: null,
    slotsEl: null,
    statusEl: null,
    clueListEl: null,

    inputBuffer: '',
    attempts: 0,
    locked: false,        // 정답 후 입력 차단

    init() {
        this.exitPanel = document.getElementById('exit-panel');
        this.keypadEl = document.getElementById('keypad-buttons');
        this.slotsEl = document.getElementById('keypad-slots');
        this.statusEl = document.getElementById('keypad-status');
        this.clueListEl = document.getElementById('keypad-clues');

        if (!this.exitPanel) return;

        this.buildKeypad();
        this.renderSlots();

        // 시점 전환
        GameState.on('view', (view) => this.handleViewChange(view));

        // 게임 시작 (lobby → playing) 시 정면이면 즉시 패널 표시
        GameState.on('phase', (phase) => {
            if (phase === 'playing' && GameState.currentView === 'front') {
                this.handleViewChange('front');
            }
        });

        // 단서 추가될 때마다 힌트 영역 갱신
        GameState.on('inventory', () => this.renderClues());

        // 키보드 단축키
        document.addEventListener('keydown', (e) => this.handleKey(e));

        // 초기 힌트 렌더
        this.renderClues();
    },

    handleViewChange(view) {
        if (view === 'front') {
            this.exitPanel.classList.remove('hidden');
        } else {
            this.exitPanel.classList.add('hidden');
        }
    },

    // ========================================================
    // 키패드 버튼 생성
    // ========================================================
    buildKeypad() {
        if (!this.keypadEl) return;
        // 4행 x 3열: 1~9, *0#
        const keys = [
            '1', '2', '3',
            '4', '5', '6',
            '7', '8', '9',
            '*', '0', '#'
        ];
        this.keypadEl.innerHTML = '';
        keys.forEach((k) => {
            const btn = document.createElement('button');
            btn.className = 'keypad-btn';
            btn.dataset.key = k;
            btn.textContent = k;
            btn.addEventListener('click', () => this.pressKey(k));
            this.keypadEl.appendChild(btn);
        });
    },

    // ========================================================
    // 입력 처리
    // ========================================================
    pressKey(key) {
        if (this.locked) return;

        if (key === '*') {
            // 지우기 (한 글자)
            this.inputBuffer = this.inputBuffer.slice(0, -1);
            this.renderSlots();
            this.clearStatus();
            return;
        }
        if (key === '#') {
            // 확정
            this.tryConfirm();
            return;
        }

        // 숫자 0~9
        if (this.inputBuffer.length >= 4) return;
        this.inputBuffer += key;
        this.renderSlots();
        this.clearStatus();

        // 4자리 채우면 자동 검증
        if (this.inputBuffer.length === 4) {
            setTimeout(() => this.tryConfirm(), 250);
        }
    },

    handleKey(e) {
        // 게임 진행 중이고 앞벽 시점일 때만
        if (GameState.phase !== 'playing') return;
        if (GameState.currentView !== 'front') return;
        if (this.locked) return;

        if (e.key >= '0' && e.key <= '9') {
            e.preventDefault();
            this.pressKey(e.key);
        } else if (e.key === 'Backspace') {
            e.preventDefault();
            this.pressKey('*');
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.pressKey('#');
        }
    },

    // ========================================================
    // 정답 검증
    // ========================================================
    tryConfirm() {
        if (this.inputBuffer.length !== 4) {
            this.showStatus('4자리를 입력해라.', 'warn');
            return;
        }

        this.attempts++;

        if (this.inputBuffer === this.CORRECT_CODE) {
            this.success();
        } else {
            this.fail();
        }
    },

    success() {
        this.locked = true;
        this.showStatus('✓ 잠금 해제! 탈출 성공.', 'success');

        // 슬롯도 초록색으로
        const slots = document.querySelectorAll('.keypad-slot');
        slots.forEach((s) => s.classList.add('correct'));

        GameState.solvePuzzle('backWall_keypad');

        // 1.5초 후 종료 화면
        setTimeout(() => {
            GameState.setPhase('ended');
        }, 1500);
    },

    fail() {
        this.showStatus(`✗ 잘못된 번호. (시도: ${this.attempts}회)`, 'error');

        // 슬롯 흔들기
        const slots = document.querySelectorAll('.keypad-slot');
        slots.forEach((s) => {
            s.classList.remove('shake');
            void s.offsetWidth;
            s.classList.add('shake');
        });

        // 1초 후 자동 리셋
        setTimeout(() => {
            this.inputBuffer = '';
            this.renderSlots();
        }, 1000);
    },

    // ========================================================
    // UI 렌더
    // ========================================================
    renderSlots() {
        if (!this.slotsEl) return;
        let html = '';
        for (let i = 0; i < 4; i++) {
            const ch = this.inputBuffer[i] || '';
            const filled = ch ? 'filled' : '';
            html += `<div class="keypad-slot ${filled}">${ch || '_'}</div>`;
        }
        this.slotsEl.innerHTML = html;
    },

    renderClues() {
        if (!this.clueListEl) return;
        const items = GameState.inventory || [];

        // 단서별로 자리 번호 추출 ("1번 자리: 1" 형식)
        const byPosition = { 1: '?', 2: '?', 3: '?', 4: '?' };
        items.forEach((item) => {
            const m = item.description && item.description.match(/(\d)번 자리:\s*(\d)/);
            if (m) {
                const pos = m[1];
                const digit = m[2];
                byPosition[pos] = digit;
            }
        });

        this.clueListEl.innerHTML = `
            <div class="clue-row">
                <span>1번</span><span>2번</span><span>3번</span><span>4번</span>
            </div>
            <div class="clue-row clue-values">
                <span>${byPosition[1]}</span>
                <span>${byPosition[2]}</span>
                <span>${byPosition[3]}</span>
                <span>${byPosition[4]}</span>
            </div>
        `;
    },

    showStatus(text, type) {
        if (!this.statusEl) return;
        this.statusEl.textContent = text;
        this.statusEl.classList.remove('success', 'error', 'warn');
        if (type) this.statusEl.classList.add(type);
    },

    clearStatus() {
        if (!this.statusEl) return;
        this.statusEl.textContent = '';
        this.statusEl.classList.remove('success', 'error', 'warn');
    },

    reset() {
        this.inputBuffer = '';
        this.attempts = 0;
        this.locked = false;
        this.renderSlots();
        this.clearStatus();
        this.renderClues();
    }
};