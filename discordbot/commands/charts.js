import yts from 'yt-search'
import { getSession } from '../core/sessionManager.js'
import { addToQueue } from '../core/queue.js'
import { getConfig } from '../utils/serverConfig.js'
import { playSong, getPlayerState } from '../core/player.js'
import { infoEmbed, errorEmbed } from '../utils/embeds.js'
import {
  EmbedBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ButtonBuilder, ButtonStyle
} from 'discord.js'
import { userInVoice, botCanJoin } from '../utils/checkPermissions.js'

const REGIONS = {
  'ID': '🇮🇩 Indonesia',
  'US': '🇺🇸 United States',
  'JP': '🇯🇵 Japan',
  'KR': '🇰🇷 South Korea',
  'GB': '🇬🇧 United Kingdom'
}

const GENRES = ['All', 'Pop', 'Hip-Hop', 'R&B', 'Rock', 'Electronic']

const REFRESH_COOLDOWN = 30 * 1000
const chartStateMap = new Map()

// Fetch trending music dari YouTube
async function fetchTrending(region = 'ID') {
  // Prioritas 1: YouTube Music charts via InnerTube
  try {
    const yt = getSession()
    const charts = await yt.music.getCharts(region)

    const songs = charts?.songs?.contents || []
    if (songs.length) {
      return songs.slice(0, 10).map(s => ({
        videoId: s.id,
        title: s.title || 'Unknown',
        author: s.artists?.map(a => a.name).join(', ') || '',
        duration: s.duration?.seconds || 0,
        thumbnail: s.thumbnail?.contents?.[0]?.url || '',
        views: s.views || ''
      }))
    }
  } catch (e) {
    console.warn('[Charts] YouTube Music getCharts failed:', e.message)
  }

  // Prioritas 2: YouTube getTrending via InnerTube
  try {
    const yt = getSession()
    const trending = await yt.getTrending()
    const musicSection = trending?.sections?.find(s =>
      s.title?.text?.toLowerCase().includes('music') ||
      s.title?.text?.toLowerCase().includes('musik')
    )
    const items = musicSection?.contents ||
                  trending?.sections?.[0]?.contents || []
    const songs = items
      .filter(item => item.id && item.title)
      .slice(0, 10)
      .map(item => ({
        videoId: item.id,
        title: item.title?.text || item.title || 'Unknown',
        author: item.author?.name || '',
        duration: item.duration?.seconds || 0,
        thumbnail: item.thumbnail?.[0]?.url || '',
        views: item.view_count?.text || ''
      }))
    if (songs.length) return songs
  } catch (e) {
    console.warn('[Charts] getTrending failed:', e.message)
  }

  // Prioritas 3: yt-search fallback
  const REGION_QUERY = {
    'ID': 'trending musik indonesia 2025',
    'US': 'trending music usa 2025',
    'JP': 'trending music japan 2025',
    'KR': 'trending kpop 2025',
    'GB': 'trending music uk 2025',
  }
  const r = await yts(REGION_QUERY[region] || REGION_QUERY['ID'])
  return r.videos
    .filter(v => v.duration?.seconds >= 30 && v.duration?.seconds <= 600)
    .slice(0, 10)
    .map(v => ({
      videoId: v.videoId,
      title: v.title,
      author: v.author?.name || '',
      duration: v.duration?.seconds || 0,
      thumbnail: v.thumbnail?.url || '',
      views: v.views
        ? `${(v.views / 1_000_000).toFixed(1)}M`
        : ''
    }))
}

