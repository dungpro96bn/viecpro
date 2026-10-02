'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminAccountItem, AdminAccountList, AdminAccountStatus, AdminMe, AdminRoleItem, AdminTemporaryPassword } from '@viecpro/shared';
import FilterSelect from '@/components/list/FilterSelect';
import Pagination from '@/components/list/Pagination';
import { avatarTone, dateTime, errorText, relativeTime } from '@/components/list/list-utils';
import { useDebounced } from '@/components/list/useDebounced';
import Dialog from '@/components/ui/Dialog';
import { IconKey, IconLock, IconRefresh, IconSearch, IconShieldCheck, IconUnlock, IconUserCheck, IconWorkers } from '@/components/ui/Icons';
import { api, post } from '@/lib/api';
import { cx, formatNumber, initials } from '@/lib/format';
import FormDialog from './FormDialog';
import { canGrant } from './PermissionsView';
import TempPasswordDialog from './TempPasswordDialog';

const PAGE_SIZE = 20;
const STATUS_TABS: Array<{ key: AdminAccountStatus; label: string; stat?: 'total' | 'active' | 'locked' | 'mfaPending' }> = [
  { key: 'all', label: 'Tất cả', stat: 'total' },
  { key: 'active', label: 'Đang hoạt động', stat: 'active' },
  { key: 'mfa_pending', label: 'Chưa bật 2FA', stat: 'mfaPending' },
  { key: 'locked', label: 'Đã khoá', stat: 'locked' },
];

type Action = { kind: 'create' } | { kind: 'role' | 'lock' | 'unlock' | 'mfa' | 'password'; target: AdminAccountItem };

