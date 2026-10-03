# RULE-BE – Quy tắc backend, bảo mật & phân quyền

Áp dụng cho `apps/api` (NestJS), `packages/shared` và mọi client gọi API (web, admin, mobile).
Quy tắc giao diện web xem `RULE.md`.

**Mức độ:**
- **[BẮT BUỘC]**: vi phạm thì không được merge.
- **[NÊN]**: làm theo, trừ khi có lý do ghi rõ trong PR.

Mọi quy tắc bảo mật và phân quyền trong file này đều là **[BẮT BUỘC]**.

---

## 1. Kiến trúc & thư mục

```
apps/api/
├─ prisma/                 schema.prisma · migrations/ · seed.ts
├─ prisma.config.ts        cấu hình Prisma 7 (URL database đọc từ env)
└─ src/
   ├─ main.ts              helmet, CORS, cookie, prefix /api/v1, Swagger (chỉ ngoài production)
   ├─ app.module.ts        ghép module + guard / filter toàn cục
   ├─ config/env.ts        biến môi trường kiểm tra bằng zod – sai là dừng app
   ├─ core/                hạ tầng dùng chung, KHÔNG chứa nghiệp vụ
   │  ├─ auth/             AuthGuard, @Public, @Roles, @CurrentUser (+ @RequirePermission cho admin)
   │  ├─ http/             ApiException, ZodBody / ZodQuery, filter lỗi, phân trang
   │  ├─ prisma/ assets/ utils/
   ├─ modules/<tinh-nang>/ *.module.ts · *.controller.ts · *.service.ts · *.spec.ts
   │  └─ admin/<tinh-nang>/  toàn bộ API quản trị, tách khỏi module người dùng
   └─ generated/prisma/    Prisma client sinh tự động – không sửa, không commit
```

- **[BẮT BUỘC]** Controller chỉ nhận request, gọi service, trả kết quả. Nghiệp vụ và truy vấn nằm trong service.
- **[BẮT BUỘC]** Import tương đối phải có đuôi `.js` (ESM). Không import chéo vào bên trong module khác. Cần dùng thì module kia phải `exports` service.
- **[BẮT BUỘC]** Thứ gì web, admin và mobile cùng cần (enum, nhãn, schema zod, kiểu response) đặt trong `packages/shared`. Không định nghĩa lại ở từng app.
- **[NÊN]** Mỗi service dưới khoảng 300 dòng. Dài hơn thì tách theo nghiệp vụ con.

---

## 2. Quy ước API

- **[BẮT BUỘC]** Mọi route nằm dưới `/api/v1`. Thay đổi phá vỡ tương thích (đổi tên trường, đổi kiểu, bỏ trường, đổi nghĩa) thì tạo route **v2** và giữ v1 cho app mobile cũ ít nhất 6 tháng. Thêm trường mới thì không tính là phá vỡ.
- Phân vùng đường dẫn:

| Tiền tố | Ai gọi | Ví dụ |
| --- | --- | --- |
| `/auth/*` | Mọi người | đăng ký, đăng nhập, refresh |
| `/jobs`, `/employers`, `/recruiters`, `/regions`, `/leads` | Công khai (có thể kèm token) | tìm việc, hồ sơ NTD |
| `/me/*` | Chủ tài khoản | hồ sơ, việc đã lưu, thông báo |
| `/employer/*` | Vai trò `employer` | quản lý đơn, ứng viên |
| `/admin/*` | Vai trò `admin` + quyền cụ thể | quản trị hệ thống |

- **[BẮT BUỘC]** Danh sách luôn phân trang và trả `Paginated<T>` `{ items, page, limit, total, hasMore }`, với `limit ≤ 50` (admin `≤ 100`).
- **[BẮT BUỘC]** Ngày giờ trả ISO 8601 (UTC). URL ảnh luôn tuyệt đối (`AssetUrlService.url()`). Tiền là số nguyên (yên / đồng).
- **[BẮT BUỘC]** Kiểu response khai báo trong `packages/shared/src/contracts.ts` và dùng làm kiểu trả về của controller.
- **[BẮT BUỘC]** Mọi route có `@ApiOperation({ summary })` tiếng Việt và `@ApiBearerAuth()` nếu cần token.
- Đường dẫn: danh từ số nhiều, kebab-case. Hành động không phải CRUD dùng `POST /resource/:id/<dong-tu>` (vd. `/jobs/:id/close`).

