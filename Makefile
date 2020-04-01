
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
solc_version=$(shell cat modules/contracts/package.json | grep '"solc"' | awk -F '"' '{print $$4}')

# version that will be tested against for backwards compatibility checks
backwards_compatible_version=$(commit) #$(shell echo $(release) | cut -d '.' -f 1-2).0

# If Linux, give the container our uid & gid so we know what to reset permissions to. If Mac, the docker-VM takes care of this for us so pass root's id (ie noop)
id=$(shell if [[ "`uname`" == "Darwin" ]]; then echo 0:0; else echo "`id -u`:`id -g`"; fi)
image_cache=$(shell if [[ -n "${GITHUB_WORKFLOW}" ]]; then echo "--cache-from=$(project)_database:$(commit),$(project)_database,$(project)_ethprovider:$(commit),$(project)_ethprovider,$(project)_node:$(commit),$(project)_node,$(project)_proxy:$(commit),$(project)_proxy,$(project)_builder"; else echo ""; fi) # Pool of images to pull cached layers from during docker build steps
interactive=$(shell if [[ -t 0 && -t 2 ]]; then echo "--interactive"; else echo ""; fi)

########################################
# Setup more vars

find_options=-type f -not -path "*/node_modules/*" -not -name "address-book.json" -not -name "*.swp" -not -path "*/.*" -not -path "*/build/*" -not -path "*/dist/*" -not -name "*.log"

docker_run=docker run --name=$(project)_builder $(interactive) --tty --rm --volume=$(cwd):/root $(project)_builder $(id)

startTime=.flags/.startTime
totalTime=.flags/.totalTime
log_start=@echo "=============";echo "[Makefile] => Start building $@"; date "+%s" > $(startTime)
log_finish=@echo $$((`date "+%s"` - `cat $(startTime)`)) > $(totalTime); rm $(startTime); echo "[Makefile] => Finished building $@ in `cat $(totalTime)` seconds";echo "=============";echo

########################################
# Alias & Control Shortcuts

default: dev
all: dev staging release
dev: proxy node test-runner
staging: database ethprovider proxy-daicard proxy node-staging test-runner-staging webserver
release: database ethprovider proxy-daicard proxy node-release test-runner-release webserver

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

start-prod:
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
	rm -rf .flags/*
	rm -rf node_modules/@connext modules/**/node_modules/@connext
	rm -rf node_modules/@walletconnect modules/**/node_modules/@walletconnect
	rm -rf modules/**/node_modules/**/.git
	rm -rf modules/**/build modules/**/cache modules/**/dist

quick-reset:
	bash ops/db.sh 'truncate table app_registry cascade;'
	bash ops/db.sh 'truncate table channel cascade;'
	bash ops/db.sh 'truncate table channel_rebalance_profiles_rebalance_profile cascade;'
	bash ops/db.sh 'truncate table node_records cascade;'
	bash ops/db.sh 'truncate table onchain_transaction cascade;'
	bash ops/db.sh 'truncate table rebalance_profile cascade;'
	bash ops/db.sh 'truncate table app_instance cascade;'
	touch modules/node/src/main.ts

reset: stop
	docker container prune -f
	docker volume rm `docker volume ls -q -f name=$(project)_database_test_*` 2> /dev/null || true
	docker volume rm $(project)_database_dev 2> /dev/null || true
	docker secret rm $(project)_database_dev 2> /dev/null || true
	docker volume rm $(project)_chain_dev 2> /dev/null || true
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

deployed-contracts: contracts
	bash ops/deploy-contracts.sh
	touch .flags/$@

build-report:
	bash ops/build-report.sh

lint:
	bash ops/lint.sh

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

test-cf: cf-core
	bash ops/test/cf.sh

test-client: client
	bash ops/test/client.sh

test-contracts: contracts crypto
	bash ops/test/contracts.sh

test-crypto: crypto
	bash ops/test/crypto.sh

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
	bash ops/test/integration.sh watch

# You can interactively select daicard or dashboard tests after running below
watch-ui: node-modules
	bash ops/test/ui.sh --watch

watch-node: node
	bash ops/test/node.sh --watch

########################################
# Build Docker Images

database: $(shell find ops/database $(find_options))
	$(log_start)
	docker build --file ops/database/db.dockerfile $(image_cache) --tag $(project)_database ops/database
	docker tag $(project)_database $(project)_database:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

