# Specify make-specific variables (VPATH = prerequisite search path)
VPATH=build:$(contracts)/build:$(hub)/build
SHELL=/bin/bash

app=connext
me=$(shell whoami)

# Get absolute paths to important dirs
cwd=$(shell pwd)
contracts=$(cwd)/modules/contracts
hub=$(cwd)/modules/hub
db=$(cwd)/modules/database

# Fetch Prerequisites
find_options=-type f -not -path "*/node_modules/*" -not -name "*.swp"
contracts_src=$(shell find $(contracts)/contracts $(contracts)/migrations $(contracts)/ops $(find_options))
db_prereq=$(shell find $(db) $(find_options))
hub_prereq=$(shell find $(hub) $(find_options))

# Setup docker run time
# If on Linux, we need to set file permissions ourselves (Mac's VM takes care of this for us)
# give the container our uid & gid so we know what to set permissions to
id=$(shell id -u):$(shell id -g)
run_as_user=$(shell if [[ "`uname`" == "Darwin" ]]; then echo "--user $(id)"; fi)
docker_run=docker run --name=buidler --tty --rm $(run_as_user)
docker_run_in_contracts=$(docker_run) --volume=$(contracts):/root builder:dev $(id)
docker_run_in_hub=$(docker_run) --volume=$(hub):/root builder:dev $(id)
docker_run_in_db=$(docker_run) --volume=$(db):/root builder:dev $(id)

# Env setup
$(shell mkdir -p build $(contracts)/build $(db)/build $(hub)/build)
version=$(shell cat package.json | grep "\"version\":" | egrep -o "[.0-9]+")
registry=docker.io

# Begin Phony Rules
.PHONY: default dev clean stop

default: dev
all: dev prod
dev: database ethprovider hub
prod: chainsaw-prod database-prod hub-prod

clean:
	rm -rf build/*
	rm -f $(contracts)/build/state-hash
	rm -rf $(db)/build/*
	rm -rf $(hub)/build/*

stop: 
	docker container stop buidler 2> /dev/null || true
	bash ops/stop.sh

purge: stop clean
	docker container prune -f
	docker volume rm connext_database_dev || true
	docker volume rm connext_chain_dev || true
	docker volume rm `docker volume ls -q | grep "[0-9a-f]\{64\}" | tr '\n' ' '` 2> /dev/null || true

deploy: prod
	docker tag $(app)_database:latest $(registry)/$(me)/database:latest
	docker tag $(app)_hub:latest $(registry)/$(me)/hub:latest
	docker tag $(app)_chainsaw:latest $(registry)/$(me)/chainsaw:latest
	docker push $(registry)/$(me)/database:latest
	docker push $(registry)/$(me)/hub:latest
	docker push $(registry)/$(me)/chainsaw:latest

deploy-live: prod
	docker tag $(app)_database:latest $(registry)/$(me)/database:$(version)
	docker tag $(app)_hub:latest $(registry)/$(me)/hub:$(version)
	docker tag $(app)_chainsaw:latest $(registry)/$(me)/chainsaw:$(version)
	docker push $(registry)/$(me)/database:$(version)
	docker push $(registry)/$(me)/hub:$(version)
	docker push $(registry)/$(me)/chainsaw:$(version)

# Begin Real Rules

# Hub

chainsaw-prod: hub-js
	docker build --file $(hub)/ops/chainsaw.dockerfile --tag $(app)_chainsaw:latest $(hub)
	touch build/chainsaw-prod

hub-prod: hub-js
	docker build --file $(hub)/ops/hub.dockerfile --tag $(app)_hub:latest $(hub)
	touch build/hub-prod

hub: hub-js $(hub_prereq)
	docker build --file $(hub)/ops/dev.dockerfile --tag $(app)_hub:dev $(hub)
	touch build/hub

hub-js: hub-node-modules $(hub_prereq)
	$(docker_run_in_hub) "yarn build"
	touch build/hub-js

hub-node-modules: builder $(hub)/package.json $(hub)/yarn.lock
	$(docker_run_in_hub) "yarn install"
	touch build/hub-node-modules

# Database

database-prod: database
	docker tag $(app)_database:dev $(app)_database:latest
	touch build/database-prod

database: database-node-modules migration-templates $(db_prereq)
	docker build --file $(db)/ops/db.dockerfile --tag $(app)_database:dev $(db)
	touch build/database

migration-templates: $(db_prereq)
	$(docker_run_in_db) "make"
	touch build/migration-templates

database-node-modules: builder $(db)/package.json $(db)/yarn.lock
	$(docker_run_in_db) "yarn install"
	touch build/database-node-modules

# Contracts

ethprovider: contract-node-modules
	docker build --file $(contracts)/ops/truffle.dockerfile --tag $(app)_ethprovider:dev $(contracts)
	touch build/ethprovider

contract-node-modules: builder $(contracts)/package.json $(contracts)/yarn.lock
	$(docker_run_in_contracts) "yarn install"
	touch build/contract-node-modules

# Test

test-hub: hub-node-modules ops/test-entry.sh ops/test.dockerfile
	docker build --file ops/test.dockerfile --tag $(app)_test:dev .
	touch build/test-hub

# Builder
builder: ops/builder.dockerfile
	docker build --file ops/builder.dockerfile --tag builder:dev .
	touch build/builder
