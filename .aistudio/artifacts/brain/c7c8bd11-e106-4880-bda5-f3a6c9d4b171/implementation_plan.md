# Implementation Plan - Discord Music & Security Bot with Interactive Panel & Web Dashboard

Build a production-grade Discord Music and Security Bot featuring an interactive Discord Embed Panel (with buttons and GIF), complete audio streaming support for YouTube/Spotify/SoundCloud, full slash commands (`/`) and dot prefix commands (`.`), an automated slash-command cleaner to purge stale commands, moderation and anti-raid suite, and a sleek Web Control Panel.

## Proposed User Review Required

> [!IMPORTANT]
> **Token & Voice Connectivity**:
> - The Web Dashboard provides a secure Bot Setup tab where you can enter your `DISCORD_TOKEN` and `CLIENT_ID` directly in the UI (or configure via environment variables).
> - When running inside Cloud Run / containerized environments, Discord Voice UDP streaming requires `@discordjs/voice` and audio extraction. We will implement high-resiliency streaming using `@distube/ytdl-core` / `play-dl` / fallback stream pipelines to prevent HTTP 401/403 errors.

---

## Architecture & Implementation Steps

### 1. Dependencies & Audio Pipeline
- Install needed dependencies: `play-dl` or `@distube/ytdl-core`, `@discordjs/voice`, `discord.js`, `ffmpeg-static`, `dotenv`.
- Configure robust audio stream extractor that supports:
  - YouTube search queries & direct URLs.
  - Spotify track/album/playlist URLs (resolving metadata to search audio streams).
  - SoundCloud URLs.
  - Direct HTTP audio streams.

### 2. Slash Command Cleaner & Command Registry (`src/bot/commands.ts`)
- Implement a dedicated command deployment routine:
  - Fetch all existing Global and Guild slash commands via REST `Routes.applicationCommands(clientId)`.
  - Delete all existing commands (wiping stale/broken commands completely).
  - Register fresh slash commands:
    - `/play <query>`: Play song from YouTube, Spotify, or SoundCloud
    - `/pause`, `/resume`, `/skip`, `/stop`, `/leave`
    - `/loop <off|track|queue>`: Set repeat mode
    - `/queue`: Show queue list
    - `/remove <index>`: Remove song from queue
    - `/panel`: Post the interactive embed controller in the current channel
    - `/ban <user> [reason]`, `/kick <user> [reason]`
    - `/mute <user> <duration_minutes> [reason]`, `/unmute <user>`
    - `/antiraid <on|off|status>`: Anti-raid security settings
- Support duplicate execution for dot prefix commands:
  - `.play`, `.p`, `.skip`, `.s`, `.pause`, `.resume`, `.loop`, `.q`, `.queue`, `.remove`, `.leave`, `.panel`, `.ban`, `.kick`, `.mute`, `.unmute`, `.antiraid`.

### 3. Interactive Discord Music Panel Embed (`src/bot/panel.ts`)
- Rich Discord Embed with:
  - Header with custom banner GIF: `https://cdn.lazi.vn/storage/uploads/users/avatar/1628909081_lazi_402431.gif`.
  - Real-time Track Information: Title, Artist/Channel, Duration, Progress bar (`🔘▬▬▬▬▬▬ 01:23 / 03:45`), Requester, Loop state.
  - Interactive Action Rows (Discord Components):
    - Row 1: `⏮️ Previous` | `⏯️ Play/Pause` | `⏭️ Skip` | `🔁 Loop (Off/Song/Queue)` | `⏹️ Stop/Leave`
    - Row 2: `📜 Show Queue` | `🔀 Shuffle` | `🔉 Vol -` | `🔊 Vol +` | `🧹 Clear Queue`
- Interaction collector automatically updates embed state when users click buttons in Discord.

### 4. Moderation & Anti-Raid Guard (`src/bot/security.ts`)
- Member timeout / mute system using Discord's native `communicationDisabledUntil`.
- Ban and kick with audit reason logging.
- Anti-Raid System:
  - Rapid join rate limiter (e.g. > 5 joins in 10s triggers raid mode).
  - Mass mention detector & auto-delete/timeout.
  - Configurable strictness level (Off / Low / High).

### 5. Backend Server API (`server.ts` & `src/server/`)
- Endpoints:
  - `GET /api/bot/status`: Connection state, guilds, voice channels, uptime.
  - `POST /api/bot/start`: Connect bot with token and client ID.
  - `POST /api/bot/stop`: Disconnect bot.
  - `POST /api/bot/clear-commands`: Clean up and rebuild slash commands.
  - `POST /api/bot/send-panel`: Post the music panel to a selected channel.
  - `GET /api/bot/queue`: Active music queue and playback state.
  - `POST /api/bot/control`: Controls (play, pause, skip, loop, remove, leave).
  - `GET /api/bot/guilds`: List joined servers, voice channels, and text channels.
  - `POST /api/bot/security`: Toggle anti-raid rules.

### 6. Web Dashboard UI (`src/App.tsx` & Components)
- Modern cyberpunk/dark glassmorphic theme with animated GIF background backdrop.
- **Top Bar**: Bot online/offline badge, current guild selector, ping, quick restart button.
- **Tabs**:
  1. **Bot Settings & Token**: Input token, Client ID, auto-clean slash commands button, bot invite link generator.
  2. **Music Player & Panel**:
     - Visual now playing card with audio visualizer animation.
     - Full playback controls, loop selector, volume bar.
     - Search box with multi-platform tabs (YouTube, Spotify, SoundCloud).
     - Interactive Queue manager (drag/reorder, remove, clear).
     - "Deploy Panel to Discord" modal (pick guild & channel to drop the interactive GIF embed).
  3. **Moderation & Anti-Raid**:
     - Anti-Raid status card with toggle switch, sensitivity controls, auto-kick suspicious accounts.
     - Quick moderation tools: Ban, Kick, Mute user by Discord ID or selection.
  4. **Live Discord Console / Logs**:
     - Terminal view streaming real-time bot activities, command triggers, music track loads.

---

## Verification Plan

### Automated Build & Lint Check
- Run `compile_applet` and `lint_applet` to ensure zero TypeScript errors or missing imports.
- Validate Discord.js API methods for v14 compatibility (`GatewayIntentBits`, `ActionRowBuilder`, `ButtonBuilder`, `EmbedBuilder`).

### Runtime & Functional Verification
- Verify server startup and dashboard loading on port 3000.
- Test API endpoints for bot lifecycle, queue operations, command cleanup, and music resolution.
- Ensure the interactive Discord embed generation creates valid components matching Discord v14 schema with the user's GIF banner.