function applyGenreFilter(songs, genre) {
  if (!genre || genre === 'All') return songs
  const GENRE_KEYWORDS = {
    'Pop': ['pop', 'taylor', 'ariana', 'justin', 'ed sheeran'],
    'Hip-Hop': ['hip hop', 'rap', 'hiphop', 'trap', 'drake', 'kendrick'],
    'R&B': ['r&b', 'rnb', 'soul', 'neo soul'],
    'Rock': ['rock', 'metal', 'band', 'guitar'],
    'Electronic': ['edm', 'electronic', 'dj', 'house', 'techno', 'remix']
  }
  const keywords = GENRE_KEYWORDS[genre] || []
  const filtered = songs.filter(s =>
    keywords.some(k =>
      s.title.toLowerCase().includes(k) ||
      s.author.toLowerCase().includes(k)
    )
  )
  return filtered.length > 0 ? filtered : songs
}

function buildChartEmbed(state) {
  const regionName = REGIONS[state.region] || state.region
  const desc = state.filtered.slice(0, 10).map((s, i) => {
    const dur = s.duration > 0
      ? `${Math.floor(s.duration / 60)}:${String(s.duration % 60).padStart(2, '0')}`
      : '?:??'
    return `**${i + 1}.** ${s.title}\n└ ${s.author} • ${dur} ${s.views ? '• ' + s.views : ''}`
  }).join('\n\n')

  return new EmbedBuilder()
    .setTitle(`🎵 Trending Music — ${regionName}`)
    .setDescription(desc || 'No results')
    .setColor(0xFF0000)
    .setFooter({
      text: state.genre && state.genre !== 'All'
        ? `Genre: ${state.genre} • smusic bot`
        : 'smusic bot'
    })
}

function buildChartComponents(state) {
  const regionSelect = new StringSelectMenuBuilder()
    .setCustomId('chart_region')
    .setPlaceholder('Select region')
    .addOptions(Object.entries(REGIONS).map(([v, l]) =>
      new StringSelectMenuOptionBuilder().setLabel(l).setValue(v)
    ))

  const genreSelect = new StringSelectMenuBuilder()
    .setCustomId('chart_genre')
    .setPlaceholder('Filter by genre')
    .addOptions(GENRES.map(g =>
      new StringSelectMenuOptionBuilder().setLabel(g).setValue(g)
    ))

  const refreshBtn = new ButtonBuilder()
    .setCustomId('chart_refresh')
    .setLabel('🔄 Refresh')
    .setStyle(ButtonStyle.Secondary)

  const playAllBtn = new ButtonBuilder()
    .setCustomId('chart_play_all')
    .setLabel('▶ Play All')
    .setStyle(ButtonStyle.Primary)

  const songOptions = state.filtered.slice(0, 10).map((s, i) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`${i + 1}. ${s.title.slice(0, 80)}`)
      .setValue(s.videoId)
  )

  const songSelect = new StringSelectMenuBuilder()
    .setCustomId('chart_song_pick')
    .setPlaceholder('Pick a song to play')

  if (songOptions.length > 0) {
    songSelect.addOptions(songOptions)
  } else {
    songSelect.addOptions(new StringSelectMenuOptionBuilder().setLabel('No songs').setValue('none'))
    songSelect.setDisabled(true)
  }

  return [
    new ActionRowBuilder().addComponents(regionSelect),
    new ActionRowBuilder().addComponents(genreSelect),
    new ActionRowBuilder().addComponents(refreshBtn, playAllBtn),
    new ActionRowBuilder().addComponents(songSelect)
  ]
}

