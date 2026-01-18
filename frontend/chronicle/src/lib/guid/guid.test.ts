import { describe, it, expect } from 'vitest';
import { GUID } from './guid';

describe('GUID JSON marshaling', () => {
  const testCases = [
    '0x00000000000F1A35',
    '0xF13000ED2E2738EF',
    '0xF14008449300903A',
  ];

  it.each(testCases)('roundtrips %s through JSON', (tc) => {
    const guid = GUID.fromString(tc);
    const json = JSON.stringify(guid);
    // JSON.stringify calls toJSON(), which returns the string
    expect(json).toBe(`"${tc}"`);

    const parsed = GUID.fromJSON(JSON.parse(json));
    expect(parsed.toString()).toBe(tc);
  });
});

describe('GUID type detection', () => {
  const tests = [
    {
      name: 'player Doyd',
      guid: 0x000000000001c7acn,
      isPlayer: true,
      isObject: false,
      isVehicle: false,
      isPet: false,
      isCreature: false,
      isAnyCreature: false,
      isUnit: true,
    },
    {
      name: 'Object lava bomb',
      guid: 0xf11002b6284cb931n,
      isPlayer: false,
      isObject: true,
      isVehicle: false,
      isPet: false,
      isCreature: false,
      isAnyCreature: false,
      isUnit: false,
    },
    {
      name: 'npc',
      guid: 0xf130000ce0000d3fn,
      isPlayer: false,
      isObject: false,
      isVehicle: false,
      isPet: false,
      isCreature: true,
      isAnyCreature: true,
      isUnit: true,
    },
    {
      name: 'npc_org_battlemaster',
      guid: 0xf130013c3b271480n,
      isPlayer: false,
      isObject: false,
      isVehicle: false,
      isPet: false,
      isCreature: true,
      isAnyCreature: true,
      isUnit: true,
    },
    {
      name: 'player',
      guid: 0x00000000000f1a35n,
      isPlayer: true,
      isObject: false,
      isVehicle: false,
      isPet: false,
      isCreature: false,
      isAnyCreature: false,
      isUnit: true,
    },
    {
      name: 'maldrissa_imp',
      guid: 0xf14008449300903an,
      isPlayer: false,
      isObject: false,
      isVehicle: false,
      isPet: true,
      isCreature: false,
      isAnyCreature: true,
      isUnit: true,
    },
    {
      name: 'maldrissa',
      guid: 0x00000000000eb167n,
      isPlayer: true,
      isObject: false,
      isVehicle: false,
      isPet: false,
      isCreature: false,
      isAnyCreature: false,
      isUnit: true,
    },
    {
      name: 'Magma totem',
      guid: 0xf130001d29279306n,
      isPlayer: false,
      isObject: false,
      isVehicle: false,
      isPet: false,
      isCreature: true,
      isAnyCreature: true,
      isUnit: true,
    },
  ];

  it.each(tests)('$name', (tt) => {
    const guid = GUID.fromBigInt(tt.guid);
    expect(guid.isPlayer(), 'player').toBe(tt.isPlayer);
    expect(guid.isVehicle(), 'vehicle').toBe(tt.isVehicle);
    expect(guid.isPet(), 'pet').toBe(tt.isPet);
    expect(guid.isCreature(), 'creature').toBe(tt.isCreature);
    expect(guid.isAnyCreature(), 'any creature').toBe(tt.isAnyCreature);
    expect(guid.isUnit(), 'unit').toBe(tt.isUnit);
    expect(guid.isObject(), 'object').toBe(tt.isObject);
  });
});

describe('GUID fromString', () => {
  it('parses and roundtrips correctly', () => {
    const guidStr = '0xF130000CE0000D3F';
    const expectedBigInt = 0xf130000ce0000d3fn;

    const guid = GUID.fromString(guidStr);
    expect(guid.toBigInt()).toBe(expectedBigInt);
    expect(guid.toString()).toBe(guidStr);
  });

  it('rejects invalid strings', () => {
    expect(() => GUID.fromString('invalid')).toThrow('invalid guid');
    expect(() => GUID.fromString('0x123')).toThrow('invalid guid'); // too short
    expect(() => GUID.fromString('0xGGGGGGGGGGGGGGGG')).toThrow('invalid guid'); // invalid hex
  });
});

describe('GUID isZero', () => {
  it('returns true for zero GUID', () => {
    const guid = GUID.fromBigInt(0n);
    expect(guid.isZero()).toBe(true);
  });

  it('returns false for non-zero GUID', () => {
    const guid = GUID.fromBigInt(1n);
    expect(guid.isZero()).toBe(false);
  });
});
