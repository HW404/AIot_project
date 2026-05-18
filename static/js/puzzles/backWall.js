/**
 * 뒷벽 - 무전기 + 모스 + 키패드 (3단 퍼즐)
 * 
 * 1. 무전기 주파수 맞추기 (포텐셔미터)
 * 2. 모스 신호 응답 (사운드 센서)
 * 3. 최종 암호 입력 (키패드)
 * 
 * ※ 이번 버전(0.0.1)은 골격만. 실제 로직은 다음 버전에서 확장.
 */

const BackWallPuzzle = {
    // 목표값
    TARGET_FREQ: 700,        // 포텐셔미터 0~1023 중 700
    FREQ_TOLERANCE: 30,
    FINAL_CODE: '3142',      // 최종 암호 (망원경=3, 다른 단서=1,4,2)
    
    radioEl: null,
    morseEl: null,
    keypadEl: null,
    
    init() {
        this.radioEl = document.getElementById('radio-puzzle');
        this.morseEl = document.getElementById('morse-puzzle');
        this.keypadEl = document.getElementById('keypad-puzzle');
        
        GameState.on('sensor', ({ name, value }) => {
            if (name === 'potentiometer') this.updateRadio(value);
        });
        
        GameState.on('view', (view) => this.handleViewChange(view));
    },
    
    handleViewChange(view) {
        // 뒷벽이 아니면 모두 숨김
        if (view !== 'back') {
            this.radioEl.classList.add('hidden');
            this.morseEl.classList.add('hidden');
            this.keypadEl.classList.add('hidden');
            return;
        }
        
        // 전력 복구 안 되면 뒷벽 퍼즐 비활성
        if (!GameState.powerRestored) return;
        
        // 진행 단계에 따라 표시
        if (!GameState.puzzles.backWall_radio.solved) {
            this.radioEl.classList.remove('hidden');
        } else if (!GameState.puzzles.backWall_morse.solved) {
            this.morseEl.classList.remove('hidden');
        } else if (!GameState.puzzles.backWall_keypad.solved) {
            this.keypadEl.classList.remove('hidden');
        }
    },
    
    updateRadio(freq) {
        if (GameState.puzzles.backWall_radio.solved) return;
        
        const diff = Math.abs(freq - this.TARGET_FREQ);
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
        this.radioEl.classList.add('hidden');
        this.morseEl.classList.remove('hidden');
    },
    
    // TODO (0.0.2 이후): 모스 신호 패턴 매칭 로직
    // TODO (0.0.2 이후): 키패드 4자리 입력 + 정답 검증
};
