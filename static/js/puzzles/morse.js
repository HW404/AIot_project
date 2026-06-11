/**
 * 라디오 신호 (Morse) v0.0.19
 *
 * 흐름:
 *   1. 라디오 주파수 맞추기 (가변저항) 클리어
 *      → 라파가 자동으로 아두이노에 "BUZZ:5" 송신
 *      → 실제 부저가 5번 울림
 *   2. 사용자가 몇 번 들렸는지 세고 "들었다" 클릭 → 단서 부여
 *   3. 헷갈리면 "다시 듣기" 버튼 → 라파에 replay_morse 명령
 *      → 부저가 다시 울림
 *
 * Mock 모드 (라파 미연결):
 *   - "다시 듣기" 클릭 시 브라우저 Web Audio로 시뮬레이션
 */

const MorsePuzzle = {
    SIGNAL_COUNT: 5,
    BEEP_MS: 200,
    GAP_MS: 250,

    puzzleArea: null,
    statusEl: null,
    playBtn: null,
    confirmBtn: null,
    audioCtx: null,
    hasPlayed: false,
    confirmed: false,

    init() {
        this.puzzleArea = document.getElementById('morse-puzzle');
        this.statusEl = document.getElementById('morse-status');
        this.playBtn = document.getElementById('morse-play-btn');
        this.confirmBtn = document.getElementById('morse-confirm-btn');

        if (this.playBtn) {
            this.playBtn.addEventListener('click', () => this.replayBuzz());
        }
        if (this.confirmBtn) {
            this.confirmBtn.addEventListener('click', () => this.confirmHeard());
        }

        // 라디오 해결 시 안내 표시 + 확인 버튼 활성화
        GameState.on('puzzleSolved', (name) => {
            if (name === 'backWall_radio') {
                this.onRadioCleared();
            }
        });
    },

    // 라디오 클리어됨 - 부저는 라파가 울림 (소리만 들음)
    onRadioCleared() {
        this.hasPlayed = true;
        if (this.statusEl) {
            this.statusEl.textContent = '라디오에서 신호가 들린다... 몇 번 울리는지 세어라.';
            this.statusEl.classList.remove('success', 'error');
        }
        if (this.confirmBtn) {
            this.confirmBtn.disabled = false;
            this.confirmBtn.classList.add('ready');
        }
    },

    // "다시 듣기" 버튼 → 부저 재생
    replayBuzz() {
        if (this.statusEl) {
            this.statusEl.textContent = '신호 재생 중... 들어봐라.';
            this.statusEl.classList.remove('success', 'error');
        }

        // 라파에 replay_morse 명령 전송
        const sent = (typeof gameService !== 'undefined' && gameService.sendReplayMorse)
            ? gameService.sendReplayMorse()
            : false;

        if (sent) {
            console.log('[Morse] 부저 재생 요청 전송됨');
            this.hasPlayed = true;
            if (this.confirmBtn) {
                this.confirmBtn.disabled = false;
                this.confirmBtn.classList.add('ready');
            }
        } else {
            // Mock 모드: 브라우저로 시뮬레이션
            console.log('[Morse] Mock 모드 - Web Audio로 재생');
            this.playSimulated();
        }
    },

    // Mock 모드용 Web Audio 시뮬레이션
    async playSimulated() {
        try {
            if (!this.audioCtx) {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                this.audioCtx = new Ctx();
            }
            if (this.audioCtx.state === 'suspended') {
                await this.audioCtx.resume();
            }

            for (let i = 0; i < this.SIGNAL_COUNT; i++) {
                this.beep();
                await this.sleep(this.BEEP_MS + this.GAP_MS);
            }

            this.hasPlayed = true;
            if (this.statusEl) {
                this.statusEl.textContent = '(시뮬레이션) 신호가 끝났다.';
            }
            if (this.confirmBtn) {
                this.confirmBtn.disabled = false;
                this.confirmBtn.classList.add('ready');
            }
        } catch (e) {
            console.warn('[Morse] 시뮬레이션 실패:', e);
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

    sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    },

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
            name: '라디오 신호',
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

    reset() {
        this.hasPlayed = false;
        this.confirmed = false;
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