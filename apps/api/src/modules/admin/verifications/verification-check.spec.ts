import { autoCheck, parseDocuments } from './verification-check.js';

describe('đối chiếu tự động hồ sơ xác minh', () => {
  it('đủ giấy tờ hợp lệ → điểm cao, tất cả khớp', () => {
    const r = autoCheck(parseDocuments([{ key: 'dkkd', label: 'ĐKKD', ok: true }, { key: 'gpxkld', label: 'GP XKLĐ', ok: true }]), { hasId: true });
    expect(r.summary).toBe('Tất cả khớp');
    expect(r.score).toBe(100);
    expect(r.valid).toBe(2);
  });

  it('nêu giấy tờ lỗi đầu tiên và số lỗi còn lại', () => {
    const docs = parseDocuments([{ key: 'a', label: 'ĐKKD', ok: true }, { key: 'b', label: 'GP XKLĐ', ok: false }, { key: 'c', label: 'Thư uỷ quyền', ok: false }, 'rác']);
    const r = autoCheck(docs, { hasId: false });
    expect(r.summary).toBe('GP XKLĐ – lỗi (+1)');
    expect(r.score).toBeLessThan(50);
  });
});
