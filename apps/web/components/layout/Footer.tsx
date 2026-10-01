import Link from 'next/link';
import { IconClock, IconFacebook, IconMail, IconPhone, IconPin, IconTiktok, IconYoutube } from '../ui/Icons';
import Logo from './Logo';
import NewsletterForm from './NewsletterForm';
import './layout.css';

const COLUMNS = [
  { title: 'Việc làm theo tỉnh', links: ['Tokyo', 'Osaka', 'Aichi', 'Saitama', 'Hokkaido', 'Fukuoka'] },
  { title: 'Chương trình', links: ['Thực tập sinh kỹ năng', 'Kỹ năng đặc định', 'Kỹ sư – Trí thức', 'Điều dưỡng (Kaigo)', 'Đơn miễn phí'] },
  { title: 'Hỗ trợ', links: ['Cẩm nang Nhật Bản', 'Chi phí & thủ tục', 'Câu hỏi thường gặp', 'Tư vấn XKLĐ', 'Báo cáo tin sai'] },
  { title: 'Về viecpro', links: ['Giới thiệu', 'Dành cho nhà tuyển dụng', 'Bảng giá đăng tin', 'Tuyển dụng', 'Liên hệ'] },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        {/* Đăng ký nhận đơn */}
        <div className="site-footer__newsletter">
          <div className="site-footer__newsletter-text">
            <span className="site-footer__newsletter-title">Nhận đơn hàng Nhật Bản mới mỗi tuần</span>
            <span>Chọn tỉnh thành và ngành nghề, chúng tôi gửi đơn phù hợp qua email hoặc Zalo.</span>
          </div>
          <NewsletterForm />
        </div>

        <div className="site-footer__main">
          <div className="site-footer__brand">
            <Logo tone="dark" />
            <p className="site-footer__about">
              Nền tảng việc làm Nhật Bản minh bạch cho người lao động Việt Nam: thực tập sinh, kỹ năng đặc định và kỹ sư.
            </p>
            <div className="site-footer__contacts">
              <span className="site-footer__contact site-footer__contact--top">
                <IconPin size={16} className="site-footer__contact-icon" />
                <span>Số 21 Lê Đức Thọ, Từ Liêm, Hà Nội</span>
              </span>
              <a href="tel:19006688" className="site-footer__contact">
                <IconPhone size={16} />
                <span>Hotline: 1900 66 88</span>
              </a>
              <a href="mailto:hotro@viecpro.vn" className="site-footer__contact">
                <IconMail size={16} />
                <span>hotro@viecpro.vn</span>
              </a>
              <span className="site-footer__contact">
                <IconClock size={16} />
                <span>Thứ 2 – Thứ 7, 8:00 – 17:30</span>
              </span>
            </div>
            <div className="social">
              <a className="social__link social__link--fb" href="#" aria-label="Facebook viecpro">
                <IconFacebook size={20} />
              </a>
              <a className="social__link social__link--zalo" href="#" aria-label="Zalo viecpro">
                Zalo
              </a>
              <a className="social__link social__link--yt" href="#" aria-label="YouTube viecpro">
                <IconYoutube size={21} />
              </a>
              <a className="social__link social__link--tt" href="#" aria-label="TikTok viecpro">
                <IconTiktok size={19} />
              </a>
            </div>
          </div>

          <div className="site-footer__columns">
            {COLUMNS.map((col) => (
              <div key={col.title} className="site-footer__col">
                <span className="site-footer__col-title">{col.title}</span>
                {col.links.map((l) => (
                  <Link key={l} href="#">
                    {l}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="site-footer__bottom">
          <div className="site-footer__legal">
            <span>© 2026 viecpro. Mọi quyền được bảo lưu.</span>
            <span className="site-footer__license">Giấy phép hoạt động dịch vụ đưa người lao động đi làm việc ở nước ngoài: [SỐ GIẤY PHÉP]</span>
          </div>
          <div className="site-footer__policies">
            <Link href="#">Điều khoản sử dụng</Link>
            <Link href="#">Chính sách bảo mật</Link>
            <Link href="#">Quy chế hoạt động</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
