registry=docker.io/connextproject
project=$(shell cat package.json | grep '"name":' | awk -F '"' '{print $$4}')

# Get absolute paths to important dirs
cwd=$(shell pwd)
contracts=$(cwd)/modules/contracts
client=$(cwd)/modules/client
db=$(cwd)/modules/database
hub=$(cwd)/modules/hub
proxy=$(cwd)/modules/proxy
dashboard=$(cwd)/modules/dashboard
dashboard_server=$(cwd)/modules/dashboard-server

# Specify make-specific variables (VPATH = prerequisite search path)
VPATH=build
SHELL=/bin/bash

# Fetch Prerequisites
find_options=-type f -not -path "*/node_modules/*" -not -name "*.swp" -not -path "*/.*" -not -name "*.log"

# Setup docker run time
# If on Linux, give the container our uid & gid so we know what to reset permissions to
# On Mac the docker-VM care of this for us so pass root's id (noop)
my_id=$(shell id -u):$(shell id -g)
id=$(shell if [[ "`uname`" == "Darwin" ]]; then echo 0:0; else echo $(my_id); fi)
docker_run=docker run --name=$(project)_builder --tty --rm
docker_run_in_client=$(docker_run) --volume=$(client):/root $(project)_builder  $(id)
docker_run_in_contracts=$(docker_run) --volume=$(client):/client --volume=$(contracts):/root $(project)_builder $(id)
docker_run_in_hub=$(docker_run) --volume=$(client):/client --volume=$(hub):/root $(project)_builder $(id)
docker_run_in_db=$(docker_run) --volume=$(db):/root $(project)_builder $(id)
docker_run_in_dashboard=$(docker_run) --volume=$(dashboard):/root $(project)_builder $(id)
docker_run_in_dashboard_server=$(docker_run) --volume=$(dashboard_server):/root $(project)_builder $(id)

# Env setup
$(shell mkdir -p build $(contracts)/build $(db)/build $(hub)/dist)
version=$(shell cat package.json | grep "\"version\":" | egrep -o "[.0-9]+")

install=npm install --prefer-offline --silent --no-progress > /dev/null 2>&1
log_start=@echo "=============";echo "[Makefile] => Start building $@"; date "+%s" > build/.timestamp
log_finish=@echo "[Makefile] => Finished building $@ in $$((`date "+%s"` - `cat build/.timestamp`)) seconds";echo "=============";echo

########################################
# Begin Phony Rules
.PHONY: default all dev prod start start-prod stop restart restart-prod clean reset purge push push-live backup

default: dev
all: dev prod
dev: hooks database hub proxy client dashboard dashboard-server
prod: hooks database-prod hub-prod-image proxy-prod dashboard-server-prod

start: dev
	bash ops/start-dev.sh

start-prod: prod
	bash ops/start-prod.sh

start-test: prod contract-artifacts
	INDRA_ETH_NETWORK="ganache" INDRA_MODE="test" bash ops/start-prod.sh

stop: 
	bash ops/stop.sh

restart: dev
	bash ops/stop.sh
	bash ops/start-dev.sh

restart-prod:
	bash ops/stop.sh
	bash ops/start-prod.sh

clean: stop
	docker container prune -f
	rm -rf build/*
	rm -rf modules/**/build
	rm -rf modules/**/dist
	rm -rf modules/**/types
	rm -rf modules/**/node_modules/**/.git

reset-base: stop
	docker container prune -f
	docker volume rm $(project)_database_dev 2> /dev/null || true
	docker volume rm $(project)_chain_dev 2> /dev/null || true

reset-client: reset-base
	rm -rf build/client*  $(client)/dist $(client)/node_modules $(client)/package-lock.json

reset-contracts: reset-base
	rm -rf build/contract* $(contracts)/build/* $(contracts)/node_modules $(contracts)/package-lock.json
	docker volume rm $(project)_chain_dev 2> /dev/null || true

reset-dashboard: reset-base
	rm -rf build/dashboard* $(dashboard)/build/* $(dashboard)/node_modules $(dashboard)/package-lock.json

reset-dashboard-server: reset-base
	rm -rf build/dashboard* $(dashboard_server)/build/* $(dashboard_server)/node_modules $(dashboard_server)/package-lock.json

reset-database: reset-base
	rm -rf build/database* $(db)/build/* $(db)/node_modules $(db)/package-lock.json
	docker volume rm $(project)_database_dev 2> /dev/null || true

reset-hub: reset-base
	rm -rf build/hub* $(hub)/dist/* $(hub)/node_modules $(hub)/package-lock.json

reset: reset-base
	docker volume rm $(project)_chain_dev 2> /dev/null || true
	docker volume rm $(project)_database_dev 2> /dev/null || true
	rm -rf $(db)/snapshots/ganache-*

purge: reset clean
	rm -rf modules/**/node_modules

push-latest: prod
	bash ops/push-images.sh latest database hub proxy dashboard

push-live: prod
	bash ops/push-images.sh $(version) database hub proxy dashboard

backup:
	bash $(db)/ops/run-backup.sh

########################################
# Begin Tests

# set a default test command for developer convenience
test: test-default
test-default: test-client
test-all: test-client test-contracts test-hub

test-client: contract-node-modules client
	bash ops/test-client.sh

watch-client:
	bash ops/test-client.sh --watch

test-contracts: client contract-artifacts
	bash ops/test-contracts.sh

test-hub: hub database
	bash ops/test-hub.sh

watch-hub:
	bash ops/test-hub.sh --watch

########################################
# Begin Real Rules

# Proxy

proxy-prod: dashboard-prod $(shell find $(proxy) $(find_options))
	$(log_start)
	docker build --file $(proxy)/prod.dockerfile --tag $(project)_proxy:latest .
	$(log_finish) && touch build/$@

