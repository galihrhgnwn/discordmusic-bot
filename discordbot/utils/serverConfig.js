import fs from 'fs';
import path from 'path';

const STORAGE_PATH = './data/serverConfig.json';
const DEFAULTS = { quality: 'high', volume: 100, defaultRegion: 'ID', audioSource: 'default' };

export function load() {
    if (!fs.existsSync(STORAGE_PATH)) return {};
    try {
        return JSON.parse(fs.readFileSync(STORAGE_PATH, 'utf8'));
    } catch (e) {
        return {};
    }
}

export function save(data) {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2));
}

export function getConfig(guildId) {
    const all = load();
    return { ...DEFAULTS, ...(all[guildId] || {}) };
}

export function setConfig(guildId, key, value) {
    const all = load();
    all[guildId] = { ...DEFAULTS, ...(all[guildId] || {}), [key]: value };
    save(all);
}
