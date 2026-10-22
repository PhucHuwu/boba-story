# Boba Story 🧋🐾

Game 2D ấm áp về một quán trà sữa nhỏ — mọi vị khách đều là **mèo hai chân**. Người chơi tự tay pha từng ly
(rót trà, sữa, bơm đường, xúc đá, thêm topping, dán nắp) rồi đưa cho đúng mèo khách. Thiết kế chi tiết: [`GDD.md`](GDD.md).

- Chơi trên trình duyệt: điện thoại (dọc), iPad dọc và iPad ngang — mỗi loại có bố cục riêng, tự đổi khi xoay máy.
- Lưu tiến trình trên máy (localStorage) + lưu đám mây bằng mã khôi phục (Upstash Redis, tùy chọn).
- Lời thoại mèo khách sinh bằng AI qua proxy tương thích OpenAI (tùy chọn, có lời thoại dự phòng).

## Chạy local

```bash
npm install
cp .env.example .env.local   # điền giá trị (tất cả đều tùy chọn)
npm run dev                  # http://localhost:3000
```

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run check` | typecheck + lint (kể cả luật phân lớp) + test |
| `npm test` | Vitest (domain, application, layout) |
| `npm run gen:assets [-- --force] [key...]` | Sinh lại ảnh game qua AI proxy → `public/assets/*.webp` |

## Biến môi trường

| Biến | Dùng cho | Bắt buộc |
| --- | --- | --- |
| `AI_PROXY_BASE_URL`, `AI_PROXY_API_KEY` | Lời thoại AI (`/api/dialogue`) và script sinh ảnh | Không — thiếu thì dùng lời thoại có sẵn |
| `AI_CHAT_MODEL` | Model chat (mặc định `gemini-3-flash`) | Không |
| `AI_IMAGE_MODEL` | Model ảnh cho `gen:assets` | Không |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` (hoặc `UPSTASH_REDIS_REST_*`) | Lưu đám mây, cache lời thoại, giới hạn tần suất | Không — thiếu thì `/api/save` trả 503 |

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