---

## 3. Kiểm tra dữ liệu đầu vào

- **[BẮT BUỘC]** Body và query **luôn** đi qua schema zod (trong `packages/shared/src/schemas/`) bằng `@ZodBody(schema)` / `@ZodQuery(schema)`. Không đọc `@Body()` / `@Query()` thô, không dùng class-validator.
- **[BẮT BUỘC]** Schema dùng `z.object` mặc định (bỏ trường lạ). **Cấm** `.passthrough()` / `.loose()` cho dữ liệu ghi vào DB, để chặn mass-assignment (vd. client tự gửi `role: 'admin'`).
- **[BẮT BUỘC]** Chuỗi có `.trim()` và `.max()`. Số có `min` / `max`. Mảng có `.max()`. Không nhận dữ liệu không giới hạn kích thước.
- **[BẮT BUỘC]** `@Param('id')` dùng trong truy vấn phải luôn kèm điều kiện sở hữu hoặc quyền (xem mục 6). Không bao giờ tin id từ client.
- **[BẮT BUỘC]** Số điện thoại chuẩn hoá về E.164 (`phoneSchema`), email về chữ thường, trước khi lưu và trước khi so sánh.
- **[BẮT BUỘC]** Body JSON giới hạn 1 MB (mặc định của Express). File không gửi qua JSON (xem mục 9.6).

---

## 4. Lỗi & log

- **[BẮT BUỘC]** Lỗi nghiệp vụ dùng `throw new ApiException('MA_LOI', 'Thông báo tiếng Việt', HttpStatus.X, fields?)`. Mã lỗi khai báo trong `ERROR_CODES` (shared). Client dựa vào `code`, không so `message`.
- **[BẮT BUỘC]** Response lỗi luôn có dạng `{ statusCode, code, message, fields? }`. Không trả stack trace, câu SQL, tên bảng hay thông báo gốc của thư viện (đã có filter toàn cục).
- **[BẮT BUỘC]** Lỗi 5xx ghi log đầy đủ ở server. Client chỉ nhận `INTERNAL_ERROR`.
- **[BẮT BUỘC]** **Không ghi log**: mật khẩu, mã OTP (trừ `ConsoleOtpSender` ở dev), access/refresh token, hash, nội dung header `Authorization` / `Cookie`, số CCCD / hộ chiếu.
- **[NÊN]** Log số điện thoại / email ở dạng che (`0912 xxx 678`). Production dùng log dạng JSON và có `requestId`.

---

## 5. Xác thực (authentication)

### 5.1 Token
- **[BẮT BUỘC]** Access token là JWT HS256, ký bằng `JWT_SECRET` (≥ 32 ký tự ngẫu nhiên), sống **15 phút** (admin: **10 phút**). Payload chỉ chứa `sub`, `role`, `sid` (cùng `perm` version cho admin). Không đưa dữ liệu cá nhân vào JWT.
- **[BẮT BUỘC]** Refresh token là chuỗi ngẫu nhiên 48 byte. DB chỉ lưu **SHA-256**. Mỗi lần refresh thì **xoay vòng** (cấp token mới, token cũ mất hiệu lực).
- **[BẮT BUỘC]** Phát hiện **dùng lại refresh token đã xoay** thì thu hồi cả phiên đó (dấu hiệu token bị lộ).
- **[BẮT BUỘC]** Web và admin nhận refresh token qua cookie `httpOnly`, `Secure` (production), `SameSite=Lax` (admin: `Strict`), `path` giới hạn ở `/api/v1/auth`. Mobile nhận trong body và phải lưu trong Keychain / Keystore, không lưu AsyncStorage.
- **[BẮT BUỘC]** Client web và admin giữ access token **trong bộ nhớ** (biến JS), không lưu `localStorage` / `sessionStorage`.

