'use client';

import { useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { IconCamera, IconCloseSmall, IconPlus, IconTrash, IconUpload } from '@/components/ui/Icons';
import { apiMessage } from '@/lib/api';
import { cx } from '@/lib/format';
import { uploadAsset } from '@/lib/upload';

/** Danh sách thẻ ngắn: nhập rồi Enter để thêm */
export function TagsEditor({ values, onChange, max, maxLength = 40, placeholder, label }: { values: string[]; onChange: (v: string[]) => void; max: number; maxLength?: number; placeholder: string; label: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v) && values.length < max) onChange([...values, v]);
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && !draft && values.length) onChange(values.slice(0, -1));
  };
  return (
    <span className="ef-tags">
      {values.map((v) => (
        <span key={v} className="ef-tag">
          {v}
          <button type="button" className="ef-tag__remove" aria-label={`Bỏ ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
            <IconCloseSmall size={12} />
          </button>
        </span>
      ))}
      {values.length < max && (
        <input className="ef-tags__input" value={draft} maxLength={maxLength} placeholder={placeholder} aria-label={label} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={add} />
      )}
    </span>
  );
}

/** Ô số nổi bật: ["15+", "Năm kinh nghiệm"] */
export function StatsEditor({ rows, onChange, max }: { rows: Array<[string, string]>; onChange: (v: Array<[string, string]>) => void; max: number }) {
  const set = (i: number, j: 0 | 1, value: string) => onChange(rows.map((r, k) => (k === i ? ((j === 0 ? [value, r[1]] : [r[0], value]) as [string, string]) : r)));
  return (
    <div className="ps-list">
      {rows.map((r, i) => (
        <div key={i} className="ps-row ps-row--stat">
          <input className="ef-input" value={r[0]} maxLength={20} placeholder="vd. 480+" aria-label={`Con số ${i + 1}`} onChange={(e) => set(i, 0, e.target.value)} />
          <input className="ef-input" value={r[1]} maxLength={40} placeholder="vd. Lao động đã bay" aria-label={`Nhãn ${i + 1}`} onChange={(e) => set(i, 1, e.target.value)} />
          <RemoveButton onClick={() => onChange(rows.filter((_, k) => k !== i))} />
        </div>
      ))}
      {rows.length < max && <AddButton label="Thêm con số" onClick={() => onChange([...rows, ['', '']])} />}
    </div>
  );
}

export interface ItemField<T> {
  key: keyof T & string;
  label: string;
  max: number;
  multiline?: boolean;
  placeholder?: string;
}

/** Danh sách mục có nhiều trường: giá trị, quá trình làm việc, chứng chỉ */
export function ItemsEditor<T extends Record<string, string>>({ items, onChange, fields, max, empty, addLabel }: { items: T[]; onChange: (v: T[]) => void; fields: Array<ItemField<T>>; max: number; empty: T; addLabel: string }) {
  const set = (i: number, key: keyof T, value: string) => onChange(items.map((it, k) => (k === i ? { ...it, [key]: value } : it)));
  return (
    <div className="ps-list">
      {items.map((it, i) => (
        <div key={i} className="ps-item">
          <div className="ps-item__fields">
            {fields.map((f) =>
              f.multiline ? (
                <textarea key={f.key} className="ef-input ps-textarea" rows={2} value={it[f.key]} maxLength={f.max} placeholder={f.placeholder ?? f.label} aria-label={`${f.label} ${i + 1}`} onChange={(e) => set(i, f.key, e.target.value)} />
              ) : (
                <input key={f.key} className="ef-input" value={it[f.key]} maxLength={f.max} placeholder={f.placeholder ?? f.label} aria-label={`${f.label} ${i + 1}`} onChange={(e) => set(i, f.key, e.target.value)} />
              ),
            )}
          </div>
          <RemoveButton onClick={() => onChange(items.filter((_, k) => k !== i))} />
        </div>
      ))}
      {items.length < max && <AddButton label={addLabel} onClick={() => onChange([...items, { ...empty }])} />}
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="emp-btn emp-btn--sm ps-add" onClick={onClick}>
      <IconPlus size={14} />
      {label}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="ps-remove" aria-label="Xoá dòng này" onClick={onClick}>
      <IconTrash size={15} />
    </button>
  );
}

/** Ảnh hồ sơ: xem trước + tải lên (/me/assets) + gỡ ảnh. Gọi onChange(path, url) sau khi tải xong */
export function ImageField({ url, shape, hint, onChange }: { url: string | null; shape: 'round' | 'square' | 'wide'; hint: string; onChange: (path: string | null, url: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const { assetPath, assetUrl } = await uploadAsset(file, 'image');
      onChange(assetPath, assetUrl);
    } catch (err) {
      setError(apiMessage(err, err instanceof Error ? err.message : 'Không tải được ảnh.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={cx('ps-image', `ps-image--${shape}`)}>
      <span className="ps-image__preview">{url ? <img src={url} alt="" /> : <IconCamera size={22} />}</span>
      <span className="ps-image__side">
        <span className="ps-image__actions">
          <label className={cx('emp-btn emp-btn--sm', busy && 'ps-busy')}>
            <IconUpload size={14} />
            {busy ? 'Đang tải…' : url ? 'Đổi ảnh' : 'Tải ảnh lên'}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy} onChange={(e) => void pick(e)} />
          </label>
          {url && !busy && (
            <button type="button" className="emp-btn emp-btn--sm" onClick={() => onChange(null, null)}>
              Gỡ ảnh
            </button>
          )}
        </span>
        <small className="ef-field__hint">{hint}</small>
        {error && (
          <small className="ef-field__error" role="alert">
            {error}
          </small>
        )}
      </span>
    </div>
  );
}
