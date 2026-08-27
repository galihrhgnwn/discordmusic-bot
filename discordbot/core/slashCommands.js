import { REST, Routes, SlashCommandBuilder } from 'discord.js';

export const slashCommands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song, playlist, or media URL')
    .addStringOption(option => option.setName('query').setDescription('Song title, playlist, or URL').setRequired(true)),
  new SlashCommandBuilder()
    .setName('chart')
    .setDescription('Browse trending music')
    .addStringOption(option => option.setName('region').setDescription('Chart region code, for example US').setRequired(false))
    .addStringOption(option => option.setName('genre').setDescription('Chart genre').setRequired(false)),
  new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Manage your YouTube Music playlists')
    .addSubcommand(sub => sub.setName('list').setDescription('List your playlists'))
    .addSubcommand(sub => sub.setName('play').setDescription('Play a playlist').addStringOption(option => option.setName('query').setDescription('Playlist name').setRequired(true)))
    .addSubcommand(sub => sub.setName('search').setDescription('Search for playlists').addStringOption(option => option.setName('query').setDescription('Search query').setRequired(true))),
  new SlashCommandBuilder().setName('download').setDescription('Download the current song'),
  new SlashCommandBuilder().setName('recommend').setDescription('Get recommendations based on the current song'),
  new SlashCommandBuilder().setName('help').setDescription('Show the command list'),
  new SlashCommandBuilder().setName('keepjoin').setDescription('Keep the bot in the voice channel'),
  new SlashCommandBuilder().setName('quitjoin').setDescription('Disable persistent voice channel mode'),
  new SlashCommandBuilder()
    .setName('audio')
    .setDescription('Choose the audio backend')
    .addStringOption(option => option.setName('source').setDescription('Audio backend').setRequired(true).addChoices(
      { name: 'Default', value: 'default' },
      { name: 'Lavalink', value: 'lavalink' }
    )),
  new SlashCommandBuilder().setName('pause').setDescription('Pause playback'),
  new SlashCommandBuilder().setName('resume').setDescription('Resume playback'),
  new SlashCommandBuilder().setName('skip').setDescription('Skip the current song'),
  new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue'),
  new SlashCommandBuilder().setName('loop').setDescription('Toggle loop mode'),
  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set the playback volume')
    .addIntegerOption(option => option.setName('level').setDescription('Volume from 1 to 100').setMinValue(1).setMaxValue(100).setRequired(true)),
  new SlashCommandBuilder()
    .setName('quality')
    .setDescription('Set playback quality')
    .addStringOption(option => option.setName('level').setDescription('Quality level').setRequired(true).addChoices(
      { name: 'Low', value: 'low' },
      { name: 'Medium', value: 'medium' },
      { name: 'High', value: 'high' },
      { name: 'Lossless', value: 'lossless' }
    )),
  new SlashCommandBuilder().setName('autoplay').setDescription('Toggle autoplay'),
  new SlashCommandBuilder().setName('now').setDescription('Show the current song'),
  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('View or manage the queue')
    .addSubcommand(sub => sub.setName('view').setDescription('View the current queue'))
    .addSubcommand(sub => sub.setName('clear').setDescription('Clear the queue'))
    .addSubcommand(sub => sub.setName('remove').setDescription('Remove a queue item').addIntegerOption(option => option.setName('index').setDescription('Queue item number').setMinValue(1).setRequired(true))),
  new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the queue'),
  new SlashCommandBuilder().setName('history').setDescription('Show playback history'),
].map(command => command.toJSON());

function getArguments(interaction) {
  const name = interaction.commandName;
  const options = interaction.options;
  if (name === 'play') return [options.getString('query')];
  if (name === 'chart') return [options.getString('region'), options.getString('genre')].filter(Boolean);
  if (name === 'playlist') {
    const subcommand = options.getSubcommand(false);
    const query = options.getString('query');
    return query ? [subcommand, query] : [subcommand];
  }
  if (name === 'audio') return ['source', options.getString('source')];
  if (name === 'volume') return [String(options.getInteger('level'))];
  if (name === 'quality') return [options.getString('level')];
  if (name === 'queue') {
    const subcommand = options.getSubcommand(false);
    if (subcommand === 'remove') return ['remove', String(options.getInteger('index'))];
    if (subcommand === 'clear') return ['clear'];
    return [];
  }
  return [];
}

function interactionMessage(interaction) {
  const author = {
    id: interaction.user.id,
    tag: interaction.user.tag,
    username: interaction.user.username,
  };
  return {
    author,
    user: interaction.user,
    guild: interaction.guild,
    member: interaction.member,
    channel: interaction.channel,
    reply: async payload => {
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp(payload);
      }
      return interaction.reply({ ...payload, fetchReply: true });
    },
  };
}

export async function registerSlashCommands(client, log = console.log) {
  if (!process.env.DISCORD_TOKEN || !client.user) return;
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const guildId = process.env.DISCORD_GUILD_ID;
  const route = guildId
    ? Routes.applicationGuildCommands(client.user.id, guildId)
    : Routes.applicationCommands(client.user.id);
  await rest.put(route, { body: slashCommands });
  log(`[Discord] Registered ${slashCommands.length} slash commands ${guildId ? `for guild ${guildId}` : 'globally'}.`);
}

export { getArguments, interactionMessage };
