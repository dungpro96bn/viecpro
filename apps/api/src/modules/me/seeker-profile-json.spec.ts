import { describe, expect, it } from 'vitest';
import { mergeSkills, readDocuments, readExperiences, readSkills, sortExperiences } from './seeker-profile-json.js';

describe('seeker-profile-json', () => {
  it('bỏ phần tử hỏng thay vì làm lỗi cả hồ sơ', () => {
    expect(readSkills([{ name: 'Khéo tay', level: 5 }, { name: 'x', level: 9 }, 'rác'])).toEqual([{ name: 'Khéo tay', level: 5, note: null, verified: false }]);
    expect(readSkills(null)).toEqual([]);
    expect(readExperiences([{ kind: 'work', title: 'Công nhân may', from: '2020-13' }])).toEqual([]);
  });

  it('giấy tờ luôn đủ 5 mục theo thứ tự chuẩn', () => {
    const docs = readDocuments([{ key: 'passport', status: 'processing', note: 'hẹn 10/10' }]);
    expect(docs.map((d) => d.key)).toEqual(['cccd', 'photo', 'passport', 'criminal', 'health']);
    expect(docs[2]).toMatchObject({ status: 'processing', note: 'hẹn 10/10' });
    expect(docs[0]!.status).toBe('missing');
  });

  it('client không tự đặt được cờ đã xác nhận, kỹ năng cũ cùng tên giữ cờ', () => {
    const prev = [{ name: 'Khéo tay', level: 5, note: null, verified: true }];
    const next = mergeSkills(prev, [
      { name: 'khéo tay', level: 4, note: null },
      { name: 'Nấu ăn', level: 3, note: null },
    ]);
    expect(next.map((s) => s.verified)).toEqual([true, false]);
  });

  it('việc đang làm lên đầu, học vấn xuống cuối', () => {
    const base = { org: '', desc: '', tags: [] };
    const sorted = sortExperiences([
      { ...base, kind: 'education', title: 'THPT', from: '2014', to: '2017' },
      { ...base, kind: 'work', title: 'Bán hàng', from: '2018-08', to: '2020-02' },
      { ...base, kind: 'work', title: 'May', from: '2020-03', to: null },
    ]);
    expect(sorted.map((e) => e.title)).toEqual(['May', 'Bán hàng', 'THPT']);
  });
});
