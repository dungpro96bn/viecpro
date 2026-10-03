# viecpro

Nền tảng việc làm Nhật Bản **viecpro** – monorepo gồm web (Next.js), API (NestJS) và gói dùng chung, sẵn sàng cho app mobile.
Quy tắc code: **[RULE.md](RULE-FE.md)** (web) · **[RULE-BE.md](RULE-BE.md)** (backend, bảo mật, phân quyền).

## Cấu trúc

```
apps/
  web/        Next.js 16 – giao diện web                → http://localhost:3100
  admin/      Next.js 16 – cổng quản trị                → http://localhost:3001
  api/        NestJS 12 + Prisma 7 + PostgreSQL – API    → http://localhost:4000/api/v1 · tài liệu /docs
packages/
  shared/     @viecpro/shared – enum, nhãn, schema zod, kiểu request/response (web + API + mobile)
docker-compose.yml   PostgreSQL 17 (cổng 5433)
```

## Chạy dự án

Yêu cầu: Node.js ≥ 20, Docker.

```bash
npm install                       # cài mọi workspace, build shared, sinh Prisma client
cp apps/api/.env.example apps/api/.env
npm run db:up                     # bật PostgreSQL
npm run db:migrate                # tạo bảng
npm run db:seed                   # dữ liệu demo
npm run dev                       # shared (watch) + API + web
```

Tài khoản demo (mật khẩu `Viecpro123`): người tìm việc `0912345678` (Lan, email đã xác thực), NTD cá nhân `0987654321` (Thu Hà), NTD doanh nghiệp `0988111222` (Minh Anh – CAMCOM), admin `admin@viecpro.vn`.
Môi trường dev in mã OTP SMS ra log API và trả thêm `devCode` trong response. Email (mã xác nhận ứng tuyển, đã nhận hồ sơ, mời phỏng vấn) không gửi thật mà ghi ra `apps/api/tmp/mail/*.html` để mở xem trước.

| Lệnh | Việc |
| --- | --- |
| `npm run dev:web` / `dev:api` | Chạy riêng từng app |
| `npm run typecheck` | Kiểm tra kiểu mọi workspace |
| `npm run test` | Unit test API (Vitest) |
| `npm run test:e2e -w @viecpro/api` | E2E phân quyền 401 / 403 / 404 |
| `npm run test:e2e:db -w @viecpro/api` | E2E như trên + cách ly dữ liệu giữa các NTD trên Postgres thật (tự tạo / migrate database `viecpro_e2e`, cần `npm run db:up`) |
| `npm run build` | Build shared → API → web |
| `npm run db:studio` | Xem / sửa dữ liệu bằng Prisma Studio |

## Web – các trang (`apps/web`)

