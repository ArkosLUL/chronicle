package spice

import (
	"context"
	"time"

	"github.com/Emyrk/chronicle/database"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func (sdb *Spice) DeleteAllParsedLogsByGroupID(ctx context.Context, id uuid.UUID) error {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) DeleteThisQuery(ctx context.Context) error {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) DeleteWoWLogGroup(ctx context.Context, id uuid.UUID) error {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) EncountersByInstanceID(ctx context.Context, instanceID uuid.UUID) ([]database.LogInstanceEncounter, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) GetInstanceEncounterCharacterFights(ctx context.Context, instanceID uuid.UUID) ([]database.LogInstanceEncounterHostile, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) GetInstanceYoutubeData(ctx context.Context, logInstanceID uuid.UUID) (database.LogInstanceYoutubeTimestamped, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) GetUserAuthByLinkedID(ctx context.Context, arg database.GetUserAuthByLinkedIDParams) (database.UserAuthLink, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) GetUserAuthSessionByID(ctx context.Context, id uuid.UUID) (database.UserAuthSession, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) GetUserByID(ctx context.Context, id uuid.UUID) (database.User, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) GetWoWLogFilesByGroupID(ctx context.Context, wowLogID uuid.UUID) ([]database.LogFile, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) GetWoWLogGroupByID(ctx context.Context, id uuid.UUID) (database.GetWoWLogGroupByIDRow, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) GetWoWLogGroupsByOwner(ctx context.Context, owner uuid.UUID) ([]database.GetWoWLogGroupsByOwnerRow, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) InsertEncounter(ctx context.Context, arg database.InsertEncounterParams) (database.LogInstanceEncounter, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) InsertEncounterCharacterFights(ctx context.Context, arg []database.InsertEncounterCharacterFightsParams) *database.InsertEncounterCharacterFightsBatchResults {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) InsertInstance(ctx context.Context, arg database.InsertInstanceParams) (database.LogInstance, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) InsertInstancePlayers(ctx context.Context, arg []database.InsertInstancePlayersParams) *database.InsertInstancePlayersBatchResults {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) InsertInstanceUnits(ctx context.Context, arg []database.InsertInstanceUnitsParams) *database.InsertInstanceUnitsBatchResults {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) InsertLogFile(ctx context.Context, arg database.InsertLogFileParams) (database.LogFile, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) InsertLogInstanceEvents(ctx context.Context, arg []database.InsertLogInstanceEventsParams) *database.InsertLogInstanceEventsBatchResults {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) InsertParsedLogGroup(ctx context.Context, id uuid.UUID) error {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) InsertStampedYoutubeVideo(ctx context.Context, arg database.InsertStampedYoutubeVideoParams) error {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) InsertUser(ctx context.Context, arg database.InsertUserParams) (database.User, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) InsertUserAuth(ctx context.Context, arg database.InsertUserAuthParams) (database.UserAuthLink, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) InsertUserAuthSession(ctx context.Context, arg database.InsertUserAuthSessionParams) (database.UserAuthSession, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) InsertWoWLogGroup(ctx context.Context, arg database.InsertWoWLogGroupParams) (database.WoWLogGroup, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) Instance(ctx context.Context, id uuid.UUID) (database.LogInstance, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) InstanceBySlug(ctx context.Context, hashedSlug pgtype.Text) (database.LogInstance, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) InstanceEvent(ctx context.Context, arg database.InstanceEventParams) (database.LogInstanceEvent, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) InstancePlayersByInstanceID(ctx context.Context, instanceID uuid.UUID) ([]database.LogInstancePlayer, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) InstanceUnitsByInstanceID(ctx context.Context, instanceID uuid.UUID) ([]database.LogInstanceUnit, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) UpdateUserAuthSessionTokens(ctx context.Context, arg database.UpdateUserAuthSessionTokensParams) (database.UserAuthSession, error) {
	//TODO implement me
	panic("implement me")
}

func (sdb *Spice) Ping(ctx context.Context) (time.Duration, error) {
	//TODO implement me
	panic("implement me")
}
