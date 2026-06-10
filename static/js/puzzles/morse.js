/**
 * 무전 신호 (Morse) - 듣기만 하면 단서 부여
 *
 * 흐름:
 *   1. 무전기 주파수 맞추기 (가변저항) 클리어
 *   2. 자동으로 부저 신호 재생 (똑똑 5번)
 *   3. 사용자가 "5번 들렸네" 알아채면 → 단서 추가 ("3번 자리: 5")
 *   4. "들었다" 버튼 누르거나 일정 시간 후 자동 인벤토리 부여
 *
 * 박수 입력 X. 그냥 듣고 외우는 아이템 형태.
 */

const MorsePuzzle = {
    // 들려줄 횟수 (= 3번 자리 비밀번호)
    SIGNAL_COUNT: 5,

    // 부저 톤 길이
    BEEP_MS: 200,
    GAP_MS: 250,

    // 상태
    puzzleArea: null,
    targetEl: null,
    statusEl: null,
    playBtn: null,
    confirmBtn: null,
    audioCtx: null,
    isPlaying: false,
    hasPlayed: false,
    confirmed: false,

    init() {
        this.puzzleArea = document.getElementById('morse-puzzle');
        this.targetEl = document.getElementById('morse-signal-display');
        this.statusEl = document.getElementById('morse-status');
        this.playBtn = document.getElementById('morse-play-btn');
        this.confirmBtn = document.getElementById('morse-confirm-btn');

        if (this.playBtn) {
            this.playBtn.addEventListener('click', () => this.playSignal());
        }
        if (this.confirmBtn) {
            this.confirmBtn.addEventListener('click', () => this.confirmHeard());
        }

        // 무전기 해결 + 모스 영역 보일 때 자동 1회 재생
        GameState.on('puzzleSolved', (name) => {
            if (name === 'backWall_radio') {
                // 약간 지연 후 자동 재생
                setTimeout(() => this.autoStart(), 1500);
            }
        });
    },

    autoStart() {
        if (this.hasPlayed) return;
        if (!this.puzzleArea || this.puzzleArea.classList.contains('hidden')) {
            // 아직 숨겨져 있으면 대기 - 영역 표시 후 다시 시도
            setTimeout(() => this.autoStart(), 500);
            return;
        }
        this.playSignal();
    },

    // ========================================================
    // 부저로 신호 재생
    // ========================================================
    async playSignal() {
        if (this.isPlaying) return;
        this.isPlaying = true;

        // UI 초기화
        if (this.statusEl) {
            this.statusEl.textContent = '신호 수신 중... 횟수를 세어라.';
            this.statusEl.classList.remove('success', 'error');
        }
        if (this.targetEl) {
            this.targetEl.innerHTML = '';
        }

        try {
            if (!this.audioCtx) {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                this.audioCtx = new Ctx();
            }
            if (this.audioCtx.state === 'suspended') {
                await this.audioCtx.resume();
            }

            // 시각 + 청각 동시 재생
            for (let i = 0; i < this.SIGNAL_COUNT; i++) {
                this.beep();
                this.flashSignal(i + 1);
                await this.sleep(this.BEEP_MS + this.GAP_MS);
            }

            // 재생 끝 → "들었다" 버튼 활성화
            this.hasPlayed = true;
            if (this.statusEl) {
                this.statusEl.textContent =
                    '신호가 끝났다. 몇 번이었는지 외워둬라.';
            }
            if (this.confirmBtn) {
                this.confirmBtn.disabled = false;
                this.confirmBtn.classList.add('ready');
            }
        } catch (e) {
            console.warn('[Morse] 재생 실패:', e);
            if (this.statusEl) {
                this.statusEl.textContent =
                    '오디오 재생 실패. 다시 듣기를 눌러라.';
            }
        } finally {
            this.isPlaying = false;
        }
    },

    beep() {
        if (!this.audioCtx) return;
        const startTime = this.audioCtx.currentTime;
        const duration = this.BEEP_MS / 1000;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.frequency.value = 660;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
        gain.gain.setValueAtTime(0.3, startTime + duration - 0.02);
        gain.gain.linearRampToValueAtTime(0, startTime + duration);
        osc.connect(gain).connect(this.audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
    },

    // 신호 수신 시각화 (점 하나씩 추가)
    flashSignal(idx) {
        if (!this.targetEl) return;
        const dot = document.createElement('span');
        dot.className = 'morse-tick';
        dot.textContent = '●';
        this.targetEl.appendChild(dot);

        // 깜빡임
        setTimeout(() => dot.classList.add('on'), 10);
    },

    sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    },

    // ========================================================
    // "들었다" 확정 - 단서 부여
    // ========================================================
    confirmHeard() {
        if (this.confirmed) return;
        if (!this.hasPlayed) {
            if (this.statusEl) {
                this.statusEl.textContent = '먼저 신호를 들어라.';
                this.statusEl.classList.add('error');
            }
            return;
        }

        this.confirmed = true;
        GameState.solvePuzzle('backWall_morse');
        GameState.addToInventory({
            id: 'morse_clue',
            name: '무전 신호',
            description: `3번 자리: ${this.SIGNAL_COUNT}`
        });

        // 퍼즐 영역을 큰 단서 박스로 교체
        if (this.puzzleArea) {
            this.puzzleArea.innerHTML = `
                <div class="hidden-clue reveal">
                    <p class="clue-found">신호가 ${this.SIGNAL_COUNT}번 울렸다...</p>
                    <div class="clue-digit">${this.SIGNAL_COUNT}</div>
                    <p class="clue-meta">3번 자리</p>
                </div>
            `;
        }
        console.log('[Morse] 단서 부여 완료 (3번 자리 = ' + this.SIGNAL_COUNT + ')');
    },

    // 리셋 (게임 재시작 시)
    reset() {
        this.hasPlayed = false;
        this.confirmed = false;
        this.isPlaying = false;
        if (this.targetEl) this.targetEl.innerHTML = '';
        if (this.statusEl) {
            this.statusEl.textContent = '신호 대기...';
            this.statusEl.classList.remove('success', 'error');
        }
        if (this.confirmBtn) {
            this.confirmBtn.disabled = true;
            this.confirmBtn.classList.remove('ready');
        }
    }
};