| Đường dẫn | Trang |
| --- | --- |
| `/` | Trang chủ (hero tìm kiếm, danh bạ tỉnh thành, 20 việc làm mới, sidebar quảng cáo) |
| `/tim-kiem` | Tìm kiếm việc làm (form mở rộng, bộ lọc trái, danh sách + phân trang 20 đơn/trang) |
| `/viec-lam/[slug]` | Chi tiết đơn hàng (2 slider đơn liên quan) |
| `/nha-tuyen-dung/viet-nam-camcom` | Hồ sơ nhà tuyển dụng doanh nghiệp |
| `/tu-van-vien/nguyen-thu-ha` | Hồ sơ nhà tuyển dụng cá nhân |
| `/dang-nhap` | Đăng nhập bằng email hoặc số điện thoại và mật khẩu |
| `/quen-mat-khau` | Gửi OTP và đặt lại mật khẩu bằng số điện thoại |
| `/dang-ky` | Đăng ký 3 bước: thông tin → xác thực OTP → hoàn tất |
| `/tai-khoan-ung-vien` | Tổng quan tài khoản ứng viên, tiến độ hồ sơ, lịch phỏng vấn và việc phù hợp |
| `/tai-khoan-ung-vien/ho-so` | Hồ sơ của tôi (design 18): % hoàn thiện, sửa từng khối, giấy tờ, video, NTD đã xem |
| `/tai-khoan-ung-vien/viec-da-ung-tuyen` | Việc đã ứng tuyển (design 19): tiến trình 5 bước, phỏng vấn sắp tới, xác nhận / xin dời lịch |
| `/tai-khoan-ung-vien/viec-da-luu` | Việc đã lưu (design 20): sắp xếp, lọc ngành, so sánh, ứng tuyển nhanh việc sắp hết hạn |
| `/tai-khoan-ung-vien/thong-bao-viec-lam` | Thông báo việc làm (design-new 04): tạo / sửa / bật tắt, việc mới cho bạn, gợi ý từ hồ sơ |
| `/tai-khoan-ung-vien/cai-dat` | Cài đặt (design-new 05): email / SĐT / mật khẩu, thiết bị, thông báo theo kênh + giờ yên lặng, quyền riêng tư, ngôn ngữ, tải dữ liệu, xoá tài khoản |
| `/quan-ly-tuyen-dung` | Tổng quan NTD doanh nghiệp / cá nhân (design 10, 11) |
| `/quan-ly-tuyen-dung/bao-cao` | Báo cáo lượt xem, hồ sơ, nguồn ứng tuyển, hiệu quả tin và phễu tuyển dụng (7 / 30 / 90 ngày) |
| `/quan-ly-tuyen-dung/danh-gia` | Đánh giá người lao động đã xuất cảnh và phản hồi của NTD |
| `/quan-ly-tuyen-dung/don-hang` | Quản lý tin tuyển dụng (design 12); `/dang-tin`, `/[id]/sua`: đăng / sửa tin (design 15) |
| `/quan-ly-tuyen-dung/ung-vien` | Quản lý ứng viên (design 13); `/them`: thêm ứng viên thủ công / Excel (design 16) |
| `/quan-ly-tuyen-dung/lich-phong-van` | Lịch phỏng vấn tuần (design 14); `/tao`: tạo lịch hẹn (design 17) |

Khi admin bật bảo trì trong Cài đặt hệ thống, toàn bộ trang web người dùng hiển thị màn hình bảo trì cùng thông điệp và thông tin hỗ trợ; trạng thái được kiểm tra lại mỗi 30 giây. API admin và tài nguyên tĩnh không bị ảnh hưởng.

**Ứng tuyển có xác nhận email:** popup ứng tuyển gồm 2 bước – điền thông tin (email bắt buộc) → nhập mã 6 số gửi tới email. Mã sống 5 phút, sai tối đa 5 lần, gửi lại sau 60 giây, tối đa 5 mã/giờ/email; API chỉ lưu HMAC của mã. Tài khoản ứng viên đã xác thực đúng email đó thì bỏ qua bước nhập mã. Gửi hồ sơ thành công → email "Đã nhận hồ sơ".

## Admin – trang quản trị (`apps/admin`)

| Đường dẫn | Trang |
| --- | --- |
| `/dang-nhap` | Đăng nhập admin, bắt buộc xác thực 2 lớp ngoài chế độ kiểm thử local |
| `/` | Bảng điều khiển và hàng chờ tóm tắt |
| `/kiem-duyet-tin` | Hàng chờ kiểm duyệt có tìm kiếm, phân trang, điểm rủi ro và thao tác duyệt / từ chối |
| `/xac-minh-doanh-nghiep` | Xác minh doanh nghiệp / NTD cá nhân (design-new 08): tab trạng thái, đối chiếu tự động, xác minh / yêu cầu bổ sung / từ chối |
| `/nguoi-lao-dong` | Danh sách ứng viên (design-new 09): lọc, thống kê, liên hệ che (hiện đầy đủ có ghi nhật ký), khoá / mở khoá |
| `/nha-tuyen-dung` | Nhà tuyển dụng (design-new 10): gộp công ty + cá nhân, ngăn kéo 5 tab, cảnh cáo / tạm khoá (2FA) / mở khoá |
| `/bao-cao-vi-pham` | Báo cáo vi phạm (design-new 11): gộp vụ, ưu tiên mức độ × hạn, nhận xử lý, quyết định |

Mọi trang web và admin co giãn theo desktop (≥ 1180px), tablet (768 – 1180px) và mobile (390px): admin có thanh trên + menu trượt dưới 1180px, bảng danh sách thành thẻ trên mobile.
Các màn hình admin khác đang được bổ sung theo từng đợt. Quyền trên giao diện chỉ hỗ trợ trải nghiệm; API vẫn kiểm tra RBAC cho từng thao tác.

