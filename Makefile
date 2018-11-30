project=connext

# Get absolute paths to important dirs
cwd=$(shell pwd)
contracts=$(cwd)/modules/contracts
hub=$(cwd)/modules/hub
db=$(cwd)/modules/database

# Fetch Prerequisites
find_options=-type f -not -path "*/node_modules/*" -not -name "*.swp"
contracts_src=$(shell find $(contracts)/contracts $(contracts)/migrations $(contracts)/ops $(find_options))
db_prereq=$(shell find $(db) $(find_options))

# Setup docker run time
docker_run=docker run --name=buidler --tty --rm
docker_run_in_contracts=$(docker_run) --volume=$(contracts):/app builder:dev
docker_run_in_hub=$(docker_run) --volume=$(hub):/app builder:dev
docker_run_in_db=$(docker_run) --volume=$(db):/app builder:dev

# Tell make where to look for prerequisites
VPATH=build:$(contracts)/build:$(hub)/build

# Env setup
$(shell mkdir -p build $(contracts)/build $(hub)/build)

# Begin Phony Rules
.PHONY: default dev clean stop

default: dev
dev: ethprovider hub database

clean:
	rm -rf build/*
	rm -rf $(hub)/build/*
	rm -f $(contracts)/build/state-hash

stop: 
	bash ops/stop.sh

# Begin Real Rules

# Database

database: database-node-modules $(db_prereq)
	docker build --file $(db)/ops/db.dockerfile --tag $(project)_database:dev $(db)
	touch build/database

database-node-modules: $(db)/package.json
	$(docker_run_in_db) "yarn install"

# Hub

hub: hub-node-modules

hub-node-modules: builder $(hub)/package.json
	$(docker_run_in_hub) "yarn install"
	touch build/hub-node-modules

# Contracts

ethprovider: contract-node-modules
	docker build --file $(contracts)/ops/truffle.dockerfile --tag $(project)_ethprovider:dev $(contracts)
	touch build/ethprovider

contract-node-modules: builder $(contracts)/package.json
	$(docker_run_in_contracts) "yarn install"
	touch build/contract-node-modules

# Builder
builder: ops/builder.dockerfile
	docker build --file ops/builder.dockerfile --tag builder:dev .
	touch build/builder
