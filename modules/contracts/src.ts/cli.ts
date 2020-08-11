import yargs from "yargs";

import { fundCommand } from "./commands/fund";
import { migrateCommand } from "./commands/migrate";
import { newTokenCommand } from "./commands/new-token";
import { snapshotCommand } from "./commands/snapshot";
import { useTokenCommand } from "./commands/use-token";
import { dripCommand } from "./commands/drip";

yargs
  .command(dripCommand)
  .command(fundCommand)
  .command(migrateCommand)
  .command(newTokenCommand)
  .command(snapshotCommand)
  .command(useTokenCommand)
  .demandCommand(1, "Choose a command from the above list")
  .help().argv;
