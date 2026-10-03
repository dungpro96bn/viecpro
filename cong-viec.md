# Sổ công việc

Sổ giao việc dùng lâu dài: **mỗi lần giao việc thêm một đợt mới ở cuối file**, không xoá đợt cũ. Số thứ tự việc tăng liên tục qua các đợt (đợt 1: việc 1–5, đợt sau bắt đầu từ việc 6…), để khi trao đổi chỉ cần nói "việc 7".

**Quy trình**
1. Mỗi việc làm trên một nhánh riêng: `feat/<ten-viec>`. Làm theo thứ tự đề xuất trong bảng tổng quan của từng đợt.
2. Xong việc: đánh dấu ✅ ở tiêu đề việc, ghi tên nhánh / commit vào dòng **Trạng thái**, rồi báo để review.
3. Review: chỗ chưa đúng hoặc chưa hợp lý được ghi vào **Kết quả review** cuối mỗi việc (mỗi lần review một mục có ngày). Sửa xong thì đánh dấu ✅ từng ý.
4. Việc nào phát sinh thêm trong lúc làm hoặc review mà chưa xử lý ngay thì đưa vào đợt kế tiếp, không sửa lại nội dung việc cũ.

Mọi việc đều tuân theo `RULE.md` (giao diện) và `RULE-BE.md` (backend, bảo mật, phân quyền). Các mục **[BẮT BUỘC]** trong đó áp dụng cho tất cả việc và không nhắc lại từng chỗ.

## Định nghĩa "xong" chung cho mọi việc
- [ ] `npm run typecheck` (root), `npm run test`, `npx oxlint --type-aware src/ test/` (trong `apps/api`) đều sạch.
- [ ] `npm run test:e2e:db -w @viecpro/api` pass (cần `npm run db:up`). Route mới nhận id phải có e2e **401 / 403 / 404** trên Postgres thật, theo mẫu `test/employer-isolation.e2e-spec.ts`. Route admin mới tự được `test/admin-permissions.e2e-spec.ts` quét; thêm quyền mong đợi vào bảng đối chiếu trong file đó.
- [ ] Đổi schema thì có migration (`npm run db:migrate -- --name ...`), seed vẫn chạy.
- [ ] Schema zod, kiểu response, enum, nhãn đặt trong `packages/shared`.
- [ ] Response chỉ thêm trường. Đổi nghĩa / bỏ trường thì phải có route v2 (RULE-BE §2).
- [ ] Giao diện kiểm tra ở bề rộng điện thoại (~375px) và desktop.
- [ ] Cập nhật `README.md` (bảng route / trang) và `RULE-BE.md` §16 nếu liên quan.

---

# Đợt 1 – giao ngày 03/10/2026

Nhánh gốc: `feat/local-storage-rbac`.

## Tổng quan đợt 1

| # | Việc | Cỡ | Hạ tầng thật cần sau | Làm ngay bằng local |
|---|------|----|----------------------|---------------------|
| 1 | Công ty phái cử **chỉ xem** tin & ứng viên của NTD cá nhân liên kết | Vừa – lớn | Không | Có |
| 2 | **Tin nhắn** NTD ↔ ứng viên (MVP) | Lớn | Realtime (Redis pub/sub / WebSocket) – không bắt buộc | Polling trước |
| 3 | **Gói dịch vụ, thanh toán, lịch sử giao dịch** | Lớn | Cổng thanh toán (PayOS / VNPay / MoMo) | Cổng giả lập `MockPaymentProvider` |
| 4 | **Trang bảo trì** riêng cho web | Nhỏ | Không | Có |
| 5 | Gom việc nhỏ: khách cần tư vấn ở trang tin, thông báo lead công ty, ẩn link chết | Nhỏ | Không | Có |

**Thứ tự đề xuất:** 4 → 5 → 1 → 3 → 2.
- Việc 4 và 5 nhỏ, khởi động nhanh, ít rủi ro.
- Việc 1 vừa chốt nghiệp vụ, nên làm khi còn nhớ ngữ cảnh.
- Việc 3 có ảnh hưởng doanh thu.
- Việc 2 lớn nhất nên để sau cùng. Trong lúc chờ, ẩn nút "Tin nhắn" ngay ở việc 5.

---

## 1. Công ty phái cử chỉ xem tin & ứng viên của NTD cá nhân liên kết

**Trạng thái:** ✅ hoàn thành – nhánh `feat/partner-readonly`, commit `63a5bd3` · review 03/10: cần sửa (xem cuối mục)

### Bối cảnh
- NTD cá nhân (tư vấn viên) đăng tin dưới giấy phép của doanh nghiệp phái cử: `RecruiterPartner`, và `Job.employerId` = công ty phái cử.
- Đợt trước đã **chặn hẳn** công ty xem các tin này, vì trước đó công ty sửa / xoá / đọc SĐT ứng viên được. Xem `EmployerContext.ownerScope`.
- Đã chốt nghiệp vụ: công ty chịu trách nhiệm pháp lý (Luật 69/2020/QH14), nên cần **xem để giám sát**. Tuy vậy tư vấn viên sợ bị "cướp khách", nên phải **che liên hệ** và **không cho sửa**.

### Phạm vi

| Hành động | Công ty phái cử |
|---|---|
| Danh sách tin của NTD cá nhân liên kết: tiêu đề, mã, trạng thái, số hồ sơ, người đăng | ✅ |
| Danh sách + chi tiết hồ sơ ứng viên của các tin đó | ✅ SĐT / email / địa chỉ **bị che** cho tới khi hồ sơ ở trạng thái `passed` hoặc `departed` |
| Sửa / đóng / xoá tin, đổi trạng thái hồ sơ, ghi chú, tạo lịch phỏng vấn | ❌ (404, như hiện tại) |
| Đề nghị tạm ẩn tin mang tên mình | ✅ gửi **báo cáo** cho admin (dùng hệ thống `Report` sẵn có), admin quyết định |
| Ai trong công ty được xem | **Chỉ quản trị viên doanh nghiệp** (`companyAdmin`) – ít quyền nhất có thể |

