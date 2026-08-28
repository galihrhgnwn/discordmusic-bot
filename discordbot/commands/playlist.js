import { getUserSession, isUserLoggedIn } from '../core/userSessionManager.js'
import { addToQueue, getQueue } from '../core/queue.js'
import { getConfig } from '../utils/serverConfig.js'
import { playSong, getPlayerState } from '../core/player.js'
import { infoEmbed, errorEmbed, formatDuration } from '../utils/embeds.js'
import {
  EmbedBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ButtonBuilder, ButtonStyle
} from 'discord.js'
import { userInVoice } from '../utils/checkPermissions.js'

async function requireLogin(message) {
  const userId = message.author.id
  if (!isUserLoggedIn(userId)) {
    await message.reply({ embeds: [
      new EmbedBuilder()
        .setDescription(
          ` You need to connect your YouTube account first.\n` +
          `Run \`/auth login\` to get started.`
        )
        .setColor(0xFF0000)
        .setFooter({ text: 'smusic bot' })
    ] })
    return false
  }
  return true
}

export async function handlePlaylist(message, args) {
  const sub = args[0]?.toLowerCase()
  const userId = message.author.id

  switch (sub) {
    case 'list':
    case undefined:
      return handlePlaylistList(message, userId)

    case 'play':
      return handlePlaylistPlay(message, userId, args.slice(1).join(' '))

    case 'search':
      return handlePlaylistSearch(message, userId, args.slice(1).join(' '))

    default:
      return message.reply({ embeds: [errorEmbed(
        'Usage:\n' +
        '`/playlist list`  List your playlists\n' +
        '`/playlist play <nama>`  Play a playlist\n' +
        '`/playlist search <nama>`  Search playlist by name'
      )] })
  }
}

function textValue(value, fallback = '') {
  if (typeof value === 'string') return value
  if (value?.text) return value.text
  if (value?.runs) return value.runs.map(run => run.text || '').join('')
  if (typeof value?.toString === 'function' && value.toString() !== '[object Object]') {
    return value.toString()
  }
  return fallback
}

async function fetchUserPlaylists(yt) {
  try {
    const feed = await yt.music.getPlaylists()
    const playlists = Array.from(feed?.playlists || [])

    return playlists
      .filter(playlist => playlist?.id)
      .slice(0, 50)
      .map(playlist => ({
        id: playlist.id,
        title: textValue(playlist.title, 'Unknown Playlist'),
        subtitle: {
          text: textValue(
            playlist.video_count_short || playlist.video_count,
            ''
          )
        }
      }))
      .filter(playlist => playlist.id && playlist.title)
  } catch (error) {
    console.error('[Playlist] fetchUserPlaylists error:', error.message)
    throw new Error(`Cannot fetch playlists: ${error.message}`)
  }
}

async function handlePlaylistList(message, userId) {
  if (!await requireLogin(message)) return

  const loading = await message.reply({ embeds: [infoEmbed(' Fetching your playlists...')] })

  try {
    const yt = await getUserSession(userId)
    const playlists = await fetchUserPlaylists(yt)

    if (!playlists.length) {
      return loading.edit({ embeds: [errorEmbed('No playlists found in your YouTube Music library.')] })
    }

    const desc = playlists.slice(0, 20).map((p, i) => {
      const name = p.title || 'Unknown'
      const count = p.subtitle?.text || '? songs'
      return `**${i + 1}.** ${name}\n ${count}`
    }).join('\n\n')

    const embed = new EmbedBuilder()
      .setTitle(' Your YouTube Music Playlists')
      .setDescription(desc)
      .setColor(0xFF0000)
      .setFooter({ text: `${playlists.length} playlist(s)  smusic bot` })

    const options = playlists.slice(0, 25).map(p =>
      new StringSelectMenuOptionBuilder()
        .setLabel(p.title?.slice(0, 100) || 'Unknown')
        .setDescription(p.subtitle?.text?.slice(0, 100) || '')
        .setValue(p.id || p.playlist_id || '')
    ).filter(o => o.data.value)

    if (options.length) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('playlist_pick')
        .setPlaceholder('Pick a playlist to play')
        .addOptions(options)

      const row = new ActionRowBuilder().addComponents(selectMenu)
      const reply = await loading.edit({ embeds: [embed], components: [row] })

      const collector = reply.createMessageComponentCollector({
        filter: i => i.user.id === message.author.id && i.customId === 'playlist_pick',
        time: 60_000,
        max: 1
      })

      collector.on('collect', async interaction => {
        await interaction.deferUpdate()
        const playlistId = interaction.values[0]
        await loadAndQueuePlaylist(message, userId, playlistId, null, reply)
      })

      collector.on('end', (_, reason) => {
        if (reason === 'time') reply.edit({ components: [] }).catch(() => {})
      })
    } else {
      await loading.edit({ embeds: [embed] })
    }

  } catch (e) {
    console.error('[Playlist] List error:', e)
    await loading.edit({ embeds: [errorEmbed(`Failed to fetch playlists: ${e.message}`)] })
  }
}

