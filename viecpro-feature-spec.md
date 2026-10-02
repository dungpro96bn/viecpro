# viecpro — Đặc tả tính năng & lộ trình build production

> **Phiên bản:** 1.0 · 02/10/2026
> **Nguồn thiết kế:** Claude Design canvas `viecpro` (31 board: 23 web + 2 mobile + 6 admin)
> **Ngôn ngữ giao diện:** Tiếng Việt (chính), sẵn sàng i18n `ja`, `en`

---

## 0. Hướng dẫn cho Claude khi đọc file này

1. **Đọc hết mục 1–5 trước khi viết dòng code nào.** Đây là luật nghiệp vụ và kiến trúc bắt buộc.
2. **Build đúng thứ tự Phase ở mục 10.** Không nhảy phase. Mỗi phase phải đạt toàn bộ *Acceptance criteria* và *Definition of Done* (mục 11) rồi mới sang phase tiếp theo.
3. **Mỗi màn hình đều có mã tham chiếu** (`W-xx` web, `C-xx` tài khoản ứng viên, `B-xx` Business web, `A-xx` admin, `MS-xx` app tìm việc, `ME-xx` app Business). Commit, PR và test phải ghi mã màn liên quan.
4. **Bám sát design.** Tên board trong canvas được ghi ở cột *Board*. Khi chi tiết trong file này mâu thuẫn với design → **design thắng về giao diện, file này thắng về nghiệp vụ**.
5. **Các mục đánh dấu `[Gợi ý]`** là tính năng đề xuất thêm, chưa có trong design. Chỉ build khi tới phase tương ứng, và phải dựng UI theo cùng design system.
6. **Luật cấm tuyệt đối** (xem 3.1): không đăng nhập Zalo, không bước "Chọn loại tài khoản", không thu thập hay xác minh CCCD, không dùng icon ngôi sao 4 cánh kiểu "AI".
7. Khi không chắc, chọn phương án **an toàn cho người lao động** (minh bạch chi phí, bảo vệ dữ liệu) và ghi chú `TODO(decision)` trong code.

---

## 1. Tổng quan sản phẩm

**viecpro** là nền tảng việc làm Nhật Bản minh bạch cho người lao động Việt Nam. Phạm vi gồm ba chương trình: **Thực tập sinh kỹ năng (TTS)**, **Kỹ năng đặc định (Tokutei)** và **Kỹ sư – Trí thức**.

| Bề mặt | Domain đề xuất | Người dùng | Board trong design |
|---|---|---|---|
| Web công khai + tài khoản ứng viên | `viecpro.vn` | Khách, ứng viên | Main, Search, JobDetail, ApplyModal, Employer, Recruiter, Login, Register, ForgotPassword, Account, My* |
| Web Business | `business.viecpro.vn` | Doanh nghiệp XKLĐ, NTD cá nhân/CTV | EmployerDashboard, RecruiterDashboard, Mgmt* |
| Web Super Admin | `admin.viecpro.vn` | Nhân sự vận hành viecpro | Admin* |
| App mobile (1 app, 2 chế độ) | iOS / Android | Ứng viên (chế độ Tìm việc), NTD (chế độ Business) | MobileSeeker (27 màn), MobileEmployer (21 màn) |
| Admin mobile `[Gợi ý]` | PWA của `admin.viecpro.vn` | Admin xử lý nhanh | Chưa có design |

**Giá trị cốt lõi:**

- **Minh bạch:** lương, thực lĩnh, chi phí xuất cảnh và phí phải công khai trên từng tin.
- **Tin thật:** NTD được xác minh, tin được kiểm duyệt, có kênh báo cáo vi phạm.
- **Nhanh:** ứng tuyển 1 chạm, có cán bộ gọi lại trong 30 phút.
- **Ít chữ, nhiều ý:** mỗi màn chỉ hiện thông tin chính. Chi tiết nằm sau "Xem chi tiết" / "Xem thêm".

---

## 2. Vai trò & phân quyền

### 2.1 Vai trò

| Mã | Vai trò | Mô tả | Đăng nhập ở |
|---|---|---|---|
| `guest` | Khách | Chưa đăng nhập. Xem trang chủ, tìm kiếm, chi tiết tin, trang công ty | Web, app (chế độ Tìm việc) |
| `seeker` | Ứng viên | Người lao động tìm việc | Web, app Tìm việc |
| `org_owner` | Chủ tài khoản doanh nghiệp | Người tạo tài khoản công ty XKLĐ, quản lý gói và thành viên | Business web/app |
| `org_admin` | Quản trị viên DN | Toàn quyền trừ chuyển quyền sở hữu và xoá công ty | Business |
| `org_recruiter` | Cán bộ tuyển dụng | Đăng/sửa tin được giao, xử lý ứng viên, đặt lịch | Business |
| `org_viewer` `[Gợi ý]` | Chỉ xem | Xem báo cáo, không chỉnh sửa | Business |
| `ctv` | NTD cá nhân / Cộng tác viên | Cá nhân tuyển dụng. **Bắt buộc liên kết ≥ 1 doanh nghiệp đối tác có giấy phép** | Business (chế độ CTV) |
| `admin_super` | Super Admin | Toàn quyền, quản lý phân quyền | Admin web |
| `admin_mod` | Kiểm duyệt viên | Duyệt tin, xử lý báo cáo | Admin web |
| `admin_verify` | Xác minh viên | Xác minh doanh nghiệp, CTV | Admin web |
| `admin_support` | CSKH | Xem ứng viên/NTD, hỗ trợ tài khoản, không xem tài chính | Admin web |
| `admin_finance` | Tài chính | Gói, giao dịch, hoàn tiền, hoa hồng | Admin web |

**Quy tắc tài khoản:**

- Một tài khoản (`user`) có thể vừa là `seeker` vừa là thành viên của một hoặc nhiều tổ chức. Vai trò được chọn theo **ngữ cảnh đăng nhập** (app chế độ Tìm việc / Business), không theo bước chọn loại tài khoản.
- Tài khoản admin **tách biệt hoàn toàn**: bảng `admin_users` riêng, bắt buộc 2FA, giới hạn IP tuỳ chọn, không dùng chung phiên với web/app.

### 2.2 Ma trận quyền (rút gọn)

| Hành động | guest | seeker | org_recruiter | org_admin/owner | ctv | admin_mod | admin_super |
|---|---|---|---|---|---|---|---|
| Xem/tìm tin, trang công ty | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ứng tuyển, lưu tin, tạo thông báo việc | ✗ → sheet đăng nhập | ✓ | – | – | – | – | – |
| Đăng / sửa tin | – | – | Tin được giao | ✓ | Tin của mình / đơn từ đơn vị liên kết | – | – |
| Xem hồ sơ ứng viên | – | Của mình | Tin được giao | Mọi tin của tổ chức | Ứng viên mình giới thiệu | ✓ (ẩn bớt) | ✓ |
| Quản lý thành viên, gói | – | – | – | ✓ | – | – | ✓ |
| Duyệt tin | – | – | – | – | – | ✓ | ✓ |
| Xác minh DN/CTV | – | – | – | – | – | – | ✓ (+ admin_verify) |
| Khoá tài khoản, xử lý vi phạm | – | – | – | – | – | Cảnh cáo/gỡ tin | ✓ |
| Phân quyền admin, cài đặt hệ thống | – | – | – | – | – | – | ✓ |

Phân quyền được kiểm tra ở **server** (policy layer). UI chỉ ẩn nút để trải nghiệm tốt hơn, không thay thế kiểm tra phía server.

---

## 3. Quy tắc nghiệp vụ cốt lõi

### 3.1 Luật cấm & quyết định đã chốt

| # | Quy tắc |
|---|---|
| R1 | **Đăng nhập:** email **hoặc** số điện thoại + mật khẩu, và "Tiếp tục với Google". **Không có Zalo login.** (Zalo chỉ dùng làm kênh liên hệ/chia sẻ.) |
| R2 | **Đăng ký:** họ tên, SĐT, email, mật khẩu. Xác thực bằng **OTP qua SMS**. Chỉ khi SMS thất bại (sau 2 lần gửi lại, hoặc người dùng bấm "Không nhận được SMS") mới cho phép **nhận mã qua email**. Không có "gọi điện đọc mã". |
| R3 | **Không có bước "Chọn loại tài khoản"** trên web và app. |
| R4 | **Không thu thập, lưu hay xác minh CCCD/CMND** ở bất kỳ đâu. Khi cần nhắc giấy tờ thực tế (ví dụ mang theo khi phỏng vấn), dùng cụm từ "giấy tờ tuỳ thân" và không upload. |
| R5 | **CTV / NTD cá nhân** được xác minh bằng: (a) OTP SĐT, (b) hợp đồng/giấy xác nhận cộng tác với doanh nghiệp đối tác có GP XKLĐ, (c) doanh nghiệp đối tác bấm **xác nhận** trên hệ thống. Trên hồ sơ hiển thị pill "CTV đã được xác nhận". |
| R6 | **Luồng app Tìm việc là guest-first:** chọn "Tìm việc" thì vào thẳng trang chủ, không bắt đăng nhập. Các hành động cần đăng nhập sẽ mở **sheet gợi ý đăng nhập** (xem 3.2). |
| R7 | **Super Admin là web app riêng** (`admin.viecpro.vn`). Mobile admin sau này làm dạng PWA, chỉ cho thao tác nhanh. |
| R8 | **Icon:** không dùng sao 4 cánh "AI". Dùng icon theo ngữ cảnh: target (gợi ý phù hợp), bulb (mẹo), briefcase (việc làm), scan-check (kiểm tra tự động), shield-check (xác minh), bell, gift, clipboard, pen, info. Icon chat là bong bóng bo tròn có 3 chấm. |
| R9 | **Wording:** ưu tiên "Tự động", "Gợi ý", "Hệ thống chấm" thay cho chữ "AI" ở giao diện người dùng cuối. |
| R10 | **Header mobile kiểu Facebook:** bên trái là ☰ + logo; bên phải là tìm kiếm / chat / chuông. ☰ mở drawer từ trái. |

### 3.2 Gating cho khách (guest)

| Hành động của khách | Kết quả |
|---|---|
| Ứng tuyển, Lưu việc, mở Tin nhắn, mở Thông báo, tab Ứng tuyển/Đã lưu/Tôi | Mở bottom sheet: tiêu đề theo ngữ cảnh (ví dụ "Đăng nhập để ứng tuyển"), lợi ích ngắn, nút **Đăng nhập** / **Tạo tài khoản**, link "Để sau" |
| Mở ☰ | Drawer có thẻ "Bạn chưa đăng nhập" kèm Đăng nhập/Đăng ký; các mục Trợ giúp / Điều khoản vẫn mở bình thường |
| Sau khi đăng nhập thành công | **Tiếp tục hành động dang dở** (pending intent). Ví dụ: mở lại đúng tin và bung form ứng tuyển, hoặc lưu tin luôn |
| Web: bấm "Ứng tuyển ngay" khi chưa đăng nhập | Mở **ApplyModal ứng tuyển nhanh** (họ tên, SĐT/Zalo, năm sinh, giới tính, địa chỉ, ghi chú). Sau khi gửi, gợi ý tạo tài khoản để theo dõi; hồ sơ được gắn vào tài khoản qua SĐT đã xác thực OTP |

### 3.3 Tin tuyển dụng (Job)

- **Trường bắt buộc:** tiêu đề, chương trình, ngành nghề, công việc cụ thể, nơi làm việc (tỉnh), số lượng, ngày thi tuyển, giới tính, độ tuổi (năm sinh từ–đến), lương cơ bản/tháng, hợp đồng (năm), **chi phí xuất cảnh (USD, ghi rõ 0 nếu miễn phí)**, hạn nhận hồ sơ, cán bộ phụ trách.
- **Không bắt buộc:** tiếng Nhật, học vấn tối thiểu, yêu cầu khác, làm thêm, phúc lợi, ảnh/video (tối đa 10 ảnh, 1 video), câu hỏi sàng lọc.
- **Trường tính toán:**
  - **Thực lĩnh ước tính** = lương − thuế − bảo hiểm − nhà ở (công thức cấu hình được ở admin).
  - **Trung vị lương theo ngành/tỉnh:** hiện thanh so sánh khi nhập lương.
  - **Chất lượng tin:** điểm 0–100 theo độ đầy đủ.
  - **Dự kiến tiếp cận / số hồ sơ / ngày đủ chỉ tiêu.**
