import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getSource } from '../core/audioSourceManager.js';
import { switchBackend, voiceChannelMap } from '../core/player.js';

export async function handleAudioCommand(message, args) {
    if (args[0] !== 'source') {
        return; // we only handle `!smusic audio source`
    }

    const guildId = message.guild.id;
    let currentSource = getSource(guildId);

    const generateEmbed = (source) => {
        return new EmbedBuilder()
            .setTitle('🔊 Audio Backend Selection')
            .setDescription(`Currently active audio source: **${source}**\n\nChoose the backend you want to use for this server.`)
            .setColor(0xFF0000)
            .setFooter({ text: 'smusic bot' });
    };

    const generateRow = (source) => {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('audio_source_default')
                .setLabel('Default')
                .setStyle(source === 'default' ? ButtonStyle.Success : ButtonStyle.Primary)
                .setDisabled(source === 'default'),
            new ButtonBuilder()
                .setCustomId('audio_source_lavalink')
                .setLabel('Lavalink')
                .setStyle(source === 'lavalink' ? ButtonStyle.Success : ButtonStyle.Primary)
                .setDisabled(source === 'lavalink')
        );
    };

    const msg = await message.reply({
        embeds: [generateEmbed(currentSource)],
        components: [generateRow(currentSource)]
    });

    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async (i) => {
        if (i.user.id !== message.author.id) {
            return i.reply({ content: 'Not your command', ephemeral: true });
        }

        const newSource = i.customId === 'audio_source_default' ? 'default' : 'lavalink';
        currentSource = newSource;

        try {
            const voiceChannel = message.member?.voice?.channel || voiceChannelMap.get(guildId) || null;
            await switchBackend(guildId, newSource, message.channel, voiceChannel);

            await i.update({
                embeds: [generateEmbed(currentSource)],
                components: [generateRow(currentSource)]
            });
        } catch (e) {
            await i.reply({ content: `Error switching backend: ${e.message}`, ephemeral: true });
        }
    });

    collector.on('end', () => {
        msg.edit({ components: [] }).catch(() => {});
    });
}
