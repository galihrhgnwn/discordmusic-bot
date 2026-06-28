import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { VALID_QUALITIES, validateQuality, getBitrate, getExt } from './qualityConfig.js';

describe('qualityConfig', () => {
  describe('VALID_QUALITIES', () => {
    test('should contain exactly the supported qualities', () => {
      assert.deepEqual(VALID_QUALITIES, ['low', 'medium', 'high', 'lossless']);
    });
  });

  describe('validateQuality', () => {
    test('should return the input if it is a valid quality', () => {
      assert.equal(validateQuality('low'), 'low');
      assert.equal(validateQuality('medium'), 'medium');
      assert.equal(validateQuality('high'), 'high');
      assert.equal(validateQuality('lossless'), 'lossless');
    });

    test('should return "high" if input is invalid', () => {
      assert.equal(validateQuality('superhigh'), 'high');
      assert.equal(validateQuality(''), 'high');
      assert.equal(validateQuality('invalid'), 'high');
      assert.equal(validateQuality(null), 'high');
      assert.equal(validateQuality(undefined), 'high');
      assert.equal(validateQuality(123), 'high');
    });
  });

  describe('getBitrate', () => {
    test('should return correct bitrate for valid qualities', () => {
      assert.equal(getBitrate('low'), '64');
      assert.equal(getBitrate('medium'), '128');
      assert.equal(getBitrate('high'), '320');
      assert.equal(getBitrate('lossless'), '320');
    });

    test('should return default bitrate "320" for invalid qualities', () => {
      assert.equal(getBitrate('unknown'), '320');
      assert.equal(getBitrate(null), '320');
      assert.equal(getBitrate(undefined), '320');
    });
  });

  describe('getExt', () => {
    test('should return "mp3" regardless of input', () => {
      assert.equal(getExt('low'), 'mp3');
      assert.equal(getExt('high'), 'mp3');
      assert.equal(getExt(null), 'mp3');
    });
  });
});
