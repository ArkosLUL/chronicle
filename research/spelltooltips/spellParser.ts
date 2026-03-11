import { type DbcEntry } from 'haax-dbc';

import { getDbcContent } from '~main/api/routers/dbc';
import Logger from '~main/modules/logger';

type SpellBase = {
	template: DbcEntry<'Spell'>;
	duration?: DbcEntry<'SpellDuration'>;
	radius1?: DbcEntry<'SpellRadius'>;
	radius2?: DbcEntry<'SpellRadius'>;
	radius3?: DbcEntry<'SpellRadius'>;
	range?: DbcEntry<'SpellRange'>;
};

type SpellMatchData = {
	src: string;
	command?: string;
	idx: 0 | 1 | 2 | 3;
	op?: string;
	opVal?: number;
	arg1?: string;
	arg2?: string;
};

const minDieRoll = (
	spell: SpellBase['template'],
	lvl: number,
	idx: 1 | 2 | 3 = 1
) => {
	const sides = spell[`effectBaseDice_${idx}`];
	const perLevel = spell[`effectDicePerLevel_${idx}`];
	return sides + perLevel * lvl;
};

const maxDieRoll = (
	spell: SpellBase['template'],
	lvl: number,
	idx: 1 | 2 | 3 = 1
) => {
	const sides = spell[`effectDieSides_${idx}`];
	const count = spell[`effectBaseDice_${idx}`];
	const perLevel = spell[`effectDicePerLevel_${idx}`];
	return sides * (count + perLevel * lvl);
};

const lvlScaling = (
	spell: SpellBase['template'],
	lvl: number,
	idx: 1 | 2 | 3 = 1
) => {
	if (!spell.maxLevel && !spell.baseLevel && !spell.spellLevel) return 0;
	const perLevel = spell[`effectRealPointsPerLevel_${idx}`];
	return perLevel * lvl;
};

const evalOperation = (value: number, op?: string, opVal?: number) => {
	if (!op || opVal === undefined) return value;
	switch (op) {
		case '/':
			return value / opVal;
		case '*':
			return value * opVal;
	}
	throw new Error(`Unknown operation ${op}${opVal}`);
};

const format = (num: number, floating?: boolean) => {
	if (!floating) return Math.floor(num).toString();
	return num?.toFixed(1).replace(/\.0/, '');
};

const getScaledValue = (
	spell: SpellBase['template'],
	lvl: number,
	op?: string,
	opVal?: number,
	idx: 0 | 1 | 2 | 3 = 0
): number[] => {
	const applyOp = (num: number) => evalOperation(Math.abs(num), op, opVal);

	const getVal = (i: 1 | 2 | 3) => {
		const base = spell[`effectBasePoints_${i}`];
		const min = minDieRoll(spell, lvl, i);
		const max = maxDieRoll(spell, lvl, i);
		const scaling = lvlScaling(spell, lvl, i);

		return max > min
			? [applyOp(base + min + scaling), applyOp(base + max + scaling)]
			: [applyOp(base + min + scaling)];
	};

	if (idx) return getVal(idx);

	const allValues = ([1, 2, 3] as const).map(getVal);
	const min = allValues.reduce((acc, v) => acc + v[0], 0);
	const max = allValues.reduce((acc, v) => acc + v[1] ?? v[0], 0);

	return max > min ? [min, max] : [min];
};

