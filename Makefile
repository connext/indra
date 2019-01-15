project=connext
registry=docker.io/$(shell whoami)

# Get absolute paths to important dirs
cwd=$(shell pwd)
contracts=$(cwd)/modules/contracts
client=$(cwd)/modules/client
db=$(cwd)/modules/database
hub=$(cwd)/modules/hub
proxy=$(cwd)/modules/proxy
wallet=$(cwd)/modules/wallet

# Specify make-specific variables (VPATH = prerequisite search path)
VPATH=build:$(contracts)/build:$(hub)/dist
SHELL=/bin/bash

# Fetch Prerequisites
find_options=-type f -not -path "*/node_modules/*" -not -name "*.swp" -not -path "*/.*"
contracts_src=$(shell find $(contracts)/contracts $(contracts)/migrations $(contracts)/ops $(find_options))

# Setup docker run time
# If on Linux, give the container our uid & gid so we know what to reset permissions to
# On Mac the docker-VM care of this for us so pass root's id (noop)
my_id=$(shell id -u):$(shell id -g)
id=$(shell if [[ "`uname`" == "Darwin" ]]; then echo 0:0; else echo $(my_id); fi)
docker_run=docker run --name=$(project)_buidler --tty --rm
docker_run_in_contracts=$(docker_run) --volume=$(contracts):/root $(project)_builder:dev $(id)
docker_run_in_client=$(docker_run) --volume=$(client):/root $(project)_builder:dev $(id)
docker_run_in_db=$(docker_run) --volume=$(db):/root $(project)_builder:dev $(id)
docker_run_in_hub=$(docker_run) --volume=$(client):/client --volume=$(hub):/root $(project)_builder:dev $(id)
docker_run_in_wallet=$(docker_run) --volume=$(client):/client --volume=$(wallet):/root $(project)_builder:dev $(id)

# Env setup
$(shell mkdir -p build $(contracts)/build $(db)/build $(hub)/dist)
version=$(shell cat package.json | grep "\"version\":" | egrep -o "[.0-9]+")

install=npm install --prefer-offline --unsafe-perm
log_start=@echo "=============";echo "[Makefile] => Start building $@"; date "+%s" > build/.timestamp
log_finish=@echo "[Makefile] => Finished building $@ in $$((`date "+%s"` - `cat build/.timestamp`)) seconds";echo "=============";echo

# Begin Phony Rules
.PHONY: default all dev prod clean stop purge deploy deploy-live test

default: dev
all: dev prod
dev: database ethprovider hub wallet proxy
prod: database-prod hub-prod proxy-prod

stop: 
	docker container stop $(project)_buidler 2> /dev/null || true
	bash ops/stop.sh
	docker container prune -f

reset: stop
	docker volume rm connext_chain_dev || true
	rm -f $(contracts)/build/state-hash
	docker volume rm connext_database_dev || true
	docker volume rm `docker volume ls -q | grep "[0-9a-f]\{64\}" | tr '\n' ' '` 2> /dev/null || true

clean:
	rm -rf build/*
	rm -rf $(cwd)/modules/**/build
	rm -rf $(cwd)/modules/**/dist

deep-clean: clean
	rm -rf $(cwd)/modules/**/node_modules

purge: reset deep-clean

tags: prod
	docker tag $(project)_database:latest $(registry)/$(project)_database:latest
	docker tag $(project)_hub:latest $(registry)/$(project)_hub:latest
	docker tag $(project)_proxy:latest $(registry)/$(project)_proxy:latest

deploy: tags
	docker push $(registry)/$(project)_database:latest
	docker push $(registry)/$(project)_hub:latest
	docker push $(registry)/$(project)_proxy:latest

deploy-live: prod
	docker tag $(project)_database:latest $(registry)/$(project)_database:$(version)
	docker tag $(project)_hub:latest $(registry)/$(project)_hub:$(version)
	docker tag $(project)_proxy:latest $(registry)/$(project)_proxy:$(version)
	docker push $(registry)/$(project)_database:$(version)
	docker push $(registry)/$(project)_hub:$(version)
	docker push $(registry)/$(project)_proxy:$(version)

test: hub
	bash $(hub)/ops/test.sh

# Begin Real Rules

# Proxy

