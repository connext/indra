import { ColorfulLogger, getSignerAddressFromPublicIdentifier } from "@connext/utils";
import { constants, utils } from "ethers";
import { Argv } from "yargs";

import { createClient } from "../helpers/client";
import { addAgentIdentifierToIndex, getAgentFromIndex } from "../helpers/agentIndex";
import { Agent } from "./agent";

const { AddressZero } = constants;
const { parseEther } = utils;

export default {
  command: "bench",
  describe: "Start the benchmarker",
  builder: (yargs: Argv) => {
    return yargs
      .option("concurrency-index", {
        description: "Number that identifies this agent when many are running in parallel",
        type: "string",
        default: "1",
      })
      .option("log-level", {
        description: "0 = print no logs, 5 = print all logs",
        type: "number",
        default: 1,
      })
      .option("number-payments", {
        describe: "The number of payments this agent should initiate",
        type: "number",
        default: 200,
      })
      .option("private-key", {
        describe: "Ethereum Private Key",
        type: "string",
      })
      .demandOption(["private-key"]);
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    const NAME = `Bot #${argv.concurrencyIndex}`;
    const log = new ColorfulLogger(NAME, 3, true, argv.concurrencyIndex);
    log.info(`Launched bot ${NAME}`);
    const TRANSFER_AMT = parseEther("0.0001");
    const DEPOSIT_AMT = parseEther("0.01"); // Note: max amount in signer address is 1 eth
    const ethUrl = process.env.INDRA_ETH_RPC_URL;
    const nodeUrl = process.env.INDRA_NODE_URL;
    const messagingUrl = process.env.INDRA_NATS_URL;

    // Create agent client
    const client = await createClient(
      argv.privateKey,
      NAME,
      log,
      nodeUrl!,
      ethUrl!,
      messagingUrl!,
      argv.logLevel,
    );

    const agent = new Agent(log, client, argv.privateKey);
    log.info("Agent starting up.");
    await agent.start();
    log.info("Agent started.");

    log.info(`Registering address ${client.publicIdentifier}`);
    // Register agent in environment
    await addAgentIdentifierToIndex(client.publicIdentifier);

    const balance = await client.getFreeBalance(AddressZero);
    log.debug(`Bot balance: ${balance[client.signerAddress]}`);
    if (balance[client.signerAddress].lt(TRANSFER_AMT)) {
      log.warn(
        `Balance too low: ${balance[
          client.signerAddress
        ].toString()} < ${TRANSFER_AMT.toString()}, depositing...`,
      );
      await agent.deposit(DEPOSIT_AMT);
      log.info(`Finished depositing`);
      const balanceAfterDeposit = await client.getFreeBalance(AddressZero);
      log.info(`Bot balance after deposit: ${balanceAfterDeposit[client.signerAddress]}`);
    }

    const receiverIdentifier = await getAgentFromIndex(0);
    // the first bot should sit and unlock transactions
    if (receiverIdentifier === client.publicIdentifier) {
      return;
    }

    const receiverSigner = getSignerAddressFromPublicIdentifier(receiverIdentifier);

    for (let i = 0; i < argv.numberPayments; i++) {
      const start = Date.now();
      await agent.pay(receiverIdentifier, receiverSigner, TRANSFER_AMT);
      log.info(`Completed end-to-end payment. Elapsed: ${Date.now() - start}`);
    }
  },
};
