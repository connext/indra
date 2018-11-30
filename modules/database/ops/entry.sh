#!/bin/bash

/docker-entrypoint.sh postgres &

bash ops/wait-for-it.sh localhost:5432

db-migrate up all --verbose --migrations-dir node_modules/machinomy/migrations && db-migrate up --verbose all
