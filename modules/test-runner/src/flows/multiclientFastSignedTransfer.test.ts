import {
  IConnextClient,
  ReceiveTransferFinishedEventData,
  FastSignedTransferParameters,
  delay,
  CREATE_TRANSFER,
  CreateTransferEventData,
  ResolveFastSignedTransferParameters,
} from "@connext/types";
import {
  bigNumberify,
  hexlify,
  randomBytes,
  solidityKeccak256,
  joinSignature,
  SigningKey,
} from "ethers/utils";
import { before, after } from "mocha";
import { Client } from "ts-nats";

import { env, expect, Logger, createClient, fundChannel, connectNats, closeNats } from "../util";
import { Wallet } from "ethers";
import { One, AddressZero } from "ethers/constants";
import { clientA } from "../benchmarking/flamegraphPrep";

describe("Full Flow: Multi-client transfer", () => {
  let log = new Logger("MultiClientTransfer", env.logLevel);
  let gateway: IConnextClient;
  let indexerA: IConnextClient;
  let indexerB: IConnextClient;
  let clientD: IConnextClient;
  let tokenAddress: string;
  let nats: Client;
  let signerWalletA: Wallet;
  let signerWalletB: Wallet;

  before(async () => {
    nats = await connectNats();
  });

  beforeEach(async () => {
    gateway = await createClient();
    indexerA = await createClient();
    indexerB = await createClient();

    tokenAddress = gateway.config.contractAddresses.Token;

    signerWalletA = Wallet.createRandom();
    signerWalletB = Wallet.createRandom();
  });

  afterEach(async () => {
    await gateway.messaging.disconnect();
    await indexerA.messaging.disconnect();
    await indexerB.messaging.disconnect();
  });

  after(() => {
    closeNats();
  });

  it.skip("Clients fast signed transfer assets between themselves", async function() {
    const startTime = Date.now();
    const DURATION = 90_000;

    let gatewayTransfers = {
      sent: 0,
      received: 0,
    };
    let indexerATransfers = {
      sent: 0,
      received: 0,
    };
    let indexerBTransfers = {
      sent: 0,
      received: 0,
    };

    await new Promise(async done => {
      await fundChannel(gateway, bigNumberify(100));
      await fundChannel(indexerA, bigNumberify(100));

      gateway.on(
        "RECEIVE_TRANSFER_FINISHED_EVENT",
        async (data: ReceiveTransferFinishedEventData) => {
          if (Date.now() - startTime >= DURATION) {
            // sufficient time has elapsed, resolve
            done();
          }
          await new Promise(async res => {
            const newPaymentId = hexlify(randomBytes(32));
            await nats.subscribe(`transfer.fast-signed.${newPaymentId}.reclaimed`, () => {
              console.log(`GATEWAY TRANSFER ${gatewayTransfers.sent} RECLAIMED`);
              res();
            });
            if (data.sender === indexerA.publicIdentifier) {
              await gateway.conditionalTransfer({
                amount: "1",
                conditionType: "FAST_SIGNED_TRANSFER",
                paymentId: newPaymentId,
                recipient: indexerA.publicIdentifier,
                signer: signerWalletA.address,
                assetId: AddressZero,
                maxAllocation: "10",
              } as FastSignedTransferParameters);
              gatewayTransfers.sent += 1;
              console.log(`GATEWAY TRANSFER ${gatewayTransfers.sent} TO INDEXER A`);
            } else if (data.sender === indexerB.publicIdentifier) {
              await gateway.conditionalTransfer({
                amount: "1",
                conditionType: "FAST_SIGNED_TRANSFER",
                paymentId: newPaymentId,
                recipient: indexerB.publicIdentifier,
                signer: signerWalletB.address,
                assetId: AddressZero,
                maxAllocation: "10",
              } as FastSignedTransferParameters);
              gatewayTransfers.sent += 1;
              console.log(`GATEWAY TRANSFER ${gatewayTransfers.sent} TO INDEXER B`);
            }
          });
        },
      );

      gateway.on(
        CREATE_TRANSFER,
        async (eventData: CreateTransferEventData<"FAST_SIGNED_TRANSFER">) => {
          let withdrawerSigningKey: SigningKey;
          let indexer: IConnextClient;
          let indexerTransfers: {
            sent: number;
            received: number;
          };
          if (eventData.transferMeta.signer === signerWalletA.address) {
            withdrawerSigningKey = new SigningKey(signerWalletA.privateKey);
            indexer = indexerA;
            indexerTransfers = indexerATransfers;
          } else if (eventData.transferMeta.signer === signerWalletB.address) {
            withdrawerSigningKey = new SigningKey(signerWalletB.privateKey);
            indexer = indexerB;
            indexerTransfers = indexerBTransfers;
          }
          const data = hexlify(randomBytes(32));
          const digest = solidityKeccak256(["bytes32", "bytes32"], [data, eventData.paymentId]);
          const signature = joinSignature(withdrawerSigningKey!.signDigest(digest));

          await indexer!.resolveCondition({
            conditionType: "FAST_SIGNED_TRANSFER",
            data,
            paymentId: eventData.paymentId,
            signature,
          } as ResolveFastSignedTransferParameters);
          indexerTransfers!.received += 1;
          console.log(
            `${indexer!.publicIdentifier} RESOLVED TRANSFER ${
              indexerTransfers!.received
            } TO GATEWAY`,
          );

          await indexer!.transfer({
            amount: eventData.amount,
            assetId: AddressZero,
            recipient: eventData.sender,
          });
          indexerTransfers!.sent += 1;
          console.log(
            `${indexer!.publicIdentifier} SENT TRANSFER ${indexerTransfers!.received} TO GATEWAY`,
          );
        },
      );

      await new Promise(async res => {
        const newPaymentId = hexlify(randomBytes(32));
        await nats.subscribe(`transfer.fast-signed.${newPaymentId}.reclaimed`, () => {
          res();
        });
        await gateway.conditionalTransfer({
          amount: "1",
          conditionType: "FAST_SIGNED_TRANSFER",
          paymentId: hexlify(randomBytes(32)),
          recipient: indexerA.publicIdentifier,
          signer: signerWalletA.address,
          assetId: AddressZero,
          maxAllocation: "10",
        } as FastSignedTransferParameters);
        gatewayTransfers.sent += 1;
        console.log(`GATEWAY TRANSFER ${gatewayTransfers.sent} TO INDEXER A`);
      });
      await gateway.conditionalTransfer({
        amount: "1",
        conditionType: "FAST_SIGNED_TRANSFER",
        paymentId: hexlify(randomBytes(32)),
        recipient: indexerB.publicIdentifier,
        signer: signerWalletB.address,
        assetId: AddressZero,
        maxAllocation: "10",
      } as FastSignedTransferParameters);
      gatewayTransfers.sent += 1;
      console.log(`GATEWAY TRANSFER ${gatewayTransfers.sent} TO INDEXER B`);
    });
  });
});
