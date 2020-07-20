
SHELL=/bin/bash # shell make will use to execute commands
VPATH=.flags # prerequisite search path
$(shell mkdir -p $(VPATH))

########################################
# Run shell commands to fetch info from environment

dir=$(shell cd "$(shell dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )
project=$(shell cat $(dir)/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4)
registry=$(shell cat $(dir)/package.json | grep '"registry":' | head -n 1 | cut -d '"' -f 4)

cwd=$(shell pwd)
commit=$(shell git rev-parse HEAD | head -c 8)
release=$(shell cat package.json | grep '"version"' | head -n 1 | cut -d '"' -f 4)

# version that will be tested against for backwards compatibility checks
backwards_compatible_version=$(shell cat package.json | grep '"backwardsCompatibleWith"' | head -n 1 | cut -d '"' -f 4)

# If Linux, give the container our uid & gid so we know what to reset permissions to. If Mac, the docker-VM takes care of this for us so pass root's id (ie noop)
id=$(shell if [[ "`uname`" == "Darwin" ]]; then echo 0:0; else echo "`id -u`:`id -g`"; fi)
image_cache=$(shell if [[ -n "${GITHUB_WORKFLOW}" ]]; then echo "--cache-from=$(project)_database:$(commit),$(project)_database,$(project)_ethprovider:$(commit),$(project)_ethprovider,$(project)_node:$(commit),$(project)_node,$(project)_proxy:$(commit),$(project)_proxy,$(project)_builder"; else echo ""; fi) # Pool of images to pull cached layers from during docker build steps
interactive=$(shell if [[ -t 0 && -t 2 ]]; then echo "--interactive"; else echo ""; fi)

########################################
# Setup more vars

find_options=-type f -not -path "*/node_modules/*" -not -name "address-book.json" -not -name "*.swp" -not -path "*/.*" -not -path "*/cache/*" -not -path "*/build/*" -not -path "*/dist/*" -not -name "*.log"

docker_run=docker run --name=$(project)_builder $(interactive) --tty --rm --volume=$(cwd):/root $(project)_builder $(id)

startTime=.flags/.startTime
totalTime=.flags/.totalTime
log_start=@echo "=============";echo "[Makefile] => Start building $@"; date "+%s" > $(startTime)
log_finish=@echo $$((`date "+%s"` - `cat $(startTime)`)) > $(totalTime); rm $(startTime); echo "[Makefile] => Finished building $@ in `cat $(totalTime)` seconds";echo "=============";echo

########################################
# Build Shortcuts

default: dev
all: dev staging release
dev: bot database proxy node test-runner
staging: database ethprovider proxy node-staging test-runner-staging webserver bot-staging
release: database ethprovider proxy node-release test-runner-release webserver bot-staging

########################################
# Command & Control Shortcuts

start: dev
	bash ops/start-dev.sh
	bash ops/start-daicard.sh

start-headless: dev
	bash ops/start-dev.sh

start-daicard: dev
	INDRA_UI=daicard bash ops/start-dev.sh

start-testnet: contracts
	INDRA_CHAIN_LOG_LEVEL=1 bash ops/start-testnet.sh

start-test: start-test-staging
start-test-staging:
	INDRA_ETH_PROVIDER=http://localhost:8545 INDRA_MODE=test-staging bash ops/start-prod.sh

start-test-release:
	INDRA_ETH_PROVIDER=http://localhost:8545 INDRA_MODE=test-release bash ops/start-prod.sh

start-prod:
	bash ops/start-prod.sh

start-bot: bot
	bash ops/test/tps.sh 2 1000

start-bot-farm: bot
	bash ops/test/tps.sh 10 1000

stop:
	bash ops/stop.sh

stop-all:
	bash ops/stop.sh all

restart: stop
	bash ops/start-dev.sh
	bash ops/start-daicard.sh

restart-prod: stop
	bash ops/start-prod.sh

clean: stop-all
	docker container prune -f
	rm -rf .flags/*
	rm -rf node_modules/@connext modules/*/node_modules/@connext
	rm -rf node_modules/@walletconnect modules/*/node_modules/@walletconnect
	rm -rf modules/*/node_modules/*/.git
	rm -rf modules/*/node_modules/.bin
	rm -rf modules/contracts/artifacts modules/*/build modules/*/dist docs/build
	rm -rf modules/*/.*cache* modules/*/node_modules/.cache modules/contracts/cache/*.json
	rm -rf modules/*/package-lock.json

quick-reset:
	bash ops/db.sh 'truncate table app_registry cascade;'
	bash ops/db.sh 'truncate table channel cascade;'
	bash ops/db.sh 'truncate table channel_rebalance_profiles_rebalance_profile cascade;'
	bash ops/db.sh 'truncate table node_records cascade;'
	bash ops/db.sh 'truncate table onchain_transaction cascade;'
	bash ops/db.sh 'truncate table rebalance_profile cascade;'
	bash ops/db.sh 'truncate table app_instance cascade;'
	bash ops/redis.sh 'flushall'
	rm -rf modules/*/.connext-store
	touch modules/node/src/main.ts

reset: stop-all
	docker container prune -f
	docker network rm $(project) $(project)_cf_tester $(project)_node_tester $(project)_test_store 2> /dev/null || true
	docker secret rm $(project)_database_dev 2> /dev/null || true
	docker volume rm $(project)_chain_1337 $(project)_chain_1338 $(project)_database_dev  2> /dev/null || true
	docker volume rm `docker volume ls -q -f name=$(project)_database_test_*` 2> /dev/null || true
	rm -rf .chaindata/*
	rm -rf .flags/deployed-contracts

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

build-report:
	bash ops/build-report.sh

lint:
	bash ops/lint.sh

publish-contracts:
	bash ops/npm-publish.sh contracts

publish-packages:
	bash ops/npm-publish.sh

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

test-tps: test-tps-md
test-tps-sm: bot
	bash ops/test/tps.sh 2 0 10
test-tps-md: bot
	bash ops/test/tps.sh 10 0 10
test-tps-lg: bot
	bash ops/test/tps.sh 40 0 10

test-cf: cf-core
	bash ops/test/cf.sh test

test-contracts: contracts utils
	bash ops/test/unit.sh contracts

test-daicard:
	bash ops/test/ui.sh daicard

test-docs: docs
	$(docker_run) "source .pyEnv/bin/activate && cd docs && sphinx-build -b linkcheck -d build/linkcheck . build/html"

test-integration:
	bash ops/test/integration.sh

test-node: node
	bash ops/test/node.sh

test-store: store
	bash ops/test/store.sh

test-utils: utils
	bash ops/test/unit.sh utils

test-watcher: watcher
	bash ops/test/watcher.sh

watch-cf: cf-core
	bash ops/test/cf.sh watch

watch-integration:
	bash ops/test/integration.sh watch

watch-ui: node-modules
	bash ops/test/ui.sh --watch

watch-node: node
	bash ops/test/node.sh watch

########################################
# Begin Real Build Rules

# All rules from here on should only depend on rules that come before it
# ie first no dependencies, last no dependents

########################################
# Common Prerequisites

builder: $(shell find ops/builder)
	$(log_start)
	docker build --file ops/builder/Dockerfile $(image_cache) --tag $(project)_builder ops/builder
	$(log_finish) && mv -f $(totalTime) .flags/$@

node-modules: builder package.json $(shell ls modules/*/package.json)
	$(log_start)
	$(docker_run) "lerna bootstrap --hoist --no-progress"
	$(log_finish) && mv -f $(totalTime) .flags/$@