async function handlePlaylistPlay(message, userId, query) {
  if (!await requireLogin(message)) return
  if (!userInVoice(message)) {
    return message.reply({ embeds: [errorEmbed('Join a voice channel first')] })
  }
  if (!query) {
    return message.reply({ embeds: [errorEmbed('Provide a playlist name. Usage: `/playlist play <nama>`')] })
  }

  const loading = await message.reply({ embeds: [infoEmbed(' Searching your playlists...')] })

  try {
    const yt = await getUserSession(userId)
    const playlists = await fetchUserPlaylists(yt)

    const match = playlists.find(p =>
      p.title?.toLowerCase().includes(query.toLowerCase())
    )

    if (!match) {
      return loading.edit({ embeds: [errorEmbed(
        `Playlist "${query}" not found in your library.\n` +
        `Run \`/playlist list\` to see your playlists.`
      )] })
    }

    const playlistId = match.id || match.playlist_id
    await loadAndQueuePlaylist(message, userId, playlistId, match.title, loading)

  } catch (e) {
    console.error('[Playlist] Play error:', e)
    await loading.edit({ embeds: [errorEmbed(`Failed: ${e.message}`)] })
  }
}

async function handlePlaylistSearch(message, userId, query) {
  if (!await requireLogin(message)) return
  if (!query) {
    return message.reply({ embeds: [errorEmbed('Provide a search query.')] })
  }

  const loading = await message.reply({ embeds: [infoEmbed(` Searching playlists for "${query}"...`)] })

  try {
    const yt = await getUserSession(userId)

    const searchResult = await yt.music.search(query, { type: 'playlist' })
    const playlists = searchResult?.playlists?.contents || []

    if (!playlists.length) {
      return loading.edit({ embeds: [errorEmbed(`No playlists found for "${query}"`)] })
    }

    const desc = playlists.slice(0, 5).map((p, i) => {
      const name = p.title || 'Unknown'
      const author = p.author?.name || ''
      const count = p.song_count || ''
      return `**${i + 1}.** ${name}\n ${author}${count ? '  ' + count + ' songs' : ''}`
    }).join('\n\n')

    const embed = new EmbedBuilder()
      .setTitle(` Playlist Search: "${query}"`)
      .setDescription(desc)
      .setColor(0xFF0000)
      .setFooter({ text: 'smusic bot' })

    const buttons = playlists.slice(0, 5).map((_, i) =>
      new ButtonBuilder()
        .setCustomId(`playlist_search_${i}`)
        .setLabel(String(i + 1))
        .setStyle(ButtonStyle.Secondary)
    )
    const row = new ActionRowBuilder().addComponents(buttons)
    const reply = await loading.edit({ embeds: [embed], components: [row] })

    const collector = reply.createMessageComponentCollector({
      filter: i =>
        i.user.id === message.author.id &&
        i.customId.startsWith('playlist_search_'),
      time: 30_000,
      max: 1
    })

    collector.on('collect', async interaction => {
      if (!userInVoice(message)) {
        return interaction.reply({
          embeds: [errorEmbed('Join a voice channel first')],
          ephemeral: true
        })
      }
      const index = parseInt(interaction.customId.replace('playlist_search_', ''))
      const picked = playlists[index]
      const disabledRow = new ActionRowBuilder().addComponents(
        buttons.map(b => ButtonBuilder.from(b).setDisabled(true))
      )
      await interaction.update({ components: [disabledRow] })
      const playlistId = picked.id || picked.playlist_id
      await loadAndQueuePlaylist(message, userId, playlistId, picked.title, null)
    })

    collector.on('end', (_, reason) => {
      if (reason === 'time') reply.edit({ components: [] }).catch(() => {})
    })

  } catch (e) {
    console.error('[Playlist] Search error:', e)
    await loading.edit({ embeds: [errorEmbed(`Failed: ${e.message}`)] })
  }
}

async function loadAndQueuePlaylist(message, userId, playlistId, playlistTitle, editTarget) {
  const guildId = message.guild.id

  try {
    const yt = await getUserSession(userId)
    const pl = await yt.music.getPlaylist(playlistId)
    const songs = pl?.contents || pl?.tracks || []

    if (!songs.length) {
      const embed = errorEmbed('This playlist is empty.')
      if (editTarget) return editTarget.edit({ embeds: [embed], components: [] })
      return message.channel.send({ embeds: [embed] })
    }

    const { quality } = getConfig(guildId)
    const title = playlistTitle || pl?.header?.title?.text || 'Playlist'

    let added = 0
    for (const s of songs) {
      try {
        const videoId = s.id || s.videoId
        if (!videoId) continue

        const title = typeof s.title === 'string'
          ? s.title
          : s.title?.text || s.title?.runs?.[0]?.text || 'Unknown'

        const thumbnail = s.thumbnail?.contents?.[0]?.url
          || s.thumbnail?.[0]?.url
          || s.thumbnails?.[0]?.url
          || ''

        addToQueue(guildId, {
          videoId,
          title,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          duration: s.duration?.seconds || s.duration || 0,
          thumbnail,
          requester: message.author.tag,
          requesterId: message.author.id,
          quality,
          startTime: null
        })
        added++
      } catch (songErr) {
        console.warn('[Playlist] Skip song due to error:', songErr.message)
        continue
      }
    }

    const successEmbed = new EmbedBuilder()
      .setTitle(` ${title}`)
      .setDescription(` Added **${added}** songs to queue`)
      .setColor(0xFF0000)
      .setFooter({ text: 'smusic bot' })

    if (editTarget) {
      await editTarget.edit({ embeds: [successEmbed], components: [] })
    } else {
      await message.channel.send({ embeds: [successEmbed] })
    }

    if (getPlayerState(guildId) !== 'playing' && getPlayerState(guildId) !== 'paused') {
      await playSong(guildId, message.member.voice.channel, message.channel)
    }

  } catch (e) {
    console.error('[Playlist] Load error:', e)
    const embed = errorEmbed(`Failed to load playlist: ${e.message}`)
    if (editTarget) editTarget.edit({ embeds: [embed], components: [] }).catch(() => {})
    else message.channel.send({ embeds: [embed] }).catch(() => {})
  }
}
