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
cf-adjudicator-contracts=$(cwd)/modules/cf-adjudicator-contracts
cf-apps=$(cwd)/modules/cf-apps
cf-funding-protocol-contracts=$(cwd)/modules/cf-funding-protocol-contracts
cf-core=$(cwd)/modules/cf-core
cf-types=$(cwd)/modules/cf-types
client=$(cwd)/modules/client
contracts=$(cwd)/modules/contracts
daicard=$(cwd)/modules/daicard
database=$(cwd)/modules/database
messaging=$(cwd)/modules/messaging
node=$(cwd)/modules/node
proxy=$(cwd)/modules/proxy
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
dev: database node types client payment-bot indra-proxy ws-tcp-relay
prod: database node-prod indra-proxy-prod ws-tcp-relay daicard-proxy

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
	rm -rf node_modules/@walletconnect/*
	rm -rf modules/**/node_modules/@walletconnect/*
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
	bash ops/push-images.sh latest database node proxy relay

push-prod: prod
	bash ops/push-images.sh $(version) database node proxy relay

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

test-cf: cf-core
	bash ops/test-cf.sh

watch-cf: cf-core
	bash ops/test-cf.sh --watch

test-ui: payment-bot
	bash ops/test-ui.sh

watch-ui: node-modules
	bash ops/test-ui.sh --watch

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

cf-adjudicator-contracts: node-modules $(shell find $(cf-adjudicator-contracts)/contracts $(cf-adjudicator-contracts)/waffle.json $(find_options))
	$(log_start)
	$(docker_run) "cd modules/cf-adjudicator-contracts && npm run build"
	$(log_finish) && touch $(flags)/$@

cf-apps: node-modules cf-adjudicator-contracts $(shell find $(cf-apps)/contracts $(cf-apps)/waffle.json $(find_options))
	$(log_start)
	$(docker_run) "cd modules/cf-apps && npm run build"
	$(log_finish) && touch $(flags)/$@

cf-core: node-modules types cf-adjudicator-contracts cf-funding-protocol-contracts $(shell find $(cf-core)/src $(cf-core)/tsconfig.json $(find_options))
	$(log_start)
	$(docker_run) "cd modules/cf-core && npm run build:ts"
	$(log_finish) && touch $(flags)/$@

cf-funding-protocol-contracts: node-modules $(shell find $(cf-funding-protocol-contracts)/contracts $(cf-funding-protocol-contracts)/waffle.json $(find_options))
	$(log_start)
	$(docker_run) "cd modules/cf-funding-protocol-contracts && npm run build"
	$(log_finish) && touch $(flags)/$@

cf-types: node-modules $(shell find $(cf-types)/src $(cf-types)/tsconfig.json $(find_options))
	$(log_start)
	$(docker_run) "cd modules/cf-types && npm run build"
	$(log_finish) && touch $(flags)/$@

client: cf-core contracts types messaging $(shell find $(client)/src $(client)/tsconfig.json $(find_options))
	$(log_start)
	$(docker_run) "cd modules/client && npm run build"
	$(log_finish) && touch $(flags)/$@

contracts: node-modules $(shell find $(contracts)/contracts $(contracts)/waffle.json $(find_options))
	$(log_start)
	$(docker_run) "cd modules/contracts && npm run build"
	$(log_finish) && touch $(flags)/$@

daicard-prod: node-modules client $(shell find $(daicard)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/daicard && npm run build"
	$(log_finish) && touch $(flags)/$@

dashboard-prod: node-modules client $(shell find $(dashboard)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/dashboard && npm run build"
	$(log_finish) && touch $(flags)/$@

daicard-proxy: $(shell find $(proxy) $(find_options))
	$(log_start)
	docker build --file $(proxy)/daicard.io/prod.dockerfile --tag daicard_proxy:latest .
	$(log_finish) && touch $(flags)/$@

database: node-modules $(shell find $(database) $(find_options))
	$(log_start)
	docker build --file $(database)/db.dockerfile --tag $(project)_database:latest $(database)
	$(log_finish) && touch $(flags)/$@

messaging: node-modules types $(shell find $(messaging)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/messaging && npm run build"
	$(log_finish) && touch $(flags)/$@

node: cf-core contracts types messaging $(shell find $(node)/src $(node)/migrations $(find_options))
	$(log_start)
	$(docker_run) "cd modules/node && npm run build"
	$(log_finish) && touch $(flags)/$@

node-modules: builder package.json $(shell ls modules/**/package.json)
	$(log_start)
	$(docker_run) "lerna bootstrap --hoist"
	$(docker_run) "cd node_modules/eccrypto && npm run install"
	$(log_finish) && touch $(flags)/$@

node-prod: node $(node)/ops/prod.dockerfile $(node)/ops/entry.sh
	$(log_start)
	docker build --file $(node)/ops/prod.dockerfile --tag $(project)_node:latest .
	$(log_finish) && touch $(flags)/$@

payment-bot: node-modules client types $(shell find $(bot)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/payment-bot && npm run build"
	$(log_finish) && touch $(flags)/$@

indra-proxy: ws-tcp-relay $(shell find $(proxy) $(find_options))
	$(log_start)
	docker build --file $(proxy)/indra.connext.network/dev.dockerfile --tag $(project)_proxy:dev .
	$(log_finish) && touch $(flags)/$@

indra-proxy-prod: daicard-prod ws-tcp-relay $(shell find $(proxy) $(find_options))
	$(log_start)
	docker build --file $(proxy)/indra.connext.network/prod.dockerfile --tag $(project)_proxy:latest .
	$(log_finish) && touch $(flags)/$@

types: node-modules cf-types $(shell find $(types)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/types && npm run build"
	$(log_finish) && touch $(flags)/$@

ws-tcp-relay: ops/ws-tcp-relay.dockerfile
	$(log_start)
	docker build --file ops/ws-tcp-relay.dockerfile --tag $(project)_relay:latest .
	$(log_finish) && touch $(flags)/$@
