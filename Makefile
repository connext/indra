dir=$(shell cd "$(shell dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )
project=$(shell cat $(dir)/package.json | jq .name | tr -d '"')
registry=connextproject

# Specify make-specific variables (VPATH = prerequisite search path)
flags=.makeflags
VPATH=$(flags)
SHELL=/bin/bash


commit=$(shell git rev-parse HEAD | head -c 8)
release=$(shell cat package.json | grep '"version"' | awk -F '"' '{print $$4}')
solc_version=$(shell cat package.json | grep '"solc"' | awk -F '"' '{print $$4}')
backwards_compatible_version=2.3.20 #$(shell echo $(release) | cut -d '.' -f 1).0.0

# Pool of images to pull cached layers from during docker build steps
cache_from=$(shell if [[ -n "${GITHUB_WORKFLOW}" ]]; then echo "--cache-from=$(project)_database:$(commit),$(project)_database,$(project)_ethprovider:$(commit),$(project)_ethprovider,$(project)_node:$(commit),$(project)_node,$(project)_proxy:$(commit),$(project)_proxy,$(project)_relay:$(commit),$(project)_relay,$(project)_bot:$(commit),$(project)_bot,$(project)_builder"; else echo ""; fi)

# Get absolute paths to important dirs
cwd=$(shell pwd)
bot=$(cwd)/modules/payment-bot
cf-core=$(cwd)/modules/cf-core
client=$(cwd)/modules/client
contracts=$(cwd)/modules/contracts
daicard=$(cwd)/modules/daicard
dashboard=$(cwd)/modules/dashboard
database=$(cwd)/modules/database
messaging=$(cwd)/modules/messaging
node=$(cwd)/modules/node
proxy=$(cwd)/ops/proxy
ssh-action=$(cwd)/ops/ssh-action
tests=$(cwd)/modules/test-runner
types=$(cwd)/modules/types

find_options=-type f -not -path "*/node_modules/*" -not -name "*.swp" -not -path "*/.*" -not -name "*.log"

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
# Alias & Control Shortcuts

default: dev
all: dev staging release
dev: database ethprovider node client payment-bot-staging indra-proxy test-runner-staging ws-tcp-relay
staging: daicard-proxy database ethprovider indra-proxy-prod node-staging payment-bot-staging test-runner-staging ws-tcp-relay
release: daicard-proxy database ethprovider indra-proxy-prod node-release payment-bot-release test-runner-release ws-tcp-relay

start: start-daicard

start-headless: dev
	INDRA_UI=headless bash ops/start-dev.sh

start-daicard: dev
	INDRA_UI=daicard bash ops/start-dev.sh

start-dashboard: dev
	INDRA_UI=dashboard bash ops/start-dev.sh

start-test: start-test-staging
start-test-staging:
	INDRA_ETH_PROVIDER=http://localhost:8545 INDRA_MODE=test-staging bash ops/start-prod.sh

start-test-release:
	INDRA_ETH_PROVIDER=http://localhost:8545 INDRA_MODE=test-release bash ops/start-prod.sh

start-prod: prod
	bash ops/start-prod.sh

stop:
	bash ops/stop.sh

restart-headless: dev
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
	rm -rf node_modules/@connext/*
	rm -rf modules/**/node_modules/@connext/*
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

push-commit:
	bash ops/push-images.sh $(commit)

push-release:
	bash ops/push-images.sh $(release)

pull-latest:
	bash ops/pull-images.sh latest

pull-commit:
	bash ops/pull-images.sh $(commit)

pull-release:
	bash ops/pull-images.sh $(release)

pull-backwards-compatible:
	bash ops/pull-images.sh $(backwards_compatible_version)

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
# Test Runner Shortcuts

test: test-integration
watch: watch-integration

test-backwards-compatibility: pull-backwards-compatible
	bash ops/test/integration.sh $(backwards_compatible_version)

test-bot:
	bash ops/test/bot.sh

test-bot-farm:
	bash ops/test/bot-farm.sh

test-cf: cf-core
	bash ops/test/cf.sh

test-client: builder client
	bash ops/test/client.sh

test-contracts: contracts types
	bash ops/test/contracts.sh

test-daicard:
	bash ops/test/ui.sh daicard

# ensure you've run "make start-dashboard" first & not just "make start"
test-dashboard:
	bash ops/test/ui.sh dashboard

test-integration:
	bash ops/test/integration.sh

test-node: node
	bash ops/test/node.sh --runInBand --forceExit

watch-cf: cf-core
	bash ops/test/cf.sh --watch

watch-integration:
	bash ops/test/integration.sh --watch

# You can interactively select daicard or dashboard tests after running below
watch-ui: node-modules
	bash ops/test/ui.sh --watch

watch-node: node
	bash ops/test/node.sh --watch

########################################
# Docker Images

daicard-proxy: $(shell find $(proxy) $(find_options))
	$(log_start)
	docker build --file $(proxy)/daicard.io/prod.dockerfile $(cache_from) --tag daicard_proxy .
	docker tag daicard_proxy daicard_proxy:$(commit)
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

database: node-modules $(shell find $(database) $(find_options))
	$(log_start)
	docker build --file $(database)/db.dockerfile $(cache_from) --tag $(project)_database $(database)
	docker tag $(project)_database $(project)_database:$(commit)
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

ethprovider: contracts $(shell find $(contracts)/ops $(find_options))
	$(log_start)
	docker build --file $(contracts)/ops/Dockerfile $(cache_from) --tag $(project)_ethprovider .
	docker tag $(project)_ethprovider $(project)_ethprovider:$(commit)
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

node-release: node $(node)/ops/Dockerfile $(node)/ops/entry.sh
	$(log_start)
	docker build --file $(node)/ops/Dockerfile $(cache_from) --tag $(project)_node .
	docker tag $(project)_node $(project)_node:$(commit)
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

node-staging: node $(node)/ops/Dockerfile $(node)/ops/entry.sh
	$(log_start)
	$(docker_run) "cd modules/node && npm run build-bundle"
	docker build --file $(node)/ops/Dockerfile $(cache_from) --tag $(project)_node .
	docker tag $(project)_node $(project)_node:$(commit)
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

payment-bot-release: payment-bot-js $(shell find $(bot)/ops $(find_options))
	$(log_start)
	docker build --file $(bot)/ops/release.dockerfile $(cache_from) --tag $(project)_bot .
	docker tag $(project)_bot $(project)_bot:$(commit)
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

payment-bot-staging: payment-bot-js $(shell find $(bot)/ops $(find_options))
	$(log_start)
	docker build --file $(bot)/ops/staging.dockerfile $(cache_from) --tag $(project)_bot .
	docker tag $(project)_bot $(project)_bot:$(commit)
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

indra-proxy: ws-tcp-relay $(shell find $(proxy) $(find_options))
	$(log_start)
	docker build --file $(proxy)/indra.connext.network/dev.dockerfile $(cache_from) --tag $(project)_proxy .
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

indra-proxy-prod: daicard-prod dashboard-prod ws-tcp-relay $(shell find $(proxy) $(find_options))
	$(log_start)
	docker build --file $(proxy)/indra.connext.network/prod.dockerfile $(cache_from) --tag $(project)_proxy:$(commit) .
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

ssh-action: $(shell find $(ssh-action) $(find_options))
	$(log_start)
	docker build --file $(ssh-action)/Dockerfile --tag $(project)_ssh_action $(ssh-action)
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

test-runner: test-runner-staging
test-runner-release: node-modules $(shell find $(tests)/src $(tests)/ops $(find_options))
	$(log_start)
	$(docker_run) "export MODE=release; cd modules/test-runner && npm run build-bundle"
	docker build --file $(tests)/ops/release.dockerfile $(cache_from) --tag $(project)_test_runner:$(commit) .
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

test-runner-staging: node-modules $(shell find $(tests)/src $(tests)/ops $(find_options))
	$(log_start)
	$(docker_run) "export MODE=staging; cd modules/test-runner && npm run build-bundle"
	docker build --file $(tests)/ops/staging.dockerfile $(cache_from) --tag $(project)_test_runner .
	docker tag $(project)_test_runner $(project)_test_runner:$(commit)
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

ws-tcp-relay: ops/ws-tcp-relay.dockerfile
	$(log_start)
	docker build --file ops/ws-tcp-relay.dockerfile $(cache_from) --tag $(project)_relay .
	docker tag $(project)_relay $(project)_relay:$(commit)
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

########################################
# JS & bundles

client: cf-core contracts types messaging $(shell find $(client)/src $(client)/tsconfig.json $(find_options))
	$(log_start)
	$(docker_run) "cd modules/client && npm run build"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

cf-core: node-modules types contracts $(shell find $(cf-core)/src $(cf-core)/test $(cf-core)/tsconfig.json $(find_options))
	$(log_start)
	$(docker_run) "cd modules/cf-core && npm run build:ts"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

daicard-prod: node-modules client $(shell find $(daicard)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/daicard && npm run build"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

dashboard-prod: node-modules client $(shell find $(dashboard)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/dashboard && npm run build"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

messaging: node-modules types $(shell find $(messaging)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/messaging && npm run build"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

node: cf-core contracts types messaging $(shell find $(node)/src $(node)/migrations $(find_options))
	$(log_start)
	$(docker_run) "cd modules/node && npm run build"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

payment-bot-js: node-modules client types $(shell find $(bot)/src $(bot)/ops $(find_options))
	$(log_start)
	$(docker_run) "cd modules/payment-bot && npm run build-bundle"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

types: node-modules $(shell find $(types)/src $(find_options))
	$(log_start)
	$(docker_run) "cd modules/types && npm run build"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

########################################
# Common Prerequisites

contracts: node-modules $(shell find $(contracts)/contracts $(contracts)/waffle.json $(find_options))
	$(log_start)
	$(docker_run) "cd modules/contracts && npm run build"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

contracts-native: node-modules $(shell find $(contracts)/contracts $(contracts)/waffle.native.json $(find_options))
	$(log_start)
	$(docker_run) "cd modules/contracts && npm run build-native"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

node-modules: builder package.json $(shell ls modules/**/package.json)
	$(log_start)
	$(docker_run) "lerna bootstrap --hoist --no-progress"
	$(docker_run) "cd node_modules/eccrypto && npm run install"
	$(log_finish) && mv -f $(totalTime) $(flags)/$@

builder: ops/builder.dockerfile
	$(log_start)
	docker build --file ops/builder.dockerfile --build-arg SOLC_VERSION=$(solc_version) $(cache_from) --tag $(project)_builder .
	$(log_finish) && mv -f $(totalTime) $(flags)/$@
