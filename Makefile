project=connext
registry=docker.io/$(shell whoami)

# Get absolute paths to important dirs
cwd=$(shell pwd)
client=$(cwd)/modules/client
contracts=$(cwd)/modules/contracts
db=$(cwd)/modules/database
hub=$(cwd)/modules/hub
proxy=$(cwd)/modules/proxy
wallet=$(cwd)/modules/wallet

# Specify make-specific variables (VPATH = prerequisite search path)
VPATH=build:$(contracts)/build:$(hub)/dist
SHELL=/bin/bash

# Fetch Prerequisites
find_options=-type f -not -path "*/node_modules/*" -not -name "*.swp" -not -path "*/.*"
client_prereq=$(shell find $(client) $(find_options))
contracts_src=$(shell find $(contracts)/contracts $(contracts)/migrations $(contracts)/ops $(find_options))
db_prereq=$(shell find $(db) $(find_options))
hub_prereq=$(shell find $(hub) $(find_options))
proxy_prereq=$(shell find $(proxy) $(find_options))
wallet_prereq=$(shell find $(wallet) $(find_options))

# Setup docker run time
# If on Linux, give the container our uid & gid so we know what to set permissions to
# On Mac the VM docker runs in takes care of this for us so don't pass in an id
id=$(shell id -u):$(shell id -g)
run_as_user=$(shell if [[ "`uname`" == "Darwin" ]]; then echo "--user $(id)"; fi)
docker_run=docker run --name=$(project)_buidler --tty --rm $(run_as_user)
docker_run_in_client=$(docker_run) --volume=$(client):/root $(project)_builder:dev $(id)
docker_run_in_contracts=$(docker_run) --volume=$(contracts):/root $(project)_builder:dev $(id)
docker_run_in_db=$(docker_run) --volume=$(db):/root $(project)_builder:dev $(id)
docker_run_in_hub=$(docker_run) --volume=$(hub):/root $(project)_builder:dev $(id)
docker_run_in_wallet=$(docker_run) --volume=$(wallet):/root $(project)_builder:dev $(id)

# Env setup
$(shell mkdir -p build $(contracts)/build $(db)/build $(hub)/dist $(client)/dist)
version=$(shell cat package.json | grep "\"version\":" | egrep -o "[.0-9]+")
$(shell docker container stop $(project)_buidler 2> /dev/null || true)

log_start=@echo "=============";echo "[Makefile] => Start building $@"; date "+%s" > build/.timestamp
log_finish=@echo "[Makefile] => Finished building $@ in $$((`date "+%s"` - `cat build/.timestamp`)) seconds";echo "=============";echo

# Begin Phony Rules
.PHONY: default all dev prod clean stop purge deploy deploy-live test

default: dev
all: dev prod
dev: client database ethprovider hub wallet proxy
prod: database-prod hub-prod

clean:
	rm -rf build/*
	rm -f $(contracts)/build/state-hash
	rm -rf $(db)/build/*
	rm -rf $(hub)/dist/*

stop: 
	docker container stop $(project)_buidler 2> /dev/null || true
	bash ops/stop.sh

purge: stop clean
	docker container prune -f
	docker volume rm connext_database_dev || true
	docker volume rm connext_chain_dev || true
	docker volume rm `docker volume ls -q | grep "[0-9a-f]\{64\}" | tr '\n' ' '` 2> /dev/null || true

tags: prod
	docker tag $(project)_database:latest $(registry)/$(project)_database:latest
	docker tag $(project)_hub:latest $(registry)/$(project)_hub:latest

deploy: tags
	docker push $(registry)/$(project)_database:latest
	docker push $(registry)/$(project)_hub:latest

deploy-live: prod
	docker tag $(project)_database:latest $(registry)/$(project)_database:$(version)
	docker tag $(project)_hub:latest $(registry)/$(project)_hub:$(version)
	docker push $(registry)/$(project)_database:$(version)
	docker push $(registry)/$(project)_hub:$(version)

test: hub
	bash $(hub)/ops/test.sh

# Begin Real Rules

# Proxy

proxy:
	$(log_start) && docker build --file $(proxy)/dev.dockerfile --tag $(project)_proxy:dev .
	$(log_finish) && touch build/wallet

# Wallet

wallet: wallet-node-modules $(wallet_prereq)
	$(log_start) && docker build --file $(wallet)/ops/dev.dockerfile --tag $(project)_wallet:dev $(wallet)
	touch build/wallet && $(log_finish)

wallet-node-modules: $(project)_builder $(wallet)/package.json
	$(log_start) && $(docker_run_in_wallet) "yarn install --network-timeout 1000000"
	touch build/wallet-node-modules && $(log_finish)

# Client

client: client-node-modules $(client_prereq)
	$(log_start) && $(docker_run_in_client) "yarn build"
	touch build/client-js && $(log_finish)

client-node-modules: $(project)_builder $(client)/package.json
	$(log_start) && $(docker_run_in_client) "yarn install --network-timeout 1000000"
	touch build/client-node-modules && $(log_finish)

# Hub

hub-prod: hub-js
	$(log_start) && docker build --file $(hub)/ops/prod.dockerfile --tag $(project)_hub:latest $(hub)
	touch build/hub-prod && $(log_finish)

hub: hub-js
	$(log_start) && docker build --file $(hub)/ops/dev.dockerfile --tag $(project)_hub:dev $(hub)
	touch build/hub && $(log_finish)

hub-js: hub-node-modules $(hub_prereq)
	$(log_start) && $(docker_run_in_hub) "./node_modules/.bin/tsc -p tsconfig.json"
	touch build/hub-js && $(log_finish)

hub-node-modules: $(project)_builder $(hub)/package.json
	$(log_start) && $(docker_run_in_hub) "yarn install --network-timeout 1000000"
	touch build/hub-node-modules && $(log_finish)

# Database

database-prod: database
	$(log_start) && docker tag $(project)_database:dev $(project)_database:latest
	touch build/database-prod && $(log_finish)

database: database-node-modules migration-templates $(db_prereq)
	$(log_start) && docker build --file $(db)/ops/db.dockerfile --tag $(project)_database:dev $(db)
	touch build/database && $(log_finish)

migration-templates: $(db_prereq)
	$(log_start) && $(docker_run_in_db) "make"
	touch build/migration-templates && $(log_finish)

database-node-modules: $(project)_builder $(db)/package.json
	$(log_start) && $(docker_run_in_db) "yarn install"
	touch build/database-node-modules && $(log_finish)

# Contracts

ethprovider: contract-artifacts
	$(log_start) && docker build --file $(contracts)/ops/truffle.dockerfile --tag $(project)_ethprovider:dev $(contracts)
	touch build/ethprovider && $(log_finish)

contract-artifacts: contract-node-modules
	$(log_start) && $(docker_run_in_contracts) "yarn build && bash ops/inject-addresses.sh"
	touch build/contract-artifacts && $(log_finish)

contract-node-modules: $(project)_builder $(contracts)/package.json
	$(log_start) && $(docker_run_in_contracts) "yarn install --network-timeout 1000000"
	touch build/contract-node-modules && $(log_finish)

# Builder
$(project)_builder: ops/builder.dockerfile ops/permissions-fixer.sh
	$(log_start) && docker build --file ops/builder.dockerfile --tag $(project)_builder:dev .
	touch build/$(project)_builder && $(log_finish)
