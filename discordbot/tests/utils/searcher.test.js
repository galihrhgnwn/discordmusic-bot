import { parsePrefix } from '../../utils/searcher.js';

describe('parsePrefix', () => {
  it('should parse artist prefix correctly', () => {
    const result = parsePrefix('artist: the beatles');
    expect(result).toEqual({ mode: 'artist', cleanQuery: 'the beatles' });
  });

  it('should parse short prefix correctly', () => {
    const result = parsePrefix('short: rap god');
    expect(result).toEqual({ mode: 'short', cleanQuery: 'rap god' });
  });

  it('should parse long prefix correctly', () => {
    const result = parsePrefix('long: lo-fi mix');
    expect(result).toEqual({ mode: 'long', cleanQuery: 'lo-fi mix' });
  });

  it('should handle prefixes case-insensitively', () => {
    const result = parsePrefix('ARTIST: the beatles');
    expect(result).toEqual({ mode: 'artist', cleanQuery: 'the beatles' });
  });

  it('should strip leading and trailing whitespace from the query', () => {
    const result = parsePrefix('artist:   the beatles   ');
    expect(result).toEqual({ mode: 'artist', cleanQuery: 'the beatles' });
  });

  it('should return null mode if no prefix is provided', () => {
    const result = parsePrefix('the beatles');
    expect(result).toEqual({ mode: null, cleanQuery: 'the beatles' });
  });

  it('should strip whitespace when no prefix is provided', () => {
    const result = parsePrefix('   the beatles   ');
    expect(result).toEqual({ mode: null, cleanQuery: 'the beatles' });
  });

  it('should handle empty string correctly', () => {
    const result = parsePrefix('');
    expect(result).toEqual({ mode: null, cleanQuery: '' });
  });

  it('should handle just the prefix correctly', () => {
    const result = parsePrefix('artist:');
    expect(result).toEqual({ mode: 'artist', cleanQuery: '' });
  });
});
