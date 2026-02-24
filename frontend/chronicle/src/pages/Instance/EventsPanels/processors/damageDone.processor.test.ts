import { describe, it, expect } from 'vitest';
import { createDamageDoneProcessor } from '../DamageDone/damageDone.processor';
import type { DamageProcessorEvent, ProcessorContext } from '../processorTypes';

describe('damageDoneProcessor', () => {
  const processor = createDamageDoneProcessor('players');

  function createContext(overrides: Partial<ProcessorContext> = {}): ProcessorContext {
    return {
      players: {
        '0x0000000000001234': { name: 'TestPlayer', class: 'WARRIOR' },
        '0x0000000000005678': { name: 'TestHealer', class: 'PRIEST' },
      },
      units: {
        '0xF130000CE0000001': { name: 'Boss', owner: null, entry: 12345 },
        '0xF140000CE0000002': { name: 'Player Pet', owner: '0x0000000000001234', entry: 99 },
      },
      selectedEncounterIds: new Set(['enc1']),
      entitySelection: {
        enemyIds: new Set(),
        playerIds: new Set(),
      },
      ...overrides,
    };
  }

  function createDamageEvent(overrides: Partial<DamageProcessorEvent> = {}): DamageProcessorEvent {
    return {
      type: 'damage',
      index: 0,
      offsetMilli: 0,
      caster: '0x0000000000001234', // player by default
      sourceName: 'Mortal Strike',
      target: '0xF130000CE0000001', // enemy by default
      hitType: 0,
      amount: 1000,
      school: 1, // physical
      tailers: [],
      tailerCount: 0,
      activity: [],
      activityCount: 0,
      spellId: null,
      ...overrides,
    };
  }

  it('creates initial empty state', () => {
    const state = processor.createState();
    expect(state.EncounterDamage.size).toBe(0);
    expect(state.ByAbility.size).toBe(0);
    expect(state.ByTarget.size).toBe(0);
  });

  it('aggregates player damage by encounter', () => {
    const state = processor.createState();
    const context = createContext();
    const event = createDamageEvent();

    processor.processEvent(state, event, 'enc1', new Date(), 'damage', context);

    expect(state.EncounterDamage.has('enc1')).toBe(true);
    const encDamage = state.EncounterDamage.get('enc1')!;
    expect(encDamage.has('0x0000000000001234')).toBe(true);

    const playerData = encDamage.get('0x0000000000001234')!;
    expect(playerData.playerName).toBe('TestPlayer');
    expect(playerData.className).toBe('WARRIOR');
    expect(playerData.target.get('0xF130000CE0000001')).toBe(1000);
  });

  it('accumulates multiple damage events', () => {
    const state = processor.createState();
    const context = createContext();

    // Two damage events from same player
    processor.processEvent(state, createDamageEvent({ amount: 500 }), 'enc1', new Date(), 'damage', context);
    processor.processEvent(state, createDamageEvent({ amount: 300 }), 'enc1', new Date(), 'damage', context);

    const encDamage = state.EncounterDamage.get('enc1')!;
    const playerData = encDamage.get('0x0000000000001234')!;
    expect(playerData.target.get('0xF130000CE0000001')).toBe(800);
  });

  it('tracks damage by ability for selected encounters', () => {
    const state = processor.createState();
    const context = createContext();
    const event = createDamageEvent({ sourceName: 'Heroic Strike' });

    processor.processEvent(state, event, 'enc1', new Date(), 'damage', context);

    expect(state.ByAbility.has('0x0000000000001234')).toBe(true);
    const abilityBreakout = state.ByAbility.get('0x0000000000001234')!;
    expect(abilityBreakout.has('Heroic Strike')).toBe(true);
    expect(abilityBreakout.get('Heroic Strike')!.Total).toBe(1000);
  });

  it('ignores non-player damage for players processor', () => {
    const state = processor.createState();
    const context = createContext();
    // Enemy attacking player
    const event = createDamageEvent({
      caster: '0xF130000CE0000001', // enemy
      target: '0x0000000000001234', // player
    });

    processor.processEvent(state, event, 'enc1', new Date(), 'damage', context);

    // Should not record enemy damage in players processor
    expect(state.EncounterDamage.get('enc1')?.size ?? 0).toBe(0);
  });

  it('attributes pet damage to owner', () => {
    const state = processor.createState();
    const context = createContext();
    // Pet attacking enemy
    const event = createDamageEvent({
      caster: '0xF140000CE0000002', // pet owned by player
      sourceName: 'Bite',
      target: '0xF130000CE0000001',
    });

    processor.processEvent(state, event, 'enc1', new Date(), 'damage', context);

    // Pet damage should be attributed to owner
    const encDamage = state.EncounterDamage.get('enc1')!;
    expect(encDamage.has('0x0000000000001234')).toBe(true); // owner's GUID
  });

  it('ignores events with no caster', () => {
    const state = processor.createState();
    const context = createContext();
    const event = createDamageEvent({ caster: '' });

    processor.processEvent(state, event, 'enc1', new Date(), 'damage', context);

    expect(state.EncounterDamage.size).toBe(0);
  });
});