- **Vòng đời:** `draft → pending_review → (approved → published) | rejected(lý do) → paused → expired/filled → archived`. Mọi lần sửa trường trọng yếu (lương, chi phí, số lượng, nơi làm) khi đang `published` sẽ **quay lại `pending_review`**, còn bản cũ vẫn hiển thị cho tới khi bản mới được duyệt.
- **Tiêu chí kiểm duyệt (hiện cho NTD xem):**
  - thông tin khớp hợp đồng cung ứng;
  - không thu phí ngoài các khoản công khai;
  - ảnh thực tế, không chèn SĐT hay logo bên thứ ba;
  - không phân biệt đối xử ngoài tiêu chí hợp pháp.
- **Tự lưu nháp** mỗi 10 giây hoặc khi rời ô nhập ("Đã tự lưu nháp lúc 10:42").
- **Đẩy tin (boost):** đưa tin lên đầu danh sách trong 24h/72h/7 ngày, trừ vào lượt của gói hoặc mua lẻ.
- **Badge trên thẻ tin:** "NTD xác thực", "Miễn phí xuất cảnh", "Mới", "Tuyển gấp", "Nổi bật" (tài trợ, gắn nhãn "Tài trợ").

### 3.4 Ứng tuyển & pipeline

- **Ứng tuyển 1 chạm** (đã đăng nhập, hồ sơ ≥ ngưỡng bắt buộc): gửi hồ sơ hiện có, tuỳ chọn trả lời câu hỏi sàng lọc và thêm ghi chú.
- **Chống trùng:** mỗi ứng viên chỉ có 1 đơn đang hoạt động cho mỗi tin. Ứng tuyển lại sau khi bị loại phải chờ cooldown 30 ngày (cấu hình được).
- **Bước pipeline** (cấu hình mặc định, DN có thể đổi tên nhưng giữ mã):

  `new` (Ứng tuyển) → `contacted` (Đã liên hệ) → `interview` (Phỏng vấn) → `passed` (Trúng tuyển) → `training` (Đào tạo/hồ sơ) → `departed` (Đã xuất cảnh)

  Nhánh rẽ: `rejected` (Không phù hợp, kèm lý do), `withdrawn` (ứng viên rút).
- **Điểm phù hợp (%):** chấm theo tiêu chí tin so với hồ sơ: giới tính, năm sinh, tiếng Nhật, học vấn, kinh nghiệm ngành, tỉnh mong muốn, câu hỏi sàng lọc. Hiển thị **"Vì sao phù hợp"** dạng 3–5 gạch đầu dòng. Trả lời sai câu hỏi *loại trực tiếp* → tự chuyển `rejected` với lý do "Không đạt câu hỏi sàng lọc" (NTD có thể khôi phục).
- **SLA liên hệ:** đơn `new` quá 24h chưa liên hệ → cảnh báo trên dashboard NTD ("5 hồ sơ mới chưa được liên hệ quá 24 giờ").
- **Ứng viên thấy:** trạng thái đã được rút gọn và thân thiện (Đã gửi → NTD đã xem → Đã liên hệ → Hẹn phỏng vấn → Kết quả). **Không thấy ghi chú nội bộ** của NTD.
- **Ghi chú nội bộ:** chỉ thành viên cùng tổ chức xem được.

### 3.5 Thêm ứng viên thủ công (NTD)

- **Cách 1 – Mời ứng viên tự điền:** gửi link qua Zalo / SMS / Sao chép. Link có token hết hạn sau 7 ngày. Ứng viên điền xong thì đơn tự vào pipeline của tin đã chọn, nguồn = `invited`.
- **Cách 2 – Nhập tay:** họ tên, SĐT, năm sinh, giới tính, quê quán, tin ứng tuyển, bước, ghi chú, tệp đính kèm (CV, ảnh, bằng cấp — **không CCCD**).
- **Cảnh báo trùng SĐT:** nếu SĐT đã có trong hệ thống, hiện thẻ cảnh báo "Ứng viên này đã có hồ sơ" và cho chọn liên kết thay vì tạo mới. Không lộ thông tin của tổ chức khác.
- Ứng viên được thêm tay phải nhận **SMS thông báo + đồng ý** (consent) thì hồ sơ mới hiển thị đầy đủ cho NTD (yêu cầu của Nghị định 13/2023 về bảo vệ dữ liệu cá nhân).

### 3.6 Lịch hẹn / phỏng vấn

- Loại: phỏng vấn trực tiếp, online (link), thi tay nghề, khám sức khoẻ, học định hướng.
- Trường: tiêu đề, loại, tin liên quan, ngày, giờ bắt đầu–kết thúc, địa điểm/link, người phụ trách, danh sách ứng viên, ghi chú, "cần mang theo" (ví dụ: giấy tờ tuỳ thân, ảnh 4x6).
- Gửi thông báo cho ứng viên qua app, SMS và email. Ứng viên **xác nhận / xin đổi lịch**. Nhắc lịch trước 24h và 2h.
- Phát hiện trùng lịch theo người phụ trách và theo ứng viên.

### 3.7 Doanh nghiệp & xác minh

- **Hồ sơ công ty:** tên, logo, ảnh bìa, mã số thuế, số GP XKLĐ, địa chỉ, website, giới thiệu, thị trường, quy mô, năm thành lập, ảnh văn phòng, đánh giá `[Gợi ý]`.
- **Hồ sơ xác minh DN:** Giấy ĐKKD, **Giấy phép XKLĐ** (số, ngày cấp, hạn), **Thư uỷ quyền** (khi người đăng ký không phải người đại diện pháp luật), xác minh **email tên miền công ty**, OTP SĐT.
- **Trạng thái:** `unverified → submitted → in_review → verified | need_more_info | rejected`. Khi đã `verified`, các trường đã xác minh bị **khoá** (hiện icon khoá + "Liên hệ hỗ trợ để thay đổi").
- **Hết hạn GP XKLĐ:**
  - nhắc trước 60, 30 và 7 ngày;
  - khi hết hạn → tự ẩn toàn bộ tin và mất badge.
- **CTV liên kết:** DN có màn "CTV liên kết" để duyệt, xác nhận hoặc gỡ CTV. Hoa hồng do DN cấu hình theo từng tin hoặc mặc định.

### 3.8 CTV & hoa hồng

- CTV liên kết với 1 hoặc nhiều **đơn vị** (DN đối tác).
- **CTV đăng tin** bằng một trong hai cách:
  - **Lấy đơn từ đơn vị:** chọn tin của đơn vị và chia sẻ lại; tin vẫn thuộc đơn vị, CTV được ghi nhận nguồn.
  - **Đăng đơn lẻ:** tin do CTV soạn, **bắt buộc chọn đơn vị chịu trách nhiệm** và được đơn vị duyệt trước khi gửi admin duyệt.
- **Link giới thiệu và QR** riêng cho mỗi tin/CTV (`viecpro.vn/j/{slug}?ref={code}`). Lưu cookie attribution 30 ngày, quy tắc last-click.
- **Hoa hồng theo mốc:** Giới thiệu → Trúng tuyển → Xuất cảnh → **Thanh toán sau 30 ngày kể từ xuất cảnh**. Trạng thái: `pending`, `eligible`, `approved`, `paid`, `cancelled` (ứng viên về sớm hoặc vi phạm).
- CTV thấy tổng quan: số giới thiệu, trúng tuyển, xuất cảnh, hoa hồng dự kiến/đã nhận, và danh sách theo từng ứng viên.

### 3.9 Báo cáo vi phạm

- **Ai báo cáo:** ứng viên/khách trên tin, trang công ty, trang CTV, tin nhắn; hệ thống tự gắn cờ.
- **Loại:**
  - thu phí ngoài hợp đồng;
  - sai lương / sai thông tin;
  - tin trùng lặp;
  - ảnh không thực tế;
  - lừa đảo / giả mạo;
  - quấy rối;
  - khác.
- **Mức độ:** `critical` (lừa đảo, thu phí ngoài), `high`, `medium`, `low`.
- **SLA:**
  - critical 2h; high 8h; medium 24h; low 72h;
  - tin bị ≥ 3 báo cáo "thu phí" trong 24h → **tự tạm ẩn**.
- **Quy trình:** `open → claimed (người nhận xử lý) → investigating → resolved`.
  - **Quyết định:** bỏ qua / cảnh cáo / gỡ tin / tạm khoá / khoá vĩnh viễn.
  - Người báo cáo nhận thông báo kết quả, ẩn danh với bên bị báo cáo.
- **Điểm uy tín NTD:** giảm theo số vi phạm đã xác nhận. Ảnh hưởng thứ hạng hiển thị và hạn mức đăng tin.

### 3.10 Gói & thanh toán

| Gói | Đối tượng | Quyền lợi chính (cấu hình được ở admin) |
|---|---|---|
| Free | DN mới | 2 tin đang mở, không đẩy tin, 1 thành viên |
| Pro | DN | 15 tin, 10 lượt đẩy/tháng, 6 thành viên, xuất Excel, báo cáo |
| Business | DN lớn | 50 tin, 40 lượt đẩy, 20 thành viên, NTD nổi bật trang chủ |
| Enterprise | Theo hợp đồng | Không giới hạn, API, quản lý tài khoản riêng |
| Cá nhân Basic / Pro | CTV | 3 / 10 tin đơn lẻ, link giới thiệu, thống kê |
| Mua lẻ | Mọi NTD | Đẩy tin 24h/72h/7 ngày, tin nổi bật |

- **Thanh toán:** VNPay, MoMo, chuyển khoản (đối soát thủ công ở admin), thẻ quốc tế qua Stripe `[Gợi ý]`. Xuất **hoá đơn VAT điện tử**.
- **Hết hạn gói:**
  - nhắc trước 7 và 1 ngày ("Gói Pro · Hết hạn 30/11");
  - khi hết hạn → hạ về Free;
  - tin vượt hạn mức chuyển sang `paused`, không bị xoá.

### 3.11 Thông báo

| Sự kiện | App push | Email | SMS | In-app |
|---|---|---|---|---|
| OTP | – | fallback | ✓ | – |
| Ứng tuyển thành công / NTD đã xem / đổi bước | ✓ | ✓ | – | ✓ |
| Lịch phỏng vấn mới / đổi / nhắc | ✓ | ✓ | ✓ | ✓ |
| Thông báo việc làm (job alert) | theo cài đặt | theo cài đặt | theo cài đặt | ✓ |
| Tin nhắn mới | ✓ | gom 1 email/giờ | – | ✓ |
| NTD: hồ sơ mới, quá SLA, tin bị từ chối/duyệt, gói sắp hết | ✓ | ✓ | – | ✓ |
| Kết quả báo cáo vi phạm | ✓ | ✓ | – | ✓ |

- **Giờ yên lặng:** mặc định 22:00–7:00, không push hoặc SMS (trừ OTP).
- Người dùng bật/tắt từng nhóm ở **Cài đặt**.
- Có template đa ngôn ngữ; mọi tin gửi đi đều được ghi log (đã gửi, lỗi, đã mở).

### 3.12 Thông báo việc làm (Job alerts)

- Tiêu chí: ngành, khu vực (nhiều tỉnh), loại visa, lương từ, phí xuất cảnh (miễn phí/bất kỳ), giới tính.
- Kênh: App / Email / SMS (chọn nhiều). Tần suất: Ngay khi có / Hằng ngày 8:00 / Hằng tuần sáng Thứ Hai.
- Bật/tắt, sửa, xoá. Mỗi người tối đa 10 alert.
- **Gợi ý alert** từ hồ sơ ("Kiểm tra ngoại quan · Chiba · Nữ — 8 việc phù hợp mới trong tuần") với nút "Tạo thông báo này".
- **Tạo nhanh** từ trang tìm kiếm: "Lưu bộ lọc này thành thông báo".

