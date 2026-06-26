// Lavalink stub implementation
// Lavalink is not fully integrated yet, but this service layer isolates the
// integration from the rest of the existing code.

export function isLavalinkAvailable() {
    return false;
}

export async function playSongLavalink(guildId, voiceChannel, textChannel, song) {
    throw new Error('Lavalink is not configured or available.');
}

export function pauseLavalink(guildId) {
    // Stub
}

export function resumeLavalink(guildId) {
    // Stub
}

export function stopLavalink(guildId) {
    // Stub
}

export function skipLavalink(guildId) {
    // Stub
}

export function setLavalinkVolume(guildId, volume) {
    // Stub
}

export function getLavalinkPlayerState(guildId) {
    return 'disconnected';
}

export function destroyLavalinkConnection(guildId) {
    // Stub
}
