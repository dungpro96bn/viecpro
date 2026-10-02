'use client';

import { useCallback, useEffect, useState } from 'react';
import { SUPER_ADMIN_ROLE, type AdminMe, type AdminRoleItem } from '@viecpro/shared';
import { errorText } from '@/components/list/list-utils';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cx } from '@/lib/format';
import AdminsTab from './AdminsTab';
import RolesTab from './RolesTab';

type Tab = 'admins' | 'roles';

/** Người thao tác chỉ gán được vai trò có quyền nằm trong quyền của mình (API kiểm tra lại) */
export function canGrant(me: AdminMe | null, role: Pick<AdminRoleItem, 'key' | 'permissions'>): boolean {
  if (!me) return false;
  if (me.role.key === SUPER_ADMIN_ROLE) return true;
  return role.key !== SUPER_ADMIN_ROLE && role.permissions.every((p) => me.permissions.includes(p));
}

/** Phân quyền (A-11): quản trị viên + vai trò quản trị. Mọi kiểm tra thật nằm ở API */
export default function PermissionsView() {
  const { admin } = useAuth();
  const [tab, setTab] = useState<Tab>('admins');
  const [roles, setRoles] = useState<AdminRoleItem[] | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    setRolesError(null);
    try {
      setRoles(await api<AdminRoleItem[]>('/admin/roles'));
    } catch (e) {
      setRolesError(errorText(e));
    }
  }, []);
  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  return (
    <>
      <header className="page-header page-header--list">
        <span className="page-header__titles">
          <span className="page-header__meta">Bảng điều khiển / Hệ thống</span>
          <h1 className="page-header__title">Phân quyền</h1>
        </span>
      </header>

      <div className="page-body">
        {rolesError && <p className="alert alert--danger" role="alert">{rolesError}</p>}
        <div className="tabs pq-tabs" role="tablist" aria-label="Phân quyền">
          {(
            [
              ['admins', 'Quản trị viên'],
              ['roles', 'Vai trò & quyền'],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={cx('tabs__item', tab === key && 'tabs__item--active')} onClick={() => setTab(key)}>
              {label}
              {key === 'roles' && <span className="tabs__count">{roles ? roles.length : '…'}</span>}
            </button>
          ))}
        </div>
        {tab === 'admins' ? <AdminsTab me={admin} roles={roles ?? []} onRolesChanged={loadRoles} /> : <RolesTab me={admin} roles={roles} onChanged={loadRoles} />}
      </div>
    </>
  );
}
