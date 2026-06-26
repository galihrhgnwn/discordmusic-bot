import { EmbedBuilder } from 'discord.js';

const EMBED_COLOR = 0xFF0000;

export function errorEmbed(msg) {
    return new EmbedBuilder()
        .setDescription(msg)
        .setColor(EMBED_COLOR)
        .setFooter({ text: 'smusic bot' });
}

export function infoEmbed(msg) {
    return new EmbedBuilder()
        .setDescription(msg)
        .setColor(EMBED_COLOR)
        .setFooter({ text: 'smusic bot' });
}

export function formatDuration(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
}

export function progressBar(elapsed, total, length = 10) {
    if (total <= 0) return '░'.repeat(length);
    const filled = Math.round((elapsed / total) * length);
    const validFilled = Math.max(0, Math.min(length, filled));
    if (isNaN(validFilled)) return '░'.repeat(length);
    return '▓'.repeat(validFilled) + '░'.repeat(length - validFilled);
}

export function nowPlayingEmbed(song, extra = {}) {
    // If extra is boolean, it means old call signature: nowPlayingEmbed(song, loop)
    if (typeof extra === 'boolean') {
        extra = { loop: extra };
    }

    const {
        loop = false,
        autoplay = false,
        queueLength = 0,
        position = 1,
        elapsed = null
    } = extra;

    const total = song.duration || 0;
    const totalStr = total > 0 ? formatDuration(total) : '??:??';

    const embed = new EmbedBuilder()
        .setTitle('🎵 Now Playing')
        .setDescription(`**[${song.title}](${song.url})**`)
        .addFields(
            { name: '⏱ Duration', value: totalStr, inline: true },
            { name: '🎧 Requested by', value: song.requester || 'Unknown', inline: true },
            { name: '🎚 Quality', value: song.quality || 'high', inline: true },
            { name: '🔁 Loop', value: loop ? '🟢 ON' : '🔴 OFF', inline: true },
            { name: '✨ Autoplay', value: autoplay ? '🟢 ON' : '🔴 OFF', inline: true },
            { name: '📋 Queue', value: queueLength > 1 ? `${queueLength - 1} song(s) up next` : 'No songs up next', inline: true }
        )
        .setColor(0xFF0000)
        .setFooter({ text: `smusic bot • Track ${position} of ${queueLength}` })
        .setTimestamp();

    if (song.source) {
        embed.addFields({
            name: '📡 Source',
            value: song.source === 'pytube' ? '🐍 PytubeDL API' : '🔄 Unknown',
            inline: true
        });
    }

    if (elapsed !== null && total > 0) {
        const BAR_LENGTH = 12;
        const filled = Math.min(Math.round((elapsed / total) * BAR_LENGTH), BAR_LENGTH);
        const bar = '▓'.repeat(filled) + '░'.repeat(BAR_LENGTH - filled);
        const elapsedStr = formatDuration(elapsed);
        embed.addFields({
            name: '▶ Progress',
            value: `${elapsedStr} ${bar} ${totalStr}`,
            inline: false
        });
    }

    if (song.thumbnail && song.thumbnail.startsWith('http')) {
        embed.setThumbnail(song.thumbnail);
    }

    return embed;
}

