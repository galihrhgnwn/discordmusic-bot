import fs from 'fs'
import path from 'path'
import { hasCache, getCachePath, enforceLimit } from '../utils/cacheManager.js'
import { getSession } from './sessionManager.js'

const PYTUBE_API = 'https://pytube.nowhere.qzz.io'

export const sourceMap = new Map()

// ─── Pilih itag audio terbaik ──────────────────────────────────

function pickBestAudioItag(streams) {
  const all = [
    ...(streams.adaptive || []),
    ...(streams.progressive || [])
  ]

  // Filter audio only
  const audioOnly = all.filter(s =>
    s.mime_type?.startsWith('audio/') &&
    (s.resolution === null || s.resolution === undefined)
  )

  if (audioOnly.length > 0) {
    // Sort by filesize_mb descending — terbesar = kualitas tertinggi
    audioOnly.sort((a, b) => (b.filesize_mb || 0) - (a.filesize_mb || 0))
    return audioOnly[0].itag
  }

  // Fallback: progressive terbesar
  const progressive = all.filter(s => s.mime_type?.startsWith('video/'))
  if (progressive.length > 0) {
    progressive.sort((a, b) => (b.filesize_mb || 0) - (a.filesize_mb || 0))
    return progressive[0].itag
  }

  return null
}

// ─── Get info via PytubeDL API ─────────────────────────────────

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

// ─── Download via PytubeDL API ─────────────────────────────────

// Helper: coba itag lain jika itag utama gagal
function tryFallbackItag(streams, failedItag) {
  const all = [
    ...(streams.adaptive || []),
    ...(streams.progressive || [])
  ]
  const audioOnly = all.filter(s =>
    s.mime_type?.startsWith('audio/') &&
    s.itag !== failedItag &&
    (s.resolution === null || s.resolution === undefined)
  )
  audioOnly.sort((a, b) => (b.filesize_mb || 0) - (a.filesize_mb || 0))
  return audioOnly[0]?.itag || null
}

async function downloadViaPytube(videoId) {
  console.log(`[PytubeDL] Fetching info for ${videoId}`)

  // Step 1: Get info dengan retry
  let info
  let retries = 2
  while (retries >= 0) {
    try {
      info = await getInfoFromAPI(videoId)
      break
    } catch (e) {
      if (retries === 0) throw e
      console.warn(`[PytubeDL] /api/info failed, retrying... (${e.message})`)
      await new Promise(r => setTimeout(r, 2000))
      retries--
    }
  }

  // Step 2: Pilih itag audio terbaik
  const itag = pickBestAudioItag(info.streams)
  if (!itag) {
    throw new Error(`No suitable audio stream found for ${videoId}`)
  }

  console.log(`[PytubeDL] Selected itag: ${itag} for ${videoId}`)

  // Step 3: Download dari /api/download
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`
  const downloadUrl = `${PYTUBE_API}/api/download?url=${encodeURIComponent(youtubeUrl)}&itag=${itag}`

  let res
  retries = 2
  while (retries >= 0) {
    try {
      res = await fetch(downloadUrl, {
        signal: AbortSignal.timeout(180000)
      })

      if (res.status === 500) {
        // 500 = pytubefix failed — coba itag lain
        throw new Error(`HTTP 500 — trying fallback itag`)
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      break
    } catch (e) {
      if (retries === 0) {
        // Coba itag fallback sebelum throw
        const fallbackItag = tryFallbackItag(info.streams, itag)
        if (fallbackItag) {
          console.warn(`[PytubeDL] Primary itag failed, trying fallback itag: ${fallbackItag}`)
          const fallbackUrl = `${PYTUBE_API}/api/download?url=${encodeURIComponent(youtubeUrl)}&itag=${fallbackItag}`
          res = await fetch(fallbackUrl, { signal: AbortSignal.timeout(180000) })
          if (!res.ok) throw new Error(`Fallback also failed: HTTP ${res.status}`)
        } else {
          throw new Error(`Download failed: ${e.message}`)
        }
      } else {
        await new Promise(r => setTimeout(r, 1000))
        retries--
      }
    }
  }

  // Tentukan ekstensi dari content-type
  const contentType = res.headers.get('content-type') || ''
  const ext = contentType.includes('webm') ? 'webm'
    : contentType.includes('mp4') ? 'mp4'
    : contentType.includes('audio') ? 'mp4'
    : 'mp4'

  const filePath = `./cache/${videoId}.${ext}`

  // Step 4: Stream ke file
  const writeStream = fs.createWriteStream(filePath)
  const reader = res.body.getReader()

  await new Promise((resolve, reject) => {
    const pump = () => reader.read()
      .then(({ done, value }) => {
        if (done) { writeStream.end(); resolve(); return }
        writeStream.write(Buffer.from(value))
        pump()
      })
      .catch(err => { writeStream.destroy(); reject(err) })
    pump()
  })

  // Validasi file
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 10000) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    throw new Error('Downloaded file too small or missing')
  }

  const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2)
  console.log(`[PytubeDL] ✅ ${videoId} — itag ${itag} — ${sizeMB}MB`)

  sourceMap.set(videoId, 'pytube')
  return { filePath }
}

// ─── MAIN: downloadSong ────────────────────────────────────────

export async function downloadSong(videoId, quality, startTime = null, requesterId = null) {
  if (hasCache(videoId)) {
    console.log(`[Downloader] Cache hit: ${videoId}`)
    return { filePath: getCachePath(videoId) }
  }

  try {
    const result = await downloadViaPytube(videoId)
    enforceLimit()
    return result
  } catch (e) {
    throw new Error(`Download failed for ${videoId}: ${e.message}`)
  }
}

// ─── getVideoInfo ──────────────────────────────────────────────

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

  // Prioritas 1: PytubeDL API
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

  // Prioritas 2: youtubei.js
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

  // Prioritas 3: yt-search
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
