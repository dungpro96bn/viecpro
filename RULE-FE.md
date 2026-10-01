# RULE – Quy tắc build & code dự án viecpro

Tài liệu này gom các quy tắc **bắt buộc** khi thêm trang / sửa code. Đọc kèm `README.md` (cấu trúc thư mục, danh sách trang) và `AGENTS.md`.

---

## 0. Cấu trúc monorepo

```
viecpro/
├─ apps/
│  ├─ web/          Next.js – giao diện web (mục 2 → 10 bên dưới)
│  └─ api/          NestJS – API cho web + app mobile (RULE-BE.md)
├─ packages/
│  └─ shared/       @viecpro/shared – enum, nhãn, schema zod, kiểu request/response dùng chung
├─ docker-compose.yml   PostgreSQL local (cổng 5433)
├─ RULE.md · RULE-BE.md · README.md
└─ package.json     npm workspaces + lệnh chạy chung
```

- Quản lý gói bằng **npm workspaces**. Cài thư viện cho đúng app: `npm i <pkg> -w @viecpro/api` (không cài ở gốc trừ công cụ dùng chung).
- Thứ gì **cả web, API và mobile** cùng cần (enum, nhãn hiển thị, quy tắc validate, kiểu dữ liệu API) → đặt trong `packages/shared`, **không** định nghĩa lại ở từng app.
- Sửa `packages/shared` xong phải build lại (`npm run dev` đã tự watch).

---

## 1. Công nghệ & lệnh

| Mục | Web (`apps/web`) | API (`apps/api`) |
| --- | --- | --- |
| Framework | **Next.js 16** (App Router) + **React 19** | **NestJS 12** (ESM) + Express |
| Database | – | **PostgreSQL 17** + **Prisma 7** (adapter `pg`) |
| Validate | zod (từ shared) | zod (từ shared) |
| Ngôn ngữ | TypeScript `strict`, không `any` | TypeScript `strict`, không `any` |
| Style / test | CSS thuần, không Tailwind | Vitest + oxlint |
| Alias | `@/*` → `apps/web/` | import tương đối, **có đuôi `.js`** (ESM) |

```bash
npm install          # cài tất cả + build shared + sinh Prisma client
npm run db:up        # bật PostgreSQL (Docker)
npm run db:migrate   # áp migration
npm run db:seed      # dữ liệu demo
npm run dev          # shared (watch) + API :4000 + web :3000
npm run typecheck    # kiểm tra kiểu mọi workspace
npm run test         # unit test API
npm run build        # BẮT BUỘC pass trước khi báo xong việc
```

> ⚠️ Next.js 16, NestJS 12, Prisma 7 đều khác bản cũ. Trước khi dùng API lạ, đọc tài liệu trong `node_modules/` của gói đó.
> Ví dụ: `params` của trang Next là **Promise** → `const { slug } = await params`; Prisma 7 cấu hình DB trong `prisma.config.ts`, không còn `url` trong schema.

---

## 2. Cấu trúc & đặt file (web)

> Mục 2 → 10 áp dụng cho `apps/web`; đường dẫn `app/`, `components/`, `lib/` tính từ `apps/web/`.


- **Mỗi trang** = 1 thư mục trong `app/` (tên route tiếng Việt không dấu, gạch ngang: `tim-kiem`, `dang-nhap`, `viec-lam/[slug]`), gồm:
  - `page.tsx` – **Server Component**, khai báo `export const metadata` (hoặc `generateMetadata`).
  - `<ten-trang>.css` – style riêng của trang, đặt **cạnh** `page.tsx` và import trong `page.tsx`.
  - Phần cần tương tác tách ra file client riêng cùng thư mục (`LoginForm.tsx`, `SearchView.tsx`…).
- **Thành phần dùng chung** đặt trong `components/<nhóm>/` kèm file CSS của nhóm:
  - `layout/` (Header, Footer, Logo…) – `layout.css`
  - `ui/` (Icons, Select, Avatar, Stars…) – `ui.css`, `select.css`
  - `jobs/`, `profile/`, `apply/`, `auth/` – mỗi nhóm 1–2 file CSS riêng
- Component con chỉ dùng cho 1 trang (nhiều nơi trong trang) → `app/_components/` hoặc ngay trong thư mục trang.
- **Dữ liệu** để trong `lib/` (`data.ts`, `profiles.ts`, `job-detail.ts`), kiểu trong `lib/types.ts`, hàm tiện ích trong `lib/format.ts`. Không hard-code dữ liệu lặp lại trong JSX – khai báo mảng hằng (`const PERKS = [...]`) rồi `.map()`.
- Trang có `[slug]` → dùng `generateStaticParams()` để build tĩnh.
- Ảnh tĩnh: `public/images/<nhóm>/` (jobs, avatars, banners, ads, logos, auth). **Không** nhúng base64 vào code.

