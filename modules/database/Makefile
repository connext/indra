input=$(shell find templates -type f -name "*.ejs.sql")
output=$(subst .ejs,,$(subst templates,build,$(input)))

all: build $(output)

build/%.sql: templates/%.ejs.sql
	node ops/ejs-render.js $< > $@ || rm "$@"

build:
	mkdir build

clean:
	rm -rf build/*
