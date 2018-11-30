#!/bin/bash
set -e

/docker-entrypoint.sh postgres &

bash ops/wait-for-it.sh 127.0.0.1:5432

./node_modules/.bin/db-migrate up all --verbose --migrations-dir node_modules/machinomy/migrations
./node_modules/.bin/db-migrate up --verbose all
