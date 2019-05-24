#!/bin/sh

IFS="`printf "\n\t"`"
set -eu
cd "$(dirname "$0")"

dropdb --if-exists sc-hub-test
createdb sc-hub-test
DATABASE_URL='postgresql://localhost:5432/sc-hub-test' yarn migrate
set +u
yarn test "${@}"
