PHONY: install
install:
	(cd ./combatlog && go install ./cmd/chronicle)

wasm:
	(cd ./combatlog && GOOS=js GOARCH=wasm go build -o ../site/parser.wasm ./cmd/wasm/)

.PHONY: gen
gen: database/dump.sql database/querier.go wasm
	go generate ./...

database/dump.sql: $(wildcard database/migrations/*.sql)
	go run ./database/gen/dump/main.go

database/querier.go: database/sqlc.yaml database/dump.sql $(wildcard database/queries/*.sql)
	./database/generate.sh
