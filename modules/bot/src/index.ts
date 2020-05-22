require("yargs")
  .command(require("./agents/bot").default)
  .demandCommand(1, "Choose a command from the above list")
  .help().argv;
