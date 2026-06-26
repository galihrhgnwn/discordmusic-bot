const cooldownMap = new Map();
const CHECK_MS = 2000;

export function isOnCooldown(userId, command) {
    const key = `${userId}:${command}`;
    const last = cooldownMap.get(key) || 0;
    return Date.now() - last < CHECK_MS;
}

export function setCooldown(userId, command) {
    cooldownMap.set(`${userId}:${command}`, Date.now());
}

export function getRemainingSeconds(userId, command) {
    const key = `${userId}:${command}`;
    const last = cooldownMap.get(key) || 0;
    return Math.ceil((CHECK_MS - (Date.now() - last)) / 1000);
}
