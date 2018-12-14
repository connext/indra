project=connext

# Specify make-specific variables (VPATH = prerequisite search path)
VPATH=build:$(contracts)/build:$(hub)/build
SHELL=/bin/bash

me=$(shell whoami)

# Get absolute paths to important dirs
cwd=$(shell pwd)
contracts=$(cwd)/modules/contracts
hub=$(cwd)/modules/hub
db=$(cwd)/modules/database
e2e=$(cwd)/modules/e2e

# Fetch Prerequisites
find_options=-type f -not -path "*/node_modules/*" -not -name "*.swp" -not -path "*/.*"
contracts_src=$(shell find $(contracts)/contracts $(contracts)/migrations $(contracts)/ops $(find_options))
db_prereq=$(shell find $(db) $(find_options))
hub_prereq=$(shell find $(hub) $(find_options))

# Setup docker run time
# If on Linux, give the container our uid & gid so we know what to set permissions to
# On Mac the VM docker runs in takes care of this for us so don't pass in an id
id=$(shell id -u):$(shell id -g)
run_as_user=$(shell if [[ "`uname`" == "Darwin" ]]; then echo "--user $(id)"; fi)
docker_run=docker run --name=$(project)_buidler --tty --rm $(run_as_user)
docker_run_in_contracts=$(docker_run) --volume=$(contracts):/root builder:dev $(id)
docker_run_in_hub=$(docker_run) --volume=$(hub):/root builder:dev $(id)
docker_run_in_db=$(docker_run) --volume=$(db):/root builder:dev $(id)
docker_run_in_e2e=$(docker_run) --volume=$(e2e):/root builder:dev $(id)

# Env setup
$(shell mkdir -p build $(contracts)/build $(db)/build $(hub)/dist)
version=$(shell cat package.json | grep "\"version\":" | egrep -o "[.0-9]+")
registry=docker.io

# Begin Phony Rules
.PHONY: default all dev prod clean stop purge deploy deploy-live test

default: dev
all: dev prod
dev: database ethprovider hub e2e-node-modules
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

deploy: prod
	docker tag $(project)_database:latest $(registry)/$(me)/$(project)_database:latest
	docker tag $(project)_hub:latest $(registry)/$(me)/$(project)_hub:latest
	docker push $(registry)/$(me)/$(project)_database:latest
	docker push $(registry)/$(me)/$(project)_hub:latest

deploy-live: prod
	docker tag $(project)_database:latest $(registry)/$(me)/$(project)_database:$(version)
	docker tag $(project)_hub:latest $(registry)/$(me)/$(project)_hub:$(version)
	docker push $(registry)/$(me)/$(project)_database:$(version)
	docker push $(registry)/$(me)/$(project)_hub:$(version)

test: hub
	bash $(hub)/ops/test.sh

# Begin Real Rules

# Hub

hub-prod: hub
	docker tag $(project)_hub:dev $(project)_hub:latest
	touch build/hub-prod

hub: hub-js $(hub_prereq)
	docker build --file $(hub)/ops/hub.dockerfile --tag $(project)_hub:dev $(hub)
	touch build/hub

hub-js: hub-node-modules $(hub_prereq)
	$(docker_run_in_hub) "./node_modules/.bin/tsc -p tsconfig.json"
	touch build/hub-js

hub-node-modules: builder $(hub)/package.json
	$(docker_run_in_hub) "yarn install"
	touch build/hub-node-modules

# Database

database-prod: database
	docker tag $(project)_database:dev $(project)_database:latest
	touch build/database-prod

database: database-node-modules migration-templates $(db_prereq)
	docker build --file $(db)/ops/db.dockerfile --tag $(project)_database:dev $(db)
	touch build/database

migration-templates: $(db_prereq)
	$(docker_run_in_db) "make"
	touch build/migration-templates

database-node-modules: builder $(db)/package.json
	$(docker_run_in_db) "yarn install"
	touch build/database-node-modules

# Contracts

ethprovider: contract-artifacts
	docker build --file $(contracts)/ops/truffle.dockerfile --tag $(project)_ethprovider:dev $(contracts)
	touch build/ethprovider

contract-artifacts: contract-node-modules
	$(docker_run_in_contracts) "yarn build"
	$(docker_run_in_contracts) "bash ops/inject-addresses.sh"
	touch build/contract-artifacts

contract-node-modules: builder $(contracts)/package.json
	$(docker_run_in_contracts) "yarn install"
	touch build/contract-node-modules

# Test

e2e-node-modules: builder $(e2e)/package.json
	$(docker_run_in_e2e) "yarn install"
	touch build/e2e-node-modules

# Builder
builder: ops/builder.dockerfile ops/permissions-fixer.sh
	docker build --file ops/builder.dockerfile --tag builder:dev .
	touch build/builder
