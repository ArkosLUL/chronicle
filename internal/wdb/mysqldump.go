package wdb

import (
	"bufio"
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/Emyrk/chronicle/database"
	"github.com/jackc/pgx/v5/pgtype"
)

// parseInsertColumnNames extracts backtick-quoted column names from an INSERT
// statement that uses explicit columns, e.g.:
//
//	INSERT INTO `tbl` (`col1`, `col2`) VALUES ...
//
// Returns nil if no column list is found (positional VALUES format).
func parseInsertColumnNames(stmt string) []string {
	// Find the table name closing backtick, then look for '(' before VALUES.
	valIdx := strings.Index(strings.ToUpper(stmt), "VALUES")
	if valIdx == -1 {
		return nil
	}
	prefix := stmt[:valIdx]
	// Look for a parenthesised column list between the table name and VALUES.
	openParen := strings.Index(prefix, "(")
	if openParen == -1 {
		return nil
	}
	closeParen := strings.LastIndex(prefix, ")")
	if closeParen == -1 || closeParen <= openParen {
		return nil
	}
	colSection := prefix[openParen+1 : closeParen]
	parts := strings.Split(colSection, ",")
	cols := make([]string, 0, len(parts))
	for _, p := range parts {
		col := strings.TrimSpace(p)
		col = strings.Trim(col, "`")
		if col != "" {
			cols = append(cols, strings.ToLower(col))
		}
	}
	if len(cols) == 0 {
		return nil
	}
	return cols
}

// buildColIndex builds a lowercase column name → position map from a column list.
func buildColIndex(cols []string) map[string]int {
	m := make(map[string]int, len(cols))
	for i, c := range cols {
		m[c] = i
	}
	return m
}

// colStr returns the string value at the named column, or "" if not found.
func colStr(vals []string, idx map[string]int, name string) string {
	if i, ok := idx[name]; ok && i < len(vals) {
		return vals[i]
	}
	return ""
}

// colI32 returns the int32 value at the named column, or 0 if not found.
func colI32(vals []string, idx map[string]int, name string) int32 {
	s := colStr(vals, idx, name)
	if s == "" {
		return 0
	}
	v, _ := atoi32(s)
	return v
}

// colI64 returns the int64 value at the named column, or 0 if not found.
func colI64(vals []string, idx map[string]int, name string) int64 {
	s := colStr(vals, idx, name)
	if s == "" {
		return 0
	}
	v, _ := atoi64(s)
	return v
}

// colF64 returns the float64 value at the named column, or 0 if not found.
func colF64(vals []string, idx map[string]int, name string) float64 {
	s := colStr(vals, idx, name)
	if s == "" {
		return 0
	}
	v, _ := atof64(s)
	return v
}

const (
	insertCreaturePrefix = "INSERT INTO `creature_template`"
	insertItemPrefix     = "INSERT INTO `item_template`"
)

