# Checklist ảnh AI

Mỗi ảnh là một file `public/assets/<key>.webp`. Cập nhật dấu tick tự động bằng:

```bash
node scripts/asset-status.mjs
```

Script đánh `[x]` cho key đã có file và in ra danh sách còn thiếu. Ghi chú trong ngoặc (`ref:`) là ảnh gốc cần có trước để ref-edit giữ đúng nhân vật.

Trạng thái prompt:
- **Có prompt**: đã có trong `scripts/gen-assets.mjs`, chỉ cần chạy lại khi hồi quota.
- **Chưa có prompt**: cần viết prompt trước khi gen.

## 1. Đã dùng trong game

### Nền và quầy
- [x] `bg_room`
- [x] `counter_front`
- [x] `worktop`
- [x] `logo`

### Dụng cụ và nguyên liệu
- [x] `cup_stack`
- [x] `tea_black`
- [x] `tea_green`
- [x] `tea_oolong`
- [x] `milk`
- [x] `sugar`
- [x] `ice`
- [x] `top_boba`
- [x] `top_jelly`
- [x] `top_pudding`
- [x] `sealer`
- [x] `trash`
- [x] `coin`
- [x] `star`

### Mèo khách (4 loại × 4 biểu cảm)
- [x] `cat_student_idle`
- [x] `cat_student_happy` (ref: cat_student_idle)
- [x] `cat_student_sad` (ref: cat_student_idle)
- [x] `cat_student_impatient` (ref: cat_student_idle)
- [x] `cat_office_idle`
- [x] `cat_office_happy` (ref: cat_office_idle)
- [x] `cat_office_sad` (ref: cat_office_idle)
- [x] `cat_office_impatient` (ref: cat_office_idle)
- [x] `cat_regular_idle`
- [x] `cat_regular_happy` (ref: cat_regular_idle)
- [x] `cat_regular_sad` (ref: cat_regular_idle)
- [x] `cat_regular_impatient` (ref: cat_regular_idle)
- [x] `cat_picky_idle`
- [x] `cat_picky_happy` (ref: cat_picky_idle)
- [x] `cat_picky_sad` (ref: cat_picky_idle)
- [x] `cat_picky_impatient` (ref: cat_picky_idle)

### Icon UI
- [x] `icon_sunny`: thẻ ngày, HUD (thời tiết nắng đẹp)
- [x] `icon_hot`: thời tiết nắng gắt
- [x] `icon_rainy`: thời tiết mưa
- [x] `icon_cloudy`: thời tiết âm u
- [x] `icon_festival`: ngày lễ hội
- [x] `icon_goal`: mục tiêu ngày (thẻ ngày, HUD, tổng kết)
- [x] `icon_combo`: chip combo HUD, popup combo, tổng kết
- [x] `icon_lock`: công thức chưa mở khóa
- [x] `icon_camera`: màn đêm (đã có camera)
- [x] `icon_safe`: màn đêm (đã có két sắt)
- [x] `icon_bank`: khoản vay khẩn cấp
- [x] `icon_moon`: màn đêm, nút "Đóng cửa"
- [x] `icon_sunrise`: màn buổi sáng
- [x] `icon_critic`: badge food reviewer trên phiếu gọi món, đánh giá
- [x] `icon_mic`: chip HUD "Ồn ào" (đối thủ hát karaoke)

## 2. Còn thiếu: chỗ đã chừa sẵn trong UI (có prompt)

Hiện các chỗ này đang **trống** hoặc dùng ảnh thay thế. Gen xong là tự hiện, không cần sửa code.

- [x] `icon_discount`: chip HUD "Đang giảm giá" (sự kiện đối thủ)
- [x] `icon_wrench`: chip HUD "Vòi chảy chậm"
- [x] `icon_bankrupt`: màn phá sản (đang tạm dùng `icon_bank`)
- [x] `trash_can`: rác trên sàn + chip HUD "N rác" (đang dùng nắm giấy vẽ bằng code)
- [x] `trash_banana`: rác trên sàn
- [x] `trash_paper`: rác trên sàn
- [x] `trash_box`: rác trên sàn
- [x] `trash_bone`: rác trên sàn
- [x] `robber`: màn sáng khi bị trộm (đang tạm dùng `icon_safe`)
- [x] `rival_dog`: tổng kết ngày có đối thủ, popup đối thủ
- [x] `rival_discount` (ref: rival_dog): popup "Đối thủ giảm giá"
- [x] `rival_trash` (ref: rival_dog): popup "Đổ rác trước quán"
- [x] `rival_fakeReviews` (ref: rival_dog): popup "Bão đánh giá 1 sao"
- [x] `rival_powerCut` (ref: rival_dog): popup "Phá vòi nước"
- [x] `rival_karaoke` (ref: rival_dog): popup "Hát karaoke"

