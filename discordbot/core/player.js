import { joinVoiceChannel, createAudioPlayer, createAudioResource,
         AudioPlayerStatus, StreamType, VoiceConnectionStatus } from '@discordjs/voice'
import { createReadStream } from 'fs'
import fs from 'fs'
import ffmpegPath from 'ffmpeg-static'

if (ffmpegPath) process.env.FFMPEG_PATH = ffmpegPath

import { downloadSong } from './downloader.js'
import * as queue from './queue.js'
import { nowPlayingEmbed, infoEmbed, errorEmbed } from '../utils/embeds.js'
import { getConfig } from '../utils/serverConfig.js'
import { isAutoplay, setAutoplay } from './autoplayManager.js'
import { handleAutoplay } from './autoplay.js'

export const playerMap       = new Map()   // guildId → AudioPlayer
export const connectionMap   = new Map()   // guildId → VoiceConnection
export const idleTimerMap    = new Map()   // guildId → Timeout
export const songStartMap    = new Map()   // guildId → Date.now()
export const voiceChannelMap = new Map()   // guildId → VoiceChannel
export const textChannelMap  = new Map()   // guildId → TextChannel
export const keepJoinMap     = new Map()   // keepJoin functionality

// Detect format dari ekstensi file
function getStreamType(filePath) {
  if (!filePath) return StreamType.Arbitrary
  if (filePath.endsWith('.webm')) return StreamType.WebmOpus
  if (filePath.endsWith('.opus')) return StreamType.OggOpus
  return StreamType.Arbitrary   // mp4/m4a/mp3
}

