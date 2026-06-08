/*
 * 센서 연결 확인용 스케치
 *
 * 6개 센서가 핀에 제대로 꽂혔는지 시리얼 모니터로 확인.
 * 1초마다 모든 센서값을 한 줄로 출력.
 *
 * 핀:
 *   CDS      A0
 *   사운드   A1
 *   가변저항 A2
 *   DHT11    D2
 *   초음파   D3(TRIG), D4(ECHO)
 *   부저     D8 (소리 안 냄)
 *
 * 라이브러리: DHT sensor library (Adafruit)
 *
 * 시리얼 모니터 9600 baud, 출력 예시:
 *   CDS=512  SND=120  POT=678  TEMP=23.5  HUM=45.0  DIST=18  BZR=OK
 */

#include <DHT.h>

#define CDS_PIN   A0
#define SND_PIN   A1
#define POT_PIN   A2
#define DHT_PIN   2
#define TRIG_PIN  3
#define ECHO_PIN  4
#define BZR_PIN   8

DHT dht(DHT_PIN, DHT11);

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BZR_PIN, OUTPUT);
  dht.begin();
  delay(1000);
  Serial.println("센서 점검 시작");
}

void loop() {
  // CDS
  int cds = analogRead(CDS_PIN);

  // 사운드
  int snd = analogRead(SND_PIN);

  // 가변저항
  int pot = analogRead(POT_PIN);

  // DHT11
  float temp = dht.readTemperature();
  float hum  = dht.readHumidity();

  // 초음파
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  long dist = duration * 0.034 / 2;

  // 부저 (소리 안 나게 아주 짧게 HIGH → LOW)
  digitalWrite(BZR_PIN, HIGH);
  delayMicroseconds(1);
  digitalWrite(BZR_PIN, LOW);

  // 한 줄로 출력
  Serial.print("CDS=");   Serial.print(cds);
  Serial.print("  SND="); Serial.print(snd);
  Serial.print("  POT="); Serial.print(pot);
  Serial.print("  TEMP="); Serial.print(temp, 1);
  Serial.print("  HUM=");  Serial.print(hum, 1);
  Serial.print("  DIST="); Serial.print(dist);
  Serial.println("  BZR=OK");

  delay(1000);
}
