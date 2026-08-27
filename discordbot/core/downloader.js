import fs from 'fs'
import path from 'path'
import { hasCache, getCachePath, enforceLimit } from '../utils/cacheManager.js'
import { getSession } from './sessionManager.js'

const PYTUBE_API = process.env.PYTUBE_API_URL || 'http://dono-03.danbot.host:1386'

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


async function downloadViaPytube(videoId) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`
  const downloadUrl = `${PYTUBE_API}/api/download/audio?url=${encodeURIComponent(youtubeUrl)}&format=m4a`
  console.log(`[PytubeDL] Downloading audio for ${videoId}`)

  let res
  let retries = 2
  while (retries >= 0) {
    try {
      res = await fetch(downloadUrl, {
        signal: AbortSignal.timeout(180000)
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      break
    } catch (e) {
      if (retries === 0) throw new Error(`Audio download failed: ${e.message}`)
      console.warn(`[PytubeDL] /api/download/audio failed, retrying... (${e.message})`)
      await new Promise(resolve => setTimeout(resolve, 1000))
      retries--
    }
  }

  const contentType = res.headers.get('content-type') || ''
  const ext = contentType.includes('webm') ? 'webm' : 'm4a'
  const filePath = `./cache/${videoId}.${ext}`
  const writeStream = fs.createWriteStream(filePath)
  const reader = res.body.getReader()

  await new Promise((resolve, reject) => {
    const pump = () => reader.read()
      .then(({ done, value }) => {
        if (done) {
          writeStream.end(resolve)
          return
        }
        if (!writeStream.write(Buffer.from(value))) {
          writeStream.once('drain', pump)
        } else {
          pump()
        }
      })
      .catch(error => {
        writeStream.destroy()
        reject(error)
      })
    pump()
  })

  if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 10000) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    throw new Error('Downloaded file too small or missing')
  }

  const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2)
  console.log(`[PytubeDL] Downloaded ${videoId}  ${sizeMB}MB`)
  sourceMap.set(videoId, 'pytube')
  return { filePath }
}


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
