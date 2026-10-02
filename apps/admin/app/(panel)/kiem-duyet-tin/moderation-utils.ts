/** Mức rủi ro: ≥ 70 cao (đỏ) · 40–69 cần xem (cam) · dưới 40 thấp (xanh) – theo design-new 07 */
export const riskLevel = (score: number): 'high' | 'mid' | 'low' => (score >= 70 ? 'high' : score >= 40 ? 'mid' : 'low');
