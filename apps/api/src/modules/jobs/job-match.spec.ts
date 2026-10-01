import { matchJob, type MatchJob, type MatchProfile } from './job-match.js';

const profile: MatchProfile = { birthYear: 1999, gender: 'nu', programs: ['tts'], industries: ['Chế biến thực phẩm'], prefs: ['Hokkaido'] };
const job: MatchJob = { birthYearFrom: 1992, birthYearTo: 2006, gender: 'nu', program: 'tts', industry: 'Chế biến thực phẩm', pref: 'Hokkaido', tags: [] };

describe('matchJob', () => {
  it('cho điểm tối đa khi khớp mọi tiêu chí', () => {
    const { score, reasons } = matchJob(profile, job);
    expect(score).toBe(100);
    expect(reasons).toEqual(['Hợp tuổi', 'Tuyển nữ']);
  });

  it('hạ điểm mạnh khi sai giới tính', () => {
    expect(matchJob(profile, { ...job, gender: 'nam' }).score).toBeLessThan(70);
  });

  it('hạ điểm khi ngoài độ tuổi', () => {
    expect(matchJob({ ...profile, birthYear: 1980 }, job).score).toBeLessThan(matchJob(profile, job).score - 40);
  });

  it('hồ sơ trống vẫn có điểm nền', () => {
    const empty: MatchProfile = { birthYear: null, gender: null, programs: [], industries: [], prefs: [] };
    expect(matchJob(empty, job).score).toBe(40);
  });
});
