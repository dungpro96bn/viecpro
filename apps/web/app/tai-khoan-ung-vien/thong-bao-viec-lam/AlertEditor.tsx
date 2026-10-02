'use client';

import { useState, type FormEvent } from 'react';
import {
  ALERT_CHANNEL_LABEL,
  ALERT_CHANNELS,
  ALERT_FREQUENCIES,
  ALERT_FREQUENCY_LABEL,
  GENDERS,
  GENDER_LABEL,
  INDUSTRIES,
  PREFECTURES_BY_REGION,
  PROGRAM_LABEL,
  PROGRAMS,
  REGION_LABEL,
  REGIONS,
  type AlertChannel,
  type AlertFrequency,
  type JobAlertCriteria,
  type JobAlertInput,
} from '@viecpro/shared';
import Select from '@/components/ui/Select';
import { IconClose } from '@/components/ui/Icons';
import { cx, formatYen } from '@/lib/format';

/** Mốc "Lương từ" (spec 12.1) */
const SALARY_STEPS = [170_000, 190_000, 210_000, 250_000] as const;
/** SMS cho thông báo việc làm chưa có nhà cung cấp – tạm khoá trên giao diện */
const DISABLED_CHANNELS: AlertChannel[] = ['sms'];

export const EMPTY_CRITERIA: JobAlertCriteria = { industries: [], prefs: [], regions: [], programs: [], salaryMin: null, freeOnly: false, gender: null };

export interface AlertDraft {
  name: string;
  criteria: JobAlertCriteria;
  channels: AlertChannel[];
  frequency: AlertFrequency;
}

interface Props {
  initial: AlertDraft;
  submitLabel: string;
  busy: boolean;
  /** Lỗi từ API theo trường (fields) */
  errors: Record<string, string>;
  onSubmit: (input: JobAlertInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/** Form tạo / sửa thông báo việc làm – tiêu chí, kênh nhận, tần suất */
export default function AlertEditor({ initial, submitLabel, busy, errors, onSubmit, onCancel, onDelete }: Props) {
  const [draft, setDraft] = useState<AlertDraft>(initial);
  const [localError, setLocalError] = useState('');
  const c = draft.criteria;
  const setCriteria = (patch: Partial<JobAlertCriteria>) => setDraft((d) => ({ ...d, criteria: { ...d.criteria, ...patch } }));

  // Tỉnh gợi ý theo vùng đã chọn (chưa chọn vùng → mọi tỉnh)
  const prefOptions = (c.regions.length ? c.regions : REGIONS)
    .flatMap((r) => PREFECTURES_BY_REGION[r])
    .filter((p) => !c.prefs.includes(p));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.channels.length) return setLocalError('Chọn ít nhất 1 kênh nhận');
    setLocalError('');
    onSubmit({ name: draft.name.trim() || undefined, criteria: draft.criteria, channels: draft.channels, frequency: draft.frequency, enabled: true });
  };
  const channelError = localError || errors.channels;

