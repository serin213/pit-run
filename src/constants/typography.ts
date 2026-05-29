/**
 * Typography 디자인 토큰
 *
 * letterSpacing은 폰트 크기에 비례. 코드 곳곳에 흩어진 raw value
 * (-0.4, 1.8, -0.02 * fontSize 등) 를 일관된 토큰으로 통일.
 *
 * Ambiguous 케이스 (ResultSharePage의 10pt 양수 0.2/0.3, CircuitCard의 dynamic
 * tx.*LetterSpacing 등) 는 이번 정리에서 제외 — 디자이너 의도가 별도라
 * 사용자 별도 결정 대기.
 */

export const LETTER_SPACING = {
  /**
   * 큰 제목·강조 등 디스플레이 텍스트. fontSize × -0.02 (tight).
   *
   * 예: 20pt → -0.4, 30pt → -0.6, 100pt → -2.
   */
  display: (fontSize: number) => fontSize * -0.02,

  /**
   * 본문·설명·서브타이틀 등 일반 텍스트. fontSize × -0.01 (약하게 tight).
   *
   * 예: 16pt → -0.16, 20pt → -0.2, 17pt → -0.17.
   */
  body: (fontSize: number) => fontSize * -0.01,

  /**
   * 라벨·캡션·all-caps·loose 숫자. fontSize × 0.05 (살짝 loose).
   *
   * 예: 36pt → 1.8, 20pt → 1.0, 100pt → 5.
   */
  caption: (fontSize: number) => fontSize * 0.05,

  /**
   * 숫자로만 구성된 텍스트 (페이스 5'22", 거리 3.14km 등). spacing = 0.
   * caption이 아닌 숫자 표시에 사용.
   */
  numeric: (_fontSize: number) => 0,
};
