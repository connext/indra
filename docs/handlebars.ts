import Handlebars from "handlebars";
import fs from "fs";

// these are the modules for which `bash ops/sync-docs.sh $module` is called by it's Makefile rule
const supportedModules = ["cf-core", "client", "store", "utils"];

const target = process.argv[2];

if (supportedModules.includes(target)) {
  console.log(`Compiling docs for ${target} module`);
} else {
  console.error(`First and only arg must be one of: [${supportedModules}]`);
  process.exit(1);
}

const typedoc = JSON.parse(fs.readFileSync(`./docs/typedoc/${target}.json`, `utf8`));

const source = fs.readFileSync(`./docs/src/reference-templates/${target}.md`, `utf8`);

const result = Handlebars.compile(source)({ ...typedoc, foo: "bar" });

fs.writeFileSync(`docs/src/reference-generated/${target}.md`, result);
