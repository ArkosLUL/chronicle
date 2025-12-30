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
gen: database/dump.sql database/querier.go wasm
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

frontend/chronicle/dist: $(wildcard frontend/*)
	(cd frontend/chronicle; pnpm install; pnpm build)

.PHONY: build-site
build-site: frontend/chronicle/dist

.PHONY: develop
develop: build-site
	go run --tags static ./cmd/chronicled server --dev-auth