**Mặc định đề xuất cho 2 điểm chưa chốt:**
- Mốc mở liên hệ là `passed`.
- Đề nghị tạm ẩn đi qua admin.

Muốn đổi mốc thì chỉ cần sửa một hằng số trong shared (xem bên dưới).

### Phương án kỹ thuật (đề xuất)

**Không đụng vào `jobScope` / `applicationScope` / `ownerScope`.** Các scope này dùng cho cả route ghi. Mở rộng chúng là mở lại đúng lỗ hổng cũ. Thay vào đó, làm **route riêng chỉ đọc** với scope riêng:

```ts
// employer-context.service.ts
/** Tin của NTD cá nhân đăng qua doanh nghiệp này, liên kết còn hiệu lực – CHỈ dùng cho route đọc */
partnerJobScope(actor: EmployerActor): Prisma.JobWhereInput {
  return {
    employerId: actor.employerId!,
    deletedAt: null,
    recruiter: {
      employerId: null, // NTD cá nhân, không phải thành viên công ty
      partners: { some: { employerId: actor.employerId!, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } },
    },
  };
}
```

- Liên kết hết hạn hoặc bị gỡ → mất quyền xem ngay, vì điều kiện nằm trong câu truy vấn.
- Shared:
  - `PARTNER_CONTACT_VISIBLE_FROM: ApplicationStatus[] = ['passed', 'departed']` trong `enums.ts`;
  - contract `PartnerJobItem`, `PartnerApplicantItem` (có `contactMasked: boolean`);
  - dùng lại `maskPhone` nếu đã có trong shared, chưa có thì chuyển hàm che SĐT từ `admin-leads.service.ts` về `packages/shared/src/utils.ts`.
- Route mới, controller riêng `employer-partner-view.controller.ts`, `@Roles('employer')`, service kiểm `companyAdmin` (không phải admin công ty → 403):
  - `GET /employer/partner-jobs` (phân trang, lọc theo người đăng);
  - `GET /employer/partner-jobs/:id/applications` (phân trang);
  - `GET /employer/partner-applications/:id`.
- **Ghi nhận lượt xem** (minh bạch cho tư vấn viên, RULE-BE §8):
  - Bảng mới `PartnerView { id, employerId, viewerRecruiterId, applicationId, createdAt }`, index `(applicationId, createdAt)`.
  - Ghi khi mở chi tiết hồ sơ, không ghi khi xem danh sách. Gộp: cùng người, cùng hồ sơ, trong 1 giờ chỉ ghi 1 lần.
  - Chi tiết hồ sơ phía NTD cá nhân (`GET /employer/applications/:id`) thêm trường `partnerViews: Array<{ employerName, viewedAt }>` (5 lượt gần nhất).
- **Đề nghị tạm ẩn:** dùng `POST /reports` sẵn có, thêm lý do `partner_request` vào `REPORT_REASONS` nếu cần. Hoặc làm route `POST /employer/partner-jobs/:id/report` gọi vào service báo cáo. Admin xử lý ở trang Báo cáo như bình thường.

### Giao diện (web, khu NTD doanh nghiệp)
- Menu: "Tin đối tác" (chỉ hiện với `companyAdmin` **và** công ty có ít nhất 1 NTD liên kết). Có thể trả `counts.partnerJobs` trong `/employer/me`.
- Trang `/quan-ly-tuyen-dung/tin-doi-tac`:
  - danh sách tin theo người đăng → bấm vào thì thấy hồ sơ;
  - chỗ bị che hiện `0912 xxx 678` kèm chú thích "Hiện đầy đủ khi ứng viên đậu";
  - **không có** nút sửa / đổi trạng thái.
- Phía NTD cá nhân, chi tiết hồ sơ: dòng nhỏ "Công ty X đã xem hồ sơ này · 2 giờ trước".

### Kiểm thử bắt buộc (thêm vào `employer-isolation.e2e-spec.ts`)
- Quản trị A xem được tin / hồ sơ của rSolo (liên kết với A). **Thành viên thường** A2 bị 403.
- SĐT bị che khi hồ sơ `submitted`, hiện đầy đủ khi `passed`.
- Công ty B (không liên kết) → 404. Liên kết hết hạn (`expiresAt` quá khứ) → 404.
- Các route ghi cũ vẫn 404 với A trên dữ liệu của rSolo. Test hiện có phải vẫn pass nguyên vẹn.
- Mở chi tiết thì tạo `PartnerView`, và rSolo thấy trong `partnerViews`.

### Rủi ro / lưu ý
- Đừng "tiện tay" thêm `partnerJobScope` vào các truy vấn danh sách cũ, như `/employer/applications` hay báo cáo. Giữ tách bạch đọc / ghi.
- Mốc mở liên hệ là quyết định nghiệp vụ. Nên xác nhận lại với luật sư / công ty phái cử đối tác trước khi lên production.

### Kết quả review
**Review 03/10/2026** – nhánh `feat/partner-readonly` (`63a5bd3`). API đúng hướng: route riêng chỉ đọc, chỉ quản trị viên, scope có điều kiện liên kết còn hạn, e2e đủ 401 / 403 / 404.

