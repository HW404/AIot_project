/**
 * 앞벽 - 최종 탈출구
 * 
 * 모든 퍼즐 완료 시 자동으로 활성화
 * 출구를 클릭하면 게임 종료
 */

const FrontWallPuzzle = {
    exitPanel: null,
    
    init() {
        this.exitPanel = document.getElementById('exit-panel');
        
        // 퍼즐 클리어 이벤트마다 체크
        GameState.on('puzzleSolved', () => this.checkAllSolved());
        GameState.on('view', (view) => this.handleViewChange(view));
    },
    
    handleViewChange(view) {
        if (view === 'front') {
            this.exitPanel.classList.remove('hidden');
            this.updatePanel();
        } else {
            this.exitPanel.classList.add('hidden');
        }
    },
    
    updatePanel() {
        const allSolved = GameState.isAllPuzzlesSolved();
        if (allSolved) {
            this.exitPanel.innerHTML = `
                <p class="puzzle-text" style="color: #80d480;">
                    ✓ 모든 퍼즐을 해결했다.
                </p>
                <button class="btn-primary" id="escape-btn">탈출하기</button>
            `;
            const btn = document.getElementById('escape-btn');
            if (btn) btn.addEventListener('click', () => this.escape());
        } else {
            const remaining = Object.entries(GameState.puzzles)
                .filter(([k, v]) => !v.solved)
                .length;
            this.exitPanel.innerHTML = `
                <p class="puzzle-text">최종 탈출구</p>
                <p class="hint-text">남은 퍼즐: ${remaining}개</p>
            `;
        }
    },
    
    checkAllSolved() {
        if (GameState.currentView === 'front') {
            this.updatePanel();
        }
    },
    
    escape() {
        GameState.setPhase('ended');
    }
};
