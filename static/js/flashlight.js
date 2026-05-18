/**
 * 손전등 컨트롤
 * 
 * 동작:
 * - 토글 버튼 클릭 시 켜고 끔
 * - 켜지면 화면 중앙에 원형 빛 영역 생성
 * - 전력 복구되면 자동 비활성화
 * 
 * 추후 CDS 센서 연동 시:
 * - 센서값 임계치 이상이면 자동 ON
 * - sensor.cds 값에 따라 빛 강도 조절 가능
 */

const Flashlight = {
    btn: null,
    overlay: null,
    
    init() {
        this.btn = document.getElementById('flashlight-btn');
        this.overlay = document.getElementById('flashlight-overlay');
        
        this.btn.addEventListener('click', () => this.toggle());
        
        // GameState 변경 감지
        GameState.on('flashlight', (on) => this.render(on));
        GameState.on('power', (restored) => this.handlePowerChange(restored));
    },
    
    toggle() {
        // 전력 복구된 후엔 손전등 사용 불가
        if (GameState.powerRestored) return;
        GameState.setFlashlight(!GameState.flashlightOn);
    },
    
    render(on) {
        if (on) {
            this.btn.classList.add('active');
            this.overlay.classList.add('flashlight-on');
        } else {
            this.btn.classList.remove('active');
            this.overlay.classList.remove('flashlight-on');
        }
    },
    
    handlePowerChange(restored) {
        if (restored) {
            // 전력 복구 → 손전등 비활성화 + 오버레이 제거
            this.btn.classList.add('disabled');
            this.overlay.classList.add('power-on');
            this.overlay.classList.remove('flashlight-on');
        } else {
            this.btn.classList.remove('disabled');
            this.overlay.classList.remove('power-on');
        }
    }
};
