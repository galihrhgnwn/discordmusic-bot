import { parseVideoId } from './urlParser.js';
import assert from 'assert';
import { describe, it } from 'node:test';

describe('parseVideoId', () => {
  it('should parse youtu.be URLs', () => {
    assert.strictEqual(parseVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  it('should parse youtube.com/watch?v= URLs', () => {
    assert.strictEqual(parseVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  it('should parse URLs with other query parameters', () => {
    assert.strictEqual(parseVideoId('https://www.youtube.com/watch?foo=bar&v=dQw4w9WgXcQ&baz=qux'), 'dQw4w9WgXcQ');
  });

  it('should throw an error for invalid URLs', () => {
    assert.throws(() => parseVideoId('https://www.google.com'), Error);
  });
});