### 5.2 Mật khẩu & OTP
- **[BẮT BUỘC]** Mật khẩu băm bằng scrypt (`password.ts`), có salt riêng, so sánh bằng `timingSafeEqual`. Quy tắc độ mạnh lấy từ `PASSWORD_RULES` (shared) cho cả client lẫn server.
- **[BẮT BUỘC]** OTP gồm 6 số sinh bằng `crypto.randomInt`, chỉ lưu HMAC, sống 5 phút, cho sai tối đa 5 lần, gửi lại sau 60 giây, tối đa 5 mã / giờ / số. Dùng xong đánh dấu `consumedAt`.
- **[BẮT BUỘC]** `devCode` chỉ trả khi `NODE_ENV !== 'production'`. `OTP_PROVIDER=console` **cấm** dùng ở production (env.ts phải từ chối khởi động).
- **[BẮT BUỘC]** Đổi hoặc đặt lại mật khẩu thì thu hồi các phiên khác. Đặt lại mật khẩu bằng OTP thì thu hồi **tất cả** phiên.

### 5.3 Chống dò tài khoản & brute force
- **[BẮT BUỘC]** Đăng nhập sai luôn trả cùng một thông báo `INVALID_CREDENTIALS`, không cho biết sai email hay sai mật khẩu.
- **[BẮT BUỘC]** `/auth/otp` không cho biết số điện thoại đã đăng ký hay chưa (trả response giống nhau).
- **[BẮT BUỘC]** Route đăng nhập, OTP, đặt lại mật khẩu, form công khai có `@Throttle` chặt (≤ 5 lần / phút / IP).
- **[BẮT BUỘC]** Khoá tạm tài khoản sau **10 lần đăng nhập sai liên tiếp** trong 15 phút (khoá 15 phút), không phụ thuộc IP.
- Ngoại lệ đã chấp nhận: `/auth/register` báo `PHONE_TAKEN` để người dùng biết chuyển sang đăng nhập (đánh đổi UX, đã có giới hạn tần suất).

### 5.4 Phiên & thu hồi
- **[BẮT BUỘC]** Mỗi lần đăng nhập tạo một `Session` gắn thiết bị. Người dùng xem và đăng xuất từng thiết bị qua `/me/sessions`.
- **[BẮT BUỘC]** Tài khoản bị khoá hoặc xoá thì refresh phải thất bại ngay. Access token cũ hết hạn tối đa sau 15 phút. **Route admin kiểm tra DB mỗi request** (phiên còn hiệu lực, tài khoản chưa khoá), không chỉ tin JWT.

---

## 6. Phân quyền (authorization)

Có **3 lớp**. Request phải qua đủ các lớp liên quan.

### Lớp 1: Vai trò tài khoản (`User.role`)
| Vai trò | Tạo bằng | Được vào |
| --- | --- | --- |
| `seeker` | Tự đăng ký | Công khai, `/me/*` |
| `employer` | Tự đăng ký (công ty chờ duyệt) | Công khai, `/me/*`, `/employer/*` |
| `admin` | **Chỉ** bằng CLI / seed hoặc super admin tạo trong trang admin | `/admin/*` (+ quyền ở lớp 3) |

- **[BẮT BUỘC]** **Mặc định từ chối**: mọi route cần đăng nhập, trừ route gắn `@Public()`. Route công khai không được trả dữ liệu riêng tư.
- **[BẮT BUỘC]** Giới hạn vai trò bằng `@Roles(...)` ở **cấp controller**. Không tự kiểm tra `user.role` rải rác trong service.
- **[BẮT BUỘC]** Đăng ký công khai **không bao giờ** tạo được `admin` (schema đăng ký chỉ nhận `seeker | employer`). Vai trò không được đổi qua API người dùng.
- **[BẮT BUỘC]** `admin` **không** tự động có quyền của `seeker` / `employer`. Admin làm việc qua `/admin/*`, không gọi `/employer/*` thay người dùng. Muốn hỗ trợ thì dùng API admin có audit log.

