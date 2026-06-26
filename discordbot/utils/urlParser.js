import fetch from 'node-fetch';

export function detectInputType(input) {
  if (/^https?:\/\//.test(input)) {
    if (input.includes('spotify.com')) return 'spotify';
    if (input.includes('list=')) return 'youtube_playlist';
    return 'youtube_video';
  }
  return 'search';
}

export function parseVideoId(url) {
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  throw new Error('Could not parse video ID from URL');
}

export function parsePlaylistId(url) {
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error('Could not parse playlist ID from URL');
  return match[1];
}

export function parseTimestamp(url) {
  const match = url.match(/[?&#]t=([^\s&]+)/);
  if (!match) return null;
  const raw = match[1];

  if (/^\d+$/.test(raw)) return parseInt(raw, 10);

  let seconds = 0;
  const h = raw.match(/(\d+)h/);
  const m = raw.match(/(\d+)m/);
  const s = raw.match(/(\d+)s/);
  if (h) seconds += parseInt(h[1], 10) * 3600;
  if (m) seconds += parseInt(m[1], 10) * 60;
  if (s) seconds += parseInt(s[1], 10);
  return seconds > 0 ? seconds : null;
}

export async function fetchSpotifyTitle(url) {
  const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error('Could not get Spotify track info');
  const data = await res.json();
  return data.title.replace(' - ', ' ');
}
