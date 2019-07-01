project=$(shell cat package.json | grep '"name":' | awk -F '"' '{print $$4}' | tr -d '-')
registry=docker.io/connextproject
prod_image=$(registry)/$(project)
cwd=$(shell pwd)
card=$(cwd)
proxy=$(cwd)/ops/proxy
flags=.makeflags
version=$(shell cat package.json | grep '"version":' | egrep -o '[.0-9]+')
find_options=-type f -not -path "node_modules/*" -not -name "*.swp" -not -path "*/.*"
src=$(shell find src $(find_options))
VPATH=build:$(flags)
SHELL=/bin/bash

# Setup docker run time
# If on Linux, give the container our uid & gid so we know what to reset permissions to
# On Mac the docker-VM takes care of this for us so pass root's id (noop)
my_id=$(shell id -u):$(shell id -g)
id=$(shell if [[ "`uname`" == "Darwin" ]]; then echo 0:0; else echo $(my_id); fi)
docker_run=docker run --name=$(project)_builder --tty --rm --volume=$(card):/root $(project)_builder $(id)

install=npm install --prefer-offline --unsafe-perm --silent --no-progress > /dev/null 2>&1
log_start=@echo "============="; echo "[Makefile] => Start building $@"; date "+%s" > .makeflags/timestamp
log_finish=@echo "[Makefile] => Finished building $@ in $$((`date "+%s"` - `cat .makeflags/timestamp`)) seconds"; echo "============="; echo

$(shell mkdir -p build .makeflags)

########################################
# Begin Shortcut Rules
.PHONY: default all dev prod stop clean purge push push-live

default: dev
all: dev prod proxy-test
dev: hooks node-modules proxy
prod: hooks proxy-prod

stop:
	bash ops/stop.sh

start: dev
	bash ops/deploy.dev.sh

start-prod: prod
	bash ops/deploy.prod.sh

restart: dev
	bash ops/stop.sh
	bash ops/deploy.dev.sh

clean: stop
	rm -rf $(flags)/*

deep-clean: clean
	rm -rf build/*

purge: deep-clean
	rm -rf node_modules/*

push: prod
	docker tag daicard:latest $(prod_image):latest
	docker push $(prod_image):latest

push-live: prod
	docker tag daicard:latest $(prod_image):$(version)
	docker push $(prod_image):$(version)

########################################
# Begin Tests

test-prod: proxy-test
	DAICARD_MODE=test DAICARD_MAINNET_HUB_URL="https://172.17.0.1:3001" bash ops/restart.sh prod
	./node_modules/.bin/cypress install > /dev/null
	./node_modules/.bin/cypress run --spec tests/index.js --env publicUrl=https://localhost

test:
	./node_modules/.bin/cypress install > /dev/null
	./node_modules/.bin/cypress run --spec tests/index.js

start-test: node-modules
	./node_modules/.bin/cypress install > /dev/null
	./node_modules/.bin/cypress open

########################################
# Begin Real Rules

proxy-prod: card-prod $(shell find ops/proxy $(find_options))
	$(log_start)
	docker build --file ops/proxy/prod.dockerfile --tag daicard:latest .
	$(log_finish) && touch $(flags)/$@

proxy-test: card-test $(shell find ops/proxy $(find_options))
	$(log_start)
	docker build --file ops/proxy/prod.dockerfile --tag daicard:test .
	$(log_finish) && touch $(flags)/$@

proxy: node-modules $(shell find ops/proxy $(find_options))
	$(log_start)
	docker build --file ops/proxy/dev.dockerfile --tag $(project)_proxy:dev .
	$(log_finish) && touch $(flags)/$@

card-prod: ops/prod.env node-modules $(src)
	$(log_start)
	cp -f ops/prod.env .env
	$(docker_run) "npm run build"
	cp -f ops/dev.env .env
	$(log_finish) && touch $(flags)/$@

card-test: ops/test.env node-modules $(src)
	$(log_start)
	cp -f ops/test.env .env
	$(docker_run) "npm run build"
	cp -f ops/dev.env .env
	$(log_finish) && touch $(flags)/$@

node-modules: builder package.json
	$(log_start)
	$(docker_run) "$(install)"
	$(log_finish) && touch $(flags)/$@

builder:
	$(log_start)
	docker build --file ops/builder.dockerfile --tag $(project)_builder:latest .
	$(log_finish) && touch $(flags)/$@

hooks: ops/pre-push.sh
	$(log_start)
	rm -f .git/hooks/*
	cp ops/pre-push.sh .git/hooks/pre-push
	chmod +x .git/hooks/pre-push
	$(log_finish) && touch build/$@