export default function AdminsTab({ me, roles, onRolesChanged }: { me: AdminMe | null; roles: AdminRoleItem[]; onRolesChanged: () => void }) {
  const [status, setStatus] = useState<AdminAccountStatus>('all');
  const [roleId, setRoleId] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminAccountList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ name: string; email: string; password: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const p = new URLSearchParams({ status, page: String(page), limit: String(PAGE_SIZE) });
      if (roleId) p.set('roleId', roleId);
      if (q) p.set('q', q);
      setData(await api<AdminAccountList>(`/admin/admins?${p.toString()}`));
    } catch (e) {
      setError(errorText(e));
    }
  }, [status, roleId, q, page]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => setPage(1), [q]);

  const open = (a: Action) => {
    setActionError(null);
    setAction(a);
  };
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setActionError(null);
    try {
      const result = await fn();
      setAction(null);
      setNotice(done);
      const temp = result as Partial<AdminTemporaryPassword> | null;
      if (temp?.temporaryPassword && temp.admin) setSecret({ name: temp.admin.name, email: temp.admin.email, password: temp.temporaryPassword });
      await load();
      onRolesChanged();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const roleOptions = [{ value: '', label: 'Tất cả' }, ...roles.map((r) => ({ value: r.id, label: r.name }))];
  const grantable = roles.filter((r) => canGrant(me, r));
  const target = action && action.kind !== 'create' ? action.target : null;

  return (
    <>
      {error && <p className="alert alert--danger" role="alert">{error}</p>}
      {notice && (
        <p className="alert alert--info" role="status">
          {notice}
        </p>
      )}
      <section className="list-card" aria-label="Quản trị viên">
        <div className="tabs" role="tablist" aria-label="Trạng thái quản trị viên">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={status === t.key}
              className={cx('tabs__item', status === t.key && 'tabs__item--active')}
              onClick={() => {
                setStatus(t.key);
                setPage(1);
              }}
            >
              {t.label}
              <span className="tabs__count">{data && t.stat ? formatNumber(data.stats[t.stat]) : '…'}</span>
            </button>
          ))}
        </div>
        <div className="filters">
          <FilterSelect
            label="Vai trò"
            value={roleId}
            options={roleOptions}
            onChange={(v) => {
              setRoleId(v);
              setPage(1);
            }}
          />
          <label className="list-search pq-search">
            <IconSearch size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tên hoặc email…" aria-label="Tìm quản trị viên" />
          </label>
          <span className="filters__end">
            <button type="button" className="btn btn--primary btn--sm" onClick={() => open({ kind: 'create' })}>
              <IconUserCheck size={15} />
              Thêm quản trị viên
            </button>
          </span>
        </div>

        <div className="dtable-wrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>Quản trị viên</th>
                <th>Vai trò</th>
                <th>Bảo mật</th>
                <th>Đăng nhập gần nhất</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {!data
                ? Array.from({ length: 4 }, (_, i) => (
                    <tr key={i}>
                      <td colSpan={5}>
                        <span className="skeleton dtable__skeleton" />
                      </td>
                    </tr>
                  ))
                : data.items.map((a) => <AdminRow key={a.id} a={a} manageable={!a.isSelf && canGrant(me, { key: a.role.key, permissions: roles.find((r) => r.id === a.role.id)?.permissions ?? [] })} onAction={(kind) => open({ kind, target: a })} />)}
            </tbody>
          </table>
          {data && !data.items.length && (
            <div className="list-empty">
              <IconWorkers size={26} />
              <b>Không có quản trị viên phù hợp</b>
              Thử bỏ bớt bộ lọc hoặc đổi từ khoá.
            </div>
          )}
        </div>
        {data && <Pagination page={data.page} limit={data.limit} total={data.total} unit="quản trị viên" onPage={setPage} />}
      </section>

      <CreateAdminDialog
        open={action?.kind === 'create'}
        roles={grantable}
        busy={busy}
        error={actionError}
        onClose={() => setAction(null)}
        onSubmit={(body) => void run(() => post<AdminTemporaryPassword>('/admin/admins', body), `Đã tạo tài khoản ${body.email}.`)}
      />
      <ChangeRoleDialog
        target={action?.kind === 'role' ? action.target : null}
        roles={grantable}
        busy={busy}
        error={actionError}
        onClose={() => setAction(null)}
        onSubmit={(id, body) => void run(() => post(`/admin/admins/${id}/role`, body), 'Đã đổi vai trò. Người đó đã bị đăng xuất khỏi mọi thiết bị.')}
      />
      <Dialog
        open={action?.kind === 'lock'}
        title={`Khoá ${target?.name ?? ''}`}
        description="Tài khoản bị đăng xuất khỏi mọi thiết bị và không đăng nhập được cho tới khi mở khoá."
        input={{ label: 'Lý do khoá', placeholder: 'vd. Nghỉ việc, nghi lộ mật khẩu…', required: true, minLength: 5 }}
        otp
        confirmLabel="Khoá tài khoản"
        tone="danger"
        busy={busy}
        error={actionError}
        onClose={() => setAction(null)}
        onConfirm={(reason, otp) => target && void run(() => post(`/admin/admins/${target.id}/lock`, { reason, ...(otp && { otp }) }), `Đã khoá ${target.name}.`)}
      />
      <Dialog
        open={action?.kind === 'unlock'}
        title={`Mở khoá ${target?.name ?? ''}`}
        description="Người này đăng nhập lại được bằng mật khẩu và 2FA hiện có."
        confirmLabel="Mở khoá"
        busy={busy}
        error={actionError}
        onClose={() => setAction(null)}
        onConfirm={() => target && void run(() => post(`/admin/admins/${target.id}/unlock`), `Đã mở khoá ${target.name}.`)}
      />
      <Dialog
        open={action?.kind === 'mfa'}
        title={`Đặt lại 2FA cho ${target?.name ?? ''}`}
        description="Dùng khi người này mất điện thoại. Khoá 2FA và mã khôi phục cũ bị xoá, lần đăng nhập sau phải quét QR lại."
        otp
        confirmLabel="Đặt lại 2FA"
        tone="warning"
        busy={busy}
        error={actionError}
        onClose={() => setAction(null)}
        onConfirm={(_, otp) => target && void run(() => post(`/admin/admins/${target.id}/reset-mfa`, otp ? { otp } : {}), `Đã đặt lại 2FA cho ${target.name}.`)}
      />
      <Dialog
        open={action?.kind === 'password'}
        title={`Cấp mật khẩu tạm cho ${target?.name ?? ''}`}
        description="Mật khẩu cũ mất hiệu lực và người này bị đăng xuất khỏi mọi thiết bị."
        otp
        confirmLabel="Cấp mật khẩu tạm"
        tone="warning"
        busy={busy}
        error={actionError}
        onClose={() => setAction(null)}
        onConfirm={(_, otp) => target && void run(() => post<AdminTemporaryPassword>(`/admin/admins/${target.id}/reset-password`, otp ? { otp } : {}), `Đã cấp mật khẩu tạm cho ${target.name}.`)}
      />
      <TempPasswordDialog value={secret} onClose={() => setSecret(null)} />
    </>
  );
}