### Lớp 2: Quyền sở hữu dữ liệu (chống IDOR)
- **[BẮT BUỘC]** Mọi truy vấn dữ liệu riêng phải có điều kiện chủ sở hữu **trong chính câu truy vấn**:
  - ứng viên: `where: { id, userId: user.sub }`
  - nhà tuyển dụng: `where: { id, job: { employerId } }` (hoặc `recruiterId` với NTD cá nhân)

  Không được lấy bản ghi theo `id` rồi mới so chủ sở hữu bằng `if`.
- **[BẮT BUỘC]** Không tìm thấy **hoặc** không có quyền thì đều trả `404 NOT_FOUND`, không trả `403`, để không lộ việc bản ghi tồn tại.
- **[BẮT BUỘC]** Nhà tuyển dụng chỉ thấy ứng viên **đã ứng tuyển đơn của mình**. Số điện thoại ứng viên chỉ hiện trong ngữ cảnh đó.
- **[BẮT BUỘC]** Số điện thoại đầy đủ của tư vấn viên chỉ trả khi đã đăng nhập (`/recruiters/:slug/phone`), và có giới hạn tần suất.

### Lớp 3: Quyền quản trị (RBAC, chỉ cho `admin`)
- **[BẮT BUỘC]** Mỗi route `/admin/*` khai báo đúng một quyền bằng `@RequirePermission('<nhom>.<hanh-dong>')`. Route admin **không có** decorator này thì guard từ chối (fail-closed).
- **[BẮT BUỘC]** Quyền được gán qua **vai trò quản trị** (`AdminRole`). Không gán quyền trực tiếp cho từng người. Danh sách quyền là hằng số `ADMIN_PERMISSIONS` trong `packages/shared`, dùng chung để ẩn/hiện nút ở giao diện admin.
- **[BẮT BUỘC]** Giao diện admin ẩn nút theo quyền **chỉ để tiện**. Kiểm tra thật luôn nằm ở API.

**Danh sách quyền:**

| Quyền | Cho phép |
| --- | --- |
| `dashboard.read` | Xem số liệu tổng quan |
| `users.read` | Xem danh sách tài khoản (thông tin liên hệ bị che) |
| `users.pii` | Xem đầy đủ số điện thoại / email / địa chỉ |
| `users.lock` | Khoá / mở khoá tài khoản, đăng xuất mọi thiết bị |
| `employers.read` | Xem nhà tuyển dụng, tư vấn viên |
| `employers.verify` | Duyệt / gỡ xác minh nhà tuyển dụng |
| `employers.manage` | Sửa hồ sơ công khai NTD / tư vấn viên |
| `jobs.read` | Xem mọi đơn hàng (kể cả nháp, đã đóng) |
| `jobs.moderate` | Duyệt, ẩn, đóng đơn vi phạm |
| `jobs.manage` | Tạo / sửa đơn thay NTD |
| `applications.read` | Xem hồ sơ ứng tuyển (kèm `users.pii` để xem liên hệ) |
| `leads.read` / `leads.manage` | Xem / xử lý khách đăng ký tư vấn |
| `content.manage` | Banner, quảng cáo, danh mục ngành, tỉnh |
| `notifications.send` | Gửi thông báo hàng loạt |
| `admins.manage` | Tạo / khoá admin, gán vai trò quản trị |
| `audit.read` | Xem nhật ký thao tác |
| `settings.manage` | Cấu hình hệ thống, phiên bản app |
| `billing.read` | Xem giao dịch thanh toán |
| `data.export` | Xuất dữ liệu ra file |

**Vai trò quản trị mặc định** (chốt khi dựng admin, có thể chỉnh):