// ParseCreatureTemplateSQL parses AzerothCore-format MySQL INSERT statements
// for the creature_template table and returns WorldCreatureTemplate rows.
// Supports both positional VALUES (WoTLK) and explicit column-list formats (Classic).
func ParseCreatureTemplateSQL(r io.Reader) ([]database.WorldCreatureTemplate, error) {
	scanner := bufio.NewScanner(r)
	// MySQL dumps can have very long INSERT lines (many rows per statement).
	scanner.Buffer(make([]byte, 0, 64*1024), 64*1024*1024)

	var results []database.WorldCreatureTemplate

	// MySQL dumps may have the INSERT keyword on one line and VALUE rows on
	// subsequent lines.  We accumulate lines once we see the INSERT prefix
	// until a line ending with ';' closes the statement.
	var inInsert bool
	var stmt strings.Builder

	for scanner.Scan() {
		line := scanner.Text()

		if !inInsert {
			if !strings.HasPrefix(line, insertCreaturePrefix) {
				continue
			}
			inInsert = true
			stmt.Reset()
		}

		stmt.WriteString(line)
		stmt.WriteByte('\n')

		// Statement ends when the line ends with ';'
		trimmed := strings.TrimRight(line, " \t\r")
		if !strings.HasSuffix(trimmed, ";") {
			continue
		}

		inInsert = false
		full := stmt.String()
		colNames := parseInsertColumnNames(full)
		rows, err := parseMySQLValueRows(full)
		if err != nil {
			return nil, fmt.Errorf("parse INSERT statement: %w", err)
		}

		for _, vals := range rows {
			var ct database.WorldCreatureTemplate
			var parseErr error
			if colNames != nil {
				ct, parseErr = creatureRowFromNamedValues(vals, buildColIndex(colNames))
			} else {
				ct, parseErr = creatureRowFromValues(vals)
			}
			if parseErr != nil {
				return nil, parseErr
			}
			results = append(results, ct)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("scan: %w", err)
	}
	return results, nil
}

// parseMySQLValueRows splits "INSERT INTO ... VALUES (v1,v2,...),(v1,v2,...),...;" into
// a slice of value slices. Handles quoted strings containing commas, parens, and escapes.
func parseMySQLValueRows(line string) ([][]string, error) {
	// Find the first '(' after "VALUES"
	idx := strings.Index(line, "VALUES")
	if idx == -1 {
		idx = strings.Index(line, "values")
	}
	if idx == -1 {
		return nil, fmt.Errorf("no VALUES keyword found")
	}
	rest := line[idx+6:] // skip "VALUES"

	var rows [][]string
	i := 0
	for i < len(rest) {
		// Find opening '('
		for i < len(rest) && rest[i] != '(' {
			i++
		}
		if i >= len(rest) {
			break
		}
		i++ // skip '('

		// Parse values until closing ')'
		var vals []string
		for i < len(rest) {
			val, next, err := parseOneValue(rest, i)
			if err != nil {
				return nil, err
			}
			vals = append(vals, val)
			i = next
			if i < len(rest) && rest[i] == ')' {
				i++ // skip ')'
				break
			}
			if i < len(rest) && rest[i] == ',' {
				i++ // skip ','
			}
		}
		rows = append(rows, vals)
	}
	return rows, nil
}

// parseOneValue parses a single MySQL value starting at position i.
// Returns the value string, the next position, and any error.
func parseOneValue(s string, i int) (string, int, error) {
	if i >= len(s) {
		return "", i, fmt.Errorf("unexpected end of input")
	}

	// NULL
	if i+4 <= len(s) && s[i:i+4] == "NULL" {
		return "NULL", i + 4, nil
	}

	// Quoted string
	if s[i] == '\'' {
		i++ // skip opening quote
		var b strings.Builder
		for i < len(s) {
			if s[i] == '\\' && i+1 < len(s) {
				// MySQL escape sequences
				i++
				switch s[i] {
				case '\'':
					b.WriteByte('\'')
				case '\\':
					b.WriteByte('\\')
				case 'n':
					b.WriteByte('\n')
				case 'r':
					b.WriteByte('\r')
				case 't':
					b.WriteByte('\t')
				case '0':
					b.WriteByte(0)
				default:
					b.WriteByte(s[i])
				}
				i++
				continue
			}
			if s[i] == '\'' {
				// Check for '' escape (doubled quote)
				if i+1 < len(s) && s[i+1] == '\'' {
					b.WriteByte('\'')
					i += 2
					continue
				}
				i++ // skip closing quote
				return b.String(), i, nil
			}
			b.WriteByte(s[i])
			i++
		}
		return "", i, fmt.Errorf("unterminated string")
	}

	// Numeric value (or other unquoted token)
	start := i
	for i < len(s) && s[i] != ',' && s[i] != ')' {
		i++
	}
	return s[start:i], i, nil
}

// AzerothCore creature_template column indices (positional in INSERT VALUES).
const (
	acEntry            = 0
	acModelID1         = 6
	acModelID2         = 7
	acModelID3         = 8
	acModelID4         = 9
	acName             = 10
	acSubname          = 11
	acMinLevel         = 14
	acMaxLevel         = 15
	acMinDmg           = 23
	acMaxDmg           = 24
	acDmgSchool        = 25
	acAttackPower      = 26
	acDmgMultiplier    = 27
	acBaseAttackTime   = 28
	acRangeAttackTime  = 29
	acUnitClass        = 30
	acUnitFlags        = 31
	acMinRangedDmg     = 39
	acMaxRangedDmg     = 40
	acResistance1      = 47 // holy
	acResistance2      = 48 // fire
	acResistance3      = 49 // nature
	acResistance4      = 50 // frost
	acResistance5      = 51 // shadow
	acResistance6      = 52 // arcane
	acHealthMod        = 69
	acManaMod          = 70
	acArmorMod         = 71
	acMechanicImmune   = 81
	acMinCols          = 85
)

func creatureRowFromValues(vals []string) (database.WorldCreatureTemplate, error) {
	var ct database.WorldCreatureTemplate
	if len(vals) < acMinCols {
		return ct, fmt.Errorf("creature entry: expected >=%d columns, got %d", acMinCols, len(vals))
	}

	entry, err := atoi32(vals[acEntry])
	if err != nil {
		return ct, fmt.Errorf("creature entry: %w", err)
	}
	ct.Entry = entry
	ct.DisplayId1, _ = atoi32(vals[acModelID1])
	ct.DisplayId2, _ = atoi32(vals[acModelID2])
	ct.DisplayId3, _ = atoi32(vals[acModelID3])
	ct.DisplayId4, _ = atoi32(vals[acModelID4])
	ct.Name = unquote(vals[acName])
	if vals[acSubname] != "NULL" {
		ct.Subname = pgtype.Text{String: unquote(vals[acSubname]), Valid: true}
	}
	ct.LevelMin, _ = atoi32(vals[acMinLevel])
	ct.LevelMax, _ = atoi32(vals[acMaxLevel])
	ct.DmgMin, _ = atof64(vals[acMinDmg])
	ct.DmgMax, _ = atof64(vals[acMaxDmg])
	ct.DmgSchool, _ = atoi32(vals[acDmgSchool])
	ct.AttackPower, _ = atoi32(vals[acAttackPower])
	ct.DmgMultiplier, _ = atof64(vals[acDmgMultiplier])
	ct.BaseAttackTime, _ = atoi32(vals[acBaseAttackTime])
	ct.RangedAttackTime, _ = atoi32(vals[acRangeAttackTime])
	ct.UnitClass, _ = atoi32(vals[acUnitClass])
	ct.UnitFlags, _ = atoi32(vals[acUnitFlags])
	ct.RangedDmgMin, _ = atof64(vals[acMinRangedDmg])
	ct.RangedDmgMax, _ = atof64(vals[acMaxRangedDmg])
	ct.HolyRes, _ = atoi32(vals[acResistance1])
	ct.FireRes, _ = atoi32(vals[acResistance2])
	ct.NatureRes, _ = atoi32(vals[acResistance3])
	ct.FrostRes, _ = atoi32(vals[acResistance4])
	ct.ShadowRes, _ = atoi32(vals[acResistance5])
	ct.ArcaneRes, _ = atoi32(vals[acResistance6])
	ct.MechanicImmuneMask, _ = atoi64(vals[acMechanicImmune])

	// AzerothCore stores Health_mod/Mana_mod/Armor_mod as float multipliers,
	// not absolute values. Our schema stores absolute values (health_min, etc.).
	// We leave health_min/max, mana_min/max, armor at 0 since the dump doesn't
	// have absolute values — those come from creature_classlevelstats * mod.
	// We could compute them but that requires the classlevelstats table.

	return ct, nil
}

// creatureRowFromNamedValues builds a WorldCreatureTemplate from column-name-indexed values.
// Used for Classic-format dumps that have explicit column lists.
func creatureRowFromNamedValues(vals []string, idx map[string]int) (database.WorldCreatureTemplate, error) {
	var ct database.WorldCreatureTemplate

	entry := colStr(vals, idx, "entry")
	if entry == "" {
		return ct, fmt.Errorf("creature row missing 'entry' column")
	}
	var err error
	ct.Entry, err = atoi32(entry)
	if err != nil {
		return ct, fmt.Errorf("creature entry: %w", err)
	}

	ct.Name = colStr(vals, idx, "name")
	sub := colStr(vals, idx, "subname")
	if sub != "" && sub != "NULL" {
		ct.Subname = pgtype.Text{String: sub, Valid: true}
	}
	ct.DisplayId1 = colI32(vals, idx, "modelid1")
	ct.DisplayId2 = colI32(vals, idx, "modelid2")
	ct.DisplayId3 = colI32(vals, idx, "modelid3")
	ct.DisplayId4 = colI32(vals, idx, "modelid4")
	ct.LevelMin = colI32(vals, idx, "minlevel")
	ct.LevelMax = colI32(vals, idx, "maxlevel")
	ct.DmgMin = colF64(vals, idx, "mindmg")
	ct.DmgMax = colF64(vals, idx, "maxdmg")
	ct.DmgSchool = colI32(vals, idx, "dmgschool")
	ct.AttackPower = colI32(vals, idx, "attackpower")
	ct.DmgMultiplier = colF64(vals, idx, "dmg_multiplier")
	ct.BaseAttackTime = colI32(vals, idx, "baseattacktime")
	ct.RangedAttackTime = colI32(vals, idx, "rangeattacktime")
	ct.UnitClass = colI32(vals, idx, "unitclass")
	ct.UnitFlags = colI32(vals, idx, "unitflags")
	ct.RangedDmgMin = colF64(vals, idx, "minrangedmg")
	ct.RangedDmgMax = colF64(vals, idx, "maxrangedmg")
	ct.HolyRes = colI32(vals, idx, "resistance1")
	ct.FireRes = colI32(vals, idx, "resistance2")
	ct.NatureRes = colI32(vals, idx, "resistance3")
	ct.FrostRes = colI32(vals, idx, "resistance4")
	ct.ShadowRes = colI32(vals, idx, "resistance5")
	ct.ArcaneRes = colI32(vals, idx, "resistance6")
	ct.MechanicImmuneMask = colI64(vals, idx, "mechanicimmune_mask")

	return ct, nil
}

// ParseItemTemplateSQL parses AzerothCore-format MySQL INSERT statements
// for the item_template table and returns WorldItemTemplate rows.
// Supports both positional VALUES (WoTLK) and explicit column-list formats (Classic).
func ParseItemTemplateSQL(r io.Reader) ([]database.WorldItemTemplate, error) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 64*1024), 64*1024*1024)

	var results []database.WorldItemTemplate
	var inInsert bool
	var stmt strings.Builder

	for scanner.Scan() {
		line := scanner.Text()

		if !inInsert {
			if !strings.HasPrefix(line, insertItemPrefix) {
				continue
			}
			inInsert = true
			stmt.Reset()
		}

		stmt.WriteString(line)
		stmt.WriteByte('\n')

		trimmed := strings.TrimRight(line, " \t\r")
		if !strings.HasSuffix(trimmed, ";") {
			continue
		}

		inInsert = false
		full := stmt.String()
		colNames := parseInsertColumnNames(full)
		rows, err := parseMySQLValueRows(full)
		if err != nil {
			return nil, fmt.Errorf("parse INSERT statement: %w", err)
		}

		for _, vals := range rows {
			var it database.WorldItemTemplate
			var parseErr error
			if colNames != nil {
				it, parseErr = itemRowFromNamedValues(vals, buildColIndex(colNames))
			} else {
				it, parseErr = itemRowFromValues(vals)
			}
			if parseErr != nil {
				return nil, parseErr
			}
			results = append(results, it)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("scan: %w", err)
	}
	return results, nil
}