---

## 4. Kiến trúc kỹ thuật đề xuất

### 4.1 Stack

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Monorepo | **pnpm + Turborepo** | Dùng chung types, UI, validation |
| Web (public + ứng viên) | **Next.js 15 (App Router) + React Server Components** | SEO cho tin tuyển dụng, SSR/ISR |
| Business web | Next.js (app riêng `apps/business`) | Tách bundle và quyền |
| Admin web | Next.js (app riêng `apps/admin`), deploy riêng, có thể giới hạn IP | Bảo mật |
| Mobile | **React Native + Expo (SDK mới nhất), Expo Router** | Một codebase cho 2 chế độ, OTA update |
| UI | Tailwind CSS + shadcn/ui (web), NativeWind (mobile), token chung `packages/ui-tokens` | Bám design system |
| API | **NestJS** (REST + OpenAPI), hoặc tRPC nếu team thuần TS | Module rõ ràng, guard/policy |
| DB | **PostgreSQL 16** + Prisma | Quan hệ phức tạp, transaction |
| Tìm kiếm | **Meilisearch** (hoặc OpenSearch khi lớn) | Tiếng Việt có dấu/không dấu, facet |
| Cache / queue | Redis + BullMQ | OTP rate limit, job gửi thông báo, alert |
| Storage | S3-compatible (R2/S3) + CDN, ảnh resize qua imgproxy | Ảnh tin, logo, tài liệu xác minh (bucket private) |
| Realtime | WebSocket (Socket.IO) hoặc Ably/Pusher | Chat, live activity admin |
| Auth | Tự triển khai: JWT access 15 phút + refresh token xoay vòng (httpOnly cookie trên web, SecureStore trên mobile), Google OAuth (OIDC) | Kiểm soát OTP, đa ngữ cảnh |
| SMS | eSMS / SpeedSMS (brandname) + nhà cung cấp dự phòng | OTP Việt Nam |
| Email | Amazon SES / Resend + React Email | Template |
| Push | Expo Push → FCM/APNs | |
| Thanh toán | VNPay, MoMo, (Stripe) | |
| Quan sát | Sentry, OpenTelemetry + Grafana, log có cấu trúc (pino) | |
| Hạ tầng | Docker, deploy trên Fly.io/Render/AWS ECS; Vercel cho Next.js; Cloudflare | |
| CI/CD | GitHub Actions: lint, typecheck, test, e2e (Playwright), preview deploy, EAS Build | |

### 4.2 Cấu trúc monorepo

```
viecpro/
├─ apps/
│  ├─ web/            # viecpro.vn (public + tài khoản ứng viên)
│  ├─ business/       # business.viecpro.vn
│  ├─ admin/          # admin.viecpro.vn
│  ├─ mobile/         # Expo app (chế độ seeker + business)
│  └─ api/            # NestJS
├─ packages/
│  ├─ ui-tokens/      # màu, radius, spacing, typography
│  ├─ ui-web/         # component React web
│  ├─ ui-native/      # component RN
│  ├─ icons/          # bộ icon SVG dùng chung (theo R8)
│  ├─ schemas/        # zod schema dùng chung FE/BE
│  ├─ api-client/     # client sinh từ OpenAPI
│  ├─ i18n/           # vi, ja, en
│  └─ config/         # eslint, tsconfig, tailwind preset
└─ infra/             # docker-compose, terraform, seed
```

### 4.3 Design tokens (trích từ design)

| Token | Giá trị |
|---|---|
| `font.family` | Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif |
| `color.primary` | `#3879FF` (hover `#6396FF`, text link `#336FE8`, đậm `#1B3FA8`, nền nhạt `#EBF2FF`) |
| `color.ink` | `#0F2538` (tiêu đề), `#334155`, `#475569`, `#64748B` (phụ), `#94A3B8` (mờ) |
| `color.border` | `#E2E8F0`, `#F1F5F9` (chia dòng), nền trang `#F0F4F9` |
| `color.success` | `#16A34A` / `#15803D`, nền `#F0FDF4` |
| `color.danger` | `#DC2626` / `#B91C1C`, nền `#FEE2E2` |
| `color.warning` | `#F59E0B`, cam `#E8862A` / `#EB7D10` |
| `color.zalo` | `#0068FF` (chỉ cho nút liên hệ/chia sẻ Zalo) |
| Dataviz | `#3879FF`, `#E8862A`, `#0E8FA8`, `#9B5CF6` |
| Radius | 7–8 (chip), 10–12 (nút/input), 13–14 (icon box), 18–20 (card) |
| Focus ring | `border #3879FF` + `box-shadow 0 0 0 4px rgba(56,121,255,.14)` |
| Nút chính | cao 42–48px web, 48–52px mobile; chữ 14–15px đậm 700 |

### 4.4 Mô hình dữ liệu (outline)

```text
users(id, full_name, phone_e164 UNIQUE, phone_verified_at, email UNIQUE NULL, email_verified_at,
      password_hash NULL, google_sub NULL, avatar_url, locale, status[active|locked|deleted],
      created_at, last_login_at)
sessions(id, user_id, context[seeker|business|ctv], device, ip, refresh_hash, expires_at, revoked_at)
otp_codes(id, target, channel[sms|email], purpose[register|login|reset|change_phone],
          code_hash, attempts, expires_at, consumed_at)

seeker_profiles(user_id PK, gender, birth_year, hometown_province, current_address,
      education_level, japanese_level, height_cm, weight_kg, eyesight, tattoo, smoking,
      marital_status, experiences JSONB, skills[], desired_programs[], desired_industries[],
      desired_prefectures[], desired_salary_min, departure_window, completeness_pct,
      visibility[public_to_verified|private], updated_at)
seeker_documents(id, user_id, type[cv|photo|certificate|other], file_key, created_at) -- KHÔNG có CCCD

organizations(id, type[company], name, slug, tax_code, license_no, license_expiry, logo, cover,
      about, address, website, email_domain, verify_status, verified_at, reputation_score,
      plan_id, plan_expires_at, created_at)
org_members(org_id, user_id, role[owner|admin|recruiter|viewer], status, invited_by)
org_verifications(id, org_id, docs JSONB[{type:dkkd|gp_xkld|uy_quyen, file_key}],
      status, reviewer_id, notes, decided_at)

ctv_profiles(user_id PK, display_name, slug, bio, area, verify_status, ref_code UNIQUE)
ctv_links(id, ctv_user_id, org_id, contract_file_key, status[pending|confirmed|revoked],
      confirmed_by, confirmed_at, commission_default JSONB)

jobs(id, org_id, owner_type[org|ctv], created_by, assignee_id, ctv_user_id NULL,
     title, slug, program, industry, job_detail, prefecture, city, quantity, exam_date,
     gender_req, birth_year_from, birth_year_to, japanese_req, education_min, other_req,
     salary_base, net_estimate, overtime_hours, contract_years, departure_fee_usd,
     benefits[], description_md, media JSONB, apply_channels[], deadline,
     status, quality_score, boost_until, is_featured, published_at, views, applies_count,
     version, created_at, updated_at)
job_revisions(id, job_id, snapshot JSONB, status, reviewer_id, reject_reason, created_at)
screening_questions(id, job_id, question, type[yes_no|choice|text], options, knockout_answer)

applications(id, job_id, seeker_id NULL, guest_contact JSONB NULL, source[app|web|quick|invited|manual|ctv],
     ref_ctv_id NULL, stage, reject_reason, match_score, match_reasons JSONB,
     answers JSONB, note_from_seeker, last_contacted_at, created_at, updated_at)
application_events(id, application_id, actor_id, type, from_stage, to_stage, payload, created_at)
internal_notes(id, application_id, org_id, author_id, body, created_at)
saved_jobs(user_id, job_id, created_at)
job_alerts(id, user_id, name, criteria JSONB, channels[], frequency, enabled, last_sent_at)

interviews(id, org_id, job_id, type, title, starts_at, ends_at, location, online_url,
     host_id, bring_items[], note, status)
interview_attendees(interview_id, application_id, rsvp[pending|accepted|reschedule|declined], reminded_at)

conversations(id, job_id NULL, org_id, seeker_id, last_message_at)
messages(id, conversation_id, sender_id, body, attachments JSONB, read_at, created_at)

referrals(id, ctv_user_id, job_id, application_id, clicked_at, status)
commissions(id, ctv_user_id, org_id, application_id, amount, currency, milestone,
     status[pending|eligible|approved|paid|cancelled], eligible_at, paid_at)

plans(id, code, name, audience[org|ctv], price, period, limits JSONB, active)
subscriptions(id, org_id|ctv_user_id, plan_id, starts_at, ends_at, status, auto_renew)
orders(id, buyer, items JSONB, amount, vat, status, provider, provider_ref, invoice_no, created_at)
boosts(id, job_id, order_id, starts_at, ends_at)

reports(id, target_type[job|org|ctv|message|user], target_id, reporter_id NULL, reason,
     detail, evidence JSONB, severity, status, assignee_id, sla_due_at, decision, decided_at)
sanctions(id, subject_type, subject_id, type[warn|remove|suspend|ban], reason, until, by_admin)

notifications(id, user_id, type, title, body, data JSONB, read_at, created_at)
notification_prefs(user_id, group, channels JSONB, quiet_from, quiet_to)
delivery_logs(id, channel, to, template, status, provider_ref, created_at)

admin_users(id, email, name, role, totp_secret, status, last_login_at)
audit_logs(id, actor_type[admin|user|system], actor_id, action, target_type, target_id,
     diff JSONB, ip, ua, created_at)  -- append-only
cms_articles(id, slug, title, category, body_md, cover, status, published_at, author_id)
settings(key, value JSONB, updated_by, updated_at)
```

**Index quan trọng:**

- `jobs(status, published_at desc)`, `jobs(org_id, status)`.
- `applications(job_id, stage)` và unique `applications(seeker_id, job_id) WHERE stage NOT IN (rejected, withdrawn)`.
- Unique `users(phone_e164)` và `users(email)`.
- `reports(status, sla_due_at)`.

---

## 5. Danh mục màn hình (mapping với design)

### 5.1 Web công khai — `apps/web`

| Mã | Màn | Board | Nội dung chính |
|---|---|---|---|
| W-01 | Trang chủ | Main | Header (Việc làm, Chương trình, Cẩm nang, Tư vấn, Nhà tuyển dụng, Đăng nhập, Đăng tin tuyển dụng); hero tìm kiếm (tỉnh, chương trình); việc theo tỉnh (xem đủ 47 tỉnh); việc mới nhất (sắp xếp Mới nhất/Lương cao/Xem nhiều); banner NTD; NTD nổi bật; quảng cáo (khoá tiếng Nhật, dịch vụ xuất cảnh); đăng ký nhận đơn mới; footer pháp lý (GP hoạt động) |
| W-02 | Tìm kiếm & bộ lọc | Search | Bộ lọc: tỉnh, chương trình, ngành (+ Xem thêm 8 ngành), giới tính, năm sinh, lương từ, dự kiến xuất cảnh, đặc điểm đơn; "Tìm nhiều"; sắp xếp (Phù hợp nhất / Mới nhất / Lương cao / Xuất cảnh sớm); empty state + "Nhờ tư vấn miễn phí"; phân trang |
| W-03 | Chi tiết việc làm | JobDetail | Ảnh, lương, thực lĩnh, chi phí, yêu cầu, quyền lợi, NTD/CTV đăng tin, tin tương tự, Ứng tuyển, Lưu, Chia sẻ, Báo cáo tin |
| W-04 | Modal ứng tuyển nhanh | ApplyModal | Họ tên, email, SĐT/Zalo, năm sinh, giới tính, địa chỉ, ghi chú; cam kết "Gọi lại trong 30 phút", "Tư vấn miễn phí", "Bảo mật thông tin" |
| W-05 | Trang công ty | Employer | Bìa, logo, badge xác minh, giới thiệu, GP XKLĐ, tin đang tuyển, ảnh, thống kê |
| W-06 | Trang NTD cá nhân / CTV | Recruiter | Hồ sơ CTV, pill "CTV đã được xác nhận", đơn vị liên kết, tin đang chia sẻ, liên hệ |
| W-07 | Đăng nhập | Login | Email/SĐT + mật khẩu, Google, Quên mật khẩu? |
| W-08 | Đăng ký | Register | Họ tên, SĐT, email, mật khẩu → OTP SMS (fallback email) |
| W-09 | Quên mật khẩu | ForgotPassword | 4 bước: nhập email/SĐT → nhập mã → mật khẩu mới → thành công |

