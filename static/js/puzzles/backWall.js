/**
 * 뒷벽 - 무전기 + 모스 + 키패드 (3단 퍼즐)
 *
 * 1. 무전기 주파수 맞추기 (가변저항)
 * 2. 모스 신호 응답 (사운드 센서)
 * 3. 최종 암호 입력 (키패드)
 *
 * v0.0.12 변경:
 *  - 센서 이름 'potentiometer' → 'pot' (라파 실제 송신 이름과 일치)
 *  - 무전기에 주파수 게이지 추가 (사용자가 얼마나 맞췄는지 시각적 피드백)
 */

const BackWallPuzzle = {
    // 가변저항 0~1023 중 목표 700, 허용 ±30 (= 670~730)
    TARGET_FREQ: 700,
    FREQ_TOLERANCE: 30,
    FINAL_CODE: '3142',

    radioEl: null,
    morseEl: null,
    keypadEl: null,

    // 게이지 UI
    freqFill: null,
    freqValue: null,

    init() {
        this.radioEl = document.getElementById('radio-puzzle');
        this.morseEl = document.getElementById('morse-puzzle');
        this.keypadEl = document.getElementById('keypad-puzzle');

        this.freqFill = document.getElementById('freq-fill');
        this.freqValue = document.getElementById('freq-value');

        GameState.on('sensor', ({ name, value }) => {
            // 라파/아두이노가 보내는 이름은 'pot' (POT=678 → pot)
            if (name === 'pot') this.updateRadio(value);
        });

        GameState.on('view', (view) => this.handleViewChange(view));
    },

    handleViewChange(view) {
        // 뒷벽이 아니면 모두 숨김
        if (view !== 'back') {
            this.radioEl.classList.add('hidden');
            this.morseEl.classList.add('hidden');
            if (this.keypadEl) this.keypadEl.classList.add('hidden');
            return;
        }

        // 전력 복구 안 되면 뒷벽 퍼즐 비활성
        if (!GameState.powerRestored) return;

        // 단계별 표시
        if (!GameState.puzzles.backWall_radio.solved) {
            // 무전기 단계
            this.radioEl.classList.remove('hidden');
            this.morseEl.classList.add('hidden');
        } else {
            // 무전기 해결 후: 모스 영역 (해결 전이든 후든)
            // morse.js가 클리어 시 puzzleArea를 큰 단서 박스로 교체하므로
            // 항상 보이게 두면 됨
            this.radioEl.classList.add('hidden');
            this.morseEl.classList.remove('hidden');
        }
    },

    updateRadio(potValue) {
        // 게이지 UI 갱신 (퍼즐 해제 전후 무관하게 계속 표시)
        if (this.freqFill && this.freqValue) {
            // pot은 0~1023 → 0~100%로 변환
            const percent = Math.max(0, Math.min(100, (potValue / 1023) * 100));
            this.freqFill.style.left = percent + '%';
            this.freqValue.textContent = Math.round(potValue);

            // 목표 근접 여부에 따라 색상 변화
            const diff = Math.abs(potValue - this.TARGET_FREQ);
            if (diff <= this.FREQ_TOLERANCE) {
                this.freqFill.classList.add('matched');
            } else {
                this.freqFill.classList.remove('matched');
            }
        }

        if (GameState.puzzles.backWall_radio.solved) return;

        const diff = Math.abs(potValue - this.TARGET_FREQ);
        if (diff <= this.FREQ_TOLERANCE) {
            this.solveRadio();
        }
    },

    solveRadio() {
        GameState.solvePuzzle('backWall_radio');
        GameState.addToInventory({
            id: 'radio_signal',
            name: '무전 신호',
            description: '무전 연결 성공'
        });

        // 다음 단계: 모스 퍼즐 표시
        // (살짝 지연을 줘서 사용자가 클리어 인지하게)
        setTimeout(() => {
            this.radioEl.classList.add('hidden');
            this.morseEl.classList.remove('hidden');
        }, 1500);
    },

    // TODO (다음 버전): 모스 신호 패턴 매칭 로직 (사운드 센서)
    // TODO (다음 버전): 키패드 4자리 입력 + 정답 검증
};