# Checklist ảnh AI

Mỗi ảnh là một file `public/assets/<thư mục>/<key>.webp` (ảnh gốc chưa tách nền ở `art-src/` cùng cấu trúc). Thư mục được chọn theo tên ảnh, quy tắc nằm trong `scripts/asset-paths.mjs`:

| Thư mục | Ảnh |
| --- | --- |
| `scene/` | `bg_room`, `counter_front`, `worktop` |
| `stations/` | trà, sữa, đường, đá, topping, `cup_stack`, `sealer`, `trash` |
| `characters/customers/` | `cat_*` |
| `characters/shippers/` | `shipper_*` |
| `characters/npc/` | `npc_*`, `robber`, `rival_dog` |
| `drinks/` | `drink_*` |
| `upgrades/` | `upg_*` |
| `events/` | `rival_*` (cảnh phá quán), `trash_*` (rác trên sàn) |
| `icons/` | `icon_*`, `coin`, `star` |
| `brand/` | `logo`, `app_icon` |
| `landing/` | `landing_*` (ảnh trang chủ) |
| `decor/` | `decor_*` (đồ trang trí quán, dùng luôn làm icon cửa hàng) |
| `characters/accessories/` | `acc_*` (phụ kiện đội đầu / quàng cổ cho khách thường) |

Code luôn gọi ảnh bằng key (không kèm thư mục); `assetManifest.json` ánh xạ key → đường dẫn.

Cập nhật dấu tick tự động bằng:

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
- [x] `trash_box`: rác trên sàn (đã gen lại, bỏ viền trắng kiểu sticker)
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
- [x] `icon_home`: nút về menu chính
- [x] `icon_pause`: nút tạm dừng
- [x] `icon_close`: nút đóng cửa sổ
- [x] `app_icon`: favicon và icon "Thêm vào màn hình chính"

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

## 5. Khâu pha chế (thay hình vẽ bằng code)

### Giai đoạn 1: ly và những gì trong ly
- [x] `cup_glass`: ly nhựa trong (thân trong suốt, giữ viền và vệt sáng)
- [x] `liquid_surface`: mặt nước có bọt (tô theo màu trà/sữa đang trộn)
- [x] `liquid_swirl`: vệt sữa xoáy khi rót sữa
- [x] `liquid_syrup`: vệt siro đường loang ở đáy ly
- [x] `piece_boba`: một viên trân châu
- [x] `piece_jelly`: một miếng thạch dừa
- [x] `piece_pudding`: một miếng pudding
- [x] `piece_ice`: một viên đá (trong suốt)
- [x] `cup_lid`: màng dán nắp in dấu chân mèo
- [x] `cup_straw`: ống hút
- [x] `cup_coaster`: lót ly ở chỗ đặt ly

### Giai đoạn 2: máy móc khi đang dùng
- [x] `tea_black_pour` (ref: tea_black)
- [x] `tea_green_pour` (ref: tea_green)
- [x] `tea_oolong_pour` (ref: tea_oolong)
- [x] `milk_pour` (ref: milk)
- [x] `sugar_press` (ref: sugar)
- [x] `ice_scoop` (ref: ice)
- [x] `sealer_press` (ref: sealer)
- [x] `scoop_boba`: muỗng xúc trân châu (khi kéo topping)
- [x] `scoop_jelly`: muỗng xúc thạch dừa
- [x] `scoop_pudding`: muỗng xúc pudding

### Giai đoạn 3: hiệu ứng rót và phản hồi
- [x] `pour_stream`: dòng rót (tô theo màu)
- [x] `fx_splash`: nước bắn khi chạm mặt ly
- [x] `fx_spill`: vũng nước khi tràn ly
- [x] `fx_sparkle`: lấp lánh khi rót trúng mức / ly 3 sao
- [x] `gauge_tube`: ống đo mức rót

### Giai đoạn 4: bước lắc
- [x] `shaker`: bình lắc
- [x] `shaker_shake` (ref: shaker)

### Giai đoạn 5: khung UI trong màn chơi
- [x] `ui_card`: phiếu gọi món trên đầu mèo
- [x] `ui_bubble`: bóng thoại
- [x] `ui_ticket`: tờ phiếu đơn đang làm

## 6. Trang chủ (có prompt)
- [x] `landing_hero_wide`: ảnh bìa ngang cho máy tính / iPad ngang (16:9)
- [x] `landing_hero_tall`: ảnh bìa dọc cho điện thoại / iPad dọc (9:16)
- [x] `landing_og`: ảnh chia sẻ mạng xã hội 1200x630
- [x] `landing_group`: nhóm khách mèo vẫy tay (giữ nền trắng, trang hoà nền bằng multiply), dùng ở chân trang

## 7. Đồ trang trí (có prompt)
Đặt cố định trong phòng theo tọa độ ảnh `bg_room` (`src/presentation/game/decorSpots.ts`). `decor_monstera` dùng `holes: true` để xóa nền trắng trong khe lá.
- [x] `decor_lanterns`: dây đèn lồng giấy pastel
- [x] `decor_rug`: thảm hình mặt mèo
- [x] `decor_monstera`: chậu monstera lớn
- [x] `decor_painting`: tranh quán do Mochi vẽ
- [x] `decor_plushies`: kệ thú bông
- [x] `decor_chalkboard`: bảng menu phấn chữ A (không chữ)

