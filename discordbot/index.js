import 'dotenv/config';
import fs from 'fs';

const [major] = process.versions.node.split('.').map(Number);
if (major < 20) {
    console.error('❌ Node.js 20+ required for yt-dlp EJS support');
    process.exit(1);
}

import { Client, GatewayIntentBits } from 'discord.js';
import express from 'express';

import { initSession, loadSavedCredentials, watchCredentials } from './core/sessionManager.js';
import { handleMessage, registerCommand } from './core/commandHandler.js';
import { handleAuth } from './auth/auth.js';
import { playbackCommands } from './commands/playback.js';
import { handlePlayCommand } from './commands/play.js';
import { handleChart } from './commands/charts.js';
import { handlePlaylist } from './commands/playlist.js';
import { handleDownload, handleRecommend, handleHelp, handleKeepJoin, handleQuitJoin } from './commands/misc.js';
import { handleAudioCommand } from './commands/audio.js';
import { connectionMap } from './core/player.js';
import { stopPlayer } from './core/player.js';
import { preloadAllSessions, cleanupExpiredTokens } from './core/userSessionManager.js';
import { initLavalink } from './core/lavalinkManager.js';

// Create folders on start if they do not exist
const folders = [
  './auth', './auth/users', './auth/pending',
  './cache', './data'
];
for (const folder of folders) {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
}

// Intercept console.log and console.error for live console
const logListeners = new Set();
const origLog = console.log;
const origError = console.error;

console.log = (...args) => {
    origLog(...args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    const logData = JSON.stringify({ type: 'log', message: msg, time: new Date().toISOString() });
    logListeners.forEach(l => l(logData));
};

console.error = (...args) => {
    origError(...args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    const logData = JSON.stringify({ type: 'error', message: msg, time: new Date().toISOString() });
    logListeners.forEach(l => l(logData));
};

// Setup Next.js + Express server for dashboard & healthchecks
import next from 'next';
const dev = process.env.NODE_ENV !== 'production';
const isBotOnly = process.env.BOT_ONLY === 'true';

let nextApp;
let handle;

if (!isBotOnly) {
    nextApp = next({ dev });
    handle = nextApp.getRequestHandler();
}

const app = express();
const port = process.env.PORT || 3000;

app.get('/api/logs', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send an initial connected message
    res.write(`data: ${JSON.stringify({ type: 'log', message: '[System] Connected to dashboard live console.', time: new Date().toISOString() })}\n\n`);

    const listener = (data) => res.write(`data: ${data}\n\n`);
    logListeners.add(listener);
    req.on('close', () => {
        logListeners.delete(listener);
    });
});

app.all(/.*/, (req, res) => {
    if (isBotOnly) {
        return res.status(200).send('Bot is running (Dashboard disabled)');
    }
    return handle(req, res);
});

// Register commands
registerCommand('auth', handleAuth);
registerCommand('play', handlePlayCommand);
registerCommand('chart', handleChart);
registerCommand('playlist', handlePlaylist);
registerCommand('download', handleDownload);
registerCommand('recommend', handleRecommend);
registerCommand('help', handleHelp);
registerCommand('keepjoin', handleKeepJoin);
registerCommand('quitjoin', handleQuitJoin);
registerCommand('audio', handleAudioCommand);
for (const [cmd, handler] of Object.entries(playbackCommands)) {
    registerCommand(cmd, handler);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
    ]
});

initLavalink(client);

client.on('ready', async () => {
    console.log(`Bot logged in as ${client.user.tag}`);
    // Coba load credentials lagi setelah bot ready
    // (kadang file sudah ada tapi session belum sempat sign in)
    const loaded = await loadSavedCredentials()
    if (loaded) {
      console.log('[Bot] ✅ YouTube session active')
    } else {
      console.log('[Bot] ℹ️ No credentials — login via dashboard')
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    await handleMessage(message);
});

// Global error handler
process.on('unhandledRejection', (error) => {
    console.error('[UnhandledRejection]', error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('[Shutdown] Stopping all players...');
    for (const guildId of connectionMap.keys()) {
        try {
            stopPlayer(guildId);
        } catch (e) {
            console.error(`Failed to stop player for guild ${guildId}:`, e.message);
        }
    }
    client.destroy();
    process.exit(0);
});

async function main() {
    if (!isBotOnly) {
        await nextApp.prepare();
    }
    app.listen(port, () => {
        console.log(`HTTP server listening on port ${port} (Dashboard: ${!isBotOnly ? 'Enabled' : 'Disabled'})`);
    });

    for (const dir of ['./auth', './auth/users', './auth/pending', './auth/cookies', './cache', './data']) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    }

    cleanupExpiredTokens();
    setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

    await initSession();
    const loaded = await loadSavedCredentials();
    
    await preloadAllSessions();

    if (loaded) {
      console.log('[Bot] ✅ Global YouTube session active')
    } else {
      console.log('[Bot] ℹ️ Running without global login')
    }

    watchCredentials();
    
    if (process.env.DISCORD_TOKEN) {
        await client.login(process.env.DISCORD_TOKEN);
    } else {
        console.log('DISCORD_TOKEN is not set. Bot will not connect to Discord.');
    }
}

main().catch(console.error);
