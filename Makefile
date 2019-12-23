project=indra
registry=connextproject

# Specify make-specific variables (VPATH = prerequisite search path)
flags=.makeflags
VPATH=$(flags)
SHELL=/bin/bash

find_options=-type f -not -path "*/node_modules/*" -not -name "*.swp" -not -path "*/.*" -not -name "*.log"

version=$(shell cat package.json | grep '"version":' | awk -F '"' '{print $$4}')
commit=$(shell git rev-parse HEAD | head -c 8)
solc_version=$(shell cat package.json | grep '"solc"' | awk -F '"' '{print $$4}')

# Pool of images to pull cached layers from during docker build steps
cache_from=$(shell if [[ -n "${GITHUB_WORKFLOW}" ]]; then echo "--cache-from=$(project)_database:$(commit),$(project)_database:latest,$(project)_ethprovider:$(commit),$(project)_ethprovider:latest,$(project)_node:$(commit),$(project)_node:latest,$(project)_proxy:$(commit),$(project)_proxy:latest,$(project)_relay:$(commit),$(project)_relay:latest,$(project)_bot:$(commit),$(project)_bot:latest,$(project)_builder:latest"; else echo ""; fi)

prodOrCd=$(shell if [[ -n "${GITHUB_WORKFLOW}" ]]; then echo "cd"; else echo "prod"; fi)

# Get absolute paths to important dirs
cwd=$(shell pwd)
bot=$(cwd)/modules/payment-bot
cf-adjudicator-contracts=$(cwd)/modules/cf-adjudicator-contracts
cf-apps=$(cwd)/modules/cf-apps
cf-core=$(cwd)/modules/cf-core
cf-funding-protocol-contracts=$(cwd)/modules/cf-funding-protocol-contracts
client=$(cwd)/modules/client
contracts=$(cwd)/modules/contracts
daicard=$(cwd)/modules/daicard
dashboard=$(cwd)/modules/dashboard
database=$(cwd)/modules/database
ethprovider=$(cwd)/ops/ethprovider
messaging=$(cwd)/modules/messaging
node=$(cwd)/modules/node
proxy=$(cwd)/modules/proxy
ssh-action=$(cwd)/ops/ssh-action
types=$(cwd)/modules/types

# Setup docker run time
# If on Linux, give the container our uid & gid so we know what to reset permissions to
# On Mac, the docker-VM takes care of this for us so pass root's id (ie noop)
my_id=$(shell id -u):$(shell id -g)
id=$(shell if [[ "`uname`" == "Darwin" ]]; then echo 0:0; else echo $(my_id); fi)
docker_run=docker run --name=$(project)_builder --tty --rm --volume=$(cwd):/root $(project)_builder $(id)

startTime=$(flags)/.startTime
totalTime=$(flags)/.totalTime
log_start=@echo "=============";echo "[Makefile] => Start building $@"; date "+%s" > $(startTime)
log_finish=@echo $$((`date "+%s"` - `cat $(startTime)`)) > $(totalTime); rm $(startTime); echo "[Makefile] => Finished building $@ in `cat $(totalTime)` seconds";echo "=============";echo

# Env setup
$(shell mkdir -p .makeflags $(node)/dist)

########################################
# Begin Phony Rules

default: dev
all: dev prod
dev: database ethprovider node client payment-bot indra-proxy ws-tcp-relay
prod: database node-$(prodOrCd) indra-proxy-prod ws-tcp-relay daicard-proxy

start: start-daicard

start-headless: database ethprovider node client payment-bot
	INDRA_UI=headless bash ops/start-dev.sh

start-daicard: dev
	INDRA_UI=daicard bash ops/start-dev.sh

start-dashboard: dev
	INDRA_UI=dashboard bash ops/start-dev.sh

start-cd:
	INDRA_ETH_PROVIDER=http://localhost:8545 INDRA_MODE=cd bash ops/start-prod.sh

start-staging: deployed-contracts
	INDRA_ETH_PROVIDER=http://localhost:8545 bash ops/start-prod.sh

start-prod: prod
	bash ops/start-prod.sh

stop:
	bash ops/stop.sh

restart-headless: database node client payment-bot
	bash ops/stop.sh
	INDRA_UI=headless bash ops/start-dev.sh

restart-daicard: dev
	bash ops/stop.sh
	INDRA_UI=daicard bash ops/start-dev.sh

restart-dashboard: dev
	bash ops/stop.sh
	INDRA_UI=dashboard bash ops/start-dev.sh

