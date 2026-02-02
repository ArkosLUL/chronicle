package spice

import (
	"context"

	"github.com/Emyrk/chronicle/database"
)

func (sdb *Spice) WriteRelationship(ctx context.Context) {

}

func (sdb *Spice) InsertUser(ctx context.Context, user database.User) error {
	//relationships, err := sdb.client.WriteRelationships(ctx, &v1.WriteRelationshipsRequest{
	//	Updates: []*v1.RelationshipUpdate{
	//		{
	//			Operation: v1.RelationshipUpdate_OPERATION_CREATE,
	//			Relationship: &v1.Relationship{
	//				Resource:          nil,
	//				Relation:          "",
	//				Subject:           nil,
	//				OptionalCaveat:    nil,
	//				OptionalExpiresAt: nil,
	//			},
	//		},
	//	},
	//	OptionalPreconditions:       nil,
	//	OptionalTransactionMetadata: nil,
	//})
	//if err != nil {
	//	return err
	//}
	return nil
}
