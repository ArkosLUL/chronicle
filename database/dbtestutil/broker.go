package dbtestutil

import (
	"context"
	"database/sql"
	_ "embed"
	"errors"
	"fmt"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/lib/pq"
	"golang.org/x/xerrors"

	"github.com/Emyrk/chronicle/internal/cryptorand"
)

const ChronicleTestingDBName = "chronicle_testing"

//go:embed chronicle_testing.sql
var chronicleTestingSQLInit string

type Broker struct {
	sync.Mutex
	uuid               uuid.UUID
	chronicleTestingDB *pgx.Conn
	refCount           int
	// we keep a reference to the stdin of the cleaner so that Go doesn't garbage collect it.
	cleanerFD any
}

func (b *Broker) Create(t TBSubset, opts ...OpenOption) (ConnectionParams, error) {
	if err := b.init(t); err != nil {
		return ConnectionParams{}, err
	}
	openOptions := OpenOptions{}
	for _, opt := range opts {
		opt(&openOptions)
	}

	var (
		username = defaultConnectionParams.Username
		password = defaultConnectionParams.Password
		host     = defaultConnectionParams.Host
		port     = defaultConnectionParams.Port
	)
	packageName := getTestPackageName(t)
	testName := t.Name()

	// Use a time-based prefix to make it easier to find the database
	// when debugging.
	now := time.Now().Format("test_2006_01_02_15_04_05")
	dbSuffix, err := cryptorand.StringCharset(cryptorand.Lower, 10)
	if err != nil {
		return ConnectionParams{}, xerrors.Errorf("generate db suffix: %w", err)
	}
	dbName := now + "_" + dbSuffix

	_, err = b.chronicleTestingDB.Exec(context.Background(),
		"INSERT INTO test_databases (name, process_uuid, test_package, test_name) VALUES ($1, $2, $3, $4)",
		dbName, b.uuid, packageName, testName)
	if err != nil {
		return ConnectionParams{}, xerrors.Errorf("insert test_database row: %w", err)
	}

	// if empty createDatabaseFromTemplate will create a new template db
	templateDBName := os.Getenv("DB_FROM")
	if openOptions.DBFrom != nil {
		templateDBName = *openOptions.DBFrom
	}
	if err = createDatabaseFromTemplate(t, defaultConnectionParams, b.chronicleTestingDB, dbName, templateDBName); err != nil {
		return ConnectionParams{}, xerrors.Errorf("create database: %w", err)
	}

	testDBParams := ConnectionParams{
		Username: username,
		Password: password,
		Host:     host,
		Port:     port,
		DBName:   dbName,
	}

	// Optionally log the DSN to help connect to the test database.
	if openOptions.LogDSN {
		_, _ = fmt.Fprintf(os.Stderr, "Connect to the database for %s using: psql '%s'\n", t.Name(), testDBParams.DSN())
	}
	t.Cleanup(b.clean(t, dbName))
	return testDBParams, nil
}

func (b *Broker) clean(t TBSubset, dbName string) func() {
	return func() {
		_, err := b.chronicleTestingDB.Exec(context.Background(), "DROP DATABASE "+dbName+";")
		if err != nil {
			t.Logf("failed to clean up database %q: %s\n", dbName, err.Error())
			return
		}
		_, err = b.chronicleTestingDB.Exec(context.Background(), "UPDATE test_databases SET dropped_at = CURRENT_TIMESTAMP WHERE name = $1", dbName)
		if err != nil {
			t.Logf("failed to mark test database '%s' dropped: %s\n", dbName, err.Error())
		}
	}
}

