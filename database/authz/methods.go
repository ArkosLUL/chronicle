package authz

import (
	"context"
	"fmt"

	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/authz/policy"
	"github.com/authzed/gochugaru/rel"
	"github.com/google/uuid"
)

type interceptor struct {
	Authorizer
	database.Store
}

func (z *interceptor) DeleteAllParsedLogsByGroupID(ctx context.Context, id uuid.UUID) error {
	return z.Store.DeleteAllParsedLogsByGroupID(ctx, id)
}

func (z *interceptor) DeleteThisQuery(ctx context.Context) error {
	return z.Store.DeleteThisQuery(ctx)
}

func (z *interceptor) DeleteWoWLogGroup(ctx context.Context, id uuid.UUID) error {
	b := policy.New().Raid_log(id).Object()
	f := rel.NewFilter(b.Typ, b.ID, "")
	err := z.Delete(ctx, rel.NewPreconditionedFilter(f))
	if err != nil {
		return fmt.Errorf("delete authz relations: %w", err)
	}
	return z.Store.DeleteWoWLogGroup(ctx, id)
}

func (z *interceptor) InsertEncounterCharacterFights(ctx context.Context, arg []database.InsertEncounterCharacterFightsParams) *database.InsertEncounterCharacterFightsBatchResults {
	return z.Store.InsertEncounterCharacterFights(ctx, arg)
}

func (z *interceptor) InsertInstance(ctx context.Context, arg database.InsertInstanceParams) (database.LogInstance, error) {
	b := policy.New()
	b.Instance(arg.ID).
		PublicWildcard().
		Raid_log(b.Raid_log(arg.LogGroupID))

	_, err := z.Write(ctx, *b.Txn())
	if err != nil {
		return database.LogInstance{}, err
	}
	return z.Store.InsertInstance(ctx, arg)
}

func (z *interceptor) InsertWoWLogGroup(ctx context.Context, arg database.InsertWoWLogGroupParams) (database.WoWLogGroup, error) {
	b := policy.New()
	b.Raid_log(arg.ID).
		Uploader(b.User(arg.Owner)).
		Chronicle(b.GlobalChronicle())

	_, err := z.Write(ctx, *b.Txn())
	if err != nil {
		return database.WoWLogGroup{}, err
	}
	return z.Store.InsertWoWLogGroup(ctx, arg)
}

func (z *interceptor) InstanceEvent(ctx context.Context, arg database.InstanceEventParams) (database.LogInstanceEvent, error) {
	return z.Store.InstanceEvent(ctx, arg)
}

func (z *interceptor) InstancePlayersByInstanceID(ctx context.Context, instanceID uuid.UUID) ([]database.LogInstancePlayer, error) {
	return z.Store.InstancePlayersByInstanceID(ctx, instanceID)
}

func (z *interceptor) InstanceUnitsByInstanceID(ctx context.Context, instanceID uuid.UUID) ([]database.LogInstanceUnit, error) {
	return z.Store.InstanceUnitsByInstanceID(ctx, instanceID)
}

func (z *interceptor) ListAllWoWLogGroupsWithOwner(ctx context.Context) ([]database.ListAllWoWLogGroupsWithOwnerRow, error) {
	return z.Store.ListAllWoWLogGroupsWithOwner(ctx)
}

func (z *interceptor) UpdateUserAuthSessionTokens(ctx context.Context, arg database.UpdateUserAuthSessionTokensParams) (database.UserAuthSession, error) {
	return z.Store.UpdateUserAuthSessionTokens(ctx, arg)
}
