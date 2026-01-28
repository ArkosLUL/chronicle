package database_test

import (
	"fmt"
	"testing"

	"github.com/Emyrk/chronicle/database"
	"github.com/google/uuid"
)

func TestInstanceSlug(t *testing.T) {
	t.Parallel()

	fmt.Println(database.InstanceSlug(uuid.New(), "Molten Core"))
}
