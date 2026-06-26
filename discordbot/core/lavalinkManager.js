import { Shoukaku, Connectors } from 'shoukaku';
import * as queue from './queue.js';
import { nowPlayingEmbed, infoEmbed, errorEmbed } from '../utils/embeds.js';
import { getConfig } from '../utils/serverConfig.js';
import { isAutoplay, setAutoplay } from './autoplayManager.js';
import { handleAutoplay } from './autoplay.js';
import { keepJoinMap, clearIdleTimer, scheduleDisconnect, songStartMap, destroyConnection as destroyDefaultConnection, voiceChannelMap, textChannelMap } from './player.js';

let shoukaku = null;
const lavalinkPlayers = new Map(); // guildId -> ShoukakuPlayer

export function initLavalink(client) {
    const nodes = [{
        name: process.env.LAVALINK_NAME || 'Node 1',
        url: process.env.LAVALINK_URL || 'localhost:2333',
        auth: process.env.LAVALINK_AUTH || 'youshallnotpass',
        secure: process.env.LAVALINK_SECURE === 'true'
    }];

    shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
        moveOnDisconnect: false,
        resume: false
    });

    shoukaku.on('error', (_, error) => console.error('[Shoukaku] Error:', error));
    shoukaku.on('ready', (name) => console.log(`[Shoukaku] Lavalink Node: ${name} is now connected`));
    shoukaku.on('disconnect', (name, count) => console.warn(`[Shoukaku] Lavalink Node: ${name} disconnected. Reconnecting in ${count} attempts`));
}

export function isLavalinkAvailable() {
    return shoukaku && shoukaku.nodes.size > 0;
}

export async function playSongLavalink(guildId, voiceChannel, textChannel, song) {
    if (!isLavalinkAvailable()) throw new Error('Lavalink is not connected');

    // Save channel references
    voiceChannelMap.set(guildId, voiceChannel);
    textChannelMap.set(guildId, textChannel);

    let player = lavalinkPlayers.get(guildId);

    if (!player) {
        const node = shoukaku.options.nodeResolver(shoukaku.nodes);
        if (!node) throw new Error('No Lavalink nodes available');

        player = await shoukaku.joinVoiceChannel({
            guildId,
            channelId: voiceChannel.id,
            shardId: 0
        });

        lavalinkPlayers.set(guildId, player);

        player.on('end', async (data) => {
            if (data.reason === 'REPLACED') return; // backend switch or fast skip

            clearIdleTimer(guildId);
            const finishedSong = queue.getCurrentSong(guildId);
            if (finishedSong) queue.addToHistory(guildId, finishedSong);

            if (queue.isLooping(guildId)) {
                const current = queue.getCurrentSong(guildId);
                queue.skipSong(guildId);
                const q = queue.getQueue(guildId);
                q.unshift(current);
                queue.queueMap.set(guildId, q);
                return playSongLavalink(guildId, voiceChannelMap.get(guildId), textChannelMap.get(guildId), queue.getCurrentSong(guildId)).catch(console.error);
            }

            queue.skipSong(guildId);

            if (queue.getQueue(guildId).length > 0) {
                return playSongLavalink(guildId, voiceChannelMap.get(guildId), textChannelMap.get(guildId), queue.getCurrentSong(guildId)).catch(console.error);
            }

            // Queue empty -> Autoplay check
            if (isAutoplay(guildId) && finishedSong) {
                await handleAutoplay(
                    guildId,
                    voiceChannelMap.get(guildId),
                    textChannelMap.get(guildId),
                    finishedSong,
                    finishedSong.requesterId
                );
            } else {
                textChannelMap.get(guildId)?.send({
                    embeds: [infoEmbed('✅ Queue ended.')]
                }).catch(() => {});

                // Disconnect logic
                scheduleDisconnect(guildId, textChannelMap.get(guildId));
            }
        });

        player.on('error', (err) => {
            console.error('[Lavalink Player] Error:', err);
            textChannelMap.get(guildId)?.send({
                embeds: [errorEmbed(`Lavalink Player error: ${err.message}`)]
            }).catch(() => {});
            queue.skipSong(guildId);
            const nextSong = queue.getCurrentSong(guildId);
            if(nextSong) playSongLavalink(guildId, voiceChannelMap.get(guildId), textChannelMap.get(guildId), nextSong).catch(console.error);
        });
    }

    const node = shoukaku.options.nodeResolver(shoukaku.nodes);
    let trackToPlay = null;

    try {
        // Resolve song url/id via Lavalink REST
        const searchResult = await node.rest.resolve(song.url || `ytsearch:${song.title}`);
        if (!searchResult || !searchResult.data) {
            throw new Error('Track not found on Lavalink');
        }

        if (searchResult.loadType === 'track') {
            trackToPlay = searchResult.data.encoded;
        } else if (searchResult.loadType === 'playlist') {
            trackToPlay = searchResult.data.tracks[0].encoded;
        } else if (searchResult.loadType === 'search') {
            trackToPlay = searchResult.data[0].encoded;
        } else {
            throw new Error(`Failed to load track (Type: ${searchResult.loadType})`);
        }
    } catch (e) {
        textChannel.send({ embeds: [errorEmbed(`❌ Lavalink resolution failed: ${e.message}`)] }).catch(() => {});
        queue.skipSong(guildId);
        const nextSong = queue.getCurrentSong(guildId);
        if(nextSong) return playSongLavalink(guildId, voiceChannel, textChannel, nextSong);
        return;
    }

    const { volume } = getConfig(guildId);

    await player.playTrack({ track: trackToPlay });
    await player.setGlobalVolume(volume);
    clearIdleTimer(guildId);
    songStartMap.set(guildId, Date.now());

    const currentQueue = queue.getQueue(guildId);
    const extra = {
        loop: queue.isLooping(guildId),
        autoplay: isAutoplay(guildId),
        queueLength: currentQueue.length,
        position: 1
    };

    await textChannel.send({
        embeds: [nowPlayingEmbed(song, extra)]
    }).catch(() => {});
}

export function pauseLavalink(guildId) {
    const player = lavalinkPlayers.get(guildId);
    if (player) player.setPaused(true);
}

export function resumeLavalink(guildId) {
    const player = lavalinkPlayers.get(guildId);
    if (player) player.setPaused(false);
}

export function stopLavalink(guildId) {
    const player = lavalinkPlayers.get(guildId);
    if (player) {
        player.stopTrack(); // triggers 'end' event? No, we might want to just destroy.
        shoukaku.leaveVoiceChannel(guildId);
        lavalinkPlayers.delete(guildId);
    }
}

export function skipLavalink(guildId) {
    const player = lavalinkPlayers.get(guildId);
    if (player) {
        player.stopTrack();
    } else {
        queue.skipSong(guildId);
    }
}

export function setLavalinkVolume(guildId, volume) {
    const player = lavalinkPlayers.get(guildId);
    if (player) player.setGlobalVolume(volume);
}

export function getLavalinkPlayerState(guildId) {
    const player = lavalinkPlayers.get(guildId);
    if (!player) return 'disconnected';
    if (player.paused) return 'paused';
    if (player.track) return 'playing';
    return 'idle';
}

export function destroyLavalinkConnection(guildId) {
    if (lavalinkPlayers.has(guildId)) {
        shoukaku.leaveVoiceChannel(guildId);
        lavalinkPlayers.delete(guildId);
    }
}