### 5.2 Tài khoản ứng viên (web) — `apps/web/(account)`

| Mã | Màn | Board | Nội dung chính |
|---|---|---|---|
| C-01 | Tổng quan tài khoản | Account | Thẻ hồ sơ + % hoàn thiện, ứng tuyển gần đây, việc gợi ý, lối tắt |
| C-02 | Hồ sơ của tôi | MyProfile | Thông tin cá nhân, nguyện vọng, kinh nghiệm, học vấn, tiếng Nhật, thể chất, tài liệu; chế độ hiển thị |
| C-03 | Việc đã ứng tuyển | MyApplications | Danh sách + timeline trạng thái, lịch hẹn, rút đơn |
| C-04 | Việc đã lưu | MySaved | Lưới tin đã lưu, sắp hết hạn, so sánh `[Gợi ý]` |
| C-05 | Thông báo việc làm | MyAlerts | Thẻ alert (switch, chip, tần suất, Xem chi tiết & cài đặt), feed "Việc mới cho bạn", gợi ý alert |
| C-06 | Cài đặt | MySettings | 5 thẻ có "Xem thêm": Tài khoản & bảo mật, Thông báo, Quyền riêng tư, Ngôn ngữ, Xoá tài khoản |

### 5.3 Business web — `apps/business`

| Mã | Màn | Board | Nội dung chính |
|---|---|---|---|
| B-01 | Tổng quan DN | EmployerDashboard | Lời chào, cảnh báo SLA, biểu đồ hồ sơ theo ngày, phễu tuyển dụng, hồ sơ mới nhất, lịch PV hôm nay, tin cần chú ý, bảng tin (lượt xem, hồ sơ, chỉ tiêu, hạn, Đẩy tin), kanban ứng viên |
| B-02 | Tổng quan CTV | RecruiterDashboard | Giới thiệu, trúng tuyển, xuất cảnh, hoa hồng, đơn vị liên kết, tin đang chia sẻ |
| B-03 | Tin tuyển dụng | MgmtJobs | Tab trạng thái, lọc theo cán bộ, hiệu quả từng tin, thao tác (sửa, tạm dừng, nhân bản, đẩy tin) |
| B-04 | Ứng viên | MgmtCandidates | Lọc theo tin/mức phù hợp, bảng/kanban, drawer hồ sơ (Bước, Vì sao phù hợp, Giấy tờ, Hoạt động, Ghi chú nội bộ), Xuất Excel, Thêm ứng viên |
| B-05 | Lịch phỏng vấn | MgmtInterviews | Lịch tuần/tháng, danh sách sự kiện, RSVP |
| B-06 | Đăng tin mới | MgmtPostJob | Form 5 khu (Thông tin cơ bản, Ảnh & video, Yêu cầu, Mô tả, Lương & phúc lợi, Nhận hồ sơ & hiển thị), xem trước Máy tính/Điện thoại, chất lượng tin, dự kiến tiếp cận, Dùng lại tin cũ, tiêu chí kiểm duyệt |
| B-07 | Thêm ứng viên | MgmtAddCandidate | Mời tự điền (Zalo/SMS/Sao chép) + nhập tay, cảnh báo trùng SĐT |
| B-08 | Tạo lịch hẹn | MgmtNewInterview | Form lịch, chọn ứng viên, kiểm tra trùng |

**Layout chung Business:**

- Sidebar: workspace switcher ("Việt Nam CAMCOM · Gói Pro · 6 thành viên"), menu, thẻ gói ("Hết hạn 30/11 · Nâng cấp gói").
- Topbar: tìm kiếm `Ctrl K`, nút "Đăng tin mới", user.
- Footer: trạng thái hệ thống, phiên bản, hotline DN.

### 5.4 Super Admin — `apps/admin`

| Mã | Màn | Board | Trạng thái design |
|---|---|---|---|
| A-01 | Bảng điều khiển | AdminDashboard | ✓ — KPI so kỳ trước, "Trợ lý vận hành: 3 điều cần chú ý", hồ sơ/ngày, phễu 30 ngày (truy cập → xuất cảnh), hàng chờ kiểm duyệt (điểm rủi ro, SLA, Duyệt/Từ chối/Hoàn tác), hoạt động LIVE, báo cáo vi phạm mới, nhu cầu theo tỉnh |
| A-02 | Kiểm duyệt tin | AdminModeration | ✓ — hàng chờ, kiểm tra tự động, so sánh phiên bản, duyệt/từ chối kèm lý do mẫu |
| A-03 | Xác minh doanh nghiệp | AdminVerify | ✓ — DN (ĐKKD, GP XKLĐ, Thư uỷ quyền, email domain) và CTV (hợp đồng + xác nhận đối tác + SĐT) |
| A-04 | Danh sách ứng viên | AdminCandidates | ✓ |
| A-05 | Nhà tuyển dụng | AdminEmployers | ✓ — gộp DN + cá nhân; drawer tab Tổng quan / Tin đăng / Gói & thanh toán / Vi phạm / Lịch sử |
| A-06 | Báo cáo vi phạm | AdminReports | ✓ — SLA, mức độ, nhận xử lý, quyết định |
| A-07 | Phân tích | — | `[Gợi ý]` cần design |
| A-08 | Gói & doanh thu | — | `[Gợi ý]` |
| A-09 | Giao dịch | — | `[Gợi ý]` |
| A-10 | Nội dung & cẩm nang | — | `[Gợi ý]` |
| A-11 | Phân quyền | — | `[Gợi ý]` |
| A-12 | Nhật ký hệ thống | — | `[Gợi ý]` |
| A-13 | Cài đặt hệ thống | — | `[Gợi ý]` |
| A-00 | Đăng nhập admin + 2FA | — | `[Gợi ý]` |

### 5.5 App mobile — chế độ Tìm việc (board MobileSeeker, 27 màn)

| Mã | Màn | Ghi chú |
|---|---|---|
| MS-01 | Chọn vai trò | Hai thẻ ảnh: Tìm việc (ảnh Saitama) / Tuyển dụng (ảnh Kanagawa). Chỉ hiện lần đầu, đổi lại được trong ☰ |
| MS-02 | Trang chủ (khách) | Lời chào khách, banner bóng đèn vàng "Đăng ký", "Đơn nổi bật hôm nay" (icon cặp sách xanh) |
| MS-03 | Sheet gợi ý đăng nhập | Theo ngữ cảnh hành động |
| MS-04 | Menu ☰ (khách) | Thẻ "Bạn chưa đăng nhập" |
| MS-05 | Đăng nhập | Nút đóng "Để sau" |
| MS-06 | Đăng ký | Banner vai trò thay cho chọn loại TK |
| MS-07 | Xác thực OTP | Bàn phím số, đếm ngược gửi lại |
| MS-08 | Không nhận được SMS | Sheet: gửi lại / đổi số / nhận qua email |
| MS-09 | Xác thực qua email | |
| MS-10 → MS-13 | Quên mật khẩu → Nhập mã → Mật khẩu mới → Thành công | |
| MS-14 | Trang chủ (đã đăng nhập) | Header FB-style, gợi ý theo hồ sơ |
| MS-15 | Tìm kiếm & bộ lọc | |
| MS-16 | Thông báo | |
| MS-17 | Chi tiết việc làm | |
| MS-18 | Trang công ty | |
| MS-19 | Trang NTD cá nhân | |
| MS-20 | Ứng tuyển 1 chạm | |
| MS-21 | Theo dõi ứng tuyển | |
| MS-22 | Việc đã lưu | |
| MS-23 | Tài khoản | |
| MS-24 | Hồ sơ của tôi | |
| MS-25 | Sửa thông tin cá nhân | |
| MS-26 | Sửa nhanh nguyện vọng (sheet) | |
| MS-27 | Cài đặt | |

**Tab bar:** Trang chủ · Ứng tuyển · Đã lưu · Tôi.
**Drawer ☰:** thẻ hồ sơ; lưới lối tắt; accordion Trợ giúp & hỗ trợ / Cài đặt & quyền riêng tư / Điều khoản & chính sách; Đăng xuất.

### 5.6 App mobile — chế độ Business (board MobileEmployer, 21 màn)

| Mã | Màn |
|---|---|
| ME-01 → ME-04 | Đăng nhập (ảnh nền Kanagawa, công tắc vai trò) · Quên mật khẩu · Nhập mã · Mật khẩu mới |
| ME-05 | Tổng quan |
| ME-06 | Tin tuyển dụng (+ Đăng tin ở header) |
| ME-07 | Đăng tin mới |
| ME-08 | Ứng viên |
| ME-09 | Hồ sơ ứng viên |
| ME-10 | Thêm ứng viên |
| ME-11 | Lịch phỏng vấn (+) |
| ME-12 | Tạo lịch hẹn |
| ME-13 | Tài khoản |
| ME-14 | Sửa hồ sơ công ty (trường đã xác minh bị khoá) |
| ME-15 | Cài đặt (2FA) |
| ME-16 | CTV · Đơn vị liên kết |
| ME-17 | CTV · Tổng quan |
| ME-18 | CTV · Đăng tin (lấy đơn từ đơn vị / đơn lẻ) |
| ME-19 | CTV · Hoa hồng |
| ME-20 | CTV · Chia sẻ tin (QR) |
| ME-21 | CTV · Hồ sơ của tôi |

**Tab bar DN:** Tổng quan · Tin · Ứng viên · Lịch · Thêm.
**Tab bar CTV:** Tổng quan · Đăng tin · Hoa hồng · Chia sẻ · Tôi.

---

## 6. Đặc tả chi tiết theo module

> Mỗi module gồm: **Màn liên quan**, **Chức năng**, **Validation**, **Trạng thái UI** (loading / empty / error), **Edge cases**.

### M1. Xác thực (Auth)

**Màn:** W-07, W-08, W-09, MS-05 → MS-13, ME-01 → ME-04, A-00.

**Chức năng:**

- **Đăng nhập** bằng `identifier` (email hoặc SĐT, tự nhận diện) + mật khẩu.
  - Chuẩn hoá SĐT về E.164 (`0912…` → `+84912…`).
  - "Ghi nhớ đăng nhập" 30 ngày.
- **Google:** nếu email Google trùng tài khoản có sẵn → liên kết sau khi xác nhận mật khẩu hoặc OTP. Nếu tài khoản mới → bắt bổ sung SĐT + OTP trước khi dùng các tính năng ứng tuyển.
- **Đăng ký:** họ tên, SĐT, email, mật khẩu, tick đồng ý Điều khoản & Chính sách bảo mật → OTP SMS 6 số.
  - Hiệu lực 5 phút.
  - Gửi lại sau 60 giây, tối đa 5 lần/giờ/SĐT, tối đa 10 lần/ngày/IP.
  - Nhập sai 5 lần → khoá OTP 15 phút.
