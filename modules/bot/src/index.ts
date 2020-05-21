require("yargs")
  .command(require("./commands/sender").default)
  .command(require("./commands/receiver").default)
  .demandCommand(1, "Choose a command from the above list")
  .help().argv;
