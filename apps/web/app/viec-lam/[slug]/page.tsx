import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SectionTabs from '@/components/layout/SectionTabs';
import ApplyButton from '@/components/apply/ApplyButton';
import JobSlider from '@/components/jobs/JobSlider';
import Avatar from '@/components/ui/Avatar';
import ConsultForm from '@/components/profile/ConsultForm';
import SaveButton from '@/components/ui/SaveButton';
import ShareButton from '@/components/ui/ShareButton';
import Stars from '@/components/ui/Stars';
import {
  IconBolt,
  IconBriefcaseLine,
  IconCalendar,
  IconChat,
  IconCheck,
  IconCheckCircle,
  IconClock,
  IconDocList,
  IconEye,
  IconGift,
  IconPhone,
  IconPin,
  IconRoute,
  IconSend,
  IconShield,
  IconShieldPlus,
  IconTrendUp,
  IconUserCheck,
  IconWallet,
  IconWarning,
  PathIcon,
} from '@/components/ui/Icons';
import { toApplyJob } from '@/lib/data';
import { DETAIL_ICONS } from '@/lib/job-detail';
import { apiJobToSlider, apiJobToView, apiRecruiterToPoster } from '@/lib/api-mappers';
import { getJobDetail, getProfileJobs, getRecruiterProfile, getSimilarJobs } from '@/lib/server-api';
import { PROGRAM_LABEL, cx, formatNumber, formatYen } from '@/lib/format';
import StickyApplyBar from './StickyApplyBar';
import './job-detail.css';

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const job = await getJobDetail((await params).slug);
  return { title: job ? job.title : 'Không tìm thấy đơn hàng' };
}

const TABS = [
  { id: 'tong-quan', label: 'Tổng quan' },
  { id: 'cong-viec', label: 'Công việc' },
  { id: 'yeu-cau', label: 'Yêu cầu' },
  { id: 'thu-nhap', label: 'Thu nhập & phúc lợi' },
  { id: 'chi-phi', label: 'Chi phí & hồ sơ' },
  { id: 'quy-trinh', label: 'Quy trình' },
];