- **Fallback email:** sau 2 lần gửi SMS thất bại hoặc khi bấm "Không nhận được SMS" → sheet MS-08: Gửi lại SMS / Sửa số điện thoại / **Nhận mã qua email** (chỉ khi đã nhập email). SĐT vẫn ở trạng thái `unverified` và hệ thống nhắc xác thực lại sau.
- **Quên mật khẩu:** nhập email/SĐT → chọn kênh nhận mã (SMS/email, che bớt: `+84 91•••••78`) → nhập mã → mật khẩu mới → thành công + đăng xuất mọi phiên khác.
  - **Không tiết lộ tài khoản có tồn tại hay không** (luôn báo "Nếu tài khoản tồn tại, mã đã được gửi").
- **Ngữ cảnh Business:** đăng nhập vào `business` kiểm tra user có membership hoặc ctv_profile.
  - Nếu chưa có → màn "Tạo không gian tuyển dụng" `[Gợi ý]`: Doanh nghiệp (tên, MST, GP XKLĐ) hoặc Cá nhân/CTV (chọn đơn vị liên kết).
  - Đây **không** phải bước "chọn loại tài khoản" lúc đăng ký: nó chỉ xuất hiện khi người dùng chủ động vào Business.
- **Đăng xuất:** thu hồi refresh token. Có "Đăng xuất khỏi mọi thiết bị" trong Cài đặt.
- **2FA (Business, khuyến nghị cho owner/admin; bắt buộc cho admin):** TOTP + mã dự phòng.

**Validation:**

- **Mật khẩu:** ≥ 8 ký tự, có chữ và số. Chặn top 10k mật khẩu phổ biến. Hiện thanh độ mạnh.
- **Email:** RFC; chặn email tạm thời (disposable).
- **Họ tên:** 2–60 ký tự, cho phép dấu tiếng Việt.

**Edge cases:**

- SĐT đã đăng ký → "Số này đã có tài khoản. Đăng nhập?"
- Đổi SĐT phải OTP cả số cũ (nếu còn dùng) và số mới.
- Khoá đăng nhập 15 phút sau 10 lần sai; hiện CAPTCHA (Turnstile) sau 3 lần sai.

### M2. Trang chủ & khám phá

**Màn:** W-01, MS-02, MS-14.

- **Hero tìm kiếm:** tỉnh + chương trình + từ khoá. Gợi ý tự hoàn thành (ngành, tỉnh, công ty), hỗ trợ gõ không dấu.
- **Việc theo tỉnh:** số đơn đang mở từng tỉnh (cache 5 phút), "Xem đủ 47 tỉnh".
- **Việc mới nhất:** thẻ tin gồm ảnh, tiêu đề, tỉnh, lương cơ bản/tháng, số lượng, năm sinh, người đăng (DN/CTV) + badge "NTD xác thực", nút "Ứng tuyển ngay". Hỗ trợ sắp xếp.
- **Đã đăng nhập (MS-14):** khối "Gợi ý cho bạn" theo hồ sơ (icon target), tiếp tục xem gần đây, trạng thái ứng tuyển mới.
- **Quảng cáo/tài trợ:** luôn gắn nhãn "Tài trợ" / "Quảng cáo"; cấu hình ở admin (A-10/A-13).
- **Đăng ký nhận đơn mới** (footer): khách nhập email/SĐT + tỉnh + ngành → tạo alert ở dạng `guest_subscription`, xác nhận qua email (double opt-in).

### M3. Tìm kiếm & bộ lọc

**Màn:** W-02, MS-15.

- **Bộ lọc:**
  - tỉnh (nhiều);
  - khu vực (Kanto, Kansai…);
  - chương trình;
  - ngành (8 ngành chính + xem thêm);
  - giới tính;
  - năm sinh của bạn (lọc theo khoảng tuổi của tin);
  - lương cơ bản từ;
  - dự kiến xuất cảnh;
  - đặc điểm đơn: miễn phí xuất cảnh, tuyển gấp, có làm thêm, không yêu cầu tiếng Nhật, NTD xác thực.
- **URL đồng bộ bộ lọc** (`?pref=saitama,chiba&prog=tts&min=170000`) để chia sẻ được và tốt cho SEO.
- **Sắp xếp:** Phù hợp nhất (cần đăng nhập, dùng match score; khi là khách thì theo độ liên quan), Mới nhất, Lương cao nhất, Xuất cảnh sớm nhất.
- **"Tìm nhiều":** chip từ khoá phổ biến (Kaigo Osaka, Xây dựng Aichi…), cập nhật hằng ngày.
- **Empty state:** "Chưa có đơn khớp bộ lọc" + gợi ý bỏ bớt điều kiện + "Nhờ tư vấn miễn phí" + "Lưu bộ lọc thành thông báo".
- **Mobile:** bộ lọc mở dạng bottom sheet, hiện số kết quả trực tiếp trên nút "Xem N kết quả".
- **SEO:** landing page tĩnh cho tổ hợp tỉnh × ngành × chương trình (`/viec-lam/saitama/dien-tu`), có schema.org `JobPosting`.

### M4. Chi tiết tin & ứng tuyển

**Màn:** W-03, W-04, MS-17, MS-20, MS-03.

- **Phần đầu:** ảnh/video (gallery), tiêu đề, badge, lương cơ bản + **thực lĩnh ước tính**, chi phí xuất cảnh (nổi bật màu xanh nếu miễn phí), số lượng, hạn nhận, ngày thi.
- **Khối thông tin** (gọn, có "Xem thêm"): yêu cầu, mô tả công việc, quyền lợi, chi phí chi tiết, nơi làm việc (bản đồ tỉnh), lịch trình dự kiến.
- **Người đăng:** thẻ DN (logo, xác minh, số tin, GP XKLĐ) hoặc CTV (pill xác nhận + đơn vị liên kết). Nút Gọi / Zalo / Nhắn tin.
- **Điểm phù hợp** (đã đăng nhập): % + 3 lý do; nếu thiếu tiêu chí thì gợi ý "Bổ sung chiều cao để biết mức phù hợp".
- **Hành động:** Ứng tuyển (sticky bottom trên mobile), Lưu, Chia sẻ (link, Zalo, Facebook, QR), **Báo cáo tin**.
- **Ứng tuyển 1 chạm (MS-20):** xem trước hồ sơ gửi đi → trả lời câu hỏi sàng lọc → ghi chú → Gửi → màn thành công: "Cán bộ sẽ gọi trong 30 phút (giờ hành chính)" + "Theo dõi ứng tuyển".
- **Hồ sơ chưa đủ:** nếu thiếu trường bắt buộc (họ tên, SĐT, năm sinh, giới tính, quê quán) → mở form bổ sung nhanh ngay trong luồng.
- **Ứng tuyển nhanh khi là khách (web, W-04):** gửi xong thì OTP SĐT để xác nhận (chống spam), sau đó gợi ý đặt mật khẩu để tạo tài khoản.
- **Tin tương tự:** cùng ngành và tỉnh lân cận, 6 tin.
- **Tin hết hạn / đủ chỉ tiêu:** vẫn xem được (tốt cho SEO), nút ứng tuyển bị khoá kèm "Xem việc tương tự".
- **Thống kê:** đếm view (dedupe theo user/IP mỗi 24h), lượt ứng tuyển, lượt chia sẻ.

### M5. Hồ sơ ứng viên

**Màn:** C-02, MS-24, MS-25, MS-26.

- **Nhóm thông tin:**
  - Cá nhân: họ tên, năm sinh, giới tính, quê quán, địa chỉ hiện tại, SĐT, email, Zalo.
  - Nguyện vọng: chương trình, ngành, tỉnh Nhật, lương mong muốn, thời gian xuất cảnh.
  - Kinh nghiệm: danh sách công việc.
  - Học vấn.
  - Tiếng Nhật: cấp JLPT/NAT, tự đánh giá.
  - Thể chất: chiều cao, cân nặng, thị lực, hình xăm, hút thuốc, tay thuận.
  - Tài liệu: CV, ảnh, chứng chỉ — **không có CCCD**.
- **% hoàn thiện** và gợi ý mục còn thiếu, kèm tác động ("+15% cơ hội được gọi").
- **Ảnh đại diện:** crop vuông, nén ≤ 300KB.
- **Sửa nhanh nguyện vọng** dạng sheet chip (MS-26).
- **Quyền riêng tư:** "Cho phép NTD đã xác minh tìm thấy hồ sơ" (mặc định tắt) `[Gợi ý: tính năng săn ứng viên cho gói Business]`.
- **Xuất hồ sơ PDF** song ngữ Việt–Nhật (履歴書 rirekisho) `[Gợi ý]`.

### M6. Theo dõi ứng tuyển, việc đã lưu

**Màn:** C-03, C-04, MS-21, MS-22.

- **Danh sách ứng tuyển:** tab Đang xử lý / Có lịch hẹn / Đã kết thúc. Mỗi thẻ hiện bước hiện tại + timeline (có "Xem chi tiết").
- **Hành động:** xác nhận lịch hẹn, xin đổi lịch, nhắn NTD, **rút đơn** (kèm lý do), xem tin gốc.
- **Việc đã lưu:**
  - nhãn "Sắp hết hạn" (≤ 3 ngày);
  - "Đã đủ chỉ tiêu" (mờ đi);
  - bỏ lưu với undo 5 giây;
  - nhắc trước hạn qua push `[Gợi ý]`.

### M7. Thông báo việc làm & Thông báo (inbox)

**Màn:** C-05, MS-16.

- **Job alerts:** xem 3.12. Worker chạy theo tần suất; với tần suất "ngay khi có", gửi trong vòng 10 phút sau khi tin được duyệt. Gom nhiều tin vào 1 thông báo.
- **Inbox thông báo:** nhóm Hôm nay / Trước đó; loại (ứng tuyển, lịch hẹn, việc mới, hệ thống); "Đánh dấu tất cả đã đọc"; deep link tới màn liên quan.
- **Web:** dropdown chuông ở header `[Gợi ý — chưa design]`.

### M8. Cài đặt (ứng viên)

**Màn:** C-06, MS-27.

- **Tài khoản & bảo mật:** đổi mật khẩu, đổi SĐT/email (OTP), liên kết/huỷ Google, phiên đăng nhập & thiết bị, đăng xuất tất cả.
- **Thông báo:** ma trận nhóm × kênh, giờ yên lặng.
- **Quyền riêng tư:** hiển thị hồ sơ, chặn NTD `[Gợi ý]`, tải dữ liệu của tôi (xuất JSON/PDF trong 48h).
- **Ngôn ngữ:** Tiếng Việt / 日本語 / English.
- **Xoá tài khoản:** xác nhận bằng OTP, có thời gian ân hạn 30 ngày rồi xoá/ẩn danh dữ liệu. Các đơn ứng tuyển đã gửi được giữ dạng ẩn danh cho thống kê.

### M9. Trang công ty & trang CTV

**Màn:** W-05, W-06, MS-18, MS-19.

- **Trang công ty:** SEO `/cong-ty/{slug}`, các tab Giới thiệu / Việc đang tuyển / Hình ảnh / Đánh giá `[Gợi ý]`. Badge "Đã xác minh" + số GP XKLĐ (tra cứu được), năm hoạt động, số người đã xuất cảnh qua viecpro.
- **Trang CTV:** `/ctv/{slug}`, hiện đơn vị liên kết (link tới trang công ty), tin đang chia sẻ, khu vực hoạt động. Liên hệ qua chat; SĐT hiện sau khi đăng nhập.
- **Theo dõi công ty** `[Gợi ý]`: nhận thông báo khi công ty có tin mới.

### M10. Business — Tổng quan

**Màn:** B-01, ME-05, B-02, ME-17.

- **Banner hành động ưu tiên:** quá SLA liên hệ, tin bị từ chối, gói sắp hết, GP sắp hết hạn.
- **Biểu đồ:**
  - hồ sơ theo ngày (7/30/90 ngày, tách cuối tuần);
  - phễu: Ứng tuyển → Liên hệ → PV → Trúng tuyển → Xuất cảnh;
  - benchmark với trung bình ngành.
