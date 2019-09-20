project=indra
registry=docker.io/connextproject

# Specify make-specific variables (VPATH = prerequisite search path)
flags=.makeflags
VPATH=$(flags)
SHELL=/bin/bash

find_options=-type f -not -path "*/node_modules/*" -not -name "*.swp" -not -path "*/.*" -not -name "*.log"

version=$(shell cat package.json | grep '"version":' | awk -F '"' '{print $$4}')

# Get absolute paths to important dirs
cwd=$(shell pwd)
bot=$(cwd)/modules/payment-bot
contracts=$(cwd)/modules/contracts
daicard=$(cwd)/modules/daicard
client=$(cwd)/modules/client
messaging=$(cwd)/modules/messaging
node=$(cwd)/modules/node
proxy=$(cwd)/modules/proxy
redis-lock=$(cwd)/modules/redis-lock
proxy-lock=$(cwd)/modules/proxy-lock
types=$(cwd)/modules/types

# Setup docker run time
# If on Linux, give the container our uid & gid so we know what to reset permissions to
# On Mac, the docker-VM takes care of this for us so pass root's id (ie noop)
my_id=$(shell id -u):$(shell id -g)
id=$(shell if [[ "`uname`" == "Darwin" ]]; then echo 0:0; else echo $(my_id); fi)
docker_run=docker run --name=$(project)_builder --tty --rm --volume=$(cwd):/root $(project)_builder $(id)

log_start=@echo "=============";echo "[Makefile] => Start building $@"; date "+%s" > $(flags)/.timestamp
log_finish=@echo "[Makefile] => Finished building $@ in $$((`date "+%s"` - `cat $(flags)/.timestamp`)) seconds";echo "=============";echo

# Env setup
$(shell mkdir -p .makeflags $(node)/dist)

########################################
# Begin Phony Rules
.PHONY: default all dev prod start start-prod stop restart restart-prod clean reset push-latest backup

default: dev
all: dev prod
dev: node types client payment-bot proxy ws-tcp-relay
prod: node-prod proxy-prod ws-tcp-relay

start: dev
	bash ops/start-dev.sh ganache

stop:
	bash ops/stop.sh

restart: dev
	bash ops/stop.sh
	bash ops/start-dev.sh ganache

start-prod: prod
	bash ops/start-prod.sh

restart-prod:
	bash ops/stop.sh
	bash ops/start-prod.sh

clean: stop
	docker container prune -f
	rm -rf $(flags)/*
	rm -rf node_modules/@counterfactual/*
	rm -rf modules/**/node_modules/@counterfactual/*
	rm -rf modules/**/build
	rm -rf modules/**/dist
	rm -rf modules/**/node_modules/**/.git

reset: stop
	docker container prune -f
	docker volume rm `docker volume ls -q -f name=$(project)_database_test_*` 2> /dev/null || true
	docker volume rm $(project)_database_dev 2> /dev/null || true
	docker secret rm $(project)_database_dev 2> /dev/null || true
	docker volume rm $(project)_chain_dev 2> /dev/null || true
	rm -rf $(bot)/.payment-bot-db/*
	rm -rf $(flags)/deployed-contracts

push-latest: prod
	bash ops/push-images.sh latest node proxy relay

push-prod: prod
	bash ops/push-images.sh $(version) node proxy relay

deployed-contracts: contracts
	bash ops/deploy-contracts.sh ganache
	touch $(flags)/$@

dls:
	@docker service ls
	@echo "====="
	@docker container ls -a

########################################
# Begin Test Rules

test: test-node
watch: watch-node

start-test: prod deployed-contracts
	INDRA_ETH_PROVIDER=http://localhost:8545 INDRA_MODE=test bash ops/start-prod.sh

test-ui: payment-bot
	bash ops/test-ui.sh

watch-ui: node-modules
	bash ops/test-ui.sh watch

test-bot: payment-bot
	bash ops/test-bot.sh

test-bot-farm:
	bash ops/test-bot-farm.sh

test-contracts: contracts
	bash ops/test-contracts.sh

test-node: node
	bash ops/test-node.sh --runInBand --forceExit

watch-node: node-modules
	bash ops/test-node.sh --watch

########################################
# Begin Real Rules

builder: ops/builder.dockerfile
	$(log_start)
	docker build --file ops/builder.dockerfile --tag $(project)_builder:latest .
	$(log_finish) && touch $(flags)/$@

client: contracts types messaging proxy-lock $(shell find $(client)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/client && npm run build"
	$(log_finish) && touch $(flags)/$@

contracts: node-modules $(shell find $(contracts)/contracts $(find_options))
	$(log_start)
	$(docker_run) "cd modules/contracts && npm run build"
	$(log_finish) && touch $(flags)/$@

daicard-prod: node-modules client $(shell find $(daicard)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/daicard && npm run build"
	$(log_finish) && touch $(flags)/$@

messaging: node-modules $(shell find $(messaging)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/messaging && npm run build"
	$(log_finish) && touch $(flags)/$@

node: contracts types messaging redis-lock $(shell find $(node)/src $(node)/migrations $(find_options))
	$(log_start)
	$(docker_run) "cd modules/node && npm run build"
	$(log_finish) && touch $(flags)/$@

node-modules: builder package.json $(shell ls modules/**/package.json)
	$(log_start)
	$(docker_run) "lerna bootstrap --hoist"
	$(log_finish) && touch $(flags)/$@

node-prod: node $(node)/ops/prod.dockerfile $(node)/ops/entry.sh
	$(log_start)
	docker build --file $(node)/ops/prod.dockerfile --tag $(project)_node:latest .
	$(log_finish) && touch $(flags)/$@

payment-bot: node-modules client types $(shell find $(bot)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/payment-bot && npm run build"
	$(log_finish) && touch $(flags)/$@

proxy: $(shell find $(proxy) $(find_options))
	$(log_start)
	docker build --file $(proxy)/dev.dockerfile --tag $(project)_proxy:dev .
	$(log_finish) && touch $(flags)/$@

proxy-prod: daicard-prod $(shell find $(proxy) $(find_options))
	$(log_start)
	docker build --file $(proxy)/prod.dockerfile --tag $(project)_proxy:latest .
	$(log_finish) && touch $(flags)/$@

redis-lock: node-modules $(shell find $(redis-lock)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/redis-lock && npm run build"
	$(log_finish) && touch $(flags)/$@

proxy-lock: node-modules $(shell find $(proxy-lock)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/proxy-lock && npm run build"
	$(log_finish) && touch $(flags)/$@

types: node-modules messaging $(shell find $(types)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/types && npm run build"
	$(log_finish) && touch $(flags)/$@

ws-tcp-relay: ops/ws-tcp-relay.dockerfile
	$(log_start)
	docker build --file ops/ws-tcp-relay.dockerfile --tag $(project)_relay:latest .
	$(log_finish) && touch $(flags)/$@
