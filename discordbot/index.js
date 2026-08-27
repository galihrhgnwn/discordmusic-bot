import 'dotenv/config';
import fs from 'fs';

const [major] = process.versions.node.split('.').map(Number);
if (major < 20) {
    logError('❌ Node.js 20+ required for yt-dlp EJS support');
    process.exit(1);
}

import { Client, GatewayIntentBits } from 'discord.js';

import { initSession, loadSavedCredentials, watchCredentials } from './core/sessionManager.js';
import { handleInteraction, registerCommand } from './core/commandHandler.js';
import { registerSlashCommands } from './core/slashCommands.js';
import { handleAuth } from './auth/auth.js';
import { startAuthWebServer } from './auth/webAuthServer.js';
import { playbackCommands } from './commands/playback.js';
import { handlePlayCommand } from './commands/play.js';
import { handleChart } from './commands/charts.js';
import { handlePlaylist } from './commands/playlist.js';
import { handleDownload, handleRecommend, handleHelp, handleKeepJoin, handleQuitJoin } from './commands/misc.js';
import { connectionMap } from './core/player.js';
import { stopPlayer } from './core/player.js';
import { preloadAllSessions, cleanupExpiredTokens } from './core/userSessionManager.js';
import { logInfo, logError } from './utils/logger.js';

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

client.on('ready', async () => {
    logInfo(`Bot logged in as ${client.user.tag}`);
    await registerSlashCommands(client, logInfo);
    // Coba load credentials lagi setelah bot ready
    // (kadang file sudah ada tapi session belum sempat sign in)
    const loaded = await loadSavedCredentials()
    if (loaded) {
      logInfo('[Bot] ✅ YouTube session active')
    } else {
      logInfo('[Bot] ℹ️ No credentials — running without a global YouTube session')
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    await handleInteraction(interaction);
});

// Global error handler
process.on('unhandledRejection', (error) => {
    logError('[UnhandledRejection]', error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    logInfo('[Shutdown] Stopping all players...');
    for (const guildId of connectionMap.keys()) {
        try {
            stopPlayer(guildId);
        } catch (e) {
            logError(`Failed to stop player for guild ${guildId}:`, e.message);
        }
    }
    client.destroy();
    process.exit(0);
});

async function main() {
    startAuthWebServer();

    for (const dir of ['./auth', './auth/users', './auth/pending', './auth/cookies', './cache', './data']) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    }

    // Cleanup is synchronous and must not be chained with .catch().
    cleanupExpiredTokens();
    setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

    await initSession();
    const loaded = await loadSavedCredentials();
    
    await preloadAllSessions();

    if (loaded) {
      logInfo('[Bot] ✅ Global YouTube session active')
    } else {
      logInfo('[Bot] ℹ️ Running without global login')
    }

    watchCredentials();
    
    if (process.env.DISCORD_TOKEN) {
        await client.login(process.env.DISCORD_TOKEN);
    } else {
        logInfo('DISCORD_TOKEN is not set. Bot will not connect to Discord.');
    }
}

main().catch(logError);
