package chroniclesdk_test

import (
	"testing"

	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/database"
	"github.com/stretchr/testify/require"
)

func TestEnums(t *testing.T) {
	t.Parallel()

	for _, dbv := range database.AllLogInstanceEventTypeValues() {
		_, err := chroniclesdk.ParseWoWEventType(string(dbv))
		require.NoError(t, err, "db type to SDK type")
	}

	for _, sdkv := range chroniclesdk.WoWEventTypeValues() {
		ok := database.LogInstanceEventType(sdkv).Valid()
		require.True(t, ok, "DB type to sdk type")
	}
}
