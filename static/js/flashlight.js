/**
 * 손전등 컨트롤
 *
 * 동작 (v0.0.13):
 *  - 게임 시작 시점의 CDS 값을 baseline으로 기록
 *  - 이후 |현재값 - baseline| 가 임계값 이상이면 손전등 ON
 *  - 변화량 기반이므로 환경(형광등/햇빛/어두운 방)에 관계없이 동작
 *    · 평상시 1014에서 폰 손전등 비춤 → 1023 (변화 +9) ... 임계값 작게
 *    · 또는 손으로 가림 → 800 (변화 -214) ... 충분히 OFF에서 다시 밝아지면 ON
 *  - 전력 복구 후엔 손전등 비활성화
 *
 * 임계값:
 *  - THRESHOLD_ON:  baseline 대비 절댓값 변화량이 이 이상이면 ON
 *  - THRESHOLD_OFF: baseline 대비 절댓값 변화량이 이 이하이면 OFF (히스테리시스)
 *
 * 토글 버튼은 시연/디버그용으로 유지.
 */

const Flashlight = {
    // 변화량 임계값
    // 사용자 환경: 평상시 CDS ≈ 1014, 폰 손전등 비추면 +9~+15 정도 변화
    THRESHOLD_ON: 10,    // baseline 대비 |Δ| ≥ 10 → ON
    THRESHOLD_OFF: 5,    // baseline 대비 |Δ| ≤ 5  → OFF

    btn: null,
    overlay: null,
    baseline: null,       // 게임 시작 시점 CDS 값 (첫 측정값으로 자동 설정)

    init() {
        this.btn = document.getElementById('flashlight-btn');
        this.overlay = document.getElementById('flashlight-overlay');

        if (this.btn) {
            this.btn.addEventListener('click', () => this.toggle());
        }

        GameState.on('flashlight', (on) => this.render(on));
        GameState.on('power', (restored) => this.handlePowerChange(restored));

        // CDS 센서값 → 자동 판정
        GameState.on('sensor', ({ name, value }) => {
            if (name === 'cds') this.handleCDS(value);
        });

        // 게임 시작 시 baseline 리셋 (lobby → playing)
        GameState.on('phase', (phase) => {
            if (phase === 'playing') {
                this.baseline = null;  // 다음 CDS 측정값으로 새로 설정
                console.log('[Flashlight] baseline 리셋 - 다음 CDS 값을 baseline으로 사용');
            }
        });
    },

    handleCDS(cdsValue) {
        // 전력 복구 후엔 손전등 비활성
        if (GameState.powerRestored) return;

        // 첫 CDS 측정 시 baseline 설정
        if (this.baseline === null) {
            this.baseline = cdsValue;
            console.log(`[Flashlight] baseline 설정: ${cdsValue}`);
            return;
        }

        const delta = Math.abs(cdsValue - this.baseline);
        const currentlyOn = GameState.flashlightOn;

        // 꺼져있는데 baseline에서 크게 변화 → ON
        if (!currentlyOn && delta >= this.THRESHOLD_ON) {
            console.log(`[Flashlight] ON (CDS ${cdsValue}, baseline ${this.baseline}, Δ${delta})`);
            GameState.setFlashlight(true);
        }
        // 켜져있는데 baseline 근처로 돌아옴 → OFF
        else if (currentlyOn && delta <= this.THRESHOLD_OFF) {
            console.log(`[Flashlight] OFF (CDS ${cdsValue}, baseline ${this.baseline}, Δ${delta})`);
            GameState.setFlashlight(false);
        }
    },

    // 수동 토글 (디버그용)
    toggle() {
        if (GameState.powerRestored) return;
        GameState.setFlashlight(!GameState.flashlightOn);
    },

    render(on) {
        if (this.btn) {
            if (on) this.btn.classList.add('active');
            else this.btn.classList.remove('active');
        }
        if (this.overlay) {
            if (on) this.overlay.classList.add('flashlight-on');
            else this.overlay.classList.remove('flashlight-on');
        }
    },

    handlePowerChange(restored) {
        if (restored) {
            if (this.btn) this.btn.classList.add('disabled');
            if (this.overlay) {
                this.overlay.classList.add('power-on');
                this.overlay.classList.remove('flashlight-on');
            }
        } else {
            if (this.btn) this.btn.classList.remove('disabled');
            if (this.overlay) this.overlay.classList.remove('power-on');
        }
    }
};