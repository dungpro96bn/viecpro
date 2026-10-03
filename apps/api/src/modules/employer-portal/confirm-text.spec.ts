import { confirmTextMatches } from '@viecpro/shared';

describe('confirmTextMatches (gõ lại tên để xoá vĩnh viễn)', () => {
  it('khớp khi gõ đúng 100%', () => {
    expect(confirmTextMatches('Lê Văn Bình', 'Lê Văn Bình')).toBe(true);
  });

  it('không khớp khi khác hoa / thường, thiếu dấu, thừa / thiếu dấu cách', () => {
    expect(confirmTextMatches('lê văn bình', 'Lê Văn Bình')).toBe(false);
    expect(confirmTextMatches('Le Van Binh', 'Lê Văn Bình')).toBe(false);
    expect(confirmTextMatches('Lê Văn Bình ', 'Lê Văn Bình')).toBe(false);
    expect(confirmTextMatches('Lê  Văn Bình', 'Lê Văn Bình')).toBe(false);
  });

  it('khớp giữa dạng Unicode dựng sẵn và tổ hợp (bộ gõ Telex / VNI khác nhau, nhìn giống hệt)', () => {
    const composed = 'Lê Văn Bình'.normalize('NFC');
    const decomposed = 'Lê Văn Bình'.normalize('NFD');
    expect(composed).not.toBe(decomposed);
    expect(confirmTextMatches(decomposed, composed)).toBe(true);
  });
});
