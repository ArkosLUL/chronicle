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

func (z *interceptor) DeleteWoWLogGroup(ctx context.Context, id uuid.UUID) error {
	b := policy.New().Raid_log(id).Object()
	f := rel.NewFilter(b.Typ, b.ID, "")
	err := z.Delete(ctx, rel.NewPreconditionedFilter(f))
	if err != nil {
		return fmt.Errorf("delete authz relations: %w", err)
	}
	return z.Store.DeleteWoWLogGroup(ctx, id)
}

func (z *interceptor) DeleteLogInstanceByIDAndGroup(ctx context.Context, arg database.DeleteLogInstanceByIDAndGroupParams) (uuid.UUID, error) {
	b := policy.New().Instance(arg.ID).Object()
	f := rel.NewFilter(b.Typ, b.ID, "")
	err := z.Delete(ctx, rel.NewPreconditionedFilter(f))
	if err != nil {
		return uuid.Nil, fmt.Errorf("delete authz relations: %w", err)
	}
	return z.Store.DeleteLogInstanceByIDAndGroup(ctx, arg)
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

func (z *interceptor) CreateUserPanelLayout(ctx context.Context, arg database.CreateUserPanelLayoutParams) (database.UserPanelLayout, error) {
	if arg.ID == uuid.Nil {
		arg.ID = uuid.New()
	}

	if !arg.UserID.Valid {
		return database.UserPanelLayout{}, fmt.Errorf("create layout missing user id")
	}

	b := policy.New()
	b.Layout(arg.ID).
		Owner(b.User(arg.UserID.UUID)).
		Chronicle(b.GlobalChronicle())

	_, err := z.Write(ctx, *b.Txn())
	if err != nil {
		return database.UserPanelLayout{}, err
	}

	return z.Store.CreateUserPanelLayout(ctx, arg)
}

func (z *interceptor) DeleteUserPanelLayoutByID(ctx context.Context, id uuid.UUID) (int64, error) {
	obj := policy.New().Layout(id).Object()
	f := rel.NewFilter(obj.Typ, obj.ID, "")
	err := z.Delete(ctx, rel.NewPreconditionedFilter(f))
	if err != nil {
		return 0, fmt.Errorf("delete authz relations: %w", err)
	}
	return z.Store.DeleteUserPanelLayoutByID(ctx, id)
}

func (z *interceptor) UpsertGuild(ctx context.Context, arg database.UpsertGuildParams) (database.Guild, error) {
	g, err := z.Store.UpsertGuild(ctx, arg)
	if err != nil {
		return database.Guild{}, err
	}

	b := policy.New()
	b.Guild(g.ID).Chronicle(b.GlobalChronicle())

	_, err = z.Write(ctx, *b.Txn())
	if err != nil {
		return database.Guild{}, err
	}
	return g, nil
}

func (z *interceptor) InsertWoWServer(ctx context.Context, arg database.InsertWoWServerParams) (database.WowServer, error) {
	b := policy.New()
	b.Wow_server(arg.ID).Chronicle(b.GlobalChronicle())

	_, err := z.Write(ctx, *b.Txn())
	if err != nil {
		return database.WowServer{}, err
	}
	return z.Store.InsertWoWServer(ctx, arg)
}

func (z *interceptor) DeleteWoWServer(ctx context.Context, id uuid.UUID) error {
	obj := policy.New().Wow_server(id).Object()
	f := rel.NewFilter(obj.Typ, obj.ID, "")
	err := z.Delete(ctx, rel.NewPreconditionedFilter(f))
	if err != nil {
		return fmt.Errorf("delete authz relations: %w", err)
	}
	return z.Store.DeleteWoWServer(ctx, id)
}

func (z *interceptor) InsertWoWServerRealm(ctx context.Context, arg database.InsertWoWServerRealmParams) (database.WowServerRealm, error) {
	b := policy.New()
	b.Wow_server_realm(arg.ID).Wow_server(b.Wow_server(arg.ServerID))

	_, err := z.Write(ctx, *b.Txn())
	if err != nil {
		return database.WowServerRealm{}, err
	}
	return z.Store.InsertWoWServerRealm(ctx, arg)
}

func (z *interceptor) DeleteWoWServerRealm(ctx context.Context, id uuid.UUID) error {
	obj := policy.New().Wow_server_realm(id).Object()
	f := rel.NewFilter(obj.Typ, obj.ID, "")
	err := z.Delete(ctx, rel.NewPreconditionedFilter(f))
	if err != nil {
		return fmt.Errorf("delete authz relations: %w", err)
	}
	return z.Store.DeleteWoWServerRealm(ctx, id)
}

func (z *interceptor) InsertUploadKey(ctx context.Context, arg database.InsertUploadKeyParams) (database.WowServerUploadKey, error) {
	b := policy.New()
	b.Wow_server_realm(arg.RealmID).World_daemon(b.Wow_server_upload_key(arg.ID))

	_, err := z.Write(ctx, *b.Txn())
	if err != nil {
		return database.WowServerUploadKey{}, err
	}
	return z.Store.InsertUploadKey(ctx, arg)
}

func (z *interceptor) DeleteUploadKey(ctx context.Context, id uuid.UUID) error {
	obj := policy.New().Wow_server_upload_key(id).Object()
	f := rel.NewFilter(obj.Typ, obj.ID, "")
	err := z.Delete(ctx, rel.NewPreconditionedFilter(f))
	if err != nil {
		return fmt.Errorf("delete authz relations: %w", err)
	}
	return z.Store.DeleteUploadKey(ctx, id)
}

func (z *interceptor) UpsertPlayers(ctx context.Context, args []database.UpsertPlayersParams) *database.UpsertPlayersBatchResults {
	b := policy.New()
	g := b.GlobalChronicle()
	for _, arg := range args {
		b.Armory_player(arg.ID).Chronicle(g)
	}

	_, err := z.Write(ctx, *b.Txn())
	if err != nil {
		return database.FailedUpsertPlayersBatchResults()
	}

	return z.Store.UpsertPlayers(ctx, args)
}
func (z *interceptor) InsertUserAuthSession(ctx context.Context, arg database.InsertUserAuthSessionParams) (database.UserAuthSession, error) {
	session, err := z.Store.InsertUserAuthSession(ctx, arg)
	if err != nil {
		return session, err
	}

	b := policy.New()
	usr := b.User(arg.UserID)

	// Every user gets chronicle_member
	b.GlobalChronicle().Chronicle_member(usr)

	// First user auth link = first real signup → technical_admin
	count, err := z.CountUserAuthLinks(ctx)
	fmt.Println(count)
	if err != nil {
		return session, fmt.Errorf("count user auth links: %w", err)
	}

	if count == 1 {
		// The very first user is made a technical admin by default so they can manage the system.
		b.GlobalChronicle().Technical_admin(usr)
	}

	_, err = z.Write(ctx, *b.Txn())
	if err != nil {
		return session, fmt.Errorf("write user roles: %w", err)
	}

	return session, nil
}