const evalCommand = (
	spell: SpellBase,
	{ src, command, idx, arg1, arg2, op, opVal }: SpellMatchData,
	forLevel: number
): string[] => {
	const lvl =
		Math.min(spell.template.maxLevel, forLevel) -
		Math.max(spell.template.baseLevel, spell.template.spellLevel);

	const handleError = (msg: string) => {
		throw new Error(msg, {
			cause: {
				src,
				command,
				idx,
				arg1,
				arg2,
				op,
				opVal
			}
		});
	};

	if (command === 'B') return ['\n'];

	const radius = idx ? spell[`radius${idx}`] : undefined;
	switch (command?.toLowerCase()) {
		case 'a':
			if (!radius) return handleError('Spell radius not fount');
			return [format(evalOperation(radius.radius, op, opVal))];
		case 'r':
			if (!spell.range) return handleError('Spell range not found');
			return [format(evalOperation(spell.range.rangeMax, op, opVal))];
		case 'b':
			if (!idx) return handleError('Missing arguments for command b');
			return [format(spell.template[`effectPointsPerCombo_${idx}`], true)];
		case 'd': {
			if (!spell.duration) return handleError('Spell duration not found');
			const sec = spell.duration.base / 1000;
			if (sec < 60) return [`${sec} sec`];
			const min = sec / 60;
			if (min < 60) return [`${min} min`];
			return [`${min / 60} hour`];
		}
		case 'e':
			if (!idx) return handleError('Missing arguments for command e');
			return [format(spell.template[`effectMultipleValue_${idx}`], true)];
		case 'f':
			if (!idx) return handleError('Missing arguments for command f');
			return [format(spell.template[`damageMultiplier_${idx}`], true)];
		case 'g':
			if (!arg1 || !arg2) return handleError('Missing arguments for command g');
			return [`${arg1}/${arg2}`];
		case 'h':
			return [`${spell.template.procChance}`];
		case 'i':
			return [`${spell.template.maxTargets}`];
		case 'l': {
			if (!arg1 || !arg2) return handleError('Missing arguments for command l');
			const val = getScaledValue(spell.template, lvl, op, opVal, 1);
			return [val[0] === 1 ? arg2 : arg1];
		}
		case 'n':
			return [`${spell.template.procCharges}`];
		case 'o': {
			if (!spell.duration) return handleError('Spell duration not found');
			const val = getScaledValue(spell.template, lvl, op, opVal, idx);
			const amp =
				spell.duration.base / spell.template[`effectAmplitude_${idx}`];
			return val.map(v => format(v * amp));
		}
		case 'q':
			if (!idx) return handleError('Missing arguments for command q');
			return [`${spell.template[`effectMiscValue_${idx}`]}`];
		case 'm':
		case 's':
			return getScaledValue(spell.template, lvl, op, opVal, idx).map(v =>
				format(v, command === 'S')
			);
		case 't':
			if (!idx) return handleError('Missing arguments for command t');
			return [format(spell.template[`effectAmplitude_${idx}`] / 1000, true)];
		case 'u':
			return [`${spell.template.stackAmount}`];
		case 'v':
			return [`${spell.template.maxTargetLevel}`];
		case 'x':
			if (!idx) return handleError('Missing arguments for command x');
			return [`${spell.template[`effectChainTarget_${idx}`]}`];
		case 'z':
			return ['<Hearthstone location>'];
	}
	return handleError(`Unknown command ${command}${!idx ? '' : idx} not found`);
};

const parseDescription =
	(getSpellBase: (id: number) => SpellBase | undefined) =>
	(
		spell: SpellBase,
		forLevel: number,
		lng: 'enUS' | 'zhCN' | 'esES' | 'ptPT' | 'deDE' | 'ruRU'
	) => {
		const desc = spell.template[`description_${lng}`];
		const matches = desc.matchAll(
			/\$(?:([/*])(\d+);)?(\d+)?(\w)(\d)?(?:([^:$]+):([^;]+);)?/g
		);
		let idx = 0;
		const parsed: string[] = [];
		for (const match of matches) {
			parsed.push(desc.slice(idx, match.index));
			idx = (match.index ?? 0) + match[0].length;

			const data: SpellMatchData = {
				src: match[0],
				command: match[4],
				idx: match[5] ? (Number(match[5]) as never) : 0,
				op: match[1],
				opVal: match[2] ? Number(match[2]) : undefined,
				arg1: match[6],
				arg2: match[7]
			};

			try {
				const targetSpell = match[3] ? getSpellBase(Number(match[3])) : spell;
				if (!targetSpell) throw new Error(`Spell ${match[3]} not found`);

				parsed.push(evalCommand(targetSpell, data, forLevel).join(' to '));
			} catch (e) {
				Logger.log('Failed to parse', 'error', {
					description: spell.template[`description_${lng}`],
					error: e instanceof Error ? e.message : 'Unknown error',
					cause: e instanceof Error ? e.cause : undefined,
					spell: `#${spell.template.id} ${spell.template.name_enUS}`
				});
				parsed.push('<Err>');
			}
		}
		parsed.push(desc.slice(idx));

		return parsed;
	};

const getSpellTalentData = async () => {
	const [
		talentTabDbc,
		talentDbc,
		spellDbc,
		spellIconDbc,
		spellDurationDbc,
		spellRangeDbc,
		spellRadiusDbc
	] = await Promise.all([
		getDbcContent('TalentTab'),
		getDbcContent('Talent'),
		getDbcContent('Spell'),
		getDbcContent('SpellIcon'),
		getDbcContent('SpellDuration'),
		getDbcContent('SpellRange'),
		getDbcContent('SpellRadius')
	]);

	const spellMap = new Map<number, SpellBase>();
	for (const spell of spellDbc) {
		const duration = spellDurationDbc.find(d => d.id === spell.durationIndex);
		const range = spellRangeDbc.find(r => r.id === spell.rangeIndex);
		const radius1 = spellRadiusDbc.find(
			r => r.id === spell.effectRadiusIndex_1
		);
		const radius2 = spellRadiusDbc.find(
			r => r.id === spell.effectRadiusIndex_2
		);
		const radius3 = spellRadiusDbc.find(
			r => r.id === spell.effectRadiusIndex_3
		);

		spellMap.set(spell.id, {
			template: spell,
			duration,
			range,
			radius1,
			radius2,
			radius3
		});
	}

	return {
		talentTabDbc,
		talentDbc,
		spellIconDbc,
		spellMap,
		parseDescription: parseDescription(spellId => spellMap.get(spellId))
	};
};

export default getSpellTalentData;
