# IPTV Player for Samsung Tizen Smart TVs

[![Resolution](https://img.shields.io/badge/Viewport-1080p%20FHD%20%2F%204K%20UHD-success)](#hardware-accelerated-video-playback-avplay)
[![Engine](https://img.shields.io/badge/Player-Hardware%20AVPlay-blueviolet)](#key-features)
[![Protocol](https://img.shields.io/badge/Providers-Stalker%20MAC%20%7C%20Xtream%20API%20%7C%20M3U8-blue)](#multi-provider-architecture--profile-system)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A high-performance, hardware-accelerated IPTV client engineered specifically for **Samsung Smart TVs running Tizen OS** (Tizen 4.0+ through 9.0+, model years 2018 to present).

Designed as a modern, lightweight, and customizable replacement for legacy set-top box middleware, it provides a native **10-foot remote-controlled television interface** with unified **Multi-Provider Architecture** (**Stalker / Ministra MAC Portals**, **Xtream Codes API**, and **M3U / M3U8 Playlists + Local File Import**), progressive instant category boot, non-blocking large-portal ingestion (5,000–25,000+ channels & 900+ categories), seamless 24h & 2D grid EPG timelines, catch-up TV archives, multi-season VOD series management, multi-audio/subtitle track switching, real-time stream diagnostics, and a built-in local background streaming proxy service.

---

## Table of Contents

1. [What's New (Latest Added Features)](#whats-new-latest-added-features)
2. [Key Features](#key-features)
3. [Project Architecture & File Layout](#project-architecture--file-layout)
4. [Prerequisites](#prerequisites)
5. [Step-by-Step Installation on Samsung Tizen TV](#step-by-step-installation-on-samsung-tizen-tv)
   - [Phase 1: Enable Developer Mode on your Samsung TV](#phase-1-enable-developer-mode-on-your-samsung-tv)
   - [Phase 2: Install Tizen Studio & TV Extension](#phase-2-install-tizen-studio--tv-extension)
   - [Phase 3: Generate Samsung Certificates (Author & Distributor)](#phase-3-generate-samsung-certificates-author--distributor)
   - [Phase 4: Connect Tizen Studio to your Samsung TV](#phase-4-connect-tizen-studio-to-your-samsung-tv)
   - [Phase 5: Build and Deploy the `.wgt` Package](#phase-5-build-and-deploy-the-wgt-package)
6. [Samsung Remote Control Key Mapping](#samsung-remote-control-key-mapping)
7. [Initial Setup & Multi-Provider Configuration](#initial-setup--multi-provider-configuration)
8. [License](#license)

---

## What's New (Latest Added Features)

- **🚀 Extreme Large-Portal Engine (5,000–25,000+ Channels & 900+ Categories)**:
  - **Chunked Non-Blocking Ingestion**: Time-sliced catalog indexing, chunked async M3U (`parseM3uPlaylistCatalogAsync`) and XMLTV (`parseXmltvDocumentAsync`) parsers, and O(1) category lookup maps prevent Tizen WebView watchdog freezes on massive portals.
- **🌐 Multi-Provider Architecture**: Full native support for **Stalker / Ministra MAC Portals**, **Xtream Codes API** (`player_api.php` with username/password authentication), and **M3U / M3U8 Playlists** (remote URL or local `.m3u` / `.m3u8` file import with automatic Live TV, Movies, and Series `SxxExx` classification).
- **⚡ Progressive Instant Category Boot**: Categories (`get_genres` / `get_live_categories`) fetch and render within ~200ms on launch while the full channel catalog loads asynchronously in the background—allowing immediate remote navigation without waiting for thousands of channels to finish downloading.
- **🔄 Fast Channel Zapping, Multi-Link Failover & Auto-Reconnect**:
  - Defers background `get_short_epg` requests during channel switches so `create_link` never collides with EPG polling on single-session Stalker portals.
  - Automatic multi-link failover across backup server URLs (`cmds[]`) when an upstream server link fails.
  - Automatically reconnects Live TV streams in fullscreen when the provider drops the connection or sends an unexpected `onstreamcompleted` (EOF) after extended viewing—without kicking you back to the channel list.
- **🔊 Enhanced Audio, Subtitle Timing Offset & Per-Channel Memory**:
  - Late-PID audio track discovery across both `onbufferingcomplete` and `oncurrentplaytime` with compatibility across Tizen 4.0–9.0 firmware (`extra_info` JSON & raw key-value formats).
  - Persistent per-channel/item memory for selected audio track, subtitle track, and aspect ratio (`cfg_item_media_prefs`), plus live `±250ms` subtitle sync timing offset (`webapis.avplay.setSubtitlePosition`).
- **🎨 10-Foot Broadcast UI/UX Overhaul & 6 Color Themes**:
  - **3-Column VOD & Series Poster Grid**: Toggle between a 3×3 poster card grid (with IMDb rating badges, favorite stars, and resume progress bars) and the classic 1D list view.
  - **Live Video Glass Backdrop (`playing-live`)**: Semi-transparent glass columns let live TV continue playing visibly behind the channel guide while browsing.
  - **OSD Broadcast Station Deck & Inline EPG Progress Bars**: Station logo box, channel number pill, remaining time (`-24m left`), and subtle inline progress bars on live channel rows.
  - **6 Hardware-Safe Color Themes**: Choose between **Classic Blue**, **Royal Purple**, **Cyber Cyan**, **Emerald Green**, **Crimson Red**, and **Gold Amber**.
- **📅 Dual-Mode EPG (Single-Channel List + 2D Multi-Channel Timeline Grid) & XMLTV Engine**:
  - Toggle between the classic 24-hour single-channel program schedule and an interactive **2D Multi-Channel EPG Grid** with **Green** button, complete with custom XMLTV URL support, automatic `url-tvg` / `x-tvg-url` discovery, and a dedicated **Up Next** horizontal card strip in the channel preview panel.
- **📱 Phone / LAN Remote Companion Setup**: Built-in `http://<TV-LAN-IP>:3001/setup` web portal served by `service/proxy.js` lets you paste long Portal, Xtream, M3U, and XMLTV URLs directly from your phone or laptop browser to the TV.

---

## Key Features

### 🌐 Multi-Provider Architecture & Profile System
- **3 Native Provider Engines**:
  - **Stalker / Ministra MAC Portal**: Full MAG250 handshake, token refresh, genres, VOD, Series, EPG, automatic `get_profile` + `account_info` (`get_main_info`) account expiration badge, and `tv_archive` Catch-Up.
  - **Xtream Codes API**: Native `player_api.php` integration for Live streams, VOD movies, multi-season Series info (`get_series_info`), account expiration telemetry, and short/XMLTV EPG.
  - **M3U / M3U8 Playlist & Local File Upload**: Parses `#EXTINF` attributes (`tvg-logo`, `group-title`, `tvg-id`, `url-tvg`), automatically groups categories, and clusters episodic series patterns (`S01E01` / `1x01`) into navigable seasons and episodes.
- **Multi-Portal Profile Manager & One-Key Quick Switch**: Store unlimited IPTV profiles across different provider types and switch between them instantaneously with the **Blue** button on the left Main Menu rail (`#col-modes`) or inside Settings.
- **Strict Per-Profile Isolation**: Favorites, watch history, resume timestamps, continue watching items, pinned categories, and MAC-scoped proxy cookies are strictly isolated per profile.
- **JSON Backup & Restore**: Export and import your complete profile collection, favorites, and app preferences to TV storage, local proxy `/backup`, or a downloadable `.json` file.

### 📺 4-Column 1080p Broadcast Interface
- **Optimized 10-Foot UI**: Smooth 60 FPS remote navigation across **Main Menu** (Modes), **Categories**, **Channels / Items**, and **Details & EPG**.
- **Progressive Category Loading**: Immediately populates and focuses the Categories column on cold start while channels stream into memory in the background.
- **Pinned Categories (`📌`)**: Press the **Yellow** button on any category to pin/unpin it to the top of your category list.
- **Context-Aware Quick Action Bar**: Press `Right` from any item to access primary shortcuts (`▶ Play / Fullscreen`, `★ Favorite`, `📅 EPG Guide`, `🔊 Audio / Subs`, `🔄 Refresh`) and expand `⋯ More Tools` for power-user actions (`▦ Grid / List View`, `📐 Aspect Ratio`, `⏱ Sleep Timer`, `⇅ Sort`, `⧩ Filter`, `🩺 Test Stream`, `🔴 Record`, and more).
- **6 Color Themes**: Select between **Classic Blue**, **Royal Purple**, **Cyber Cyan**, **Emerald Green**, **Crimson Red**, and **Gold Amber** accents.

### 🚀 Hardware-Accelerated Video Playback (`AVPlay`)
- **Native Samsung Media Pipeline**: Directly taps into Samsung's hardware decoder engine (`webapis.avplay`) for zero-buffer MPEG-TS, HLS, MP4, and MKV streaming.
- **VLC User-Agent VOD & Multi-CDN Compatibility**: Automatically configures `VLC/3.0.20 LibVLC/3.0.20` and HTTP byte-range headers for VOD Movies and Series.
- **Full Hardware Audio Support**: Built-in firmware decoding of **Dolby Digital (`AC-3`)**, **Dolby Digital Plus (`E-AC-3`)**, **DTS**, **AAC**, and **MP2**.
- **Uninterrupted Live TV Resilience**: Automatic token re-authentication on initial link failure, multi-server backup link failover, and automatic fullscreen reconnection if the provider drops a live stream mid-broadcast.
- **Real-Time Stream Telemetry & Diagnostics**: Live OSD displays resolution badges (`4K UHD`, `1080p FHD`, `720p HD`), frame rate (`FPS`), active audio/video codecs, and live proxy download speed (`KB/s`).
- **Aspect Ratio Control**: Instant switching between **Original Aspect (Letterbox)** and **16:9 Fullscreen Stretch** via the Green button or Quick Actions.

### 📅 24-Hour EPG, 2D Grid & Catch-Up TV Archive
- **Full Electronic Program Guide**: Press `GUIDE` on any channel to inspect its 24-hour schedule or press **Green** to switch to the **2D Multi-Channel EPG Grid**.
- **One-Touch Catch-Up Archive**: Past broadcasts flagged with the `⏱` badge can be replayed instantly through Stalker `tv_archive` or Xtream timeshift linking.
- **Live Progress & What's Next**: Live EPG progress indicator bar and real-time "Now / Next" indicators on both the OSD banner and channel rows.

### 🎬 VOD Movies & Multi-Season Series
- **Rich Metadata**: High-resolution posters, IMDb ratings, release years, synopsis, director, and cast details.
- **Season & Episode Breakdown**: Easily step into series folders with season selectors and episode listings across Stalker, Xtream, and M3U providers.
- **▶ Continue Watching & Resume Playback**: Automatically saves playback progress, renders inline progress bars on partially watched items, marks completed episodes with `✓`, and populates the dedicated **▶ Continue Watching** category.
- **Auto-Advance "Up Next"**: Displays an interactive 10-second countdown banner before transitioning to the next episode.

### 🔊 Audio & Subtitle Track Control
- **Multi-Audio Switching**: Cycle audio language tracks directly with the **Red** button in fullscreen or select tracks from the interactive **Audio & Subtitles Modal** (`#tracks-modal`).
- **Clean Outline Subtitles & Timing Sync**: Rendered with high-contrast broadcast outline shadows, **zero dark background box**, and adjustable `±250ms` subtitle timing offset.
- **Customization on the Fly**: Toggle between **White**, **Yellow**, **Cyan**, and **Green** colors and **Small**, **Normal**, **Large**, or **Extra-Large** font sizes directly from the remote.

### 🔒 Parental Control & Sleep Timer
- **4-Digit PIN Protection**: Lock adult and sensitive categories (`censored=1` or `+18`/`Adult`/`XXX`) behind a PIN prompt (`0000` by default, customizable in Settings).
- **Sleep Timer (`🌙`)**: Schedule automatic playback termination after 15, 30, 60, 90, or 120 minutes with an active top-bar indicator.

---

## Project Architecture & File Layout

```text
├── config.xml             # Tizen TV Widget configuration, TV privileges & Background Node Service definition
├── index.html             # 1920x1080 TV viewport, AVPlay object container, modals, and OSD structures
├── app.js                 # Complete application controller (ES5 strict mode, Multi-Provider client, AVPlay & UI)
├── icon.png               # High-resolution 512x512 application launcher icon
├── css/
│   └── style.css          # Hardware-accelerated 1080p stylesheet, color themes & subtitle outline rules
└── service/
    └── proxy.js           # Local Node.js background HTTP proxy service (cookie jar, redirect & stream diagnostics)
```

### Background Proxy Service (`service/proxy.js`)
Samsung Tizen TVs enforce strict browser security on web applications. IPTV Stalker portals require custom `User-Agent` headers (emulating MAG set-top boxes), persistent cookie jars (`mac=...; timezone=...`), and HTTP redirect resolution.

The embedded background service runs locally on the TV at `http://127.0.0.1:3001` (falling back to `3000`), handling:
- MAG250 identity signatures (`sn`, `device_id`, `device_id2`, `signature`).
- Per-MAC isolated cookie jar management and Stalker token refresh.
- Seamless MPEG-TS and HLS manifest rewriting for direct AVPlay hardware consumption.
- Real-time stream throughput and upstream HTTP status telemetry via `/stream-diag`.
- Phone / LAN remote configuration web interface at `/setup`.

---

## Prerequisites

Before installing the app on your Samsung Smart TV, ensure you have:
1. **Samsung Smart TV** running Tizen OS 4.0 or newer (Manufactured from 2018 onwards).
2. **Computer (Windows / macOS / Linux)** on the **same local Wi-Fi or Ethernet network** as your TV (for Tizen Studio deployment).
3. **Samsung Remote Control** (Standard IR remote with numeric keypad or Smart Remote).
4. **Active IPTV Subscription**:
   - **Stalker Portal URL** + activated **MAC Address** (`00:1A:79:XX:XX:XX`), **OR**
   - **Xtream Codes Server URL** + **Username** & **Password**, **OR**
   - **M3U / M3U8 Playlist URL** or local `.m3u` / `.m3u8` file.

---

## Step-by-Step Installation on Samsung Tizen TV

### Phase 1: Enable Developer Mode on your Samsung TV

1. Turn on your Samsung TV and press the **Home** button on your remote.
2. Navigate to **Apps** on the Smart Hub menu.
3. Inside the **Apps** screen, enter the numeric sequence **`1` `2` `3` `4` `5`** using your physical remote keypad (or on-screen numeric keypad).
4. A **Developer Mode Configuration** popup will appear:
   - Toggle **Developer Mode** to **ON**.
   - In the **Host PC IP** field, enter your computer's local IP address (e.g., `192.168.1.100`).
   - Click **OK**.
5. **Restart your TV**: Hold down the **Power** button on your remote control for **3–5 seconds** until the Samsung logo appears on screen (or unplug the TV power cord for 10 seconds).

---

### Phase 2: Install Tizen Studio & TV Extension

1. Download and install **Tizen Studio** (with IDE or CLI) from the official Samsung Developer portal.
2. Launch **Tizen Package Manager**:
   - Under the **Main SDK** tab, install **Tizen SDK Tools**.
   - Under the **Extension SDK** tab, install:
     - **TV Extensions** (matching or higher than your TV's Tizen version, e.g., 7.0 or 6.5).
     - **Samsung Certificate Extension**.

---

### Phase 3: Generate Samsung Certificates (Author & Distributor)

Samsung Smart TVs reject unsigned `.wgt` packages. You must generate a free Samsung certificate tied to your TV's Unique Device ID (DUID):

1. Open **Tizen Studio**.
2. Go to **Tools** > **Certificate Manager**.
3. Click the **+** (New) button:
   - Select **Samsung** (do not select Tizen).
   - Choose **TV**.
   - Create a new **Author Certificate** (enter your name and a password).
   - Sign in with your free **Samsung Account**.
4. In the next step, create a **Distributor Certificate**:
   - Ensure the privilege level is set to **Public** or **Partner**.
   - Under **Individual DUIDs**, connect your TV or manually add your TV's DUID (found in TV Menu > Support > About This TV).
5. Click **Finish**. Ensure the new certificate profile is checked as **Active**.

---

### Phase 4: Connect Tizen Studio to your Samsung TV

1. In Tizen Studio, go to **Tools** > **Device Manager**.
2. Click the **Remote Device Manager** icon (top right).
3. Click **Scan** (or click **+** to add your TV manually):
   - **Name**: `SamsungTV`
   - **IP Address**: Enter your TV's local IP (e.g., `192.168.1.150`).
   - **Port**: `26101` (default).
4. Toggle the connection switch to **ON**.
5. Once connected, right-click your TV in Device Manager and select **"Permit to install applications"** (this uploads your distributor certificate to the TV).

---

### Phase 5: Build and Deploy the `.wgt` Package

#### Method A: Using Tizen Studio GUI (Recommended)
1. Open Tizen Studio.
2. Select **File** > **Import** > **Tizen** > **Tizen Project**.
3. Choose **Archive file** or **Directory** pointing to the repository folder containing `config.xml`.
4. Right-click the imported project in Project Explorer.
5. Select **Run As** > **Tizen Web Application**.
6. Tizen Studio will automatically package the app, sign it with your certificate, transfer it to your TV, and launch it!

#### Method B: Using Tizen CLI
Open your terminal inside the project directory:

```bash
# 1. Package into a .wgt file with your active certificate profile
tizen package -t wgt -s <YourCertificateProfileName> -- .

# 2. Check connected devices
sdb devices

# 3. Install on the TV
tizen install -s <TV_DEVICE_ID> -n SmartSTBclone.wgt

# 4. (Optional) Launch the app directly from terminal
tizen run -s <TV_DEVICE_ID> -p smartstbv2.SmartSTBclone
```

---

## Samsung Remote Control Key Mapping

| Remote Button | Simulator Key | Action in Overlay (Menu) | Action in Fullscreen Playback |
| :--- | :---: | :--- | :--- |
| **UP / DOWN** | `↑` / `↓` | Navigate list items & Settings inputs vertically | Channel Zapping / Page Up/Down |
| **LEFT / RIGHT** | `←` / `→` | Switch column / Step out of series | Seek -30s / +30s (VOD & Catch-Up) |
| **ENTER / OK** | `Enter` | Select category / Play & Auto-Hide Overlay / Quick action | Open **Mini-Zap Drawer** (Live TV) |
| **RETURN / BACK**| `Esc` / `Backspace` | Step back / Close modal / Hide overlay | Bring up Main 4-Column Guide |
| **RED BUTTON** | `R` | Cycle Sort Order (`Added`, `A-Z`, `Z-A`) | **Cycle Audio Tracks** |
| **GREEN BUTTON**| `G` | Open **Global Search** / Toggle **2D EPG Grid** | **Toggle Aspect Ratio** (Fit / Stretch) |
| **YELLOW BUTTON**| `Y` | Toggle Favorite / **Pin Category (`📌`)** | **Toggle Favorite** on active stream |
| **BLUE BUTTON** | `B` | **Quick-Switch Portal** (on Main Menu) / **Column Filter** (on Cats/Items) | **Cycle Subtitles** (On / Off / Tracks) |
| **GUIDE / INFO**| `E` / `I` | Open 24h & 2D Grid EPG Schedule Modal | Show Stream Telemetry & OSD Bar |
| **NUMBERS (0-9)**| `0` - `9` | Direct Channel Number Input | Direct Channel Jump (`0` = Previous Ch) |
| **PLAY / PAUSE** | `Space` | Toggle Play / Pause | Toggle Play / Pause |
| **CH UP / DOWN** | `PgUp` / `PgDn`| Jump 10 items | Channel Zap / Scrub +/-10 minutes |

---

## Initial Setup & Multi-Provider Configuration

1. When launched for the first time (or by selecting **Settings** in the Main Menu), the app opens the **Portal & Profile Settings** modal.
2. Select your **Provider Type** (or open `http://<TV-LAN-IP>:3001/setup` from your phone to push credentials over Wi-Fi):
   - **Stalker MAC**:
     - **Stalker Portal URL**: E.g., `http://portal.example.com/c/` or `http://provider.tv:8080/stalker_portal/c/`
     - **MAC Address**: Enter your registered MAG MAC address (e.g., `00:1A:79:A4:B2:C9`).
   - **Xtream API**:
     - **Server URL**: E.g., `http://line.provider.tv:8080`
     - **Username & Password**: Enter your Xtream Codes account credentials.
   - **M3U Playlist**:
     - **M3U URL**: Enter a remote `.m3u` or `.m3u8` URL, **or** click **📂 Upload Local .M3U / .M3U8** to import a playlist directly.
3. *(Optional)* Enter a custom **XMLTV EPG URL** (`.xml` or `.xml.gz`), choose your preferred **UI Color Theme**, and set a **4-Digit Parental PIN** (default: `0000`).
4. Click **Save & Connect**.
5. The app immediately fetches and displays your Live TV categories while loading the full channel list in the background.

---

## License

This project is licensed under the [MIT License](LICENSE) — free for personal and community use.
Samsung, Tizen, SmartSTB, Xtream Codes, and MAG are trademarks of their respective owners. This application is an independent client implementation.
