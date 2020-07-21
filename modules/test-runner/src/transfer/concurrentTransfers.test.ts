import PQueue from "p-queue";
import { BigNumber, constants, utils } from "ethers";
import {
  ConditionalTransferTypes,
  IConnextClient,
  PublicParams,
  Address,
  GraphReceipt,
} from "@connext/types";
import {
  delay,
  ColorfulLogger,
  getTestVerifyingContract,
  getTestGraphReceiptToSign,
} from "@connext/utils";

import { createClient, env, fundChannel } from "../util";

const { AddressZero } = constants;
const { hexlify, randomBytes, parseEther } = utils;

const generatePaymentId = () => hexlify(randomBytes(32));

const TRANSFER_AMOUNT = parseEther("0.00001");
const DEPOSIT_AMOUNT = parseEther("0.1");

const log = new ColorfulLogger("ConcurrentTransfersTest", env.logLevel, true);

describe("Concurrent transfers", async () => {
  let channel: IConnextClient;
  let indexerA: IConnextClient;
  let indexerB: IConnextClient;
  let chainId: number;
  let verifyingContract: Address;
  let receipt: GraphReceipt;
  let subgraphChannels: { signer: string; publicIdentifier: string }[];

  beforeEach(async () => {
    // let wallet = Wallet.fromMnemonic(
    //   "favorite plunge fatigue crucial decorate bottom hour veteran embark gravity devote business",
    // );
    // privateKey = wallet.privateKey;

    channel = await createClient({
      // signer: privateKey,
      loggerService: new ColorfulLogger("Client", 1, true, "Gateway"),
    });
    indexerA = await createClient();
    indexerB = await createClient();

    chainId = (await indexerA.ethProvider.getNetwork()).chainId;
    verifyingContract = getTestVerifyingContract();
    receipt = getTestGraphReceiptToSign();

    log.info("Deposit into state channel");
    await fundChannel(channel, DEPOSIT_AMOUNT, AddressZero);
    const balance: BigNumber = (await channel.getFreeBalance())[channel.signerAddress];
    log.info(`Free balance: ${balance.toString()}`);
    log.info(`Total # of payments possible: ${balance.div(parseEther(`0.00001`))}`);

    subgraphChannels = [
      {
        signer: indexerA.signerAddress,
        publicIdentifier: indexerA.publicIdentifier,
      },
      {
        signer: indexerB.signerAddress,
        publicIdentifier: indexerB.publicIdentifier,
      },
    ];
  });

  it.skip("Can handle many concurrent transfers", async function () {
    this.timeout(0); // disable timeout
    let count = 0;
    indexerA.on("CONDITIONAL_TRANSFER_CREATED_EVENT", (data) => {
      count++;
      log.info(`${data.paymentId} Payment created: ${count}`);
    });
    indexerB.on("CONDITIONAL_TRANSFER_CREATED_EVENT", (data) => {
      count++;
      log.info(`${data.paymentId} Payment created: ${count}`);
    });
    const queue = new PQueue({ concurrency: 10 });
    const sendLoop = async () => {
      while (true) {
        for (const subgraphChannel of subgraphChannels) {
          const recipient = subgraphChannel.publicIdentifier;
          const paymentId = generatePaymentId();

          // Send payment and query
          // eslint-disable-next-line no-loop-func
          queue.add(async () => {
            log.info(`Send payment: ${paymentId}`);
            try {
              await channel.conditionalTransfer({
                paymentId,
                amount: TRANSFER_AMOUNT,
                conditionType: ConditionalTransferTypes.SignedTransfer,
                signerAddress: subgraphChannel.signer,
                chainId,
                verifyingContract,
                requestCID: receipt.requestCID,
                subgraphDeploymentID: receipt.subgraphDeploymentID,
                recipient,
                assetId: AddressZero,
                meta: { info: "Query payment" },
              } as PublicParams.SignedTransfer);
            } catch (e) {
              console.error(`Failed to send payment: ${e}`);
            }
            log.info(`${paymentId} Payment sent`);
          });
        }
        await delay(100);
      }
    };

    sendLoop();

    await queue.onIdle();
  });
});
