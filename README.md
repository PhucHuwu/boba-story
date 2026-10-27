# Boba Story 🧋🐾

Game 2D ấm áp về một quán trà sữa nhỏ — mọi vị khách đều là **mèo hai chân**. Người chơi tự tay pha từng ly
(rót trà, sữa, bơm đường, xúc đá, thêm topping, lắc, dán nắp) rồi đưa cho đúng mèo khách. Thiết kế chi tiết: [`GDD.md`](GDD.md).

- Chơi trên trình duyệt: điện thoại (dọc), iPad dọc và iPad ngang — mỗi loại có bố cục riêng, tự đổi khi xoay máy.
- Lưu tiến trình trên máy (localStorage) + lưu đám mây bằng mã khôi phục (Upstash Redis, tùy chọn).
- Lời thoại mèo khách sinh bằng AI qua proxy tương thích OpenAI (tùy chọn, có lời thoại dự phòng).

## Trong game có gì

- Pha chế tay từng ly; chất lượng tính theo công thức, yêu cầu của khách, thao tác và tốc độ.
- Mỗi ngày có thời tiết, mục tiêu ngày, combo, đánh giá sao và đôi khi chó đối thủ phá quán.
- Kinh tế: nhập hàng, mở công thức, nâng cấp, tiền mặt bằng mỗi sáng, ngân hàng (gửi tiết kiệm, vay khi phá sản), trộm ban đêm, **thuế tuần** do mèo công an thu (10% doanh thu, mỗi 7 ngày).
- Khách: học sinh, văn phòng, khách quen Mochi, tiểu thư khó tính, nhà phê bình, **mèo shipper** (đơn 2–3 ly, app giữ 20%), **bà cụ hàng xóm** (tặng trân châu) và **mèo TikToker** (video lên xu hướng hoặc bị chê).
- **Trang trí quán** (6 món: đèn lồng, thảm mèo, monstera, tranh Mochi, kệ thú bông, bảng phấn) đặt thẳng vào phòng, mỗi món tăng nhẹ tip, kiên nhẫn hoặc lượng khách.
- Khách thường có **ngoại hình ngẫu nhiên** (2 biến thể màu lông/trang phục + phụ kiện đội đầu) và có hoạt ảnh: đi hai chân, gọi món, sốt ruột gõ chân, thất vọng, chớp mắt, cầm ly ra về.
- **Phím tắt** cho mọi thao tác pha chế (danh sách trong menu tạm dừng).
- Khách ghé buổi sáng ở màn chuẩn bị: **mèo bán vé số**, **mèo đại lý nguyên liệu** (lô hàng rẻ 30%) và **mèo hoang nhỏ** (cho ăn đủ 5 lần thì thành mèo của quán).

Con số chi tiết: [`GDD.md` mục 17](GDD.md).

## Chạy local

```bash
npm install
cp .env.example .env.local   # điền giá trị (tất cả đều tùy chọn)
npm run dev                  # http://localhost:3000 (trang chủ), /play (game)
```

Trang chủ ở `/` giới thiệu game, dàn khách mèo, thông báo mới nhất, form góp ý và câu hỏi thường gặp; game nằm ở `/play`. Ảnh trang chủ (`landing_*`) sinh bằng `npm run gen:assets`; ảnh chia sẻ mạng xã hội là `src/app/opengraph-image.jpg` (cắt 1200x630 từ `art-src/landing/landing_og.png`).

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run check` | typecheck + lint (kể cả luật phân lớp) + test |
| `npm test` | Vitest (domain, application, layout) |
| `npm run gen:assets [-- --force] [key...]` | Sinh ảnh game qua AI proxy → `public/assets/<nhóm>/*.webp` (prompt nằm trong `scripts/gen-assets.mjs`) |
| `node scripts/gen-assets.mjs --list` | Liệt kê ảnh còn thiếu |
| `node scripts/gen-assets.mjs --reprocess <key>` | Xử lý lại ảnh từ `art-src/` (xóa nền) mà không gọi model |
| `node scripts/asset-status.mjs` | Đếm ảnh đã có so với checklist [`ASSETS.md`](ASSETS.md) |

## Biến môi trường

| Biến | Dùng cho | Bắt buộc |
| --- | --- | --- |
| `AI_PROXY_BASE_URL`, `AI_PROXY_API_KEY` | Lời thoại AI (`/api/dialogue`) và script sinh ảnh | Không — thiếu thì dùng lời thoại có sẵn |
| `AI_CHAT_MODEL` | Model chat (mặc định `gemini-3-flash`) | Không |
| `AI_IMAGE_MODEL` | Model ảnh cho `gen:assets` | Không |
| `IMAGE_PROVIDER`, `IMAGE_FALLBACK`, `FAL_KEY`, `FAL_IMAGE_MODEL` | Dùng fal.ai để sinh ảnh thay cho proxy, hoặc làm dự phòng khi proxy lỗi | Không |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` (hoặc `UPSTASH_REDIS_REST_*`) | Lưu đám mây, cache lời thoại, giới hạn tần suất | Không — thiếu thì `/api/save` trả 503 |
| `ADMIN_API_KEY` | Khoá chung giữa game và trang quản trị cho `/api/admin/*` (≥ 32 ký tự) | Không — thiếu thì mọi API quản trị trả 401 |

Không commit `.env*`. Trên Vercel, đặt biến bằng `vercel env add` hoặc cài Upstash qua Marketplace.

## Kiến trúc

Xem [`ARCHITECTURE.md`](ARCHITECTURE.md). Tóm tắt: Clean Architecture, phụ thuộc chỉ hướng vào trong
(`app → composition → presentation/infrastructure → application → domain`), được ESLint kiểm tra.

## Triển khai

Dự án Vercel `boba-story`. Frontend (trang tĩnh) và backend (route handlers `/api/*`) deploy cùng nhau:

```bash
vercel deploy          # preview
vercel deploy --prod   # production
```

Push lên `main` sẽ tự deploy production.

## Trang quản trị (`admin/`)

Next.js riêng, deploy thành dự án Vercel `boba-story-admin` (Root Directory `admin`). Có 4 mục: góp ý của người chơi, thống kê ẩn danh theo ngày chơi, tra cứu bản lưu theo mã khôi phục, thông báo hiện ở menu game.

| Biến (dự án admin) | Ý nghĩa |
| --- | --- |
| `ADMIN_USERNAME` | Tên đăng nhập |
| `ADMIN_PASSWORD_HASH` | Mật khẩu đã băm: `printf '%s' 'mật-khẩu' \| npm run -s hash-password` |
| `ADMIN_SESSION_SECRET` | Chuỗi ngẫu nhiên ≥ 32 ký tự để ký cookie (đổi biến này hoặc đổi mật khẩu sẽ đăng xuất mọi phiên) |
| `ADMIN_API_KEY` | Trùng với biến cùng tên trên dự án game |
| `GAME_API_URL` | `https://boba-story.vercel.app` |

Chạy local: `cd admin && npm install && npm run dev` (cổng 3200, cần `admin/.env.local`).
