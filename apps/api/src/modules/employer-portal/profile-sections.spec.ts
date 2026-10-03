import { companyProfileSectionsSchema, recruiterProfileSectionsSchema } from '@viecpro/shared';
import { mergeSections, readSections } from './profile-sections.js';

describe('profile-sections', () => {
  it('đọc khối hợp lệ, khối hỏng thành rỗng, bỏ khối admin quản lý', () => {
    const stored = {
      stats: [['8 năm', 'Kinh nghiệm']],
      fields: 'không phải mảng',
      timeline: [{ when: '2021', title: 'TTS', desc: '' }],
      checks: [{ title: 'Đã xác minh số điện thoại', ok: true }],
    };
    const read = readSections(recruiterProfileSectionsSchema, stored);
    expect(read.stats).toEqual([['8 năm', 'Kinh nghiệm']]);
    expect(read.fields).toEqual([]);
    expect(read.timeline).toHaveLength(1);
    expect(read).not.toHaveProperty('checks');
    expect(readSections(companyProfileSectionsSchema, null)).toEqual({ stats: [], values: [], offices: [], fields: [] });
  });

  it('ghi đè khối sửa được, giữ legal / checks do admin quản lý', () => {
    const merged = mergeSections({ legal: [['Mã số thuế', '0101']], stats: [['1', 'cũ']] }, { stats: [['2', 'mới']], fields: ['BPO'] });
    expect(merged).toEqual({ legal: [['Mã số thuế', '0101']], stats: [['2', 'mới']], fields: ['BPO'] });
  });

  it('chặn khách gửi khối không cho phép qua schema (zod bỏ trường lạ)', () => {
    const parsed = companyProfileSectionsSchema.parse({ stats: [], legal: [['Giả', 'mạo']] });
    expect(parsed).not.toHaveProperty('legal');
  });
});
