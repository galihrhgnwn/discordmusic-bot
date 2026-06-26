export function userInVoice(message) {
    return !!message.member?.voice?.channel;
}

export function botCanJoin(voiceChannel) {
    if (!voiceChannel) return false;
    const perms = voiceChannel.permissionsFor(voiceChannel.guild.members.me);
    return perms.has('Connect') && perms.has('Speak');
}
