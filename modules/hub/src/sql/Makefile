all: build build/channel-manager.sql build/onchain-transactions.sql build/custodial-payments.sql

build/%.sql: %.ejs.sql
	./ejs-render $< > $@ || rm "$@"

build:
	mkdir build

clean:
	[ -e build ] && rm -r build || true
