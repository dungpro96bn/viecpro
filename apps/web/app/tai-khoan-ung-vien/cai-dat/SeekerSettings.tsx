'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_GROUP_LABEL,
  PHONE_VISIBILITY_LABEL,
  PHONE_VISIBILITIES,
  REPORT_STATUS_LABEL,
  type Locale,
  type MyReportItem,
  type NotificationChannel,
  type NotificationGroup,
  type Paginated,
  type SeekerProfile,
  type SeekerSettings as Settings,
  type SettingsUpdateInput,
  type Theme,
} from '@viecpro/shared';
import { useAuth } from '@/components/auth/AuthProvider';
import { useSeekerAccount } from '@/components/seeker/SeekerAccountProvider';
import Select from '@/components/ui/Select';
import Switch from '@/components/ui/Switch';
import { IconBell, IconDatabase, IconDownload, IconGlobe, IconShield, IconTrash } from '@/components/ui/Icons';
import { apiMessage, apiRequest } from '@/lib/api';
import { cx } from '@/lib/format';
import { downloadText } from '@/lib/seeker';
import AccountSection from './AccountSection';
import SettingsCard, { Segment, SettingRow } from './SettingsCard';

/** Nhóm hiện sẵn – 2 nhóm còn lại nằm sau "Xem thêm" như design */
const MAIN_GROUPS: NotificationGroup[] = ['interview', 'profile_view', 'job_match'];
const MORE_GROUPS: NotificationGroup[] = ['application', 'system'];
const CHANNEL_LABEL: Record<NotificationChannel, string> = { app: 'App', email: 'Email', sms: 'SMS' };
const LOCALES: ReadonlyArray<{ value: Locale; label: string }> = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
];
const THEMES: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
  { value: 'system', label: 'Hệ thống' },
];
/** Mốc giờ yên lặng: mỗi 30 phút */
const HALF_HOURS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

