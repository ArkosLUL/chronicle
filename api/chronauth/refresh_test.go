package chronauth

//func TestRefreshSQL(t *testing.T) {
//	db, _ := dbtestutil.NewDB(t)
//	ctx := testutil.Context(t, testutil.WaitLong)
//
//	user, err := db.InsertUser(ctx, database.InsertUserParams{
//		ID:       uuid.New(),
//		Username: "test",
//		Email:    "test@test.com",
//	})
//	require.NoError(t, err)
//
//	auth, err := db.InsertUserAuth(ctx, database.InsertUserAuthParams{
//		ID:        uuid.New(),
//		LinkedID:  "linked-id",
//		UserID:    user.ID,
//		Provider:  "discord",
//		CreatedAt: database.Timestamptz(time.Now()),
//		UpdatedAt: database.Timestamptz(time.Now()),
//	})
//	require.NoError(t, err)
//
//	session, err := db.InsertUserAuthSession(ctx, database.InsertUserAuthSessionParams{
//		ID:                uuid.New(),
//		UserID:            user.ID,
//		UserAuthID:        auth.ID,
//		AccessToken:       "",
//		AccessTokenSecret: "",
//		RefreshToken:      "",
//		ExpiresAt:         database.Timestamptz(time.Now()),
//		CreatedAt:         database.Timestamptz(time.Now()),
//		UpdatedAt:         database.Timestamptz(time.Now()),
//	})
//	require.NoError(t, err)
//
//	insertTX := dbtestutil.StartTx(t, db, nil)
//
//	txSession, err := insertTX.GetUserAuthSessionByID(ctx, session.ID)
//	require.NoError(t, err)
//
//	go func() {
//		time.Sleep(time.Second * 4)
//		insertTX.Done()
//	}()
//
//	_, err = db.GetUserAuthSessionByID(ctx, txSession.ID)
//	require.NoError(t, err)
//}
