PHONY: install
install:
	(cd ./combatlog && go install ./cmd/chronicle)

wasm:
	(cd ./combatlog && GOOS=js GOARCH=wasm go build -o ../site/parser.wasm ./cmd/wasm/)