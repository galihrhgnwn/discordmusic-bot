import { test, describe } from 'node:test';
import assert from 'node:assert';
import { parsePlaylistId } from '../utils/urlParser.js';

describe('parsePlaylistId', () => {
  test('should parse playlist ID from simple valid URLs', () => {
    assert.strictEqual(
      parsePlaylistId('https://www.youtube.com/playlist?list=PL_test_id'),
      'PL_test_id'
    );
  });

  test('should parse playlist ID from multi-parameter URLs', () => {
    assert.strictEqual(
      parsePlaylistId('https://www.youtube.com/watch?v=123&list=PLabc123'),
      'PLabc123'
    );
    assert.strictEqual(
      parsePlaylistId('https://www.youtube.com/watch?v=123&list=PLabc123&index=2'),
      'PLabc123'
    );
  });

  test('should throw error if URL does not contain list ID', () => {
    assert.throws(() => {
      parsePlaylistId('https://www.youtube.com/watch?v=123');
    }, new Error('Could not parse playlist ID from URL'));

    assert.throws(() => {
      parsePlaylistId('https://www.youtube.com/');
    }, new Error('Could not parse playlist ID from URL'));
  });
});