  return (
    <form className="ja-editor" noValidate onSubmit={submit}>
      <label className="ja-editor__field">
        <span className="ja-editor__label">Tên thông báo</span>
        <input
          className="field-input"
          value={draft.name}
          maxLength={60}
          placeholder="Bỏ trống để hệ thống tự đặt, vd. “Điện tử · Kanto”"
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
      </label>

      <fieldset className="ja-editor__group">
        <legend className="ja-editor__label">Ngành nghề</legend>
        <div className="ja-chips">
          {INDUSTRIES.map((i) => (
            <button key={i} type="button" aria-pressed={c.industries.includes(i)} className={cx('ja-chip', c.industries.includes(i) && 'ja-chip--on')} onClick={() => setCriteria({ industries: toggle(c.industries, i) })}>
              {i}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="ja-editor__group">
        <legend className="ja-editor__label">Khu vực</legend>
        <div className="ja-chips">
          {REGIONS.map((r) => (
            <button key={r} type="button" aria-pressed={c.regions.includes(r)} className={cx('ja-chip', c.regions.includes(r) && 'ja-chip--on')} onClick={() => setCriteria({ regions: toggle(c.regions, r) })}>
              {REGION_LABEL[r]}
            </button>
          ))}
        </div>
        <div className="ja-editor__prefs">
          <Select className="field-input ja-editor__select" options={prefOptions} value="" placeholder="Thêm tỉnh cụ thể…" aria-label="Thêm tỉnh" onChange={(p) => p && setCriteria({ prefs: [...c.prefs, p] })} />
          {c.prefs.map((p) => (
            <span key={p} className="ja-chip ja-chip--on ja-chip--removable">
              {p}
              <button type="button" aria-label={`Bỏ ${p}`} onClick={() => setCriteria({ prefs: c.prefs.filter((x) => x !== p) })}>
                <IconClose size={12} />
              </button>
            </span>
          ))}
        </div>
        <small className="ja-editor__hint">Không chọn vùng / tỉnh nào = toàn Nhật Bản</small>
      </fieldset>

      <fieldset className="ja-editor__group">
        <legend className="ja-editor__label">Chương trình</legend>
        <div className="ja-chips">
          {PROGRAMS.map((p) => (
            <button key={p} type="button" aria-pressed={c.programs.includes(p)} className={cx('ja-chip', c.programs.includes(p) && 'ja-chip--on')} onClick={() => setCriteria({ programs: toggle(c.programs, p) })}>
              {PROGRAM_LABEL[p]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="ja-editor__row">
        <fieldset className="ja-editor__group">
          <legend className="ja-editor__label">Lương cơ bản từ</legend>
          <div className="ja-segment" role="radiogroup" aria-label="Lương cơ bản từ">
            {[null, ...SALARY_STEPS].map((v) => (
              <button key={v ?? 'any'} type="button" role="radio" aria-checked={c.salaryMin === v} className={cx('ja-segment__item', c.salaryMin === v && 'ja-segment__item--on')} onClick={() => setCriteria({ salaryMin: v })}>
                {v ? formatYen(v) : 'Bất kỳ'}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="ja-editor__row">
        <fieldset className="ja-editor__group">
          <legend className="ja-editor__label">Phí xuất cảnh</legend>
          <div className="ja-segment" role="radiogroup" aria-label="Phí xuất cảnh">
            {[false, true].map((free) => (
              <button key={String(free)} type="button" role="radio" aria-checked={c.freeOnly === free} className={cx('ja-segment__item', c.freeOnly === free && 'ja-segment__item--on')} onClick={() => setCriteria({ freeOnly: free })}>
                {free ? 'Chỉ đơn miễn phí' : 'Bất kỳ'}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="ja-editor__group">
          <legend className="ja-editor__label">Giới tính</legend>
          <div className="ja-segment" role="radiogroup" aria-label="Giới tính">
            {[null, ...GENDERS].map((g) => (
              <button key={g ?? 'any'} type="button" role="radio" aria-checked={c.gender === g} className={cx('ja-segment__item', c.gender === g && 'ja-segment__item--on')} onClick={() => setCriteria({ gender: g })}>
                {g ? GENDER_LABEL[g] : 'Bất kỳ'}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <fieldset className="ja-editor__group">
        <legend className="ja-editor__label">
          Kênh nhận <span className="ja-editor__req">*</span>
        </legend>
        <div className="ja-chips" aria-describedby={channelError ? 'ja-channel-error' : undefined}>
          {ALERT_CHANNELS.map((ch) => {
            const disabled = DISABLED_CHANNELS.includes(ch);
            const on = draft.channels.includes(ch);
            return (
              <button
                key={ch}
                type="button"
                aria-pressed={on}
                disabled={disabled}
                className={cx('ja-chip', on && 'ja-chip--on')}
                onClick={() => {
                  setLocalError('');
                  setDraft((d) => ({ ...d, channels: toggle(d.channels, ch) }));
                }}
              >
                {ALERT_CHANNEL_LABEL[ch]}
                {disabled && ' (sắp có)'}
              </button>
            );
          })}
        </div>
        {channelError && (
          <span id="ja-channel-error" className="ja-editor__error" role="alert">
            {channelError}
          </span>
        )}
      </fieldset>

      <fieldset className="ja-editor__group">
        <legend className="ja-editor__label">Tần suất</legend>
        <div className="ja-segment ja-segment--wrap" role="radiogroup" aria-label="Tần suất">
          {ALERT_FREQUENCIES.map((f) => (
            <button key={f} type="button" role="radio" aria-checked={draft.frequency === f} className={cx('ja-segment__item', draft.frequency === f && 'ja-segment__item--on')} onClick={() => setDraft((d) => ({ ...d, frequency: f }))}>
              {ALERT_FREQUENCY_LABEL[f]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="ja-editor__actions">
        {onDelete && (
          <button type="button" className="ja-editor__delete" onClick={onDelete} disabled={busy}>
            Xoá thông báo
          </button>
        )}
        <span className="ja-editor__spacer" />
        <button type="button" className="btn btn--outline btn--md" onClick={onCancel} disabled={busy}>
          Huỷ
        </button>
        <button type="submit" className="btn btn--primary btn--md" disabled={busy}>
          {busy ? 'Đang lưu…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
