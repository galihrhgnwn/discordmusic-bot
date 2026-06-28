import { isOnCooldown, setCooldown, getRemainingSeconds } from '../utils/cooldown.js';
import { errorEmbed, infoEmbed, nowPlayingEmbed, progressBar, formatDuration } from '../utils/embeds.js';
import { pausePlayer, resumePlayer, stopPlayer, skip, getPlayerState, setVolume, getSongStartTime } from '../core/player.js';
import { clearQueue, removeFromQueue, shuffleQueue, getQueue, getCurrentSong, isLooping, setLoop, getHistory } from '../core/queue.js';
import { setConfig } from '../utils/serverConfig.js';
import { validateQuality } from '../utils/qualityConfig.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { isAutoplay, setAutoplay } from '../core/autoplayManager.js';
import { logError } from '../utils/logger.js';

function wrap(commandName, fn) {
    return async (message, args) => {
        const userId = message.author.id;
        if (isOnCooldown(userId, commandName)) {
            return message.reply({ embeds: [errorEmbed(`Wait ${getRemainingSeconds(userId, commandName)} more second(s)`)] }).catch(() => {});
        }
        setCooldown(userId, commandName);

        try {
            await fn(message, args);
        } catch (e) {
            logError(`[Command Error] ${commandName}:`, e);
            message.reply({ embeds: [errorEmbed(`Error: ${e.message}`)] }).catch(() => {});
        }
    };
}

