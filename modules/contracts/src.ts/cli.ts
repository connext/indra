#!/usr/bin/env node

import yargs from "yargs";

import { migrateCommand } from "./commands/migrate";
import { fundCommand } from "./commands/fund";
import { snapshotCommand } from "./commands/snapshot";

yargs
  .command(migrateCommand)
  .command(fundCommand)
  .command(snapshotCommand)
  .demandCommand(1, "Choose a command from the above list")
  .help()
  .argv;