| Vai trò | Quyền |
| --- | --- |
| `super_admin` | Tất cả |
| `moderator` (kiểm duyệt) | dashboard.read, jobs.read, jobs.moderate, employers.read, employers.verify, users.read, users.lock, audit.read |
| `support` (CSKH) | dashboard.read, users.read, users.pii, applications.read, leads.read, leads.manage, employers.read, jobs.read, billing.read |
| `content` (nội dung) | dashboard.read, content.manage, jobs.read |

---

## 7. Hệ thống admin

- **[BẮT BUỘC]** API admin nằm trong `src/modules/admin/**`, dưới `/api/v1/admin/*`, và **tách hẳn** service khỏi module người dùng. Được dùng chung `PrismaService` và mapper, không dùng chung controller.
- **[BẮT BUỘC]** Đăng nhập admin bằng `/auth/admin/login` riêng. Tài khoản admin **bắt buộc bật 2FA (TOTP)** ngay lần đăng nhập đầu. Mã khôi phục 2FA chỉ lưu hash.
- **[BẮT BUỘC]** Phiên admin: access 10 phút, refresh tối đa **12 giờ**, không có "ghi nhớ đăng nhập", cookie `SameSite=Strict`. Không hoạt động 30 phút thì tự đăng xuất.
- **[BẮT BUỘC]** **Nhật ký thao tác (AuditLog)**: mọi thao tác **ghi** của admin (tạo, sửa, xoá, khoá, duyệt, xuất dữ liệu, xem `users.pii`) lưu `adminId`, hành động, loại và id đối tượng, dữ liệu **trước / sau** (đã bỏ trường nhạy cảm), IP, user-agent, thời điểm. AuditLog **chỉ được thêm**, không có API sửa / xoá.
- **[BẮT BUỘC]** Bảo vệ quyền cao nhất:
  - admin không tự đổi vai trò, không tự khoá chính mình
  - không xoá / khoá / hạ quyền `super_admin` cuối cùng
  - chỉ `super_admin` gán được vai trò `super_admin`
  - đổi quyền của admin thì thu hồi mọi phiên của người đó
- **[BẮT BUỘC]** Danh sách trong admin **che thông tin liên hệ** (`0912 xxx 678`). Hiện đầy đủ cần quyền `users.pii` và được ghi audit.
- **[BẮT BUỘC]** Xuất dữ liệu (`data.export`) giới hạn 10.000 dòng mỗi lần, ghi audit, file chỉ tải được 1 lần qua link hết hạn sau 15 phút.
- **[BẮT BUỘC]** Hành động phá huỷ (xoá, khoá hàng loạt, gửi thông báo hàng loạt) yêu cầu xác nhận lại bằng mã 2FA trong request (`otp` trong body).
- **[NÊN]** Giới hạn IP truy cập admin (`ADMIN_IP_ALLOWLIST`) ở production. Admin chạy trên tên miền riêng (`admin.viecpro.vn`).
- **[BẮT BUỘC]** Kiểm duyệt: đơn hàng của NTD **chưa xác minh** vào trạng thái chờ duyệt, không hiển thị công khai cho tới khi `jobs.moderate` duyệt.

---

## 8. Bảo vệ dữ liệu cá nhân

- **[BẮT BUỘC]** Response chỉ trả trường cần thiết, qua `select` hoặc mapper. **Không bao giờ** trả `passwordHash`, `codeHash`, `refreshTokenHash`, `googleId`, khoá 2FA, token push của người khác.
- **[BẮT BUỘC]** Không trả nguyên bản ghi Prisma (`return prisma.user.findMany()`) ra API.
- **[BẮT BUỘC]** Xoá tài khoản là xoá mềm (`deletedAt`), ẩn danh tên / số điện thoại / email, thu hồi phiên và push token. Hồ sơ ứng tuyển đã gửi giữ theo chính sách bảo mật đã công bố.
- **[BẮT BUỘC]** Giấy tờ tuỳ thân (CCCD, hộ chiếu), nếu lưu sau này, phải mã hoá khi lưu trữ, nằm ở bucket riêng không công khai, và chỉ xem qua link ký có hạn.
- **[NÊN]** Dữ liệu ứng tuyển của tài khoản đã xoá được ẩn danh sau 24 tháng.