function AdminRow({ a, manageable, onAction }: { a: AdminAccountItem; manageable: boolean; onAction: (kind: 'role' | 'lock' | 'unlock' | 'mfa' | 'password') => void }) {
  return (
    <tr>
      <td data-label="Quản trị viên">
        <span className="who">
          <span className={cx('avatar', `avatar--${avatarTone(a.id)}`)}>{initials(a.name)}</span>
          <span className="who__text">
            <span className="who__name">
              {a.name}
              {a.isSelf && <span className="mini-tag mini-tag--blue">Bạn</span>}
            </span>
            <span className="who__sub">{a.email}</span>
          </span>
        </span>
      </td>
      <td data-label="Vai trò">
        <span className="cell__main">{a.role.name}</span>
      </td>
      <td data-label="Bảo mật">
        {a.lockedAt ? (
          <span className="status status--red" title={a.lockReason ?? undefined}>
            Đã khoá
          </span>
        ) : a.mfaEnabled ? (
          <span className="status status--green">Đã bật 2FA</span>
        ) : (
          <span className="status status--orange">Chưa bật 2FA</span>
        )}
      </td>
      <td data-label="Đăng nhập gần nhất">
        <span className="cell">
          <span className="cell__main">{relativeTime(a.lastLoginAt)}</span>
          <span className="cell__sub">Tạo {dateTime(a.createdAt)}</span>
        </span>
      </td>
      <td data-label="Thao tác">
        {manageable ? (
          <span className="pq-actions">
            <button type="button" className="row-btn" onClick={() => onAction('role')}>
              <IconKey size={13} />
              Vai trò
            </button>
            {a.lockedAt ? (
              <button type="button" className="row-btn" onClick={() => onAction('unlock')}>
                <IconUnlock size={13} />
                Mở khoá
              </button>
            ) : (
              <button type="button" className="row-btn pq-danger" onClick={() => onAction('lock')}>
                <IconLock size={13} />
                Khoá
              </button>
            )}
            <button type="button" className="row-btn" onClick={() => onAction('mfa')} title="Đặt lại xác thực 2 bước">
              <IconShieldCheck size={13} />
              2FA
            </button>
            <button type="button" className="row-btn" onClick={() => onAction('password')} title="Cấp mật khẩu tạm mới">
              <IconRefresh size={13} />
              Mật khẩu
            </button>
          </span>
        ) : (
          <span className="cell__sub">{a.isSelf ? 'Tài khoản của bạn' : 'Cần quyền cao hơn'}</span>
        )}
      </td>
    </tr>
  );
}

function RoleSelect({ roles, value, onChange }: { roles: AdminRoleItem[]; value: string; onChange: (id: string) => void }) {
  return (
    <label className="field">
      <span className="field__label">Vai trò</span>
      <select className="field__input" value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="" disabled>
          Chọn vai trò…
        </option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} · {r.permissions.length} quyền
          </option>
        ))}
      </select>
    </label>
  );
}

function CreateAdminDialog({ open, roles, busy, error, onClose, onSubmit }: { open: boolean; roles: AdminRoleItem[]; busy: boolean; error: string | null; onClose: () => void; onSubmit: (body: { name: string; email: string; roleId: string; otp?: string }) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setRoleId('');
  }, [open]);
  return (
    <FormDialog
      open={open}
      title="Thêm quản trị viên"
      description="Hệ thống tạo mật khẩu tạm (hiện 1 lần). Người nhận phải bật xác thực 2 bước ở lần đăng nhập đầu."
      confirmLabel="Tạo tài khoản"
      otp
      busy={busy}
      error={error}
      disabled={name.trim().length < 2 || !email.includes('@') || !roleId}
      onClose={onClose}
      onSubmit={(otp) => onSubmit({ name: name.trim(), email: email.trim(), roleId, ...(otp && { otp }) })}
    >
      <label className="field">
        <span className="field__label">Họ và tên</span>
        <input className="field__input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <label className="field">
        <span className="field__label">Email đăng nhập</span>
        <input className="field__input" type="email" value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <RoleSelect roles={roles} value={roleId} onChange={setRoleId} />
    </FormDialog>
  );
}

function ChangeRoleDialog({ target, roles, busy, error, onClose, onSubmit }: { target: AdminAccountItem | null; roles: AdminRoleItem[]; busy: boolean; error: string | null; onClose: () => void; onSubmit: (id: string, body: { roleId: string; otp?: string }) => void }) {
  const [roleId, setRoleId] = useState('');
  useEffect(() => setRoleId(target?.role.id ?? ''), [target]);
  return (
    <FormDialog
      open={!!target}
      title={`Đổi vai trò của ${target?.name ?? ''}`}
      description="Người này sẽ bị đăng xuất khỏi mọi thiết bị để nhận quyền mới."
      confirmLabel="Đổi vai trò"
      otp
      busy={busy}
      error={error}
      disabled={!roleId || roleId === target?.role.id}
      onClose={onClose}
      onSubmit={(otp) => target && onSubmit(target.id, { roleId, ...(otp && { otp }) })}
    >
      <RoleSelect roles={roles} value={roleId} onChange={setRoleId} />
    </FormDialog>
  );
}
