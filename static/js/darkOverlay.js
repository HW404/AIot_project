/**
 * DarkOverlay - 전력 복구 전 어두운 메시지 처리
 *
 * 동작 (v0.0.16):
 *   - 전력 복구 전: 정면/뒤/우측/천장의 dark-msg 표시, 그 외 퍼즐 UI 숨김
 *   - 전력 복구 후: dark-msg 숨기고 각 퍼즐이 자기 표시 제어
 *   - 좌측은 별도 로직 (leftWall.js가 자체 단계 관리)
 *
 * dark-msg 요소:
 *   - data-dark-for 속성으로 어느 시점에 적용되는지 명시
 *   - 정면(front), 뒤(back), 우측(right) — 천장은 기존 ceiling-dark-msg ID 사용
 */

const DarkOverlay = {
    init() {
        // 시점/전력 변경 시 갱신
        GameState.on('view', () => this.update());
        GameState.on('power', (restored) => {
            console.log('[DarkOverlay] power 변경:', restored);
            // 전력 복구 시 모든 dark-msg 즉시 숨김
            if (restored) this.hideAll();
            else this.update();
        });
        // 게임 시작 시 초기 반영
        GameState.on('phase', (phase) => {
            if (phase === 'playing') this.update();
        });
    },

    // 전력 복구 시: 모든 dark-msg 한 번에 숨김
    hideAll() {
        document.querySelectorAll('.dark-msg').forEach((el) => {
            el.classList.add('hidden');
        });
    },

    update() {
        const powerOn = GameState.powerRestored;
        const view = GameState.currentView;

        // 정면/뒤/우측의 dark-msg
        document.querySelectorAll('.dark-msg[data-dark-for]').forEach((el) => {
            const targetView = el.dataset.darkFor;
            // 해당 시점이고 + 전력 미복구 → 보임
            const shouldShow = (view === targetView) && !powerOn;
            el.classList.toggle('hidden', !shouldShow);
        });

        // 천장 (ID 기반, ceiling-dark-msg)
        const ceilingDark = document.getElementById('ceiling-dark-msg');
        if (ceilingDark) {
            const shouldShow = (view === 'ceiling') && !powerOn;
            ceilingDark.classList.toggle('hidden', !shouldShow);
        }
    }
};