restart: restart-daicard

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

quick-reset:
	bash ops/db.sh 'truncate table app_registry cascade;'
	bash ops/db.sh 'truncate table channel cascade;'
	bash ops/db.sh 'truncate table channel_payment_profiles_payment_profile cascade;'
	bash ops/db.sh 'truncate table linked_transfer cascade;'
	bash ops/db.sh 'truncate table node_records cascade;'
	bash ops/db.sh 'truncate table onchain_transaction cascade;'
	bash ops/db.sh 'truncate table payment_profile cascade;'
	bash ops/db.sh 'truncate table peer_to_peer_transfer cascade;'
	rm -rf $(bot)/.payment-bot-db/*
	touch modules/node/src/main.ts

reset: stop
	docker container prune -f
	docker volume rm `docker volume ls -q -f name=$(project)_database_test_*` 2> /dev/null || true
	docker volume rm $(project)_database_dev 2> /dev/null || true
	docker secret rm $(project)_database_dev 2> /dev/null || true
	docker volume rm $(project)_chain_dev 2> /dev/null || true
	rm -rf $(bot)/.payment-bot-db/*
	rm -rf $(flags)/deployed-contracts

push-commit: prod
	bash ops/push-images.sh commit bot database ethprovider node proxy relay

push-release: prod
	bash ops/push-images.sh release database node proxy relay

pull:
	docker pull $(registry)/$(project)_bot:$(commit) && docker tag $(registry)/$(project)_bot:$(commit) $(project)_bot:$(commit) || true
	docker pull $(registry)/$(project)_database:$(commit) && docker tag $(registry)/$(project)_database:$(commit) $(project)_database:$(commit) || true
	docker pull $(registry)/$(project)_ethprovider:$(commit) && docker tag $(registry)/$(project)_ethprovider:$(commit) $(project)_ethprovider:$(commit) || true
	docker pull $(registry)/$(project)_node:$(commit) && docker tag $(registry)/$(project)_node:$(commit) $(project)_node:$(commit) || true
	docker pull $(registry)/$(project)_proxy:$(commit) && docker tag $(registry)/$(project)_proxy:$(commit) $(project)_proxy:$(commit) || true
	docker pull $(registry)/$(project)_relay:$(commit) && docker tag $(registry)/$(project)_relay:$(commit) $(project)_database:$(commit) || true
	docker pull $(registry)/$(project)_bot:latest && docker tag $(registry)/$(project)_bot:latest $(project)_bot:latest || true
	docker pull $(registry)/$(project)_database:latest && docker tag $(registry)/$(project)_database:latest $(project)_database:latest || true
	docker pull $(registry)/$(project)_ethprovider:latest && docker tag $(registry)/$(project)_ethprovider:latest $(project)_ethprovider:latest || true
	docker pull $(registry)/$(project)_node:latest && docker tag $(registry)/$(project)_node:latest $(project)_node:latest || true
	docker pull $(registry)/$(project)_proxy:latest && docker tag $(registry)/$(project)_proxy:latest $(project)_proxy:latest || true
	docker pull $(registry)/$(project)_relay:latest && docker tag $(registry)/$(project)_relay:latest $(project)_relay:latest || true

deployed-contracts: ethprovider
	bash ops/deploy-contracts.sh ganache
	touch $(flags)/$@

build-report:
	bash ops/build-report.sh

dls:
	@docker service ls
	@echo "====="
	@docker container ls -a

########################################
# Begin Test Rules

test: test-node
watch: watch-node

test-cf: cf-core
	bash ops/test-cf.sh

watch-cf: cf-core
	bash ops/test-cf.sh --watch

test-daicard:
	bash ops/test-ui.sh daicard

# ensure you've run "make start-dashboard" first & not just "make start"
test-dashboard:
	bash ops/test-ui.sh dashboard

# You can interactively select daicard or dashboard tests after running below
watch-ui: node-modules
	bash ops/test-ui.sh --watch

test-bot:
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
	docker build --file ops/builder.dockerfile --build-arg SOLC_VERSION=$(solc_version) $(cache_from) --tag $(project)_builder:latest .
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

cf-adjudicator-contracts: node-modules $(shell find $(cf-adjudicator-contracts)/contracts $(cf-adjudicator-contracts)/waffle.json $(find_options))
	$(log_start)
	$(docker_run) "cd modules/cf-adjudicator-contracts && npm run build"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

cf-apps: node-modules cf-adjudicator-contracts $(shell find $(cf-apps)/contracts $(cf-apps)/waffle.json $(find_options))
	$(log_start)
	$(docker_run) "cd modules/cf-apps && npm run build"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

cf-core: node-modules types cf-adjudicator-contracts cf-apps cf-funding-protocol-contracts $(shell find $(cf-core)/src $(cf-core)/test $(cf-core)/tsconfig.json $(find_options))
	$(log_start)
	$(docker_run) "cd modules/cf-core && npm run build:ts"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

cf-funding-protocol-contracts: node-modules $(shell find $(cf-funding-protocol-contracts)/contracts $(cf-funding-protocol-contracts)/waffle.json $(find_options))
	$(log_start)
	$(docker_run) "cd modules/cf-funding-protocol-contracts && npm run build"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

client: cf-core contracts types messaging $(shell find $(client)/src $(client)/tsconfig.json $(find_options))
	$(log_start)
	$(docker_run) "cd modules/client && npm run build"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

contracts: node-modules $(shell find $(contracts)/contracts $(contracts)/waffle.json $(find_options))
	$(log_start)
	$(docker_run) "cd modules/contracts && npm run build"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

daicard-prod: node-modules client $(shell find $(daicard)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/daicard && npm run build"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

dashboard-prod: node-modules client $(shell find $(dashboard)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/dashboard && npm run build"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

daicard-proxy: $(shell find $(proxy) $(find_options))
	$(log_start)
	docker build --file $(proxy)/daicard.io/prod.dockerfile $(cache_from) --tag daicard_proxy:latest .
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

database: node-modules $(shell find $(database) $(find_options))
	$(log_start)
	docker build --file $(database)/db.dockerfile $(cache_from) --tag $(project)_database:latest $(database)
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

ethprovider: contracts cf-adjudicator-contracts cf-funding-protocol-contracts cf-apps $(shell find $(ethprovider) $(find_options))
	$(log_start)
	docker build --file $(ethprovider)/Dockerfile $(cache_from) --tag $(project)_ethprovider:latest .
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

messaging: node-modules types $(shell find $(messaging)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/messaging && npm run build"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

node: cf-core contracts types messaging $(shell find $(node)/src $(node)/migrations $(find_options))
	$(log_start)
	$(docker_run) "cd modules/node && npm run build"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

node-cd: node $(shell find $(node)/ops $(find_options))
	$(log_start)
	$(docker_run) "cd modules/node && npm run build-bundle"
	docker build --file $(node)/ops/cd.dockerfile $(cache_from) --tag $(project)_node:latest .
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

node-modules: builder package.json $(shell ls modules/**/package.json)
	$(log_start)
	$(docker_run) "lerna bootstrap --hoist"
	$(docker_run) "cd node_modules/eccrypto && npm run install"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

