import Handlebars from "handlebars";
import fs from "fs";

const modules = ["client", "store"];
const target = process.argv[2];

if (modules.includes(target)) {
  console.log(`Compiling docs for ${target} module`);
} else {
  console.error(`First and only arg must be one of: [${modules}]`);
  process.exit(1);
}

const typedoc = JSON.parse(fs.readFileSync(`./docs/typedoc/${target}.json`, `utf8`));

const source = fs.readFileSync(`./docs/src/templates/${target}.md`, `utf8`);

const result = Handlebars.compile(source)({ ...typedoc, foo: "bar" });

fs.writeFileSync(`docs/src/reference/${target}.md`, result);
