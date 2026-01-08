POSTGRES_VERSION ?= 17
POSTGRES_IMAGE   ?= us-docker.pkg.dev/coder-v2-images-public/public/postgres:$(POSTGRES_VERSION)

.PHONY: install
install:
	go install ./cmd/chronicle
	go install ./cmd/chronicled

.PHONY: wasm
wasm:
	GOOS=js GOARCH=wasm go build -tags wasm -o ./site/parser.wasm ./cmd/wasm/

.PHONY: serve
serve: wasm
	@echo "Starting development server at http://localhost:8080"
	@cd site && python3 -m http.server 8080

.PHONY: gen
gen: database/dump.sql database/querier.go wasm frontend/chronicle/src/api/typesGenerated.ts
	go generate ./...

database/dump.sql: $(wildcard database/migrations/*.sql)
	go run ./database/gen/dump/*.go

database/querier.go: database/sqlc.yaml database/dump.sql $(wildcard database/queries/*.sql)
	./database/generate.sh

.PHONY: test
test:
	gotestsum --format testname -- -race $$(go list ./... | grep -v cmd/wasm)

.PHONY: lint
lint:
	golangci-lint run

publish:
	KO_DOCKER_REPO=emyrk go tool ko build ./cmd/chronicled --base-import-paths

frontend/chronicle/dist: $(wildcard frontend/**)
	(cd frontend/chronicle; pnpm install; pnpm build)

.PHONY: develop
develop: frontend/chronicle/dist create-db
	go run --tags static ./cmd/chronicled server --dev-auth

.PHONY: create-db
create-db:
	PGPASSWORD='postgres' createdb -U postgres -h localhost chronicle || true

.PHONY: test-postgres-docker
test-postgres-docker:
	docker rm -f test-postgres-docker-${POSTGRES_VERSION} || true

	docker pull ${POSTGRES_IMAGE}

	# Make sure to not overallocate work_mem and max_connections as each
	# connection will be allowed to use this much memory. Try adjusting
	# shared_buffers instead, if needed.
	#
	# - work_mem=8MB * max_connections=1000 = 8GB
	# - shared_buffers=2GB + effective_cache_size=1GB = 3GB
	#
	# This leaves 5GB for the rest of the system _and_ storing the
	# database in memory (--tmpfs).
	#
	# https://www.postgresql.org/docs/current/runtime-config-resource.html#GUC-WORK-MEM
	docker run \
		--env POSTGRES_PASSWORD=postgres \
		--env POSTGRES_USER=postgres \
		--env POSTGRES_DB=postgres \
		--env PGDATA=/tmp \
		--tmpfs /tmp \
		--publish 5432:5432 \
		--name test-postgres-docker-${POSTGRES_VERSION} \
		--restart no \
		--detach \
		--memory 16GB \
		${POSTGRES_IMAGE} \
		-c shared_buffers=2GB \
		-c effective_cache_size=1GB \
		-c work_mem=8MB \
		-c max_connections=1000 \
		-c fsync=off \
		-c synchronous_commit=off \
		-c full_page_writes=off \
		-c log_statement=all
	while ! pg_isready -h 127.0.0.1
	do
		echo "$(date) - waiting for database to start"
		sleep 0.5
	done

frontend/chronicle/src/api/typesGenerated.ts: $(wildcard scripts/apitypings/*) $(shell find ./api/chroniclesdk $(FIND_EXCLUSIONS) -type f -name '*.go')
	# -C sets the directory for the go run command
	go run -C ./scripts/apitypings main.go > $@
	#(cd frontend/chronicle/ && pnpm exec biome format --write src/api/typesGenerated.ts)
	touch "$@"