import { getSession } from './sessionManager.js'
import { getUserSession } from './userSessionManager.js'
import { addToQueue } from './queue.js'
import { getConfig } from '../utils/serverConfig.js'
import { playSong, destroyConnection } from './player.js'
import { infoEmbed, errorEmbed } from '../utils/embeds.js'
import yts from 'yt-search'

function isMusicContent(item) {
  const title = (item.title?.text || item.title || '').toLowerCase()
  const duration = item.duration?.seconds || 0
  if (duration > 600 || (duration > 0 && duration < 30)) return false
  const NON_MUSIC = [
    'podcast', 'episode', 'interview', 'reaction',
    'gameplay', 'tutorial', 'review', 'vlog',
    'trailer', 'clip', 'highlight'
  ]
  return !NON_MUSIC.some(w => title.includes(w))
}

export async function handleAutoplay(guildId, voiceChannel, textChannel, lastSong, requesterId = null) {
  try {
    await textChannel.send({
      embeds: [infoEmbed('🎵 Finding next song via YouTube Music algorithm...')]
    })

    const yt = requesterId
      ? (await getUserSession(requesterId)) || getSession()
      : getSession()

    let relatedSongs = []

    const strategies = [
      {
        name: 'YouTube Music radio',
        fn: async () => {
          const watchPlaylist = await yt.music.getWatchPlaylist({
            videoId: lastSong.videoId,
            radio: true
          })
          const tracks = watchPlaylist?.tracks || []
          return tracks
            .slice(1, 6)
            .filter(t => t.id)
            .map(t => ({
              videoId: t.id,
              title: t.title?.text || t.title || 'Unknown',
              duration: t.duration?.seconds || 0,
              thumbnail: t.thumbnail?.[0]?.url ||
                         t.thumbnail?.contents?.[0]?.url || '',
              url: `https://www.youtube.com/watch?v=${t.id}`,
              author: t.artists?.map(a => a.name).join(', ') || ''
            }))
        }
      },
      {
        name: 'YouTube watch_next_feed',
        fn: async () => {
          const info = await yt.getInfo(lastSong.videoId)
          return (info.watch_next_feed || [])
            .filter(item => item.type === 'CompactVideo' && item.id)
            .filter(isMusicContent)
            .slice(0, 5)
            .map(item => ({
              videoId: item.id,
              title: item.title?.text || 'Unknown',
              duration: item.duration?.seconds || 0,
              thumbnail: item.thumbnail?.[0]?.url || '',
              url: `https://www.youtube.com/watch?v=${item.id}`,
              author: item.author?.name || ''
            }))
        }
      },
      {
        name: 'yt-search fallback',
        fn: async () => {
          const r = await yts(`${lastSong.title} official audio`)
          return r.videos
            .filter(v => v.videoId !== lastSong.videoId)
            .filter(v => v.duration?.seconds >= 30 && v.duration?.seconds <= 600)
            .slice(0, 5)
            .map(v => ({
              videoId: v.videoId,
              title: v.title,
              duration: v.duration?.seconds || 0,
              thumbnail: v.thumbnail?.url || '',
              url: v.url,
              author: v.author?.name || ''
            }))
        }
      }
    ]

    for (const strategy of strategies) {
      try {
        const songs = await strategy.fn()
        if (songs && songs.length > 0) {
          relatedSongs = songs
          console.log(`[Autoplay] Got ${relatedSongs.length} songs from ${strategy.name}`)
          break
        }
      } catch (e) {
        console.warn(`[Autoplay] ${strategy.name} failed:`, e.message)
      }
    }

    if (!relatedSongs.length) {
      await textChannel.send({
        embeds: [errorEmbed('❌ Could not find related songs for autoplay.')]
      })
      destroyConnection(guildId)
      return
    }

    const { quality } = getConfig(guildId)

    // Add max 3 lagu ke queue
    for (const s of relatedSongs.slice(0, 3)) {
      addToQueue(guildId, {
        videoId: s.videoId,
        title: s.title,
        url: s.url,
        duration: s.duration,
        thumbnail: s.thumbnail,
        requester: '🤖 Autoplay',
        quality,
        startTime: null
      })
    }

    await playSong(guildId, voiceChannel, textChannel)

  } catch (e) {
    console.error('[Autoplay] Fatal error:', e)
    await textChannel.send({
      embeds: [errorEmbed(`Autoplay error: ${e.message}`)]
    })
    destroyConnection(guildId)
  }
}