## 8. Phụ kiện khách (có prompt)
Khách thường (học sinh, dân văn phòng, khó tính) có 40% cơ hội đeo 1 phụ kiện. Chỉ đặt trên đỉnh đầu hoặc cạnh tai, không che mặt (bỏ tai nghe và khăn quàng vì đè lên mặt). Vị trí đầu theo từng tư thế nằm trong `src/presentation/game/catLooks.ts`. Ảnh nào chưa có thì game tự bỏ qua.
- [x] `acc_beanie`: mũ len xanh bạc hà
- [x] `acc_bow`: nơ hồng
- [x] `acc_flower`: kẹp hoa vàng
- [x] `acc_cap`: mũ lưỡi trai đỏ
- [x] `acc_wreath`: vòng hoa nhỏ trên đỉnh đầu (`holes: true`)
- [x] `acc_star`: kẹp tóc ngôi sao vàng

## 9. Biến thể ngoại hình (có prompt, sửa từ ảnh gốc)
Mỗi khách thường có 2 biến thể đổi màu lông + trang phục (cùng tư thế với ảnh gốc). Chưa có ảnh thì game dùng ảnh gốc. Mochi, bà cụ, TikToker, shipper giữ nguyên.
- [x] `cat_student_v1_{idle,happy,sad,impatient}`: mèo mun trắng, áo hoodie vàng
- [x] `cat_student_v2_{idle,happy,sad,impatient}`: lông kem, áo len tím nhạt
- [x] `cat_office_v1_{idle,happy,sad,impatient}`: mèo đen, sơ mi xanh, cà vạt đỏ
- [x] `cat_office_v2_{idle,happy,sad,impatient}`: mèo cam, áo blazer nâu
- [x] `cat_picky_v1_{idle,happy,sad,impatient}`: Ba Tư xám bạc, áo khoác bạc hà
- [x] `cat_picky_v2_{idle,happy,sad,impatient}`: lông kem colourpoint, áo khoác hồng

## 10. Chớp mắt (có prompt, sửa từ ảnh idle)
Game tự đổi sang ảnh `_blink` một lúc mỗi vài giây khi khách đứng yên (tắt khi bật giảm chuyển động). Chỉ khác phần mắt so với ảnh idle.
- [x] `cat_regular_blink`, `cat_student_blink`, `cat_office_blink`, `cat_picky_blink`
- [x] `cat_granny_blink`, `cat_tiktoker_blink`
- [x] `cat_student_v1_blink`, `cat_student_v2_blink`, `cat_office_v1_blink`, `cat_office_v2_blink`, `cat_picky_v1_blink`, `cat_picky_v2_blink`

## 11. Thiết kế lại 2.5D (hướng B: phòng isometric + quầy pha chế liền khối)
Ngân sách fal.ai tối đa $5. Giai đoạn 0 dùng Nano Banana 2 ($0.08/ảnh 1K); từ giai đoạn 1 dùng `openai/gpt-image-2.5/flare` mức medium (~$0.01–0.013/ảnh tạo, ~$0.022/ảnh sửa, cộng phí token). Chỉ dùng fal sau khi proxy lỗi 3 lần liên tiếp.

Sổ chi tiêu:
| Ngày giờ | Proxy (3 lần) | fal | Ảnh | Chi | Cộng dồn |
|---|---|---|---|---|---|
| 2026-10-28 01:19–01:22 | 500 INTERNAL ×3 | dùng | 3 ảnh mẫu phong cách | $0.24 | $0.24 |
| 2026-10-28 01:36–01:37 | gpt-image-2.5: auth_not_found ×3 | dùng | 10 ảnh phòng iso (gpt-image-2.5 medium) | ~$0.25 | ~$0.49 |
| 2026-10-28 02:39 | gpt-image-2.5: auth_not_found ×3 | dùng | `iso_counter_front` | ~$0.013 | ~$0.50 |
| 2026-10-28 04:02 | gpt-image-2.5: auth_not_found ×3 | dùng | `icon_arrange` | ~$0.013 | ~$0.51 |

Giai đoạn 0, ảnh mẫu (chưa vào game, chỉ để duyệt phong cách):
- [x] `mock_phone`: điện thoại dọc, phòng ở trên và quầy ở dưới
- [x] `mock_landscape`: iPad ngang, phòng bên trái và quầy bên phải
- [x] `mock_room`: riêng phòng dạng khối diorama

Giai đoạn 1, phòng isometric (gpt-image-2.5 Flare medium trên fal, nền trong suốt thật, ref `iso_ref_room`). Lưu ở `public/assets/iso/`:
- [x] `iso_room`: phòng trống (sàn gỗ + 2 tường sau)
- [x] `iso_counter`: quầy gỗ chéo (đã tạo, chưa dùng)
- [x] `iso_counter_front`: mặt trước quầy chạy ngang, khách đứng phía sau
- [x] `iso_table`, `iso_shelf`
- [x] `icon_arrange`: icon nút "Sắp xếp đồ trang trí" (chậu cây + mũi tên 4 hướng), lưu ở `public/assets/icons/`
- [x] `iso_decor_rug`, `iso_decor_lanterns`, `iso_decor_painting`, `iso_decor_plushies`, `iso_decor_monstera`, `iso_decor_chalkboard`
