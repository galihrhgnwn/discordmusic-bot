import yts from 'yt-search';
import { detectInputType, parseVideoId, parsePlaylistId, parseTimestamp, fetchSpotifyTitle } from '../utils/urlParser.js';
import { searchSongs, formatViews } from '../utils/searcher.js';
import { userInVoice, botCanJoin } from '../utils/checkPermissions.js';
import { errorEmbed, infoEmbed } from '../utils/embeds.js';
import { getConfig } from '../utils/serverConfig.js';
import { getVideoInfo } from '../core/downloader.js';
import { addToQueue } from '../core/queue.js';
import { getPlayerState, playSong } from '../core/player.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { isOnCooldown, setCooldown, getRemainingSeconds } from '../utils/cooldown.js';

function preCheck(message) {
  if (!userInVoice(message)) {
    message.reply({ embeds: [errorEmbed("Join a voice channel first")] }).catch(() => {});
    return false;
  }
  if (!botCanJoin(message.member.voice.channel)) {
    message.reply({ embeds: [errorEmbed("I don't have permission to join your voice channel")] }).catch(() => {});
    return false;
  }
  return true;
}

async function handleYoutubeVideo(message, url) {
  if (!preCheck(message)) return;
  const guildId = message.guild.id;
  const voiceChannel = message.member.voice.channel;

  let videoId;
  let startTime;
  try {
    videoId = parseVideoId(url);
    startTime = parseTimestamp(url);
  } catch (e) {
    return message.reply({ embeds: [errorEmbed(e.message)] }).catch(() => {});
  }
  const { quality } = getConfig(guildId);

  const loading = await message.reply({ embeds: [infoEmbed('⏳ Loading...')] });

  try {
    const info = await getVideoInfo(videoId);
    const song = {
      videoId: info.videoId,
      title: info.title,
      url: info.url,
      duration: info.duration,
      thumbnail: info.thumbnail,
      requester: message.author.tag,
      requesterId: message.author.id,
      quality,
      startTime
    };

    addToQueue(guildId, song);

    const state = getPlayerState(guildId);
    if (state === 'playing' || state === 'paused') {
      await loading.edit({ embeds: [infoEmbed(`✅ Added to queue: **${song.title}**`)] });
    } else {
      await loading.delete().catch(() => {});
      await playSong(guildId, voiceChannel, message.channel);
    }
  } catch (e) {
    loading.edit({ embeds: [errorEmbed(e.message)] }).catch(() => {});
  }
}

async function handleYoutubePlaylist(message, url) {
  if (!preCheck(message)) return;
  const guildId = message.guild.id;
  const voiceChannel = message.member.voice.channel;

  let listId;
  try {
    listId = parsePlaylistId(url);
  } catch(e) {
    return message.reply({ embeds: [errorEmbed(e.message)] }).catch(() => {});
  }
  const loading = await message.reply({ embeds: [infoEmbed('⏳ Loading playlist...')] });

  try {
    const list = await yts({ listId });
    if (!list.videos || !list.videos.length) {
      return loading.edit({ embeds: [errorEmbed('Playlist is empty or not found')] });
    }

    const { quality } = getConfig(guildId);
    const videos = list.videos.slice(0, 50);

    for (const v of videos) {
      addToQueue(guildId, {
        videoId: v.videoId,
        title: v.title,
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        duration: v.duration.seconds,
        thumbnail: v.thumbnail?.url || '',
        requester: message.author.tag,
        requesterId: message.author.id,
        quality,
        startTime: null
      });
    }

    const note = videos.length < list.videos.length
      ? ` (first 50 of ${list.videos.length})`
      : '';
    await loading.edit({ embeds: [infoEmbed(`✅ Added ${videos.length} songs from **${list.title}**${note}`)] });

    const state = getPlayerState(guildId);
    if (state === 'disconnected' || state === 'idle') {
      await playSong(guildId, voiceChannel, message.channel);
    }
  } catch (e) {
    loading.edit({ embeds: [errorEmbed(e.message)] }).catch(() => {});
  }
}

