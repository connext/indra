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

# Specify make-specific variables (VPATH = prerequisite search path)
VPATH=build:$(contracts)/build:$(hub)/dist
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

# Env setup
$(shell mkdir -p build $(contracts)/build $(db)/build $(hub)/dist)
version=$(shell cat package.json | grep "\"version\":" | egrep -o "[.0-9]+")

install=npm install --prefer-offline --unsafe-perm
log_start=@echo "=============";echo "[Makefile] => Start building $@"; date "+%s" > build/.timestamp
log_finish=@echo "[Makefile] => Finished building $@ in $$((`date "+%s"` - `cat build/.timestamp`)) seconds";echo "=============";echo

########################################
# Begin Phony Rules
.PHONY: default all dev prod stop clean deep-clean reset purge push push-live backup

default: dev
all: dev prod
dev: database hub proxy client dashboard
prod: database-prod hub-prod proxy-prod dashboard-server-prod

start: dev
	bash ops/deploy.dev.sh

start-prod: prod
	bash ops/deploy.prod.sh

stop: 
	bash ops/stop.sh

clean: stop
	docker container prune -f
	rm -rf build/*

deep-clean: clean
	rm -rf $(cwd)/modules/**/build
	rm -rf $(cwd)/modules/**/dist

reset: stop
	docker container prune -f
	docker volume rm $(project)_database_dev 2> /dev/null || true
	docker volume rm $(project)_chain_dev 2> /dev/null || true
	docker volume rm `docker volume ls -q | grep "[0-9a-f]\{64\}" | tr '\n' ' '` 2> /dev/null || true
	rm -f $(db)/snapshots/ganache-*

purge: reset deep-clean
	rm -rf $(cwd)/modules/**/node_modules

push: prod
	docker tag $(project)_database:latest $(registry)/$(project)_database:latest
	docker tag $(project)_hub:latest $(registry)/$(project)_hub:latest
	docker tag $(project)_proxy:latest $(registry)/$(project)_proxy:latest
	docker tag $(project)_dashboard:latest $(registry)/$(project)_dashboard:latest
	docker push $(registry)/$(project)_database:latest
	docker push $(registry)/$(project)_hub:latest
	docker push $(registry)/$(project)_proxy:latest
	docker push $(registry)/$(project)_dashboard:latest

push-live: prod
	docker tag $(project)_database:latest $(registry)/$(project)_database:$(version)
	docker tag $(project)_hub:latest $(registry)/$(project)_hub:$(version)
	docker tag $(project)_proxy:latest $(registry)/$(project)_proxy:$(version)
	docker tag $(project)_dashboard:latest $(registry)/$(project)_dashboard:$(version)
	docker push $(registry)/$(project)_database:$(version)
	docker push $(registry)/$(project)_hub:$(version)
	docker push $(registry)/$(project)_proxy:$(version)
	docker push $(registry)/$(project)_dashboard:$(version)

backup:
	bash $(db)/ops/run-backup.sh

########################################
# Begin Tests

# set a default test command for developer convenience
test: test-default
test-default: test-client
test-all: test-client test-contracts test-hub test-e2e

test-client: client
	bash ops/test-client.sh

test-contracts: contract-artifacts
	bash ops/test-contracts.sh

test-hub: hub database
	bash ops/test-hub.sh

test-e2e: root-node-modules prod
	npm stop
	MODE=test npm run start-prod
	./node_modules/.bin/cypress run
	npm stop

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

dashboard-server-prod: dashboard-prod
	$(log_start)
	docker build --file $(dashboard)/ops/prod.dockerfile --tag $(project)_dashboard:latest $(dashboard)
	$(log_finish) && touch build/$@

# Dashboard Client

dashboard-prod: dashboard-node-modules $(shell find $(dashboard)/src $(dashboard)/ops $(find_options))
	$(log_start)
	$(docker_run_in_dashboard) "cp -f ops/prod.env .env"
	$(docker_run_in_dashboard) "npm run build"
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

hub-prod: hub
	$(log_start)
	docker build --file $(hub)/ops/prod.dockerfile --tag $(project)_hub:latest .
	$(log_finish) && touch build/$@

hub: hub-node-modules contract-artifacts $(shell find $(hub) $(find_options))
	$(log_start)
	$(docker_run_in_hub) "./node_modules/.bin/tsc -p tsconfig.json"
	$(log_finish) && touch build/$@

hub-node-modules: builder $(hub)/package.json
	$(log_start)
	$(docker_run_in_hub) "rm -rf node_modules/connext"
	$(docker_run_in_hub) "$(install)"
	$(docker_run_in_hub) "rm -rf node_modules/connext"
	$(docker_run_in_hub) "ln -s ../../client node_modules/connext"
	$(docker_run_in_hub) "cd ../client && $(install)"
	@touch build/client && touch build/client-node-modules
	$(log_finish) && touch build/$@

# Contracts

contract-artifacts: contract-node-modules $(shell find $(contracts)/contracts $(find_options))
	$(log_start)
	$(docker_run_in_contracts) "npm run build"
	$(log_finish) && touch build/$@

contract-node-modules: builder $(contracts)/package.json
	$(log_start)
	$(docker_run_in_contracts) "rm -rf node_modules/connext"
	$(docker_run_in_contracts) "$(install)"
	$(docker_run_in_contracts) "rm -rf node_modules/connext"
	$(docker_run_in_contracts) "ln -s ../../client node_modules/connext"
	$(docker_run_in_contracts) "cd ../client && $(install)"
	@touch build/client && touch build/client-node-modules
	$(log_finish) && touch build/$@

# Client

client: client-node-modules $(shell find $(client)/src)
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

database: database-node-modules migration-templates $(shell find $(db)/ops $(find_options))
	$(log_start)
	docker build --file $(db)/ops/db.dockerfile --tag $(project)_database:dev $(db)
	$(log_finish) && touch build/$@

migration-templates: $(db)/ops/ejs-render.js $(shell find $(db)/migrations $(db)/templates $(find_options))
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