---

## 3. Server / Client Component

- Mặc định là **Server Component**. Chỉ thêm `'use client'` khi thật sự cần state, effect, sự kiện, `useRouter`…
- Đẩy `'use client'` xuống **nhỏ nhất có thể**: `page.tsx` (server) render phần tĩnh, chỉ form / nút tương tác là client.
- Truyền nội dung tĩnh từ server xuống client qua `children` / props `ReactNode` (vd. `AuthShell side={...}`).
- Popup ứng tuyển dùng chung qua `ApplyProvider` (đã bọc ở `app/layout.tsx`) – mở bằng `ApplyButton`, không tự tạo modal mới.

---

## 4. Quy tắc CSS (quan trọng nhất)

### 4.1 Không inline style
- **Cấm** `style={{ ... }}` cho việc trang trí. Mọi style viết trong file `.css` bằng class.
- Ngoại lệ duy nhất: giá trị **tính lúc chạy** không thể biết trước (độ rộng thanh % theo dữ liệu, toạ độ menu portal của `Select`).

### 4.2 Đặt tên class theo BEM
```
block__element--modifier
job-card__title     pill-tab--active     auth-input--invalid
```
- Block đặt tên theo chức năng, có tiền tố theo trang/nhóm để tránh đụng: `reg-*` (đăng ký), `login-*`, `auth-*`, `apply-*`, `job-card*`.
- Ghép class bằng helper `cx()` từ `@/lib/format`:
  ```tsx
  className={cx('role-card', active && 'role-card--active')}
  ```

### 4.3 Trạng thái động = class modifier
- Tab đang chọn, nút đã lưu, ô lỗi, bước hiện tại… → thêm class `--active`, `--on`, `--invalid`, `--done`…
- Đồng thời gắn thuộc tính ARIA tương ứng (`aria-checked`, `aria-pressed`, `aria-selected`, `aria-current`, `aria-invalid`).

### 4.4 Design token
- Màu, bo góc, đổ bóng, easing lấy từ biến `:root` trong `app/globals.css`:
  - Màu chính: `--primary`, `--primary-dark`, `--primary-soft`, `--accent-soft`, `--btn-primary`, `--btn-primary-hover`
  - Chữ: `--text`, `--text-body`, `--text-3`, `--text-disabled`
  - Nền / viền: `--bg`, `--bg-alt`, `--surface`, `--border`, `--border-soft`
  - Trạng thái: `--danger`, `--warning`, `--success`, `--success-soft*`
  - Bo góc: `--radius-sm` (8) · `--radius` (14) · `--radius-lg` (20) · `--radius-xl` (28) · `--radius-full`
  - Khác: `--shadow*`, `--gradient*`, `--ease`, `--container` (1248px), `--header-h`
- Màu mới dùng nhiều nơi → **thêm token vào `:root`**, không rải mã hex khắp nơi. Màu rgba trang trí 1 lần (overlay, viền trắng mờ) được phép viết trực tiếp.
- Ô focus thống nhất: `border-color: var(--btn-primary); box-shadow: 0 0 0 4px rgba(56, 121, 255, 0.14);`

### 4.5 Tái sử dụng class có sẵn trước khi viết mới
Trong `globals.css` đã có: `.container`, `.page`, `.page-main`, `.btn` (+ `--primary`, `--outline`, `--soft`, `--white`, `--sm/md/lg`, `--pill`, `--block`, `--shadow`), `.icon-btn`, `.chip--*`, `.badge--*`, `.pill--*`, `.pill-tabs`, `.field-input`, `.breadcrumb`, `.content-card`, `.sticky-tabs`, `.note-warning`, `.visually-hidden`.

### 4.6 Đầu file CSS
Mở đầu bằng khối chú thích mô tả, chia mục bằng `/* ---------- Tên mục ---------- */`. Chú thích viết **tiếng Việt**.

---

## 5. Responsive

- Thiết kế gốc là **desktop** (khung 1240–1440px). Trang muốn co giãn phải có class **`page page--fluid`** ở thẻ ngoài cùng (bỏ `min-width: 1240px` của body).
- Breakpoint chuẩn (dùng `max-width`):
  - **≤ 1024px** – tablet
  - **≤ 767px** – mobile (container padding 16px)
  - Phụ khi cần: 1200, 900, 480, 340
