import yts from 'yt-search';
import { detectInputType, parseVideoId, parsePlaylistId, parseTimestamp, fetchSpotifyTitle } from '../utils/urlParser.js';
import { searchSongs, formatViews } from '../utils/searcher.js';
import { userInVoice, botCanJoin } from '../utils/checkPermissions.js';
import { errorEmbed, infoEmbed } from '../utils/embeds.js';
import { getConfig } from '../utils/serverConfig.js';
import { getVideoInfo } from '../core/downloader.js';
import { addToQueue } from '../core/queue.js';
import { getPlayerState, playSong } from '../core/player.js';
import { getSource } from '../core/audioSourceManager.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
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
  const { quality, audioSource } = getConfig(guildId);

  const loading = await message.reply({ embeds: [infoEmbed('⏳ Loading...')] });

  try {
    let song;
    if (audioSource === 'lavalink') {
        const { searchLavalink } = await import('../core/lavalinkManager.js');
        const results = await searchLavalink(url);
        if (!results.length) throw new Error('Video not found on Lavalink');
        song = results[0];
        song.requester = message.author.tag;
        song.requesterId = message.author.id;
        song.quality = quality;
        song.startTime = startTime;
    } else {
        const info = await getVideoInfo(videoId);
        song = {
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
    }

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
    const { quality, audioSource } = getConfig(guildId);

    let addedCount = 0;
    let playlistTitle = '';
    let totalCount = 0;

    if (audioSource === 'lavalink') {
        const { searchLavalink } = await import('../core/lavalinkManager.js');
        const results = await searchLavalink(url);
        if (!results.length) throw new Error('Playlist is empty or not found on Lavalink');

        const tracks = results.slice(0, 50);
        playlistTitle = tracks[0]?.title || 'Lavalink Playlist';
        totalCount = results.length;
        addedCount = tracks.length;

        for (const v of tracks) {
            v.requester = message.author.tag;
            v.requesterId = message.author.id;
            v.quality = quality;
            v.startTime = null;
            addToQueue(guildId, v);
        }
    } else {
        const list = await yts({ listId });
        if (!list.videos || !list.videos.length) {
          return loading.edit({ embeds: [errorEmbed('Playlist is empty or not found')] });
        }

        const videos = list.videos.slice(0, 50);
        playlistTitle = list.title;
        totalCount = list.videos.length;
        addedCount = videos.length;

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
    }

    const note = addedCount < totalCount
      ? ` (first ${addedCount} of ${totalCount})`
      : '';
    await loading.edit({ embeds: [infoEmbed(`✅ Added ${addedCount} songs from **${playlistTitle}**${note}`)] });

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
    const guildId = message.guild.id;
    const voiceChannel = message.member.voice.channel;
    const { quality, audioSource } = getConfig(guildId);

    let song;
    if (audioSource === 'lavalink') {
        const { searchLavalink } = await import('../core/lavalinkManager.js');
        const results = await searchLavalink(query);
        if (!results.length) {
            return loading.edit({ embeds: [errorEmbed(`No match found on Lavalink for: ${query}`)] });
        }
        song = results[0];
        song.requester = message.author.tag;
        song.requesterId = message.author.id;
        song.quality = quality;
        song.startTime = null;
        song.sourceNote = `Spotify → Lavalink: ${query}`;
    } else {
        const results = await yts(query);
        const top = results.videos.sort((a, b) => b.views - a.views)[0];
        if (!top) {
          return loading.edit({ embeds: [errorEmbed(`No YouTube match found for: ${query}`)] });
        }

        song = {
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
    }

    await loading.delete().catch(() => {});

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

  const guildId = message.guild.id;
  const audioSource = getSource(guildId);

  try {
    const results = await searchSongs(input, message.author.id, audioSource);
    if (!results.length) {
      return message.reply({ embeds: [errorEmbed(`No results found for: **${input}**`)] });
    }

    const embed = new EmbedBuilder()
      .setTitle('🔍 Search Results')
      .setDescription(`Found ${results.length} results. Select a song from the dropdown below.`)
      .setColor(0xFF0000)
      .setFooter({ text: 'Pick a song • Times out in 30s • smusic bot' });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_song')
        .setPlaceholder('Make a selection')
        .addOptions(results.map((v, i) => {
            const author = v.author ? `${v.author.slice(0, 30)} • ` : '';
            const dur = v.durationStr || '?:??';
            return new StringSelectMenuOptionBuilder()
                .setLabel(`${i + 1}. ${v.title}`.slice(0, 100))
                .setDescription(`${author}${dur}`.slice(0, 100))
                .setValue(`pick_${i}`);
        }));

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const reply = await message.reply({ embeds: [embed], components: [row] });

    const filter = i => i.user.id === message.author.id && i.customId === 'select_song';
    const collector = reply.createMessageComponentCollector({ filter, time: 30000, max: 1 });

    collector.on('collect', async interaction => {
      const index = parseInt(interaction.values[0].replace('pick_', ''), 10);
      const picked = results[index];

      selectMenu.setDisabled(true);
      const disabledRow = new ActionRowBuilder().addComponents(selectMenu);
      await interaction.update({ embeds: [infoEmbed(`✅ Picked: **${picked.title}**`)], components: [disabledRow] });

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
        selectMenu.setDisabled(true);
        const disabledRow = new ActionRowBuilder().addComponents(selectMenu);
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
