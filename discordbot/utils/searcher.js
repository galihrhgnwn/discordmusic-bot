import yts from 'yt-search';

const PREFIXES = ['artist:', 'short:', 'long:'];

export function parsePrefix(rawQuery) {
  for (const prefix of PREFIXES) {
    if (rawQuery.toLowerCase().startsWith(prefix)) {
      return {
        mode: prefix.replace(':', ''),
        cleanQuery: rawQuery.slice(prefix.length).trim()
      };
    }
  }
  return { mode: null, cleanQuery: rawQuery.trim() };
}

const MUSIC_KEYWORDS = ['music', 'song', 'lyrics', 'official', 'audio', 'mv', 'lagu']

export async function searchSongs(rawQuery, requesterId = null, audioSource = 'default') {
  const { mode, cleanQuery } = parsePrefix(rawQuery)

  let results = []

  if (audioSource === 'lavalink') {
      try {
          const { searchLavalink } = await import('../core/lavalinkManager.js');
          results = await searchLavalink(cleanQuery);
          // Apply filters
          if (mode === 'artist') {
            results = results.filter(v =>
              v.author.toLowerCase().includes(cleanQuery.toLowerCase())
            )
          } else if (mode === 'short') {
            results = results.filter(v => v.duration < 300 && v.duration > 30)
          } else if (mode === 'long') {
            results = results.filter(v => v.duration > 600)
          }
          return results;
      } catch (e) {
          console.warn('[Searcher] Lavalink search failed, falling back to default:', e.message);
      }
  }

  // Prioritas 1: YouTube Music search via InnerTube
  try {
    const { getUserSession } = await import('../core/userSessionManager.js')
    const { getSession } = await import('../core/sessionManager.js')
    
    let yt = null
    if (requesterId) {
      yt = await getUserSession(requesterId)
    }
    if (!yt) {
      yt = getSession()
    }

    const ytmResults = await yt.music.search(cleanQuery, { type: 'song' })

    const songs = ytmResults?.songs?.contents || []
    results = songs
      .filter(s => s.id)
      .map(s => {
      // title bisa berupa string atau object
      const title = typeof s.title === 'string'
        ? s.title
        : s.title?.text || s.title?.runs?.[0]?.text || 'Unknown'

      // artists bisa array atau object
      const author = Array.isArray(s.artists)
        ? s.artists.map(a => a.name || a.text || '').join(', ')
        : s.artist?.name || s.artists?.name || ''

      // duration
      const duration = s.duration?.seconds
        || s.duration
        || 0

      const durationStr = s.duration?.text
        || (duration > 0
          ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`
          : '?:??')

      // views
      const views = s.views
        || s.view_count?.text
        || s.short_view_count?.text
        || ''

      // thumbnail
      const thumbnail = s.thumbnail?.contents?.[0]?.url
        || s.thumbnail?.[0]?.url
        || s.thumbnails?.[0]?.url
        || ''

      return {
        videoId: s.id,
        title,
        author,
        duration,
        durationStr,
        thumbnail,
        url: `https://www.youtube.com/watch?v=${s.id}`,
        views
      }
    })
    .filter(s => s.title !== 'Unknown' || s.videoId)
  } catch (e) {
    console.warn('[Searcher] YouTube Music search failed, using yt-search:', e.message)
  }

  // Fallback: yt-search jika YTMusic gagal
  if (!results.length) {
    const MUSIC_KEYWORDS = ['music', 'song', 'lyrics', 'official', 'audio', 'lagu']
    const hasKeyword = MUSIC_KEYWORDS.some(k => cleanQuery.toLowerCase().includes(k))
    const searchQuery = (!hasKeyword && !mode) ? `${cleanQuery} official audio` : cleanQuery

    const r = await yts(searchQuery)
    results = r.videos
      .filter(v => {
        const secs = v.duration?.seconds || 0
        return secs >= 30 && secs <= 600
      })
      .slice(0, 10)
      .map(v => ({
        videoId: v.videoId,
        title: v.title,
        author: v.author?.name || '',
        duration: v.duration?.seconds || 0,
        durationStr: v.duration?.timestamp || '?:??',
        thumbnail: v.thumbnail?.url || '',
        url: v.url,
        views: v.views
          ? v.views >= 1_000_000
            ? `${(v.views / 1_000_000).toFixed(1)}M`
            : `${(v.views / 1_000).toFixed(0)}K`
          : ''
      }))
  }

  // Apply filters
  if (mode === 'artist') {
    results = results.filter(v =>
      v.author.toLowerCase().includes(cleanQuery.toLowerCase())
    )
  } else if (mode === 'short') {
    results = results.filter(v => v.duration < 300 && v.duration > 30)
  } else if (mode === 'long') {
    results = results.filter(v => v.duration > 600)
  }

  results.sort((a, b) => (b.views || 0) - (a.views || 0))
  return results.slice(0, 25)
}

export function formatViews(views) {
  if (!views) return ''
  if (typeof views === 'string') return views
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`
  if (views >= 1_000) return `${(views / 1_000).toFixed(0)}K views`
  return String(views)
}
