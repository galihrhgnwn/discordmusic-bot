import fs from 'fs';
import path from 'path';

const STORAGE_PATH = './data/serverConfig.json';
const DEFAULTS = { quality: 'high', volume: 100, defaultRegion: 'ID', audioSource: 'default' };

let cache = null;

export function load() {
    if (cache !== null) return cache;
    if (!fs.existsSync(STORAGE_PATH)) {
        cache = {};
        return cache;
    }
    try {
        cache = JSON.parse(fs.readFileSync(STORAGE_PATH, 'utf8'));
        return cache;
    } catch (e) {
        cache = {};
        return cache;
    }
}

export function save(data) {
    cache = data;
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
