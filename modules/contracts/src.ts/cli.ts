import yargs from "yargs";

import { migrateCommand } from "./migrate";

yargs
  .command(migrateCommand)
  .demandCommand(1, "Choose a command from the above list")
  .help()
  .argv;