- [ ] 🟠 **R1.1 Che SĐT quá ít, vẫn dò được.** `maskVnPhone` để lộ 7/10 chữ số (`0912 xxx 678`), tức còn 1.000 khả năng. Kèm họ tên + quê quán đang hiển thị, công ty dò ra số thật qua tìm kiếm Zalo trong vài phút. Đây đúng là kiểu "cướp khách" mà việc này phải chặn. Sửa: trong ngữ cảnh đối tác dùng hàm che mạnh hơn, chỉ để 2 số cuối (`•••• ••• •78`), hoặc ẩn hẳn ("Hiện khi trúng tuyển"). Email cũng nên ẩn hẳn. Giữ `maskVnPhone` cho admin như cũ.
- [ ] 🟡 **R1.2 Lý do `partner_request` lộ ra API báo cáo công khai.** Lý do này nằm trong `REPORT_REASONS`, mà `reportSchema` công khai dùng chung. Ai cũng `POST /reports` với lý do này được, tức giả làm "doanh nghiệp phái cử đề nghị", mức medium trong hàng chờ admin. Sửa: tách lý do nội bộ ra khỏi enum của schema công khai (ví dụ `PUBLIC_REPORT_REASONS`), service đối tác tạo báo cáo trực tiếp.
- [ ] 🟡 **R1.3 Nhãn trạng thái sai** (`PartnerJobsView.tsx`). Bảng `STATUS` tự định nghĩa dùng key `rejected` cho cả tin lẫn hồ sơ, nên hồ sơ bị loại hiện "Bị từ chối". Key `rejected_application` không bao giờ khớp. Dùng `JOB_STATUS_LABEL` / `APPLICATION_STATUS_LABEL` từ shared.
- [ ] 🟡 **R1.4 Không phân trang**, cố định `limit=50`, quá 50 tin / hồ sơ thì bị cắt mất mà không báo. Bấm chuyển tin nhanh thì response cũ có thể đè response mới: thêm `AbortController` hoặc kiểm tra id đang chọn trước khi `set`.
- [ ] 🟡 **R1.5** Dòng Trạng thái ghi "commit đang hoàn thiện". Cập nhật thành `63a5bd3`.

---

## 2. Tin nhắn NTD ↔ ứng viên (MVP)

**Trạng thái:** ✅ hoàn thành – nhánh `feat/conversations`, commit `8b923bd` (typecheck, build, API unit 137/137, E2E Postgres 91/91, oxlint đều qua)

### Bối cảnh
- Menu khu NTD có mục "Tin nhắn" trỏ `#` (link chết). Việc 5 sẽ ẩn tạm.
- Hiện NTD liên lạc ứng viên qua điện thoại / Zalo ngoài hệ thống, nên không có lịch sử và không giám sát được nội dung (thu phí, lừa đảo).

### Phạm vi MVP
- Mỗi **hồ sơ ứng tuyển** (`Application`) có tối đa **1 cuộc hội thoại**, giữa phía NTD (mọi thành viên trong phạm vi `applicationScope`) và ứng viên (`Application.userId`).
- Chỉ áp dụng cho hồ sơ có tài khoản ứng viên (`userId != null`). Hồ sơ NTD nhập tay thì không có tin nhắn.
- **NTD mở cuộc trò chuyện trước**, ứng viên trả lời. Như vậy tránh ứng viên spam hàng loạt NTD.
- Chỉ văn bản. Không đính kèm file (cần kho private + quét file – để sau).
- Admin **không** đọc tin nhắn. Chỉ xem được khi có báo cáo vi phạm gắn với cuộc trò chuyện (làm sau, ghi chú lại).

### Phương án kỹ thuật (đề xuất)

**Schema**
```prisma
model Conversation {
  id              String    @id @default(cuid())
  applicationId   String    @unique
  application     Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  lastMessageAt   DateTime  @default(now())
  /// Mốc đã đọc của từng phía – tính số chưa đọc, không cần bảng riêng
  employerReadAt  DateTime?
  seekerReadAt    DateTime?
  createdAt       DateTime  @default(now())
  messages        Message[]
  @@index([lastMessageAt])
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderUserId   String?
  sender         User?    @relation(fields: [senderUserId], references: [id], onDelete: SetNull)
  /// employer | seeker – tránh suy ra từ user khi user bị xoá
  senderSide     String
  body           String   @db.VarChar(2000)
  createdAt      DateTime @default(now())
  @@index([conversationId, createdAt])
}
```

**API**

Điều kiện sở hữu luôn nằm trong `where`:
- NTD: `application: this.ctx.applicationScope(actor)`.
- Ứng viên: `application: { userId: user.sub }`.

| Route | Ghi chú |
|---|---|
| `GET /employer/conversations?page&q` | Danh sách: tên ứng viên, tin, tin nhắn cuối, số chưa đọc |
| `POST /employer/applications/:id/conversation` | Mở (hoặc lấy) cuộc trò chuyện của hồ sơ |
| `GET /employer/conversations/:id/messages?before=<cursor>&after=<cursor>` | Phân trang theo cursor (`createdAt` + `id`), tối đa 50 |
| `POST /employer/conversations/:id/messages` | Gửi; `@Throttle` 30 / phút |
| `POST /employer/conversations/:id/read` | Cập nhật `employerReadAt` |
| `GET /me/conversations`, `GET /me/conversations/:id/messages`, `POST /me/conversations/:id/messages`, `POST /me/conversations/:id/read` | Phía ứng viên, tương tự; không có route "mở" |

- Gửi tin xong thì cập nhật `lastMessageAt` trong cùng `$transaction`.
- `counts.unreadMessages` trong `/employer/me`. Phía ứng viên thêm vào `/me/dashboard` hoặc route đếm riêng.

**Realtime: làm polling trước**
- Client gọi `GET .../messages?after=<cursor>` mỗi **5 giây khi tab đang mở cuộc trò chuyện**, **30 giây** cho số chưa đọc trên menu. Dừng khi tab ẩn (`document.visibilityState`).
- Tách sẵn một chỗ để sau đổi sang realtime mà không sửa nghiệp vụ:
  ```ts
  // core/realtime/realtime-publisher.ts
  export abstract class RealtimePublisher { abstract publish(channel: string, event: object): Promise<void>; }
  export class NoopRealtimePublisher extends RealtimePublisher { async publish() {} } // local / MVP
  ```
  Service gửi tin gọi `publish('conversation:<id>', ...)`. Khi có hạ tầng thì làm `RedisRealtimePublisher` + SSE (`GET /realtime/stream`) và client ưu tiên SSE, fallback polling. Đúng nguyên tắc RULE-BE §11 (abstract class, đổi provider trong module).