- **Bảng tin:** lượt xem, hồ sơ, chỉ tiêu (đã đạt/tổng), hạn, Đẩy tin. Lọc theo cán bộ phụ trách.
- **Kanban ứng viên mini:** kéo thả đổi bước, có quick action Gọi / Nhắn / Hẹn PV.
- **Lịch PV hôm nay.**
- **CTV:** KPI giới thiệu/trúng tuyển/xuất cảnh, hoa hồng dự kiến và đã nhận, top tin hiệu quả.

### M11. Business — Quản lý tin & Đăng tin

**Màn:** B-03, B-06, ME-06, ME-07, ME-18.

- **Danh sách tin:**
  - tab Đang hiển thị / Chờ duyệt / Bị từ chối / Nháp / Tạm dừng / Hết hạn;
  - tìm kiếm, lọc cán bộ;
  - bulk action (tạm dừng, gia hạn, đổi người phụ trách).
- **Đăng tin (B-06):**
  - **Thanh tiến độ "Hoàn thiện"** theo từng khu; điều hướng neo bên trái.
  - **Dùng lại tin cũ:** nhân bản rồi sửa.
  - **"Viết giúp"** mô tả công việc (đổi wording thành "Viết giúp" + icon bút, theo R8/R9): sinh gạch đầu dòng từ ngành và công việc; người dùng phải xem lại.
  - **Lương:** thanh trung vị ngành/tỉnh, tự tính thực lĩnh.
  - **Câu hỏi sàng lọc:** tối đa 5 câu, đánh dấu câu "loại trực tiếp".
  - **Nhận hồ sơ qua:** viecpro (mặc định), kèm hiện SĐT/Zalo cán bộ.
  - **Gói hiển thị:** Thường / Đẩy tin / Nổi bật, có hiện giá hoặc lượt còn lại.
  - **Xem trước** Máy tính/Điện thoại.
  - **Panel phải:** Chất lượng tin, Dự kiến tiếp cận, Hồ sơ dự kiến, Đủ chỉ tiêu sau N ngày.
  - **Kiểm tra trước khi gửi:** chặn SĐT/link trong mô tả và ảnh (OCR) `[Gợi ý]`; cảnh báo từ khoá "phí giữ chỗ", "đặt cọc".
  - "Gửi duyệt tin" → `pending_review`; thông báo khi có kết quả.
- **CTV đăng tin (ME-18):** chọn "Lấy đơn từ đơn vị" (danh sách tin của các đơn vị liên kết → Chia sẻ) hoặc "Đăng đơn lẻ" (form rút gọn + chọn đơn vị chịu trách nhiệm).

### M12. Business — Ứng viên & pipeline

**Màn:** B-04, B-07, ME-08, ME-09, ME-10.

- **Bộ lọc:** tin (tất cả hoặc từng tin), mức phù hợp (≥ 90%, ≥ 80%), bước, nguồn, cán bộ, ngày, lọc nhanh (chưa liên hệ, có lịch, mới hôm nay).
- **Chế độ xem:** bảng (mặc định) / kanban.
- **Drawer hồ sơ:** thông tin chính, Bước tuyển dụng (đổi bước + lý do khi loại), Vì sao phù hợp, Giấy tờ đính kèm, Hoạt động (timeline), Ghi chú nội bộ (@mention đồng nghiệp `[Gợi ý]`), nút Gọi / Zalo / Nhắn / Hẹn PV / Không phù hợp.
- **Bulk:** đổi bước, gửi tin nhắn mẫu, đặt lịch chung, xuất Excel (ghi audit log và che bớt SĐT với vai trò viewer).
- **Thêm ứng viên:** xem 3.5.
- **Mẫu tin nhắn** `[Gợi ý]`: mời PV, nhắc giấy tờ, thông báo kết quả, kèm biến `{ten}`, `{ngay}`.

### M13. Business — Lịch hẹn

**Màn:** B-05, B-08, ME-11, ME-12. Xem 3.6.

- **Lịch:** xem tuần/tháng/danh sách; màu theo loại lịch; RSVP của từng ứng viên.
- **Đồng bộ lịch:** xuất `.ics`, Google Calendar `[Gợi ý]`.
- **Check-in tại buổi PV** bằng QR `[Gợi ý]`.

### M14. Business — Tài khoản DN, thành viên, cài đặt

**Màn:** ME-13 → ME-15, (web `[Gợi ý — chưa design]`).

- **Hồ sơ công ty:** sửa các trường chưa xác minh; trường đã xác minh bị khoá.
- **Xác minh:** upload ĐKKD, GP XKLĐ, Thư uỷ quyền (PDF/ảnh ≤ 10MB, bucket private, link xem có hạn 5 phút); xác minh email tên miền.
- **Thành viên** `[Gợi ý design web]`: mời qua email/SĐT, gán vai trò, phân tin, vô hiệu hoá. Hạn mức theo gói.
- **CTV liên kết (phía DN)** `[Gợi ý design]`: duyệt yêu cầu liên kết, xem hợp đồng, cấu hình hoa hồng, gỡ liên kết.
- **Cài đặt:** 2FA, thông báo, giờ làm việc (dùng để tính SLA), mẫu tin nhắn.

### M15. CTV

**Màn:** ME-16 → ME-21, B-02. Xem 3.8.

- **Đơn vị liên kết:** danh sách đơn vị + trạng thái (chờ xác nhận / đã xác nhận / đã gỡ); gửi yêu cầu liên kết (tìm DN, upload hợp đồng).
- **Hoa hồng:** tổng quan theo mốc, danh sách từng ứng viên, lọc theo trạng thái, xuất sao kê; thông tin nhận tiền (tên ngân hàng, số TK — lưu mã hoá, chỉ hiện 4 số cuối).
- **Chia sẻ tin:** link rút gọn + QR (tải PNG), chia sẻ Zalo/Facebook, thống kê click/ứng tuyển theo link.
- **Hồ sơ CTV:** tên hiển thị, ảnh, giới thiệu, khu vực; pill xác nhận.
- **CTV trên web Business** `[Gợi ý — mới có B-02]`: cần design thêm trang Đơn vị, Hoa hồng, Chia sẻ.

### M16. Tin nhắn (chat) — `[Gợi ý — chưa design, ưu tiên P1]`

- 1–1 giữa ứng viên và NTD (theo tin hoặc theo đơn). Chỉ NTD/CTV đã xác minh mới được nhắn trước.
- Văn bản, ảnh, file PDF (≤ 10MB), tin nhắn mẫu, trạng thái đã đọc, đang gõ.
- **Chống lừa đảo:**
  - cảnh báo khi phát hiện từ khoá chuyển tiền, đặt cọc, số tài khoản;
  - banner "viecpro không bao giờ yêu cầu chuyển tiền qua chat";
  - nút **Báo cáo** trong cuộc trò chuyện.
- **Chặn người dùng.** Lưu tin nhắn 2 năm; admin chỉ xem khi có báo cáo liên quan (có audit log).
- **Icon chat:** bong bóng 3 chấm (R8). Badge số chưa đọc ở header.

### M17. Gói & thanh toán — `[Gợi ý — chưa design, ưu tiên P1]`

- **Trang Bảng giá** (công khai) + trang **Gói của tôi** (Business): gói hiện tại, hạn mức đã dùng (tin, lượt đẩy, thành viên), lịch sử hoá đơn, nâng cấp/gia hạn, mua lẻ đẩy tin.
- **Checkout:** chọn gói/kỳ (1/3/6/12 tháng, giảm giá dài hạn), mã giảm giá, thông tin xuất hoá đơn (tên DN, MST, địa chỉ, email nhận) → cổng thanh toán → webhook xác nhận (idempotent) → kích hoạt.
- Chuyển khoản: hiện QR VietQR + nội dung chuyển khoản, admin đối soát.

### M18. Báo cáo vi phạm (phía người dùng) — `[Gợi ý — chưa design form]`

- Nút "Báo cáo" ở tin, trang công ty/CTV, chat, footer ("Báo cáo tin sai").
- **Form:** chọn lý do, mô tả (≤ 1000 ký tự), bằng chứng (≤ 5 ảnh), liên hệ (tự điền nếu đã đăng nhập). Khách gửi được nhưng có CAPTCHA.
- **Trạng thái báo cáo** của tôi trong Cài đặt `[Gợi ý]`.

### M19. Super Admin

**Màn:** A-00 → A-13.

- **A-00 Đăng nhập:**
  - email + mật khẩu + TOTP bắt buộc;
  - phiên 8h, tự khoá sau 30 phút không thao tác;
  - IP allowlist tuỳ chọn.
- **A-01 Bảng điều khiển:** KPI (người dùng mới, tin mới, hồ sơ, doanh thu) so kỳ trước; "Trợ lý vận hành" (rule-based, đổi wording sang "Tự động"/"Cần chú ý", không dùng màu tím AI); phễu; hàng chờ; hoạt động realtime; báo cáo mới; nhu cầu theo tỉnh; Xuất báo cáo.
- **A-02 Kiểm duyệt tin:**
  - **Hàng chờ** sắp xếp theo SLA và điểm rủi ro.
  - **Kiểm tra tự động** (icon scan-check):
    - SĐT/link trong nội dung;
    - lương lệch trung vị > 40%;
    - từ khoá phí;
    - ảnh trùng (perceptual hash);
    - tin trùng (similarity);
    - DN chưa xác minh hoặc GP hết hạn.
  - **Diff phiên bản** khi tin sửa.
  - **Thao tác:** duyệt / từ chối (lý do mẫu + ghi chú) / yêu cầu sửa, phím tắt `A`/`R`/`J`/`K`, hoàn tác 10 giây.
  - **Gán người kiểm duyệt.**
- **A-03 Xác minh:** xem tài liệu (watermark "Chỉ dùng xác minh viecpro"), checklist đối chiếu (tra cứu GP trên cổng DOLAB thủ công), quyết định + lý do, yêu cầu bổ sung. CTV: xem hợp đồng + trạng thái xác nhận từ đối tác + SĐT đã OTP.
- **A-04 Danh sách ứng viên:** tìm theo tên/SĐT/email; lọc theo tỉnh, ngành, trạng thái; xem hồ sơ (SĐT che một phần, bấm "Hiện" sẽ ghi log); khoá/mở khoá; gộp tài khoản trùng `[Gợi ý]`.
- **A-05 Nhà tuyển dụng:** tab Doanh nghiệp / Cá nhân·CTV; drawer 5 tab; thao tác cảnh cáo, tạm khoá, đổi gói thủ công, gán quản lý tài khoản.
- **A-06 Báo cáo vi phạm:** xem 3.9; nhận xử lý (claim), gộp báo cáo cùng đối tượng, quyết định, gửi thông báo kết quả.
- **A-07 Phân tích** `[Gợi ý]`: người dùng (DAU/MAU, cohort), tin (theo ngành/tỉnh), phễu, nguồn traffic, hiệu quả CTV, doanh thu.
- **A-08 Gói & doanh thu** `[Gợi ý]`: CRUD gói và hạn mức, MRR, churn, mã giảm giá.
- **A-09 Giao dịch** `[Gợi ý]`: danh sách đơn hàng, đối soát chuyển khoản, hoàn tiền, xuất hoá đơn, chi trả hoa hồng CTV (duyệt theo lô).
- **A-10 Nội dung & cẩm nang** `[Gợi ý]`: CMS bài viết (Cẩm nang, Chi phí & thủ tục, FAQ), banner quảng cáo, trang pháp lý (có version).
- **A-11 Phân quyền** `[Gợi ý]`: CRUD admin, vai trò và quyền chi tiết (permission keys), reset 2FA.
- **A-12 Nhật ký hệ thống** `[Gợi ý]`: tra cứu audit log theo người, đối tượng, hành động, thời gian; chỉ đọc; xuất CSV.
- **A-13 Cài đặt** `[Gợi ý]`: tham số SLA, OTP, giới hạn gói Free, công thức thực lĩnh, từ khoá cấm, template thông báo, chế độ bảo trì.

### M20. Nội dung & pháp lý — `[Gợi ý — chưa design]`

