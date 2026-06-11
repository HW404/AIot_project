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
    DISTANCE_TOLERANCE: 3,   // ±3cm (22~28에서 자동 해제)
    REVEALED_DIGIT: '3',

    puzzleArea: null,
    blurEl: null,
    distanceEl: null,

    init() {
        this.puzzleArea = document.getElementById('telescope-puzzle');
        this.blurEl = document.getElementById('telescope-blur');
        this.distanceEl = document.getElementById('telescope-distance');

        GameState.on('sensor', ({ name, value }) => {
            if (name === 'dist') this.update(value);
        });

        GameState.on('view', (view) => this.handleViewChange(view));
    },

    handleViewChange(view) {
        if (view === 'right' && GameState.powerRestored) {
            this.puzzleArea.classList.remove('hidden');
        } else {
            this.puzzleArea.classList.add('hidden');
        }
    },

    update(distance) {
        if (GameState.puzzles.rightWall.solved) return;
        if (!this.blurEl) return;

        // 거리 표시 (cm)
        if (this.distanceEl) {
            this.distanceEl.textContent = `거리: ${distance} cm`;
        }

        // v0.0.20: 거리에 따라 블러 + 투명도 동시 조절
        // 목표(25cm)에 가까울수록 선명 + 진한색
        const diff = Math.abs(distance - this.TARGET_DISTANCE);

        // 블러: 0(선명) ~ 20px(전혀 안 보임)
        // diff 0  → blur 0
        // diff 3  → blur 3 (허용 범위 안)
        // diff 10 → blur 12
        // diff 30+ → blur 20 (max)
        const blurAmount = Math.min(20, diff * 1.2);

        // 투명도: 1.0 (선명) ~ 0.3 (흐릿)
        const opacity = Math.max(0.3, 1.0 - diff * 0.04);

        this.blurEl.style.filter = `blur(${blurAmount}px)`;
        this.blurEl.style.opacity = opacity;

        // 허용 범위 내면 클리어
        if (diff <= this.DISTANCE_TOLERANCE) {
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