**Thông báo**
- Tin nhắn mới → `notifications.notify(userId, 'message.new', ...)` cho phía bên kia. Thêm nhóm vào `NOTIFICATION_GROUPS` để người dùng tắt được.
- **Gộp:** cùng cuộc trò chuyện chỉ báo 1 lần / 10 phút, nếu người nhận chưa đọc tin trước đó. Tránh mỗi tin một push.
- Phía NTD báo cho người phụ trách hồ sơ (`assigneeId`). Không có người phụ trách thì báo người phụ trách tin (`job.recruiterId`).

**An toàn nội dung (nhẹ, làm luôn)**
- Zod: `body` có `.trim().min(1).max(2000)`.
- Gắn cờ (chưa chặn) tin có số tài khoản ngân hàng / cụm "chuyển khoản", "đặt cọc": lưu `flagged: Boolean` để admin dùng khi xử lý báo cáo. Tận dụng `contentFlags` trong `admin/moderation/risk.ts` nếu phù hợp.

### Giao diện
- **Khu NTD** `/quan-ly-tuyen-dung/tin-nhan`: 2 cột (danh sách | luồng tin). Trên điện thoại chỉ 1 cột, bấm vào thì mở luồng. Trong chi tiết hồ sơ ứng viên có nút "Nhắn tin".
- **Ứng viên** `/tai-khoan-ung-vien/tin-nhan`. Thẻ hồ sơ ở "Việc đã ứng tuyển" có nút "Tin nhắn (n)".
- Hiện lại mục "Tin nhắn" trên menu NTD, kèm số chưa đọc.
- Đọc kỹ docs Next.js trong `apps/web/node_modules/next/dist/docs/` trước khi viết (xem `apps/web/AGENTS.md`).

### Kiểm thử bắt buộc
- Công ty B không mở / đọc / gửi được vào cuộc trò chuyện của hồ sơ công ty A → 404.
- Ứng viên khác không đọc được → 404.
- Ứng viên không mở được cuộc trò chuyện mới (không có route). Gửi vào cuộc chưa tồn tại → 404.
- Hồ sơ nhập tay (không có `userId`) → không mở được (409 hoặc 400 với mã rõ ràng).
- Cursor: `after` chỉ trả tin mới hơn, không trùng, không sót khi 2 tin cùng `createdAt`.
- Số chưa đọc đúng sau khi `read`.

### Kết quả review
**Review 03/10/2026** – nhánh `feat/conversations` (`8b923bd`). Phân quyền đúng: điều kiện sở hữu nằm trong `where`, ứng viên không tự mở được cuộc trò chuyện, hồ sơ nhập tay bị chặn.

- [ ] 🟠 **R2.1 Có thể mất tin khi polling.** Con trỏ `after` dựa trên `createdAt` do server tự gán (`createdAt: now`). Hai tin gửi gần như cùng lúc mà commit lệch thứ tự (tin A gán T1, tin B gán T2 > T1, B commit trước): client lấy B, con trỏ nhảy qua T2, A không bao giờ về qua polling cho tới khi tải lại trang. Sửa: khi poll, lùi con trỏ vài giây (ví dụ `after` − 5s) rồi lọc trùng theo `id` ở client. Hoặc thêm cột `seq` tự tăng, vẫn nên kèm khoảng chồng lấn.
- [ ] 🟠 **R2.2 N+1 query khi đếm tin chưa đọc.** `unreadCount` lấy *mọi* cuộc trò chuyện rồi `message.count` từng cái. `list()` cũng đếm từng dòng. Route này được gọi định kỳ, nên công ty có hàng nghìn cuộc trò chuyện sẽ tốn hàng nghìn query mỗi lần. Sửa: một câu `$queryRaw` (tagged template) join `Message` với mốc đọc, `GROUP BY conversationId`, hoặc một `groupBy`.
- [ ] 🟠 **R2.3 Polling tải lại toàn bộ tài khoản mỗi 30 giây** (`EmployerAccountProvider`, `SeekerAccountProvider`). Spec chỉ yêu cầu poll route đếm tin chưa đọc, nhưng code đang gọi lại cả `/employer/me` (khoảng 12 query + N+1 ở trên) và `/me/profile` + `/me/dashboard`. Thêm hai hệ quả:
  - Một lần lỗi mạng thoáng qua sẽ `setError` và thay **cả khu tài khoản** bằng màn hình lỗi, người dùng đang sửa dở thì mất trang.
  - Dữ liệu tải về có thể đè trạng thái lạc quan khi đang bật / tắt công tắc.

  Sửa: poll riêng `GET .../conversations/unread-count`; lỗi khi poll nền thì bỏ qua, không đặt lỗi toàn trang.
- [ ] 🟡 **R2.4** Danh sách cuộc trò chuyện thiếu `total` (RULE-BE §2 `Paginated<T>`). Nhiều route thiếu `@ApiOperation` (RULE-BE §2 – bắt buộc). Regex gắn cờ `\b\d{10,16}\b` bắt mọi số điện thoại 10 số nên rất nhiễu, nên bỏ khoảng 10–11 số đầu `0` khỏi điều kiện. `ConversationInbox.tsx` bị dồn thành ~21 dòng rất dài, khó review và bảo trì: chạy prettier.
- [ ] 🟡 **R2.5** Ứng viên đã xoá tài khoản (`deletedAt`) hoặc hồ sơ đã rút vẫn nhận tin từ NTD. Nên chặn gửi (409 với mã rõ ràng) khi `application.user.deletedAt` có giá trị.

---

