'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import type { CompanyMember, CompanyMemberInvite, CompanyMembers, MemberInviteSent } from '@viecpro/shared';
import ApplicantAvatar from '@/components/employer/ApplicantAvatar';
import { useEmployerAccount } from '@/components/employer/EmployerAccountProvider';
import { EMPLOYER_BASE } from '@/components/employer/EmployerShell';
import { Field } from '@/components/form/FormKit';
import { IconCheck, IconClose, IconPlus, IconSend, IconShieldCheck, IconTrash } from '@/components/ui/Icons';
import { ApiClientError, apiMessage, apiRequest } from '@/lib/api';
import { dayMonth, displayPhone, timeAgo } from '@/lib/employer';
import { cx } from '@/lib/format';
import './members.css';

/** Thành viên doanh nghiệp: ai cũng xem được; quản trị viên doanh nghiệp mời, đổi quyền, gỡ thành viên */
export default function MembersManager() {
  const { account, refresh } = useEmployerAccount();
  const [data, setData] = useState<CompanyMembers | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviting, setInviting] = useState(false);
  const [devLink, setDevLink] = useState('');
  const [removing, setRemoving] = useState<CompanyMember | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await apiRequest<CompanyMembers>('/employer/members'));
      setError('');
    } catch (e) {
      setError(apiMessage(e, 'Không tải được danh sách thành viên.'));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setError('');
    setNotice('');
    try {
      const result = await fn();
      if (result && typeof result === 'object' && 'members' in result) setData(result as CompanyMembers);
      else await load();
      setNotice(done);
      void refresh();
    } catch (e) {
      setError(apiMessage(e, 'Không thực hiện được thao tác.'));
    }
  };

  const confirmRemove = (transferToId: string | undefined) => {
    if (!removing) return;
    void act(async () => {
      const res = await apiRequest<CompanyMembers>(`/employer/members/${removing.id}/remove`, { method: 'POST', body: JSON.stringify({ transferToId }) });
      setRemoving(null);
      return res;
    }, `Đã gỡ ${removing.name} khỏi doanh nghiệp và bàn giao công việc.`);
  };

  if (account.kind !== 'company') {
    return <div className="emp-state">Mục Thành viên dành cho tài khoản doanh nghiệp.</div>;
  }

  const total = data ? data.members.length + data.invites.filter((i) => !i.expired).length : 0;

  return (
    <div className="mb">
      <div className="emp-page-head">
        <span className="emp-page-head__titles">
          <nav className="emp-crumbs" aria-label="Breadcrumb">
            <Link href={EMPLOYER_BASE}>Tổng quan</Link>
            <span className="emp-crumbs__sep">/</span>
            <span className="emp-crumbs__current">Thành viên</span>
          </nav>
          <h1 className="emp-page-head__title">Thành viên {account.company?.shortName ?? account.company?.name}</h1>
        </span>
        {data?.canManage && (
          <span className="emp-page-head__actions">
            <button
              type="button"
              className="emp-btn emp-btn--primary"
              aria-expanded={inviting}
              disabled={total >= data.limit}
              onClick={() => {
                setInviting((v) => !v);
                setDevLink('');
              }}
            >
              <IconPlus size={16} />
              Mời thành viên
            </button>
          </span>
        )}
      </div>

      {error && (
        <div className="emp-state emp-state--error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className="mb-notice" role="status">
          <IconCheck size={15} />
          {notice}
        </p>
      )}

      {inviting && data?.canManage && (
        <InviteForm
          onCancel={() => setInviting(false)}
          onSent={(sent) => {
            setInviting(false);
            setDevLink(sent.devLink ?? '');
            setNotice(`Đã gửi lời mời tới ${displayPhone(sent.invite.phone)}${sent.invite.email ? ` và ${sent.invite.email}` : ''}.`);
            void load();
          }}
        />
      )}
      {devLink && (
        <p className="mb-devlink">
          <b>Môi trường dev</b> – SMS đang in ra log, mở link mời để thử:{' '}
          <a href={devLink} target="_blank" rel="noopener">
            {devLink}
          </a>
        </p>
      )}

      {!data && !error && <div className="emp-card mb-skeleton" aria-busy="true" />}

      {data && (
        <>
          <section className="emp-card mb-card" aria-labelledby="mb-members">
            <header className="mb-card__head">
              <h2 className="emp-card__title" id="mb-members">
                {data.members.length} thành viên
              </h2>
              <span className="emp-card__sub">
                Tối đa {data.limit} (kể cả lời mời đang chờ){!data.canManage && ' · Chỉ quản trị viên doanh nghiệp được mời hoặc gỡ thành viên'}
              </span>
            </header>
            <ul className={cx('mb-list', data.canManage && 'mb-list--manage')}>
              {data.members.map((m) => (
                <MemberEntry
                  key={m.id}
                  open={removing?.id === m.id}
                  panel={removing && <RemovePanel member={removing} members={data.members} onCancel={() => setRemoving(null)} onConfirm={confirmRemove} />}
                >
                  <MemberRow
                    m={m}
                    canManage={data.canManage}
                    onToggleAdmin={() =>
                      void act(
                        () => apiRequest<CompanyMembers>(`/employer/members/${m.id}/role`, { method: 'PATCH', body: JSON.stringify({ companyAdmin: !m.companyAdmin }) }),
                        m.companyAdmin ? `Đã bỏ quyền quản trị của ${m.name}.` : `${m.name} đã là quản trị viên doanh nghiệp.`,
                      )
                    }
                    onRemove={() => setRemoving(m)}
                  />
                </MemberEntry>
              ))}
            </ul>
          </section>


          {data.canManage && data.invites.length > 0 && (
            <section className="emp-card mb-card" aria-labelledby="mb-invites">
              <header className="mb-card__head">
                <h2 className="emp-card__title" id="mb-invites">
                  Lời mời chưa nhận
                </h2>
                <span className="emp-card__sub">Link mời có hiệu lực 7 ngày, chỉ dùng được với số điện thoại được mời</span>
              </header>
              <ul className="mb-list mb-list--manage">
                {data.invites.map((i) => (
                  <InviteRow
                    key={i.id}
                    invite={i}
                    onResend={() =>
                      void act(async () => {
                        const sent = await apiRequest<MemberInviteSent>(`/employer/members/invites/${i.id}/resend`, { method: 'POST' });
                        setDevLink(sent.devLink ?? '');
                      }, `Đã gửi lại lời mời cho ${i.name}.`)
                    }
                    onRevoke={() => {
                      if (window.confirm(`Huỷ lời mời gửi ${i.name}? Link đã gửi sẽ không dùng được nữa.`)) void act(() => apiRequest<void>(`/employer/members/invites/${i.id}`, { method: 'DELETE' }), `Đã huỷ lời mời gửi ${i.name}.`);
                    }}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** Dòng thành viên + bảng xác nhận gỡ mở ngay bên dưới (gần chỗ vừa bấm) */
function MemberEntry({ open, panel, children }: { open: boolean; panel: ReactNode; children: ReactNode }) {
  return (
    <>
      {children}
      {open && <li className="mb-row-panel">{panel}</li>}
    </>
  );
}

function MemberRow({ m, canManage, onToggleAdmin, onRemove }: { m: CompanyMember; canManage: boolean; onToggleAdmin: () => void; onRemove: () => void }) {
  return (
    <li className="mb-row">
      {m.photoUrl ? <img className="mb-row__photo" src={m.photoUrl} alt="" /> : <ApplicantAvatar name={m.name} />}
      <span className="mb-row__who">
        <span className="mb-row__name">
          <Link href={`/tu-van-vien/${m.slug}`} target="_blank" rel="noopener">
            {m.name}
          </Link>
          {m.isSelf && <span className="mb-tag mb-tag--self">Bạn</span>}
          {m.companyAdmin && (
            <span className="mb-tag mb-tag--admin">
              <IconShieldCheck size={12} />
              Quản trị
            </span>
          )}
          {!m.hasAccount && <span className="mb-tag">Chưa có tài khoản</span>}
        </span>
        <span className="mb-row__sub">
          {m.title}
          {m.phone && ` · ${displayPhone(m.phone)}`}
          {m.email && ` · ${m.email}`}
        </span>
      </span>
      <span className="mb-row__stats">
        <span>
          <b>{m.openJobs}</b> tin đang mở
        </span>
        <span>
          <b>{m.activeApplicants}</b> hồ sơ phụ trách
        </span>
        <span className="mb-row__seen">{m.hasAccount ? (m.lastLoginAt ? `Đăng nhập ${timeAgo(m.lastLoginAt)}` : 'Chưa đăng nhập') : 'Hồ sơ hiển thị'}</span>
      </span>
      {canManage && m.isSelf && <span className="mb-row__actions" />}
      {canManage && !m.isSelf && (
        <span className="mb-row__actions">
          {m.hasAccount && (
            <button type="button" className="emp-btn emp-btn--sm" onClick={onToggleAdmin}>
              <IconShieldCheck size={14} />
              {m.companyAdmin ? 'Bỏ quyền quản trị' : 'Cấp quyền quản trị'}
            </button>
          )}
          <button type="button" className="emp-btn emp-btn--sm mb-danger" onClick={onRemove}>
            <IconTrash size={14} />
            Gỡ
          </button>
        </span>
      )}
    </li>
  );
}

function InviteRow({ invite, onResend, onRevoke }: { invite: CompanyMemberInvite; onResend: () => void; onRevoke: () => void }) {
  return (
    <li className="mb-row">
      <span className="mb-row__icon">
        <IconSend size={16} />
      </span>
      <span className="mb-row__who">
        <span className="mb-row__name">
          {invite.name}
          {invite.companyAdmin && <span className="mb-tag mb-tag--admin">Quản trị</span>}
          {invite.expired ? <span className="mb-tag mb-tag--warn">Hết hạn</span> : <span className="mb-tag">Chờ nhận</span>}
        </span>
        <span className="mb-row__sub">
          {invite.title} · {displayPhone(invite.phone)}
          {invite.email && ` · ${invite.email}`}
        </span>
      </span>
      <span className="mb-row__stats">
        <span>Mời bởi {invite.invitedBy}</span>
        <span className="mb-row__seen">{invite.expired ? `Hết hạn ${dayMonth(invite.expiresAt)}` : `Hạn ${dayMonth(invite.expiresAt)}`}</span>
      </span>
      <span className="mb-row__actions">
        <button type="button" className="emp-btn emp-btn--sm" onClick={onResend}>
          <IconSend size={14} />
          Gửi lại
        </button>
        <button type="button" className="emp-btn emp-btn--sm mb-danger" onClick={onRevoke}>
          <IconClose size={14} />
          Huỷ
        </button>
      </span>
    </li>
  );
}

function InviteForm({ onSent, onCancel }: { onSent: (sent: MemberInviteSent) => void; onCancel: () => void }) {
  const [d, setD] = useState({ name: '', phone: '', email: '', title: 'Cán bộ tuyển dụng', companyAdmin: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof d>(key: K, value: (typeof d)[K]) => setD((cur) => ({ ...cur, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setFields({});
    try {
      onSent(await apiRequest<MemberInviteSent>('/employer/members/invites', { method: 'POST', body: JSON.stringify(d) }));
    } catch (err) {
      setError(apiMessage(err, 'Không gửi được lời mời.'));
      if (err instanceof ApiClientError && err.fields) setFields(err.fields);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="emp-card mb-form" onSubmit={(e) => void submit(e)} noValidate>
      <header className="mb-card__head">
        <h2 className="emp-card__title">Mời thành viên mới</h2>
        <span className="emp-card__sub">Người được mời nhận link qua SMS (và email nếu có), xác thực số điện thoại rồi đặt mật khẩu. Chỉ mời được số chưa có tài khoản viecpro.</span>
      </header>
      <div className="ef-grid">
        <Field label="Họ và tên" required error={fields.name}>
          <input aria-label="Họ và tên" className="ef-input" value={d.name} maxLength={80} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>
        <Field label="Số điện thoại" required error={fields.phone}>
          <input aria-label="Số điện thoại" className="ef-input" value={d.phone} inputMode="tel" maxLength={20} placeholder="0912 345 678" onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Chức danh" required error={fields.title}>
          <input aria-label="Chức danh" className="ef-input" value={d.title} maxLength={80} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Email" hint="Không bắt buộc – gửi thêm lời mời qua email" error={fields.email}>
          <input aria-label="Email" className="ef-input" type="email" value={d.email} maxLength={120} onChange={(e) => set('email', e.target.value)} />
        </Field>
      </div>
      <label className="mb-check">
        <input type="checkbox" checked={d.companyAdmin} onChange={(e) => set('companyAdmin', e.target.checked)} />
        <span>
          <b>Quản trị viên doanh nghiệp</b>
          <small>Được sửa hồ sơ công ty, mời và gỡ thành viên</small>
        </span>
      </label>
      {error && (
        <p className="ef-footer__error" role="alert">
          {error}
        </p>
      )}
      <div className="mb-form__actions">
        <button type="button" className="emp-btn" onClick={onCancel} disabled={busy}>
          Huỷ
        </button>
        <button type="submit" className="emp-btn emp-btn--primary" disabled={busy || d.name.trim().length < 2 || d.phone.trim().length < 9}>
          <IconSend size={15} />
          {busy ? 'Đang gửi…' : 'Gửi lời mời'}
        </button>
      </div>
    </form>
  );
}

function RemovePanel({ member, members, onConfirm, onCancel }: { member: CompanyMember; members: CompanyMember[]; onConfirm: (transferToId: string | undefined) => void; onCancel: () => void }) {
  const candidates = members.filter((m) => m.id !== member.id && m.hasAccount);
  const self = candidates.find((m) => m.isSelf);
  const [target, setTarget] = useState(self?.id ?? candidates[0]?.id ?? '');
  const busyWork = member.openJobs + member.activeApplicants;
  const ref = useRef<HTMLElement>(null);
  // Đưa focus vào bảng xác nhận (trình đọc màn hình đọc ngay nội dung cảnh báo)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' });
    ref.current?.focus({ preventScroll: true });
  }, [member.id]);
  return (
    <section ref={ref} tabIndex={-1} className="emp-card mb-remove" role="alertdialog" aria-labelledby="mb-remove-title">
      <h2 className="emp-card__title" id="mb-remove-title">
        Gỡ {member.name} khỏi doanh nghiệp?
      </h2>
      <ul className="mb-remove__effects">
        <li>Bị đăng xuất khỏi mọi thiết bị và không vào khu quản lý được nữa.</li>
        <li>Không còn hiện trong đội ngũ tư vấn trên trang công ty. Lịch sử ghi chú, tin đã đóng vẫn được giữ.</li>
        <li>
          {busyWork ? (
            <>
              <b>{member.openJobs}</b> tin chưa đóng, <b>{member.activeApplicants}</b> hồ sơ đang phụ trách và lịch hẹn sắp tới được bàn giao cho:
            </>
          ) : (
            'Tin chưa đóng và lịch hẹn sắp tới (nếu có) được bàn giao cho:'
          )}
        </li>
      </ul>
      <label className="mb-remove__target">
        <span className="ef-field__label">Người nhận bàn giao</span>
        <select className="ef-input" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Người nhận bàn giao">
          {candidates.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.isSelf ? ' (bạn)' : ''} – {m.title}
            </option>
          ))}
        </select>
      </label>
      <div className="mb-form__actions">
        <button type="button" className="emp-btn" onClick={onCancel}>
          Huỷ
        </button>
        <button type="button" className="emp-btn emp-btn--danger" disabled={!target} onClick={() => onConfirm(target || undefined)}>
          <IconTrash size={15} />
          Gỡ thành viên
        </button>
      </div>
    </section>
  );
}

