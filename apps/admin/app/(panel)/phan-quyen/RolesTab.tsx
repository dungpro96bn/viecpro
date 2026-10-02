'use client';

import { useEffect, useState } from 'react';
import { ADMIN_PERMISSION_LABEL, ADMIN_PERMISSIONS, SUPER_ADMIN_ROLE, type AdminMe, type AdminPermission, type AdminRoleItem } from '@viecpro/shared';
import { errorText } from '@/components/list/list-utils';
import Dialog from '@/components/ui/Dialog';
import { IconKey } from '@/components/ui/Icons';
import { api, post } from '@/lib/api';
import { cx } from '@/lib/format';
import FormDialog from './FormDialog';
import { canGrant } from './PermissionsView';

/** Nhóm quyền theo tiền tố để dễ chọn */
const GROUP_LABEL: Record<string, string> = {
  dashboard: 'Tổng quan',
  users: 'Tài khoản người dùng',
  employers: 'Nhà tuyển dụng',
  jobs: 'Đơn hàng',
  applications: 'Hồ sơ ứng tuyển',
  leads: 'Khách cần tư vấn',
  content: 'Nội dung',
  notifications: 'Thông báo',
  admins: 'Quản trị viên',
  audit: 'Nhật ký',
  settings: 'Cài đặt',
  data: 'Dữ liệu',
};
const GROUPS = Object.entries(
  ADMIN_PERMISSIONS.reduce<Record<string, AdminPermission[]>>((acc, p) => {
    (acc[p.split('.')[0]!] ??= []).push(p);
    return acc;
  }, {}),
);
/** Quyền cho phép xem dữ liệu cá nhân / thao tác rộng – đánh dấu để cân nhắc khi cấp */
const SENSITIVE: AdminPermission[] = ['users.pii', 'users.lock', 'admins.manage', 'data.export', 'notifications.send', 'settings.manage'];

type Editing = { mode: 'create' } | { mode: 'edit'; role: AdminRoleItem };