## 3. Gói dịch vụ, thanh toán và lịch sử giao dịch

**Trạng thái:** ✅ hoàn thành – nhánh `feat/service-billing`, commit `fbdf3ed` (thanh toán mock; PayOS thật và bảng giá production còn cần quyết định/tích hợp trước khi thu tiền thật)

### Bối cảnh (hiện trạng trong code)
- `BusinessPlan` (mỗi công ty / NTD cá nhân một bản ghi) có `name`, `jobQuota`, `boostQuota`, `boostsUsed`, `expiresAt`. Hiện **chỉ được tạo bằng seed**.
- `boostQuota` đã được trừ khi đẩy tin / chọn gói hiển thị (`chargeVisibility`, `EmployerJobsService.boost`).
- **Lỗi:** `jobQuota` **không được kiểm ở đâu cả**, chỉ để hiển thị trong `/employer/me`. Gói hết hạn cũng không chặn đăng tin. Việc này sửa trong đợt này.
- Chưa có bảng giao dịch và chưa có cổng thanh toán.

### Phạm vi
1. **Danh mục gói** (mua theo tháng): ví dụ `free`, `ca_nhan_plus`, `pro`, `doanh_nghiep`. Mỗi gói có giá (VND, số nguyên), số tin đang hiển thị tối đa, số lượt đẩy / tháng, thời hạn (30 / 90 / 365 ngày).
2. **Mua / gia hạn gói** từ khu NTD → tạo đơn → chuyển sang trang thanh toán → cổng báo kết quả → kích hoạt gói.
3. **Lịch sử giao dịch** phía NTD; **danh sách giao dịch** phía admin.
4. **Áp hạn mức:** vượt `jobQuota` hoặc gói hết hạn thì không đăng thêm tin hiển thị được, vẫn lưu nháp được.

### Phương án kỹ thuật (đề xuất)

**Danh mục gói: để trong `packages/shared` trước**, ví dụ `PLAN_CATALOG`:
- `key`, `name`, `priceVnd`, `durationDays`, `jobQuota`, `boostQuota`, `audience: 'company' | 'individual' | 'all'`.
- Lý do: giá đổi ít, web / admin / mobile cùng đọc, không cần màn hình admin quản lý ngay. Khi cần đổi giá không phải deploy thì chuyển sang bảng DB (`ServicePackage`) + màn hình admin. Ghi chú lại điều này.

**Schema**
```prisma
enum PaymentStatus { pending paid failed expired refunded }

model PaymentOrder {
  id           String        @id @default(cuid())
  /// Mã hiển thị / nội dung chuyển khoản: VPP-000123
  code         String        @unique
  number       Int           @unique @default(autoincrement())
  employerId   String?
  recruiterId  String?
  createdById  String        // User.id người bấm mua
  planKey      String
  amountVnd    Int
  status       PaymentStatus @default(pending)
  provider     String        // mock | payos | vnpay | momo
  providerRef  String?       @unique
  paidAt       DateTime?
  expiresAt    DateTime      // đơn chờ thanh toán quá 15 phút → expired
  /// Gói trước và sau khi kích hoạt – đối soát / hoàn tiền
  planBefore   Json?
  planAfter    Json?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  @@index([employerId, createdAt])
  @@index([recruiterId, createdAt])
  @@index([status, createdAt])
}
```
- Số tiền là số nguyên VND (RULE-BE §2). **Giá lấy từ `PLAN_CATALOG` trên server**, không bao giờ nhận `amount` từ client.

**Cổng thanh toán (RULE-BE §11): abstract class**
```ts
export abstract class PaymentProvider {
  abstract readonly key: string;
  /** Trả URL để chuyển người dùng sang trang thanh toán */
  abstract createCheckout(order: { code: string; amountVnd: number; description: string; returnUrl: string }): Promise<{ checkoutUrl: string; providerRef: string }>;
  /** Kiểm chữ ký webhook, trả kết quả chuẩn hoá – sai chữ ký phải throw */
  abstract parseWebhook(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): { providerRef: string; status: 'paid' | 'failed'; amountVnd: number };
}
```
- **Local: `MockPaymentProvider`.**
  - `createCheckout` trả URL tới trang web `/thanh-toan/mo-phong?ref=...`. Trang này chỉ bật khi `NODE_ENV !== 'production'`, có 2 nút "Thanh toán thành công" / "Thất bại".
  - Nút gọi `POST /payments/webhook/mock`, ký HMAC bằng `PAYMENT_MOCK_SECRET`.
  - `env.ts` **từ chối** `PAYMENT_PROVIDER=mock` ở production (RULE-BE §13), giống cách làm với `OTP_PROVIDER=console`.
- **Sau này:** `PayOSPaymentProvider` (khuyến nghị cho thị trường VN: VietQR, phí thấp, webhook đơn giản) hoặc VNPay / MoMo. Chỉ thêm class và đổi provider trong module.

**Luồng**
1. `POST /employer/billing/orders { planKey }`
   - Kiểm gói hợp lệ với loại tài khoản; chỉ `companyAdmin` hoặc NTD cá nhân được mua.
   - Tạo `PaymentOrder` (pending, `expiresAt` = +15 phút), gọi `createCheckout`, trả `checkoutUrl`.
2. Cổng gọi `POST /payments/webhook/:provider` (`@Public`, **kiểm chữ ký trước khi làm gì**, RULE-BE §11).
3. **Kích hoạt idempotent** trong `$transaction`:
   - `updateMany where { providerRef, status: 'pending' }` → `paid`. `count = 0` thì đã xử lý rồi, trả 200 ngay. Webhook gửi lại nhiều lần không được cộng gói 2 lần.
   - Kiểm `amountVnd` khớp đơn, lệch thì đánh dấu `failed` và log cảnh báo.
   - Upsert `BusinessPlan`: `expiresAt = max(now, expiresAt hiện tại) + durationDays`, đặt `jobQuota` / `boostQuota` theo gói, reset `boostsUsed` khi đổi chu kỳ. Lưu `planBefore` / `planAfter`.
   - `notify` người mua: "Đã kích hoạt Gói Pro đến 03/11/2026".