/** Cài đặt (design-new 05 – C-06) */
export default function SeekerSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiRequest<Settings>('/me/settings')
      .then(setSettings)
      .catch(() => setError('Không tải được cài đặt. Vui lòng tải lại trang.'));
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  /** Lưu ngay khi đổi (giao diện đổi trước, lỗi thì hoàn lại) */
  const save = useCallback(
    async (patch: SettingsUpdateInput, optimistic: (s: Settings) => Settings) => {
      if (!settings) return;
      const before = settings;
      setSettings(optimistic(settings));
      setError('');
      try {
        setSettings(await apiRequest<Settings>('/me/settings', { method: 'PATCH', body: JSON.stringify(patch) }));
        setSaved(true);
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaved(false), 2000);
      } catch (e) {
        setSettings(before);
        setError(apiMessage(e, 'Không lưu được cài đặt. Vui lòng thử lại.'));
      }
    },
    [settings],
  );

  if (!settings) {
    return (
      <div className="st">
        {error ? <p className="st-message st-message--error" role="alert">{error}</p> : <div className="st-skeleton" role="status">Đang tải cài đặt…</div>}
      </div>
    );
  }

  const setChannel = (group: NotificationGroup, channel: NotificationChannel, on: boolean) =>
    void save({ notifications: { [group]: { [channel]: on } } }, (s) => ({ ...s, notifications: { ...s.notifications, [group]: { ...s.notifications[group], [channel]: on } } }));
  const setQuiet = (patch: Partial<Settings['quietHours']>) => void save({ quietHours: patch }, (s) => ({ ...s, quietHours: { ...s.quietHours, ...patch } }));
  const groupRows = (groups: NotificationGroup[]) =>
    groups.map((g) => (
      <div key={g} className="st-matrix__row">
        <span className="st-row__text">
          <span className="st-row__label">{NOTIFICATION_GROUP_LABEL[g].title}</span>
          <span className="st-row__desc">{NOTIFICATION_GROUP_LABEL[g].desc}</span>
        </span>
        {NOTIFICATION_CHANNELS.map((ch) => (
          <span key={ch} className="st-matrix__cell">
            <Switch on={settings.notifications[g][ch]} onChange={(on) => setChannel(g, ch, on)} label={`${NOTIFICATION_GROUP_LABEL[g].title} qua ${CHANNEL_LABEL[ch]}`} />
          </span>
        ))}
      </div>
    ));

  return (
    <div className="st">
      <div className="st-head">
        <span>
          <h1 className="st-head__title">Cài đặt</h1>
          <p className="st-head__desc">Tài khoản, thông báo và quyền riêng tư của bạn</p>
        </span>
        <span className={cx('st-saved', saved && 'st-saved--on')} role="status" aria-live="polite">
          {saved ? 'Đã lưu' : ''}
        </span>
      </div>
      {error && <p className="st-message st-message--error" role="alert">{error}</p>}

      <AccountSection settings={settings} onChange={setSettings} />

      <SettingsCard
        id="thong-bao"
        icon={IconBell}
        tone="orange"
        title="Thông báo"
        desc="Chọn kênh nhận cho từng loại thông báo"
        moreLabel={`Xem thêm ${MORE_GROUPS.length} loại thông báo & giờ yên lặng`}
        more={
          <>
            <div className="st-matrix">{groupRows(MORE_GROUPS)}</div>
            <SettingRow
              label="Giờ yên lặng"
              desc="Không gửi thông báo đẩy và SMS trong khung giờ này (trừ mã OTP)"
              control={<Switch on={settings.quietHours.enabled} onChange={(enabled) => setQuiet({ enabled })} label="Bật giờ yên lặng" />}
            >
              {settings.quietHours.enabled && (
                <div className="st-quiet">
                  <span>Từ</span>
                  <Select className="field-input st-quiet__select" options={HALF_HOURS} value={settings.quietHours.from} onChange={(from) => setQuiet({ from })} aria-label="Bắt đầu giờ yên lặng" />
                  <span>đến</span>
                  <Select className="field-input st-quiet__select" options={HALF_HOURS} value={settings.quietHours.to} onChange={(to) => setQuiet({ to })} aria-label="Kết thúc giờ yên lặng" />
                </div>
              )}
            </SettingRow>
          </>
        }
      >
        <div className="st-matrix">
          <div className="st-matrix__head" aria-hidden="true">
            <span>Loại thông báo</span>
            {NOTIFICATION_CHANNELS.map((ch) => (
              <span key={ch}>{CHANNEL_LABEL[ch]}</span>
            ))}
          </div>
          {groupRows(MAIN_GROUPS)}
        </div>
      </SettingsCard>

      <SettingsCard id="quyen-rieng-tu" icon={IconShield} tone="green" title="Quyền riêng tư" desc="Kiểm soát ai thấy thông tin của bạn" moreLabel="Xem thêm: báo cáo vi phạm đã gửi" more={<MyReports />}>
        <SettingRow
          label="Cho phép nhà tuyển dụng tìm thấy hồ sơ"
          desc="Hồ sơ xuất hiện khi NTD đã xác minh tìm ứng viên"
          control={<Switch on={settings.privacy.discoverable} onChange={(discoverable) => void save({ discoverable }, (s) => ({ ...s, privacy: { ...s.privacy, discoverable } }))} label="Cho phép nhà tuyển dụng tìm thấy hồ sơ" />}
        />
        <SettingRow
          label="Hiển thị số điện thoại"
          desc="Ai được xem số điện thoại của bạn"
          control={
            <Segment
              label="Hiển thị số điện thoại"
              value={settings.privacy.phoneVisibility}
              options={PHONE_VISIBILITIES.map((v) => ({ value: v, label: PHONE_VISIBILITY_LABEL[v] }))}
              onChange={(phoneVisibility) => void save({ phoneVisibility }, (s) => ({ ...s, privacy: { ...s.privacy, phoneVisibility } }))}
            />
          }
        />
      </SettingsCard>

      <SettingsCard id="ngon-ngu" icon={IconGlobe} tone="teal" title="Ngôn ngữ & hiển thị" desc="Áp dụng trên mọi thiết bị" moreLabel="" more={null}>
        <SettingRow
          label="Ngôn ngữ"
          desc="Ngôn ngữ giao diện và email"
          control={<Segment label="Ngôn ngữ" value={settings.locale} options={LOCALES} onChange={(locale) => void save({ locale }, (s) => ({ ...s, locale }))} />}
        />
        <SettingRow
          label="Giao diện"
          desc="Sáng, tối hoặc theo hệ thống"
          control={<Segment label="Giao diện" value={settings.theme} options={THEMES} onChange={(theme) => void save({ theme }, (s) => ({ ...s, theme }))} />}
        />
        {/* Chưa có bản dịch ja / en và giao diện tối: hiện lưu lựa chọn để áp dụng khi phát hành (spec Phase 9) */}
        {(settings.locale !== 'vi' || settings.theme === 'dark') && <p className="st-hint">Đã lưu lựa chọn. Bản tiếng Nhật / tiếng Anh và giao diện tối sẽ áp dụng khi phát hành.</p>}
      </SettingsCard>

      <DataSection />
    </div>
  );
}

