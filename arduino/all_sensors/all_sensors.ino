/*
 * SensorEscape - 통합 센서 스케치 (v0.0.4)
 *
 * 사용법:
 *  - 아래 #define ENABLE_* 라인에서 사용할 센서만 1로 설정
 *  - 사용 안 하는 센서는 0으로 두면 코드/핀 사용 안 함
 *  - 모든 센서값은 시리얼로 "KEY:VALUE" 형식으로 송신됨
 *
 * 시리얼 출력 예시 (1초마다):
 *  CDS:512
 *  TEMP:23.5
 *  HUMID:45.0
 *  DIST:18
 *  SOUND:120
 *  POT:678
 *  KEY:5      (키패드 입력 시 즉시 송신)
 *
 * 필수 라이브러리 (사용하는 센서에 따라 설치):
 *  - DHT sensor library (Adafruit)  ← DHT11 사용 시
 *  - Keypad (Mark Stanley)          ← 키패드 사용 시
 *  - LiquidCrystal I2C              ← LCD 사용 시
 *
 * 자세한 배선법: docs/HARDWARE_GUIDE.md 참고
 */

// ============================================================
// 센서 활성화 스위치 (1: 사용, 0: 미사용)
// 처음에는 모두 0으로 두고, 연결한 센서만 1로 바꾸세요.
// ============================================================
#define ENABLE_CDS       0    // 조도 센서 (A0)
#define ENABLE_DHT       0    // DHT11 온습도 (D2)
#define ENABLE_ULTRA     0    // 초음파 (D3 TRIG, D4 ECHO)
#define ENABLE_SOUND     0    // 사운드 (A1)
#define ENABLE_POT       0    // 가변저항 (A2)
#define ENABLE_KEYPAD    0    // 4x4 키패드 (D5~D7, D9~D13)
#define ENABLE_LCD       0    // LCD I2C (A4 SDA, A5 SCL)

// ============================================================
// 핀 정의
// ============================================================
#define CDS_PIN     A0
#define SOUND_PIN   A1
#define POT_PIN     A2
#define DHT_PIN     2
#define TRIG_PIN    3
#define ECHO_PIN    4
#define LED_PIN     13   // 내장 LED (생존 신호)

// 송신 주기 (ms)
#define SEND_INTERVAL 1000

// ============================================================
// 라이브러리 인클루드 (활성화된 센서만)
// ============================================================
#if ENABLE_DHT
  #include <DHT.h>
  #define DHTTYPE DHT11
  DHT dht(DHT_PIN, DHTTYPE);
#endif

#if ENABLE_KEYPAD
  #include <Keypad.h>
  const byte ROWS = 4;
  const byte COLS = 4;
  char keys[ROWS][COLS] = {
    {'1','2','3','A'},
    {'4','5','6','B'},
    {'7','8','9','C'},
    {'*','0','#','D'}
  };
  byte rowPins[ROWS] = {9, 10, 11, 12};
  byte colPins[COLS] = {5, 6, 7, 13};
  Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);
#endif

#if ENABLE_LCD
  #include <Wire.h>
  #include <LiquidCrystal_I2C.h>
  LiquidCrystal_I2C lcd(0x27, 16, 2);  // 주소 다르면 0x3F로 변경
#endif

// ============================================================
// 상태 변수
// ============================================================
unsigned long lastSendTime = 0;

// ============================================================
// 초기화
// ============================================================
void setup() {
  Serial.begin(9600);
  delay(500);

  pinMode(LED_PIN, OUTPUT);

#if ENABLE_DHT
  dht.begin();
#endif

#if ENABLE_ULTRA
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
#endif

#if ENABLE_LCD
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("SensorEscape");
#endif

  Serial.println("READY");
}

// ============================================================
// 메인 루프
// ============================================================
void loop() {
  unsigned long now = millis();

  // 키패드는 즉시 처리 (이벤트성)
#if ENABLE_KEYPAD
  char key = keypad.getKey();
  if (key) {
    Serial.print("KEY:");
    Serial.println(key);
  }
#endif

  // 나머지 센서는 SEND_INTERVAL 주기로 송신
  if (now - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = now;

    // 생존 신호 (LED 깜빡)
    digitalWrite(LED_PIN, HIGH);

#if ENABLE_CDS
    int cds = analogRead(CDS_PIN);
    Serial.print("CDS:");
    Serial.println(cds);
#endif

#if ENABLE_DHT
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h)) {
      Serial.print("TEMP:");
      Serial.println(t, 1);
      Serial.print("HUMID:");
      Serial.println(h, 1);
    }
#endif

#if ENABLE_ULTRA
    long distance = readDistance();
    Serial.print("DIST:");
    Serial.println(distance);
#endif

#if ENABLE_SOUND
    int sound = analogRead(SOUND_PIN);
    Serial.print("SOUND:");
    Serial.println(sound);
#endif

#if ENABLE_POT
    int pot = analogRead(POT_PIN);
    Serial.print("POT:");
    Serial.println(pot);
#endif

    // 활성화된 센서가 하나도 없을 때도 살아있음 알림
#if !(ENABLE_CDS || ENABLE_DHT || ENABLE_ULTRA || ENABLE_SOUND || ENABLE_POT)
    Serial.print("ALIVE:");
    Serial.println(now / 1000);
#endif

    delay(50);
    digitalWrite(LED_PIN, LOW);
  }
}

// ============================================================
// 초음파 거리 측정 (cm)
// ============================================================
#if ENABLE_ULTRA
long readDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);  // timeout 30ms
  if (duration == 0) return -1;                    // 측정 실패
  return duration * 0.034 / 2;
}
#endif
