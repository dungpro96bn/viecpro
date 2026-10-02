'use client';

import { useEffect, useRef, useState } from 'react';
import ChangePasswordForm from './ChangePasswordForm';
import '@/components/ui/ui.css';

/** Đổi mật khẩu từ menu tài khoản */
export default function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setDone(false);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onCancel={onClose}>
      <div className="dialog__body">
        <h2 className="dialog__title">Đổi mật khẩu</h2>
        {done ? (
          <>
            <p className="alert alert--info" role="status">
              Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.
            </p>
            <div className="dialog__actions">
              <button type="button" className="btn btn--primary" onClick={onClose}>
                Đóng
              </button>
            </div>
          </>
        ) : (
          open && <ChangePasswordForm onDone={() => setDone(true)} onCancel={onClose} />
        )}
      </div>
    </dialog>
  );
}
