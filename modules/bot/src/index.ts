require("yargs")
  .command(require("./agents/bot").default)
  .command(require("./farm").default)
  .command(require("./agents/bench").default)
  .demandCommand(1, "Choose a command from the above list")
  .help().argv;

// This CLI should exit if any unhandled rejections slip through.
process.on("unhandledRejection", () => {
  console.log(`UnhandledPromiseRejection detected. Crashing..`);
  process.exit(1);
});
