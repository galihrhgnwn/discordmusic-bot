import { describe, it } from 'node:test';
import assert from 'node:assert';
import { detectInputType } from './urlParser.js';

describe('detectInputType', () => {
  it('should return search for plain text', () => {
    assert.strictEqual(detectInputType('hello world'), 'search');
    assert.strictEqual(detectInputType('just some search query'), 'search');
  });

  it('should return spotify for spotify URLs', () => {
    assert.strictEqual(detectInputType('https://open.spotify.com/track/123'), 'spotify');
    assert.strictEqual(detectInputType('http://spotify.com/album/456'), 'spotify');
  });

  it('should return youtube_playlist for URLs with list parameter', () => {
    assert.strictEqual(detectInputType('https://www.youtube.com/watch?v=123&list=PL456'), 'youtube_playlist');
    assert.strictEqual(detectInputType('https://youtube.com/playlist?list=PL456'), 'youtube_playlist');
  });

  it('should return youtube_video for other HTTP/HTTPS URLs', () => {
    assert.strictEqual(detectInputType('https://www.youtube.com/watch?v=123'), 'youtube_video');
    assert.strictEqual(detectInputType('http://youtu.be/123'), 'youtube_video');
    assert.strictEqual(detectInputType('https://example.com'), 'youtube_video'); // Current behavior fallback
  });
});
