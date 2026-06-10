/**
 * 왼쪽 벽 - 냉각된 전선 패널 퍼즐
 *
 * 단계 (v0.0.16):
 *   1) 첫 진입: "무언가 차갑게 얼어 있다" (어렴풋 메시지)
 *   2) 온도 변화 감지 또는 ? 힌트 버튼 클릭 → 퍼즐 UI 등장
 *      - "전선 패널이 꽁꽁 얼어붙어 있다" + 온도 게이지
 *   3) 30°C 도달 → 전력 복구, 클리어
 *
 * 센서: 온습도 (temp)
 * 목표 온도: 30°C
 */

const LeftWallPuzzle = {
    TARGET_TEMP: 30,
    puzzleArea: null,      // 본 퍼즐 UI
    coldMsgEl: null,       // "차갑게 얼어 있다" 메시지
    tempFill: null,
    tempValue: null,

    initialTemp: null,     // 첫 측정 온도 (baseline)
    puzzleRevealed: false, // 퍼즐 UI 등장했는지

    init() {
        this.puzzleArea = document.getElementById('cable-puzzle');
        this.coldMsgEl = document.getElementById('left-wall-cold-msg');
        this.tempFill = document.getElementById('temp-fill');
        this.tempValue = document.getElementById('temp-value');

        // 센서값 변경 감지
        GameState.on('sensor', ({ name, value }) => {
            if (name === 'temp') this.handleTemp(value);
        });

        // 시점 전환
        GameState.on('view', (view) => this.handleViewChange(view));

        // 전력 복구되면 배경을 "녹은" 이미지로 전환
        GameState.on('power', (restored) => this.handlePowerChange(restored));

        // 힌트 버튼(?)을 좌측벽에서 누르면 퍼즐 UI 등장
        // (HintModal이 모달을 띄우는 것과는 별개로, 좌측벽 퍼즐 활성화)
        document.querySelectorAll('.hint-btn[data-hint="temp"]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (GameState.currentView === 'left') {
                    this.revealPuzzle();
                }
            });
        });
    },

    handlePowerChange(restored) {
        const thawedEl = document.getElementById('left-wall-image-thawed');
        if (thawedEl) {
            if (restored) {
                thawedEl.classList.remove('hidden');
            } else {
                thawedEl.classList.add('hidden');
            }
        }
    },

    handleViewChange(view) {
        if (view === 'left') {
            // 좌측벽 진입: 솔브 안 되었으면 단계에 따라 표시
            if (GameState.puzzles.leftWall.solved) {
                // 이미 해결: 둘 다 숨김
                if (this.coldMsgEl) this.coldMsgEl.classList.add('hidden');
                if (this.puzzleArea) this.puzzleArea.classList.add('hidden');
            } else if (this.puzzleRevealed) {
                // 퍼즐 등장 단계
                if (this.coldMsgEl) this.coldMsgEl.classList.add('hidden');
                if (this.puzzleArea) this.puzzleArea.classList.remove('hidden');
            } else {
                // 첫 진입: 어렴풋 메시지만
                if (this.coldMsgEl) this.coldMsgEl.classList.remove('hidden');
                if (this.puzzleArea) this.puzzleArea.classList.add('hidden');
            }
        } else {
            // 다른 시점: 둘 다 숨김
            if (this.coldMsgEl) this.coldMsgEl.classList.add('hidden');
            if (this.puzzleArea) this.puzzleArea.classList.add('hidden');
        }
    },

    handleTemp(temp) {
        // baseline 설정
        if (this.initialTemp === null) {
            this.initialTemp = temp;
            return;
        }

        // baseline 대비 0.5°C 이상 올라가면 퍼즐 UI 등장
        // (DHT11은 0.1단위로 변동이 있으니 약간 여유)
        if (!this.puzzleRevealed && temp > this.initialTemp + 0.5) {
            this.revealPuzzle();
        }

        // 퍼즐 UI 보이는 동안만 게이지 갱신
        if (this.puzzleRevealed && !GameState.puzzles.leftWall.solved) {
            this.updateGauge(temp);
        }

        // 목표 도달
        if (temp >= this.TARGET_TEMP && !GameState.puzzles.leftWall.solved) {
            this.solve();
        }
    },

    // 어렴풋 메시지 → 본 퍼즐 UI로 전환
    revealPuzzle() {
        if (this.puzzleRevealed) return;
        this.puzzleRevealed = true;
        console.log('[LeftWall] 퍼즐 UI 등장');

        // 좌측벽 시점일 때만 즉시 반영
        if (GameState.currentView === 'left' && !GameState.puzzles.leftWall.solved) {
            if (this.coldMsgEl) this.coldMsgEl.classList.add('hidden');
            if (this.puzzleArea) this.puzzleArea.classList.remove('hidden');
        }
    },

    updateGauge(temp) {
        const GAUGE_MIN = 20;
        const GAUGE_MAX = this.TARGET_TEMP;  // 30
        const range = GAUGE_MAX - GAUGE_MIN;
        const percent = Math.max(0, Math.min(100, ((temp - GAUGE_MIN) / range) * 100));
        if (this.tempFill) this.tempFill.style.width = percent + '%';
        if (this.tempValue) this.tempValue.textContent = temp.toFixed(1) + '°C';
    },

    solve() {
        GameState.solvePuzzle('leftWall');
        GameState.setPower(true);  // 전력 복구!

        if (this.puzzleArea) {
            this.puzzleArea.innerHTML = `
                <p class="puzzle-text" style="color: #80d480;">
                    ✓ 전선이 녹아 회로가 복구되었다.
                </p>
                <p class="hint-text">창고에 전력이 들어왔다. 손전등은 더 이상 필요 없다.</p>
            `;

            setTimeout(() => {
                this.puzzleArea.classList.add('hidden');
            }, 3000);
        }
    },

    reset() {
        this.initialTemp = null;
        this.puzzleRevealed = false;
    }
};