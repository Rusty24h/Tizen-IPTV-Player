# Tizen-IPTV-Player — Native Samsung Tizen 4.0+ Smart TV IPTV Player (Stalker / Xtream / M3U)

![Version](https://img.shields.io/badge/Version-2.1.0-00e676?style=for-the-badge)
![Tizen OS](https://img.shields.io/badge/Tizen_OS-4.0%2B_(2018--2026)-0072ff?style=for-the-badge&logo=samsung)
![Resolution](https://img.shields.io/badge/Display-1080p_UI_%2F_4K_%26_8K_60fps_AVPlay-ff9100?style=for-the-badge)
![Protocols](https://img.shields.io/badge/Protocols-Stalker_MAG_%7C_Xtream_%7C_M3U8_%7C_MPEG--DASH-a855f7?style=for-the-badge)

**Tizen-IPTV-Player (v2.1.0)** is a high-performance, native Samsung Smart TV IPTV application engineered for **Tizen OS 4.0+ (2018–2026 TV models)**. It combines Samsung's hardware-accelerated `webapis.avplay` multimedia pipeline with a bundled **Tizen Background Node.js Local Proxy (`127.0.0.1:3001`)** to bypass CORS restrictions, emulate MAG Set-Top Box hardware headers (`MAG250` / `MAG254` / `MAG322`), and deliver instant playback across **Stalker Middleware Portals**, **Xtream Codes API**, and **M3U / M3U8 / MPEG-DASH Playlists**.

---

## 🚀 What's New in v2.1.0

- **Redesigned Full-Width Mobile QR & LAN Setup Banner (`http://<TV-LAN-IP>:3001/setup`)**:
  - Split full-width banner inside Settings featuring setup instructions and the TV's LAN URL on the left, paired with a **248×248px ISO/IEC 18004 Vector QR Code**, a **4-Digit Pairing PIN**, and a **Wi-Fi Ready** indicator on the right for easy scanning from across the room.
  - Built-in brute-force rate limiting (60-second IP lockout after 5 failed PIN attempts and automatic PIN rotation after 10 global failures) plus one-click **Phone Backup & Restore** over local Wi-Fi.
- **High-Bitrate VOD / Series Anti-Buffering Pipeline**:
  - **Two-Stage Asymmetric VOD Buffer**: Uses a fast **5-second initial play buffer** for rapid first-frame video decode alongside a **20-second sustain buffer**, a **45-second buffering timeout**, and a **65-second buffering watchdog** for smooth 4K/8K VOD and Series playback.
  - **Pre-Open VOD Redirect Resolver (`/vod-resolve`)**: Resolves HTTP `301`/`302`/`303`/`307`/`308` CDN redirects before opening `webapis.avplay` so the hardware player connects directly to the final media server.
  - **Post-PLAYING Deferred Resume Seek**: Defers VOD resume seeking until the hardware demuxer decodes its first presentation timestamp, preventing `.mkv` and `.mp4` streams from resetting to `00:00:00`.
  - **Minimalist Circular VOD Buffering Overlay**
- **Full-Bleed 2:3 Poster Grid & Click-to-Load Details & EPG**:
  - **Full-Bleed 2:3 Movie & Series Cards**: True `2:3` aspect ratio poster cards with `object-fit: cover` and asynchronous image decoding.
  - **Click-to-Load Details & EPG**: Navigating across the 3×3 Poster Grid keeps the right-hand **Details & EPG** column locked without background network fetches on hover. Pressing **OK** once loads the selected item's details and unlocks the action tools; pressing **OK** a second time starts playback.
  - **List View Default & Scrollable 2-Column Quick Action Tools**: Defaults to List View for instant D-Pad **Right** access to the compact `1.1fr` Details & EPG column and its expandable 2-column Quick Action Tools bar (`⚙ More Tools` / `▴ Fewer Tools`).
- **Multi-DRM (`WIDEVINE_CDM`, `PLAYREADY`, `CLEARKEY`), MPEG-DASH (`.mpd`) & Kodi/VLC M3U Directives**:
  - Native `webapis.avplay.setDrm()` support for **Widevine Modular**, **Microsoft PlayReady**, and **W3C ClearKey** (`kid:key` hex and JWK), plus `.mpd` MPEG-DASH streams.
  - Parses `#KODIPROP:inputstream.adaptive.*`, `#EXTVLCOPT:http-*`, `#EXTHTTP:{...}`, and inline `|User-Agent=...&Referer=...` pipe headers in M3U playlists.
- **Profile Switcher & Synchronized Session Reset**:
  - Full-screen profile selector with **7 pre-cached High-DPI studio avatars**
- **380MB DDR RAM Budget Enforcer & Large-Catalog Pagination**:
  - Automatic memory trimmers bound EPG, VOD metadata, Base64, XMLTV, and M3U caches and release detached DOM images, while automatically switching massive catalogs (`600+` categories) to on-demand per-category pagination.
- **Official YouTube Trailer Modal & Automatic Trailer Search**:
  - Plays explicit `youtube_trailer` IDs or resolves official trailers automatically via `/trailer-search`, playing inside the built-in 1080p YouTube modal or launching the native Samsung YouTube TV app via the **Green** button.

---

## ✨ Key Features

### 1. Multi-Protocol IPTV & Multi-Profile Management
- **Stalker Middleware (MAG Portal) Support**:
  - Complete handshake, profile authentication, ordered catalog loading, and stream link creation with automatic token refresh and hardware MAG Set-Top Box header emulation (`MAG250`, `MAG254`, `MAG322`).
- **Xtream Codes API Support**:
  - Native support for Live TV, Movies (VOD), Series (Seasons & Episodes), Short EPG, and Full Archive EPG with automatic Base64 programme decoding.
- **M3U / M3U8 / MPEG-DASH Playlist Parser**:
  - Streaming parser supporting `tvg-id`, `tvg-name`, `tvg-logo`, `group-title`, `#EXTGRP`, catch-up tags, and custom HTTP/DRM directives, automatically classifying Live TV, Movies, and Series.
- **Smart Context-Aware Blue Button (Quick-Switch Portal vs. Column Filter)**:
  - Pressing the **Blue** remote button on the **Left Sidebar (Column 0)** or **Categories (Column 1)** opens the **"Who's Watching?"** Profile Switcher.
  - Pressing the **Blue** remote button on **Channels / Items (Column 2)** opens the **Column Filter Modal**, and in fullscreen video opens the **Audio & Subtitles Track Selector**.

### 2. Hardware-Accelerated Tizen AVPlay & Playback Controls
- **Native 4K/8K UHD & 60fps Hardware Decoding**:
  - Unlocks `SET_MODE_4K` and `VIDEOCODEC_H265` (`3840×2160 @ 60fps`) on `webapis.avplay` with direct hardware routing for VOD and Series streams and automatic local proxy fallback when custom headers or byte-range seeking (`206 Partial Content`) are required.
- **Dynamic Playing Channel Indicator & Auto-Hide 4-Column Overlay**:
  - Both the main channel list and the fullscreen Mini-Zap Drawer (`OK` in fullscreen) dynamically update the green `▶` playing indicator when switching channels, and the browse overlay automatically hides after **8 seconds** of idle background playback.
- **Audio & Subtitle Track Selection + Subtitle Timing Offset**:
  - Switch embedded audio and subtitle tracks at runtime, adjust **Subtitle Timing Offset (`-5.0s` to `+5.0s`)**, and customize subtitle font size and style.
- **VOD Playback Speed (`0.5x` – `2.0x`) & Resume Progress Bars**:
  - Adjustable VOD playback speeds (`0.5x`, `1.0x`, `1.25x`, `1.5x`, `2.0x`) and automatic watch-progress persistence every 15 seconds with visual progress bars on cards and list rows.

### 3. 2D Timeline EPG Grid, Catch-Up TV, DVR & System Tools
- **Interactive 2D Timeline EPG Grid & External XMLTV Merger**:
  - Horizontal time-slot matrix across channels with live programme progress bars, plus background merging of external `.xml` and `.xml.gz` XMLTV EPG feeds.
- **Catch-Up / Archive TV & Live DVR Recording (`.ts`)**:
  - Play past programmes marked with `[⏪ Catch-Up Available]` and record live `.ts` streams directly to writable TV storage via `/record`.
- **Parental Control PIN, Category Management, Sleep Timer & Stream Diagnostics**:
  - 4-digit Parental PIN lock for adult categories and locked channels, Category Hide/Pin-to-Top (`Red` button), Sleep Timer (`15m`–`120m`), OLED Anti-Burn-In Screensaver, and real-time Stream Diagnostics (`stream-diag`).

---

## 🎮 Samsung TV Remote Control Map

| Remote Button | KeyCode | Primary Action (Browse Mode) | Fullscreen Video Action |
| :--- | :---: | :--- | :--- |
| **D-Pad ▲ / ▼ / ◀ / ▶** | `38 / 40 / 37 / 39` | Navigate 4-Column Layout / 3×3 Poster Grid / 2D EPG | **◀ / ▶**: Seek `-30s / +30s` (VOD) • **▲ / ▼**: Zap Channel |
| **OK / Enter** | `13` | **List View**: Play / Select • **3×3 Grid**: 1st Press = Load Details & EPG, 2nd Press = Play | Open **Mini-Zap Channel Drawer** & Info Banner |
| **Return / Back** | `10009` | Exit Fullscreen → Close Modal → Return to Categories → Exit Prompt | Exit Fullscreen back to 4-Column Browse Overlay |
| **CH ▲ / CH ▼** | `427 / 428` | Page Up / Page Down (`±10` rows) in Lists & Categories | Instant Next / Previous Channel Zap |
| **0 – 9 Number Keys** | `48 – 57` | Direct Numeric Channel Jump (`1.5s` OSD auto-commit) | Direct Numeric Channel Jump |
| **🔴 Red Button** | `403` | **Categories**: Hide/Pin Category • **Items**: Toggle ★ Favorite | Start / Stop **Live DVR Stream Recording (`.ts`)** |
| **🟢 Green Button** | `404` | Cycle **Display Aspect Ratio** (`Original Fit` / `16:9` / `Zoom`) | Cycle **Display Aspect Ratio** (or Launch YouTube App in Trailer Modal) |
| **🟡 Yellow Button** | `405` | **Profile Picker**: Edit Profile • **Browse**: Open **2D EPG Grid** / Cycle **Sort** | Recall **Last Watched Channel** |
| **🔵 Blue Button** | `406` | **Col 0/1**: Open **"Who's Watching?"** Switcher • **Col 2**: Filter | Open **Audio & Subtitle Track Selector + Sync Offset** |
| **Play / Pause / Stop** | `415 / 19 / 413` | Play / Pause / Stop Active Stream | Play / Pause / Stop Active Stream |
| **Rewind / Fast-Forward**| `412 / 417` | Seek `-30s / +30s` on Active VOD Stream | Seek `-30s / +30s` on Active VOD / Catch-Up Stream |
| **Info** | `457` | Toggle **Real-Time Stream Diagnostics (`stream-diag`)** | Toggle **Info OSD & Stream Bitrate Telemetry** |

---

## 🛠️ How to Install on Your Samsung Smart TV (Tizen 4.0+ / 2018–2026)

### Prerequisites: Enable Developer Mode on Your Samsung TV
1. Turn on your Samsung Smart TV and connect it to the **same local network (Wi-Fi or Ethernet)** as your computer.
2. Open the native **Apps** panel on your TV.
3. On your remote control, press **`1` → `2` → `3` → `4` → `5`** in sequence inside the Apps screen.
4. In the **Developer Mode** dialog:
   - Toggle **Developer Mode** to **ON**.
   - Enter the **IPv4 address of your PC**.
5. Hold the **Power button** on your remote for **5 seconds** until the TV reboots.

---

## Step-by-Step Installation on Samsung Tizen TV


### Method 1: One-Click Install via Apps2Samsung (Recommended)

**Tizen IPTV Player** is officially available in the **[Apps2Samsung Community Packages](https://github.com/Apps2Samsung/tizen-community-packages)** catalog `iptv` category, allowing you to install the app without downloading or configuring Tizen Studio.

1. **Enable Developer Mode on your Samsung TV**:
   - Turn on your Samsung TV, open the **Apps** screen, and press **`1` `2` `3` `4` `5`** on your remote control.
   - Toggle **Developer Mode** to **ON**, enter your computer's local IP address (e.g., `192.168.1.100`), and click **OK**.
   - Hold down the **Power** button on your remote for **3–5 seconds** until the Samsung logo appears to restart the TV.
2. **Download & Open Apps2Samsung**:
   - Download **[Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung)** for Windows, macOS, or Linux.
3. **Connect to Your TV & Sign In**:
   - Enter your Samsung TV's local IP address in **Apps2Samsung** to connect.
   - Sign in with your free **Samsung Account** when prompted so Apps2Samsung can generate your TV's **Partner** certificate automatically.
4. **Install Tizen IPTV Player**:
   - Browse the **Community Packages** list (under the **IPTV** category) and select **Tizen IPTV Player** (`Rusty24h/Tizen-IPTV-Player`).
   - Click **Install** — Apps2Samsung will automatically download `SmartSTBcloneV2.wgt`, sign it for your TV's DUID with a Partner certificate, and install it on your TV!

---

### Method 2: Manual Build & Install via Tizen Studio

#### Phase 1: Enable Developer Mode on your Samsung TV

1. Turn on your Samsung TV and press the **Home** button on your remote.
2. Navigate to **Apps** on the Smart Hub menu.
3. Inside the **Apps** screen, enter the numeric sequence **`1` `2` `3` `4` `5`** using your physical remote keypad (or on-screen numeric keypad).
4. A **Developer Mode Configuration** popup will appear:
   - Toggle **Developer Mode** to **ON**.
   - In the **Host PC IP** field, enter your computer's local IP address (e.g., `192.168.1.100`).
   - Click **OK**.
5. **Restart your TV**: Hold down the **Power** button on your remote control for **3–5 seconds** until the Samsung logo appears on screen (or unplug the TV power cord for 10 seconds).

---

#### Phase 2: Install Tizen Studio & TV Extension

1. Download and install **Tizen Studio** (with IDE or CLI) from the official Samsung Developer portal.
2. Launch **Tizen Package Manager**:
   - Under the **Main SDK** tab, install **Tizen SDK Tools**.
   - Under the **Extension SDK** tab, install:
     - **TV Extensions** (matching or higher than your TV's Tizen version, e.g., 7.0 or 6.5).
     - **Samsung Certificate Extension**.

---

#### Phase 3: Generate Samsung Certificates (Author & Distributor)

Samsung Smart TVs reject unsigned `.wgt` packages. You must generate a free Samsung certificate tied to your TV's Unique Device ID (DUID):

1. Open **Tizen Studio**.
2. Go to **Tools** > **Certificate Manager**.
3. Click the **+** (New) button:
   - Select **Samsung** (do not select Tizen).
   - Choose **TV**.
   - Create a new **Author Certificate** (enter your name and a password).
   - Sign in with your free **Samsung Account**.
4. In the next step, create a **Distributor Certificate**:
   - Set the privilege level to **Partner** (required for `<tizen:service>`, `avplay`, `productinfo`, and `appcommon`).
   - Under **Individual DUIDs**, connect your TV or manually add your TV's DUID (found in TV Menu > Support > About This TV).
5. Click **Finish**. Ensure the new certificate profile is checked as **Active**.

---

#### Phase 4: Connect Tizen Studio to your Samsung TV

1. In Tizen Studio, go to **Tools** > **Device Manager**.
2. Click the **Remote Device Manager** icon (top right).
3. Click **Scan** (or click **+** to add your TV manually):
   - **Name**: `SamsungTV`
   - **IP Address**: Enter your TV's local IP (e.g., `192.168.1.150`).
   - **Port**: `26101` (default).
4. Toggle the connection switch to **ON**.
5. Once connected, right-click your TV in Device Manager and select **"Permit to install applications"** (this uploads your distributor certificate to the TV).

---

#### Phase 5: Build and Deploy the `.wgt` Package

##### Method A: Using Tizen Studio GUI (Recommended)
1. Open Tizen Studio.
2. Select **File** > **Import** > **Tizen** > **Tizen Project**.
3. Choose **Archive file** or **Directory** pointing to the repository folder containing `config.xml`.
4. Right-click the imported project in Project Explorer.
5. Select **Run As** > **Tizen Web Application**.
6. Tizen Studio will automatically package the app, sign it with your certificate, transfer it to your TV, and launch it!

##### Method B: Using Tizen CLI
Open your terminal inside the project directory:

```bash
# 1. Package into a .wgt file with your active certificate profile
tizen package -t wgt -s <YourCertificateProfileName> -- .

# 2. Check connected devices
sdb devices

# 3. Install on the TV
tizen install -s <TV_DEVICE_ID> -n SmartSTBcloneV2.wgt

# 4. (Optional) Launch the app directly from terminal
tizen run -s <TV_DEVICE_ID> -p smartstbv2.SmartSTBclone
```

---

## 📂 Tizen `.wgt` Project Structure (`/public/tizen/`)

```text
public/tizen/
├── config.xml                 # Tizen 4.0+ manifest (v2.1.0, 1080p, AVPlay + DRM + Background Service privileges)
├── index.html                 # 1920x1080 Spatial UI layout, AVPlay <object>, Modals, EPG Grid, QR Setup & OSD overlays
├── app.js                     # Core Tizen application engine (AVPlay + Multi-DRM, D-Pad spatial nav, EPG, DVR, RAM Enforcer)
├── icon.png                   # 512x512 Smart TV launcher icon
├── README.md                  # Packaging & deployment documentation
├── css/
│   └── style.css              # Hardware-accelerated 1080p dark stylesheet (2:3 poster grid, 1.1fr Details & EPG column)
└── service/
    └── proxy.js               # Tizen Background Node.js Service (127.0.0.1:3001 Local Proxy, QR Web Setup & DVR Service)
```
---

## License

This project is licensed under the [MIT License](LICENSE) — free for personal and community use.
Samsung, Tizen, SmartSTB, Xtream Codes, and MAG are trademarks of their respective owners. This application is an independent client implementation.