ethprovider: contracts $(shell find modules/contracts/ops $(find_options))
	$(log_start)
	docker build --file modules/contracts/ops/Dockerfile $(image_cache) --tag $(project)_ethprovider .
	docker tag $(project)_ethprovider $(project)_ethprovider:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

node-release: node $(shell find modules/node/ops $(find_options))
	$(log_start)
	$(docker_run) "MODE=release cd modules/node && npm run build-bundle"
	docker build --file modules/node/ops/Dockerfile $(image_cache) --tag $(project)_node .
	docker tag $(project)_node $(project)_node:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

node-staging: node $(shell find modules/node/ops $(find_options))
	$(log_start)
	$(docker_run) "MODE=staging cd modules/node && npm run build-bundle"
	docker build --file modules/node/ops/Dockerfile $(image_cache) --tag $(project)_node .
	docker tag $(project)_node $(project)_node:$(commit)
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

webserver: daicard dashboard $(shell find ops/webserver $(find_options))
	$(log_start)
	docker build --file ops/webserver/nginx.dockerfile $(image_cache) --tag $(project)_webserver .
	docker tag $(project)_webserver $(project)_webserver:$(commit)
	$(log_finish) && mv -f $(totalTime) .flags/$@

########################################
# Build JS & bundles

# Keep prerequisites synced w the @connext/* dependencies of that module's package.json
# Each rule here should only depend on rules that come after (ie first no dependents, last no dependencies)

test-runner: apps cf-core channel-provider client contracts crypto messaging store types $(shell find modules/test-runner $(find_options))
	$(log_start)
	$(docker_run) "cd modules/test-runner && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

daicard: client store types $(shell find modules/daicard $(find_options))
	$(log_start)
	$(docker_run) "cd modules/daicard && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

client: apps cf-core channel-provider crypto messaging store types $(shell find modules/client $(find_options))
	$(log_start)
	$(docker_run) "cd modules/client && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

node: apps cf-core contracts crypto messaging types $(shell find modules/node $(find_options))
	$(log_start)
	$(docker_run) "cd modules/node && npm run build && touch src/main.ts"
	$(log_finish) && mv -f $(totalTime) .flags/$@

apps: cf-core contracts crypto types $(shell find modules/apps $(find_options))
	$(log_start)
	$(docker_run) "cd modules/apps && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

dashboard: cf-core messaging types $(shell find modules/dashboard $(find_options))
	$(log_start)
	$(docker_run) "cd modules/dashboard && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

cf-core: contracts crypto store types $(shell find modules/cf-core $(find_options))
	$(log_start)
	$(docker_run) "cd modules/cf-core && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

contracts: crypto types $(shell find modules/contracts $(find_options))
	$(log_start)
	$(docker_run) "cd modules/contracts && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

channel-provider: types $(shell find modules/channel-provider $(find_options))
	$(log_start)
	$(docker_run) "cd modules/channel-provider && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

crypto: types $(shell find modules/crypto $(find_options))
	$(log_start)
	$(docker_run) "cd modules/crypto && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

messaging: types $(shell find modules/messaging $(find_options))
	$(log_start)
	$(docker_run) "cd modules/messaging && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

store: types $(shell find modules/store $(find_options))
	$(log_start)
	$(docker_run) "cd modules/store && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

types: node-modules $(shell find modules/types $(find_options))
	$(log_start)
	$(docker_run) "cd modules/types && npm run build"
	$(log_finish) && mv -f $(totalTime) .flags/$@

########################################
# Common Prerequisites

node-modules: builder package.json $(shell ls modules/**/package.json)
	$(log_start)
	$(docker_run) "lerna bootstrap --hoist --no-progress"
	# rm below hack once this PR gets merged: https://github.com/EthWorks/Waffle/pull/205
	$(docker_run) "sed -i 's|{ input }|{ input, maxBuffer: 1024 * 1024 * 4 }|' node_modules/@ethereum-waffle/compiler/dist/cjs/compileNative.js"
	$(log_finish) && mv -f $(totalTime) .flags/$@

builder: ops/builder.dockerfile
	$(log_start)
	docker build --file ops/builder.dockerfile --build-arg SOLC_VERSION=$(solc_version) $(image_cache) --tag $(project)_builder .
	$(log_finish) && mv -f $(totalTime) .flags/$@
