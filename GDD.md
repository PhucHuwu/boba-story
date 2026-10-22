# Boba Story — Game Design Document (GDD)

> **Tài liệu định hướng cho AI coding agent**  
> Phiên bản: 1.1  
> Nền tảng: Web Browser  
> Thể loại: 2D Cozy Simulation / Shop Management / First-Person Interaction  
> Trạng thái: Tài liệu đề xuất — agent cần phân tích tính khả thi, điều chỉnh có lý do và thống nhất kế hoạch trước khi triển khai.
> Ngôn ngữ: tiếng Việt

---

## 1. Chỉ dẫn dành cho agent

Đọc toàn bộ tài liệu này trước khi thay đổi mã nguồn. Nếu repository đã tồn tại, hãy kiểm tra cấu trúc, công nghệ, quy ước code và tính năng hiện có trước khi quyết định kiến trúc.

### Yêu cầu thực hiện

1. Phân tích yêu cầu và repository hiện tại (nếu có).
2. Chỉ ra điểm mơ hồ, rủi ro kỹ thuật, tính năng quá lớn hoặc chưa phù hợp với quy mô dự án.
3. Đề xuất điều chỉnh để có thể triển khai thực tế; giải thích ngắn gọn lý do cho những thay đổi quan trọng.
4. Chia công việc thành các giai đoạn nhỏ, có tiêu chí nghiệm thu rõ ràng.
5. Ưu tiên tạo một **vertical slice có thể chơi được** trước khi mở rộng nội dung.
6. Giữ đúng định hướng nghệ thuật và gameplay bên dưới. Không tự ý biến game thành dashboard quản lý hoặc game 3D.
7. Nếu repository có code sẵn, bảo toàn những phần đang hoạt động; không viết lại toàn bộ chỉ vì sở thích cá nhân. Thay đổi tối thiểu nhưng có cấu trúc tốt.
8. Không tuyên bố tính năng đã hoàn thành nếu chưa chạy và kiểm tra thực tế.
9. Nếu có quyết định quan trọng chưa rõ, ghi lại giả định trong kế hoạch. Chỉ hỏi người dùng khi thiếu thông tin thực sự chặn tiến độ.
10. Trước khi triển khai quy mô lớn, trình bày kế hoạch ngắn gồm kiến trúc, các bước, rủi ro và tiêu chí hoàn thành.

---

## 2. Tầm nhìn sản phẩm

**Boba Story** là game mô phỏng chủ cửa hàng trà sữa. Người chơi đứng sau quầy, trực tiếp thao tác với dụng cụ pha chế, nhận đơn, chuẩn bị đồ uống, giao cho khách, quản lý nguyên liệu và dùng lợi nhuận để phát triển cửa hàng.

Trải nghiệm cần tạo cảm giác ấm áp, dễ thương, thư giãn nhưng vẫn có thử thách vào giờ cao điểm. Điểm khác biệt chính là **pha chế trực tiếp bằng tương tác trong khung cảnh game**, không chỉ chọn món qua menu.

### Thông tin cốt lõi

- **Nền tảng:** Web, chạy trong trình duyệt.
- **Chế độ:** Single-player.
- **Góc nhìn:** First-person 2D — góc nhìn từ vị trí chủ quán phía sau quầy, không phải camera nhìn từ trên xuống.
- **Đồ họa:** 2D cartoon, màu sắc ấm áp, hình khối rõ ràng, animation dễ thương.
- **Nhịp độ:** Kết hợp giờ cao điểm có áp lực với thời gian chuẩn bị và quản lý thư giãn.
- **Đối tượng:** Người chơi yêu thích game cozy, mô phỏng, quản lý cửa hàng và động vật dễ thương.

---

## 3. Định hướng nghệ thuật: khách hàng là mèo đi bằng hai chân

### 3.1. Quy tắc bắt buộc

**Tất cả khách hàng trong Boba Story đều là mèo nhân hóa biết đi bằng hai chân (anthropomorphic bipedal cats).** Đây là yêu cầu cốt lõi của thế giới game, không phải một nhóm khách hàng tùy chọn.

