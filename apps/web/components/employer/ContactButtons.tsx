import { IconPhone } from '@/components/ui/Icons';
import { telHref, zaloHref } from '@/lib/employer';

/** Nút gọi điện + Zalo cho ứng viên (chỉ dùng trong ngữ cảnh hồ sơ đã ứng tuyển đơn của NTD) */
export default function ContactButtons({ phone, name }: { phone: string; name: string }) {
  return (
    <span className="emp-contact">
      <a className="emp-contact__btn" href={telHref(phone)} aria-label={`Gọi ${name}`}>
        <IconPhone size={15} />
      </a>
      <a className="emp-contact__btn" href={zaloHref(phone)} target="_blank" rel="noreferrer" aria-label={`Nhắn Zalo cho ${name}`}>
        <span className="emp-zalo">Zalo</span>
      </a>
    </span>
  );
}
