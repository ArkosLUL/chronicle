package authz

import (
	"context"
)

func RunSchemaMigrations(ctx context.Context, az *Authz) error {
	//rows, err := az.ListAllWoWLogGroupsWithOwner(ctx)
	//if err != nil {
	//	return err
	//}
	//
	//b := policy.New()
	//chron := b.GlobalChronicle()
	//for _, row := range rows {
	//	b.Raid_log(row.WoWLogGroup.ID).
	//		Chronicle(chron).Uploader(b.User(row.WoWLogGroup.Owner))
	//}
	//_, err = az.Write(ctx, *b.Txn())
	//if err != nil {
	//	return err
	//}

	return nil
}
