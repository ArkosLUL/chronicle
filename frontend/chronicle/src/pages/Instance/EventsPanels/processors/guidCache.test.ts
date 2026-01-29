import { describe, it, expect } from 'vitest';
import { createGuidCache, getCachedGuid, isPlayerGuidFast } from './guidCache';

describe('isPlayerGuidFast', () => {
  it('returns true for player GUIDs', () => {
    // Player GUIDs start with 0x0000
    expect(isPlayerGuidFast('0x0000000000001234')).toBe(true);
    expect(isPlayerGuidFast('0x000000000001C7AC')).toBe(true);
    expect(isPlayerGuidFast('0x00000000000F1A35')).toBe(true);
  });

  it('returns false for non-player GUIDs', () => {
    // Creature GUIDs start with 0xF130
    expect(isPlayerGuidFast('0xF130000CE0000D3F')).toBe(false);
    // Pet GUIDs start with 0xF140
    expect(isPlayerGuidFast('0xF14008449300903A')).toBe(false);
    // Object GUIDs start with 0xF110
    expect(isPlayerGuidFast('0xF11002B6284CB931')).toBe(false);
  });

  it('handles edge cases', () => {
    expect(isPlayerGuidFast('')).toBe(false);
    expect(isPlayerGuidFast('invalid')).toBe(false);
    expect(isPlayerGuidFast('0x000')).toBe(false); // too short but starts correctly
  });
});

describe('guidCache', () => {
  it('creates empty cache', () => {
    const cache = createGuidCache();
    expect(cache.size).toBe(0);
  });

  it('caches parsed GUIDs', () => {
    const cache = createGuidCache();
    const guidStr = '0x0000000000001234';

    // First call parses and caches
    const guid1 = getCachedGuid(cache, guidStr);
    expect(cache.size).toBe(1);

    // Second call returns cached
    const guid2 = getCachedGuid(cache, guidStr);
    expect(guid1).toBe(guid2); // Same object reference
    expect(cache.size).toBe(1); // No new entries
  });

  it('correctly identifies player from cached GUID', () => {
    const cache = createGuidCache();

    const playerGuid = getCachedGuid(cache, '0x0000000000001234');
    expect(playerGuid.isPlayer()).toBe(true);

    const creatureGuid = getCachedGuid(cache, '0xF130000CE0000D3F');
    expect(creatureGuid.isPlayer()).toBe(false);
    expect(creatureGuid.isCreature()).toBe(true);
  });

  it('caches multiple different GUIDs', () => {
    const cache = createGuidCache();

    getCachedGuid(cache, '0x0000000000001234');
    getCachedGuid(cache, '0x0000000000005678');
    getCachedGuid(cache, '0xF130000CE0000D3F');

    expect(cache.size).toBe(3);
  });
});