- **Trang:**
  - Điều khoản sử dụng;
  - Chính sách bảo mật (theo Nghị định 13/2023/NĐ-CP);
  - Quy chế hoạt động;
  - Chính sách giải quyết khiếu nại;
  - Bảng giá;
  - Giới thiệu;
  - Liên hệ;
  - FAQ;
  - Cẩm nang (blog SEO).
- Footer hiển thị số **giấy phép hoạt động** (hiện đang là placeholder `[SỐ GIẤY PHÉP]` → bắt buộc điền trước khi launch).
- Lưu **lịch sử đồng ý điều khoản** theo phiên bản (user_id, version, accepted_at).

### M21. Trạng thái hệ thống — `[Gợi ý]`

- 404, 500, mất mạng (mobile offline banner + cache tin đã xem), bảo trì, cập nhật app bắt buộc (force update theo min version).
- Skeleton loading cho mọi danh sách; empty state có hành động cụ thể.

---

## 7. Tính năng gợi ý bổ sung (ưu tiên)

| Ưu tiên | Tính năng | Lý do |
|---|---|---|
| **P1** | Tin nhắn (M16) | NTD và ứng viên cần kênh an toàn trong nền tảng |
| **P1** | Gói & thanh toán NTD (M17) | Doanh thu |
| **P1** | Form báo cáo vi phạm phía người dùng (M18) | Đã có xử lý ở admin nhưng chưa có đầu vào |
| **P1** | Trang pháp lý + FAQ (M20) | Bắt buộc trước khi launch |
| **P1** | Admin login + Phân quyền + Nhật ký (A-00, A-11, A-12) | Bảo mật vận hành |
| **P1** | Quản lý thành viên DN + duyệt CTV liên kết (web) | Đã có logic, thiếu màn |
| P2 | Dropdown thông báo web | Đồng bộ với app |
| P2 | CTV trên web Business (đầy đủ) | CTV dùng máy tính |
| P2 | Cẩm nang / CMS | SEO và giáo dục người lao động |
| P2 | Phân tích NTD nâng cao | Giữ chân khách trả phí |
| P2 | Landing cho NTD (`business.viecpro.vn`) | Thu hút NTD |
| P2 | Onboarding app (3 slide + quyền push) | Tăng tỉ lệ bật thông báo |
| P3 | Đánh giá công ty (chỉ người đã xuất cảnh qua viecpro) | Minh bạch, uy tín |
| P3 | Săn ứng viên (NTD tìm hồ sơ công khai) | Upsell gói Business |
| P3 | Rirekisho PDF song ngữ | Giá trị cao cho ứng viên |
| P3 | Chế độ tối, đa ngôn ngữ ja/en đầy đủ | |
| P3 | Admin PWA (duyệt nhanh, xử lý báo cáo critical) | Theo R7 |
| P3 | Gọi điện ẩn số (call masking) | Bảo vệ SĐT ứng viên |

---

## 8. API outline (REST, prefix `/v1`)

**Quy ước chung:**

- Dữ liệu JSON, tên trường `camelCase`.
- Phân trang bằng cursor (`?cursor=&limit=`).
- Lỗi theo dạng `{ code, message, fields? }`.
- Header `Idempotency-Key` cho các lệnh POST thanh toán và ứng tuyển.
- OpenAPI được sinh tự động và dùng để tạo `packages/api-client`.

```text
# Auth
POST   /auth/register                {fullName, phone, email, password}
POST   /auth/otp/send                {target, channel, purpose}
POST   /auth/otp/verify              {target, code, purpose}
POST   /auth/login                   {identifier, password, context}
POST   /auth/google                  {idToken, context}
POST   /auth/refresh | /auth/logout | /auth/logout-all
POST   /auth/password/forgot | /auth/password/reset
POST   /auth/2fa/setup | /auth/2fa/verify | /auth/2fa/disable

# Public
GET    /jobs?pref=&prog=&ind=&gender=&birthYear=&minSalary=&departure=&tags=&sort=&q=
GET    /jobs/:slug            GET /jobs/:id/similar
GET    /orgs/:slug            GET /ctv/:slug
GET    /meta/prefectures | /meta/industries | /meta/trending
POST   /quick-apply           (khách, cần OTP)
POST   /reports
POST   /subscriptions/guest   (đăng ký nhận đơn)

# Seeker (auth)
GET/PATCH /me                 GET/PATCH /me/profile
POST/DELETE /me/documents
GET    /me/applications       POST /jobs/:id/apply     POST /applications/:id/withdraw
POST   /interviews/:id/rsvp
GET/POST/DELETE /me/saved-jobs
GET/POST/PATCH/DELETE /me/alerts
GET    /me/notifications      POST /me/notifications/read-all
GET/PATCH /me/notification-prefs
GET    /me/sessions           DELETE /me/sessions/:id
POST   /me/export             DELETE /me

# Chat
GET    /conversations         POST /conversations
GET    /conversations/:id/messages   POST /conversations/:id/messages
WS     /realtime  (events: message.new, message.read, typing)

# Business (header X-Org-Id)
GET    /biz/dashboard
GET/POST /biz/jobs            GET/PATCH /biz/jobs/:id
POST   /biz/jobs/:id/submit | /pause | /resume | /duplicate | /boost
GET    /biz/applications?jobId=&stage=&minMatch=&q=
PATCH  /biz/applications/:id/stage   POST /biz/applications/bulk
POST   /biz/applications/:id/notes
POST   /biz/candidates        POST /biz/candidates/invite   GET /biz/candidates/check-phone
GET/POST/PATCH /biz/interviews
GET/PATCH /biz/org            POST /biz/org/verification
GET/POST/PATCH/DELETE /biz/members
GET/PATCH /biz/ctv-links      (DN duyệt CTV)
GET    /biz/billing           POST /biz/checkout     POST /payments/webhook/:provider
GET    /biz/export/applications.xlsx

# CTV
GET    /ctv/dashboard
GET/POST /ctv/links           GET /ctv/partner-jobs   POST /ctv/jobs   POST /ctv/share
GET    /ctv/commissions       PATCH /ctv/payout-info

# Admin (apps/admin → /admin/*, guard role + permission)
GET    /admin/dashboard
GET    /admin/moderation/queue   POST /admin/moderation/:revisionId/decide
GET    /admin/verifications      POST /admin/verifications/:id/decide
GET    /admin/users | /admin/orgs | /admin/ctv
POST   /admin/sanctions
GET    /admin/reports            POST /admin/reports/:id/claim | /decide
CRUD   /admin/plans | /admin/coupons | /admin/articles | /admin/admins | /admin/settings
GET    /admin/orders             POST /admin/orders/:id/reconcile | /refund
GET    /admin/audit-logs
```

---

## 9. Yêu cầu phi chức năng

### 9.1 Bảo mật & quyền riêng tư

- Tuân thủ **Nghị định 13/2023/NĐ-CP** về bảo vệ dữ liệu cá nhân:
  - có consent cho từng mục đích;
  - quyền truy cập, xuất và xoá dữ liệu;
  - ghi log xử lý dữ liệu.
- **Không thu thập CCCD** (R4). Dữ liệu nhạy cảm (số TK ngân hàng CTV, tài liệu xác minh) được **mã hoá at-rest** (envelope KMS) và lưu trong bucket private với URL ký hết hạn.
- Mật khẩu hash bằng **argon2id**. OTP lưu dạng hash.
- Rate limit theo IP, user và SĐT. CAPTCHA Turnstile cho đăng ký, quick-apply và báo cáo của khách.
- Bảo vệ web: CSRF (cookie SameSite + token), CSP nghiêm, HSTS, kiểm tra upload (MIME sniff, giới hạn kích thước, quét virus ClamAV).
- **Audit log append-only** cho mọi thao tác admin, thao tác xuất dữ liệu, xem SĐT đầy đủ và đổi bước ứng viên.
- **Che SĐT** ứng viên với vai trò không đủ quyền. NTD chỉ thấy hồ sơ ứng viên đã ứng tuyển vào tin của mình, hoặc hồ sơ ứng viên đã đồng ý công khai.
- Pentest/OWASP ASVS L2 trước khi launch; chạy dependency scan trong CI.

### 9.2 Hiệu năng

- Web public: LCP < 2,5s trên 4G, CLS < 0,1. Trang tin dùng ISR (revalidate 60s + on-demand khi tin được duyệt).
- API: p95 < 300ms; tìm kiếm p95 < 200ms.
- Mobile: khởi động lạnh < 2,5s trên máy Android tầm trung; danh sách dùng FlashList.
- Ảnh: WebP/AVIF, `srcset`, lazy-load.

### 9.3 Độ tin cậy

- Uptime 99,9%. Backup DB hằng ngày + PITR 7 ngày.
- Queue có retry/backoff và dead-letter queue. Webhook thanh toán idempotent.
- SMS có nhà cung cấp dự phòng, tự chuyển khi tỉ lệ lỗi > 5% trong 5 phút.

### 9.4 Trải nghiệm & khả năng tiếp cận

- WCAG 2.1 AA: tương phản ≥ 4.5:1, focus rõ, nhãn aria, vùng chạm ≥ 44px.
- Nguyên tắc "ít chữ": mỗi thẻ tối đa 3 dòng thông tin + "Xem chi tiết".
- Mọi thao tác phá huỷ (xoá, loại ứng viên) đều có xác nhận hoặc undo.
- Định dạng: tiền yên `176.000 ¥`, USD `1.500 USD`, ngày `dd/mm/yyyy`, giờ 24h, múi giờ hiển thị Asia/Ho_Chi_Minh.

### 9.5 Analytics

- Sự kiện (PostHog hoặc GA4 + server events):
  - `job_view`, `job_save`, `apply_start`, `apply_submit`;
  - `login_gate_shown`, `login_gate_converted`;
  - `alert_create`, `search`, `filter_apply`;
  - `share_click`, `ref_click`;
  - `post_job_submit`, `stage_change`, `checkout_start`, `payment_success`.
- Dashboard phễu khớp với A-01.

### 9.6 i18n

- Toàn bộ chuỗi đưa vào `packages/i18n`, không hard-code.
- `vi` là bản đầy đủ; `ja` và `en` dùng cho trang công khai và Business ở phase 9.

---

## 10. Thứ tự build chuẩn production

> Mỗi phase kết thúc bằng: demo trên môi trường staging, toàn bộ test xanh, cập nhật CHANGELOG. **Không bắt đầu phase sau khi phase trước chưa đạt Acceptance criteria.**

### Phase 0 — Nền móng (1–2 tuần)

- Monorepo, lint/format, tsconfig strict, commit convention, CI (lint, typecheck, unit test), preview deploy.
- `packages/ui-tokens` + `packages/icons` (bộ icon theo R8, gồm chat 3 chấm, bulb, briefcase, target, scan-check, shield-check…).
- Component nền web và native: Button, Input, Select, Chip, Switch, Segmented, Card, Sheet/Drawer, Modal, Toast, Skeleton, EmptyState, Tabs, Avatar, Badge/Pill, Pagination, Table, Stepper, OTP input.
- API skeleton (NestJS): config, logger, error format, health check, OpenAPI, Prisma + migration, seed (47 tỉnh, ngành, chương trình, dữ liệu demo theo design).
- Hạ tầng: Postgres, Redis, S3, Meilisearch (docker-compose dev), Sentry.

**Acceptance criteria:**

- `pnpm dev` chạy được cả 5 app.
- Storybook có đủ component nền, khớp token design.
- CI xanh.

### Phase 1 — Xác thực & tài khoản (2 tuần)

- **M1** đầy đủ: đăng ký, OTP SMS và fallback email, đăng nhập email/SĐT, Google, quên mật khẩu, refresh token, phiên đăng nhập, rate limit.
- **Màn:** W-07, W-08, W-09; MS-05 → MS-13; ME-01 → ME-04.
- App: MS-01 Chọn vai trò; guest-first; sheet gating (MS-03) với pending intent; drawer ☰ cho khách (MS-04) và cho người đã đăng nhập.
- Header mobile kiểu Facebook (R10).

**Acceptance criteria:**

