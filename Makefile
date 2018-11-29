# Get absolute paths to important dirs
cwd=$(shell pwd)
contracts=$(cwd)/modules/contracts
hub=$(cwd)/modules/hub

# Tell make where to look for prerequisites
VPATH=build:$(contracts)/build:$(hub)/build

contracts_src=$(shell find $(contracts)/contracts $(contracts)/migrations $(contracts)/ops $(find_options))

docker_run=docker run --name=buidler --tty --rm
docker_run_in_contracts=$(docker_run) --volume=$(contracts):/app builder:dev

# Env setup
$(shell mkdir -p build $(contracts)/build $(hub)/build)

# Begin Phony Rules
.PHONY: default dev clean stop

default: dev
dev: ethprovider

clean:
	rm -rf build/*
	rm -rf $(contracts)/build/*
	rm -rf $(hub)/build/*

stop: 
	docker container stop builder 2> /dev/null || true
	docker container stop postgres 2> /dev/null || true
	docker container stop postgres-test 2> /dev/null || true

# Begin Real Rules

# Hub

hub: hub-node-modules

hub-node-modules: builder $(hub)/package.json
	docker run --rm --tty --name=builder --volume=$(cwd):/app builder:dev "yarn install"
	touch build/hub-node-modules

# Contracts

ethprovider: contract-artifacts
	docker build --file $(contracts)/ops/truffle.dockerfile --tag ethprovider:dev $(contracts)
	touch build/ethprovider

contract-artifacts: contracts-node-modules $(contracts_src)
	$(docker_run_in_contracts) "bash ops/build.sh"
	touch build/contract-artifacts

contracts-node-modules: builder $(contracts)/package.json
	docker run --rm --tty --name=builder --volume=$(contracts):/app builder:dev "yarn install"
	touch build/contracts-node-modules

# Builder
builder: ops/builder.dockerfile
	docker build --file ops/builder.dockerfile --tag builder:dev .
	touch build/builder
