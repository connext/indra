organization=connextproject
project=indra_v2

# Specify make-specific variables (VPATH = prerequisite search path)
flags=.makeflags
VPATH=$(flags)
SHELL=/bin/bash

find_options=-type f -not -path "*/node_modules/*" -not -name "*.swp" -not -path "*/.*" -not -name "*.log"

registry=docker.io/$(organization)
version=$(shell cat package.json | grep '"version":' | egrep -o "[.0-9]+")

# Get absolute paths to important dirs
cwd=$(shell pwd)
nats=$(cwd)/modules/nats-messaging-client
node=$(cwd)/modules/node
client=$(cwd)/modules/client
bot=$(cwd)/modules/payment-bot
types=$(cwd)/modules/types

# Setup docker run time
# If on Linux, give the container our uid & gid so we know what to reset permissions to
# On Mac the docker-VM care of this for us so pass root's id (noop)
my_id=$(shell id -u):$(shell id -g)
id=$(shell if [[ "`uname`" == "Darwin" ]]; then echo 0:0; else echo $(my_id); fi)
docker_run=docker run --name=$(project)_builder --tty --rm
docker_run_in_root=$(docker_run) --volume=$(cwd):/root $(project)_builder $(id)

log_start=@echo "=============";echo "[Makefile] => Start building $@"; date "+%s" > $(flags)/.timestamp
log_finish=@echo "[Makefile] => Finished building $@ in $$((`date "+%s"` - `cat $(flags)/.timestamp`)) seconds";echo "=============";echo

# Env setup
$(shell mkdir -p .makeflags $(node)/dist)

########################################
# Begin Phony Rules
.PHONY: default all dev prod start start-prod stop restart restart-prod clean reset purge push-latest backup

default: dev
all: dev prod
dev: node types client payment-bot
prod: node-prod

start: dev
	bash ops/start-dev.sh

stop:
	bash ops/stop.sh

restart: dev
	bash ops/stop.sh
	bash ops/start-dev.sh

start-prod: prod
	bash ops/start-prod.sh

restart-prod:
	bash ops/stop.sh
	bash ops/start-prod.sh

clean: stop
	docker container prune -f
	rm -rf $(flags)/*
	rm -rf modules/**/dist
	rm -rf modules/**/node_modules/**/.git

reset: stop
	docker container prune -f
	docker volume rm $(project)_database_dev 2> /dev/null || true
	docker secret rm $(project)_database_dev 2> /dev/null || true
	docker volume rm $(project)_chain_dev 2> /dev/null || true

push-latest: prod
	bash ops/push-images.sh latest node

########################################
# Begin Test Rules

test: test-node
watch: watch-node

test-node: node
	bash ops/test-node.sh

watch-node: node-modules
	bash ops/test-node.sh --watch

########################################
# Begin Real Rules

payment-bot: node-modules client types $(shell find $(bot)/src $(find_options))
	$(log_start)
	$(docker_run_in_root) "cd modules/payment-bot && npm run build"
	$(log_finish) && touch $(flags)/$@

client: types nats-client $(shell find $(client)/src $(find_options))
	$(log_start)
	$(docker_run_in_root) "cd modules/client && npm run build"
	$(docker_run_in_root) "rm -rf modules/payment-bot/node_modules/@connext/client"
	$(docker_run_in_root) "ln -s ../../../client modules/payment-bot/node_modules/@connext/client"
	$(log_finish) && touch $(flags)/$@

types: node-modules  $(shell find $(client)/src $(find_options))
	$(log_start)
	$(docker_run_in_root) "cd modules/types && npm run build"
	$(log_finish) && touch $(flags)/$@

node-prod: node $(node)/ops/prod.dockerfile
	$(log_start)
	docker build --file $(node)/ops/prod.dockerfile --tag $(project)_node:latest .
	$(log_finish) && touch $(flags)/$@

node: types nats-client address-book.json $(shell find $(node)/src $(find_options))
	$(log_start)
	$(docker_run_in_root) "cp -f address-book.json modules/node/src"
	$(docker_run_in_root) "cd modules/node && npm run build"
	$(log_finish) && touch $(flags)/$@

nats-client: node-modules $(shell find $(nats)/src $(find_options))
	$(log_start)
	$(docker_run_in_root) "cd modules/nats-messaging-client && npm run build"
	$(log_finish) && touch $(flags)/$@

node-modules: builder package.json lerna.json $(node)/package.json $(client)/package.json $(bot)/package.json
	$(log_start)
	$(docker_run_in_root) "lerna bootstrap --hoist"
	$(log_finish) && touch $(flags)/$@

builder: ops/builder.dockerfile
	$(log_start)
	docker build --file ops/builder.dockerfile --tag $(project)_builder:latest .
	$(log_finish) && touch $(flags)/$@

