/**
 * 숨겨진 단서 (HiddenClues)
 *
 * 전력 복구 후 둘러보다가 자연스럽게 발견되는 단서들.
 *
 *  - 좌측벽: "1번 자리 = 1"
 *      전선 패널 클리어 후, 좌측벽 다시 보면 벽 한쪽에 작게 새겨진 숫자 발견
 *
 *  - 천장: "4번 자리 = 7"
 *      전력 복구 후, 천장 보면 "천장 한쪽에 작은 메모를 발견했다..." + 숫자 7
 *
 * 발견 조건:
 *  - 전력 복구 완료 (powerRestored = true)
 *  - 해당 시점(view)으로 이동
 *  - 한 번 발견하면 인벤토리에 영구 추가
 */

const HiddenClues = {
    leftWallDiscovered: false,
    ceilingDiscovered: false,

    init() {
        // 시점 변경 시 처리
        GameState.on('view', (view) => this.handleViewChange(view));

        // 전력 변경 시 현재 시점에서 다시 체크
        GameState.on('power', (restored) => {
            console.log('[HiddenClues] power 변경:', restored, 'currentView:', GameState.currentView);
            if (restored) {
                this.handleViewChange(GameState.currentView);
            }
        });

        // sensor 이벤트도 듣기 - 천장에 있는 동안 매 센서값마다 체크
        // (만약 view나 power 이벤트가 어떤 이유로 누락됐어도 복구)
        GameState.on('sensor', () => {
            if (GameState.currentView === 'ceiling' &&
                GameState.powerRestored &&
                !this.ceilingDiscovered) {
                console.log('[HiddenClues] sensor 이벤트로 천장 단서 복구 발견');
                this.revealCeilingClue();
            }
        });
    },

    handleViewChange(view) {
        const power = GameState.powerRestored;
        console.log('[HiddenClues] view:', view, 'power:', power,
            'leftDone:', this.leftWallDiscovered, 'ceilingDone:', this.ceilingDiscovered);

        // 전력 복구 전이면 단서 보류 (어두운 메시지는 darkOverlay가 처리)
        if (!power) return;

        // 좌측벽: 1.2초 후 등장 (감성적 연출)
        if (view === 'left' && !this.leftWallDiscovered) {
            setTimeout(() => this.revealLeftWallClue(), 1200);
        }

        // 천장: 즉시 등장
        if (view === 'ceiling') {
            // 어두운 메시지가 남아있을 수 있으니 강제 숨김
            const darkMsg = document.getElementById('ceiling-dark-msg');
            if (darkMsg) darkMsg.classList.add('hidden');

            if (!this.ceilingDiscovered) {
                this.revealCeilingClue();
            } else {
                // 이미 발견했으면 다시 보이게만 (안 보이는 경우 대비)
                const el = document.getElementById('ceiling-clue');
                if (el) el.classList.remove('hidden');
            }
        }
    },

    revealLeftWallClue() {
        if (this.leftWallDiscovered) return;
        this.leftWallDiscovered = true;

        const el = document.getElementById('left-wall-clue');
        if (!el) {
            console.warn('[HiddenClues] left-wall-clue 엘리먼트 못 찾음');
            return;
        }
        el.classList.remove('hidden');
        el.classList.add('reveal');

        GameState.addToInventory({
            id: 'wall_digit_1',
            name: '벽에 새겨진 흔적',
            description: '1번 자리: 1'
        });
        console.log('[HiddenClues] ✓ 좌측벽 단서 발견 (1번 자리 = 1)');
    },

    revealCeilingClue() {
        if (this.ceilingDiscovered) {
            console.log('[HiddenClues] 천장 단서 이미 발견됨');
            return;
        }
        this.ceilingDiscovered = true;

        const el = document.getElementById('ceiling-clue');
        if (!el) {
            console.warn('[HiddenClues] ceiling-clue 엘리먼트 못 찾음');
            return;
        }
        el.classList.remove('hidden');
        el.classList.add('reveal');

        // 어두운 메시지도 같이 숨김 (이중 안전장치)
        const darkMsg = document.getElementById('ceiling-dark-msg');
        if (darkMsg) darkMsg.classList.add('hidden');

        GameState.addToInventory({
            id: 'ceiling_digit_7',
            name: '천장의 메모',
            description: '4번 자리: 7'
        });
        console.log('[HiddenClues] ✓ 천장 단서 발견 완료 (4번 자리 = 7)');
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
        console.log('[HiddenClues] reset 완료');
    }
};
