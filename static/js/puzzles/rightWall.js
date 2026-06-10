/**
 * 오른쪽 벽 - 망원경 초점 맞추기
 * 
 * 센서: 초음파 센서 (거리)
 * 동작: 목표 거리(약 20cm)에 손이 위치하면 블러 해제 → 암호 일부 공개
 * 
 * 획득 단서: 암호 숫자 일부 (예: 3)
 */

const RightWallPuzzle = {
    TARGET_DISTANCE: 25,
    DISTANCE_TOLERANCE: 3,   // ±3cm 허용 (25cm 근처 22~28에서 해제)
    REVEALED_DIGIT: '3',     // 망원경으로 보이는 암호 숫자

    puzzleArea: null,
    blurEl: null,

    init() {
        this.puzzleArea = document.getElementById('telescope-puzzle');
        this.blurEl = document.getElementById('telescope-blur');

        GameState.on('sensor', ({ name, value }) => {
            // 라파/아두이노가 보내는 센서 이름은 'dist' (DIST=18 → dist)
            if (name === 'dist') this.update(value);
        });

        GameState.on('view', (view) => this.handleViewChange(view));
    },
    
    handleViewChange(view) {
        // 전력 복구 후에만 활성. 클리어 여부와 관계없이 우측에 오면 표시
        // (클리어 후엔 puzzleArea가 단서 박스로 교체되어 있음)
        if (view === 'right' && GameState.powerRestored) {
            this.puzzleArea.classList.remove('hidden');
        } else {
            this.puzzleArea.classList.add('hidden');
        }
    },
    
    update(distance) {
        // 거리에 따라 블러 강도 조절
        // 목표 거리(25cm)에서 멀어질수록 블러 ↑
        const diff = Math.abs(distance - this.TARGET_DISTANCE);
        const blurAmount = Math.min(15, diff * 0.6);
        this.blurEl.style.filter = `blur(${blurAmount}px)`;

        // 허용 범위 내면 클리어
        if (diff <= this.DISTANCE_TOLERANCE && !GameState.puzzles.rightWall.solved) {
            this.solve();
        }
    },
    
    solve() {
        GameState.puzzles.rightWall.code = this.REVEALED_DIGIT;
        GameState.solvePuzzle('rightWall');
        
        // 인벤토리에 단서 추가
        GameState.addToInventory({
            id: 'telescope_digit',
            name: '망원경 단서',
            description: `2번 자리: ${this.REVEALED_DIGIT}`
        });
        
        this.puzzleArea.innerHTML = `
            <div class="hidden-clue reveal">
                <p class="clue-found">망원경의 초점이 맞춰지자 숫자가 선명해졌다...</p>
                <div class="clue-digit">${this.REVEALED_DIGIT}</div>
                <p class="clue-meta">2번 자리</p>
            </div>
        `;
    }
};