export const playbackCommands = {
    pause: wrap('pause', async (message, args) => {
        const guildId = message.guild.id;
        if (getPlayerState(guildId) !== 'playing') {
            return message.reply({ embeds: [errorEmbed("Nothing is playing")] });
        }
        pausePlayer(guildId);
        await message.reply({ embeds: [infoEmbed("⏸ Paused")] });
    }),
    resume: wrap('resume', async (message, args) => {
        const guildId = message.guild.id;
        if (getPlayerState(guildId) !== 'paused') {
            return message.reply({ embeds: [errorEmbed("Not paused")] });
        }
        resumePlayer(guildId);
        await message.reply({ embeds: [infoEmbed("▶ Resumed")] });
    }),
    skip: wrap('skip', async (message, args) => {
        const guildId = message.guild.id;
        if (!getCurrentSong(guildId)) {
            return message.reply({ embeds: [errorEmbed("Nothing is playing")] });
        }
        skip(guildId);
        await message.reply({ embeds: [infoEmbed("⏭ Skipped")] });
    }),
    stop: wrap('stop', async (message, args) => {
        const guildId = message.guild.id;
        stopPlayer(guildId);
        await message.reply({ embeds: [infoEmbed("⏹ Stopped and queue cleared.")] });
    }),
    loop: wrap('loop', async (message, args) => {
        const guildId = message.guild.id;
        const current = isLooping(guildId);
        setLoop(guildId, !current);
        await message.reply({ embeds: [infoEmbed(`🔁 Loop: ${!current ? 'ON' : 'OFF'}`)] });
    }),
    volume: wrap('volume', async (message, args) => {
        const guildId = message.guild.id;
        const val = parseInt(args[0], 10);
        if (isNaN(val) || val < 1 || val > 100) {
            return message.reply({ embeds: [errorEmbed("Volume must be 1–100")] });
        }
        setVolume(guildId, val);
        setConfig(guildId, 'volume', val);
        await message.reply({ embeds: [infoEmbed(`🔊 Volume: ${val}%`)] });
    }),
    quality: wrap('quality', async (message, args) => {
        const guildId = message.guild.id;
        const q = validateQuality(args[0]);
        setConfig(guildId, 'quality', q);
        await message.reply({ embeds: [infoEmbed(`✅ Quality set to: ${q}`)] });
    }),
    autoplay: wrap('autoplay', async (message, args) => {
        const guildId = message.guild.id;
        const current = isAutoplay(guildId);
        setAutoplay(guildId, !current);
        const state = !current;
        await message.reply({ embeds: [infoEmbed(
            state
                ? '✨ Autoplay: **ON** — Bot will keep playing related songs via YouTube Music algorithm'
                : '⏹ Autoplay: **OFF**'
        )] });
    }),
    now: wrap('now', async (message, args) => {
        const guildId = message.guild.id;
        const song = getCurrentSong(guildId);
        if (!song) {
            return message.reply({ embeds: [errorEmbed("Nothing is playing")] });
        }
        
        const startTime = getSongStartTime(guildId);
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const currentQueue = getQueue(guildId);

        const extra = {
            loop: isLooping(guildId),
            autoplay: isAutoplay(guildId),
            queueLength: currentQueue.length,
            position: 1,
            elapsed
        };

        await message.reply({ embeds: [nowPlayingEmbed(song, extra)] });
    }),
    queue: wrap('queue', async (message, args) => {
        const guildId = message.guild.id;
        if (args[0]?.toLowerCase() === 'clear') {
            clearQueue(guildId);
            return message.reply({ embeds: [infoEmbed("🗑 Queue cleared")] });
        }
        if (args[0]?.toLowerCase() === 'remove') {
            const index = parseInt(args[1], 10);
            try {
                const removed = removeFromQueue(guildId, index);
                return message.reply({ embeds: [infoEmbed(`✅ Removed: ${removed.title}`)] });
            } catch (e) {
                return message.reply({ embeds: [errorEmbed(e.message)] });
            }
        }

        const q = getQueue(guildId);
        if (q.length === 0) {
            return message.reply({ embeds: [errorEmbed("Queue is empty")] });
        }

        const ITEMS_PER_PAGE = 10;
        const pages = Math.ceil(q.length / ITEMS_PER_PAGE);
        let currentPage = 1;

        const generateEmbed = (page) => {
            const start = (page - 1) * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const items = q.slice(start, end);
            
            const lines = items.map((song, i) => {
                const realIndex = start + i + 1;
                const prefix = realIndex === 1 ? '▶ Now Playing:' : `${realIndex}.`;
                return `**${prefix}** ${song.title} — \`${formatDuration(song.duration)}\` — ${song.requester}`;
            });

            return new EmbedBuilder()
                .setTitle(`Queue for ${message.guild.name}`)
                .setDescription(lines.join('\n'))
                .setFooter({ text: `Page ${page}/${pages} • Total: ${q.length} songs` })
                .setColor(0xFF0000);
        };

        const getRow = (page) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel('Prev')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 1),
                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === pages)
            );
        };

        if (pages === 1) {
            return message.reply({ embeds: [generateEmbed(1)] });
        }

        const msg = await message.reply({ embeds: [generateEmbed(1)], components: [getRow(1)] });
        
        const collector = msg.createMessageComponentCollector({ time: 60000 });
        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: 'Not your command', ephemeral: true });
            }
            if (i.customId === 'prev_page') currentPage--;
            if (i.customId === 'next_page') currentPage++;
            
            await i.update({ embeds: [generateEmbed(currentPage)], components: [getRow(currentPage)] });
        });
        
        collector.on('end', () => {
            msg.edit({ components: [] }).catch(() => {});
        });
    }),
    shuffle: wrap('shuffle', async (message, args) => {
        const guildId = message.guild.id;
        shuffleQueue(guildId);
        await message.reply({ embeds: [infoEmbed("🔀 Queue shuffled")] });
    }),
    history: wrap('history', async (message, args) => {
        const guildId = message.guild.id;
        const h = getHistory(guildId);
        if (h.length === 0) {
            return message.reply({ embeds: [errorEmbed("No history yet")] });
        }
        
        const lines = h.map((song, i) => `**[${i + 1}]** ${song.title} — \`${formatDuration(song.duration)}\` — ${song.requester}`);
        const embed = new EmbedBuilder()
            .setTitle('📜 Playback History')
            .setDescription(lines.join('\n'))
            .setColor(0xFF0000)
            .setFooter({ text: 'smusic bot' });
            
        await message.reply({ embeds: [embed] });
    })
};
