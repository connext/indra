import { yargs } from "yargs";

import { migrate } from "./migrate";

yargs.command({
  command: "migrate",
  describe: "Migrate contracts to a given Ethereum network",
  builder: (yargs: Argv) => 
}).demandCommand(1, "Choose a command from the above list").help().argv;
