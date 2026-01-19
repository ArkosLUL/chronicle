package chroniclesdk

import (
	"encoding/json"
	"testing"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/stretchr/testify/require"
)

func TestGUIDStringJSON(t *testing.T) {
	t.Parallel()

	type TestStruct struct {
		ID GUIDString `json:"id"`
	}

	testValue := TestStruct{
		ID: guid.GUID(0xF130000CE0000D3F),
	}

	jsonData, err := json.Marshal(testValue)
	require.NoError(t, err)
	require.JSONEq(t, `{"id":"0xF130000CE0000D3F"}`, string(jsonData))
}