export default async function JobDetailPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const record = await getJobDetail(slug);
  if (!record) notFound();
  const job = apiJobToView(record);
  const poster = apiRecruiterToPoster(record);
  const employerName = record.employer?.name ?? `Nhà tuyển dụng tại ${record.pref}`;
  const closed = record.status === 'closed';
  const applyJob = { ...toApplyJob(job, employerName, poster), closed };
  const content = record.detail;
  const expectedIncome = content.expectedIncome ?? `${formatNumber(record.salary)} ¥`;
  const deadline = record.deadline ? new Date(record.deadline).toLocaleDateString('vi-VN') : 'Đang nhận hồ sơ';
  const departure = record.departureAt ? new Date(record.departureAt).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }) : 'Theo thông báo';
  const [similarResult, employerJobsResult, recruiterProfile] = await Promise.all([
    getSimilarJobs(record.slug),
    record.employer ? getProfileJobs({ employer: record.employer.slug }) : Promise.resolve(null),
    getRecruiterProfile(record.recruiter.slug),
  ]);
  const similar = similarResult ?? [];
  const employerJobs = employerJobsResult?.items ?? [];
  const sameEmployer = employerJobs.filter((item) => item.slug !== record.slug).map(apiJobToSlider);
  const similarView = similar.map(apiJobToSlider);
  const salary = formatYen(job.salary);

  const facts = [
    { label: 'Số lượng', value: job.qty, icon: DETAIL_ICONS.users },
    { label: 'Năm sinh', value: job.age.replace('–', ' – '), icon: DETAIL_ICONS.cal },
    { label: 'Ngành nghề', value: record.industry, icon: DETAIL_ICONS.chip },
    { label: 'Hình thức tuyển', value: content.recruitment ?? 'Liên hệ nhà tuyển dụng', icon: DETAIL_ICONS.clip },
    { label: 'Dự kiến xuất cảnh', value: departure, icon: DETAIL_ICONS.plane },
    { label: 'Hợp đồng', value: content.contract ?? 'Theo thỏa thuận', icon: DETAIL_ICONS.doc },
  ];

  return (
    <div className="page page--fluid page--job">
      <Header active="jobs" />

      {/* ĐẦU TRANG */}
      <section className="detail-top">
        <div className="container detail-top__inner">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Trang chủ</Link>
            <span className="breadcrumb__sep">/</span>
            <Link href="/tim-kiem">Việc làm Nhật</Link>
            <span className="breadcrumb__sep">/</span>
            <Link href={`/tim-kiem?pref=${job.pref}`}>{job.pref}</Link>
            <span className="breadcrumb__sep">/</span>
            <span className="breadcrumb__current">{job.title}</span>
          </nav>

          <div className="detail-hero">
            {/* Ảnh mô tả công việc */}
            <div className="detail-photo">
              <img className="detail-photo__img" src={job.img} alt={job.title} />
              <span className="detail-photo__shade" />
              <span className="detail-photo__badges">
                {job.tags.slice(0, 1).map((tag) => <span key={tag} className="detail-photo__badge detail-photo__badge--free"><IconShield size={12} className="icon--w24" />{tag}</span>)}
                {job.badges.slice(0, 1).map((badge) => <span key={badge} className={cx('detail-photo__badge', badge === 'urgent' && 'detail-photo__badge--urgent')}>{badge === 'urgent' ? <IconBolt size={11} /> : null}{badge === 'urgent' ? 'Gấp' : badge === 'hot' ? 'Nổi bật' : 'Tin mới'}</span>)}
              </span>
              <span className="detail-photo__caption">
                <span className="detail-photo__where">
                  <span className="detail-photo__pref">
                    <IconPin size={16} className="icon--w22" />
                    {job.pref}, Nhật Bản
                  </span>
                <span className="detail-photo__note">Thông tin từ nhà tuyển dụng</span>
                </span>
                <span className="detail-photo__views">
                  <IconEye size={14} />
                  {formatNumber(job.views)} lượt xem
                </span>
              </span>
            </div>

            {/* Thông tin chính */}
            <div className="detail-summary">
              <div className="detail-summary__pills">
                <span className="pill pill--brand">{PROGRAM_LABEL[job.program]}</span>
                <span className="pill pill--gray">Mã đơn: {record.code}</span>
                {record.employer?.verified && <span className="pill pill--success">
                  <IconCheckCircle size={13} className="icon--w24" />
                  Nhà tuyển dụng đã xác minh
                </span>}
              </div>
              <h1 className="detail-summary__title">
                {job.title}
                {job.title.includes(' tại ') && ', Nhật Bản'}
              </h1>

              <div className="salary-box">
                <div className="salary-box__cell">
                  <span className="salary-box__label">Lương cơ bản</span>
                  <span className="salary-box__value">
                    {salary}
                    <span className="salary-box__per">/tháng</span>
                  </span>
                  <span className="salary-box__note">Lương theo thông tin nhà tuyển dụng</span>
                </div>
                <div className="salary-box__cell salary-box__cell--income">
                  <span className="salary-box__label">
                    <IconTrendUp size={14} className="icon--w22 salary-box__trend" />
                    Thu nhập dự kiến (gồm tăng ca)
                  </span>
                  <span className="salary-box__value salary-box__value--income">
                    {expectedIncome}
                    <span className="salary-box__per">/tháng</span>
                  </span>
                  <span className="salary-box__note">Thu nhập thực tế phụ thuộc giờ làm và tăng ca</span>
                </div>
              </div>

              <div className="detail-facts">
                {facts.map((f) => (
                  <div key={f.label} className="detail-fact">
                    <span className="detail-fact__icon">
                      <PathIcon d={f.icon} size={17} />
                    </span>
                    <span className="detail-fact__text">
                      <span className="detail-fact__label">{f.label}</span>
                      <span className="detail-fact__value">{f.value}</span>
                    </span>
                  </div>
                ))}
              </div>

              {closed && (
                <p className="detail-closed" role="status">
                  Đơn hàng này đã ngừng nhận hồ sơ. Xem các đơn tương tự bên dưới.
                </p>
              )}

              <div className="detail-actions">
                <ApplyButton job={applyJob} className="btn btn--primary btn--lg detail-actions__apply" />
                <a href="tel:19006688" className="btn btn--outline btn--lg detail-actions__hotline">
                  <IconPhone size={18} />
                  1900 66 88
                </a>
                <SaveButton jobId={job.slug} size="lg" syncState />
                <ShareButton title={job.title} className="icon-btn icon-btn--round icon-btn--lg detail-actions__share" />
              </div>

              <div className="detail-meta">
                <span>
                  <IconClock size={14} />
                  Đăng {job.posted}
                </span>
                <span className="detail-meta__deadline">
                  <IconCalendar size={14} />
                  Hạn nhận hồ sơ: {deadline}
                </span>
                <span>
                  <IconPin size={14} />
                  Nhận hồ sơ tại {poster.city}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionTabs
        label="Mục lục đơn hàng"
        items={TABS}
        actions={
          <>
            <span className="detail-tabs__salary">
              Lương <b>{salary}</b>/tháng
            </span>
            <ApplyButton job={applyJob} className="btn btn--primary btn--sm detail-tabs__apply" />
          </>
        }
      />

      {/* NỘI DUNG */}
      <main className="detail-main page-main">
        <div className="container detail-main__inner">
          <div className="detail-content">
            <section id="tong-quan" className="content-card">
              <div className="content-card__head">
                <span className="content-card__icon">
                  <IconDocList size={19} />
                </span>
                <h2 className="content-card__title">Tổng quan đơn hàng</h2>
              </div>
              <p className="detail-text">{content.overview}</p>
              <div className="highlight-grid">
                {content.highlights.map((h) => (
                  <div key={h} className="highlight">
                    <span className="highlight__check">
                      <IconCheck size={12} className="icon--w32" />
                    </span>
                    {h}
                  </div>
                ))}
              </div>
            </section>

            <section id="cong-viec" className="content-card">
              <div className="content-card__head">
                <span className="content-card__icon">
                  <IconBriefcaseLine size={19} />
                </span>
                <h2 className="content-card__title">Mô tả công việc</h2>
              </div>
              <div className="two-col">
                <div className="bullet-box">
                  <span className="bullet-box__title">Nhiệm vụ chính</span>
                  {content.tasks.map((t) => (
                    <div key={t} className="bullet-box__item">
                      {t}
                    </div>
                  ))}
                </div>
                <div className="bullet-box">
                  <span className="bullet-box__title">Môi trường làm việc</span>
                  {content.environment.map((t) => (
                    <div key={t} className="bullet-box__item">
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section id="yeu-cau" className="content-card">
              <div className="content-card__head">
                <span className="content-card__icon">
                  <IconUserCheck size={19} />
                </span>
                <h2 className="content-card__title">Yêu cầu ứng viên</h2>
              </div>
              <InfoTable rows={content.requirements} />
            </section>

            <section id="thu-nhap" className="content-card content-card--gap20">
              <div className="content-card__head">
                <span className="content-card__icon">
                  <IconWallet size={19} />
                </span>
                <h2 className="content-card__title">Thu nhập &amp; phúc lợi</h2>
              </div>
              <div className="income-grid">
                {content.incomes.map((m) => (
                  <div key={m.label} className={cx('income-box', m.highlight && 'income-box--highlight')}>
                    <span className="income-box__label">{m.label}</span>
                    <span className="income-box__value">{m.value}</span>
                    <span className="income-box__note">{m.note}</span>
                  </div>
                ))}
              </div>
              <div className="sub-block">
                <span className="sub-block__title">Thời gian làm việc</span>
                <InfoTable rows={content.hours} />
              </div>
              <div className="sub-block sub-block--gap12">
                <span className="sub-block__title">Chế độ phúc lợi</span>
                <div className="benefit-grid">
                  {content.benefits.map((b) => (
                    <div key={b} className="benefit">
                      <span className="benefit__icon">
                        <IconGift size={15} className="icon--w2" />
                      </span>
                      {b}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section id="chi-phi" className="content-card content-card--gap20">
              <div className="content-card__head">
                <span className="content-card__icon">
                  <IconShieldPlus size={19} />
                </span>
                <h2 className="content-card__title">Chi phí &amp; hồ sơ</h2>
              </div>
              <div className="cost-box">
                <div className="cost-box__price">
                  <span className="cost-box__label">Chi phí tham gia</span>
                  <span className="cost-box__value">Chưa cập nhật</span>
                  <span className="cost-box__label">Vui lòng xác nhận với nhà tuyển dụng</span>
                </div>
                <div className="cost-box__detail">
                  <span className="cost-box__included-title">Đã bao gồm</span>
                  <div className="cost-box__tags">
                    {content.included.map((c) => (
                      <span key={c} className="included-tag">
                        <IconCheck size={12} className="icon--w3" />
                        {c}
                      </span>
                    ))}
                  </div>
                  <span className="cost-box__note">Xác nhận các khoản phí và nội dung đã bao gồm trực tiếp trước khi ký hợp đồng.</span>
                </div>
              </div>
              <div className="sub-block sub-block--gap12">
                <span className="sub-block__title">Hồ sơ cần chuẩn bị</span>
                <div className="doc-grid">
                  {content.documents.map((d, i) => (
                    <div key={d} className="doc-item">
                      <span className="doc-item__num">{i + 1}</span>
                      {d}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section id="quy-trinh" className="content-card content-card--gap20">
              <div className="content-card__head">
                <span className="content-card__icon">
                  <IconRoute size={19} />
                </span>
                <h2 className="content-card__title">Quy trình tuyển dụng</h2>
              </div>
              <ol className="steps">
                {content.steps.map((s, i) => {
                  const last = i === content.steps.length - 1;
                  return (
                    <li key={s.title} className={cx('step', last && 'step--last')}>
                      <div className="step__rail">
                        <span className="step__dot">{i + 1}</span>
                        <span className="step__line" />
                      </div>
                      <div className="step__body">
                        <span className="step__head">
                          <span className="step__title">{s.title}</span>
                          <span className="step__when">{s.when}</span>
                        </span>
                        <span className="step__desc">{s.desc}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <div role="note" className="note-warning">
              <IconWarning size={20} className="icon--w2" />
              <span>
                <b>Lưu ý an toàn:</b> viecpro là nền tảng kết nối thông tin. Không chuyển tiền đặt cọc trước khi ký hợp đồng; hãy kiểm tra
                giấy phép XKLĐ của doanh nghiệp và xác minh thông tin trực tiếp với nhà tuyển dụng.
              </span>
            </div>
          </div>

          {/* SIDEBAR */}
          <aside className="detail-aside">
            <div className="apply-card">
              <div className="apply-card__head">
                <span className="apply-card__bubble" />
                <span className="apply-card__label">Lương cơ bản</span>
                <span className="apply-card__salary">
                  {salary}
                  <span className="apply-card__per">/tháng</span>
                </span>
                <span className="apply-card__income">
                  Thu nhập dự kiến <b>{expectedIncome}</b>
                </span>
                <span className="apply-card__tags">
                  {record.tags.slice(0, 2).map((tag) => <span key={tag} className="apply-card__tag">{tag}</span>)}
                  <span className="apply-card__tag">{record.quantity} chỉ tiêu tuyển</span>
                </span>
              </div>
              <div className="apply-card__body">
                <div className="apply-card__checks">
                  {['Đăng ký chỉ mất 30 giây', 'Cán bộ gọi lại tư vấn trong 30 phút', 'Không thu phí khi đăng ký'].map((t) => (
                    <span key={t} className="apply-card__check">
                      <IconCheck size={16} className="icon--w24" />
                      {t}
                    </span>
                  ))}
                </div>
                <ApplyButton job={applyJob} className="btn btn--primary btn--lg apply-card__btn">
                  <IconSend size={18} className="icon--w2" />
                  Ứng tuyển ngay
                </ApplyButton>
                <div className="apply-card__contacts">
                  <a href="tel:19006688" className="btn btn--outline apply-card__contact">
                    <IconPhone size={17} />
                    Gọi ngay
                  </a>
                  <a href="#" className="btn btn--outline apply-card__contact">
                    <span className="zalo-mark">Zalo</span>
                    Chat Zalo
                  </a>
                </div>
              </div>
            </div>

            <ConsultForm
              title="Nhờ tư vấn về tin này"
              description="Để lại số điện thoại, cán bộ phụ trách sẽ gọi lại cho bạn."
              successTitle="Đã nhận yêu cầu"
              successText="Cán bộ phụ trách tin sẽ sớm liên hệ tư vấn cho bạn."
              jobId={record.id}
            />

            <div className="officer-card">
              <span className="officer-card__eyebrow">Cán bộ phụ trách</span>
              <div className="officer-card__profile">
                <Avatar src={poster.photo} size={56} verified />
                <span className="officer-card__info">
                  <Link href={poster.href ?? '#'} className="officer-card__name">
                    {poster.name}
                  </Link>
                <span className="officer-card__role">{poster.role} · NTD xác thực</span>
                  <span className="officer-card__rating">
                    <Stars rating={poster.rating} />
                    <span>{poster.rating.toFixed(1)}</span>
                  </span>
                </span>
              </div>
              <div className="officer-card__stats">
                <span className="officer-card__stat">
                  <b>{recruiterProfile?.jobCounts.all ?? 0}</b>
                  <span>Đơn đang đăng</span>
                </span>
                <span className="officer-card__stat officer-card__stat--mid">
                  <b>{recruiterProfile?.followerCount ?? 0}</b>
                  <span>Người theo dõi</span>
                </span>
                <span className="officer-card__stat">
                  <b>{poster.city || record.pref}</b>
                  <span>Khu vực</span>
                </span>
              </div>
              <div className="officer-card__actions">
                <a href="tel:19006688" className="btn btn--soft officer-card__btn">
                  <IconPhone size={16} />
                  Gọi
                </a>
                <a href="#" className="btn btn--soft officer-card__btn">
                  <IconChat size={16} />
                  Zalo
                </a>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <JobSlider title="Đơn hàng cùng nhà tuyển dụng" jobs={sameEmployer} />
      <JobSlider title="Đơn hàng tương tự" jobs={similarView} className="job-slider--flush-top" />

      <Footer />
      <StickyApplyBar job={applyJob} salary={salary} />
    </div>
  );
}

function InfoTable({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="info-table">
      {rows.map(([k, v]) => (
        <div key={k} className="info-table__row">
          <span className="info-table__key">{k}</span>
          <span className="info-table__value">{v}</span>
        </div>
      ))}
    </div>
  );
}
