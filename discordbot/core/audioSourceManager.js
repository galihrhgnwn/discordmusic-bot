import { getConfig, setConfig } from '../utils/serverConfig.js';
import { isLavalinkAvailable } from './lavalinkManager.js';

export function getSource(guildId) {
    const { audioSource } = getConfig(guildId);
    return audioSource || 'default';
}

export function setSource(guildId, source) {
    if (source !== 'default' && source !== 'lavalink') {
        throw new Error('Invalid audio source');
    }
    setConfig(guildId, 'audioSource', source);
}

export { isLavalinkAvailable };