- Khách có hình dáng mèo dễ thương, đứng thẳng và đi bằng hai chân.
- Có thể mặc quần áo, đeo túi, đội mũ hoặc mang phụ kiện phù hợp với tính cách.
- Có tai, đuôi, ria mép và biểu cảm đặc trưng của mèo.
- Dùng hai chân trước như bàn tay để cầm ví, điện thoại, đồ uống hoặc chỉ vào menu.
- Di chuyển, đứng chờ, vui mừng, sốt ruột và rời quán bằng animation đi hai chân.
- Tỷ lệ cơ thể hoạt hình, silhouette dễ phân biệt; không cần mô phỏng giải phẫu chân thực.
- Giữ phong cách nhất quán giữa nhân vật, nền cửa hàng, biểu tượng, vật phẩm và giao diện.

Không dùng khách hàng là người bình thường, động vật đi bốn chân hoặc ảnh chân thực. Không biến nhân vật thành mèo chỉ có tai mèo trên cơ thể người thật; thiết kế phải đọc được ngay là **mèo nhân hóa**.

### 3.2. Các kiểu khách mèo ban đầu

Các kiểu dưới đây là archetype về hành vi, không phải các loài khác nhau:

- **Mèo học sinh/sinh viên:** balo, năng động, thích món mới và topping.
- **Mèo nhân viên văn phòng:** trang phục gọn gàng, thường vội vào giờ cao điểm.
- **Mèo khách quen:** thân thiện, có món yêu thích và hội thoại lặp lại theo tiến trình.
- **Mèo khó tính:** yêu cầu công thức cụ thể, đánh giá đồ uống kỹ hơn.
- **Mèo đặc biệt:** xuất hiện theo nhiệm vụ hoặc sự kiện, có ngoại hình và phần thưởng riêng.

MVP chỉ cần 2–3 archetype có khác biệt hành vi rõ ràng. Có thể tái sử dụng rig/animation cơ bản và thay đổi màu lông, trang phục, phụ kiện để tiết kiệm công sức, nhưng không nên chỉ đổi màu cho tất cả nhân vật nếu điều đó làm chúng thiếu cá tính.

### 3.3. Animation tối thiểu cho khách mèo

MVP nên có các trạng thái hình ảnh cơ bản:

- `idle`: đứng chờ, chớp mắt hoặc đung đưa đuôi.
- `walk`: đi bằng hai chân vào quán và rời quán.
- `order`: ra hiệu hoặc chỉ vào món muốn gọi.
- `wait`: nhìn đồng hồ/điện thoại, chuyển tư thế nhẹ.
- `happy`: vui vẻ khi nhận đồ uống tốt.
- `disappointed`: thất vọng khi đồ uống sai hoặc chờ quá lâu.
- `receive_drink`: dùng hai chân trước nhận ly.

Nếu ngân sách animation hạn chế, có thể dùng sprite sheet đơn giản hoặc animation theo từng bộ phận. Không cần hệ thống xương phức tạp ở MVP.

### 3.4. Art direction

- Phong cách 2D cartoon/cozy, dễ thương và thân thiện.
- Bảng màu pastel hoặc màu ấm, có độ tương phản đủ để phân biệt tương tác.
- Đường nét, tỷ lệ đầu/thân, độ đổ bóng và phối cảnh nhất quán.
- Cửa hàng mang cảm giác ấm cúng; thiết bị và nguyên liệu phải dễ nhận biết.
- Ưu tiên sprite và animation rõ ràng hơn chi tiết trang trí quá nhỏ.
- Không trộn ảnh chụp thực tế với nhân vật hoạt hình.
- Asset AI hoặc asset tải về phải được kiểm tra tính nhất quán, quyền sử dụng và khả năng tích hợp vào game.

---

## 4. Core gameplay loop

### 4.1. Vòng lặp ngắn: một đơn hàng

1. Mèo khách bước đến quầy và gọi món.
2. Người chơi đọc yêu cầu: loại trà, size, đường, đá và topping.
3. Người chơi lấy ly và tương tác với thiết bị/nguyên liệu.
4. Pha chế theo công thức, điều chỉnh định lượng và hoàn thiện đồ uống.
5. Đặt ly vào khu vực giao món.
6. Mèo khách nhận ly, phản ứng dựa trên chất lượng và thời gian chờ.
7. Người chơi nhận tiền, tiền tip (nếu có) và cập nhật danh tiếng.