---

## 9. Bảo mật ứng dụng

### 9.1 Truy vấn
- **[BẮT BUỘC]** Chỉ dùng Prisma query hoặc `$queryRaw` dạng **tagged template** (tự escape). **Cấm** `$queryRawUnsafe` / `$executeRawUnsafe` với dữ liệu từ người dùng.
- **[BẮT BUỘC]** Sắp xếp / lọc động chỉ nhận giá trị trong danh sách cho phép (enum zod như `JOB_SORTS`). Không đưa tên cột từ client vào truy vấn.

### 9.2 HTTP
- **[BẮT BUỘC]** `helmet()` bật. CORS chỉ cho origin trong `CORS_ORIGINS` (web, admin), `credentials: true`, **không** dùng `*`.
- **[BẮT BUỘC]** Route đổi dữ liệu dùng POST / PUT / PATCH / DELETE, không bao giờ GET.
- **[BẮT BUỘC]** Swagger (`/docs`) tắt ở production.
- **[BẮT BUỘC]** Production đứng sau HTTPS. `trust proxy` khớp số lớp proxy thật, để giới hạn tần suất theo IP chạy đúng.

### 9.3 CSRF
- Refresh token trong cookie chỉ dùng ở `/auth/refresh` và `/auth/logout`. Các API khác xác thực bằng header `Authorization`, nên không bị CSRF.
- **[BẮT BUỘC]** `/auth/refresh` bằng cookie phải có header `X-Requested-With: viecpro` (trình duyệt chặn site lạ tự thêm header khi gọi cross-origin).

### 9.4 Giới hạn tần suất
- **[BẮT BUỘC]** Toàn cục: 120 request / phút / IP. Route nhạy cảm: ≤ 5 / phút. Khi chạy nhiều instance phải dùng storage Redis cho throttler.

### 9.5 Liên kết ngoài / SSRF
- **[BẮT BUỘC]** Server không tự tải URL do người dùng nhập. Nếu bắt buộc phải tải: chỉ chấp nhận `https`, chặn IP nội bộ / localhost / metadata, có timeout.

### 9.6 Upload file (khi làm)
- **[BẮT BUỘC]** Upload thẳng lên S3 / R2 bằng **presigned URL** do API cấp. Kiểm tra loại file theo nội dung (ảnh: jpg / png / webp, video: mp4), giới hạn dung lượng (ảnh 5 MB, video 50 MB). Tên file do server sinh. Bucket private, xem qua CDN hoặc link ký.

### 9.7 Thư viện
- **[BẮT BUỘC]** Không thêm thư viện chưa rõ nguồn hoặc lâu không bảo trì. Chạy `npm audit --omit=dev` trước mỗi lần release. Lỗ hổng **high / critical** ở gói chạy production phải xử lý trước khi deploy.

---

## 10. Database & migration

- **[BẮT BUỘC]** Sửa `prisma/schema.prisma` rồi chạy `npm run db:migrate -- --name <ten-thay-doi>`. **Commit thư mục migration.** Không sửa migration đã chạy ở môi trường chung. Production chỉ chạy `db:deploy`.
- **[BẮT BUỘC]** Giá trị enum Prisma phải trùng hằng số trong `packages/shared/src/enums.ts`.
- **[BẮT BUỘC]** Thao tác nhiều bảng phải nằm trong `prisma.$transaction`.
- **[BẮT BUỘC]** Không xoá cứng tài khoản người dùng. Dữ liệu nghiệp vụ dùng `status` / `deletedAt` khi cần giữ lịch sử.
- **[BẮT BUỘC]** Database user của app chỉ có quyền trên schema của app, không dùng superuser. Backup hằng ngày, giữ 30 ngày, thử khôi phục mỗi quý.
- **[NÊN]** Cột `Json` (khối hồ sơ, chi tiết đơn) phải có schema zod kiểm tra khi ghi và khi đọc.
- **[NÊN]** Truy vấn danh sách có index phù hợp. Kiểm tra bằng `EXPLAIN` khi bảng > 100.000 dòng.