- Media query viết **ở cuối file CSS** của chính trang/nhóm đó.
- Mobile: ô nhập tự lên `font-size: 16px` (đã xử lý global, tránh iOS zoom); không để trang tràn ngang (`scrollWidth` = độ rộng viewport).
- Tôn trọng `prefers-reduced-motion` với animation lớn.

---

## 6. Icon

- Mọi icon SVG nằm trong `components/ui/Icons.tsx`, export dạng `IconTenIcon` dựng từ `StrokeIcon` (nét, 24×24) hoặc `SolidIcon` (đặc).
- Cần icon mới → **thêm vào `Icons.tsx`**, không viết `<svg>` rời trong trang (ngoại lệ: logo nhiều màu như Google).
- Dùng: `<IconCheck size={13} className="icon--w3" />` – độ dày nét bằng class `icon--w16 … icon--w4`, màu theo `currentColor`.

---

## 7. Form

- `<form noValidate onSubmit={...}>` + tự validate, hiện lỗi dưới từng ô (`.auth-field__error` / tương đương), ô lỗi thêm modifier `--invalid` và `aria-invalid`, nối lỗi bằng `aria-describedby`.
- Lỗi của ô **tự mất khi người dùng sửa** ô đó.
- Dropdown dùng component `Select` (`@/components/ui/Select`), **không** dùng `<select>` gốc; truyền `className` để giữ kiểu ô.
- Nhãn bắt buộc: `<span className="...__req">*</span>`.
- Nhóm lựa chọn 1-trong-n: `role="radiogroup"` + nút `role="radio" aria-checked`. Chọn nhiều: nút `aria-pressed`.
- Chưa có API: giả lập hành vi và **ghi chú rõ** chỗ cần nối API (`// Chưa có API: ...`).

---

## 8. Ảnh, link, font

- Ảnh dùng thẻ `<img>` thường (không phát sinh inline style). `alt=""` cho ảnh trang trí.
- Link nội bộ dùng `next/link`. Link chưa có trang đích để `href="#"`.
- Font Inter tự host (`public/fonts/InterVariable.woff2`, nạp bằng `next/font/local` → biến `--font-inter`). Không thêm Google Fonts.

---

## 9. Nội dung & ngôn ngữ

- Toàn bộ chữ trên giao diện và chú thích code: **tiếng Việt có dấu**.
- Tên biến / hàm / class: tiếng Anh (class route-specific có thể viết tắt tiếng Việt không dấu: `reg-`, `chip--luong-cao`).
- Tên thương hiệu: viết `viecpro` trong câu văn; logo hiển thị `ViecPro`.
- Các chỗ giữ chỗ `[SỐ GIẤY PHÉP]`, `[MÃ SỐ THUẾ]`… phải thay bằng thông tin thật trước khi phát hành.

---

## 10. Chuyển thiết kế HTML → Next.js

Khi nhận file thiết kế `.html` (style inline, ảnh base64):

1. Bóc ảnh base64 ra `public/images/<nhóm>/`.
2. Chuyển từng `style="..."` thành class BEM trong file `.css`; giá trị màu/bo góc trùng token → dùng `var(--token)`.
3. Các class tiện ích trong `<style>` của file HTML (`.fld`, `.btnp`, `.sbtn`…) → gộp vào class BEM tương ứng (`.auth-input`, `.auth-submit`…), bỏ `!important`.
4. SVG lặp lại → icon trong `Icons.tsx`; khối lặp lại → mảng dữ liệu + `.map()`.
5. Phần dùng chung giữa nhiều trang → tách component trong `components/`.
6. Link `*.dc.html` → route thật (`/`, `/dang-nhap`, `/dang-ky`…).
7. Bổ sung responsive (`page--fluid`) và trạng thái tương tác mà file tĩnh không có.

---

## 11. Checklist trước khi hoàn tất

- [ ] Không có `style={{}}` mới (trừ giá trị tính lúc chạy)
- [ ] Class đúng BEM, dùng token `:root`, CSS đặt đúng chỗ
- [ ] `'use client'` chỉ ở component cần tương tác
- [ ] Icon mới nằm trong `Icons.tsx`
- [ ] Có `metadata` cho trang mới, cập nhật bảng trang + cây thư mục trong `README.md`
- [ ] Kiểm tra giao diện desktop (1440) và mobile (390), không tràn ngang
- [ ] `npm run typecheck` và `npm run build` pass

---

## 12. Backend

Toàn bộ quy tắc backend, **bảo mật và phân quyền** (API, admin, mobile) nằm trong **[RULE-BE.md](RULE-BE.md)**.