### 4.2. Vòng lặp dài: phát triển cửa hàng

1. Phục vụ khách để kiếm tiền.
2. Theo dõi tồn kho và chi phí.
3. Kết thúc ngày, xem báo cáo.
4. Mua nguyên liệu, mở khóa công thức hoặc nâng cấp thiết bị.
5. Tăng danh tiếng, mở khóa khách mèo và nhiệm vụ mới.
6. Bắt đầu ngày tiếp theo với nhiều lựa chọn hơn.

### 4.3. Chu kỳ ngày

| Giai đoạn | Nhịp độ | Hoạt động |
|---|---|---|
| Chuẩn bị mở cửa | Thư giãn | Kiểm tra tồn kho, xem công thức và chuẩn bị quầy |
| Bình thường | Vừa phải | Lượng khách thấp đến trung bình |
| Giờ cao điểm | Thử thách | Nhiều mèo chờ, cần thao tác hiệu quả |
| Đóng cửa | Thư giãn | Tổng kết, nhập hàng, nâng cấp và lưu game |

Tạm dừng phải dừng đồng hồ game, bộ đếm thời gian và hành vi khách. Không bắt buộc hoàn thành tất cả đơn mới được kết thúc ngày.

---

## 5. Góc nhìn và tương tác

### 5.1. Góc nhìn

Dùng một khung cảnh 2D cố định nhìn từ vị trí chủ quán phía sau quầy. Phía bên kia quầy là các mèo khách nhân hóa đứng bằng hai chân. Phần trước màn hình là bàn pha chế, dụng cụ và nguyên liệu.

Không triển khai di chuyển nhân vật tự do bằng WASD trong MVP. Dùng các điểm tương tác cố định (hotspots) để kiểm soát phạm vi và giảm độ phức tạp.

### 5.2. Các vùng giao diện

- **Khu khách hàng:** mèo khách, biểu cảm, bong bóng thoại và trạng thái chờ.
- **Khu đơn hàng:** món cần làm, yêu cầu tùy chỉnh, thời gian chờ.
- **Khu pha chế:** ly đang thao tác, các bước pha chế và chỉ báo định lượng.
- **Khu thiết bị/nguyên liệu:** máy pha trà, bình sữa, đá, topping, ly và nắp.
- **Thanh trạng thái:** tiền, thời gian trong ngày, danh tiếng, pause và đóng cửa.

### 5.3. Điều khiển

| Hành động | Điều khiển |
|---|---|
| Chọn đơn | Nhấp chuột trái |
| Dùng thiết bị/nguyên liệu | Nhấp chuột trái |
| Di chuyển ly/nguyên liệu | Kéo thả chuột |
| Điều chỉnh định lượng | Kéo thanh đo hoặc nút tăng/giảm |
| Xác nhận thao tác | Nhấn nút xác nhận/hoàn tất |
| Hủy thao tác chưa xác nhận | `Esc` hoặc nút quay lại |
| Tạm dừng | `Esc` hoặc nút Pause |
| Âm thanh | Điều khiển trong Settings |

Các vùng nhấn phải đủ lớn, có phản hồi hover/selected và báo rõ khi thao tác không hợp lệ. Không phạt tiền cho thao tác sai chưa xác nhận.

---

## 6. Hệ thống pha chế

### 6.1. Thành phần công thức

Mỗi công thức có thể bao gồm:

- Kích cỡ ly.
- Nền trà.
- Sữa hoặc chất tạo ngọt.
- Tỷ lệ đường.
- Lượng đá.
- Topping.
- Bước hoàn thiện (lắc trà/đóng nắp nếu áp dụng).

Công thức là dữ liệu cấu hình, không hard-code riêng cho từng món. Tách định nghĩa công thức khỏi tồn kho thực tế và trạng thái ly đang pha.

### 6.2. Các bước pha chế MVP

1. Lấy đúng ly.
2. Rót nền trà.
3. Thêm sữa/chất tạo ngọt.
4. Thêm đá và topping.
5. Hoàn thiện ly.
6. Giao đồ uống.

