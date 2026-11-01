# Mở cho nhân viên trước, xưởng khác sau

*Báo cáo nghiên cứu ngày 20/10/2026. Người viết không phải luật sư. Các nhận định pháp lý dưới đây chỉ để bạn biết cần hỏi gì. Trước khi mở app cho xưởng khác, bạn phải hỏi luật sư hoặc Cục A05 (Bộ Công an).*

Để nhiều người dùng chung app mà dữ liệu không lẫn, cần ba lớp. **Lớp thứ nhất là kiểm tra quyền trên máy chủ.** Mỗi bản ghi phải mang thông tin "thuộc xưởng nào, ai tạo, ai phụ trách", và máy chủ kiểm tra quyền ở mọi lần đọc và ghi. Chỉ ẩn dữ liệu trên màn hình iPad thì không bảo vệ được gì. **Lớp thứ hai là bỏ cách lưu "mỗi đơn là một khối JSON ghi đè cả khối".** Hãy tách phiếu thu, phát sinh, ghi chú và ảnh thành các bản ghi chỉ được thêm, không được sửa. Số đơn và số phiếu thì do máy chủ cấp. Nếu không làm vậy, chỉ cần người thứ hai dùng app là sẽ có lúc mất tiền đã ghi. **Lớp thứ ba là mở theo hai giai đoạn.** Giai đoạn 1 chỉ có nhân viên Hùng Loan, chạy trên Firebase (vùng Singapore) và bản PWA (app cài lên màn hình iPad), chia 4 vai trò, chi phí 0 đồng. Ở giai đoạn này bạn là bên kiểm soát dữ liệu của chính mình. Rủi ro pháp lý gần như không đổi so với hiện tại, vì dữ liệu khách vốn đã nằm trên máy chủ claude.ai ở nước ngoài. Giai đoạn 2 là cho xưởng khác dùng. Lúc đó **đừng giữ dữ liệu của xưởng khác trên hệ thống của bạn**, vì Nghị định 356/2025 xếp việc "cung cấp và vận hành hệ thống, phần mềm" xử lý dữ liệu thay cho người khác vào nhóm dịch vụ xử lý dữ liệu cá nhân. Nhóm này cần giấy chứng nhận của Bộ Công an và tối thiểu 3 nhân sự đủ năng lực ([Kế toán An Phá](https://ketoananpha.vn/nghi-dinh-356-2025-nd-cp); [Kinh tế Sài Gòn](https://tuoitre.vn/saigontimes/khi-dich-vu-xu-ly-du-lieu-ca-nhan-tro-thanh-nganh-nghe-kinh-doanh-co-dieu-kien-1061208470.htm)). Cách an toàn để thử là cho 1–3 xưởng quen dùng miễn phí, mỗi xưởng tự sở hữu kho dữ liệu riêng, trong lúc bạn hỏi luật sư. Chỉ khi luật sư xác nhận và bạn đã lập công ty thì mới nên làm dịch vụ giữ dữ liệu cho mọi xưởng.

## Sửa lỗi "ghi đè" trước khi thêm người thứ hai

Hiện mỗi đơn là một tài liệu JSON. Ai lưu sau thì bản của người đó đè lên toàn bộ. Khi chỉ có mình bạn dùng thì không sao. Khi có hai người thì sẽ mất dữ liệu. Ví dụ sale đang sửa báo giá ở công trình (offline), còn bạn ở xưởng ghi một phiếu thu 20 triệu. Khi iPad của sale có mạng lại, bản của sale đè lên và **phiếu thu biến mất**. Firebase cũng ghi rõ cơ chế mặc định của họ: "for multiple changes to the same document, it's last write wins", tức là ai ghi sau người đó thắng ([Firebase](https://firebase.google.com/docs/firestore/manage-data/enable-offline?hl=en)). Vì vậy chuyển sang máy chủ nào cũng không tự hết lỗi này. Phải sửa cách lưu dữ liệu.

Cách sửa rẻ nhất là ngừng dùng chung một khối dữ liệu mà ai cũng sửa được. Phần lớn dữ liệu chuyển thành **bản ghi chỉ thêm** (append-only, nghĩa là chỉ thêm mới, không sửa, không xóa). Hai người thêm hai bản ghi khác nhau thì không bao giờ đè nhau. Chỉ phần báo giá nháp còn được sửa, và phần này có **số phiên bản**. Mỗi lần ghi, máy gửi kèm số phiên bản mà nó đã dựa vào. Nếu máy chủ đã có bản mới hơn thì máy chủ từ chối và báo cho người dùng, thay vì âm thầm ghi đè. Web đã có chuẩn cho cách này: máy chủ trả lỗi 412 khi bản gốc đã đổi ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-Match)). Số phiên bản phải do máy chủ đếm, vì dựa vào giờ trên máy thì có thể sai, mỗi máy lệch giờ một chút ([PowerSync](https://docs.powersync.com/handling-writes/custom-conflict-resolution)).

| Loại dữ liệu | Cách lưu mới | Khi hai người cùng thao tác |
|---|---|---|
| Đầu đơn (khách, trạng thái, người phụ trách) | Một bản ghi, có số phiên bản. Trạng thái chỉ được đi tới | Máy chủ từ chối bản cũ. App hiện "Lan đã sửa lúc 10:40", rồi cho chọn giữ bản nào |
| Báo giá nháp | Như trên, kèm dòng "Đang được sửa bởi Lan trên iPad 2" | Bên thua được lưu thành một bản nháp phụ, không bị xóa |
| Báo giá đã chốt | Bản chụp đóng băng, chỉ thêm | Không thể trùng |
| Phiếu thu, thanh toán | Chỉ thêm. Ghi sai thì "Hủy phiếu" kèm lý do rồi lập phiếu mới. Tổng đã thu luôn được tính lại từ các phiếu | Không bao giờ mất phiếu |
| Phát sinh | Chỉ thêm. Trạng thái nháp → duyệt hoặc từ chối | Không trùng |
| Ghi chú, nhật ký, ảnh | Chỉ thêm. Ảnh xóa mềm (ẩn đi, vẫn giữ trong kho) | Không trùng |

Lời báo "đang được sửa bởi…" chỉ để nhắc. Hai iPad cùng offline thì không thấy nhau, nên **việc kiểm tra số phiên bản trên máy chủ mới là chốt chặn thật**. Trên thực tế, xung đột ít hơn người ta tưởng, vì người dùng thường tránh sửa thứ người khác đang sửa ([Morning Paper / Ink & Switch](https://blog.acolyer.org/2019/11/20/local-first-software/)). Đội ElectricSQL cũng nói các cách làm "thô" như trên là "perfectly serviceable", tức là đủ dùng tốt cho nhiều app ([Electric](https://electric.ax/docs/guides/writes)). Bạn **không cần** công nghệ CRDT (cách tự trộn mọi thay đổi như Google Docs). Nó dành cho soạn thảo văn bản chung, với app báo giá thì quá nặng.

**Số đơn và số phiếu không được do iPad tự đặt.** Hai máy cùng offline sẽ cùng tạo "BG2610-05". Phần mềm bán hàng Lightspeed từng bị trùng số hóa đơn đúng như vậy, và cách họ sửa là gán cho mỗi máy một tiền tố riêng ([Lightspeed](https://x-series-support.lightspeedhq.com/hc/en-us/articles/25534282970779-Why-do-I-have-duplicate-invoice-numbers)). Cách làm cho Sổ Nội Thất như sau:

- Mỗi bản ghi có một mã nội bộ ULID do máy tự tạo. ULID là chuỗi 26 ký tự, gồm thời gian cộng phần ngẫu nhiên, nên thực tế không trùng ([ULID spec](https://github.com/ulid/spec)).
- Khi chưa có mạng, đơn hiện "Chờ cấp số".
- Khi có mạng, máy chủ cấp số chính thức BG2610-01, BG2610-02… theo thứ tự.
- Riêng phiếu thu phải in ngay tại công trình khi offline thì dùng tiền tố theo máy, ví dụ `PT2610-A01` cho iPad A. Không đổi số của phiếu khách đã cầm.

## Giai đoạn 1: nhân viên Hùng Loan dùng chung, chi phí 0 đồng

Ở giai đoạn này, dữ liệu là của Hùng Loan và bạn quyết định mọi việc. Theo Luật 91/2025, bạn là **bên kiểm soát và xử lý** dữ liệu, tức là vừa quyết định mục đích dùng dữ liệu vừa tự xử lý nó ([Thư viện Pháp luật](https://thuvienphapluat.vn/van-ban/Bo-may-hanh-chinh/Law-91-2025-QH15-Personal-Data-Protection-665440.aspx)). Thêm nhân viên không làm bạn thành "dịch vụ" cho ai. Còn một câu hỏi pháp lý từ trước vẫn để ngỏ. Luật coi việc dùng nền tảng ở nước ngoài để xử lý dữ liệu thu thập tại Việt Nam là chuyển dữ liệu xuyên biên giới (Điều 20). Việc này cần nộp hồ sơ trong 60 ngày ([hethongphapluat](https://hethongphapluat.com/luat-bao-ve-du-lieu-ca-nhan-2025/dieu-20)). Điều 38 miễn cho hộ kinh doanh nhiều nghĩa vụ, nhưng **không nhắc Điều 20** ([hethongphapluat](https://hethongphapluat.com/luat-bao-ve-du-lieu-ca-nhan-2025/dieu-38)). Trong khi đó Vietnam Briefing lại hiểu là hộ kinh doanh được miễn đánh giá tác động nói chung ([Vietnam Briefing](https://www.vietnam-briefing.com/news/vietnam-personal-data-protection-regulation-decree-356.html)). Câu hỏi này đã tồn tại từ khi dữ liệu nằm trên claude.ai. Chuyển sang Firebase ở Singapore không làm nó tệ hơn. Riêng dữ liệu **nhân viên của bạn** lưu trên cloud thì được miễn hồ sơ theo Điều 20 khoản 6 ([hethongphapluat](https://hethongphapluat.com/luat-bao-ve-du-lieu-ca-nhan-2025/dieu-20)). Dữ liệu khách thì không được miễn.

### Chọn Firebase thay vì giữ artifact

| Tiêu chí | Chia sẻ artifact (đang có) | **Firebase + PWA (khuyên dùng)** | Supabase + PWA |
|---|---|---|---|
| Chi phí | 0đ | 0đ (gói miễn phí: 1 GiB, 50.000 lượt đọc và 20.000 lượt ghi mỗi ngày) | 0đ, nhưng tự tạm dừng sau 1 tuần không ai dùng. Gói Pro 25 USD/tháng |
| Dùng offline ở công trình | Không. Artifact chặn gọi ra máy chủ ngoài | Có sẵn, chỉ cần bật | Không có sẵn, Claude phải tự viết |
| Giấu giá với thợ, sale chỉ thấy khách mình | Chỉ chia quyền theo mức chia sẻ (xem / tương tác / quản trị). Chưa chắc chia được tới từng đơn | Được, nhờ luật bảo mật trên máy chủ | Được, nhờ RLS (luật lọc từng dòng dữ liệu) |
| Nhân viên đăng nhập | Mỗi người cần một tài khoản claude.ai | Google hoặc email, miễn phí | Google hoặc email, miễn phí |
| Điểm yếu | Không mở rộng được | Ảnh cần gói trả theo dùng (phải gắn thẻ). Khó chuyển sang nhà cung cấp khác | Phải tự viết phần đồng bộ, dễ sinh lỗi |

Nguồn: [Firebase Pricing](https://firebase.google.com/pricing); [Firebase offline](https://firebase.google.com/docs/firestore/manage-data/enable-offline); [Supabase Pricing](https://supabase.com/pricing); [Supabase pausing](https://supabase.com/docs/guides/platform/free-project-pausing); [Pluto Security](https://pluto.security/blog/inside-claude-artifacts-how-your-agent-publishes-to-the-web/).

Firebase thắng vì nó **có sẵn chế độ offline** cho app web viết bằng JavaScript thuần như app của bạn ([Firebase](https://firebase.google.com/docs/firestore/manage-data/enable-offline)). Code đồng bộ Claude phải tự viết càng ít thì càng ít chỗ hỏng. Artifact chặn mọi kết nối ra ngoài (`connect-src 'self'`) ([Pluto Security](https://pluto.security/blog/inside-claude-artifacts-how-your-agent-publishes-to-the-web/)). Vì vậy bản nhiều người dùng phải chạy trên bản PWA ở GitHub Pages. Bản PWA sẽ thành bản chính, artifact chỉ giữ làm bản phụ. Nên gom về một bản chính, vì nuôi hai đường lưu dữ liệu song song sẽ sinh lỗi. Có một điểm cần nhớ: **luật bảo mật của Firebase chặn theo cả tài liệu, không chặn theo từng ô**. Muốn thợ không thấy giá thì giá phải nằm ở tài liệu riêng. Thợ chỉ đọc "phiếu công việc", là bản đã bỏ hết giá. Supabase cũng vậy: RLS chỉ lọc theo dòng, không lọc theo cột ([Makerkit](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)). Nếu sau này bạn cần báo cáo SQL mạnh hơn và chấp nhận tự viết phần đồng bộ thì Supabase vẫn là lựa chọn dự phòng hợp lý.

### Bốn vai trò mặc định

Các phần mềm cùng ngành như ServiceM8, Buildertrend và Jobber đều dùng cùng một khuôn: một số vai trò có sẵn, rồi ba câu hỏi. Người này thấy dữ liệu của ai? Có thấy giá vốn và lãi không? Được làm thao tác gì? ([ServiceM8](https://support.servicem8.com/help-center/advanced-setup/advanced-setup/security-roles-overview.md); [Buildertrend](https://buildertrend.com/help-article/internal-users-overview/); [Jobber](https://help.getjobber.com/es/articles/user-permissions/)). Bảng dưới đây là đề xuất của người viết, dựng theo khuôn đó:

| Chức năng | Chủ | Kế toán / Quản lý | Sale / Thiết kế | Thợ |
|---|---|---|---|---|
| Danh sách khách | Tất cả | Xem tất cả | Chỉ khách mình phụ trách | Chỉ tên và địa chỉ của việc được giao |
| Tạo và sửa báo giá | Có | Chỉ xem | Báo giá của mình | Không |
| Giá vốn, lãi | Có | Có (chủ tắt được) | Không | Không |
| Giảm giá quá ngưỡng (ví dụ 5%) | Duyệt | Chủ cho phép thì được | Gửi xin duyệt | Không |
| Chốt đơn | Có | Không | Đơn của mình | Không |
| Lập phiếu thu | Có | Có | Phiếu "chờ xác nhận" | Chỉ báo "đã thu tiền mặt" với số tiền chủ ghi sẵn |
| Xác nhận hoặc hủy phiếu thu | Có | Có | Không | Không |
| Hủy đơn (có lý do) | Có | Không | Gửi yêu cầu | Không |
| Xóa vĩnh viễn | Không ai | Không ai | Không ai | Không ai |
| Ảnh, biên bản bàn giao | Có | Xem | Đơn của mình | Việc được giao |
| Sửa danh mục giá | Có | Xem | Chỉ chọn hàng, không thêm và không sửa | Không |
| Xuất Excel khách, danh mục, doanh thu | Có | Chủ cho phép thì được | Không | Không |
| Số tài khoản ngân hàng, cài đặt, quản lý nhân viên | Chỉ chủ | Không | Không | Không |
| Nhật ký thay đổi | Xem tất cả | Xem phần tiền | Không | Không |

Ý kiến thẳng về cách làm:

- **Mọi ô trong bảng phải được kiểm trên máy chủ.** OWASP (tổ chức chuẩn bảo mật web) viết rõ: "Access control checks must be performed server-side", nghĩa là kiểm tra quyền phải làm trên máy chủ ([OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)). Nếu iPad chỉ ẩn dòng giá, một người biết chút kỹ thuật vẫn đọc được toàn bộ.
- **Đừng làm bảng quyền tùy chỉnh cho từng người.** Với 1–10 người, như vậy là làm quá. Buildertrend cố ý không cho chỉnh quyền riêng từng người ([Buildertrend](https://buildertrend.com/help-article/internal-users-overview/)). 4 vai trò cộng 3–4 công tắc là đủ.
- **Phần mềm không ngăn được một sale mang theo khách họ đã gặp mặt.** Nó chỉ chặn được việc lấy cả danh sách hay cả bảng giá. Phần còn lại cần hợp đồng, cam kết bảo mật và cách chia hoa hồng.
- **Thợ chưa cần tài khoản ở giai đoạn 1.** Gửi cho thợ phiếu công việc PDF không có giá qua Zalo là đủ, và bớt hẳn một vai trò phải kiểm thử.

**Đăng nhập** nên dùng Google (miễn phí, một chạm), và dự phòng bằng **mã 6 số gửi qua email**. Không nên dùng SMS, vì tốn 0,12 USD mỗi tin gửi về Việt Nam và Firebase chỉ cho dùng ở gói trả phí ([Google Identity Platform](https://cloud.google.com/identity-platform/pricing)). Không dùng link đăng nhập gửi qua email (magic link), vì app trên màn hình chính tách bộ nhớ khỏi Safari, nên link thường mở nhầm sang Safari ([WebKit Bug 181849](https://bugs.webkit.org/show_bug.cgi?id=181849)). Nhân viên vào xưởng bằng **mã mời dùng một lần, có hạn**, do chủ tạo. Nhân viên không bao giờ tự ghi mình vào danh sách thành viên. Khi nhân viên nghỉ việc: khóa tài khoản (không xóa), đăng xuất khỏi mọi máy, rồi chuyển khách đang theo sang người khác, có ghi nhật ký. Không dùng chung một tài khoản cho cả xưởng. Nếu nhiều người dùng chung một iPad thì cần nút "Đăng xuất và xóa dữ liệu trên máy", vì bộ nhớ offline của Firebase không tự xóa giữa các lần đăng nhập ([Firebase](https://firebase.google.com/docs/firestore/manage-data/enable-offline)).

## Giai đoạn 2: ba cách mở cho xưởng khác, chỉ một cách nên thử ngay

Đây là chỗ hai hướng nghiên cứu mâu thuẫn nhau. Về kỹ thuật, cách rẻ và dễ nhất là một hệ thống chung: mọi xưởng nằm trong một Firebase hoặc Supabase, mỗi bản ghi gắn mã xưởng (`workshop_id`). Về pháp lý, đó lại là cách rủi ro nhất cho bạn. Khi xưởng khác nhập dữ liệu khách của họ vào hệ thống bạn vận hành, xưởng đó là bên kiểm soát và **bạn thành bên xử lý**. Bạn phải có hợp đồng xử lý dữ liệu với từng xưởng ([Thư viện Pháp luật](https://thuvienphapluat.vn/van-ban/Bo-may-hanh-chinh/Law-91-2025-QH15-Personal-Data-Protection-665440.aspx)). Rủi ro nặng hơn là mô hình này rất giống nhóm 1 của Điều 21 Nghị định 356. Nếu bị xếp vào nhóm đó, bạn **mất miễn trừ dành cho hộ kinh doanh** (Điều 38). Bạn còn có thể phải có giấy chứng nhận do Bộ Công an cấp, với điều kiện là tổ chức thành lập theo luật Việt Nam và có tối thiểu 3 nhân sự đủ năng lực ([Kinh tế Sài Gòn](https://tuoitre.vn/saigontimes/khi-dich-vu-xu-ly-du-lieu-ca-nhan-tro-thanh-nganh-nghe-kinh-doanh-co-dieu-kien-1061208470.htm)). Luật sư Nguyễn Trà My (HM&P) lưu ý rằng Nghị định không định nghĩa thế nào là "kinh doanh dịch vụ xử lý", nên còn tùy mô hình thực tế. Đó là lý do phải hỏi trước. Thêm nữa, Luật An ninh mạng 2025, Điều 25, buộc doanh nghiệp cung cấp "dịch vụ gia tăng trên không gian mạng" phải lưu dữ liệu người dùng tại Việt Nam ([Thư viện Pháp luật](https://thuvienphapluat.vn/van-ban/EN/Cong-nghe-thong-tin/Law-116-2025-QH15-Cybersecurity/688491/tieng-anh.aspx)). Nghị định hướng dẫn phạm vi chưa xác minh được. Hộ kinh doanh có thuộc diện "doanh nghiệp" ở điều này hay không cũng chưa rõ.

| | A. Bạn giữ dữ liệu mọi xưởng | **B. Mỗi xưởng tự sở hữu dữ liệu** | C. Máy chủ tại Việt Nam do bạn chạy |
|---|---|---|---|
| Cách tách dữ liệu | Một kho chung, mỗi bản ghi có mã xưởng, luật bảo mật lọc theo mã | Mỗi xưởng một Firebase project đứng tên tài khoản Google của chính họ. Xưởng một người có thể dùng ngay bản PWA, dữ liệu chỉ nằm trên iPad của họ | Như A, nhưng chạy trên máy chủ thuê ở Viettel IDC, FPT, VNPT… |
| Vai trò của bạn | Bên xử lý, có thể bị coi là "dịch vụ xử lý" | Nhà cung cấp phần mềm (theo suy luận, chưa có nguồn xác nhận) | Như A |
| Lưu tại Việt Nam, chuyển ra nước ngoài | Phải làm hồ sơ chuyển ra nước ngoài. Có thể vướng Điều 25 | Nghĩa vụ thuộc về từng xưởng | Giải quyết được hai điểm này |
| Rò dữ liệu giữa các xưởng | Chỉ cần một lỗi luật bảo mật là lộ | Gần như không thể, vì các kho tách hẳn nhau | Như A |
| Chi phí cho bạn | 0đ lúc đầu, khoảng 25–35 USD/tháng khi có 200 xưởng | 0đ (mỗi project dùng gói miễn phí riêng) | Thuê máy chủ và tự vận hành (giá chưa nghiên cứu) |
| Việc vận hành | Ít | Cài đặt từng xưởng. Cập nhật luật bảo mật cho từng project | Nặng nhất: tự sao lưu, vá lỗi. PocketBase chưa ra bản 1.0 |
| Cần luật sư trước khi mở? | **Bắt buộc, kèm lập công ty** | **Nên hỏi.** Có thể thử với 1–3 xưởng quen, không thu phí | **Bắt buộc, kèm lập công ty** |

Nguồn: [Supabase Pricing](https://supabase.com/pricing); [AWS](https://docs.aws.amazon.com/whitepapers/latest/saas-tenant-isolation-strategies/implementing-pool-isolation.html); [PocketBase](https://pocketbase.io/docs/).

**Khuyên dùng B cho giai đoạn thử.** Cách này vừa an toàn hơn về pháp lý vừa an toàn hơn về kỹ thuật. Theo AWS, ở mô hình kho chung, chính app phải tự lọc dữ liệu theo xưởng. Còn kho tách riêng được bảo vệ bằng chính ranh giới hạ tầng ([AWS](https://docs.aws.amazon.com/whitepapers/latest/saas-tenant-isolation-strategies/implementing-pool-isolation.html)). Mặt trái của B có hai điểm. Thứ nhất, mỗi xưởng tốn khoảng một buổi cài đặt. Thứ hai, mỗi lần sửa luật bảo mật phải cập nhật vào từng project, mà muốn cập nhật thì bạn cần quyền vào project của họ, và chính việc có quyền đó có thể khiến bạn lại thành bên xử lý. Vì vậy, câu đầu tiên hỏi luật sư là: "Nếu tôi chỉ cung cấp phần mềm và giúp cài đặt, nhưng không giữ quyền truy cập dữ liệu, tôi có phải bên xử lý không?" Đừng thu phí của xưởng khác trước khi có câu trả lời. Thu phí phần mềm còn kéo theo việc đăng ký thêm ngành nghề và tách doanh thu khi khai thuế.

Dù chọn cách nào, cũng **không cho app lưu ảnh CCCD hay số tài khoản ngân hàng của khách**. Đây là dữ liệu nhạy cảm theo Điều 4 Nghị định 356, và lưu chúng có thể làm mất miễn trừ. Tên, số điện thoại, địa chỉ, ảnh và chữ ký của khách là dữ liệu cơ bản ([Kế toán An Phá](https://ketoananpha.vn/nghi-dinh-356-2025-nd-cp)).

## Kiểm tra "xưởng A không thấy xưởng B" trước khi mở cửa

Năm 2025, người ta quét các app do AI viết trên nền Lovable và tìm thấy **303 điểm truy cập trong 170 dự án** để hở luật bảo mật. Kẻ xấu chỉ cần khóa công khai có sẵn trong app là đọc được email, số điện thoại, công nợ và địa chỉ nhà ([Superblocks](https://www.superblocks.com/blog/lovable-vulnerabilities)). Công cụ kiểm tra của Lovable khi đó chỉ xem luật bảo mật có tồn tại không, chứ không thử xem nó có chặn được không. Bài học cho bạn: phải thử tấn công thật vào chính app của mình.

| Thử nghiệm | Làm bằng | Kết quả phải thấy |
|---|---|---|
| Giữa hai xưởng | Tạo xưởng A và B với dữ liệu giả. Đăng nhập nhân viên A, thử liệt kê, mở theo mã, sửa, xóa đơn của B, và mở ảnh của B | Trống hoặc bị từ chối, mọi lần |
| Chưa đăng nhập | Chỉ dùng cấu hình công khai trong app | Không đọc được gì |
| Trong một xưởng | Sale mở đơn của sale khác theo mã. Thợ đọc tài liệu giá. Sale sửa hoặc hủy phiếu thu. Nhân viên đã bị khóa thử đăng nhập lại | Bị từ chối |
| Tự thêm quyền | Nhân viên tự ghi mình thành "Chủ" hoặc tự thêm mình vào xưởng khác | Bị từ chối |
| Offline | Hai iPad cùng sửa một báo giá khi offline, cùng ghi phiếu thu, rồi bật mạng | Không mất phiếu. Hiện hộp thoại chọn bản. Không có số đơn trùng |

Lưu ý khi kiểm tra: khi bị chặn đọc, máy chủ thường trả **danh sách rỗng chứ không báo lỗi**. Vì vậy phải kiểm tra rằng kết quả rỗng, đừng chờ thông báo lỗi ([Makerkit](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)). Claude sẽ viết các thử nghiệm trên thành bộ test tự động và chạy lại sau mỗi lần sửa. Bạn nên thêm ba quy tắc cố định vào master prompt của mình: không bao giờ đưa khóa quản trị (service key) vào code app; mỗi bảng hoặc nhóm dữ liệu mới phải có luật bảo mật ngay trong cùng lần sửa; chạy lại bộ test trước khi phát hành. Lỗi dễ gặp nhất khi AI viết code là một lần "sửa nhanh" gắn khóa quản trị vào app cho hết báo lỗi ([Makerkit](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)).

## Lộ trình, chi phí và rủi ro

| Bước | Ai làm | Việc | Xong khi |
|---|---|---|---|
| 1 | Claude | Tách dữ liệu đơn thành các bản ghi chỉ thêm. Thêm mã ULID, người tạo, máy tạo, nhật ký thay đổi. Phiếu thu hủy kèm lý do. Làm ngay trên bản hiện tại | Hai máy cùng ghi phiếu thu mà không mất phiếu nào |
| 2 | Bạn | Tạo một tài khoản Google riêng cho xưởng và bật xác minh 2 bước. Tạo Firebase project ở vùng Singapore (Claude hướng dẫn từng màn hình). Chốt ai giữ vai trò nào | Có project, có danh sách Gmail nhân viên |
| 3 | Claude | Nối bản PWA với Firebase: đăng nhập Google và mã email, bật offline, cấu trúc dữ liệu `workshops/hungloan/…`, luật bảo mật cho 4 vai trò, mã mời, cấp số đơn khi có mạng. Viết công cụ nhập file sao lưu JSON cũ | Dữ liệu cũ đã nằm trên Firebase |
| 4 | Claude | Viết bộ test ở phần trên, có cả xưởng giả A và B ngay từ đầu | Mọi test đều đạt |
| 5 | Bạn | Dùng thử 2 tuần với 2 iPad (bạn và một nhân viên). Cố tình làm các tình huống offline ở trên | Không mất dữ liệu |
| 6 | Bạn | Hỏi luật sư 3 câu: hộ kinh doanh dùng cloud nước ngoài có phải nộp hồ sơ Điều 20 không; làm theo cách B thì bạn có phải bên xử lý không; làm theo cách A hoặc C thì có cần giấy chứng nhận và có vướng Điều 25 không. Viết quy định bảo mật và hoa hồng cho nhân viên | Có câu trả lời bằng văn bản |
| 7 | Claude | Thêm vai trò thợ (phiếu công việc không giá), duyệt giảm giá, khóa nhân viên và chuyển người phụ trách | Test vai trò đạt |
| 8 | Bạn và Claude | Giai đoạn 2: thử cách B với 1–3 xưởng quen, miễn phí. Điều khoản sử dụng do luật sư xem | Xưởng tự quản dữ liệu của họ |
| 9 | Bạn | Chỉ chuyển sang A hoặc C khi luật sư đồng ý và bạn đã có công ty | — |

| Khoản | Chi phí ước tính |
|---|---|
| Giai đoạn 1 trên Firebase (5 người) | 0 USD. Gói miễn phí dư sức với dữ liệu khoảng 1–3 MB mỗi năm |
| Lưu ảnh trên Firebase | Phải lên gói trả theo dùng và gắn thẻ. Phần miễn phí chỉ có ở các vùng tại Mỹ. Nên nén ảnh nhỏ và đặt cảnh báo ngân sách ([Firebase Pricing](https://firebase.google.com/pricing)) |
| Đăng nhập Google hoặc email | 0 USD. SMS tốn 0,12 USD/tin, nên tránh |
| Giai đoạn 2, cách B | 0 USD cho bạn. 0 USD cho mỗi xưởng |
| Cách A khi có khoảng 200 xưởng | Khoảng 25–35 USD/tháng nếu dùng Supabase Pro. Firestore có thể chỉ vài USD nếu code đọc dữ liệu tiết kiệm ([Supabase Pricing](https://supabase.com/pricing)) |
| Luật sư, giấy chứng nhận, 3 nhân sự (A hoặc C) | Chưa nghiên cứu. Đây mới là khoản lớn nhất |

Các ước tính trên giả định mỗi đơn khoảng 10 KB và mỗi xưởng 100–300 đơn mỗi năm. Đây không phải báo giá.

| Rủi ro chính | Cách giảm |
|---|---|
| Lỗi luật bảo mật làm lộ dữ liệu khách | Dùng cách B. Có bộ test tự động. Không đưa khóa quản trị vào app |
| Mất phiếu thu do ghi đè | Bước 1 phải xong trước khi thêm người thứ hai |
| Thay đổi chưa đồng bộ bị iPad xóa | Dùng app trên màn hình chính, vì loại app này được giữ dữ liệu lâu hơn Safari ([WebKit](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)). Hiện "Chưa đồng bộ N thay đổi" |
| Pháp lý khi giữ dữ liệu của xưởng khác | Không giữ trước khi có ý kiến luật sư. Có sự cố thì phải báo trong 72 giờ. Mức phạt tối đa 3 tỷ đồng hoặc 5% doanh thu ([Thư viện Pháp luật](https://thuvienphapluat.vn/van-ban/Bo-may-hanh-chinh/Law-91-2025-QH15-Personal-Data-Protection-665440.aspx)) |
| Phụ thuộc một nhà cung cấp | Giữ nút xuất JSON và sao lưu hằng tuần |
| Bạn là người vận hành duy nhất | Chọn dịch vụ có người quản lý sẵn (Firebase), không tự chạy máy chủ |

## Kết luận

Ranh giới pháp lý và ranh giới kỹ thuật ở đây trùng nhau. Cách tách dữ liệu an toàn nhất về kỹ thuật là mỗi xưởng một kho riêng. Đó cũng là cách giữ bạn ở vai trò "người làm phần mềm" thay vì "người giữ dữ liệu cho người khác". Nghĩa là sản phẩm hợp lý cho xưởng khác lúc này là **phần mềm kèm hướng dẫn cài đặt**, chưa phải dịch vụ cloud. Mô hình kho chung thì phải đợi một quyết định kinh doanh lớn hơn: lập công ty, có nhân sự, có giấy phép.

Phần tốn công nhất cũng là phần có lợi ngay cả khi bạn không bao giờ thêm người: tách đơn thành các bản ghi chỉ thêm, có tên người làm và giờ máy chủ. Chính nhật ký đó giúp chữ ký và phiếu thu của bạn có giá trị chứng cứ cao hơn khi có tranh chấp, và cũng là nhật ký mà luật dữ liệu mong bạn có. Hãy làm bước 1 trước, rồi mới thêm người thứ hai.

## Nguồn

- Firebase – Access data offline: https://firebase.google.com/docs/firestore/manage-data/enable-offline
- Firebase Pricing: https://firebase.google.com/pricing
- Google Cloud Identity Platform pricing: https://cloud.google.com/identity-platform/pricing
- Supabase Pricing: https://supabase.com/pricing
- Supabase – Project pausing: https://supabase.com/docs/guides/platform/free-project-pausing
- Makerkit – Supabase RLS Best Practices: https://makerkit.dev/blog/tutorials/supabase-rls-best-practices
- Superblocks – Lovable vulnerabilities (CVE-2025-48757): https://www.superblocks.com/blog/lovable-vulnerabilities
- AWS – Implementing pool isolation: https://docs.aws.amazon.com/whitepapers/latest/saas-tenant-isolation-strategies/implementing-pool-isolation.html
- PocketBase Docs: https://pocketbase.io/docs/
- Pluto Security – Inside Claude Artifacts: https://pluto.security/blog/inside-claude-artifacts-how-your-agent-publishes-to-the-web/
- MDN – If-Match: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-Match
- PowerSync – Custom conflict resolution: https://docs.powersync.com/handling-writes/custom-conflict-resolution
- Electric – Writes guide: https://electric.ax/docs/guides/writes
- Morning Paper – Local-first software (Ink & Switch): https://blog.acolyer.org/2019/11/20/local-first-software/
- ULID spec: https://github.com/ulid/spec
- Lightspeed – Duplicate invoice numbers: https://x-series-support.lightspeedhq.com/hc/en-us/articles/25534282970779-Why-do-I-have-duplicate-invoice-numbers
- WebKit Bug 181849: https://bugs.webkit.org/show_bug.cgi?id=181849
- WebKit – Full third-party cookie blocking and more: https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- ServiceM8 – Security Roles Overview: https://support.servicem8.com/help-center/advanced-setup/advanced-setup/security-roles-overview.md
- Buildertrend – Internal Users Overview: https://buildertrend.com/help-article/internal-users-overview/
- Jobber Help – User permissions: https://help.getjobber.com/es/articles/user-permissions/
- OWASP – Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- Luật 91/2025/QH15 (Thư viện Pháp luật): https://thuvienphapluat.vn/van-ban/Bo-may-hanh-chinh/Law-91-2025-QH15-Personal-Data-Protection-665440.aspx
- Luật 91/2025, Điều 20: https://hethongphapluat.com/luat-bao-ve-du-lieu-ca-nhan-2025/dieu-20
- Luật 91/2025, Điều 38: https://hethongphapluat.com/luat-bao-ve-du-lieu-ca-nhan-2025/dieu-38
- Nghị định 356/2025 (Kế toán An Phá, bản không đầy đủ): https://ketoananpha.vn/nghi-dinh-356-2025-nd-cp
- Kinh tế Sài Gòn – Dịch vụ xử lý dữ liệu cá nhân là ngành nghề có điều kiện: https://tuoitre.vn/saigontimes/khi-dich-vu-xu-ly-du-lieu-ca-nhan-tro-thanh-nganh-nghe-kinh-doanh-co-dieu-kien-1061208470.htm
- Vietnam Briefing – Decree 356: https://www.vietnam-briefing.com/news/vietnam-personal-data-protection-regulation-decree-356.html
- Luật An ninh mạng 116/2025/QH15 (Thư viện Pháp luật): https://thuvienphapluat.vn/van-ban/EN/Cong-nghe-thong-tin/Law-116-2025-QH15-Cybersecurity/688491/tieng-anh.aspx
