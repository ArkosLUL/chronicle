#!/bin/bash
set -e

# Create the spicedb database for SpiceDB to use
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE spicedb;
EOSQL