node-prod: node $(node)/ops/prod.dockerfile $(node)/ops/entry.sh
	$(log_start)
	docker build --file $(node)/ops/prod.dockerfile $(cache_from) --tag $(project)_node:latest .
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

payment-bot-js: node-modules client types $(shell find $(bot)/src $(bot)/ops $(find_options))
	$(log_start)
	$(docker_run) "cd modules/payment-bot && npm run build-bundle"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

payment-bot: payment-bot-js $(shell find $(bot)/ops $(find_options))
	$(log_start)
	docker build --file $(bot)/ops/Dockerfile $(cache_from) --tag $(project)_bot:latest .
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

indra-proxy: ws-tcp-relay $(shell find $(proxy) $(find_options))
	$(log_start)
	docker build --file $(proxy)/indra.connext.network/dev.dockerfile $(cache_from) --tag $(project)_proxy:dev .
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

indra-proxy-prod: daicard-prod dashboard-prod ws-tcp-relay $(shell find $(proxy) $(find_options))
	$(log_start)
	docker build --file $(proxy)/indra.connext.network/prod.dockerfile $(cache_from) --tag $(project)_proxy:latest .
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

ssh-action: $(shell find $(ssh-action) $(find_options))
	$(log_start)
	docker build --file $(ssh-action)/Dockerfile --tag $(project)_ssh_action $(ssh-action)
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

types: node-modules $(shell find $(types)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/types && npm run build"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

ws-tcp-relay: ops/ws-tcp-relay.dockerfile
	$(log_start)
	docker build --file ops/ws-tcp-relay.dockerfile $(cache_from) --tag $(project)_relay:latest .
	$(log_finish) && mv -f $(totalTime) $(flags)/$@