export async function handleChart(message, args) {
  if (!userInVoice(message)) {
    return message.reply({ embeds: [errorEmbed('Join a voice channel first')] })
  }
  if (!botCanJoin(message.member.voice.channel)) {
    return message.reply({ embeds: [errorEmbed("I don't have permission to join your voice channel")] }).catch(() => {})
  }

  const guildId = message.guild.id
  const { defaultRegion } = getConfig(guildId)
  const loading = await message.reply({ embeds: [infoEmbed('⏳ Fetching trending music...')] })

  let songs = []
  try {
    songs = await fetchTrending(defaultRegion)
  } catch (e) {
    return loading.edit({ embeds: [errorEmbed(`❌ Could not fetch charts: ${e.message}`)] })
  }

  if (!songs.length) {
    return loading.edit({ embeds: [errorEmbed('❌ No trending songs found.')] })
  }

  const state = {
    region: defaultRegion,
    genre: 'All',
    songs,
    filtered: songs.slice(0, 10),
    lastRefresh: Date.now(),
    voiceChannel: message.member.voice.channel,
    textChannel: message.channel,
    guildId
  }

  const reply = await loading.edit({
    embeds: [buildChartEmbed(state)],
    components: buildChartComponents(state)
  })

  chartStateMap.set(reply.id, state)

  const collector = reply.createMessageComponentCollector({
    time: 10 * 60 * 1000
  })

  collector.on('collect', async interaction => {
    const state = chartStateMap.get(reply.id)
    if (!state) return

    await interaction.deferUpdate().catch(() => {})

    if (interaction.customId === 'chart_region') {
      state.region = interaction.values[0]
      try {
        state.songs = await fetchTrending(state.region)
        state.filtered = applyGenreFilter(state.songs, state.genre).slice(0, 10)
        state.lastRefresh = Date.now()
      } catch {}

    } else if (interaction.customId === 'chart_genre') {
      state.genre = interaction.values[0]
      state.filtered = applyGenreFilter(state.songs, state.genre).slice(0, 10)
      if (!state.filtered.length) state.filtered = state.songs.slice(0, 10)

    } else if (interaction.customId === 'chart_refresh') {
      const elapsed = Date.now() - state.lastRefresh
      if (elapsed < REFRESH_COOLDOWN) {
        const secs = Math.ceil((REFRESH_COOLDOWN - elapsed) / 1000)
        await interaction.followUp({
          embeds: [errorEmbed(`Wait ${secs}s before refreshing`)],
          ephemeral: true
        }).catch(() => {})
        return
      }
      try {
        state.songs = await fetchTrending(state.region)
        state.filtered = applyGenreFilter(state.songs, state.genre).slice(0, 10)
        state.lastRefresh = Date.now()
      } catch {}

    } else if (interaction.customId === 'chart_play_all') {
      const { quality } = getConfig(guildId)
      for (const s of state.filtered) {
        addToQueue(guildId, {
          videoId: s.videoId,
          title: s.title,
          url: `https://www.youtube.com/watch?v=${s.videoId}`,
          duration: s.duration,
          thumbnail: s.thumbnail,
          requester: interaction.user.tag,
          quality,
          startTime: null
        })
      }
      if (getPlayerState(guildId) !== 'playing' && getPlayerState(guildId) !== 'paused') {
        playSong(guildId, state.voiceChannel, state.textChannel)
      }
      await interaction.followUp({
        embeds: [infoEmbed(`✅ Added ${state.filtered.length} songs to queue`)],
        ephemeral: true
      }).catch(() => {})
      return

    } else if (interaction.customId === 'chart_song_pick') {
      const videoId = interaction.values[0]
      if (videoId === 'none') return
      const song = state.filtered.find(s => s.videoId === videoId)
      if (!song) return
      const { quality } = getConfig(guildId)
      addToQueue(guildId, {
        videoId: song.videoId,
        title: song.title,
        url: `https://www.youtube.com/watch?v=${song.videoId}`,
        duration: song.duration,
        thumbnail: song.thumbnail,
        requester: interaction.user.tag,
        quality,
        startTime: null
      })
      if (getPlayerState(guildId) !== 'playing' && getPlayerState(guildId) !== 'paused') {
        playSong(guildId, state.voiceChannel, state.textChannel)
      }
      await interaction.followUp({
        embeds: [infoEmbed(`✅ Added: **${song.title}**`)],
        ephemeral: true
      }).catch(() => {})
      return
    }

    chartStateMap.set(reply.id, state)
    await reply.edit({
      embeds: [buildChartEmbed(state)],
      components: buildChartComponents(state)
    }).catch(() => {})
  })

  collector.on('end', () => {
    chartStateMap.delete(reply.id)
    reply.edit({ components: [] }).catch(() => {})
  })
}