export async function playSong(guildId, voiceChannel, textChannel) {
  const song = queue.getCurrentSong(guildId)
  if (!song) {
    textChannel.send({ embeds: [infoEmbed('✅ Queue ended.')] }).catch(() => {})
    scheduleDisconnect(guildId, textChannel)
    return
  }

  // Simpan channel references untuk autoplay
  voiceChannelMap.set(guildId, voiceChannel)
  textChannelMap.set(guildId, textChannel)

  // Join voice channel
  let connection = connectionMap.get(guildId)
  if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    })
    connectionMap.set(guildId, connection)
  }

  // Download audio
  let downloadResult
  try {
    const { sourceMap } = await import('./downloader.js')
    downloadResult = await downloadSong(song.videoId, song.quality, song.startTime, song.requesterId)
    song.source = sourceMap.get(song.videoId) || 'unknown'
  } catch (e) {
    textChannel.send({ embeds: [errorEmbed(`❌ Download failed: ${e.message}`)] }).catch(() => {})
    queue.skipSong(guildId)
    return playSong(guildId, voiceChannel, textChannel)
  }

  // Create or reuse AudioPlayer
  let player = playerMap.get(guildId)
  if (!player) {
    player = createAudioPlayer()
    playerMap.set(guildId, player)

    player.on(AudioPlayerStatus.Idle, async () => {
      clearIdleTimer(guildId)

      const finishedSong = queue.getCurrentSong(guildId)
      if (finishedSong) queue.addToHistory(guildId, finishedSong)

      if (queue.isLooping(guildId)) {
        const current = queue.getCurrentSong(guildId)
        queue.skipSong(guildId)
        const q = queue.getQueue(guildId)
        q.unshift(current)
        queue.queueMap.set(guildId, q)
        return playSong(
          guildId,
          voiceChannelMap.get(guildId),
          textChannelMap.get(guildId)
        )
      }

      queue.skipSong(guildId)

      if (queue.getQueue(guildId).length > 0) {
        return playSong(
          guildId,
          voiceChannelMap.get(guildId),
          textChannelMap.get(guildId)
        )
      }

      // Queue kosong → cek autoplay
      if (isAutoplay(guildId) && finishedSong) {
        await handleAutoplay(
          guildId,
          voiceChannelMap.get(guildId),
          textChannelMap.get(guildId),
          finishedSong,
          finishedSong.requesterId
        )
      } else {
        textChannelMap.get(guildId)?.send({
          embeds: [infoEmbed('✅ Queue ended.')]
        }).catch(() => {})
        scheduleDisconnect(guildId, textChannelMap.get(guildId))
      }
    })

    player.on('error', (e) => {
      console.error('[Player] Error:', e.message)
      textChannelMap.get(guildId)?.send({
        embeds: [errorEmbed(`Player error: ${e.message}`)]
      }).catch(() => {})
      queue.skipSong(guildId)
      playSong(
        guildId,
        voiceChannelMap.get(guildId),
        textChannelMap.get(guildId)
      )
    })
  }

  // Apply volume
  const { volume } = getConfig(guildId)
  
  const filePath = downloadResult.filePath
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filePath}`)
  }
  const input = createReadStream(filePath)
  const streamType = getStreamType(filePath)
  
  const resource = createAudioResource(input, {
    inputType: streamType,
    inlineVolume: true
  })
  if (resource.volume) {
    resource.volume.setVolume(volume / 100)
  }

  player.play(resource)
  connection.subscribe(player)
  clearIdleTimer(guildId)

  // Catat waktu mulai lagu
  songStartMap.set(guildId, Date.now())

  // Pre-download lagu berikutnya di background
  const nextSong = queue.getQueue(guildId)[1]
  if (nextSong) {
    downloadSong(nextSong.videoId, nextSong.quality, nextSong.startTime, nextSong.requesterId)
      .catch(e => console.warn('[Player] Pre-download failed:', e.message))
  }

  // Kirim Now Playing embed dengan metadata lengkap
  const currentQueue = queue.getQueue(guildId)
  const extra = {
    loop: queue.isLooping(guildId),
    autoplay: isAutoplay(guildId),
    queueLength: currentQueue.length,
    position: 1
  }

  await textChannel.send({
    embeds: [nowPlayingEmbed(song, extra)]
  }).catch(() => {})
}

export function pausePlayer(guildId) {
  playerMap.get(guildId)?.pause()
}

export function resumePlayer(guildId) {
  playerMap.get(guildId)?.unpause()
}

export function stopPlayer(guildId) {
  playerMap.get(guildId)?.stop()
  queue.clearQueue(guildId)
  setAutoplay(guildId, false)   // reset autoplay saat stop
  destroyConnection(guildId)
}

export function skip(guildId) {
    const player = playerMap.get(guildId);
    if (player) {
        player.stop(); // Triggers idle event naturally
    } else {
        queue.skipSong(guildId);
    }
}

export function setVolume(guildId, volume) {
  const player = playerMap.get(guildId)
  if (player?.state?.resource?.volume) {
    player.state.resource.volume.setVolume(volume / 100)
  }
}

export function getPlayerState(guildId) {
  const player = playerMap.get(guildId)
  if (!player) return 'disconnected'
  switch (player.state.status) {
    case AudioPlayerStatus.Playing: return 'playing'
    case AudioPlayerStatus.Paused:  return 'paused'
    case AudioPlayerStatus.Idle:    return 'idle'
    default:                        return 'disconnected'
  }
}

export function getSongStartTime(guildId) {
  return songStartMap.get(guildId) || Date.now()
}

export function destroyConnection(guildId) {
  connectionMap.get(guildId)?.destroy()
  connectionMap.delete(guildId)
  playerMap.delete(guildId)
  songStartMap.delete(guildId)
  voiceChannelMap.delete(guildId)
  textChannelMap.delete(guildId)
  clearIdleTimer(guildId)
}

export function scheduleDisconnect(guildId, textChannel) {
  clearIdleTimer(guildId)
  if (keepJoinMap.get(guildId)) return;
  const timer = setTimeout(() => {
    destroyConnection(guildId)
    textChannel?.send({ embeds: [infoEmbed('👋 Disconnected due to inactivity.')] }).catch(() => {})
  }, 5 * 60 * 1000)
  idleTimerMap.set(guildId, timer)
}

export function clearIdleTimer(guildId) {
  if (idleTimerMap.has(guildId)) {
    clearTimeout(idleTimerMap.get(guildId))
    idleTimerMap.delete(guildId)
  }
}
