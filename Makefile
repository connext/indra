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
contracts_src=$(shell find $(contracts)/contracts $(contracts)/migrations $(contracts)/ops $(find_options))

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
docker_run_in_wallet=$(docker_run) --volume=$(wallet):/root --volume=$(client):/client $(project)_builder:dev $(id)

# Env setup
$(shell mkdir -p build $(contracts)/build $(db)/build $(hub)/dist $(client)/dist)
version=$(shell cat package.json | grep "\"version\":" | egrep -o "[.0-9]+")

log_start=@echo "=============";echo "[Makefile] => Start building $@"; date "+%s" > build/.timestamp
log_finish=@echo "[Makefile] => Finished building $@ in $$((`date "+%s"` - `cat build/.timestamp`)) seconds";echo "=============";echo

# Begin Phony Rules
.PHONY: default all dev prod clean stop purge deploy deploy-live test

default: dev
all: dev prod
dev: client database ethprovider hub wallet proxy
prod: database-prod hub-prod proxy-prod

clean:
	rm -rf build/*
	rm -rf $(cwd)/modules/**/build
	rm -rf $(cwd)/modules/**/dist

deep-clean: clean
	rm -rf $(cwd)/modules/**/node_modules

stop: 
	docker container stop $(project)_buidler 2> /dev/null || true
	bash ops/stop.sh

purge: stop deep-clean
	docker container prune -f
	docker volume rm connext_chain_dev || true
	docker volume rm connext_database_dev || true
	docker volume rm `docker volume ls -q | grep "[0-9a-f]\{64\}" | tr '\n' ' '` 2> /dev/null || true

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
	$(docker_run_in_wallet) "ln -sf /client node_modules/connext"
	$(docker_run_in_wallet) "yarn build"
	$(log_finish) && touch build/wallet-prod

wallet: wallet-node-modules $(shell find $(wallet)/src $(find_options))
	$(log_start)
	docker build --file $(wallet)/ops/dev.dockerfile --tag $(project)_wallet:dev $(wallet)
	$(log_finish) && touch build/wallet

wallet-node-modules: $(project)_builder $(wallet)/package.json client
	$(log_start)
	$(docker_run_in_wallet) "yarn install --network-timeout 1000000"
	$(log_finish) && touch build/wallet-node-modules

# Client

client: client-node-modules $(shell find $(client)/src $(find_options))
	$(log_start)
	$(docker_run_in_client) "npm run build"
	$(log_finish) && touch build/client

client-node-modules: $(project)_builder $(client)/package.json
	$(log_start)
	$(docker_run_in_client) "npm install"
	$(log_finish) && touch build/client-node-modules

# Hub

hub-prod: hub-js
	$(log_start)
	docker build --file $(hub)/ops/prod.dockerfile --tag $(project)_hub:latest $(hub)
	$(log_finish) && touch build/hub-prod

hub: hub-js
	$(log_start)
	docker build --file $(hub)/ops/dev.dockerfile --tag $(project)_hub:dev $(hub)
	$(log_finish) && touch build/hub

hub-js: hub-node-modules $(shell find $(hub) $(find_options))
	$(log_start)
	$(docker_run_in_hub) "./node_modules/.bin/tsc -p tsconfig.json"
	$(log_finish) && touch build/hub-js

hub-node-modules: $(project)_builder $(hub)/package.json
	$(log_start)
	$(docker_run_in_hub) "yarn install --network-timeout 1000000"
	$(log_finish) && touch build/hub-node-modules

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

database-node-modules: $(project)_builder $(db)/package.json
	$(log_start)
	$(docker_run_in_db) "yarn install"
	$(log_finish) && touch build/database-node-modules

# Contracts

ethprovider: contract-artifacts
	$(log_start)
	docker build --file $(contracts)/ops/truffle.dockerfile --tag $(project)_ethprovider:dev $(contracts)
	$(log_finish) && touch build/ethprovider

contract-artifacts: contract-node-modules
	$(log_start)
	$(docker_run_in_contracts) "yarn build && bash ops/inject-addresses.sh"
	$(log_finish) && touch build/contract-artifacts

contract-node-modules: $(project)_builder $(contracts)/package.json
	$(log_start)
	$(docker_run_in_contracts) "yarn install --network-timeout 1000000"
	$(log_finish) && touch build/contract-node-modules

# Builder
$(project)_builder: ops/builder.dockerfile
	$(log_start) && echo "prereqs: $<"
	docker build --file ops/builder.dockerfile --tag $(project)_builder:dev .
	$(log_finish) && touch build/$(project)_builder