Đăng nhập, đăng ký/OTP, khôi phục mật khẩu, trang chủ/tìm kiếm, chi tiết việc làm, hồ sơ nhà tuyển dụng/tư vấn viên, ứng tuyển, theo dõi hồ sơ, tư vấn, nhận tin và tổng quan tài khoản đều gọi API. Khu vực ứng viên còn hỗ trợ sửa hồ sơ, xem thông báo, quản lý phiên, đổi mật khẩu, tải ảnh/video và xóa tài khoản.
Cấu trúc thư mục web và quy ước CSS: xem RULE.md mục 2 → 10.

## API (`apps/api`)

Mọi route dưới `/api/v1`. Lỗi luôn có dạng `{ statusCode, code, message, fields? }`.
Danh sách đầy đủ, thử trực tiếp: http://localhost:4000/docs (OpenAPI JSON: `/docs-json`).

| Nhóm | Endpoint chính | Phục vụ màn hình |
| --- | --- | --- |
| Auth | `POST /auth/register` → `/auth/register/verify`, `/auth/login`, `/auth/google`, `/auth/refresh`, `/auth/logout`, `/auth/otp`, `/auth/password/forgot` (email / SĐT, kênh SMS / email – không lộ tài khoản) → `/auth/password/reset` | Đăng ký, đăng nhập, quên mật khẩu (design-new 03) |
| Việc làm | `GET /jobs` (lọc, sắp xếp, phân trang), `/jobs/facets`, `/jobs/:slug`, `/jobs/:slug/similar`, `/jobs/recommended`, `/regions` | Trang chủ, tìm kiếm, chi tiết đơn, việc phù hợp |
| Ứng tuyển | `POST /applications/email-otp` → `POST /applications` (kèm `emailCode`), `GET /me/applications` (tab, tìm, sắp xếp), `/me/applications/summary`, `POST /me/applications/:id/withdraw`, `…/interview/confirm`, `…/interview/change-request`, `POST /me/applications/bulk` | Popup ứng tuyển (OTP email), việc đã ứng tuyển, ứng tuyển nhanh việc đã lưu |
| Tài khoản | `GET /me`, `GET/PATCH /me/profile`, `/me/profile/insights`, `PUT /me/profile/documents/:key`, `/me/dashboard`, `/me/password`, `/me/sessions`, `DELETE /me`, `/me/assets/presign`, `/me/assets/complete` | Hồ sơ, bảo mật, upload ảnh/video |
| Việc đã lưu | `GET /me/saved-jobs` (sắp xếp, lọc ngành, % phù hợp, điều kiện), `PUT/DELETE /me/saved-jobs/:jobId` | Nút lưu việc, trang việc đã lưu |
| Hồ sơ NTD | `GET /employers/:slug`, `/recruiters/:slug`, `/recruiters/:slug/phone`, `PUT/DELETE …/follow` | Trang nhà tuyển dụng, tư vấn viên |
| Cổng NTD | `/employer/me`, `/employer/dashboard`, `/employer/team`, `/employer/partners`, `/employer/jobs` (+ summary, market, form, stats, boost, pause, resume, close), `/employer/applications` (+ notes, status, duplicates, job-match, import), `/employer/interviews` (+ candidates, availability, dời lịch, kết quả, huỷ), `/employer/leads` | Khu quản lý tuyển dụng (design 10 – 17) |
| Tư vấn & tin | `POST /leads/consultations`, `/leads/subscriptions` | Form đăng ký tư vấn, nhận đơn mới ở footer |
| Thông báo | `GET /me/notifications`, `POST …/:id/read`, `…/read-all` – push tôn trọng Cài đặt + giờ yên lặng | Chuông thông báo |
| Thông báo việc làm | `GET/POST /me/alerts` (tối đa 10), `PATCH/DELETE /me/alerts/:id`, `GET /me/alerts/:id/jobs`, `POST …/:id/seen`, `/me/alerts/feed`, `/me/alerts/suggestions`; worker 5 phút / lần (`JOB_ALERT_WORKER`) gửi app + email theo tần suất | C-05 (design-new 04) |
| Cài đặt | `GET/PATCH /me/settings`, `POST /me/email/otp` → `/me/email`, `POST /me/phone/otp` → `/me/phone`, `DELETE /me/sessions` (đăng xuất thiết bị khác), `GET /me/export` (tải dữ liệu JSON) | C-06 (design-new 05) |
| Báo cáo vi phạm | `POST /reports` (khách gửi được), `GET /me/reports`; ≥ 3 người báo "thu phí" / 24 giờ → tin tự tạm ẩn | M18 |
| Mobile | `GET /app/config`, `PUT/DELETE /me/push-tokens` | Ép cập nhật app, thông báo đẩy |
| Hệ thống | `GET /health` | Giám sát |
| Admin | `GET /admin/jobs/pending` (tìm kiếm, lọc nhanh, kiểm tra tự động nội dung), `POST /admin/jobs/:id/approve`, `/admin/jobs/:id/reject` | Kiểm duyệt tin (design-new 07) |
| Admin – xác minh | `GET /admin/verifications` (tab, loại, đối chiếu tự động, thống kê), `GET …/:id`, `POST …/:id/approve`, `/request-info`, `/reject` | design-new 08 |
| Admin – ứng viên | `GET /admin/users` (tab, lọc, thống kê), `GET …/:id`, `POST …/:id/reveal` (`users.pii`, ghi nhật ký), `/lock`, `/unlock` | design-new 09 |
| Admin – NTD | `GET /admin/employers` (gộp công ty + cá nhân), `GET …/:kind/:id`, `POST …/warn`, `/suspend` (mã 2FA `otp`), `/unsuspend` | design-new 10 |
| Admin – báo cáo | `GET /admin/reports` (gộp vụ, ưu tiên mức độ × hạn), `GET …/:id`, `POST …/:id/claim`, `/decide` (khoá cần `users.lock` + mã 2FA) | design-new 11 |
| Admin – nhật ký | `GET /admin/audit-logs` (chỉ đọc) | A-12 |

