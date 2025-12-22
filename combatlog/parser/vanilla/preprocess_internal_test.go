package vanilla

import (
	"fmt"
	"regexp"
	"testing"

	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestYouReplacements(t *testing.T) {
	t.Parallel()

	replacer := &youReplacer{
		Me: types.Unit{
			Name: "Doyd",
			Gid:  0x000000000001C7AC,
		},
	}

	exps := map[string]string{
		"Power Word: Fortitude fades from you.":                                                          "Power Word: Fortitude fades from 0x000000000001C7AC.",
		"Stormpike Mountaineer dies, you gain 34 experience. (+17 exp Rested bonus)":                     "Stormpike Mountaineer dies, 0x000000000001C7AC gains 34 experience. (+17 exp Rested bonus)",
		"Stormpike Explosives Expert's Land Mine Impact hits you for 1505 Fire damage.":                  "Stormpike Explosives Expert's Land Mine Impact hits 0x000000000001C7AC for 1505 Fire damage.",
		"Doyd gains 158 health from your Renew.":                                                         "Doyd gains 158 health from 0x000000000001C7AC's Renew.",
		"You fail to cast Holy Fire: Invalid target.":                                                    "",
		"Your Greater Heal critically heals you for 2229.":                                               "0x000000000001C7AC's Greater Heal critically heals 0x000000000001C7AC for 2229.",
		"You gain Inspiration (1).":                                                                      "0x000000000001C7AC gains Inspiration (1).",
		"You fail to cast Lesser Heal: Not yet recovered.":                                               "",
		"Your Greater Heal heals Exitium for 1551.":                                                      "0x000000000001C7AC's Greater Heal heals Exitium for 1551.",
		"Your Frostwolf Clan reputation has increased by 1.":                                             "0x000000000001C7AC's Frostwolf Clan reputation has increased by 1.",
		"LOOT: 20.11.25 14:37:08&You receive loot: |cffffffff|Hitem:18144:0:0:0|h[Human Bone Chip]|h|r.": "LOOT: 20.11.25 14:37:08&0x000000000001C7AC receives loot: |cffffffff|Hitem:18144:0:0:0|h[Human Bone Chip]|h|r.",
		"You fall and lose 982 health.":                                                                  "0x000000000001C7AC falls and loses 982 health.",
		"You fail to cast Renew: A more powerful spell is already active.":                               "",
		"You have slain Stormpike Bowman!":                                                               "Stormpike Bowman is slain by 0x000000000001C7AC.",
		"Your Eviscerate hits Stormpike Bowman for 1088.":                                                "0x000000000001C7AC's Eviscerate hits Stormpike Bowman for 1088.",
		"0x00000000000AAB93's Flash of Light heals you for 370.":                                         "0x00000000000AAB93's Flash of Light heals 0x000000000001C7AC for 370.",
		"LOOT: 13.12.25 23:00:18&You receive loot: |cffffffff|Hitem:61409:0:0:0|h[Hyjalroot]|h|r.":       "LOOT: 13.12.25 23:00:18&0x000000000001C7AC receives loot: |cffffffff|Hitem:61409:0:0:0|h[Hyjalroot]|h|r.",
	}

	// Ignore "You" in names
	notYous := []string{
		"CAST: Sotatz casts Find Herbs(2383).",
		"CAST: Breakurface casts Heavy Linen Bandage(3276).",
		"CAST: Youdaboss begins to cast Riding Turtle(30174).",
		"CAST: Youlogsowdag casts Charge(11578)(Rank 3) on Pillesnuppen.",
	}
	for _, str := range notYous {
		exps[str] = str
	}

	for input, expected := range exps {
		t.Run(input, func(t *testing.T) {
			// content starts with a space. Handle it here for easier reading in the map.
			output, err := replacer.Preprocess(input)
			require.NoError(t, err)
			assert.Equal(t, expected, output)
		})
	}
}

func TestSingleReplacement(t *testing.T) {
	t.Parallel()

	replacer := &youReplacer{
		Me: types.Unit{
			Name: "Doyd",
			Gid:  0x000000000001C7AC,
		},
	}

	input := "Power Word: Fortitude fades from you."
	// content starts with a space. Handle it here for easier reading in the map.
	output, err := replacer.Preprocess(input)
	require.NoError(t, err)
	fmt.Println(output)

	fmt.Println(regexp.MustCompile(` You gain`).MatchString(" You gain Inspiration (1)."))

}
