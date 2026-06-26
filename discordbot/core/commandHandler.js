import { errorEmbed } from '../utils/embeds.js';

const commands = new Map();

export function registerCommand(name, handler) {
    commands.set(name.toLowerCase(), handler);
}

export async function handleMessage(message) {
    let content = message.content.trim();
    if (content.startsWith('!audio ')) {
        content = '!smusic ' + content.slice(1);
    }

    if (!content.startsWith('!smusic ')) return;

    const args = content.slice('!smusic'.length).trim().split(/ +/);
    if (args.length === 0) return;

    const commandName = args[0].toLowerCase();
    const handler = commands.get(commandName);

    if (handler) {
        try {
            await handler(message, args.slice(1));
        } catch (e) {
            console.error(e);
            await message.reply({ embeds: [errorEmbed(`Error executing command: ${e.message}`)] }).catch(() => {});
        }
    } else {
        const playHandler = commands.get('play');
        if (playHandler) {
            try {
                await playHandler(message, args);
            } catch (e) {
                console.error(e);
                await message.reply({ embeds: [errorEmbed(`Error executing command: ${e.message}`)] }).catch(() => {});
            }
        }
    }
}
