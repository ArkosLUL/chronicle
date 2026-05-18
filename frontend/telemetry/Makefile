WRANGLER := npx wrangler

.PHONY: install dev deploy typecheck migrate-local migrate-remote db-create

## Install dependencies
install:
	npm install

## Start local dev server
dev:
	$(WRANGLER) dev

## Run TypeScript typecheck
typecheck:
	npx tsc --noEmit

## Apply D1 migrations locally
migrate-local:
	$(WRANGLER) d1 migrations apply chronicle-telemetry --local

## Apply D1 migrations to production
migrate-remote:
	$(WRANGLER) d1 migrations apply chronicle-telemetry --remote

## Create the D1 database (run once, then paste database_id into wrangler.toml)
db-create:
	$(WRANGLER) d1 create chronicle-telemetry

## Deploy to Cloudflare Workers
deploy:
	$(WRANGLER) deploy