py-requirements: builder docs/requirements.txt
	$(log_start)
	$(docker_run) "bash ops/py-install.sh"
	$(log_finish) && mv -f $(totalTime) .flags/$@

########################################
# Docs

.PHONY: docs
docs: documentation
documentation: py-requirements $(shell find docs $(find_options))
	$(log_start)
	$(docker_run) "rm -rf docs/build"
	$(docker_run) "source .pyEnv/bin/activate && cd docs && sphinx-build -b html -d build/doctrees ./src build/html"
	$(log_finish) && mv -f $(totalTime) .flags/$@

########################################
# Build JS & bundles

# Keep prerequisites synced w the @connext/* dependencies of each module's package.json

types: node-modules $(shell find modules/types $(find_options))
	$(log_start)
	$(docker_run) "cd modules/types && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

utils: types $(shell find modules/utils $(find_options))
	$(log_start)
	$(docker_run) "cd modules/utils && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

channel-provider: types $(shell find modules/channel-provider $(find_options))
	$(log_start)
	$(docker_run) "cd modules/channel-provider && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

messaging: types utils $(shell find modules/messaging $(find_options))
	$(log_start)
	$(docker_run) "cd modules/messaging && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

contracts: types utils $(shell find modules/contracts $(find_options))
	$(log_start)
	$(docker_run) "cd modules/contracts && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

store: types utils contracts $(shell find modules/store $(find_options))
	$(log_start)
	$(docker_run) "cd modules/store && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

