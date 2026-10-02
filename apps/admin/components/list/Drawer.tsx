'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { IconClose } from '@/components/ui/Icons';

interface Props {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Thanh thao tác cố định ở đáy */
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** Ngăn kéo chi tiết bên phải – dùng <dialog> gốc (bẫy focus, phím Esc sẵn có) */
export default function Drawer({ open, title, subtitle, footer, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="drawer"
      onClose={onClose}
      onCancel={onClose}
      // Bấm nền tối bên ngoài để đóng
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="drawer__panel">
        <header className="drawer__head">
          <span className="drawer__titles">
            <b className="drawer__title">{title}</b>
            {subtitle && <span className="drawer__subtitle">{subtitle}</span>}
          </span>
          <button type="button" className="icon-btn drawer__close" aria-label="Đóng" onClick={onClose}>
            <IconClose size={18} />
          </button>
        </header>
        <div className="drawer__body">{open && children}</div>
        {footer && <footer className="drawer__foot">{footer}</footer>}
      </div>
    </dialog>
  );
}
