import fs from 'fs';
import path from 'path';

const CACHE_DIR = './cache';
const MAX_CACHE_MB = 500;

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export function hasCache(videoId) {
  const exts = ['mp4', 'webm', 'mp3', 'opus', 'ogg', 'm4a']
  return exts.some(ext => 
    fs.existsSync(path.join(CACHE_DIR, `${videoId}.${ext}`))
  )
}

export function getCachePath(videoId) {
  const exts = ['mp4', 'webm', 'mp3', 'opus', 'ogg', 'm4a']
  for (const ext of exts) {
    const p = path.join(CACHE_DIR, `${videoId}.${ext}`)
    if (fs.existsSync(p)) return p
  }
  return null
}

export function enforceLimit() {
  const files = fs.readdirSync(CACHE_DIR).map(file => {
    const filePath = path.join(CACHE_DIR, file);
    const stats = fs.statSync(filePath);
    return { path: filePath, size: stats.size, mtime: stats.mtime.getTime() };
  });

  let totalSize = files.reduce((acc, file) => acc + file.size, 0);
  const maxBytes = MAX_CACHE_MB * 1024 * 1024;

  if (totalSize > maxBytes) {
    files.sort((a, b) => a.mtime - b.mtime);

    for (const file of files) {
      if (totalSize <= maxBytes) break;
      fs.unlinkSync(file.path);
      totalSize -= file.size;
    }
  }
}

export function deleteFile(videoId) {
  const filePath = getCachePath(videoId);
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
