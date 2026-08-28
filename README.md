# Smusic Bot

A Discord music bot built with Node.js and Discord.js. It plays YouTube audio in voice channels, supports queue management, optional YouTube account sessions, and uses the PytubeDL backend for media downloads.

## Features

- Play songs, playlists, and media URLs through slash commands.
- Per-server queues with skip, pause, resume, loop, autoplay, shuffle, and volume controls.
- Audio downloads through the PytubeDL backend with youtubei.js and yt-search fallbacks for metadata and search.
- Local audio caching with a configurable cache manager.
- Global slash command registration when the bot logs in.
- Optional personal YouTube Music sessions through a simple HTML cookie page.
- Automatic voice channel status updates showing the current song title.

## Requirements

- Node.js 20 or newer.
- FFmpeg available in `PATH`, or the bundled `ffmpeg-static` binary.
- A Discord application with a valid bot token.

## Installation

```bash
git clone https://github.com/galihrhgnwn/discordmusic-bot.git
cd discordmusic-bot
npm install
cp .env.example .env
```

Edit `.env` and set `DISCORD_TOKEN`. Keep the file private and never commit it.

## Running the Bot

Run the bot directly:

```bash
npm run bot
```

The bot starts the Discord client and a small HTTP server for the optional HTML authentication flow. It does not run a dashboard or a Next.js application. When playback starts, the bot updates the connected voice channel status to `Now playing: <song title>`. When playback stops or the queue becomes empty, it changes the status to `Not playing anything`.

## Commands

Every command is available through both Discord slash commands and the `!` message prefix. For example, use `/play query:lofi` or `!play lofi`.

| Command | Description |
| --- | --- |
| `/play query:<title or URL>` | Play a song or playlist. |
| `/chart` | Show music charts by region and genre. |
| `/playlist list` | List available YouTube Music playlists. |
| `/playlist play query:<name>` | Play a playlist. |
| `/playlist search query:<term>` | Search YouTube Music playlists. |
| `/auth login` | Receive an HTML link to connect a personal YouTube account. |
| `/auth status` | Check the YouTube account connection status. |
| `/auth logout` | Disconnect the YouTube account. |
| `/pause` | Pause playback. |
| `/resume` | Resume playback. |
| `/skip` | Skip the current song. |
| `/stop` | Stop playback and clear the queue. |
| `/queue view` | View the queue. |
| `/queue clear` | Clear the queue. |
| `/queue remove index:<number>` | Remove an item from the queue. |
| `/shuffle` | Shuffle the queue. |
| `/loop` | Toggle loop mode. |
| `/autoplay` | Toggle autoplay. |
| `/volume level:<1-100>` | Set the playback volume. |
| `/quality level:<low\|medium\|high>` | Set the preferred audio quality. |
| `/now` | Show the currently playing song. |
| `/download` | Download the current song. |
| `/recommend` | Show recommendations based on the current song. |
| `/keepjoin` | Keep the bot in the voice channel. |
| `/quitjoin` | Disable persistent voice channel mode. |
| `/help` | Show the command list. |

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Bot token from the Discord Developer Portal. |
| `DISCORD_GUILD_ID` | No | Server ID for immediate command registration. Leave empty for global registration. |
| `AUTH_WEB_URL` | No | Public URL for the HTML authentication page. Default: `http://localhost:25557`. |
| `PYTUBE_API_URL` | No | Downloader endpoint. Default: `http://dono-03.danbot.host:1386`. |
| `BOT_OWNER_ID` | No | Discord user ID of the bot owner. |

## YouTube Authentication

YouTube authentication is optional. Run `/auth login` in Discord to receive a private HTML link. Open the link, paste a Netscape cookie export from your browser, and submit the form to validate and save the account session. The link expires after 5 minutes and should not be shared.

Each pending link is generated from a cryptographically random token and is bound to the Discord user who requested it. Saved cookies, YouTube sessions, account profiles, and personal playlist lookups are stored under that Discord user ID. Users cannot use another user's pending link or access another user's saved playlist session. Songs queued from personal searches, playlists, charts, and recommendations retain the requesting Discord user ID for requester-aware playback.

The HTML authentication page is served at `/auth/cookie` by the lightweight server on port `25557`. Set `AUTH_WEB_URL` to a public URL when the bot is running on a remote server:

```env
AUTH_WEB_URL="https://bot.example.com"
```

Never send Discord tokens or YouTube cookies through chat, issues, or commits.

## Downloader Backend

The bot uses the documented PytubeDL audio endpoint:

```text
GET /api/download/audio?url=<youtube-url>&format=m4a
```

The default endpoint is `http://dono-03.danbot.host:1386` and can be overridden with `PYTUBE_API_URL`.

## Development

Check the project before committing changes:

```bash
npm run lint
```

Keep the working tree clean and do not commit credentials, runtime caches, or temporary files. Run `npm run lint` before committing changes.

## Project Structure

```text
discordbot/
  auth/           HTML authentication page and auth handler
  commands/       Discord command handlers
  core/           Player, queue, downloader, sessions, and command registration
  utils/          Cache, logging, permissions, and shared helpers
```

The runtime entry point is `discordbot/index.js`.

## Troubleshooting

If the bot cannot log in, check `DISCORD_TOKEN` and confirm that the bot was invited with the `bot` and `applications.commands` scopes.

If audio cannot be played, make sure FFmpeg is available and that `PYTUBE_API_URL` is reachable from the bot server.

If the voice channel status does not change, grant the bot `SET_VOICE_CHANNEL_STATUS`. Discord may also require `MANAGE_CHANNELS` depending on channel ownership.

If slash commands are not visible, wait for global Discord registration to propagate or use `DISCORD_GUILD_ID` for immediate registration during development.

If HTML authentication links cannot be opened from another device, set `AUTH_WEB_URL` to the public address of the bot server and expose port `25557`.

## License

This project is intended for personal use and experimentation. Follow the applicable service terms and laws when using external media sources.