4. `returnUrl` về `/quan-ly-tuyen-dung/goi-dich-vu?order=<code>`. Trang gọi `GET /employer/billing/orders/:code` để hiện kết quả. **Không tin query string** từ cổng.
5. Worker (setInterval như `TrashPurgeWorker`): đơn pending quá hạn → `expired`.

**Áp hạn mức (sửa lỗi `jobQuota`)**
- Hàm thuần `canPublish(plan, openJobsCount, now)`, có unit test.
- Gọi ở: tạo tin có `publish`, mở lại tin (`resume`), duyệt tin (admin approve). Riêng chỗ admin approve: nếu vượt hạn mức thì vẫn cho duyệt nhưng ghi chú – hoặc chặn; **cần chốt**, đề xuất **cho duyệt** để không phạt NTD vì admin duyệt chậm.
- Không có gói / gói hết hạn → áp hạn mức gói `free` (ví dụ 3 tin hiển thị, 0 lượt đẩy).
- Mã lỗi mới trong `ERROR_CODES`: `PLAN_LIMIT` (vượt số tin) và `PLAN_EXPIRED`. Giao diện hiện nút "Nâng cấp gói".

**Admin**
- Quyền mới `billing.read` (xem giao dịch). Cập nhật `ADMIN_PERMISSIONS`, bảng quyền trong `RULE-BE.md` §6, vai trò `super_admin` / `support`.
- `GET /admin/billing/orders` (lọc trạng thái, mã, NTD), xuất CSV qua cơ chế export sẵn có (thêm dataset `orders`, cần `data.export`).
- Hoàn tiền: **chưa làm**. Chỉ ghi chú, vì cần quy trình với cổng thật.

### Giao diện
- `/quan-ly-tuyen-dung/goi-dich-vu`: gói hiện tại (hạn, số tin đang dùng / tối đa, lượt đẩy còn lại), bảng gói để mua / gia hạn, lịch sử giao dịch (phân trang).
- Đổi chữ "Gói miễn phí" ở `EmployerShell` cho đúng gói thực.
- Form đăng tin: khi vượt hạn mức thì báo trước khi bấm đăng, đừng đợi API trả lỗi.
- Admin: trang "Giao dịch" trong menu, ẩn nếu không có `billing.read`.

### Kiểm thử bắt buộc
- Unit: `canPublish`, tính `expiresAt` khi gia hạn (gói còn hạn / đã hết hạn), số tiền theo `PLAN_CATALOG`.
- E2E Postgres:
  - webhook sai chữ ký → 401 / 400 và không đổi gì;
  - webhook gửi 2 lần → gói chỉ cộng 1 lần;
  - số tiền lệch → `failed`;
  - công ty B không xem được đơn của A → 404;
  - thành viên thường không mua được → 403;
  - vượt `jobQuota` → `PLAN_LIMIT`, nhưng lưu nháp vẫn được.
- Thêm bảng đối chiếu quyền `billing.read` trong `admin-permissions.e2e-spec.ts`.

### Cần chốt trước khi lên production
- Bảng giá, hạn mức từng gói, có xuất hoá đơn VAT hay không.
- Chọn cổng thật (đề xuất PayOS).

### Kết quả review
**Review 03/10/2026** – nhánh `feat/service-billing` (`fbdf3ed`). Kiểm webhook bằng HMAC + `timingSafeEqual`, kích hoạt idempotent bằng `updateMany status: pending`, giá lấy từ catalog phía server: các phần này đúng.

- [ ] 🔴 **R3.1 Ai cũng đánh dấu được đơn của người khác là đã trả tiền.** `POST /payments/mock/settle` là `@Public`, không kiểm người gọi có sở hữu đơn không. Mã đơn nằm ngay trên URL trang thanh toán và trong lịch sử. Đã thử: gọi không token vẫn vào tới logic xử lý (trả 404 "không tìm thấy đơn", không phải 401). Trên dev / staging công khai, kẻ xấu kích hoạt gói miễn phí, hoặc đánh "thất bại" đơn của người khác. Code còn đọc `process.env.NODE_ENV` trực tiếp, trái RULE-BE §13. Sửa: bắt đăng nhập + đơn thuộc phạm vi người gọi (giống `detail`), hoặc ký HMAC một token vào URL thanh toán giả lập; đọc môi trường qua `ENV`.
- [ ] 🔴 **R3.2 API không khởi động được ở production.** `env.ts` từ chối `PAYMENT_PROVIDER=mock` ở production, còn `PaymentsModule` *throw* khi provider ≠ `mock`. Hai điều kiện cộng lại thì production không có cấu hình nào chạy được, tức merge nhánh này là chặn mọi lần deploy. Sửa: thêm `DisabledPaymentProvider` (tạo đơn trả 503 mã rõ ràng "Thanh toán chưa mở", webhook 404) để app vẫn chạy khi chưa tích hợp PayOS.
- [ ] 🟠 **R3.3 Tiền đã trừ nhưng gói không kích hoạt** khi webhook tới sau 15 phút. Người dùng trả ở phút 14, cổng báo ở phút 16, hoặc worker đã chuyển đơn sang `expired`: webhook gặp đơn `expired` thì chỉ trả `ok`, gói không kích hoạt và không ai được cảnh báo. Với cổng thật, chuyện này chắc chắn xảy ra. Sửa: webhook `paid` cho đơn `expired` vẫn kích hoạt (cho phép `expired → paid`), hoặc chuyển sang trạng thái riêng + báo admin để hoàn tiền; và đặt hạn link thanh toán của cổng bằng hạn đơn.
- [ ] 🟠 **R3.4 Mua gói khác khi gói cũ còn hạn cho kết quả sai.** Code lấy mốc *hết hạn của gói cũ* để cộng thời gian, nhưng *đổi hạn mức ngay* sang gói mới và reset `boostsUsed`. Ví dụ đang dùng "Doanh nghiệp" (100 tin, còn 300 ngày) mà mua "Pro": hạn mức tụt ngay xuống 30 tin, còn hạn lại kéo thêm 90 ngày sau 300 ngày. **Cần chốt nghiệp vụ.** Đề xuất: cùng gói thì cộng thêm hạn; gói cao hơn thì nâng cấp ngay, tính từ bây giờ; gói thấp hơn thì chặn khi gói hiện tại còn hạn, hoặc xếp hàng chờ áp dụng khi gói cũ hết.
- [ ] 🟠 **R3.5 Xuất CSV giao dịch đi vòng qua cơ chế export chuẩn.** RULE-BE §7 yêu cầu ghi audit, link dùng một lần / 15 phút, giới hạn 10.000 dòng. `GET /admin/billing/orders/export` tải thẳng, không audit, không chặn chèn công thức Excel. Sửa: thêm dataset `orders` vào export của `AdminToolsService` (đã có `csvCell` chặn công thức).
- [ ] 🟠 **R3.6 Vi phạm RULE-BE:**
  - trả nguyên bản ghi Prisma ra API (`list`, `detail`, `adminList` lộ `createdById`, `planBefore`…), §8;
  - danh sách không phân trang (`take: 100/200`), không trả `Paginated`, §2;
  - schema zod viết ngay trong controller, `planKey` là `z.string` thay vì enum trong shared, §3;
  - dùng `ForbiddenException` thay `ApiException`, §4;
  - thiếu `@ApiOperation` và kiểu response trong `contracts.ts`, §2.
