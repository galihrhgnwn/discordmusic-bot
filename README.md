# Aether's Discord Music Bot

Aether's is a Discord music bot with a web dashboard for playback control, queue management, and runtime monitoring. The project combines a Node.js Discord bot with a Next.js dashboard in a single application.

## Features

### Audio playback

The bot uses `@discordjs/voice` and FFmpeg to stream audio to Discord voice channels. It supports searches, playlists, queue management, looping, pause and resume, skipping, volume control, and automatic cleanup when a queue becomes idle.

### Session and cookie handling

The bot uses `youtubei.js` to retrieve media information and supports a configurable `YOUTUBE_COOKIE` value for environments where YouTube requires an authenticated session or applies additional request restrictions.

### Web dashboard

The dashboard is built with Next.js, React, Tailwind CSS, and Framer Motion. It provides runtime statistics and a live console powered by Server-Sent Events. The backend forwards selected application and Discord logs to the dashboard through the `/api/logs` route.

## Project structure

| Path | Purpose |
| --- | --- |
| `discordbot/index.js` | Starts the bot and application server. |
| `discordbot/commands/` | Contains command implementations. |
| `core/player.js` | Manages audio playback and voice connection state. |
| `downloader.js` | Handles media download streams. |
| `app/` | Contains the Next.js dashboard routes and pages. |
| `components/` | Contains reusable dashboard components, including the live console. |

The bot and dashboard share the same application process and port. This keeps deployment simple while retaining a clear separation between Discord functionality, audio processing, and web presentation.

## Requirements

Before running the project, install the following dependencies:

- Node.js 20 or 22.
- FFmpeg available in the system `PATH`. The project also includes `ffmpeg-static` as a fallback dependency.
- A Discord application with a bot token and the following intents enabled: Message Content, Guilds, and Guild Voice States.

Create and configure the bot through the [Discord Developer Portal](https://discord.com/developers/applications).

## Installation

Clone the repository and install its dependencies:

```bash
git clone https://github.com/galihrhgnwn/discordmusic-bot.git
cd discordmusic-bot
npm install
```

Copy the environment template and fill in the required values:

```bash
cp .env.example .env
```

At minimum, set `DISCORD_TOKEN` in `.env` before starting the bot.

## Running the application

The included bootstrap script provides two startup modes:

```bash
chmod +x install.sh
./install.sh
```

Choose **Bot Only** when the web dashboard is not needed or when the host has limited resources. Choose **Bot and Dashboard** to run the complete application.

The same modes are available through npm scripts:

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the application in development mode. |
| `npm run build` | Builds the Next.js dashboard. |
| `npm run start` | Starts the bot and dashboard. |
| `BOT_ONLY=true npm run start` | Starts the bot without the dashboard. |

The HTTP server listens on port `3000` by default. Set `PORT` to use a different port.

## Commands

The default command prefix is `!smusic`, unless it has been changed in the project configuration.

| Command | Description |
| --- | --- |
| `!smusic play <query>` | Searches for and plays a track or video. |
| `!smusic skip` | Skips the current track. |
| `!smusic pause` | Pauses playback. |
| `!smusic resume` | Resumes playback. |
| `!smusic queue` | Displays the current queue. |
| `!smusic clear` | Removes all pending tracks from the queue. |
| `!smusic volume <1-100>` | Changes the playback volume. |
| `!smusic stats` | Displays bot runtime statistics. |

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Token used to authenticate the Discord bot. |
| `YOUTUBE_COOKIE` | No | Cookie header used when YouTube requires an authenticated session or additional verification. |
| `PORT` | No | HTTP port for the dashboard. Defaults to `3000`. |

Keep `.env` private and do not commit credentials to the repository.

## Troubleshooting

If the bot joins a voice channel but does not play audio, verify that FFmpeg is installed and available through the system `PATH`. The dashboard logs can provide additional details about media and voice connection errors.

If the dashboard reports that it is disconnected, confirm that the Node.js process is still running and that the HTTP server is reachable. The live console depends on the application's Server-Sent Events endpoint.

If YouTube asks the user to sign in or confirm their age, provide a current `YOUTUBE_COOKIE` value in `.env` and restart the application.

## References

[1]: https://discord.com/developers/applications "Discord Developer Portal"
[2]: https://github.com/galihrhgnwn/discordmusic-bot "Aether's Discord Music Bot repository"