proxy: $(shell find $(proxy) $(find_options))
	$(log_start)
	docker build --file $(proxy)/dev.dockerfile --tag $(project)_proxy:dev .
	$(log_finish) && touch build/$@

# Dashboard Server

dashboard-server-prod: dashboard-server-node-modules
	$(log_start)
	docker build --file $(dashboard_server)/ops/prod.dockerfile --tag $(project)_dashboard:latest $(dashboard_server)
	$(log_finish) && touch build/$@

dashboard-server: dashboard-server-node-modules

dashboard-server-node-modules: builder $(dashboard_server)/package.json
	$(log_start)
	$(docker_run_in_dashboard_server) "$(install)"
	$(log_finish) && touch build/$@

# Dashboard Client

dashboard-prod: dashboard-node-modules $(shell find $(dashboard)/src $(dashboard)/ops $(find_options))
	$(log_start)
	$(docker_run_in_dashboard) "cp -f ops/prod.env .env"
	$(docker_run_in_dashboard) "npm run build"
	$(docker_run_in_dashboard) "cp -f ops/dev.env .env"
	$(log_finish) && touch build/$@

dashboard: dashboard-node-modules $(dashboard)/ops/dev.env
	$(log_start)
	$(docker_run_in_dashboard) "cp -f ops/dev.env .env"
	$(log_finish) && touch build/$@

dashboard-node-modules: builder $(dashboard)/package.json
	$(log_start)
	$(docker_run_in_dashboard) "$(install)"
	$(log_finish) && touch build/$@

# Hub

hub-prod-image: hub-prod
	$(log_start)
	docker build --file $(hub)/ops/prod.dockerfile --tag $(project)_hub:latest $(hub)
	$(log_finish) && touch build/$@

hub: hub-node-modules client contract-artifacts $(shell find $(hub)/src $(find_options))
	$(log_start)
	$(docker_run_in_hub) "./node_modules/.bin/tsc -p tsconfig.json"
	$(log_finish) && touch build/$@

hub-prod: hub-prod-node-modules
	$(log_start)
	$(docker_run_in_hub) "./node_modules/.bin/tsc -p tsconfig.json"
	$(log_finish) && touch build/$@

hub-node-modules: builder $(hub)/package.json $(client)/package.json
	$(log_start)
	$(docker_run_in_hub) "rm -rf node_modules/connext"
	$(docker_run_in_hub) "$(install)"
	$(docker_run_in_hub) "rm -rf node_modules/connext/dist \
	  && ln -s ../../../client/dist node_modules/connext/dist \
	  && rm -rf node_modules/connext/types \
	  && ln -s ../../../client/types node_modules/connext/types \
	  && rm -rf node_modules/connext/src \
	  && ln -s ../../../client/src node_modules/connext/src" 
	$(log_finish) && touch build/$@ && rm -f build/hub-prod-node-modules

hub-prod-node-modules: builder $(hub)/package.json
	$(log_start)
	$(docker_run_in_hub) "rm -rf node_modules/connext"
	$(docker_run_in_hub) "$(install)"
	$(log_finish) && touch build/$@ && rm -f build/hub-node-modules

# Contracts

contract-artifacts: contract-node-modules $(shell find $(contracts)/contracts $(find_options))
	$(log_start)
	$(docker_run_in_contracts) "npm run build"
	$(log_finish) && touch build/$@

contract-node-modules: builder $(contracts)/package.json
	$(log_start)
	$(docker_run_in_contracts) "rm -rf node_modules/connext"
	$(docker_run_in_contracts) "$(install)"
	$(docker_run_in_contracts) "rm -rf node_modules/connext/dist \
	  && ln -s ../../../client/dist node_modules/connext/dist \
	  && rm -rf node_modules/connext/types \
	  && ln -s ../../../client/types node_modules/connext/types \
	  && rm -rf node_modules/connext/src \
	  && ln -s ../../../client/src node_modules/connext/src" 
	@touch build/client-node-modules
	$(log_finish) && touch build/$@

# Client

client: client-node-modules $(shell find $(client)/src $(find_options))
	$(log_start)
	$(docker_run_in_client) "npm run build"
	$(log_finish) && touch build/$@

client-node-modules: builder $(client)/package.json
	$(log_start)
	$(docker_run_in_client) "$(install)"
	$(log_finish) && touch build/$@ && touch build/client

# Database

database-prod: database
	$(log_start)
	docker tag $(project)_database:dev $(project)_database:latest
	$(log_finish) && touch build/$@

database: database-node-modules database-migrations $(shell find $(db)/ops $(find_options))
	$(log_start)
	docker build --file $(db)/ops/db.dockerfile --tag $(project)_database:dev $(db)
	$(log_finish) && touch build/$@

database-migrations: $(db)/ops/ejs-render.js $(shell find $(db)/migrations $(db)/templates $(find_options))
	$(log_start)
	$(docker_run_in_db) "make"
	$(log_finish) && touch build/$@

database-node-modules: builder $(db)/package.json
	$(log_start)
	$(docker_run_in_db) "$(install)"
	$(log_finish) && touch build/$@

# Builder, etc

builder: ops/builder.dockerfile
	$(log_start)
	docker build --file ops/builder.dockerfile --tag $(project)_builder:latest .
	$(log_finish) && touch build/$@

root-node-modules: package.json
	$(log_start)
	$(install)
	$(log_finish) && touch build/$@

hooks: ops/pre-push.sh
	$(log_start)
	rm -f .git/hooks/*
	cp ops/pre-push.sh .git/hooks/pre-push
	chmod +x .git/hooks/pre-push
	$(log_finish) && touch build/$@
