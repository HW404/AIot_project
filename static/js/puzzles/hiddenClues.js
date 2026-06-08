/**
 * 숨겨진 단서 (HiddenClues)
 *
 * 전력 복구 후 둘러보다가 자연스럽게 발견되는 단서들.
 *
 *  - 좌측벽: "1번 자리 = 1"
 *      전선 패널 클리어 후, 좌측벽 다시 보면 벽 한쪽에 작게 새겨진 숫자 발견
 *
 *  - 천장: "4번 자리 = 7"
 *      전력 복구 후, 천장 보면 형광등 옆에 숨겨진 숫자 발견
 *
 * 발견 조건:
 *  - 전력 복구 완료 (power restored = true)
 *  - 해당 시점(view)으로 이동
 *  - 한 번 발견하면 인벤토리에 영구 추가
 */

const HiddenClues = {
    leftWallDiscovered: false,
    ceilingDiscovered: false,

    init() {
        GameState.on('view', (view) => this.handleViewChange(view));
        GameState.on('power', (restored) => {
            if (restored) this.handleViewChange(GameState.currentView);
        });
    },

    handleViewChange(view) {
        if (!GameState.powerRestored) return;

        if (view === 'left' && !this.leftWallDiscovered) {
            setTimeout(() => this.revealLeftWallClue(), 1200);
        }

        if (view === 'ceiling' && !this.ceilingDiscovered) {
            setTimeout(() => this.revealCeilingClue(), 600);
        }
    },

    revealLeftWallClue() {
        if (this.leftWallDiscovered) return;
        this.leftWallDiscovered = true;

        const el = document.getElementById('left-wall-clue');
        if (el) {
            el.classList.remove('hidden');
            el.classList.add('reveal');
        }

        GameState.addToInventory({
            id: 'wall_digit_1',
            name: '벽에 새겨진 흔적',
            description: '1번 자리: 1'
        });
        console.log('[HiddenClues] 좌측벽 단서 발견 (1번 자리 = 1)');
    },

    revealCeilingClue() {
        if (this.ceilingDiscovered) return;
        this.ceilingDiscovered = true;

        const el = document.getElementById('ceiling-clue');
        if (el) {
            el.classList.remove('hidden');
            el.classList.add('reveal');
        }
        // 전력 복구 후엔 "어두워서 안 보인다" 메시지 숨김
        const darkMsg = document.getElementById('ceiling-dark-msg');
        if (darkMsg) darkMsg.classList.add('hidden');

        GameState.addToInventory({
            id: 'ceiling_digit_7',
            name: '천장의 숫자',
            description: '4번 자리: 7'
        });
        console.log('[HiddenClues] 천장 단서 발견 (4번 자리 = 7)');
    },

    reset() {
        this.leftWallDiscovered = false;
        this.ceilingDiscovered = false;
        const left = document.getElementById('left-wall-clue');
        const ceiling = document.getElementById('ceiling-clue');
        const darkMsg = document.getElementById('ceiling-dark-msg');
        if (left) {
            left.classList.add('hidden');
            left.classList.remove('reveal');
        }
        if (ceiling) {
            ceiling.classList.add('hidden');
            ceiling.classList.remove('reveal');
        }
        if (darkMsg) darkMsg.classList.remove('hidden');
    }
};