import { EventNames, EventPayloads, ConditionalTransferTypes, PublicParams } from "@connext/types";
import {
  ColorfulLogger,
  getRandomBytes32,
  getSignerAddressFromPublicIdentifier,
  stringify,
} from "@connext/utils";
import { utils } from "ethers";
import { AddressZero } from "ethers/constants";
import { parseEther, hexlify, randomBytes, solidityKeccak256 } from "ethers/utils";
import { Argv } from "yargs";

import { createClient } from "../helpers/client";
import { addAgentAddressToIndex, getRandomAgentAddressFromIndex } from "../helpers/agentIndex";

export default {
  command: "bot",
  describe: "Start the bot",
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
      .option("interval", {
        describe: "The time interval between consecutive payments from this agent (in ms)",
        type: "number",
        default: 1000,
      })
      .option("private-key", {
        describe: "Ethereum Private Key",
        type: "string",
      })
      .demandOption(["private-key"]);
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    const NAME = `Bot #${argv.concurrencyIndex}`;
    const TRANSFER_AMT = parseEther("0.001");
    const DEPOSIT_AMT = parseEther("0.01");
    const ethUrl = process.env.INDRA_ETH_RPC_URL;
    const nodeUrl = process.env.INDRA_NODE_URL;
    const messagingUrl = process.env.INDRA_NATS_URL;

    const log = new ColorfulLogger(NAME, 3, true, argv.concurrencyIndex);

    // Create agent client
    const client = await createClient(
      argv.privateKey,
      NAME,
      log,
      DEPOSIT_AMT,
      nodeUrl!,
      ethUrl!,
      messagingUrl!,
      argv.logLevel,
    );

    // Register agent in environment
    await addAgentAddressToIndex(client.publicIdentifier);

    // Setup agent logic to respond to other agents' payments
    client.on(
      EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT,
      async (eventData: EventPayloads.SignedTransferCreated) => {
        // ignore transfers from self
        if (eventData.sender === client.publicIdentifier) {
          return;
        }

        log.info(`Received transfer: ${stringify(eventData)}`);

        if (client.signerAddress !== eventData.transferMeta.signer) {
          log.error(
            `Transfer's specified signer ${eventData.transferMeta.signer} does not match our signer ${client.signerAddress}`,
          );
          return;
        }

        const mockAttestation = hexlify(randomBytes(32));
        const attestationHash = solidityKeccak256(
          ["bytes32", "bytes32"],
          [mockAttestation, eventData.paymentId],
        );
        const signature = await client.channelProvider.signMessage(attestationHash);
        await client.resolveCondition({
          conditionType: ConditionalTransferTypes.SignedTransfer,
          paymentId: eventData.paymentId,
          data: mockAttestation,
          signature,
        } as PublicParams.ResolveSignedTransfer);

        log.info(`Unlocked transfer ${eventData.paymentId} for (${eventData.amount} ETH)`);
      },
    );

    // Deposit if agent is out of funds
    const balance = await client.getFreeBalance(AddressZero);
    if (balance[client.signerAddress].lt(TRANSFER_AMT)) {
      log.info(`Balance too low, depositing...`);
      await client.deposit({ amount: DEPOSIT_AMT, assetId: AddressZero });
      log.info(`Finished depositing`);
    }

    // Setup agent logic to transfer on an interval
    setInterval(async () => {
      log.debug(`Started interval`);
      // Get random agent from registry and setup params
      const receiverIdentifier = await getRandomAgentAddressFromIndex();
      log.debug(`receiverIdentifier: ${receiverIdentifier}`);

      // If this is the first bot, dont transfer and instead wait for the others to come up
      if (!receiverIdentifier) {
        log.debug(`No receiver identifier received`);
        return;
      }
      const receiverSigner = getSignerAddressFromPublicIdentifier(receiverIdentifier);
      const paymentId = getRandomBytes32();
      log.info(
        `Send conditional transfer ${paymentId} for ${utils.formatEther(
          TRANSFER_AMT,
        )} ETH to ${receiverIdentifier} (${receiverSigner})`,
      );

      try {
        // Send transfer
        await client.conditionalTransfer({
          paymentId,
          amount: TRANSFER_AMT,
          conditionType: ConditionalTransferTypes.SignedTransfer,
          signer: receiverSigner,
          assetId: AddressZero,
          recipient: receiverIdentifier,
          meta: { info: "Bootstrap payment" },
        });
        log.info(`Conditional transfer ${paymentId} sent`);
      } catch (err) {
        console.error(`Error sending tranfer: ${err.message}`);
      }
    }, argv.interval);
  },
};