async function handleSpotify(message, url) {
  if (!preCheck(message)) return;
  const loading = await message.reply({ embeds: [infoEmbed('⏳ Finding Spotify track on YouTube...')] });

  let query;
  try {
    query = await fetchSpotifyTitle(url);
  } catch (e) {
    return loading.edit({ embeds: [errorEmbed('Could not get Spotify track info')] });
  }

  try {
    const results = await yts(query);
    const top = results.videos.sort((a, b) => b.views - a.views)[0];
    if (!top) {
      return loading.edit({ embeds: [errorEmbed(`No YouTube match found for: ${query}`)] });
    }

    await loading.delete().catch(() => {});

    const guildId = message.guild.id;
    const voiceChannel = message.member.voice.channel;
    const { quality } = getConfig(guildId);

    const song = {
      videoId: top.videoId,
      title: top.title,
      url: top.url,
      duration: top.duration.seconds,
      thumbnail: top.thumbnail?.url || '',
      requester: message.author.tag,
      requesterId: message.author.id,
      quality,
      startTime: null,
      sourceNote: `Spotify → YouTube: ${query}`
    };

    addToQueue(guildId, song);

    const state = getPlayerState(guildId);
    if (state === 'playing' || state === 'paused') {
      message.channel.send({ embeds: [infoEmbed(`✅ Added to queue: **${song.title}**\n*Matched from Spotify track: ${query}*`)] }).catch(() => {});
    } else {
      playSong(guildId, voiceChannel, message.channel);
    }
  } catch (e) {
    loading.edit({ embeds: [errorEmbed(e.message)] }).catch(() => {});
  }
}

async function handleSearch(message, input) {
  if (!preCheck(message)) return;

  try {
    const results = await searchSongs(input, message.author.id);
    if (!results.length) {
      return message.reply({ embeds: [errorEmbed(`No results found for: **${input}**`)] });
    }

    const desc = results.map((v, i) => {
      const dur = v.durationStr || '?:??'
      const viewStr = v.views ? ` • ${v.views}` : ''
      const authorStr = v.author ? `${v.author} • ` : ''
      return `**${i + 1}.** ${v.title}\n└ ${authorStr}${dur}${viewStr}`
    }).join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle('🔍 Search Results')
      .setDescription(desc)
      .setColor(0xFF0000)
      .setFooter({ text: 'Pick a song • Times out in 30s • smusic bot' });

    const buttons = results.map((_, i) =>
      new ButtonBuilder()
        .setCustomId(`pick_${i}`)
        .setLabel(String(i + 1))
        .setStyle(ButtonStyle.Secondary)
    );
    const row = new ActionRowBuilder().addComponents(buttons);

    const reply = await message.reply({ embeds: [embed], components: [row] });

    const filter = i => i.user.id === message.author.id && i.customId.startsWith('pick_');
    const collector = reply.createMessageComponentCollector({ filter, time: 30000, max: 1 });

    collector.on('collect', async interaction => {
      const index = parseInt(interaction.customId.replace('pick_', ''), 10);
      const picked = results[index];

      const disabledRow = new ActionRowBuilder().addComponents(
        buttons.map(b => ButtonBuilder.from(b).setDisabled(true))
      );
      await interaction.update({ components: [disabledRow] });

      const guildId = message.guild.id;
      const voiceChannel = message.member.voice.channel;
      const { quality } = getConfig(guildId);

      const song = {
        videoId: picked.videoId,
        title: picked.title,
        url: picked.url,
        duration: picked.duration.seconds,
        thumbnail: picked.thumbnail?.url || '',
        requester: message.author.tag,
        requesterId: message.author.id,
        quality,
        startTime: null
      };

      addToQueue(guildId, song);

      const state = getPlayerState(guildId);
      if (state === 'playing' || state === 'paused') {
        message.channel.send({ embeds: [infoEmbed(`✅ Added to queue: **${song.title}**`)] }).catch(() => {});
      } else {
        playSong(guildId, voiceChannel, message.channel);
      }
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        const disabledRow = new ActionRowBuilder().addComponents(
          buttons.map(b => ButtonBuilder.from(b).setDisabled(true))
        );
        reply.edit({ components: [disabledRow] }).catch(() => {});
      }
    });
  } catch (e) {
    message.reply({ embeds: [errorEmbed(e.message)] }).catch(() => {});
  }
}

export async function handlePlayCommand(message, args) {
  const userId = message.author.id;
  const commandName = 'play';

  if (isOnCooldown(userId, commandName)) {
      return message.reply({ embeds: [errorEmbed(`Wait ${getRemainingSeconds(userId, commandName)} more second(s)`)] }).catch(() => {});
  }
  setCooldown(userId, commandName);

  if (args.length === 0) return message.reply({ embeds: [errorEmbed("Provide a link or song title")] });

  const input = args.join(' ');
  const type = detectInputType(input);

  switch (type) {
    case 'youtube_video':
      return handleYoutubeVideo(message, input);
    case 'youtube_playlist':
      return handleYoutubePlaylist(message, input);
    case 'spotify':
      return handleSpotify(message, input);
    case 'search':
    default:
      return handleSearch(message, input);
  }
}