Người chơi tương tác trực tiếp với các đối tượng. Ví dụ, nhấp máy trà để chọn nền trà, kéo thanh đo để rót lượng mong muốn và kéo topping vào ly. Có thể dùng minigame ngắn cho một vài thao tác nhưng không để mọi bước trở thành minigame riêng gây chậm nhịp.

### 6.3. Định lượng và chất lượng

Mỗi thành phần có lượng chuẩn và khoảng sai số riêng. Chấm điểm dựa trên:

- Độ chính xác công thức.
- Mức độ đáp ứng yêu cầu của khách.
- Hoàn thiện đúng quy trình.
- Thời gian phục vụ.

Có thể bắt đầu bằng công thức điểm:

`Quality = 0.35 * RecipeAccuracy + 0.25 * OrderMatch + 0.20 * ProcessQuality + 0.20 * ServiceSpeed`

Chuẩn hóa các thành phần trong khoảng 0–100. Đây là thông số khởi đầu cần kiểm thử, không phải hằng số bắt buộc. Tốc độ không được lấn át độ chính xác; làm nhanh nhưng sai món phải có điểm thấp.

### 6.4. Tồn kho

Nguyên liệu ban đầu gồm trà, sữa, đường, đá, trân châu, ly và nắp. Mỗi lần dùng phải trừ kho đúng một lần. Nếu hết nguyên liệu, hiển thị thông báo và cung cấp lựa chọn hợp lý.

MVP không cần hạn sử dụng, nhiệt độ bảo quản, nhà cung cấp hay logistics phức tạp.

---

## 7. Khách hàng mèo và đơn hàng

### 7.1. Vòng đời khách hàng

Trạng thái chính:

`Approaching → Ordering → Waiting → Receiving → Leaving`

Trạng thái phụ có thể gồm `Impatient` và `OrderCancelled`. Cần bảo đảm mỗi khách chỉ ở một trạng thái hợp lệ tại một thời điểm.

### 7.2. Hành vi

Mỗi khách có một số thuộc tính đơn giản:

- Archetype.
- Tốc độ kiên nhẫn giảm.
- Món yêu thích.
- Độ khó của yêu cầu.
- Trạng thái khách quen.
- Dữ liệu ngoại hình (màu lông, trang phục, phụ kiện).

Số khách đang chờ cần được giới hạn. Tốc độ sinh khách phụ thuộc vào khung giờ, danh tiếng và lượng khách hiện tại để không tạo hàng đợi vô hạn.

### 7.3. Kiên nhẫn

Có thể dùng mô hình đơn giản:

`Patience = max(0, 100 - decayRate * waitingTime)`

Khi kiên nhẫn giảm, mèo biểu hiện sốt ruột. Khi về 0, khách có thể hủy đơn và rời quán. Tất cả bộ đếm phải dừng khi game pause. Có thể bổ sung chế độ thư giãn để giảm hoặc tắt cơ chế khách bỏ đi.

### 7.4. Khách quen

Khách quen nhớ món yêu thích, có hội thoại hoặc phản ứng khác biệt và có thể mở khóa nhiệm vụ. MVP chỉ cần một tuyến khách quen ngắn với một vài lần xuất hiện khác nhau.

---

## 8. Kinh tế

### 8.1. Thu nhập và chi phí

**Nguồn thu:** bán đồ uống, tip, nhiệm vụ và thưởng danh tiếng.

**Chi phí:** nguyên liệu, vật tư tiêu hao và nâng cấp thiết bị. Nhân viên, thuế, vay vốn và khấu hao nằm ngoài MVP.

Công thức tổng quát:

`DailyProfit = Revenue + Rewards - IngredientCosts - OtherCosts`

Phải nhất quán cách tính giá vốn: không trừ hai lần cùng một nguyên liệu, chẳng hạn vừa trừ theo từng lần sử dụng vừa trừ toàn bộ giá vốn lần nữa ở cuối ngày.

### 8.2. Giá trị ban đầu để cân bằng thử nghiệm

Các con số sau chỉ là giả định ban đầu:

| Hạng mục | Giá thử nghiệm |
|---|---:|
| Vốn đầu game | 500 xu |
| Giá bán một ly cơ bản | 25–35 xu |
| Giá vốn một ly | 8–14 xu |
| Nâng cấp máy | 300 xu |
| Mở công thức | 100–200 xu |
| Trang trí | 50–150 xu |

Mục tiêu là người chơi có thể mua nâng cấp đầu tiên sau khoảng 1–2 ngày game nếu kinh doanh ổn. Cần kiểm thử để cân bằng.

### 8.3. Tránh bế tắc

- Không cho mua nguyên liệu vượt quá số tiền.
- Giữ ít nhất một công thức cơ bản có giá vốn thấp.
- Cân nhắc nhiệm vụ phục hồi nếu tiền quá thấp.
- Không xóa save hoặc buộc chơi lại từ đầu vì thua lỗ nhỏ.
- Tự động lưu sau các mốc quan trọng.

---

## 9. Tiến trình phát triển (Progression)

Ba trục chính:

1. **Vận hành:** nâng cấp thiết bị, tăng hiệu quả thao tác và dung lượng kho.
2. **Thực đơn:** mở khóa nền trà, sữa, topping và công thức.
3. **Danh tiếng:** mở nhóm khách mèo mới, nhiệm vụ và sự kiện.

### Cột mốc dự kiến

| Giai đoạn | Nội dung |
|---|---|
| Khởi đầu | 3 công thức, thiết bị cơ bản và 1 nhóm khách |
| Tiến triển sớm | Mở trân châu, công thức mới và nhóm mèo mới |
| Cửa hàng ổn định | Nâng cấp máy, trang trí và thêm nhiệm vụ |
| Danh tiếng cao | Khách mèo đặc biệt, đơn hàng khó và sự kiện |
| Mở rộng sau MVP | Nhân viên, cửa hàng mới, marketing |

MVP nên có khoảng 8–12 nhiệm vụ cố định. Không cần hệ thống nhiệm vụ AI-generated.

---

## 10. UI/UX

### Màn hình bắt buộc

1. **Main Menu:** New Game, Continue, Settings.
2. **Gameplay:** khung cảnh cửa hàng, khách mèo, đơn hàng, bàn pha chế và trạng thái.
3. **Recipe Book:** công thức đã mở khóa và hướng dẫn.
4. **Shop/Upgrades:** nhập nguyên liệu, nâng cấp và trang trí.
5. **Daily Summary:** doanh thu, chi phí, chất lượng phục vụ và tiến độ.

### UX khi pha chế

Khi chọn đơn, hiển thị rõ loại đồ uống, size, đường, đá, topping và trạng thái từng bước. Cho phép xem lại công thức. Báo lỗi bằng thông điệp có hướng xử lý, ví dụ “Hết trân châu — hãy nhập thêm hoặc chọn đơn khác”.

### Onboarding

Hướng dẫn tương tác lần đầu qua một đơn mẫu: chọn đơn, lấy ly, rót trà, thêm sữa, topping, hoàn thiện và giao cho khách mèo. Mỗi bước chỉ giới thiệu một cơ chế mới.

### Khả năng tiếp cận

- Chỉnh âm lượng nhạc và hiệu ứng.
- Có chế độ giảm chuyển động.
- Không dùng màu sắc làm dấu hiệu duy nhất.
- Vùng nhấn lớn, chữ dễ đọc.
- Có điều hướng bàn phím cơ bản.
- Pause phải dừng thời gian game.

---

## 11. Kiến trúc kỹ thuật đề xuất

Nếu chưa có stack sẵn trong repository, cân nhắc:

- **Phaser 3 + TypeScript:** gameplay 2D, scene, sprite, animation, input và audio.
- **Vite:** dev server và build.
- **LocalStorage hoặc IndexedDB:** save/load cục bộ cho bản single-player.
- **Static hosting:** triển khai bản web đầu tiên mà không cần backend.

Đây là lựa chọn đề xuất, không phải lý do để viết lại repository đang hoạt động tốt. Nếu project hiện tại đã có công nghệ phù hợp, hãy đánh giá trước khi thay đổi.

