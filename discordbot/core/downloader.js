import { getSession } from './sessionManager.js'

const PYTUBE_API = process.env.PYTUBE_API_URL || 'http://dono-03.danbot.host:1386'
const AUDIO_ITAG = process.env.PYTUBE_AUDIO_ITAG || '140'

export const sourceMap = new Map()

async function getInfoFromAPI(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`
  const res = await fetch(
    `${PYTUBE_API}/api/info?url=${encodeURIComponent(url)}`,
    { signal: AbortSignal.timeout(30000) }
  )

  if (!res.ok) {
    throw new Error(`/api/info failed: HTTP ${res.status}`)
  }

  const data = await res.json()
  if (!data.streams) {
    throw new Error('No streams in API response')
  }

  return data
}

/**
 * Opens the remote media proxy and returns its response body as a live stream.
 * Nothing is downloaded to disk; the PytubeDL server proxies the selected format.
 */
export async function streamSong(videoId, _quality = 'high', _startTime = null, _requesterId = null) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`
  const streamUrl = `${PYTUBE_API}/api/stream?url=${encodeURIComponent(youtubeUrl)}&itag=${encodeURIComponent(AUDIO_ITAG)}`

  let lastError
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(streamUrl, {
        signal: AbortSignal.timeout(30000),
        headers: { accept: 'audio/*,application/octet-stream' }
      })

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`)
      }

      sourceMap.set(videoId, `pytubedl-stream:${AUDIO_ITAG}`)
      console.log(`[PytubeDL] Streaming ${videoId} via /api/stream (itag ${AUDIO_ITAG})`)
      return {
        body: res.body,
        contentType: res.headers.get('content-type') || 'application/octet-stream',
        streamUrl
      }
    } catch (error) {
      lastError = error
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  throw new Error(`Audio stream failed: ${lastError?.message || 'unknown error'}`)
}

// Kept as a compatibility alias for callers outside the player.
export const downloadSong = streamSong

export async function getVideoInfo(urlOrId) {
  let videoId
  if (urlOrId.startsWith('http')) {
    try {
      videoId = new URL(urlOrId).searchParams.get('v') ||
                urlOrId.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)?.[1]
    } catch {
      videoId = urlOrId
    }
  } else {
    videoId = urlOrId
  }

  if (!videoId) throw new Error(`Cannot parse video ID from: ${urlOrId}`)

  try {
    const info = await getInfoFromAPI(videoId)
    return {
      videoId,
      title: info.title || 'Unknown',
      duration: info.duration_seconds || 0,
      thumbnail: info.thumbnail_url || '',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      author: info.author || ''
    }
  } catch (e) {
    console.warn('[getVideoInfo] PytubeDL failed, trying youtubei.js:', e.message)
  }

  try {
    const yt = getSession()
    const info = await yt.getBasicInfo(videoId)
    return {
      videoId,
      title: info.basic_info?.title || 'Unknown',
      duration: info.basic_info?.duration || 0,
      thumbnail: info.basic_info?.thumbnail?.[0]?.url || '',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      author: info.basic_info?.author || ''
    }
  } catch (e) {
    console.warn('[getVideoInfo] youtubei.js failed, trying yt-search:', e.message)
  }

  const yts = (await import('yt-search')).default
  const result = await yts({ videoId })
  return {
    videoId,
    title: result.title || 'Unknown',
    duration: result.duration?.seconds || 0,
    thumbnail: result.thumbnail?.url || result.image || '',
    url: `https://www.youtube.com/watch?v=${videoId}`,
    author: result.author?.name || ''
  }
}

export function getAudioItag() {
  return AUDIO_ITAG
}

export function getPytubeApiUrl() {
  return PYTUBE_API
}