func (b *Broker) init(t TBSubset) error {
	b.Lock()
	defer b.Unlock()
	if b.chronicleTestingDB != nil {
		// already initialized
		b.refCount++
		t.Cleanup(b.decRef)
		return nil
	}

	connectionParamsInitOnce.Do(func() {
		errDefaultConnectionParamsInit = initDefaultConnection(t)
	})
	if errDefaultConnectionParamsInit != nil {
		return xerrors.Errorf("init default connection params: %w", errDefaultConnectionParamsInit)
	}

	adminDB, err := pgx.Connect(context.Background(), defaultConnectionParams.DSN())
	if err != nil {
		return xerrors.Errorf("open admin postgres connection: %w", err)
	}
	defer adminDB.Close(context.Background())

	row := adminDB.QueryRow(context.Background(), fmt.Sprintf(`
    SELECT 1 FROM pg_database WHERE datname = '%s'
`, ChronicleTestingDBName))
	err = row.Scan(nil)
	if err != nil && errors.Is(err, pgx.ErrNoRows) {
		_, err = adminDB.Exec(context.Background(), fmt.Sprintf("CREATE DATABASE %s;", ChronicleTestingDBName))
		if err != nil {
			return xerrors.Errorf("create chronicle testing database: %w", err)
		}
	}

	chronicleTestingParams := defaultConnectionParams
	chronicleTestingParams.DBName = ChronicleTestingDBName
	chronicleTestingDB, err := pgx.Connect(context.Background(), chronicleTestingParams.DSN())
	if err != nil {
		return xerrors.Errorf("open postgres connection: %w", err)
	}

	// chronicleTestingSQLInit is idempotent, so we can run it every time.
	_, err = chronicleTestingDB.Exec(context.Background(), chronicleTestingSQLInit)
	var pqErr *pq.Error
	if xerrors.As(err, &pqErr) && pqErr.Code == "3D000" {
		// database does not exist.
		chronicleTestingDB.Close(context.Background())
		err = createChronicleTestingDB(t)
		if err != nil {
			return xerrors.Errorf("create chronicle testing db: %w", err)
		}
		chronicleTestingDB, err = pgx.Connect(context.Background(), chronicleTestingParams.DSN())
		if err != nil {
			return xerrors.Errorf("open postgres connection: %w", err)
		}
	} else if err != nil {
		chronicleTestingDB.Close(context.Background())
		return xerrors.Errorf("ping '%s' database: %w", ChronicleTestingDBName, err)
	}
	b.chronicleTestingDB = chronicleTestingDB
	b.refCount++
	t.Cleanup(b.decRef)

	if b.uuid == uuid.Nil {
		b.uuid = uuid.New()
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		b.cleanerFD, err = startCleaner(ctx, t, b.uuid, chronicleTestingParams.DSN())
		if err != nil {
			return xerrors.Errorf("start test db cleaner: %w", err)
		}
	}
	return nil
}

func createChronicleTestingDB(t TBSubset) error {
	db, err := pgx.Connect(context.Background(), defaultConnectionParams.DSN())
	if err != nil {
		return xerrors.Errorf("open postgres connection: %w", err)
	}
	defer func() {
		_ = db.Close(context.Background())
	}()
	err = createAndInitDatabase(t, defaultConnectionParams, db, ChronicleTestingDBName, func(testDB *sql.DB) error {
		_, err := testDB.Exec(chronicleTestingSQLInit)
		return err
	})
	if err != nil {
		return xerrors.Errorf("create chronicle testing db: %w", err)
	}
	return nil
}

func (b *Broker) decRef() {
	b.Lock()
	defer b.Unlock()
	b.refCount--
	if b.refCount == 0 {
		// ensures we don't leave go routines around for GoLeak to find.
		_ = b.chronicleTestingDB.Close(context.Background())
		b.chronicleTestingDB = nil
	}
}

// getTestPackageName returns the package name of the test that called it.
func getTestPackageName(t TBSubset) string {
	packageName := "unknown"
	// Ask runtime.Callers for up to 100 program counters, including runtime.Callers itself.
	pc := make([]uintptr, 100)
	n := runtime.Callers(0, pc)
	if n == 0 {
		// No PCs available. This can happen if the first argument to
		// runtime.Callers is large.
		//
		// Return now to avoid processing the zero Frame that would
		// otherwise be returned by frames.Next below.
		t.Logf("could not determine test package name: no PCs available")
		return packageName
	}

	pc = pc[:n] // pass only valid pcs to runtime.CallersFrames
	frames := runtime.CallersFrames(pc)

	// Loop to get frames.
	// A fixed number of PCs can expand to an indefinite number of Frames.
	for {
		frame, more := frames.Next()

		if strings.HasPrefix(frame.Function, "github.com/Emyrk/Chronicle/") {
			packageName = strings.SplitN(strings.TrimPrefix(frame.Function, "github.com/Emyrk/Chronicle/"), ".", 2)[0]
		}
		if strings.HasPrefix(frame.Function, "testing") {
			break
		}

		// Check whether there are more frames to process after this one.
		if !more {
			break
		}
	}
	return packageName
}