describe('enemyDamageDoneProcessor', () => {
  const processor = createDamageDoneProcessor('enemies');

  function createContext(): ProcessorContext {
    return {
      players: {
        '0x0000000000001234': { name: 'TestPlayer', class: 'WARRIOR' },
      },
      units: {
        '0xF130000CE0000001': { name: 'Boss', owner: null, entry: 12345 },
      },
      selectedEncounterIds: new Set(['enc1']),
      entitySelection: {
        enemyIds: new Set(),
        playerIds: new Set(),
      },
    };
  }

  it('tracks enemy damage to players', () => {
    const state = processor.createState();
    const context = createContext();
    const event: DamageProcessorEvent = {
      type: 'damage',
      index: 0,
      offsetMilli: 0,
      caster: '0xF130000CE0000001', // enemy
      sourceName: 'Cleave',
      target: '0x0000000000001234', // player
      hitType: 0,
      amount: 2000,
      school: 1,
      tailers: [],
      tailerCount: 0,
      activity: [],
      activityCount: 0,
      spellId: null,
    };

    processor.processEvent(state, event, 'enc1', new Date(), 'damage', context);

    const encDamage = state.EncounterDamage.get('enc1')!;
    expect(encDamage.has('0xF130000CE0000001')).toBe(true);

    const enemyData = encDamage.get('0xF130000CE0000001')!;
    expect(enemyData.playerName).toBe('Boss');
    expect(enemyData.className).toBe('ENEMY');
  });

  it('ignores player damage', () => {
    const state = processor.createState();
    const context = createContext();
    const event: DamageProcessorEvent = {
      type: 'damage',
      index: 0,
      offsetMilli: 0,
      caster: '0x0000000000001234', // player
      sourceName: 'Attack',
      target: '0xF130000CE0000001', // enemy
      hitType: 0,
      amount: 1000,
      school: 1,
      tailers: [],
      tailerCount: 0,
      activity: [],
      activityCount: 0,
      spellId: null,
    };

    processor.processEvent(state, event, 'enc1', new Date(), 'damage', context);

    expect(state.EncounterDamage.get('enc1')?.size ?? 0).toBe(0);
  });
});

describe('petDamageDoneProcessor', () => {
  const processor = createDamageDoneProcessor('pets');

  function createContext(): ProcessorContext {
    return {
      players: {
        '0x0000000000001234': { name: 'TestPlayer', class: 'HUNTER' },
      },
      units: {
        '0xF130000CE0000001': { name: 'Boss', owner: null, entry: 12345 },
        '0xF140000CE0000002': { name: 'Wolf', owner: '0x0000000000001234', entry: 99 },
      },
      selectedEncounterIds: new Set(['enc1']),
      entitySelection: {
        enemyIds: new Set(),
        playerIds: new Set(),
      },
    };
  }

  it('tracks pet damage separately', () => {
    const state = processor.createState();
    const context = createContext();
    const event: DamageProcessorEvent = {
      type: 'damage',
      index: 0,
      offsetMilli: 0,
      caster: '0xF140000CE0000002', // pet
      sourceName: 'Bite',
      target: '0xF130000CE0000001', // enemy
      hitType: 0,
      amount: 500,
      school: 1,
      tailers: [],
      tailerCount: 0,
      activity: [],
      activityCount: 0,
      spellId: null,
    };

    processor.processEvent(state, event, 'enc1', new Date(), 'damage', context);

    const encDamage = state.EncounterDamage.get('enc1')!;
    // Pet damage attributed to owner
    expect(encDamage.has('0x0000000000001234')).toBe(true);
  });

  it('ignores direct player damage', () => {
    const state = processor.createState();
    const context = createContext();
    const event: DamageProcessorEvent = {
      type: 'damage',
      index: 0,
      offsetMilli: 0,
      caster: '0x0000000000001234', // player directly
      sourceName: 'Auto Shot',
      target: '0xF130000CE0000001',
      hitType: 0,
      amount: 1000,
      school: 1,
      tailers: [],
      tailerCount: 0,
      activity: [],
      activityCount: 0,
      spellId: null,
    };

    processor.processEvent(state, event, 'enc1', new Date(), 'damage', context);

    // Direct player damage should not appear in pet processor
    expect(state.EncounterDamage.get('enc1')?.size ?? 0).toBe(0);
  });
});