## 3. Còn thiếu: UI đang chỉ có chữ (chưa có prompt, cần thêm chỗ hiển thị)

### Đồ uống (tab Công thức trong Cửa hàng, Sổ công thức, phiếu gọi món)
- [x] `drink_classic`: Trà sữa truyền thống
- [x] `drink_boba`: Trà sữa trân châu
- [x] `drink_jasmine`: Trà xanh nhài
- [x] `drink_oolong_milk`: Ô long sữa
- [x] `drink_green_jelly`: Trà xanh sữa thạch dừa
- [x] `drink_oolong_pudding`: Ô long pudding trứng
- [x] `drink_black_jelly`: Hồng trà thạch dừa

### Nâng cấp (tab Nâng cấp trong Cửa hàng; camera và két sắt dùng lại `icon_camera`/`icon_safe`)
- [x] `upg_fast_tap`: Vòi trà tốc độ cao
- [x] `upg_auto_sealer`: Máy dán nắp tự động
- [x] `upg_wide_counter`: Quầy rộng
- [x] `upg_cozy_plants`: Cây xanh & đèn lồng
- [x] `upg_bell`: Chuông gió mèo thần tài

### Nút màn chuẩn bị và icon chung
- [x] `icon_shop`: nút Cửa hàng
- [x] `icon_recipes`: nút Công thức
- [x] `icon_quests`: nút Nhiệm vụ, popup nhiệm vụ
- [x] `icon_reviews`: nút Đánh giá
- [x] `icon_rent`: tiền mặt bằng (màn đêm/sáng)
- [x] `app_icon`: favicon và icon "Thêm vào màn hình chính" (hiện vẫn là logo mặc định của Next.js)

## 4. NPC mới đã đề xuất (chưa code, chưa có prompt)

Chỉ gen nhóm này sau khi chốt kế hoạch NPC.

### Mèo công an (thu thuế mỗi 7 ngày)
- [x] `npc_police`
- [x] `icon_tax`

### Mèo shipper (2-3 ly/đơn, hoa hồng 20%)
- [x] `shipper_grab_idle`
- [x] `shipper_grab_happy` (ref: shipper_grab_idle)
- [x] `shipper_grab_sad` (ref: shipper_grab_idle)
- [x] `shipper_grab_impatient` (ref: shipper_grab_idle)
- [x] `shipper_bee_idle`
- [x] `shipper_bee_happy` (ref: shipper_bee_idle)
- [x] `shipper_bee_sad` (ref: shipper_bee_idle)
- [x] `shipper_bee_impatient` (ref: shipper_bee_idle)
- [x] `shipper_food_idle`
- [x] `shipper_food_happy` (ref: shipper_food_idle)
- [x] `shipper_food_sad` (ref: shipper_food_idle)
- [x] `shipper_food_impatient` (ref: shipper_food_idle)
- [x] `icon_delivery`

### Bà cụ hàng xóm
- [x] `cat_granny_idle`
- [x] `cat_granny_happy` (ref: cat_granny_idle)
- [x] `cat_granny_sad` (ref: cat_granny_idle)
- [x] `cat_granny_impatient` (ref: cat_granny_idle)

### Mèo TikToker
- [x] `cat_tiktoker_idle`
- [x] `cat_tiktoker_happy` (ref: cat_tiktoker_idle)
- [x] `cat_tiktoker_sad` (ref: cat_tiktoker_idle)
- [x] `cat_tiktoker_impatient` (ref: cat_tiktoker_idle)

### Mèo bán vé số
- [x] `npc_lottery`
- [x] `icon_lottery`

### Mèo hoang nhỏ
- [x] `npc_stray_idle`
- [x] `npc_stray_happy` (ref: npc_stray_idle)

### Mèo đại lý nguyên liệu
- [x] `npc_supplier`