/** Báo cáo vi phạm tôi đã gửi (M18) – chỉ trạng thái và kết quả */
function MyReports() {
  const [items, setItems] = useState<MyReportItem[] | null>(null);
  useEffect(() => {
    apiRequest<Paginated<MyReportItem>>('/me/reports?page=1&limit=10')
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, []);
  if (!items) return <p className="st-hint">Đang tải…</p>;
  if (!items.length) return <SettingRow label="Báo cáo vi phạm đã gửi" desc="Bạn chưa gửi báo cáo nào." />;
  return (
    <SettingRow label="Báo cáo vi phạm đã gửi" desc="Người bị báo cáo không biết bạn là ai">
      <ul className="st-reports">
        {items.map((r) => (
          <li key={r.code}>
            <span>
              <b>{r.targetName}</b>
              <small>
                {r.code} · {r.reason} · {new Date(r.createdAt).toLocaleDateString('vi-VN')}
              </small>
              {r.outcome && <small className="st-reports__outcome">{r.outcome}</small>}
            </span>
            <span className={cx('st-badge', r.status === 'resolved' ? 'st-badge--ok' : r.status === 'dismissed' ? 'st-badge--muted' : 'st-badge--warn')}>{REPORT_STATUS_LABEL[r.status]}</span>
          </li>
        ))}
      </ul>
    </SettingRow>
  );
}

/** Dữ liệu & tài khoản: tải dữ liệu, tạm ẩn hồ sơ, xoá tài khoản */
function DataSection() {
  const { profile, setProfile } = useSeekerAccount();
  const { signOut } = useAuth();
  const [busy, setBusy] = useState<'' | 'export' | 'hide' | 'delete'>('');
  const [error, setError] = useState('');
  const hidden = !profile.lookingForJob && !profile.discoverable;

  const exportData = async () => {
    setBusy('export');
    setError('');
    try {
      const data = await apiRequest<unknown>('/me/export');
      downloadText(`viecpro-du-lieu-cua-toi-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
    } catch (e) {
      setError(apiMessage(e, 'Không tải được dữ liệu. Vui lòng thử lại sau.'));
    } finally {
      setBusy('');
    }
  };
  const toggleHidden = async (hide: boolean) => {
    setBusy('hide');
    setError('');
    try {
      setProfile(await apiRequest<SeekerProfile>('/me/profile', { method: 'PATCH', body: JSON.stringify({ lookingForJob: !hide, discoverable: !hide }) }));
    } catch (e) {
      setError(apiMessage(e));
    } finally {
      setBusy('');
    }
  };
  const remove = async () => {
    if (!window.confirm('Xoá tài khoản sẽ ẩn danh hồ sơ và đăng xuất mọi thiết bị. Hồ sơ ứng tuyển đã gửi được giữ theo chính sách bảo mật. Bạn chắc chắn muốn xoá?')) return;
    setBusy('delete');
    try {
      await apiRequest<void>('/me', { method: 'DELETE' });
      await signOut().catch(() => undefined);
      window.location.assign('/');
    } catch (e) {
      setError(apiMessage(e));
      setBusy('');
    }
  };

  return (
    <SettingsCard
      id="du-lieu"
      icon={IconDatabase}
      tone="red"
      title="Dữ liệu & tài khoản"
      desc="Tải dữ liệu, tạm ẩn hoặc xoá tài khoản"
      moreLabel="Xem tuỳ chọn"
      more={
        <>
          {error && <p className="st-form__error" role="alert">{error}</p>}
          <SettingRow
            label="Tải dữ liệu của tôi"
            desc="Hồ sơ, đơn ứng tuyển, việc đã lưu, thông báo – tệp JSON"
            control={
              <button type="button" className="st-btn" disabled={busy === 'export'} onClick={() => void exportData()}>
                <IconDownload size={15} />
                {busy === 'export' ? 'Đang chuẩn bị…' : 'Tải xuống'}
              </button>
            }
          />
          <SettingRow
            label="Tạm ẩn hồ sơ"
            desc="Ngừng tìm việc và ẩn hồ sơ khỏi nhà tuyển dụng – bật lại bất cứ lúc nào"
            control={<Switch on={hidden} disabled={busy === 'hide'} onChange={(on) => void toggleHidden(on)} label="Tạm ẩn hồ sơ" />}
          />
          <SettingRow
            label="Xoá tài khoản"
            desc="Ẩn danh thông tin cá nhân và đăng xuất mọi thiết bị. Không thể hoàn tác."
            control={
              <button type="button" className="st-btn st-btn--danger" disabled={busy === 'delete'} onClick={() => void remove()}>
                <IconTrash size={15} />
                Xoá tài khoản
              </button>
            }
          />
        </>
      }
    />
  );
}
