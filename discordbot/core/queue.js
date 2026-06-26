export const queueMap = new Map();
export const historyMap = new Map();
export const loopMap = new Map();

export function addToQueue(guildId, song) {
    if (!queueMap.has(guildId)) queueMap.set(guildId, []);
    queueMap.get(guildId).push(song);
}

export function getQueue(guildId) {
    return queueMap.get(guildId) || [];
}

export function getCurrentSong(guildId) {
    return getQueue(guildId)[0] || null;
}

export function skipSong(guildId) {
    const q = getQueue(guildId);
    q.shift();
    queueMap.set(guildId, q);
    return getCurrentSong(guildId);
}

export function clearQueue(guildId) {
    queueMap.set(guildId, []);
}

export function removeFromQueue(guildId, index) {
    const q = getQueue(guildId);
    if (index < 1 || index > q.length) throw new Error('Invalid index');
    const removed = q.splice(index - 1, 1)[0];
    queueMap.set(guildId, q);
    return removed;
}

export function shuffleQueue(guildId) {
    const q = getQueue(guildId);
    if (q.length <= 1) return;
    const current = q[0];
    const rest = q.slice(1);
    for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    queueMap.set(guildId, [current, ...rest]);
}

export function setLoop(guildId, bool) {
    loopMap.set(guildId, bool);
}

export function isLooping(guildId) {
    return loopMap.get(guildId) || false;
}

export function addToHistory(guildId, song) {
    if (!historyMap.has(guildId)) historyMap.set(guildId, []);
    const h = historyMap.get(guildId);
    h.unshift(song);
    if (h.length > 10) h.pop();
    historyMap.set(guildId, h);
}

export function getHistory(guildId) {
    return historyMap.get(guildId) || [];
}