- E2E: đăng ký → OTP → đăng nhập → đăng xuất trên web và app.
- SMS lỗi → nhận mã qua email thành công.
- Không có Zalo login, không có bước chọn loại tài khoản, không có trường CCCD (test kiểm tra bằng grep).
- Khách bấm "Ứng tuyển" → đăng nhập → quay lại đúng tin và mở bước ứng tuyển.

### Phase 2 — Lõi ứng viên: khám phá & ứng tuyển (3 tuần)

- **M2, M3, M4, M5, M6** cho web (W-01 → W-06, C-01 → C-04) và app (MS-02, MS-14 → MS-26).
- Index Meilisearch, đồng bộ khi tin đổi trạng thái.
- Match score v1 (rule-based) + "Vì sao phù hợp".
- Quick apply cho khách (W-04).
- SEO: sitemap, `JobPosting` schema, landing tỉnh × ngành.
- Dữ liệu tin tạm thời được seed (chưa có Business).

**Acceptance criteria:**

- Lọc theo mọi tiêu chí trong design; URL chia sẻ được.
- Ứng tuyển 1 chạm < 3 thao tác; chống trùng đơn.
- Lighthouse ≥ 90 (Performance, SEO, Accessibility) cho W-01, W-02, W-03.
- Hồ sơ hiển thị % hoàn thiện đúng.

### Phase 3 — Lõi Business: đăng tin & xử lý ứng viên (3–4 tuần)

- Tổ chức, thành viên (owner/admin/recruiter), chuyển đổi workspace.
- **M10, M11, M12, M13** cho web (B-01, B-03 → B-08) và app (ME-05 → ME-12).
- Vòng đời tin (draft → pending_review…), tự lưu nháp, xem trước, chất lượng tin, câu hỏi sàng lọc + loại trực tiếp.
- Pipeline, kanban, ghi chú nội bộ, thêm ứng viên (mời / nhập tay / cảnh báo trùng SĐT / consent SMS), lịch hẹn + RSVP + nhắc lịch.
- Xuất Excel (có audit log).

**Acceptance criteria:**

- Luồng đầy đủ: NTD đăng tin → (tạm auto-approve bằng feature flag) → ứng viên ứng tuyển → NTD đổi bước → đặt PV → ứng viên RSVP.
- Recruiter chỉ thấy tin được giao (test phân quyền).
- Ghi chú nội bộ không bao giờ trả về trong API phía seeker.

### Phase 4 — Tin cậy & an toàn: kiểm duyệt, xác minh, báo cáo (2–3 tuần)

- Admin app nền: A-00 (login + TOTP), layout sidebar, RBAC permission keys, **audit log** (A-12 bản cơ bản), A-11 Phân quyền.
- **A-02 Kiểm duyệt** + kiểm tra tự động; bỏ feature flag auto-approve.
- **A-03 Xác minh** DN và CTV; khoá trường đã xác minh (ME-14); nhắc GP sắp hết hạn.
- **M18** form báo cáo + **A-06** xử lý báo cáo, SLA, tự tạm ẩn, sanctions, điểm uy tín.
- **A-04, A-05** quản lý ứng viên và NTD.

**Acceptance criteria:**

- Tin mới chỉ public sau khi được duyệt.
- Sửa trường trọng yếu → quay lại hàng chờ, bản cũ vẫn hiển thị.
- 3 báo cáo "thu phí" trong 24h → tin tự ẩn + thông báo cho admin.
- Mọi hành động admin có trong audit log.
- Admin không đăng nhập được nếu thiếu 2FA.

### Phase 5 — CTV & giới thiệu (2 tuần)

- **M15:** liên kết đơn vị (CTV gửi yêu cầu, DN xác nhận), CTV đăng tin (lấy đơn / đơn lẻ), link + QR + attribution, hoa hồng theo mốc, thông tin nhận tiền mã hoá.
- **Màn:** ME-16 → ME-21, B-02, W-06/MS-19 hiện pill xác nhận; màn duyệt CTV phía DN.

**Acceptance criteria:**

- Click link ref → ứng tuyển trong 30 ngày → đơn có `ref_ctv_id`.
- Đơn chuyển `departed` → hoa hồng `eligible` sau 30 ngày (test bằng clock giả lập).
- CTV chỉ thấy ứng viên mình giới thiệu.

### Phase 6 — Thông báo, alert & chat (2–3 tuần)

- **Hạ tầng thông báo:** template, đa kênh, giờ yên lặng, delivery logs, preference.
- **M7** job alerts + inbox (C-05, MS-16, dropdown web).
- **M8** cài đặt đầy đủ (C-06, MS-27, ME-15).
- **M16** chat realtime + chống lừa đảo + báo cáo trong chat.

**Acceptance criteria:**

- Alert "ngay khi có" gửi trong ≤ 10 phút sau khi tin được duyệt.
- Không gửi push trong giờ yên lặng.
- Chat chạy được trên web và app, có unread badge, chặn được người dùng.

### Phase 7 — Gói & thanh toán (2 tuần)

- **M17:** bảng giá, gói của tôi, checkout VNPay/MoMo/chuyển khoản, webhook idempotent, hoá đơn VAT, đẩy tin, enforcement hạn mức (số tin, lượt đẩy, thành viên), hạ gói khi hết hạn.
- **A-08, A-09:** quản lý gói, giao dịch, đối soát, hoàn tiền, chi trả hoa hồng CTV.

**Acceptance criteria:**

- Thanh toán sandbox thành công → gói kích hoạt trong < 1 phút.
- Gửi trùng webhook không tạo trùng đơn.
- Vượt hạn mức → UI chặn kèm CTA nâng cấp.

### Phase 8 — Admin hoàn chỉnh & nội dung (2 tuần)

- **A-01** Dashboard số liệu thật.
- **A-07** Phân tích.
- **A-10** CMS (Cẩm nang, FAQ, banner, trang pháp lý có version).
- **A-12** đầy đủ.
- **A-13** Cài đặt.
- **M20** các trang pháp lý + lưu lịch sử đồng ý điều khoản.
- Đổi wording "AI" → "Tự động"/"Gợi ý" và màu tím → xanh ở admin (R9).

**Acceptance criteria:**

- Mọi tham số nghiệp vụ (SLA, OTP, hạn mức Free, công thức thực lĩnh, từ khoá cấm) chỉnh được ở A-13 mà không cần deploy.

### Phase 9 — Hoàn thiện, QA & launch (2–3 tuần)

- M21 (404, 500, offline, force update, bảo trì), onboarding app, i18n ja/en cho trang công khai.
- Kiểm thử:
  - **hiệu năng** (k6: 500 rps cho tìm kiếm);
  - **bảo mật** (pentest, ASVS L2);
  - **accessibility** (axe);
  - **tương thích** (iOS 16+, Android 9+, Chrome/Safari/Edge 2 bản gần nhất).
- **Store:** EAS build, metadata, ảnh store, chính sách quyền riêng tư, xử lý review Apple (bắt buộc có xoá tài khoản trong app; nếu có Google login thì cân nhắc Sign in with Apple theo guideline 4.8).
- **Vận hành:** runbook, cảnh báo (error rate, queue backlog, SMS fail rate, SLA kiểm duyệt), on-call.
- **Pháp lý:** điền số giấy phép ở footer, đăng ký website với Bộ Công Thương (nếu áp dụng), phê duyệt chính sách bảo mật.
- **Launch:** soft launch (beta 2 tuần) → public. Feature flags cho các tính năng rủi ro.

**Acceptance criteria:**

- 0 lỗi P0/P1 mở.
- Crash-free sessions ≥ 99,5% trong beta.
- Checklist launch được ký duyệt.

### Phase 10+ — Mở rộng (sau launch)

- Đánh giá công ty, săn ứng viên, rirekisho PDF, admin PWA, call masking, gợi ý việc bằng ML (thay match score rule-based), chế độ tối, chương trình giới thiệu bạn bè cho ứng viên.

---

## 11. Definition of Done (mỗi tính năng)

- [ ] UI khớp design (so screenshot với board; sai lệch ≤ 2px ở layout chính) trên desktop 1440, tablet 768 và mobile 390.
- [ ] Có đủ 4 trạng thái: loading (skeleton), empty, error (có thử lại), success.
- [ ] Validation dùng chung zod schema giữa FE và BE; thông báo lỗi tiếng Việt thân thiện.
- [ ] Kiểm tra quyền ở server và có test cho truy cập trái phép (403/404).
- [ ] Unit test (logic ≥ 80% coverage cho `domain/`), integration test API, ít nhất 1 E2E Playwright/Detox cho luồng chính.
- [ ] Sự kiện analytics được bắn đúng tên.
- [ ] Audit log cho thao tác nhạy cảm.
- [ ] Chuỗi đưa vào i18n; không còn hard-code.
- [ ] A11y: axe không có lỗi nghiêm trọng; điều hướng được bằng bàn phím trên web.
- [ ] Docs: cập nhật OpenAPI, README module, CHANGELOG.
- [ ] Đã rà luật R1–R10 (không Zalo login, không chọn loại tài khoản, không CCCD, icon đúng).

---

## 12. Phụ lục

### 12.1 Danh mục dữ liệu chuẩn (seed)

- **Chương trình:** Thực tập sinh kỹ năng · Kỹ năng đặc định · Kỹ sư – Trí thức.
- **Ngành (8 chính):** Xây dựng · Điện tử – Lắp ráp · Chế biến thực phẩm · Nông nghiệp · Điều dưỡng – Kaigo · Nhà hàng – Khách sạn · Cơ khí – Hàn · IT – Kỹ sư (+ ngành mở rộng).
- **Tỉnh Nhật:** đủ 47 tỉnh, nhóm theo vùng (Hokkaido, Tohoku, Kanto, Chubu, Kansai, Chugoku, Shikoku, Kyushu-Okinawa). Nhóm nổi bật: Tokyo, Osaka, Aichi, Saitama, Kanagawa, Chiba, Hokkaido, Fukuoka.
- **Lương từ:** 170.000 / 190.000 / 210.000 / 250.000 ¥.
- **Dự kiến xuất cảnh:** Trong 3 tháng · 3–6 tháng · 6–12 tháng.
- **Lý do loại ứng viên (mẫu):** không đạt tuổi/giới tính, không liên lạc được, không đạt phỏng vấn, ứng viên từ chối, sức khoẻ không đạt, khác.
- **Lý do từ chối tin (mẫu):** thiếu chi phí xuất cảnh, lương không hợp lý, ảnh không thực tế, có SĐT/link trong nội dung, trùng tin, DN chưa xác minh, khác.

### 12.2 Thông tin liên hệ hiển thị (theo design)

- Hotline ứng viên: 1900 66 88 · hotro@viecpro.vn · Thứ 2 – Thứ 7, 8:00 – 17:30.
- Hỗ trợ DN: 1900 66 99.
- Địa chỉ: Số 21 Lê Đức Thọ, Từ Liêm, Hà Nội.
- Footer phải có số giấy phép hoạt động thật trước khi launch.

### 12.3 Việc design còn thiếu (cần làm trước phase tương ứng)

| Cần trước Phase | Màn |
|---|---|
| 1 | "Tạo không gian tuyển dụng" khi user chưa có tổ chức vào Business |
| 3 | Thành viên DN (web), Tài khoản/Cài đặt Business web |
| 4 | Admin login + 2FA, Phân quyền, Nhật ký; form báo cáo vi phạm (web + app) |
| 5 | Duyệt CTV liên kết (phía DN), CTV trên web Business (Đơn vị, Hoa hồng, Chia sẻ) |
| 6 | Tin nhắn (web + 2 app), dropdown thông báo web |
| 7 | Bảng giá, Gói của tôi, Checkout, Hoá đơn |
| 8 | Admin: Phân tích, Gói & doanh thu, Giao dịch, CMS, Cài đặt; trang pháp lý, FAQ, Cẩm nang |
| 9 | 404/500/offline/bảo trì/force update, onboarding app |

*— Hết —*
