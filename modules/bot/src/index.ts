require("yargs")
  .command(require("./commands/agent").default)
  .demandCommand(1, "Choose a command from the above list")
  .help().argv;
