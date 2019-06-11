organization=connextproject
project=indra_v2

# Specify make-specific variables (VPATH = prerequisite search path)
VPATH=build
SHELL=/bin/bash
flags=.makeflags

find_options=-type f -not -path "*/node_modules/*" -not -name "*.swp" -not -path "*/.*" -not -name "*.log"

registry=docker.io/$(organization)
version=$(shell cat package.json | grep '"version":' | egrep -o "[.0-9]+")

# Get absolute paths to important dirs
cwd=$(shell pwd)
node=$(cwd)/packages/node

# Setup docker run time
# If on Linux, give the container our uid & gid so we know what to reset permissions to
# On Mac the docker-VM care of this for us so pass root's id (noop)
my_id=$(shell id -u):$(shell id -g)
id=$(shell if [[ "`uname`" == "Darwin" ]]; then echo 0:0; else echo $(my_id); fi)
docker_run=docker run --name=$(project)_builder --tty --rm
docker_run_in_root=$(docker_run) --volume=$(cwd):/root $(project)_builder $(id)
docker_run_in_node=$(docker_run) --volume=$(node):/root $(project)_builder $(id)

log_start=@echo "=============";echo "[Makefile] => Start building $@"; date "+%s" > $(flags)/.timestamp
log_finish=@echo "[Makefile] => Finished building $@ in $$((`date "+%s"` - `cat $(flags)/.timestamp`)) seconds";echo "=============";echo

# Env setup
$(shell mkdir -p .makeflags $(node)/dist)

########################################
# Begin Phony Rules
.PHONY: default all dev prod start start-prod stop restart restart-prod clean reset purge push push-live backup

default: dev
all: dev prod
dev: node-modules
prod: node-modules

start: dev
	bash ops/start-dev.sh

stop:
	bash ops/stop.sh

restart: dev
	bash ops/stop.sh
	bash ops/start-dev.sh

clean: stop
	docker container prune -f
	rm -rf $(flags)/*
	rm -rf packages/**/dist
	rm -rf packages/**/node_modules/**/.git

reset: stop
	docker container prune -f
	docker volume rm $(project)_database_dev 2> /dev/null || true
	docker volume rm $(project)_chain_dev 2> /dev/null || true


########################################
# Begin Real Rules

node-modules: builder package.json lerna.json $(node)/package.json
	$(log_start)
	$(docker_run_in_root) "lerna bootstrap"
	$(log_finish) && touch $(flags)/$@

builder: ops/builder.dockerfile
	$(log_start)
	docker build --file ops/builder.dockerfile --tag $(project)_builder:latest .
	$(log_finish) && touch $(flags)/$@