export default function RolesTab({ me, roles, onChanged }: { me: AdminMe | null; roles: AdminRoleItem[] | null; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<AdminRoleItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setEditing(null);
      setRemoving(null);
      setNotice(done);
      await onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {notice && (
        <p className="alert alert--info" role="status">
          {notice}
        </p>
      )}
      <div className="pq-toolbar">
        <p className="pq-hint">Quyền được gán qua vai trò. Đổi quyền của một vai trò sẽ đăng xuất mọi quản trị viên đang giữ vai trò đó.</p>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => {
            setError(null);
            setEditing({ mode: 'create' });
          }}
        >
          <IconKey size={15} />
          Tạo vai trò
        </button>
      </div>

      <div className="pq-roles">
        {!roles
          ? Array.from({ length: 3 }, (_, i) => <span key={i} className="skeleton pq-role-skeleton" />)
          : roles.map((r) => {
              const editable = r.key !== SUPER_ADMIN_ROLE && canGrant(me, r) && r.key !== me?.role.key;
              return (
                <article key={r.id} className="panel pq-role">
                  <header className="pq-role__head">
                    <span>
                      <b className="pq-role__name">{r.name}</b>
                      <span className="pq-role__meta">
                        {r.key} · {r.adminCount} quản trị viên{r.isSystem && ' · mặc định'}
                      </span>
                    </span>
                    {editable && (
                      <span className="pq-actions">
                        <button
                          type="button"
                          className="row-btn"
                          onClick={() => {
                            setError(null);
                            setEditing({ mode: 'edit', role: r });
                          }}
                        >
                          Sửa
                        </button>
                        {!r.isSystem && (
                          <button
                            type="button"
                            className="row-btn pq-danger"
                            onClick={() => {
                              setError(null);
                              setRemoving(r);
                            }}
                          >
                            Xoá
                          </button>
                        )}
                      </span>
                    )}
                  </header>
                  {r.description && <p className="pq-role__desc">{r.description}</p>}
                  <ul className="pq-perms" aria-label={`Quyền của ${r.name}`}>
                    {r.permissions.map((p) => (
                      <li key={p} className={cx('mini-tag', SENSITIVE.includes(p) ? 'mini-tag--warning' : 'mini-tag--gray')} title={p}>
                        {ADMIN_PERMISSION_LABEL[p]}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
      </div>

      <RoleEditor
        editing={editing}
        me={me}
        busy={busy}
        error={error}
        onClose={() => setEditing(null)}
        onSubmit={(body) => {
          if (editing?.mode === 'edit') {
            const { key: _key, ...rest } = body;
            void run(() => api(`/admin/roles/${editing.role.id}`, { method: 'PUT', body: JSON.stringify(rest) }), `Đã cập nhật vai trò ${body.name}.`);
          } else void run(() => post('/admin/roles', body), `Đã tạo vai trò ${body.name}.`);
        }}
      />
      <Dialog
        open={!!removing}
        title={`Xoá vai trò ${removing?.name ?? ''}`}
        description="Chỉ xoá được vai trò tự tạo và chưa gán cho ai."
        otp
        confirmLabel="Xoá vai trò"
        tone="danger"
        busy={busy}
        error={error}
        onClose={() => setRemoving(null)}
        onConfirm={(_, otp) => removing && void run(() => api(`/admin/roles/${removing.id}`, { method: 'DELETE', body: JSON.stringify(otp ? { otp } : {}) }), `Đã xoá vai trò ${removing.name}.`)}
      />
    </>
  );
}

type RoleBody = { key: string; name: string; description?: string; permissions: AdminPermission[]; otp?: string };

function RoleEditor({ editing, me, busy, error, onClose, onSubmit }: { editing: Editing | null; me: AdminMe | null; busy: boolean; error: string | null; onClose: () => void; onSubmit: (body: RoleBody) => void }) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [perms, setPerms] = useState<AdminPermission[]>([]);

  useEffect(() => {
    if (!editing) return;
    const r = editing.mode === 'edit' ? editing.role : null;
    setKey(r?.key ?? '');
    setName(r?.name ?? '');
    setDescription(r?.description ?? '');
    setPerms(r?.permissions ?? []);
  }, [editing]);

  // Admin khác Super Admin chỉ cấp được quyền mình đang có
  const allowed = (p: AdminPermission) => me?.role.key === SUPER_ADMIN_ROLE || !!me?.permissions.includes(p);
  const toggle = (p: AdminPermission) => setPerms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  const creating = editing?.mode === 'create';

  return (
    <FormDialog
      open={!!editing}
      wide
      title={creating ? 'Tạo vai trò' : `Sửa vai trò ${editing?.mode === 'edit' ? editing.role.name : ''}`}
      confirmLabel={creating ? 'Tạo vai trò' : 'Lưu thay đổi'}
      otp
      busy={busy}
      error={error}
      disabled={name.trim().length < 2 || !perms.length || (creating && !/^[a-z][a-z0-9_]{2,39}$/.test(key))}
      onClose={onClose}
      onSubmit={(otp) => onSubmit({ key, name: name.trim(), ...(description.trim() && { description: description.trim() }), permissions: perms, ...(otp && { otp }) })}
    >
      <div className="pq-form-row">
        <label className="field">
          <span className="field__label">Tên vai trò</span>
          <input className="field__input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        {creating && (
          <label className="field">
            <span className="field__label">Mã (không đổi được)</span>
            <input className="field__input" value={key} maxLength={40} placeholder="vd. sales_lead" onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
          </label>
        )}
      </div>
      <label className="field">
        <span className="field__label">Mô tả</span>
        <input className="field__input" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <fieldset className="pq-groups">
        <legend className="field__label">Quyền ({perms.length})</legend>
        {GROUPS.map(([group, items]) => (
          <div key={group} className="pq-group">
            <span className="pq-group__title">{GROUP_LABEL[group] ?? group}</span>
            {items.map((p) => (
              <label key={p} className={cx('pq-check', !allowed(p) && 'pq-check--off')} title={allowed(p) ? p : 'Bạn không có quyền này nên không cấp được'}>
                <input type="checkbox" checked={perms.includes(p)} disabled={!allowed(p)} onChange={() => toggle(p)} />
                <span>{ADMIN_PERMISSION_LABEL[p]}</span>
                {SENSITIVE.includes(p) && <span className="mini-tag mini-tag--warning">Nhạy cảm</span>}
              </label>
            ))}
          </div>
        ))}
      </fieldset>
    </FormDialog>
  );
}
