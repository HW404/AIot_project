/**
 * 왼쪽 벽 - 냉각된 전선 패널 퍼즐
 * 
 * 센서: 온습도 센서
 * 동작: 온도가 목표값에 도달하면 클리어 → 전력 복구
 * 
 * 목표 온도: 30°C 이상
 */

const LeftWallPuzzle = {
    TARGET_TEMP: 30,
    puzzleArea: null,
    tempFill: null,
    tempValue: null,
    
    init() {
        this.puzzleArea = document.getElementById('cable-puzzle');
        this.tempFill = document.getElementById('temp-fill');
        this.tempValue = document.getElementById('temp-value');
        
        // 센서값 변경 감지
        GameState.on('sensor', ({ name, value }) => {
            if (name === 'temp') this.update(value);
        });
        
        // 시점이 left가 되면 표시
        GameState.on('view', (view) => this.handleViewChange(view));
    },
    
    handleViewChange(view) {
        if (view === 'left' && !GameState.puzzles.leftWall.solved) {
            this.puzzleArea.classList.remove('hidden');
        } else {
            this.puzzleArea.classList.add('hidden');
        }
    },
    
    update(temp) {
        // 온도 게이지 표시 (-10 ~ 50 → 0 ~ 100%)
        const percent = Math.max(0, Math.min(100, ((temp + 10) / 60) * 100));
        this.tempFill.style.width = percent + '%';
        this.tempValue.textContent = temp.toFixed(1) + '°C';
        
        // 목표 도달 시 클리어
        if (temp >= this.TARGET_TEMP && !GameState.puzzles.leftWall.solved) {
            this.solve();
        }
    },
    
    solve() {
        GameState.solvePuzzle('leftWall');
        GameState.setPower(true);  // 전력 복구!
        
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
};