// AzerothCore item_template column indices (positional in INSERT VALUES).
// 139 columns total (indices 0-138).
const (
	aiEntry           = 0
	aiClass           = 1
	aiSubclass        = 2
	// 3 = SoundOverrideSubclass (not in our schema)
	aiName            = 4
	aiDisplayID       = 5
	aiQuality         = 6
	aiFlags           = 7
	// 8 = FlagsExtra
	aiBuyCount        = 9
	aiBuyPrice        = 10
	aiSellPrice       = 11
	aiInventoryType   = 12
	aiAllowableClass  = 13
	aiAllowableRace   = 14
	aiItemLevel       = 15
	aiRequiredLevel   = 16
	aiRequiredSkill   = 17
	aiRequiredSkillRank = 18
	aiRequiredSpell   = 19
	aiRequiredHonorRank = 20
	aiRequiredCityRank = 21
	aiRequiredRepFaction = 22
	aiRequiredRepRank = 23
	aiMaxCount        = 24
	aiStackable       = 25
	aiContainerSlots  = 26
	// 27 = StatsCount (not stored separately)
	aiStatType1       = 28
	aiStatValue1      = 29
	// ... pairs up to stat_type10=46, stat_value10=47
	aiScalingStatDist = 48
	aiScalingStatVal  = 49
	aiDmgMin1         = 50
	aiDmgMax1         = 51
	aiDmgType1        = 52
	aiDmgMin2         = 53
	aiDmgMax2         = 54
	aiDmgType2        = 55
	aiArmor           = 56
	aiHolyRes         = 57
	aiFireRes         = 58
	aiNatureRes       = 59
	aiFrostRes        = 60
	aiShadowRes       = 61
	aiArcaneRes       = 62
	aiDelay           = 63
	aiAmmoType        = 64
	aiRangedModRange  = 65
	aiSpellID1        = 66
	aiSpellTrigger1   = 67
	aiSpellCharges1   = 68
	aiSpellPPMRate1   = 69
	aiSpellCooldown1  = 70
	aiSpellCategory1  = 71
	aiSpellCatCD1     = 72
	// spell 2-5 follow at intervals of 7
	aiBonding         = 101
	aiDescription     = 102
	aiPageText        = 103
	aiLanguageID      = 104
	aiPageMaterial    = 105
	aiStartQuest      = 106
	aiLockID          = 107
	aiMaterial        = 108
	aiSheath          = 109
	aiRandomProperty  = 110
	aiRandomSuffix    = 111
	aiBlock           = 112
	aiItemSet         = 113
	aiMaxDurability   = 114
	aiArea            = 115
	aiMap             = 116
	aiBagFamily       = 117
	aiTotemCategory   = 118
	aiSocketColor1    = 119
	aiSocketContent1  = 120
	aiSocketColor2    = 121
	aiSocketContent2  = 122
	aiSocketColor3    = 123
	aiSocketContent3  = 124
	aiSocketBonus     = 125
	aiGemProperties   = 126
	aiReqDisenchant   = 127
	aiArmorDmgMod     = 128
	aiDuration        = 129
	aiItemLimitCat    = 130
	aiHolidayID       = 131
	// 132 = ScriptName
	aiDisenchantID    = 133
	aiFoodType        = 134
	aiMinMoneyLoot    = 135
	aiMaxMoneyLoot    = 136
	// 137 = flagsCustom
	// 138 = VerifiedBuild
	aiMinCols         = 139
)

