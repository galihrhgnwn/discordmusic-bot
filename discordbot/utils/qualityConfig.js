export const VALID_QUALITIES = ['low', 'medium', 'high', 'lossless'];

export function validateQuality(input) {
  return VALID_QUALITIES.includes(input) ? input : 'high';
}

export function getBitrate(quality) {
  const map = { low: '64', medium: '128', high: '320', lossless: '320' };
  return map[quality] || '320';
}

export function getExt(quality) {
  return 'mp3';
}