### Module logic

- `GameScene`: khung cảnh, camera và hotspots.
- `OrderManager`: đơn hàng và hàng đợi.
- `RecipeManager`: công thức và điều kiện hợp lệ.
- `BrewingController`: trạng thái ly và thao tác pha chế.
- `QualityEvaluator`: chấm điểm.
- `CustomerManager`: hành vi khách mèo.
- `InventoryManager`: tồn kho.
- `EconomyManager`: tiền và chi phí.
- `ProgressionManager`: nhiệm vụ và mở khóa.
- `SaveManager`: lưu/tải.
- `AudioManager`: nhạc và hiệu ứng.

Dùng các API hoặc event rõ ràng giữa module; tránh để mọi hệ thống sửa trực tiếp dữ liệu của nhau.

### Dữ liệu lưu

Lưu các dữ liệu cần thiết để tiếp tục chơi: phiên bản save, ngày, tiền, danh tiếng, tồn kho, công thức đã mở khóa, nâng cấp và tiến trình nhiệm vụ. Không cần lưu trạng thái animation hoặc tọa độ hiệu ứng tạm thời.

Cần xử lý dữ liệu save lỗi và thay đổi schema bằng `version`/migration. Không cam kết dữ liệu trình duyệt tồn tại vĩnh viễn nếu người chơi xóa dữ liệu trang.

### Hiệu năng

- Mục tiêu ban đầu khoảng 60 FPS trên desktop được chọn để kiểm thử.
- Nén hình ảnh và âm thanh; dùng atlas khi hợp lý.
- Giới hạn số khách và hiệu ứng đồng thời.
- Chỉ tải tài nguyên cần thiết.
- Kiểm thử màn hình nhỏ và trình duyệt mục tiêu trước khi phát hành.

---

## 12. Phạm vi MVP

### Bắt buộc

- Một cửa hàng và một góc nhìn first-person 2D.
- Khách hàng đều là mèo nhân hóa đi bằng hai chân.
- Một khung cảnh quầy với hotspots.
- Nhận đơn, pha chế, giao món và chấm điểm.
- 5–8 công thức đồ uống.
- 5–8 nguyên liệu có tồn kho.
- 2–3 archetype khách mèo với hành vi cơ bản.
- Tiền, doanh thu, chi phí và nhập hàng.
- 3–5 nâng cấp.
- 8–12 nhiệm vụ.
- Menu, pause, settings, hướng dẫn và tổng kết ngày.
- Save/load cục bộ.
- Âm thanh và animation cơ bản.

### Để sau MVP

- Multiplayer.
- Nhiều cửa hàng hoặc bản đồ thành phố.
- Nhân viên tự động hóa.
- Kinh tế chuyên sâu, vay vốn và thuế.
- Công thức tùy chỉnh không giới hạn.
- Sự kiện theo mùa quy mô lớn.
- Đăng nhập và cloud save.
- Nhiệm vụ sinh bởi AI.

---

## 13. Roadmap gợi ý

Thời lượng dưới đây là ước lượng cho một lập trình viên toàn thời gian; cần điều chỉnh theo repository, năng lực và mức độ sẵn có của art assets.

### Phase 1 — Prototype (tuần 1–2)

- Khởi tạo hoặc kiểm tra project.
- Dựng khung cảnh bằng placeholder.
- Tạo hotspots, ly và một công thức.
- Làm được toàn bộ thao tác pha chế và giao món.

**Nghiệm thu:** có thể pha một ly bằng tương tác trực tiếp, không chỉ thông qua menu.

### Phase 2 — Core Loop (tuần 3–4)

- Đơn hàng và hàng đợi.
- Khách mèo xuất hiện, chờ và rời đi.
- Chấm điểm, tồn kho và kinh tế cơ bản.
- Kết thúc ngày và tổng kết.

**Nghiệm thu:** phục vụ được nhiều khách trong một ngày và dữ liệu kinh tế nhất quán.

### Phase 3 — MVP Content (tuần 5–6)

- Thêm công thức, archetype mèo và nhiệm vụ.
- Nâng cấp thiết bị, nhập hàng.
- Menu, hướng dẫn, âm thanh và save/load.