func itemRowFromValues(vals []string) (database.WorldItemTemplate, error) {
	var it database.WorldItemTemplate
	if len(vals) < aiMinCols {
		return it, fmt.Errorf("item entry: expected >=%d columns, got %d", aiMinCols, len(vals))
	}

	it.Entry, _ = atoi32(vals[aiEntry])
	it.Class, _ = atoi32(vals[aiClass])
	it.Subclass, _ = atoi32(vals[aiSubclass])
	it.Name = vals[aiName]
	it.DisplayID, _ = atoi32(vals[aiDisplayID])
	it.Quality, _ = atoi32(vals[aiQuality])
	it.Flags, _ = atoi32(vals[aiFlags])
	it.BuyCount, _ = atoi32(vals[aiBuyCount])
	it.BuyPrice, _ = atoi32(vals[aiBuyPrice])
	it.SellPrice, _ = atoi32(vals[aiSellPrice])
	it.InventoryType, _ = atoi32(vals[aiInventoryType])
	it.AllowableClass, _ = atoi32(vals[aiAllowableClass])
	it.AllowableRace, _ = atoi32(vals[aiAllowableRace])
	it.ItemLevel, _ = atoi32(vals[aiItemLevel])
	it.RequiredLevel, _ = atoi32(vals[aiRequiredLevel])
	it.RequiredSkill, _ = atoi32(vals[aiRequiredSkill])
	it.RequiredSkillRank, _ = atoi32(vals[aiRequiredSkillRank])
	it.RequiredSpell, _ = atoi32(vals[aiRequiredSpell])
	it.RequiredHonorRank, _ = atoi32(vals[aiRequiredHonorRank])
	it.RequiredCityRank, _ = atoi32(vals[aiRequiredCityRank])
	it.RequiredReputationFaction, _ = atoi32(vals[aiRequiredRepFaction])
	it.RequiredReputationRank, _ = atoi32(vals[aiRequiredRepRank])
	it.MaxCount, _ = atoi32(vals[aiMaxCount])
	it.Stackable, _ = atoi32(vals[aiStackable])
	it.ContainerSlots, _ = atoi32(vals[aiContainerSlots])

	// Stats: 10 pairs starting at index 28
	for i := 0; i < 10; i++ {
		typ, _ := atoi32(vals[aiStatType1+i*2])
		val, _ := atoi32(vals[aiStatValue1+i*2])
		switch i {
		case 0: it.StatType1, it.StatValue1 = typ, val
		case 1: it.StatType2, it.StatValue2 = typ, val
		case 2: it.StatType3, it.StatValue3 = typ, val
		case 3: it.StatType4, it.StatValue4 = typ, val
		case 4: it.StatType5, it.StatValue5 = typ, val
		case 5: it.StatType6, it.StatValue6 = typ, val
		case 6: it.StatType7, it.StatValue7 = typ, val
		case 7: it.StatType8, it.StatValue8 = typ, val
		case 8: it.StatType9, it.StatValue9 = typ, val
		case 9: it.StatType10, it.StatValue10 = typ, val
		}
	}

	it.ScalingStatDistribution, _ = atoi32(vals[aiScalingStatDist])
	it.ScalingStatValue, _ = atoi32(vals[aiScalingStatVal])
	it.DmgMin1, _ = atof64(vals[aiDmgMin1])
	it.DmgMax1, _ = atof64(vals[aiDmgMax1])
	it.DmgType1, _ = atoi32(vals[aiDmgType1])
	it.DmgMin2, _ = atof64(vals[aiDmgMin2])
	it.DmgMax2, _ = atof64(vals[aiDmgMax2])
	it.DmgType2, _ = atoi32(vals[aiDmgType2])
	it.Armor, _ = atoi32(vals[aiArmor])
	it.HolyRes, _ = atoi32(vals[aiHolyRes])
	it.FireRes, _ = atoi32(vals[aiFireRes])
	it.NatureRes, _ = atoi32(vals[aiNatureRes])
	it.FrostRes, _ = atoi32(vals[aiFrostRes])
	it.ShadowRes, _ = atoi32(vals[aiShadowRes])
	it.ArcaneRes, _ = atoi32(vals[aiArcaneRes])
	it.Delay, _ = atoi32(vals[aiDelay])
	it.AmmoType, _ = atoi32(vals[aiAmmoType])
	it.RangeMod, _ = atof64(vals[aiRangedModRange])

	// Spells: 5 groups of 7 fields starting at index 66
	for i := 0; i < 5; i++ {
		base := aiSpellID1 + i*7
		sid, _ := atoi32(vals[base])
		trig, _ := atoi32(vals[base+1])
		chg, _ := atoi32(vals[base+2])
		ppm, _ := atof64(vals[base+3])
		cd, _ := atoi32(vals[base+4])
		cat, _ := atoi32(vals[base+5])
		catcd, _ := atoi32(vals[base+6])
		switch i {
		case 0:
			it.Spellid1, it.Spelltrigger1, it.Spellcharges1 = sid, trig, chg
			it.Spellppmrate1, it.Spellcooldown1, it.Spellcategory1, it.Spellcategorycooldown1 = ppm, cd, cat, catcd
		case 1:
			it.Spellid2, it.Spelltrigger2, it.Spellcharges2 = sid, trig, chg
			it.Spellppmrate2, it.Spellcooldown2, it.Spellcategory2, it.Spellcategorycooldown2 = ppm, cd, cat, catcd
		case 2:
			it.Spellid3, it.Spelltrigger3, it.Spellcharges3 = sid, trig, chg
			it.Spellppmrate3, it.Spellcooldown3, it.Spellcategory3, it.Spellcategorycooldown3 = ppm, cd, cat, catcd
		case 3:
			it.Spellid4, it.Spelltrigger4, it.Spellcharges4 = sid, trig, chg
			it.Spellppmrate4, it.Spellcooldown4, it.Spellcategory4, it.Spellcategorycooldown4 = ppm, cd, cat, catcd
		case 4:
			it.Spellid5, it.Spelltrigger5, it.Spellcharges5 = sid, trig, chg
			it.Spellppmrate5, it.Spellcooldown5, it.Spellcategory5, it.Spellcategorycooldown5 = ppm, cd, cat, catcd
		}
	}

	it.Bonding, _ = atoi32(vals[aiBonding])
	it.Description = vals[aiDescription]
	it.PageText, _ = atoi32(vals[aiPageText])
	it.PageLanguage, _ = atoi32(vals[aiLanguageID])
	it.PageMaterial, _ = atoi32(vals[aiPageMaterial])
	it.StartQuest, _ = atoi32(vals[aiStartQuest])
	it.LockID, _ = atoi32(vals[aiLockID])
	it.Material, _ = atoi32(vals[aiMaterial])
	it.Sheath, _ = atoi32(vals[aiSheath])
	it.RandomProperty, _ = atoi32(vals[aiRandomProperty])
	it.RandomSuffix, _ = atoi32(vals[aiRandomSuffix])
	it.Block, _ = atoi32(vals[aiBlock])
	it.SetID, _ = atoi32(vals[aiItemSet])
	it.MaxDurability, _ = atoi32(vals[aiMaxDurability])
	it.AreaBound, _ = atoi32(vals[aiArea])
	it.MapBound, _ = atoi32(vals[aiMap])
	it.BagFamily, _ = atoi32(vals[aiBagFamily])
	it.TotemCategory, _ = atoi32(vals[aiTotemCategory])
	it.SocketColor1, _ = atoi32(vals[aiSocketColor1])
	it.SocketContent1, _ = atoi32(vals[aiSocketContent1])
	it.SocketColor2, _ = atoi32(vals[aiSocketColor2])
	it.SocketContent2, _ = atoi32(vals[aiSocketContent2])
	it.SocketColor3, _ = atoi32(vals[aiSocketColor3])
	it.SocketContent3, _ = atoi32(vals[aiSocketContent3])
	it.SocketBonus, _ = atoi32(vals[aiSocketBonus])
	it.GemProperties, _ = atoi32(vals[aiGemProperties])
	it.RequiredDisenchantSkill, _ = atoi32(vals[aiReqDisenchant])
	it.ArmorDamageModifier, _ = atof64(vals[aiArmorDmgMod])
	it.Duration, _ = atoi32(vals[aiDuration])
	it.ItemLimitCategory, _ = atoi32(vals[aiItemLimitCat])
	it.HolidayID, _ = atoi32(vals[aiHolidayID])
	it.DisenchantID, _ = atoi32(vals[aiDisenchantID])
	it.FoodType, _ = atoi32(vals[aiFoodType])
	it.MinMoneyLoot, _ = atoi32(vals[aiMinMoneyLoot])
	it.MaxMoneyLoot, _ = atoi32(vals[aiMaxMoneyLoot])

	return it, nil
}

