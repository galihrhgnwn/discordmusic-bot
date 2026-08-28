const DISCORD_API = 'https://discord.com/api/v10'
const MAX_STATUS_LENGTH = 500

export async function setVoiceChannelStatus(channelId, status) {
  const token = process.env.DISCORD_TOKEN
  if (!token || !channelId) return false

  const value = typeof status === 'string'
    ? status.trim().slice(0, MAX_STATUS_LENGTH)
    : ''

  try {
    const response = await fetch(`${DISCORD_API}/channels/${channelId}/voice-status`, {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: value })
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.warn(`[ChannelStatus] Discord returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ''}`)
      return false
    }

    return true
  } catch (error) {
    console.warn(`[ChannelStatus] Update failed: ${error.message}`)
    return false
  }
}

export function updateVoiceChannelStatus(channelId, title) {
  const status = title ? `Now playing: ${title}` : 'Not playing anything'
  setVoiceChannelStatus(channelId, status).catch(() => {})
}
