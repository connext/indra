import PQueue from "p-queue";
import { BigNumber, constants, utils } from "ethers";
import {
  ConditionalTransferTypes,
  IConnextClient,
  PublicParams,
  Address,
  Receipt,
} from "@connext/types";
import {
  delay,
  ColorfulLogger,
  getTestVerifyingContract,
  getTestReceiptToSign,
} from "@connext/utils";

import { createClient, fundChannel } from "../util";

const { AddressZero } = constants;
const { hexlify, randomBytes, parseEther } = utils;

const generatePaymentId = () => hexlify(randomBytes(32));

const TRANSFER_AMOUNT = parseEther("0.00001");
const DEPOSIT_AMOUNT = parseEther("0.1");

describe("Concurrent transfers", async () => {
  let channel: IConnextClient;
  let indexerA: IConnextClient;
  let indexerB: IConnextClient;
  let chainId: number;
  let verifyingContract: Address;
  let receipt: Receipt;
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
    receipt = getTestReceiptToSign();

    console.log("Signer address:", channel.signerAddress);

    console.log("Deposit into state channel");
    await fundChannel(channel, DEPOSIT_AMOUNT, AddressZero);
    const balance: BigNumber = (await channel.getFreeBalance())[channel.signerAddress];
    console.log("Free balance:", balance.toString());
    console.log("Total # of payments possible: ", balance.div(parseEther("0.00001")).toString());

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
      console.log(`${data.paymentId} Payment created: ${count}`);
    });
    indexerB.on("CONDITIONAL_TRANSFER_CREATED_EVENT", (data) => {
      count++;
      console.log(`${data.paymentId} Payment created: ${count}`);
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
            console.log(paymentId, "Send payment");
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
            console.log(`${paymentId} Payment sent`);
          });
        }
        await delay(100);
      }
    };

    sendLoop();

    await queue.onIdle();
  });
});
