const autoplayMap = new Map();

export function setAutoplay(guildId, enabled) {
    autoplayMap.set(guildId, enabled);
}

export function isAutoplay(guildId) {
    return autoplayMap.get(guildId) || false;
}
