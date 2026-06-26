import { EmbedBuilder } from 'discord.js'
import { errorEmbed, infoEmbed } from '../utils/embeds.js'
import { Innertube, UniversalCache } from 'youtubei.js'
import {
  isUserLoggedIn,
  getUserProfile,
  saveUserCredentials,
  removeUserCredentials
} from '../core/userSessionManager.js'

export async function handleAuth(message, args) {
  const action = args[0]?.toLowerCase()
  const userId = message.author.id
  const username = message.author.tag

  // ─── LOGIN ──────────────────────────────────────────────────────
  if (action === 'login') {
    // Sudah login?
    if (isUserLoggedIn(userId)) {
      const profile = getUserProfile(userId)
      return message.reply({ embeds: [
        new EmbedBuilder()
          .setDescription(
            `✅ Already logged in as **${profile?.accountName || 'Unknown'}**.\n` +
            `Run \`!smusic auth logout\` to disconnect.`
          )
          .setColor(0xFF0000)
          .setFooter({ text: 'smusic bot' })
      ] })
    }

    const { createPendingAuth } = await import('../core/userSessionManager.js');
    const token = createPendingAuth(userId);
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
    const loginUrl = `${dashboardUrl}/auth/cookie?token=${token}`;

    const embed = new EmbedBuilder()
      .setTitle('🔐 Connect YouTube to smusic bot')
      .setDescription(
        `Click the link below to connect your YouTube cookies:\n\n` +
        `**[👉 Click Here to Connect](${loginUrl})**\n\n` +
        `⏰ Link expires in **30 minutes**.\n` +
        `⚠️ Do not share this link with anyone.`
      )
      .setColor(0xFF0000)
      .setFooter({ text: 'smusic bot • Your cookies are stored securely' });

    try {
      await message.author.send({ embeds: [embed] });
      await message.reply({ embeds: [infoEmbed('📩 Check your DMs for the login link!')] });
    } catch(e) {
      // If DMs are closed, reply in the channel instead
      await message.reply({ embeds: [embed] });
    }
  }

  // ─── LOGOUT ─────────────────────────────────────────────────────
  else if (action === 'logout') {
    if (!isUserLoggedIn(userId)) {
      return message.reply({ embeds: [errorEmbed('❌ You are not logged in.')] })
    }

    removeUserCredentials(userId)
    return message.reply({ embeds: [infoEmbed('✅ Logged out successfully.')] })
  }

  // ─── STATUS ─────────────────────────────────────────────────────
  else if (action === 'status') {
    const loggedIn = isUserLoggedIn(userId)
    const profile = getUserProfile(userId)

    const embed = new EmbedBuilder()
      .setTitle('🔐 Your Auth Status')
      .setColor(0xFF0000)
      .setFooter({ text: 'smusic bot' })
      .addFields(
        {
          name: 'Status',
          value: loggedIn ? '✅ Logged in' : '❌ Not logged in',
          inline: true
        },
        {
          name: 'Account',
          value: profile?.accountName || 'N/A',
          inline: true
        },
        {
          name: 'Email',
          value: profile?.accountEmail || 'N/A',
          inline: true
        },
        {
          name: 'Login Time',
          value: profile?.loginTime
            ? new Date(profile.loginTime).toLocaleString()
            : 'N/A',
          inline: true
        },
        {
          name: 'Algorithm',
          value: loggedIn
            ? '🎵 YouTube Music (personalized)'
            : '📺 YouTube (generic)',
          inline: true
        }
      )

    if (!loggedIn) {
      embed.setDescription(
        `Not connected. Run \`!smusic auth login\` to personalize your experience.`
      )
    }

    return message.reply({ embeds: [embed] })
  }

  else {
    return message.reply({ embeds: [errorEmbed(
      'Unknown action. Use: `login`, `logout`, `status`'
    )] })
  }
}