**Nghiệm thu:** chơi được nhiều ngày, mở khóa nội dung và tiếp tục sau khi tải lại trang.

### Phase 4 — Polish & Testing (tuần 7–8)

- Hoàn thiện asset 2D và animation.
- Cân bằng kinh tế, kiên nhẫn và nhịp độ.
- Kiểm thử các trạng thái lỗi, save/load và màn hình nhỏ.
- Thu thập phản hồi từ người chơi mới.

**Nghiệm thu:** người chơi mới có thể tự học và hoàn thành vòng lặp chính.

### Phase 5 — Public Demo (tuần 9–10)

- Deploy lên hosting tĩnh.
- Thêm giới thiệu và hướng dẫn.
- Sửa các lỗi ảnh hưởng core loop.
- Theo dõi phản hồi tự nguyện.

**Nghiệm thu:** có URL demo hoạt động trên trình duyệt mục tiêu.

---

## 14. Tiêu chí nghiệm thu tổng thể

1. Người chơi bắt đầu game và hoàn thành một ngày.
2. Có thể nhận đơn, pha chế, giao đồ uống và nhận tiền.
3. Công thức chính xác được đánh giá tốt hơn công thức sai.
4. Nguyên liệu bị trừ đúng một lần cho mỗi lần sử dụng.
5. Khách mèo có trạng thái hợp lệ và có thể rời quán.
6. Có thể dùng lợi nhuận để mua ít nhất một nâng cấp.
7. Save/load khôi phục đúng dữ liệu quan trọng.
8. Không có lỗi nghiêm trọng làm kẹt quy trình pha chế hoặc xóa tiến trình.
9. Game chơi được mà không cần đăng nhập hay backend.
10. Tất cả khách hàng hiển thị trong game đều tuân thủ định hướng mèo nhân hóa đi hai chân.
11. Phong cách nhân vật, nền, thiết bị và UI nhất quán.
12. Không tuyên bố hoàn thành nếu chưa chạy kiểm thử tương ứng.

---

## 15. Yêu cầu agent đầu ra trước khi code

Sau khi đọc tài liệu và kiểm tra repository, hãy tạo một bản phân tích gồm:

1. **Tóm tắt hiện trạng:** stack, cấu trúc, tính năng đã có và điểm có thể tái sử dụng.
2. **Đánh giá khả thi:** rủi ro kỹ thuật, phần khó nhất và các giả định.
3. **Đề xuất điều chỉnh GDD:** chỉ điều chỉnh khi có lý do rõ ràng; giữ nguyên yêu cầu khách mèo nhân hóa đi hai chân.
4. **Kiến trúc triển khai:** scene, module, mô hình dữ liệu và cách lưu.
5. **Kế hoạch theo thứ tự:** các task nhỏ, phụ thuộc và tiêu chí nghiệm thu.
6. **Kế hoạch art assets:** danh sách sprite/animation tối thiểu, phong cách thống nhất và phương án tạo asset.
7. **Kế hoạch kiểm thử:** gameplay, economy, save/load, trạng thái khách và tương thích trình duyệt.

Sau khi có phân tích, hãy bắt đầu từ vertical slice nhỏ nhất có thể chơi được. Nếu không có yêu cầu phê duyệt riêng trong môi trường làm việc, tiếp tục triển khai theo từng giai đoạn và kiểm thử sau mỗi giai đoạn.

---

## 16. Nguyên tắc không được đánh đổi

- **Khách hàng luôn là mèo nhân hóa biết đi bằng hai chân.**
- Gameplay pha chế trực tiếp là trọng tâm.
- Giữ góc nhìn first-person 2D; không tự chuyển thành game 3D hoặc top-down.
- Giữ phong cách 2D cartoon dễ thương, nhất quán.
- Ưu tiên vòng lặp chơi được hơn số lượng tính năng.
- Không mở rộng phạm vi MVP nếu chưa hoàn thiện core loop.
- Không thay đổi kiến trúc hiện có nếu chưa phân tích lợi ích và chi phí.
- Mọi tính năng phải có tiêu chí nghiệm thu và được kiểm thử trước khi xem là hoàn thành.