### Sẵn sàng cho app mobile

- API có phiên bản (`/api/v1`), lỗi có mã cố định, ảnh trả URL tuyệt đối.
- Đăng nhập theo thiết bị: mobile gửi `platform: "ios" | "android"` → nhận `refreshToken` trong body (web dùng cookie httpOnly).
- Đã có đăng ký push token, xoá tài khoản (yêu cầu của store), cấu hình phiên bản app.
- App viết bằng React Native / Expo có thể đặt ở `apps/mobile` và dùng lại `@viecpro/shared`.

Tích hợp thật được bật bằng cấu hình môi trường: Twilio SMS (`OTP_PROVIDER=sms`), email Resend (`EMAIL_PROVIDER=resend` + `RESEND_API_KEY`, `EMAIL_FROM`, `WEB_BASE_URL`), Google Sign-In (`GOOGLE_CLIENT_ID` + `NEXT_PUBLIC_GOOGLE_CLIENT_ID`), Firebase FCM (`PUSH_PROVIDER=fcm`) và S3/R2 (`STORAGE_PROVIDER=s3`). Upload dùng presigned URL và API kiểm tra loại nội dung sau khi tải lên. `REDIS_URL` bật storage throttling dùng chung giữa nhiều instance.

### Việc còn lại (TODO)

- Cấu hình thông tin thật cho Twilio, Resend (xác minh tên miền gửi `viecpro.vn`: SPF, DKIM), Google, FCM và S3/R2 trước khi bật các provider production. Production từ chối khởi động nếu `EMAIL_PROVIDER=console`.
- `POST /applications` nay bắt buộc `email` + `emailCode` – app mobile bản cũ (chưa có bước OTP email) cần cập nhật; cân nhắc tách `/api/v2/applications` nếu đã phát hành app.
- Chưa có tích hợp: kho giấy tờ riêng tư mã hoá (CCCD, hộ chiếu, CV – hiện chỉ nhận ảnh chân dung / ảnh 4×6), gửi Zalo OA / SMS lời mời phỏng vấn, tạo phòng Zoom / Meet tự động, nhận dạng CCCD (OCR), bài test tiếng Nhật, xuất CV PDF từ server, tin nhắn trong app, thanh toán gói dịch vụ, danh sách việc lưu tuỳ chỉnh.
- Mở rộng e2e 401/403/404 sang tất cả route có phân quyền và sở hữu dữ liệu.
- Chạy `npm audit --omit=dev` và xử lý lỗ hổng runtime trước khi release.
- Các chỗ `[SỐ GIẤY PHÉP]`, `[MÃ SỐ THUẾ]`, `[GIỜ LÀM VIỆC]` cần thay bằng thông tin thật trước khi đưa lên.