---

## 11. Tích hợp bên ngoài

- **[BẮT BUỘC]** OTP (`OtpSender`), push (`PushSender`), email, lưu trữ file là **abstract class**. Tích hợp thật bằng class mới rồi đổi provider trong module. Không gọi SDK trực tiếp trong service nghiệp vụ.
- **[BẮT BUỘC]** Lỗi của dịch vụ ngoài (push, email) không làm hỏng nghiệp vụ chính: bắt lỗi và ghi log.
- **[BẮT BUỘC]** Khoá API của bên thứ ba chỉ nằm trong biến môi trường, không trong code, log hay response.
- **[BẮT BUỘC]** Webhook nhận từ bên ngoài phải kiểm tra chữ ký trước khi xử lý.

---

## 12. App mobile

- **[BẮT BUỘC]** Không phụ thuộc cookie / session server cho mobile. Mọi thứ đi qua token, gửi `platform: ios | android` khi đăng nhập / refresh.
- **[BẮT BUỘC]** Giữ `GET /app/config` (phiên bản tối thiểu để ép cập nhật), `PUT /me/push-tokens`, `DELETE /me` (xoá tài khoản theo yêu cầu store).
- **[BẮT BUỘC]** `link` trong thông báo viết dạng route web (`/viec-lam/<slug>`) để app chuyển thành deep link. Không chứa token hay dữ liệu cá nhân.
- **[NÊN]** Sinh client cho app từ `/docs-json` nếu app không viết bằng TypeScript.

---

## 13. Môi trường & secrets

- **[BẮT BUỘC]** Biến môi trường khai báo trong `src/config/env.ts` (zod) và có mẫu trong `.env.example`. Không đọc `process.env` rải rác.
- **[BẮT BUỘC]** `.env` không commit. Secrets production lưu trong secret manager của hạ tầng. Mỗi môi trường (dev / staging / production) dùng secret **khác nhau**.
- **[BẮT BUỘC]** `env.ts` từ chối khởi động ở production nếu: `JWT_SECRET` / `OTP_SECRET` còn giá trị mẫu, `OTP_PROVIDER=console`, `CORS_ORIGINS` chứa `localhost`.
- **[BẮT BUỘC]** Lộ secret thì xoay ngay (đổi `JWT_SECRET` sẽ đăng xuất toàn bộ người dùng, chấp nhận được).

---

## 14. Test & review

- **[BẮT BUỘC]** Logic tính toán thuần (điểm phù hợp, % hồ sơ, quyền) có unit test `*.spec.ts`.
- **[BẮT BUỘC]** Mỗi route có phân quyền phải có test e2e cho 3 trường hợp: **chưa đăng nhập → 401**, **sai vai trò / thiếu quyền → 403**, **dữ liệu người khác → 404**.
- **[BẮT BUỘC]** Trước khi merge: `npm run typecheck`, `npm run test`, `npx oxlint --type-aware src/` (trong `apps/api`) đều pass.
- **[NÊN]** PR đụng tới auth, phân quyền, admin hoặc dữ liệu cá nhân cần một người khác review.

---

## 15. Checklist PR backend

- [ ] Schema zod mới / sửa nằm trong `packages/shared`, có `max` cho chuỗi / mảng
- [ ] Route đúng tiền tố, có `@ApiOperation`, đúng `@Public` / `@Roles` / `@RequirePermission`
- [ ] Truy vấn dữ liệu riêng có điều kiện chủ sở hữu ngay trong `where`
- [ ] Response qua mapper / `select`, không lộ trường nhạy cảm
- [ ] Thao tác ghi của admin có AuditLog
- [ ] Lỗi dùng `ApiException` + mã trong `ERROR_CODES`
- [ ] Có migration nếu đổi schema, seed vẫn chạy
- [ ] Không log mật khẩu / OTP / token
- [ ] typecheck, test, lint pass

