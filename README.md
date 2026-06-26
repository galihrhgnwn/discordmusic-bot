# Aether's Discord Bot & Management Dashboard

![Aether's Bot Logo](https://files.catbox.moe/uefsn7.jpg)

**Aether's** is a high-performance, feature-rich Discord Music Bot bundled with a sleek, modern, web-based Management Dashboard. Built as a unified monorepo (hybrid architecture), it seamlessly runs a robust Node.js backend for Discord bot operations alongside a stunning Next.js frontend, all within a single application instance.

Whether you are a server owner looking for a reliable audio streaming solution or a developer wanting to host a modular Node.js bot, Aether's provides top-tier performance, audio clarity, and administrative ease.

---

## 🌟 Table of Contents
1. [Key Features](#-key-features)
2. [Technical Architecture Deep Dive](#-technical-architecture-deep-dive)
3. [Prerequisites](#-prerequisites)
4. [Installation & Setup](#-installation--setup)
5. [Usage Modes (Bot vs. Both)](#-usage-modes-bot-vs-both)
6. [Commands Reference](#-commands-reference)
7. [Environment Variables](#-environment-variables)
8. [Troubleshooting](#-troubleshooting)

---

## ✨ Key Features

Aether's is designed with performance, reliability, and aesthetics in mind. It separates command handling, API cookie management, and streaming buffers into distinct logic layers.

### 🎵 Next-Gen Audio Streaming
- **High-Quality Playback:** Utilizes `@discordjs/voice` coupled with optimized FFmpeg codecs for a low-latency, uninterrupted audio buffer stream.
- **Intelligent Queue System:** Supports standard queues, playlist queuing, loop modes, and skipping with memory-efficient local caching. 
- **Idle Optimization:** If the queue finishes and the bot is idle, the internal state machine gracefully handles connection teardown, automatically leaving the voice channel to preserve memory and CPU cycles.

### 🛡️ Rotation & Anti-Block Mechanics
- **Cookie Rotation & Parsing:** YouTube API requests often get blocked physically or rate-limited. Aether's employs `youtubei.js` and a dedicated cookie rotation scheduler to bypass generic IP blocks and age-restriction firewalls.
- **Automated Session Refresh:** The session manager dynamically cleans out stale connections and refreshes authentication tokens in the background.

### 🖥️ Premium Web Dashboard
- **Monolithic Yet Modular:** The front-end (React/Next.js) and the back-end (Express/Discord.js) share the same underlying event loop, port, and deployment pipeline. 
- **Live Terminal Broadcast (SSE):** Features a distinctive "Live Console" on the dashboard. By intercepting native `console.log` and `console.error` streams, the backend broadcasts live internal server statistics and Discord socket logs directly to your browser using Server-Sent Events (SSE) with near-zero latency.
- **SaaS-Grade UI/UX:** Styled comprehensively with Tailwind CSS v4 and Framer Motion for glassy, modern aesthetics imitating high-end enterprise SaaS portals. 

---

## 🏗️ Technical Architecture Deep Dive

The architectural separation of concerns (SoC) ensures the codebase remains maintainable, scalable, and isolated from unexpected side-effects.

### 1. Bot Core & Command Matrix (`/discordbot/core`)
The entry pipeline starts at `discordbot/index.js`. 
- **Binding Phase:** The application binds a shared Express server and Next.js instance to port `3000`.
- **Command Registration:** The `commandHandler.js` dynamically maps all functional components present in `/discordbot/commands/` (e.g., `play.js`, `playback.js`) into an in-memory `Map`. This guarantees **O(1) lookup speeds** during Discord text/slash command execution, eliminating the standard nested-if spaghetti structures common in older bots.

### 2. The Audio Processing Pipeline (`/core/player.js` & `downloader.js`)
- **Downloader Layer:** Offloads chunk downloading to isolated streams using a combination of fast fetch algorithms.
- **State Machine Synchronization:** Aether's tracks specific voice connection lifecycles (`Signalling`, `Connecting`, `Ready`, `Buffering`, `Idle`). This granular tracking ensures the bot doesn't get "stuck" in a voice channel visually while technically dead in the backend.

### 3. Next.js Dashboard Frontend (`/app` & `/components`)
- Developed using **React Server Components (RSC)** where applicable.
- The `LiveConsole.tsx` client component establishes a persistent connection to the `/api/logs` internal route.
- Custom fonts (Inter, Space Grotesk) and dynamic SVG iconography (Lucide React) establish a distinct identity.

---

## 📦 Prerequisites

Before deploying Aether's, ensure your host machine, VPS, or cloud container meets the following environment dependencies:

- **Node.js:** `v20.x` or `v22.x` is highly recommended.
- **FFmpeg:** Installed globally on your operating system (e.g., `sudo apt install ffmpeg` for Ubuntu). Alternatively, a static binary module (`ffmpeg-static`) is included in the package.json as a fallback.
- **Discord Bot Credentials:** An active Application instance in the [Discord Developer Portal](https://discord.com/developers/applications) with the requisite token and intents (Message Content, Guilds, Guild Voice States) enabled.

---

## 🚀 Installation & Setup

1. **Clone the Source Repository**
   ```bash
   git clone https://github.com/your-username/aethers-bot.git
   cd aethers-bot
   ```

2. **Configure Environment Variables**
   Duplicate the provided configuration template and fill in your keys.
   ```bash
   cp .env.example .env
   ```
   *Edit the `.env` file using your preferred text editor (nano, vim) and populate the missing fields.*

3. **Install Dependencies**
   ```bash
   npm install
   ```

---

## ⚙️ Usage Modes (Bot vs. Both)

Aether's provides an interactive bootstrapper (`install.sh`) to streamline execution, minimizing resource allocation conflicts if you are hosting on low-tier hardware.

Make the script executable and run it:
```bash
chmod +x install.sh
./install.sh
```

You will be greeted with an interactive prompt offering two modes:

### 1) Run Bot Only (Minimal RAM Usage)
- Triggers the `BOT_ONLY=true` environmental flag.
- Skips initializing the Next.js framework engine completely.
- The Express server acts solely as a silent health-check API (`/` route) returning a `200 OK` connection string.
- *Best for: VPS environments with < 1GB RAM or cloud edge deployments.*

### 2) Run Both (Bot + Web Dashboard)
- Compiles the Next.js production chunks via `npm run build`.
- Binds the web frontend rendering engine over the active bot processes.
- The Live Console, statistics, and UI routing are served over the master port.
- *Best for: Comprehensive monitoring and deployment on standard servers/containers.*

**Manual NPM Execution (Alternative to install.sh):**
- Development Mode: `npm run dev`
- Build Dashboard: `npm run build`
- Start Full Services: `npm run start` 
- Start Bot Only: `BOT_ONLY=true npm run start`

---

## 📖 Commands Reference

Once invited and active in your server, use the default prefix `!smusic` (can be configured) followed by the command:

* **Playback:**
  - `!smusic play <query>` - Searches and plays a track/video.
  - `!smusic skip` - Skips the current track in the active queue.
  - `!smusic pause` / `!smusic resume` - Freezes or unfreezes the current audio chunk.
* **Queue Management:**
  - `!smusic queue` - Displays all upcoming tracks in sequence. 
  - `!smusic clear` - Flushes the entire queue.
* **Utility:**
  - `!smusic volume <1-100>` - Modifies global playback amplitude.
  - `!smusic stats` - Returns localized bot heartbeat and module load variables.

---

## 🔐 Environment Variables

Reference the table below when configuring your `.env` instance:

| Variable | Requirement | Description |
| :--- | :---: | :--- |
| `DISCORD_TOKEN` | **Required** | Provides standard REST/Socket access for your specific bot user. |
| `YOUTUBE_COOKIE` | Optional | A stringified header cookie sequence required to bypass 429 rate-limits or age-restrictions imposed by YouTube API interfaces. |
| `PORT` | Optional | Defaults to `3000`. Overrides the binding port for the Web Dashboard. |

---

## 🛠️ Troubleshooting

**Issue:** *The bot joints the voice channel but no audio is transmitted.*
- **Fix:** Ensure FFmpeg is present in your system's PATH. If using Windows, manually append the path to the executable logic. Check your console logs (via the Web Dashboard) for `ffmpeg_error` markers.

**Issue:** *The Dashboard shows "Disconnected" in the upper right.*
- **Fix:** Ensure the Node server hasn't crashed. The Server-Sent Events stream depends on an active HTTP layer. If playing videos heavily buffers, your machine's CPU might be locking Node's single thread.

**Issue:** *YouTube returns "Sign-in to confirm your age".*
- **Fix:** You must generate a fresh `YOUTUBE_COOKIE` from a regular incognito session (preferable) logged into a verified Google account, and append it faithfully to your `.env` configuration.

---

*Engineered with clean architectural principles. Elevate your server's soundstage.*