// itemRowFromNamedValues builds a WorldItemTemplate from column-name-indexed values.
// Used for Classic-format dumps that have explicit column lists.
// Column names are matched case-insensitively (idx keys are already lowercase).
func itemRowFromNamedValues(vals []string, idx map[string]int) (database.WorldItemTemplate, error) {
	var it database.WorldItemTemplate

	entry := colStr(vals, idx, "entry")
	if entry == "" {
		return it, fmt.Errorf("item row missing 'entry' column")
	}
	var err error
	it.Entry, err = atoi32(entry)
	if err != nil {
		return it, fmt.Errorf("item entry: %w", err)
	}

	it.Class = colI32(vals, idx, "class")
	it.Subclass = colI32(vals, idx, "subclass")
	it.Name = colStr(vals, idx, "name")
	it.DisplayID = colI32(vals, idx, "displayid")
	it.Quality = colI32(vals, idx, "quality")
	it.Flags = colI32(vals, idx, "flags")
	it.BuyCount = colI32(vals, idx, "buycount")
	it.BuyPrice = colI32(vals, idx, "buyprice")
	it.SellPrice = colI32(vals, idx, "sellprice")
	it.InventoryType = colI32(vals, idx, "inventorytype")
	it.AllowableClass = colI32(vals, idx, "allowableclass")
	it.AllowableRace = colI32(vals, idx, "allowablerace")
	it.ItemLevel = colI32(vals, idx, "itemlevel")
	it.RequiredLevel = colI32(vals, idx, "requiredlevel")
	it.RequiredSkill = colI32(vals, idx, "requiredskill")
	it.RequiredSkillRank = colI32(vals, idx, "requiredskillrank")
	it.RequiredSpell = colI32(vals, idx, "requiredspell")
	it.RequiredHonorRank = colI32(vals, idx, "requiredhonorrank")
	it.RequiredCityRank = colI32(vals, idx, "requiredcityrank")
	it.RequiredReputationFaction = colI32(vals, idx, "requiredreputationfaction")
	it.RequiredReputationRank = colI32(vals, idx, "requiredreputationrank")
	it.MaxCount = colI32(vals, idx, "maxcount")
	it.Stackable = colI32(vals, idx, "stackable")
	it.ContainerSlots = colI32(vals, idx, "containerslots")

	for i := 1; i <= 10; i++ {
		typ := colI32(vals, idx, fmt.Sprintf("stat_type%d", i))
		val := colI32(vals, idx, fmt.Sprintf("stat_value%d", i))
		switch i {
		case 1:  it.StatType1, it.StatValue1 = typ, val
		case 2:  it.StatType2, it.StatValue2 = typ, val
		case 3:  it.StatType3, it.StatValue3 = typ, val
		case 4:  it.StatType4, it.StatValue4 = typ, val
		case 5:  it.StatType5, it.StatValue5 = typ, val
		case 6:  it.StatType6, it.StatValue6 = typ, val
		case 7:  it.StatType7, it.StatValue7 = typ, val
		case 8:  it.StatType8, it.StatValue8 = typ, val
		case 9:  it.StatType9, it.StatValue9 = typ, val
		case 10: it.StatType10, it.StatValue10 = typ, val
		}
	}

	it.DmgMin1 = colF64(vals, idx, "dmg_min1")
	it.DmgMax1 = colF64(vals, idx, "dmg_max1")
	it.DmgType1 = colI32(vals, idx, "dmg_type1")
	it.DmgMin2 = colF64(vals, idx, "dmg_min2")
	it.DmgMax2 = colF64(vals, idx, "dmg_max2")
	it.DmgType2 = colI32(vals, idx, "dmg_type2")
	it.Armor = colI32(vals, idx, "armor")
	it.HolyRes = colI32(vals, idx, "holy_res")
	it.FireRes = colI32(vals, idx, "fire_res")
	it.NatureRes = colI32(vals, idx, "nature_res")
	it.FrostRes = colI32(vals, idx, "frost_res")
	it.ShadowRes = colI32(vals, idx, "shadow_res")
	it.ArcaneRes = colI32(vals, idx, "arcane_res")
	it.Delay = colI32(vals, idx, "delay")
	it.AmmoType = colI32(vals, idx, "ammo_type")
	it.RangeMod = colF64(vals, idx, "rangedmodrange")

	for i := 1; i <= 5; i++ {
		sid := colI32(vals, idx, fmt.Sprintf("spellid_%d", i))
		trig := colI32(vals, idx, fmt.Sprintf("spelltrigger_%d", i))
		chg := colI32(vals, idx, fmt.Sprintf("spellcharges_%d", i))
		ppm := colF64(vals, idx, fmt.Sprintf("spellppmrate_%d", i))
		cd := colI32(vals, idx, fmt.Sprintf("spellcooldown_%d", i))
		cat := colI32(vals, idx, fmt.Sprintf("spellcategory_%d", i))
		catcd := colI32(vals, idx, fmt.Sprintf("spellcategorycooldown_%d", i))
		switch i {
		case 1:
			it.Spellid1, it.Spelltrigger1, it.Spellcharges1 = sid, trig, chg
			it.Spellppmrate1, it.Spellcooldown1, it.Spellcategory1, it.Spellcategorycooldown1 = ppm, cd, cat, catcd
		case 2:
			it.Spellid2, it.Spelltrigger2, it.Spellcharges2 = sid, trig, chg
			it.Spellppmrate2, it.Spellcooldown2, it.Spellcategory2, it.Spellcategorycooldown2 = ppm, cd, cat, catcd
		case 3:
			it.Spellid3, it.Spelltrigger3, it.Spellcharges3 = sid, trig, chg
			it.Spellppmrate3, it.Spellcooldown3, it.Spellcategory3, it.Spellcategorycooldown3 = ppm, cd, cat, catcd
		case 4:
			it.Spellid4, it.Spelltrigger4, it.Spellcharges4 = sid, trig, chg
			it.Spellppmrate4, it.Spellcooldown4, it.Spellcategory4, it.Spellcategorycooldown4 = ppm, cd, cat, catcd
		case 5:
			it.Spellid5, it.Spelltrigger5, it.Spellcharges5 = sid, trig, chg
			it.Spellppmrate5, it.Spellcooldown5, it.Spellcategory5, it.Spellcategorycooldown5 = ppm, cd, cat, catcd
		}
	}

	it.Bonding = colI32(vals, idx, "bonding")
	it.Description = colStr(vals, idx, "description")
	it.PageText = colI32(vals, idx, "pagetext")
	it.PageLanguage = colI32(vals, idx, "languageid")
	it.PageMaterial = colI32(vals, idx, "pagematerial")
	it.StartQuest = colI32(vals, idx, "startquest")
	it.LockID = colI32(vals, idx, "lockid")
	it.Material = colI32(vals, idx, "material")
	it.Sheath = colI32(vals, idx, "sheath")
	it.RandomProperty = colI32(vals, idx, "randomproperty")
	it.RandomSuffix = colI32(vals, idx, "randomsuffix")
	it.Block = colI32(vals, idx, "block")
	it.SetID = colI32(vals, idx, "itemset")
	it.MaxDurability = colI32(vals, idx, "maxdurability")
	it.AreaBound = colI32(vals, idx, "area")
	it.MapBound = colI32(vals, idx, "map")
	it.BagFamily = colI32(vals, idx, "bagfamily")
	it.TotemCategory = colI32(vals, idx, "totemcategory")
	it.SocketColor1 = colI32(vals, idx, "socketcolor_1")
	it.SocketContent1 = colI32(vals, idx, "socketcontent_1")
	it.SocketColor2 = colI32(vals, idx, "socketcolor_2")
	it.SocketContent2 = colI32(vals, idx, "socketcontent_2")
	it.SocketColor3 = colI32(vals, idx, "socketcolor_3")
	it.SocketContent3 = colI32(vals, idx, "socketcontent_3")
	it.SocketBonus = colI32(vals, idx, "socketbonus")
	it.GemProperties = colI32(vals, idx, "gemproperties")
	it.RequiredDisenchantSkill = colI32(vals, idx, "requireddisenchantskill")
	it.ArmorDamageModifier = colF64(vals, idx, "armordamagemodifier")
	it.Duration = colI32(vals, idx, "duration")
	it.ItemLimitCategory = colI32(vals, idx, "itemlimitcategory")
	it.HolidayID = colI32(vals, idx, "holidayid")
	it.DisenchantID = colI32(vals, idx, "disenchantid")
	it.FoodType = colI32(vals, idx, "foodtype")
	it.MinMoneyLoot = colI32(vals, idx, "minmoneyloot")
	it.MaxMoneyLoot = colI32(vals, idx, "maxmoneyloot")

	return it, nil
}

func atoi32(s string) (int32, error) {
	// Handle float values like "422.5" by truncating
	if strings.Contains(s, ".") {
		f, err := strconv.ParseFloat(s, 64)
		return int32(f), err
	}
	v, err := strconv.ParseInt(s, 10, 32)
	return int32(v), err
}

func atoi64(s string) (int64, error) {
	v, err := strconv.ParseInt(s, 10, 64)
	return v, err
}

func atof64(s string) (float64, error) {
	return strconv.ParseFloat(s, 64)
}

func unquote(s string) string {
	// Values from parseOneValue are already unquoted/unescaped for strings
	return s
}
