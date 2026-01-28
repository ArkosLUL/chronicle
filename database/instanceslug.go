package database

import (
	"crypto/sha256"
	"encoding/base64"

	"github.com/google/uuid"
)

func InstanceSlug(groupID uuid.UUID, instanceName string) string {
	hash := sha256.New()
	hash.Write([]byte(groupID.String() + instanceName))
	out := hash.Sum(nil)
	return base64.RawURLEncoding.EncodeToString(out[:12])
}
