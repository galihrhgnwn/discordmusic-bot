import fs from 'fs';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getCurrentSong, addToQueue } from '../core/queue.js';
import { getCachePath } from '../utils/cacheManager.js';
import { getSession } from '../core/sessionManager.js';
import { errorEmbed, infoEmbed } from '../utils/embeds.js';
import { getPlayerState, playSong, keepJoinMap, destroyConnection, clearIdleTimer } from '../core/player.js';
import { getConfig } from '../utils/serverConfig.js';
import { isOnCooldown, setCooldown, getRemainingSeconds } from '../utils/cooldown.js';

export async function handleDownload(message, args) {
    const userId = message.author.id;
    const commandName = 'download';

    if (isOnCooldown(userId, commandName)) {
        return message.reply({ embeds: [errorEmbed(`Wait ${getRemainingSeconds(userId, commandName)} more second(s)`)] }).catch(() => {});
    }
    setCooldown(userId, commandName);

    const guildId = message.guild.id;
    const song = getCurrentSong(guildId);
    if (!song) return message.reply({ embeds: [errorEmbed('Nothing is currently playing')] }).catch(() => {});

    const filePath = getCachePath(song.videoId);
    if (!filePath || !fs.existsSync(filePath)) {
        return message.reply({ embeds: [errorEmbed('Audio file not cached yet. Wait for playback to start.')] }).catch(() => {});
    }

    const stats = fs.statSync(filePath);
    const mb = (stats.size / 1024 / 1024).toFixed(2);
    if (stats.size > 8 * 1024 * 1024) {
        return message.reply({ embeds: [errorEmbed(`File too large to send (${mb}MB). Discord limit is 8MB.`)] }).catch(() => {});
    }

    try {
        await message.channel.send({
            content: `🎵 **${song.title}**`,
            files: [{ attachment: filePath, name: `${song.title.replace(/[^\w\s]/g, '')}.mp3` }]
        });
    } catch (e) {
        message.reply({ embeds: [errorEmbed(`Failed to send file: ${e.message}`)] }).catch(() => {});
    }
}

export async function handleRecommend(message, args) {
    const userId = message.author.id;
    const commandName = 'recommend';

    if (isOnCooldown(userId, commandName)) {
        return message.reply({ embeds: [errorEmbed(`Wait ${getRemainingSeconds(userId, commandName)} more second(s)`)] }).catch(() => {});
    }
    setCooldown(userId, commandName);
    
    if (!message.member?.voice?.channel) {
        return message.reply({ embeds: [errorEmbed('Join a voice channel first')] }).catch(() => {});
    }

    const guildId = message.guild.id;
    const song = getCurrentSong(guildId);
    if (!song) return message.reply({ embeds: [errorEmbed('Nothing is currently playing')] }).catch(() => {});

    const loading = await message.reply({ embeds: [infoEmbed('⏳ Finding recommendations...')] }).catch(() => null);

    let info;
    try {
        const { getUserSession } = await import('../core/userSessionManager.js')
        const { getSession } = await import('../core/sessionManager.js')
        let yt = await getUserSession(userId)
        if (!yt) yt = getSession();

        info = await yt.getInfo(song.videoId);
    } catch (e) {
        return loading ? loading.edit({ embeds: [errorEmbed(`Failed to get recommendations: ${e.message}`)] }).catch(() => {}) : null;
    }

    const related = (info.watch_next_feed || [])
        .filter(item => item.type === 'CompactVideo' && item.id)
        .slice(0, 5);

    if (!related.length) {
        return loading ? loading.edit({ embeds: [errorEmbed('No recommendations found for this song')] }).catch(() => {}) : null;
    }

    const desc = related.map((v, i) =>
        `**${i + 1}.** ${v.title?.text || 'Unknown'}\n└ ${v.author?.name || ''} • ${v.duration?.text || '?'}`
    ).join('\n\n');

    const embed = new EmbedBuilder()
        .setTitle('🎯 Recommended Songs')
        .setDescription(desc)
        .setColor(0xFF0000)
        .setFooter({ text: 'Pick a song • Times out in 30s • smusic bot' });

    const buttons = related.map((_, i) =>
        new ButtonBuilder()
            .setCustomId(`rec_${i}`)
            .setLabel(String(i + 1))
            .setStyle(ButtonStyle.Secondary)
    );
    const row = new ActionRowBuilder().addComponents(buttons);
    
    const reply = await loading.edit({ embeds: [embed], components: [row] }).catch(() => null);
    if (!reply) return;

    const collector = reply.createMessageComponentCollector({
        filter: i => i.user.id === message.author.id && i.customId.startsWith('rec_'),
        time: 30000,
        max: 1
    });

    collector.on('collect', async interaction => {
        try {
            const index = parseInt(interaction.customId.replace('rec_', ''), 10);
            const picked = related[index];
            const disabledRow = new ActionRowBuilder().addComponents(
                buttons.map(b => ButtonBuilder.from(b).setDisabled(true))
            );
            await interaction.update({ components: [disabledRow] });

            const { quality } = getConfig(guildId);
            addToQueue(guildId, {
                videoId: picked.id,
                title: picked.title?.text || 'Unknown',
                url: `https://www.youtube.com/watch?v=${picked.id}`,
                duration: 0,
                thumbnail: picked.thumbnails?.[0]?.url || '',
                requester: message.author.tag,
                requesterId: message.author.id,
                quality,
                startTime: null
            });

            if (getPlayerState(guildId) !== 'playing' && getPlayerState(guildId) !== 'paused') {
                playSong(guildId, message.member.voice.channel, message.channel);
            } else {
                message.channel.send({ embeds: [infoEmbed(`✅ Added to queue: **${picked.title?.text}**`)] }).catch(() => {});
            }
        } catch (e) {
            console.error('[Recommend]', e);
        }
    });

    collector.on('end', (_, reason) => {
        if (reason === 'time') {
            const disabledRow = new ActionRowBuilder().addComponents(
                buttons.map(b => ButtonBuilder.from(b).setDisabled(true))
            );
            reply.edit({ components: [disabledRow] }).catch(() => {});
        }
    });
}