---

## 16. Hiện trạng: các điểm code CHƯA đạt quy tắc

Rà soát ngày 01/10/2026. Sửa cùng đợt dựng hệ thống admin. Đánh dấu ✅ khi xong.

| # | Quy tắc | Hiện trạng | Ưu tiên |
| --- | --- | --- | --- |
| 1 | 6 – admin không tự có quyền employer | Đăng nhập công khai loại admin; `AuthGuard` áp dụng đúng `@Roles` | ✅ Đã xử lý |
| 2 | 6 lớp 3, 7 – RBAC, 2FA, AuditLog | Đã có `AdminRole`, `@RequirePermission`, TOTP và `AuditLog` | ✅ Đã xử lý |
| 3 | 5.4 – khoá tài khoản | `lockedAt` được kiểm tra ở xác thực, đăng nhập và refresh | ✅ Đã xử lý |
| 4 | 5.1 – thu hồi phiên khi dùng lại refresh token | Token cũ bị phát hiện và phiên bị thu hồi sau khoảng an toàn chống refresh đồng thời | ✅ Đã xử lý |
| 5 | 13 – chặn cấu hình nguy hiểm ở production | `env.ts` chặn secret mẫu, OTP console và CORS localhost | ✅ Đã xử lý |
| 6 | 5.3 – khoá sau 10 lần đăng nhập sai | Có bộ đếm liên tiếp và khoá tạm độc lập với IP | ✅ Đã xử lý |
| 7 | 9.3 – header `X-Requested-With` cho refresh bằng cookie | `/auth/refresh` xác thực header khi dùng cookie | ✅ Đã xử lý |
| 8 | 7 – đơn của NTD chưa xác minh phải chờ duyệt | Tin của nhà tuyển dụng chưa xác minh chuyển `pending` | ✅ Đã xử lý |
| 9 | 14 – test e2e phân quyền 401 / 403 / 404 | Có e2e cho `/me/*`, ứng tuyển, `/reports`; cách ly dữ liệu mọi route `/employer/*` nhận id trên Postgres thật; ma trận quyền tự quét **mọi** route `/admin/*` (401 / 403 NTD / 403 thiếu đúng quyền / qua guard khi có quyền) + đối chiếu quyền route mới với bảng mục 6. Chạy `npm run test:e2e:db` | ✅ Đã xử lý |
| 12 | 8 – giấy tờ tuỳ thân phải ở kho riêng mã hoá | Chưa có kho riêng: API chỉ nhận ảnh chân dung (NTD thêm ứng viên) và ảnh 4×6 (ứng viên); CCCD / hộ chiếu / CV kiểm tra bản gốc | Trung bình |
| 14 | Spec R4 – không thu thập CCCD | Đã bỏ trường xác minh CCCD, điểm tin cậy dựa trên CCCD và mục giấy tờ CCCD; giao diện và API không nhận hoặc lưu CCCD | ✅ Đã xử lý |
| 13 | 2 – thay đổi phá vỡ cần route v2 | `POST /applications` bắt buộc `email` + `emailCode` (xác nhận email theo yêu cầu sản phẩm) – app mobile cũ cần cập nhật | Cao (nếu đã phát hành app) |
| 10 | 9.4 – throttler dùng Redis khi nhiều instance | Đã có Redis storage; bật bằng `REDIS_URL` khi chạy nhiều instance. Mặc định dev vẫn dùng bộ nhớ | Thấp |
| 11 | 9.7 – `npm audit` | `npm audit --omit=dev` báo 4 high ở `deepmerge-ts` / `mysql2`, đi theo Prisma CLI 7.10 qua peer optional của `@prisma/client`; `npm audit fix --force` sẽ hạ Prisma xuống 6 nên chưa áp dụng | Thấp |
