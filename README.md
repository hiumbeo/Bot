# 🎵 Discord Anime Music & Server Management Bot (24/7 + Web Dashboard)

Bot Discord đa năng chuyên **Phát Nhạc Chất Lượng Cao (SoX 28-bit Chống Rè)**, **Bảng Điều Khiển Tương Tác Kèm Anime GIF**, **Cài Đặt Welcome/Goodbye Trực Tiếp Trong Discord (`.setup`)**, và **Bảo Vệ Chống Raid / Quản Lý Server Toàn Diện** đi kèm **Giao Diện Web Dashboard Thời Gian Thực**.

🔗 **GitHub Repository:** [https://github.com/hiumbeo/Bot](https://github.com/hiumbeo/Bot)

---

## ✨ Tính Năng Nổi Bật

- 🎧 **Âm Thanh Studio Chống Rè (SoX 28-bit DSP + 16MB RAM Buffer)**:
  - Hỗ trợ tìm kiếm và phát nhạc từ **YouTube, Spotify, SoundCloud**.
  - Tích hợp 8 bộ lọc âm thanh (EQ) chuyển đổi 0ms: `Crystal Clear`, `Bass Boost`, `Nightcore`, `Lo-Fi Warm`, `8D Surround`, `Vaporwave`, `Karaoke Cut`, `Treble Clarity`.
  - Hỗ trợ **Autoplay** tự phát nhạc liên quan khi hết hàng chờ, **Treo 24/7** trong phòng thoại, tua nhạc (`.seek`), và tìm lời bài hát (`.lyrics`).
- 🎬 **Music Panel & Hệ Thống Anime GIF Tự Động**:
  - Bảng điều khiển nhạc có nút bấm trực tiếp trên Discord (`Play/Pause`, `Skip`, `Loop`, `EQ`, `Autoplay`, `Shuffle`, `Volume`, `Đổi GIF`).
  - Tự động xoay vòng kho **10+ Anime GIFs** và lấy thêm GIF trực tiếp từ Web API (`api.otakugifs.xyz` & `Giphy`).
- 👋 **Setup Kênh Welcome / Goodbye / Auto-Role Ngay Trong Discord (`.setup` / `/setup`)**:
  - Không cần mở Web để chỉnh: gõ `.setup` hoặc `/setup` ngay trong kênh chat để chọn **Kênh Welcome**, **Kênh Goodbye**, và **Auto-Role** bằng menu thả xuống (Select Menu).
  - Tự động lấy GIF từ Web theo từ khoá (`anime hi` khi có người vào, `anime bye` khi có người rời đi) và **gửi thẳng ra ngoài (không nhốt trong khung Embed)** để GIF hiển thị tràn viền.
- 🛡️ **Quản Lý Server & Bảo Mật Anti-Raid**:
  - Tự động phát hiện Raid (vào ồ ạt), tự động xoá link mời Discord lạ (`discord.gg/...`), khoá Server khẩn cấp (`.lockdown`).
  - Đầy đủ lệnh quản trị: `.mute`, `.unmute`, `.kick`, `.ban`, `.warn`, `.clear`, `.lock`, `.unlock`, `.slowmode`, `.nuke`, `.giveaway`, `.poll`, `.afk`.
- 🧹 **Tự Động Xoá Sạch Lệnh `/` Cũ Bị Kẹt**:
  - Nút bấm 1 chạm trên Web Dashboard để xoá sạch toàn bộ Slash Commands cũ và cài đặt bộ 28 lệnh `/` + `.` mới nhất.

---

## 🚀 Hướng Dẫn Cài Đặt Nhanh (`git clone`)

### 1. Yêu Cầu Hệ Thống
- [Node.js](https://nodejs.org/) phiên bản **20+** hoặc **22+**
- [Git](https://git-scm.com/)
- *(Đã tích hợp sẵn `ffmpeg-static` tự động nên không bắt buộc cài FFmpeg thủ công)*

### 2. Lệnh Tải & Chạy Bot (Copy & Paste)

```bash
# 1. Tải source code về máy
git clone https://github.com/hiumbeo/Bot.git
cd Bot

# 2. Cài đặt thư viện
npm install --legacy-peer-deps

# 3. Tạo file cấu hình .env (hoặc nhập Token trực tiếp trên giao diện Web)
cp .env.example .env

# 4. Khởi động Bot + Web Dashboard tại http://localhost:3000
npm run dev
```

- **Trên Windows**: Sau khi tải về, chỉ cần bấm đúp vào file **`start.bat`** là tự động cài thư viện và bật Bot!
- **Trên Linux / macOS**: Chạy `bash start.sh`

---

## ☁️ Hướng Dẫn Host 24/7 Miễn Phí Trên Render.com

1. Fork repo **[https://github.com/hiumbeo/Bot](https://github.com/hiumbeo/Bot)** về tài khoản GitHub của bạn.
2. Đăng nhập vào **[Render.com](https://render.com)** -> bấm **New +** -> chọn **Web Service** và kết nối với repo `Bot`.
3. Điền cấu hình như sau:
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     npm install --legacy-peer-deps && npm run build
     ```
   - **Start Command**:
     ```bash
     npx tsx server.ts
     ```
4. Kéo xuống mục **Environment Variables**, thêm:
   - `DISCORD_BOT_TOKEN` = `Token_Bot_Cua_Ban`
   - `DISCORD_CLIENT_ID` = `Application_ID_Cua_Bot`
   - `NODE_VERSION` = `22.14.0`
5. Bấm **Deploy Web Service**.
6. *(Tuỳ chọn giữ thức 24/7)*: Vào **[UptimeRobot.com](https://uptimerobot.com)**, tạo 1 monitor HTTP(s) ping vào địa chỉ `https://ten-app-cua-ban.onrender.com/api/bot/status` mỗi **5 phút** để bot online 24/7 không bao giờ ngủ!

---

## 🖥️ Hướng Dẫn Treo 24/7 Trên VPS Ubuntu / Debian (PM2)

```bash
git clone https://github.com/hiumbeo/Bot.git
cd Bot
npm install --legacy-peer-deps
npm install -g pm2
DISCORD_BOT_TOKEN="DAN_TOKEN_BOT_VAO_DAY" pm2 start "npx tsx server.ts" --name musicbot
pm2 save && pm2 startup
```

---

## 📋 Danh Sách Lệnh Đầy Đủ (Dùng được cả `.` và `/`)

> Gõ **`.help`** hoặc **`/help`** trong Discord để mở **Menu Chọn Danh Mục Lệnh** tương tác!

| Nhóm Lệnh | Các Lệnh Hỗ Trợ |
| :--- | :--- |
| **1. Phát Nhạc & EQ** | `.play <tên/link>`, `.pause`, `.resume`, `.skip`, `.stop`, `.queue`, `.loop`, `.filter`, `.seek <giây>`, `.lyrics`, `.autoplay`, `.247`, `.volume <0-150>`, `.shuffle`, `.panel`, `.gif [từ khoá]` |
| **2. Setup & Quản Lý Kênh** | `.setup` *(Chọn kênh Welcome/Goodbye/Role bằng menu ngay trong Discord)*, `.clear <1-100>`, `.lock`, `.unlock`, `.slowmode <giây>`, `.nuke` |
| **3. Bảo Mật & Kiểm Duyệt** | `.mute`, `.unmute`, `.kick`, `.ban`, `.warn`, `.warnings`, `.clearwarns`, `.antiraid`, `.lockdown` |
| **4. Sự Kiện & Tiện Ích** | `.giveaway <phút> <số_giải> <tên_quà>`, `.poll <câu hỏi> \| <lựa chọn 1> \| <lựa chọn 2>`, `.announce <nội dung>`, `.role`, `.afk [lý do]`, `.avatar`, `.userinfo`, `.serverinfo`, `.ping`, `.help` |

---

## ⚠️ Lưu Ý Quan Trọng Khi Tạo Bot Trên Discord Developer Portal
Truy cập [Discord Developer Portal](https://discord.com/developers/applications) -> Chọn Bot của bạn -> mục **Bot** -> Kéo xuống phần **Privileged Gateway Intents** và **BẬT CẢ 3 NÚT**:
1. ✅ **Presence Intent**
2. ✅ **Server Members Intent** *(Bắt buộc để chạy Welcome & Goodbye + Auto-Role)*
3. ✅ **Message Content Intent** *(Bắt buộc để dùng lệnh dấu chấm `.play`, `.setup`, `.help`)*