export async function handleHelp(message, args) {
    const embed = new EmbedBuilder()
        .setTitle('📖 smusic bot — Commands')
        .setColor(0xFF0000)
        .setFooter({ text: 'smusic bot' })
        .addFields(
            {
                name: '🔍 Search & Play',
                value: [
                    '`!smusic <link>` — Play YouTube or Spotify link',
                    '`!smusic <judul>` — Search and pick a song',
                    '`!smusic artist: X` — Search by artist name',
                    '`!smusic short: X` — Songs under 5 minutes',
                    '`!smusic long: X` — Songs over 10 minutes',
                ].join('\n')
            },
            {
                name: '📊 Charts',
                value: '`!smusic chart` — Trending songs with region & genre filter'
            },
            {
                name: '⏯ Playback',
                value: [
                    '`!smusic pause` / `resume` / `skip` / `stop`',
                    '`!smusic loop` — Toggle loop',
                    '`!smusic autoplay` — Toggle autoplay via YouTube algorithm',
                    '`!smusic volume <1-100>`',
                    '`!smusic quality <low|medium|high|lossless>`',
                    '`!smusic keepjoin` — 24/7 Voice Channel',
                    '`!smusic quitjoin` — Disable 24/7 mode',
                ].join('\n')
            },
            {
                name: '📋 Queue',
                value: [
                    '`!smusic queue` — View queue (paginated)',
                    '`!smusic queue clear` / `remove <nomor>`',
                    '`!smusic shuffle`',
                ].join('\n')
            },
            {
                name: '💾 Playlist (login required)',
                value: [
                    '`!smusic playlist` — List your YouTube Music playlists',
                    '`!smusic playlist play <nama>` — Play a playlist from your library',
                    '`!smusic playlist search <nama>` — Search YouTube Music playlists',
                    '\n*Note: Playlist diambil langsung dari akun YouTube Music kamu.*',
                    '*Run !smusic auth login untuk connect akun.*'
                ].join('\n')
            },
            {
                name: 'ℹ️ Info & Misc',
                value: [
                    '`!smusic now` — Current song info',
                    '`!smusic history` — Last 10 played songs',
                    '`!smusic download` — Download current song',
                    '`!smusic recommend` — Get song recommendations',
                    '`!smusic help` — This menu',
                ].join('\n')
            },
            {
                name: '🔐 Auth',
                value: [
                    '`!smusic auth login` — Connect akun YouTube kamu (personal)',
                    '`!smusic auth status` — Cek status koneksi',
                    '`!smusic auth logout` — Disconnect akun',
                    '\n*Login bersifat opsional tapi memberikan rekomendasi musik yang lebih personal berdasarkan akun YouTube kamu.*'
                ].join('\n')
            }
        );

    message.reply({ embeds: [embed] }).catch(() => {});
}

export async function handleKeepJoin(message, args) {
    const guildId = message.guild.id;
    keepJoinMap.set(guildId, true);
    message.reply({ embeds: [infoEmbed('✅ **24/7 mode enabled.** I will stay in the voice channel even when idle.')] }).catch(() => {});
}

export async function handleQuitJoin(message, args) {
    const guildId = message.guild.id;
    keepJoinMap.set(guildId, false);
    
    // If not playing, optionally trigger disconnect timer immediately, or just let it be.
    // We'll call scheduleDisconnect manually if it's currently idle.
    if (getPlayerState(guildId) === 'idle' || getPlayerState(guildId) === 'disconnected') {
        clearIdleTimer(guildId);
        destroyConnection(guildId);
        message.reply({ embeds: [infoEmbed('👋 **24/7 mode disabled.** Disconnected because I was idle.')] }).catch(() => {});
    } else {
        message.reply({ embeds: [infoEmbed('❌ **24/7 mode disabled.** I will leave when the queue ends.')] }).catch(() => {});
    }
}
