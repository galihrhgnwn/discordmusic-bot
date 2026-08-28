import { errorEmbed } from '../utils/embeds.js';
import { logError } from '../utils/logger.js';
import { getArguments, interactionMessage } from './slashCommands.js';

const commands = new Map();

export function registerCommand(name, handler) {
    commands.set(name.toLowerCase(), handler);
}

async function executeCommand(name, message, args) {
    const handler = commands.get(name.toLowerCase());
    if (handler) {
        await handler(message, args);
        return;
    }

    const playHandler = commands.get('play');
    if (playHandler) await playHandler(message, [name, ...args]);
}

export async function handleInteraction(interaction) {
    const message = interactionMessage(interaction);
    const args = getArguments(interaction);

    try {
        await executeCommand(interaction.commandName, message, args);
    } catch (e) {
        logError(e);
        const payload = { embeds: [errorEmbed(`Error executing command: ${e.message}`)], ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(payload).catch(() => {});
        } else {
            await interaction.reply(payload).catch(() => {});
        }
    }
}

function messageArguments(content) {
    return content.match(/[^\s"]+|"[^"]*"/g)?.map(value =>
        value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value
    ) || [];
}

export async function handleMessage(message) {
    if (!message || message.author?.bot || typeof message.content !== 'string') return;
    if (!message.content.startsWith('!')) return;

    const parts = messageArguments(message.content.slice(1).trim());
    const name = parts.shift()?.toLowerCase();
    if (!name || !commands.has(name)) return;

    try {
        await executeCommand(name, message, parts);
    } catch (e) {
        logError(e);
        await message.reply({ embeds: [errorEmbed(`Error executing command: ${e.message}`)] }).catch(() => {});
    }
}
