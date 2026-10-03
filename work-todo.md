Đã xong

1. ✅ Nút "Nhờ tư vấn" ở trang tìm kiếm mở form (ConsultationDialog → POST /leads/consultations).
2. ✅ Admin quản lý khách cần tư vấn (leads.read / leads.manage), che SĐT khi thiếu users.pii, có audit.
3. ✅ Bỏ thu thập CCCD (RULE-BE §16 #14): bỏ cccdVerifiedAt, điểm tin cậy không còn dựa trên CCCD, bỏ mục giấy tờ "cccd".
4. ✅ Accessibility component Field dùng chung: nhãn gắn với input / textarea / Select qua aria-labelledby, lỗi qua aria-describedby (không đè nhãn riêng của checkbox / radio).
- ✅ Admin: sửa tin thay NTD (`jobs.manage`), xuất CSV tối đa 10.000 dòng bằng link dùng một lần/15 phút, Cài đặt hệ thống (chế độ bảo trì), banner và quảng cáo trang chủ.
- ✅ NTD: Báo cáo thống kê (7/30/90 ngày), Đánh giá người lao động đã xuất cảnh và NTD phản hồi.
- ✅ Thùng rác: tự xoá vĩnh viễn sau 30 ngày (TrashPurgeWorker quét mỗi giờ, khoá có điều kiện nên chạy nhiều instance an toàn); giao diện hiện số ngày còn lại.
- ✅ Thùng rác có "Tin tuyển dụng đã xoá": NTD xoá tin nháp / bị từ chối / đã đóng (tin đang hiển thị phải đóng trước), khôi phục giữ nguyên trạng thái, xoá vĩnh viễn gõ lại mã tin, tự xoá sau 30 ngày. Hồ sơ ứng tuyển vẫn giữ; ứng viên thấy "Tin đã bị gỡ". Admin không xoá tin (dùng Kiểm duyệt). NTD cá nhân cũng có Thùng rác (chỉ tin của mình).
- ✅ Web có favicon.ico.
- ✅ Khu NTD có trang "Khách cần tư vấn" (trước đây thông báo trỏ tới trang 404); khách nhờ thành viên / theo tin về đúng doanh nghiệp.
- ✅ E2E cách ly dữ liệu giữa các NTD trên Postgres thật: `npm run test:e2e:db -w @viecpro/api`.

Sửa lỗi khi rà soát (03/10/2026)

- Chế độ bảo trì: guard so đường dẫn thiếu tiền tố `/api/v1` nên `/site/system` cũng bị 503 → web không hiện được thông báo bảo trì. Đã sửa, lỗi trả mã `MAINTENANCE`, có unit test.
- Tải CSV: đọc 10.000 dòng trong transaction tương tác có thể vượt timeout 5 giây. Giờ đánh dấu link đã dùng bằng một câu lệnh nguyên tử rồi mới đọc dữ liệu.
- NTD phản hồi đánh giá: điều kiện chủ sở hữu nằm ngay trong câu cập nhật (RULE-BE §6 lớp 2).
- Xoá vĩnh viễn thành viên: ẩn danh có điều kiện (`purgedAt: null`), bấm hai lần / chạy cùng worker không xoá trùng.
- Container Docker chạy bản build cũ trong khi DB đã chạy migration bỏ CCCD → khu NTD lỗi 500 (trông như không đăng nhập được). Đã build lại (`npm run docker:up`). Sau mỗi lần đổi schema cần build lại container.
- **Bảo mật – xem chéo dữ liệu:** tin của NTD cá nhân đăng qua doanh nghiệp phái cử mang employerId của doanh nghiệp, nên cả doanh nghiệp xem / sửa / xoá được tin đó và đọc được hồ sơ ứng viên (SĐT). Đã giới hạn phạm vi doanh nghiệp về tin do thành viên của chính mình đăng (`EmployerContext.ownerScope`, đánh giá NTD cũng vậy), có unit test.

Cần bạn chốt phạm vi

- Công ty phái cử có được xem (chỉ xem) tin / ứng viên của NTD cá nhân liên kết không? Hiện mặc định chặn.
- App mobile đã phát hành chưa? Nếu rồi cần route v2 cho POST /applications (RULE-BE §16 #13).

- Cần spec riêng: Gói & thanh toán, Giao dịch, Tin nhắn.

Việc nhỏ còn tồn

- Trang Điều khoản và Chính sách cần nội dung pháp lý thật từ bạn.
- Khi admin bật bảo trì, web chỉ hiện dải thông báo; các trang gọi API sẽ báo lỗi chung. Có thể làm trang bảo trì riêng nếu cần.