cf-core: types utils store contracts $(shell find modules/cf-core $(find_options))
	$(log_start)
	$(docker_run) "cd modules/cf-core && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

apps: types utils contracts cf-core $(shell find modules/apps $(find_options))
	$(log_start)
	$(docker_run) "cd modules/apps && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

client: types utils channel-provider messaging store contracts cf-core apps $(shell find modules/client $(find_options))
	$(log_start)
	$(docker_run) "cd modules/client && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

bot: types utils channel-provider messaging store contracts cf-core apps client $(shell find modules/bot $(find_options))
	$(log_start)
	$(docker_run) "cd modules/bot && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

node: types utils messaging store contracts cf-core apps client $(shell find modules/node $(find_options))
	$(log_start)
	$(docker_run) "cd modules/node && npm run build && touch src/main.ts"
	$(log_finish) && mv -f $(totalTime) .flags/$@

daicard: types utils store client $(shell find modules/daicard $(find_options))
	$(log_start)
	$(docker_run) "cd modules/daicard && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

test-runner: types utils channel-provider messaging store contracts cf-core apps client $(shell find modules/test-runner $(find_options))
	$(log_start)
	$(docker_run) "cd modules/test-runner && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

watcher: types utils contracts store $(shell find modules/watcher $(find_options))
	$(log_start)
	$(docker_run) "cd modules/watcher && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

########################################
# Build Docker Images

database: $(shell find ops/database $(find_options))
	$(log_start)
	docker build --file ops/database/db.dockerfile $(image_cache) --tag $(project)_database ops/database
	docker tag $(project)_database $(project)_database:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

ethprovider: contracts $(shell find modules/contracts/ops $(find_options))
	$(log_start)
	docker build --file modules/contracts/ops/Dockerfile $(image_cache) --tag $(project)_ethprovider modules/contracts
	docker tag $(project)_ethprovider $(project)_ethprovider:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

node-release: node $(shell find modules/node/ops $(find_options))
	$(log_start)
	$(docker_run) "cd modules/node && MODE=release npm run build-bundle"
	docker build --file modules/node/ops/Dockerfile $(image_cache) --tag $(project)_node modules/node
	docker tag $(project)_node $(project)_node:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

node-staging: node $(shell find modules/node/ops $(find_options))
	$(log_start)
	$(docker_run) "cd modules/node && MODE=staging npm run build-bundle"
	docker build --file modules/node/ops/Dockerfile $(image_cache) --tag $(project)_node modules/node
	docker tag $(project)_node $(project)_node:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

bot-staging: bot $(shell find modules/bot/ops $(find_options))
	$(log_start)
	$(docker_run) "cd modules/bot && MODE=staging npm run build"
	docker build --file modules/bot/ops/Dockerfile $(image_cache) --tag $(project)_bot .
	docker tag $(project)_bot $(project)_bot:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

proxy: $(shell find ops/proxy $(find_options))
	$(log_start)
	docker build --file ops/proxy/indra/Dockerfile $(image_cache) --tag $(project)_proxy ops
	docker tag $(project)_proxy $(project)_proxy:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

proxy-daicard: $(shell find ops/proxy $(find_options))
	$(log_start)
	docker build --file ops/proxy/daicard/Dockerfile $(image_cache) --tag daicard_proxy ops
	docker tag daicard_proxy daicard_proxy:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

ssh-action: $(shell find ops/ssh-action $(find_options))
	$(log_start)
	docker build --file ops/ssh-action/Dockerfile --tag $(project)_ssh_action ops/ssh-action
	$(log_finish) && mv -f $(totalTime) .flags/$@

test-runner-release: test-runner $(shell find modules/test-runner/ops $(find_options))
	$(log_start)
	$(docker_run) "export MODE=release; cd modules/test-runner && npm run build"
	docker build --file modules/test-runner/ops/Dockerfile $(image_cache) --tag $(project)_test_runner:$(commit) .
	$(log_finish) && mv -f $(totalTime) .flags/$@

test-runner-staging: test-runner $(shell find modules/test-runner/ops $(find_options))
	$(log_start)
	$(docker_run) "export MODE=staging; cd modules/test-runner && npm run build"
	docker build --file modules/test-runner/ops/Dockerfile $(image_cache) --tag $(project)_test_runner .
	docker tag $(project)_test_runner $(project)_test_runner:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

webserver: daicard $(shell find ops/webserver $(find_options))
	$(log_start)
	docker build --file ops/webserver/nginx.dockerfile $(image_cache) --tag $(project)_webserver .
	docker tag $(project)_webserver $(project)_webserver:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@
