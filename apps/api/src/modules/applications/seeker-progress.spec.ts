import { describe, expect, it } from 'vitest';
import { buildSteps, inviteRate } from './seeker-progress.js';

const d = (day: number) => new Date(Date.UTC(2026, 8, day));
const ev = (...list: Array<[Parameters<typeof buildSteps>[0], number]>) => list.map(([status, day]) => ({ status, createdAt: d(day) }));

describe('buildSteps', () => {
  it('đang chờ phỏng vấn: bước phỏng vấn là current, ngày = giờ hẹn', () => {
    const steps = buildSteps('interview', ev(['submitted', 25], ['viewed', 26], ['interview', 29]), d(30));
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'current', 'todo', 'todo']);
    expect(steps[2]!.at).toBe(d(30).toISOString());
  });

  it('trúng tuyển: tới bước trúng tuyển đều xong, xuất cảnh còn chờ', () => {
    const steps = buildSteps('passed', ev(['submitted', 2], ['viewed', 3], ['interview', 15], ['passed', 22]), null);
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'todo']);
  });

  it('bị loại sau khi cán bộ xem: bước "cán bộ xem" là failed', () => {
    const steps = buildSteps('rejected', ev(['submitted', 12], ['viewed', 13], ['rejected', 13]), null);
    expect(steps.map((s) => s.state)).toEqual(['done', 'failed', 'todo', 'todo', 'todo']);
    expect(steps[1]!.at).toBe(d(13).toISOString());
  });

  it('mới gửi: bước đầu là current', () => {
    expect(buildSteps('submitted', ev(['submitted', 28]), null).map((s) => s.state)).toEqual(['current', 'todo', 'todo', 'todo', 'todo']);
  });
});

describe('inviteRate', () => {
  it('tính cả hồ sơ từng có lịch phỏng vấn, bỏ hồ sơ đã rút', () => {
    const apps = [
      { status: 'interview' as const, events: [] },
      { status: 'rejected' as const, events: [{ status: 'interview' as const }] },
      { status: 'viewed' as const, events: [] },
      { status: 'submitted' as const, events: [] },
      { status: 'withdrawn' as const, events: [] },
    ];
    expect(inviteRate(apps)).toBe(50);
    expect(inviteRate([])).toBeNull();
  });
});
