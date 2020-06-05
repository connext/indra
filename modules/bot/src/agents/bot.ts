import { EventNames, EventPayloads, ConditionalTransferTypes, PublicParams } from "@connext/types";
import {
  ColorfulLogger,
  getRandomBytes32,
  getSignerAddressFromPublicIdentifier,
  stringify,
  getTestReceiptToSign,
  getTestVerifyingContract,
  signReceiptMessage,
} from "@connext/utils";
import { utils, constants } from "ethers";
import { Argv } from "yargs";
import intervalPromise from "interval-promise";

import { createClient } from "../helpers/client";
import {
  addAgentIdentifierToIndex,
  getRandomAgentIdentifierFromIndex,
} from "../helpers/agentIndex";

const { AddressZero } = constants;
const { parseEther, formatEther } = utils;

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
    const log = new ColorfulLogger(NAME, 3, true, argv.concurrencyIndex);
    log.info(`Launched bot ${NAME}`);
    const TRANSFER_AMT = parseEther("0.0001");
    const DEPOSIT_AMT = parseEther("0.01"); // Note: max amount in signer address is 1 eth
    const receipt = getTestReceiptToSign();
    const verifyingContract = getTestVerifyingContract();
    const ethUrl = process.env.INDRA_ETH_RPC_URL;
    const nodeUrl = process.env.INDRA_NODE_URL;
    const messagingUrl = process.env.INDRA_NATS_URL;

    const randomInterval = Math.round(argv.interval * 0.75 + Math.random() * (argv.interval * 0.5));
    log.info(`Using random inteval: ${randomInterval}`);

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

    const { chainId } = await client.ethProvider.getNetwork();

    log.info(`Registering address ${client.publicIdentifier}`);
    // Register agent in environment
    await addAgentIdentifierToIndex(client.publicIdentifier);

    // Setup agent logic to respond to other agents' payments
    client.on(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, async (eData) => {
      const eventData = eData as EventPayloads.SignedTransferCreated;
      // ignore transfers from self
      if (eventData.sender === client.publicIdentifier) {
        return;
      }

      log.debug(`Received transfer: ${stringify(eventData)}`);

      if (client.signerAddress !== eventData.transferMeta.signerAddress) {
        log.error(
          `Transfer's specified signer ${eventData.transferMeta.signerAddress} does not match our signer ${client.signerAddress}`,
        );
        return;
      }

      const signature = await signReceiptMessage(
        receipt,
        chainId,
        verifyingContract,
        argv.privateKey,
      );
      log.info(`Unlocking transfer with signature ${signature}`);
      await client.resolveCondition({
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId: eventData.paymentId,
        responseCID: receipt.responseCID,
        signature,
      } as PublicParams.ResolveSignedTransfer);

      log.info(`Unlocked transfer ${eventData.paymentId} for (${eventData.amount} ETH)`);
    });

    let depositLock: boolean;

    // Setup agent logic to transfer on an interval
    intervalPromise(async () => {
      log.debug(`Started interval`);

      // Deposit if agent is out of funds
      const balance = await client.getFreeBalance(AddressZero);
      log.debug(`Bot balance: ${balance[client.signerAddress]}`);
      if (balance[client.signerAddress].lt(TRANSFER_AMT) && !depositLock) {
        // set lock to avoid concurrent deposits on a loop
        depositLock = true;
        log.warn(
          `Balance too low: ${balance[
            client.signerAddress
          ].toString()} < ${TRANSFER_AMT.toString()}, depositing...`,
        );
        try {
          await client.deposit({ amount: DEPOSIT_AMT, assetId: AddressZero });
          log.info(`Finished depositing`);
        } catch (e) {
          throw e;
        } finally {
          depositLock = false;
        }
        const balanceAfterDeposit = await client.getFreeBalance(AddressZero);
        log.info(`Bot balance after deposit: ${balanceAfterDeposit[client.signerAddress]}`);
      }

      // Get random agent from registry and setup params
      const receiverIdentifier = await getRandomAgentIdentifierFromIndex(client.publicIdentifier);

      // If this is the first bot, dont transfer and instead wait for the others to come up
      if (receiverIdentifier) {
        const receiverSigner = getSignerAddressFromPublicIdentifier(receiverIdentifier);
        const paymentId = getRandomBytes32();
        log.debug(
          `Send conditional transfer ${paymentId} for ${formatEther(
            TRANSFER_AMT,
          )} ETH to ${receiverIdentifier} (${receiverSigner})`,
        );

        try {
          // Send transfer
          log.info(`Starting transfer to ${receiverIdentifier} with signer ${receiverSigner}`);
          await client.conditionalTransfer({
            paymentId,
            amount: TRANSFER_AMT,
            conditionType: ConditionalTransferTypes.SignedTransfer,
            signerAddress: receiverSigner,
            chainId,
            verifyingContract,
            requestCID: receipt.requestCID,
            subgraphDeploymentID: receipt.subgraphDeploymentID,
            assetId: AddressZero,
            recipient: receiverIdentifier,
            meta: { info: `Transfer from ${NAME}` },
          });
          log.info(`Conditional transfer ${paymentId} sent`);
        } catch (err) {
          console.error(`Error sending tranfer: ${err.message}`);
        }
      }
      // add slight randomness to interval so that it's somewhere between
      // 75% and 125% of inputted argument
    }, randomInterval);
  },
};