proxy-prod: wallet-prod $(shell find $(proxy) $(find_options))
	$(log_start)
	docker build --file $(proxy)/prod.dockerfile --tag $(project)_proxy:latest .
	$(log_finish) && touch build/proxy-prod

proxy: $(shell find $(proxy) $(find_options))
	$(log_start)
	docker build --file $(proxy)/dev.dockerfile --tag $(project)_proxy:dev .
	$(log_finish) && touch build/proxy

# Wallet

wallet-prod: wallet-node-modules $(shell find $(wallet)/src $(find_options))
	$(log_start)
	$(docker_run_in_wallet) "rm -f .env && cp ops/prod.env .env"
	$(docker_run_in_wallet) "npm run build"
	$(log_finish) && touch build/wallet-prod

wallet: wallet-node-modules $(shell find $(wallet)/src $(find_options))
	$(log_start)
	docker build --file $(wallet)/ops/dev.dockerfile --tag $(project)_wallet:dev $(wallet)
	$(log_finish) && touch build/wallet

wallet-node-modules: builder client $(wallet)/package.json
	$(log_start)
	$(docker_run_in_wallet) "rm -f node_modules/connext"
	$(docker_run_in_wallet) "$(install)"
	$(docker_run_in_wallet) "mv -f node_modules/connext node_modules/.connext.backup"
	$(docker_run_in_wallet) "ln -s ../../client node_modules/connext"
	$(log_finish) && touch build/wallet-node-modules

# Hub

hub-prod: hub-js
	$(log_start)
	docker build --file $(hub)/ops/prod.dockerfile --tag $(project)_hub:latest .
	$(log_finish) && touch build/hub-prod

hub: hub-js $(hub)/ops/dev.entry.sh
	$(log_start)
	docker build --file $(hub)/ops/dev.dockerfile --tag $(project)_hub:dev $(hub)
	$(log_finish) && touch build/hub

hub-js: hub-node-modules $(shell find $(hub) $(find_options))
	$(log_start)
	$(docker_run_in_hub) "./node_modules/.bin/tsc -p tsconfig.json"
	$(log_finish) && touch build/hub-js

hub-node-modules: builder client $(hub)/package.json
	$(log_start)
	$(docker_run_in_hub) "rm -rf node_modules/connext"
	$(docker_run_in_hub) "$(install)"
	$(docker_run_in_hub) "mv -f node_modules/connext node_modules/.connext.backup"
	$(docker_run_in_hub) "ln -s ../../client node_modules/connext"
	$(log_finish) && touch build/hub-node-modules

# Client

client: builder $(client)/package.json
	$(log_start)
	$(docker_run_in_client) "$(install)"
	$(log_finish) && touch build/client

# Contracts

ethprovider: contract-artifacts
	$(log_start)
	docker build --file $(contracts)/ops/truffle.dockerfile --tag $(project)_ethprovider:dev $(contracts)
	$(log_finish) && touch build/ethprovider

contract-artifacts: contract-node-modules
	$(log_start)
	$(docker_run_in_contracts) "npm run build"
	$(docker_run_in_contracts) "bash ops/inject-addresses.sh"
	$(log_finish) && touch build/contract-artifacts

contract-node-modules: builder $(contracts)/package.json
	$(log_start)
	$(docker_run_in_contracts) "$(install)"
	$(log_finish) && touch build/contract-node-modules

# Database

database-prod: database
	$(log_start)
	docker tag $(project)_database:dev $(project)_database:latest
	$(log_finish) && touch build/database-prod

database: database-node-modules migration-templates $(db_prereq)
	$(log_start)
	docker build --file $(db)/ops/db.dockerfile --tag $(project)_database:dev $(db)
	$(log_finish) && touch build/database

migration-templates: $(shell find $(db) $(find_options))
	$(log_start)
	$(docker_run_in_db) "make"
	$(log_finish) && touch build/migration-templates

database-node-modules: builder $(db)/package.json
	$(log_start)
	$(docker_run_in_db) "$(install)"
	$(log_finish) && touch build/database-node-modules

# Builder
builder: ops/builder.dockerfile
	$(log_start) && echo "prereqs: $<"
	docker build --file ops/builder.dockerfile --tag $(project)_builder:dev .
	$(log_finish) && touch build/builder