- [ ] 🟡 **R3.7** Số tiền webhook lệch với đơn: chỉ đánh `failed` mà không log / cảnh báo. Đây là dấu hiệu gian lận hoặc lỗi tích hợp, nên `logger.warn` và ghi audit.
- [ ] 🟡 **R3.8** Đếm tin rồi mới tạo trong cùng transaction ở mức READ COMMITTED, nên hai lần đăng đồng thời có thể vượt hạn mức 1 tin. Chấp nhận được, hoặc dùng `pg_advisory_xact_lock` theo chủ gói. `assertPublishQuota` bị lặp lại trong `resume()`: tách thành một hàm dùng chung. `renewalExpiry` có test nhưng service không dùng, mà viết lại logic inline, nên test không phủ code thật.
- [ ] 🟡 **R3.9 Giao diện:**
  - trang gói hiện cả gói không dành cho loại tài khoản (công ty thấy "Cá nhân Plus"), thành viên thường thấy nút mua rồi bị 403;
  - trạng thái hiện thô `pending` / `paid`;
  - chưa xử lý `?order=` khi quay về từ trang thanh toán (spec mục 4);
  - code `page.tsx` / `plans.css` / `TransactionsView.tsx` bị dồn 1 dòng, màu viết cứng (`#172b4d`) thay vì token của RULE.md, trang giả lập dùng inline style;
  - `JobPostForm` viết cứng `3` (dùng `PLAN_CATALOG.free.jobQuota`) và nhận diện lỗi bằng `formError.includes('giới hạn tin')`, phải dựa vào `code` `PLAN_LIMIT` / `PLAN_EXPIRED`.
- [ ] 🟡 **R3.10** `PaymentExpiryWorker` vẫn chạy trong môi trường test và không dọn timer khi module huỷ (xem `TrashPurgeWorker` làm mẫu).

---

## 4. Trang bảo trì riêng cho web

**Trạng thái:** ✅ hoàn thành – nhánh `feat/maintenance-page`, commit `4d457dc`

### Bối cảnh
- Admin bật bảo trì ở Cài đặt hệ thống, khi đó API trả **503 `MAINTENANCE`** cho mọi route người dùng (`core/http/maintenance.guard.ts`).
- Web hiện chỉ hiện một dải thông báo (`components/layout/MaintenanceNotice.tsx`). Các trang gọi API vẫn hiện lỗi chung, trông như web bị hỏng.

### Phương án (đề xuất)
- **Server:** trong `apps/web/app/layout.tsx`, gọi `getSiteSystem()` (đã có trong `lib/server-api.ts`, cache ngắn ~30 giây) – route này không bị chặn khi bảo trì. Nếu `maintenanceMode` thì render component `MaintenanceScreen` thay cho `children`: logo, thông điệp admin nhập, hotline / email hỗ trợ (`supportPhone`, `supportEmail`), nút "Thử lại".
  - Trả HTTP 503 cho trang nếu Next.js phiên bản này hỗ trợ. **Đọc docs trong `apps/web/node_modules/next/dist/docs/` trước**, phiên bản Next này khác bản quen thuộc (xem `apps/web/AGENTS.md`).
  - Không chặn tài nguyên tĩnh (ảnh, favicon).
- **Client:** trong `lib/api.ts`, khi nhận lỗi có `code === 'MAINTENANCE'` (bảo trì bật khi người dùng đang ở trong trang), phát sự kiện để layout client chuyển sang màn hình bảo trì, thay vì hiện lỗi chung trong form.
- **Admin** (`apps/admin`): không bị ảnh hưởng. API admin vẫn chạy khi bảo trì – giữ nguyên.
- Thêm `'MAINTENANCE'` vào chỗ map mã lỗi → thông báo tiếng Việt ở web, nếu có bảng map.

### Kiểm thử
- Bật bảo trì trong admin → trang chủ, tìm kiếm, khu NTD, khu ứng viên đều hiện màn hình bảo trì. Tắt đi thì trong ≤ 30 giây trở lại bình thường.
- Unit test hàm nhận diện lỗi `MAINTENANCE` ở client (nếu tách thành hàm thuần).

