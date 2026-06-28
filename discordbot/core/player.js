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
import { getSource, setSource } from './audioSourceManager.js'
import * as lavalinkManager from './lavalinkManager.js'
import { logError } from '../utils/logger.js';

export const playerMap       = new Map()   // guildId → AudioPlayer
export const connectionMap   = new Map()   // guildId → VoiceConnection
export const idleTimerMap    = new Map()   // guildId → Timeout
export const songStartMap    = new Map()   // guildId → Date.now()
export const voiceChannelMap = new Map()   // guildId → VoiceChannel
export const textChannelMap  = new Map()   // guildId → TextChannel
export const keepJoinMap     = new Map()   // keepJoin functionality
export const isSwitchingBackendMap = new Map() // guildId → Boolean

// Detect format dari ekstensi file
function getStreamType(filePath) {
  if (!filePath) return StreamType.Arbitrary
  if (filePath.endsWith('.webm')) return StreamType.WebmOpus
  if (filePath.endsWith('.opus')) return StreamType.OggOpus
  return StreamType.Arbitrary   // mp4/m4a/mp3
}

export async function playSong(guildId, voiceChannel, textChannel) {
  const source = getSource(guildId)
  if (source === 'lavalink') {
    if (!lavalinkManager.isLavalinkAvailable()) {
      textChannel.send({ embeds: [errorEmbed('❌ Lavalink is selected but not available. Falling back to default.')] }).catch(() => {})
      return playSongDefault(guildId, voiceChannel, textChannel)
    }
    const song = queue.getCurrentSong(guildId)
    if (!song) return
    return lavalinkManager.playSongLavalink(guildId, voiceChannel, textChannel, song).catch(e => {
        textChannel.send({ embeds: [errorEmbed(`Lavalink Error: ${e.message}`)] }).catch(() => {})
        return playSongDefault(guildId, voiceChannel, textChannel)
    })
  }

  return playSongDefault(guildId, voiceChannel, textChannel)
}

export async function playSongDefault(guildId, voiceChannel, textChannel) {
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
      if (isSwitchingBackendMap.get(guildId)) {
          // If we are switching backend, do not skip song or process idle events.
          isSwitchingBackendMap.delete(guildId)
          return;
      }
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
      logError('[Player] Error:', e.message)
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
  if (getSource(guildId) === 'lavalink') {
      return lavalinkManager.pauseLavalink(guildId)
  }
  playerMap.get(guildId)?.pause()
}

export function resumePlayer(guildId) {
  if (getSource(guildId) === 'lavalink') {
      return lavalinkManager.resumeLavalink(guildId)
  }
  playerMap.get(guildId)?.unpause()
}

export function stopPlayer(guildId) {
  queue.clearQueue(guildId)
  setAutoplay(guildId, false)   // reset autoplay saat stop
  if (getSource(guildId) === 'lavalink') {
      lavalinkManager.stopLavalink(guildId)
  } else {
      playerMap.get(guildId)?.stop()
  }
  destroyConnection(guildId)
}

export function skip(guildId) {
    if (getSource(guildId) === 'lavalink') {
        if (lavalinkManager.getLavalinkPlayerState(guildId) !== 'disconnected') {
            lavalinkManager.skipLavalink(guildId)
            return;
        }
        queue.skipSong(guildId);
        return;
    }
    const player = playerMap.get(guildId);
    if (player) {
        player.stop(); // Triggers idle event naturally
    } else {
        queue.skipSong(guildId);
    }
}

export function setVolume(guildId, volume) {
  if (getSource(guildId) === 'lavalink') {
      return lavalinkManager.setLavalinkVolume(guildId, volume)
  }
  const player = playerMap.get(guildId)
  if (player?.state?.resource?.volume) {
    player.state.resource.volume.setVolume(volume / 100)
  }
}

export function getPlayerState(guildId) {
  if (getSource(guildId) === 'lavalink') {
      return lavalinkManager.getLavalinkPlayerState(guildId)
  }
  const player = playerMap.get(guildId)
  if (!player) return 'disconnected'
  switch (player.state.status) {
    case AudioPlayerStatus.Playing: return 'playing'
    case AudioPlayerStatus.Paused:  return 'paused'
    case AudioPlayerStatus.Idle:    return 'idle'
    default:                        return 'disconnected'
  }
}

export async function switchBackend(guildId, newSource, textChannel, voiceChannel) {
    setSource(guildId, newSource);

    // Check state of the old backend implicitly by getting state before we change fully
    const currentState = getPlayerState(guildId);

    // Set switching flag so default player doesn't advance queue
    isSwitchingBackendMap.set(guildId, true);
    setTimeout(() => isSwitchingBackendMap.delete(guildId), 2000); // prevent state leak

    // Stop old backends gracefully
    playerMap.get(guildId)?.stop();
    lavalinkManager.stopLavalink(guildId);
    destroyConnection(guildId);

    // If there is a song in queue, try to restart playback on new backend
    if (queue.getCurrentSong(guildId) && voiceChannel) {
        await playSong(guildId, voiceChannel, textChannel);
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
