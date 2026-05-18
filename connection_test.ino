/*
 * SensorEscape - 연결 테스트 스케치 (v0.0.3)
 * 
 * 목적: 아두이노 ↔ 노트북 시리얼 통신 확인
 * 
 * 동작:
 *  - 1초마다 시리얼로 "HELLO <카운터>" 송신
 *  - 내장 LED(13번)를 같이 깜빡여서 보드가 살아있음을 시각적으로 확인
 * 
 * 시리얼 설정: 9600 baud
 * 
 * 사용 보드: Arduino Uno R3 (Nano도 동일)
 * 추가 부품 없음 (USB 케이블만 있으면 됨)
 */

const int LED_PIN = 13;        // 내장 LED
const long INTERVAL = 1000;    // 송신 간격 (ms)

unsigned long lastSendTime = 0;
unsigned long counter = 0;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
  
  // 부팅 시 신호 (Python 쪽에서 이걸로 연결 확인 가능)
  delay(500);
  Serial.println("READY");
}

void loop() {
  unsigned long now = millis();
  
  if (now - lastSendTime >= INTERVAL) {
    lastSendTime = now;
    counter++;
    
    // 시리얼 송신
    Serial.print("HELLO ");
    Serial.println(counter);
    
    // LED 짧게 깜빡 (50ms)
    digitalWrite(LED_PIN, HIGH);
    delay(50);
    digitalWrite(LED_PIN, LOW);
  }
}