### Kết quả review
**Review 03/10/2026** – nhánh `feat/maintenance-page` (`4d457dc`).

- [ ] 🔴 **R4.1 Bật bảo trì thì cả web trả HTTP 500.** Đã chạy thật: trang chủ 500 với lỗi `Event handlers cannot be passed to Client Component props`. `MaintenanceScreen` có `onClick` (nút "Thử lại") nhưng thiếu `'use client'`, mà lại được render trực tiếp từ server `RootLayout`. Tính năng hỏng đúng lúc cần dùng. Sửa: thêm `'use client'` cho `MaintenanceScreen`, hoặc tách nút "Thử lại" thành component client riêng. Kiểm tra lại bằng cách bật bảo trì trong admin rồi mở vài trang.
- [ ] 🟠 **R4.2 Mỗi lượt tải trang tốn thêm 1 lần gọi API.** `getSiteSystem()` dùng `cache: 'no-store'` và được gọi ở root layout, tức mọi trang. Spec yêu cầu cache khoảng 30 giây. Sửa: cho riêng lời gọi này dùng revalidate 30 giây (đọc docs Next 16 trong `node_modules/next/dist/docs/` để chọn đúng API).
- [ ] 🟡 **R4.3** `MaintenanceGate` gọi `/site/system` mỗi 30 giây cho *mọi* khách, kể cả khi tab đang ẩn: nên bỏ qua khi `document.visibilityState !== 'visible'`. Số hotline / email dự phòng viết cứng trùng với `DEFAULT_SYSTEM_SETTINGS`. `apiMessage` trả câu cố định, bỏ mất thông điệp admin nhập: dùng `error.message`.
- [ ] 🟡 **R4.4** Trang bảo trì trả HTTP 200, nên công cụ tìm kiếm có thể index trang bảo trì. Nếu Next 16 hỗ trợ đặt status cho layout thì trả 503, không thì chấp nhận được.

---

## 5. Gom việc nhỏ

**Trạng thái:** ✅ hoàn thành – nhánh `feat/small-employer-tools`, commit `b68ad76`

### 5.1 Form "Nhờ tư vấn" ở trang chi tiết tin
- API `POST /leads/consultations` đã nhận `jobId`, và lead theo tin đã về đúng chủ tin + báo cho người phụ trách tin (đợt trước).
- Trang `apps/web/app/viec-lam/[slug]/page.tsx` chưa có form. Thêm `ConsultForm` (đã có ở `components/profile/ConsultForm.tsx`) với `jobId={job.id}`, đặt gần khối "Cán bộ gọi lại tư vấn trong 30 phút".
- Kiểm tra: gửi form → NTD thấy ở `/quan-ly-tuyen-dung/khach-tu-van` với nguồn "Tin <tiêu đề>".

### 5.2 Lead gửi tới trang công ty chưa báo cho ai
- `LeadsService.consult`: lead chỉ có `employerSlug` (form trên trang công ty) thì hiện **không gửi thông báo** – chỉ báo khi có `recruiterSlug` hoặc `jobId`.
- Sửa: báo cho **tất cả quản trị viên doanh nghiệp** (`Recruiter.companyAdmin = true`, `leftAt = null`, có `userId`) của công ty đó, type `lead.new`.
- Lỗi gửi thông báo không được làm hỏng việc lưu lead (RULE-BE §11).
- Unit / e2e: lead trang công ty → quản trị viên có `Notification`, thành viên thường thì không.

### 5.3 Ẩn mục "Tin nhắn" (link chết) cho tới khi làm việc 2
- `components/employer/EmployerShell.tsx`: bỏ mục `{ href: '#', label: 'Tin nhắn' }`. Khi làm việc 2 thì thêm lại với link thật.

### 5.4 (Tuỳ chọn) Dọn dẹp
- `work-todo.md` đã được thay bằng sổ này. Chuyển các ý còn giá trị sang đây rồi xoá file cũ.
- `.idea/` thêm vào `.gitignore`.

### Kết quả review
**Review 03/10/2026** – nhánh `feat/small-employer-tools` (`b68ad76`). Cả 3 ý đều làm đúng: form tư vấn ở trang tin, báo lead cho quản trị viên công ty (lỗi gửi thông báo không làm hỏng việc lưu lead), ẩn link chết. Có unit test + e2e. `settingsUpdateSchema` dùng `partialRecord` nên thêm nhóm `lead` không làm hỏng app cũ.

- [ ] 🟡 **R5.1** Khách gửi qua trang công ty + `recruiterSlug` mà tư vấn viên đó chưa có tài khoản (`userId = null`) thì không ai được báo, vì nhánh quản trị viên chỉ chạy khi *không* có `recruiterSlug`. Nên chuyển sang báo quản trị viên công ty của tư vấn viên đó.
- [ ] 🟡 **R5.2** Thêm nhóm thông báo `lead` (và `billing`, `message` ở việc 2 / 3), nhưng NTD chưa có trang cài đặt thông báo nên không tắt được. Ghi vào đợt sau.

---

## Việc chờ quyết định của đợt 1 (chưa làm, ghi lại để không quên)
- **App mobile đã phát hành chưa?** Nếu rồi: `POST /applications` bắt buộc `email` + `emailCode` là thay đổi phá vỡ, cần route v2 và giữ v1 ít nhất 6 tháng (RULE-BE §2, §16 #13).
- Trang **Điều khoản / Chính sách:** cần nội dung pháp lý thật.
- **Giấy tờ tuỳ thân** (RULE-BE §16 #12): chỉ làm kho private mã hoá khi sản phẩm thật sự cần lưu CCCD / hộ chiếu. Hiện chủ trương là không thu thập.

---

<!-- Đợt tiếp theo thêm bên dưới: "# Đợt 2 – giao ngày dd/mm/yyyy", việc đánh số tiếp từ 6 -->
