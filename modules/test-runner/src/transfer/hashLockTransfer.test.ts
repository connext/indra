/* global before */
import {
  ConditionalTransferTypes,
  EventNames,
  HashLockTransferStatus,
  IConnextClient,
  NodeResponses,
  PublicParams,
  EventPayloads,
} from "@connext/types";
import { createRandom32ByteHexString } from "@connext/utils";
import { providers } from "ethers";
import { AddressZero } from "ethers/constants";
import { soliditySha256, bigNumberify } from "ethers/utils";

import {
  AssetOptions,
  createClient,
  ETH_AMOUNT_SM,
  expect,
  fundChannel,
  TOKEN_AMOUNT,
  env,
  requestCollateral,
} from "../util";

describe("HashLock Transfers", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let tokenAddress: string;
  const provider = new providers.JsonRpcProvider(env.ethProviderUrl);

  before(async () => {
    const currBlock = await provider.getBlockNumber();
    // the node uses a `TIMEOUT_BUFFER` on recipient of 100 blocks
    // so make sure the current block
    const TIMEOUT_BUFFER = 100;
    if (currBlock > TIMEOUT_BUFFER) {
      // no adjustment needed, return
      return;
    }
    for (let index = currBlock; index <= TIMEOUT_BUFFER + 1; index++) {
      await provider.send("evm_mine", []);
    }
  });

  beforeEach(async () => {
    clientA = await createClient({ id: "A" });
    clientB = await createClient({ id: "B" });
    tokenAddress = clientA.config.contractAddresses.Token;
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
    await clientB.messaging.disconnect();
  });

  it("happy case: client A hashlock transfers eth to client B through node", async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = createRandom32ByteHexString();
    const timelock = ((await provider.getBlockNumber()) + 5000).toString();

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    // both sender + receiver apps installed, sender took action
    await Promise.all([
      clientA.conditionalTransfer({
        amount: transfer.amount.toString(),
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        lockHash,
        timelock,
        assetId: transfer.assetId,
        meta: { foo: "bar" },
        recipient: clientB.publicIdentifier,
      } as PublicParams.HashLockTransfer),
      new Promise(res => {
        clientB.on(
          EventNames.CONDITIONAL_TRANSFER_RECEIVED_EVENT,
          (eventPayload: EventPayloads.HashLockTransferReceived) => {
            expect(eventPayload).to.deep.contain({
              amount: transfer.amount,
              assetId: transfer.assetId,
              type: ConditionalTransferTypes.HashLockTransfer,
              paymentId: lockHash,
              recipient: clientB.publicIdentifier,
            } as EventPayloads.HashLockTransferReceived);
            expect(eventPayload.transferMeta).to.deep.eq({
              lockHash,
              timelock: bigNumberify(timelock).sub(100),
            });
            res();
          },
        );
      }),
    ]);

    const {
      [clientA.signerAddress]: clientAPostTransferBal,
      [clientA.nodeSignerAddress]: nodePostTransferBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostTransferBal).to.eq(0);
    expect(nodePostTransferBal).to.eq(0);

    await new Promise(async res => {
      clientA.on(EventNames.UNINSTALL_EVENT, async data => {
        const {
          [clientA.signerAddress]: clientAPostReclaimBal,
          [clientA.nodeSignerAddress]: nodePostReclaimBal,
        } = await clientA.getFreeBalance(transfer.assetId);
        expect(clientAPostReclaimBal).to.eq(0);
        expect(nodePostReclaimBal).to.eq(transfer.amount);
        res();
      });
      await clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage,
      } as PublicParams.ResolveHashLockTransfer);
      const { [clientB.signerAddress]: clientBPostTransferBal } = await clientB.getFreeBalance(
        transfer.assetId,
      );
      expect(clientBPostTransferBal).to.eq(transfer.amount);
    });
  });

  it("happy case: client A hashlock transfers tokens to client B through node", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = createRandom32ByteHexString();
    const timelock = ((await provider.getBlockNumber()) + 5000).toString();

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    // both sender + receiver apps installed, sender took action
    await Promise.all([
      clientA.conditionalTransfer({
        amount: transfer.amount.toString(),
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        lockHash,
        timelock,
        assetId: transfer.assetId,
        meta: { foo: "bar" },
        recipient: clientB.publicIdentifier,
      } as PublicParams.HashLockTransfer),
      new Promise(res => {
        clientB.on(
          EventNames.CONDITIONAL_TRANSFER_RECEIVED_EVENT,
          (eventPayload: EventPayloads.HashLockTransferReceived) => {
            expect(eventPayload).to.deep.contain({
              amount: transfer.amount,
              assetId: transfer.assetId,
              type: ConditionalTransferTypes.HashLockTransfer,
              paymentId: lockHash,
              recipient: clientB.publicIdentifier,
            } as EventPayloads.HashLockTransferReceived);
            expect(eventPayload.transferMeta).to.deep.eq({
              lockHash,
              timelock: bigNumberify(timelock).sub(100),
            });
            res();
          },
        );
      }),
    ]);

    const {
      [clientA.signerAddress]: clientAPostTransferBal,
      [clientA.nodeSignerAddress]: nodePostTransferBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostTransferBal).to.eq(0);
    expect(nodePostTransferBal).to.eq(0);

    await new Promise(async res => {
      clientA.on(EventNames.UNINSTALL_EVENT, async data => {
        const {
          [clientA.signerAddress]: clientAPostReclaimBal,
          [clientA.nodeSignerAddress]: nodePostReclaimBal,
        } = await clientA.getFreeBalance(transfer.assetId);
        expect(clientAPostReclaimBal).to.eq(0);
        expect(nodePostReclaimBal).to.eq(transfer.amount);
        res();
      });
      await clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage,
      } as PublicParams.ResolveHashLockTransfer);
      const { [clientB.signerAddress]: clientBPostTransferBal } = await clientB.getFreeBalance(
        transfer.assetId,
      );
      expect(clientBPostTransferBal).to.eq(transfer.amount);
    });
  });

  it("gets a pending hashlock transfer by lock hash", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = createRandom32ByteHexString();
    const timelock = ((await provider.getBlockNumber()) + 5000).toString();

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    // both sender + receiver apps installed, sender took action
    await Promise.all([
      clientA.conditionalTransfer({
        amount: transfer.amount.toString(),
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        lockHash,
        timelock,
        assetId: transfer.assetId,
        meta: { foo: "bar" },
        recipient: clientB.publicIdentifier,
      } as PublicParams.HashLockTransfer),
      new Promise(res => {
        const subject = `${clientB.publicIdentifier}.channel.${clientB.multisigAddress}.app-instance.*.install`;
        clientB.messaging.subscribe(subject, res);
      }),
    ]);

    const retrievedTransfer = await clientB.getHashLockTransfer(lockHash);
    expect(retrievedTransfer).to.deep.equal({
      amount: transfer.amount.toString(),
      assetId: transfer.assetId,
      lockHash,
      senderIdentifier: clientA.publicIdentifier,
      receiverIdentifier: clientB.publicIdentifier,
      status: HashLockTransferStatus.PENDING,
      meta: { foo: "bar" },
    } as NodeResponses.GetHashLockTransfer);
  });

  it("gets a completed hashlock transfer by lock hash", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = createRandom32ByteHexString();
    const timelock = ((await provider.getBlockNumber()) + 5000).toString();

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    // both sender + receiver apps installed, sender took action
    await Promise.all([
      clientA.conditionalTransfer({
        amount: transfer.amount.toString(),
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        lockHash,
        timelock,
        assetId: transfer.assetId,
        meta: { foo: "bar" },
        recipient: clientB.publicIdentifier,
      } as PublicParams.HashLockTransfer),
      new Promise(res => {
        clientA.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, res);
      }),
    ]);

    // wait for transfer to be picked up by receiver
    await new Promise(async (resolve, reject) => {
      clientB.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, resolve);
      clientB.once(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, reject);
      await clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage,
      });
    });
    const retrievedTransfer = await clientB.getHashLockTransfer(lockHash);
    expect(retrievedTransfer).to.deep.equal({
      amount: transfer.amount.toString(),
      assetId: transfer.assetId,
      lockHash,
      senderIdentifier: clientA.publicIdentifier,
      receiverIdentifier: clientB.publicIdentifier,
      status: HashLockTransferStatus.COMPLETED,
      meta: { foo: "bar" },
    } as NodeResponses.GetHashLockTransfer);
  });

  it("cannot resolve a hashlock transfer if pre image is wrong", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = createRandom32ByteHexString();
    const timelock = ((await provider.getBlockNumber()) + 5000).toString();

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    await Promise.all([
      clientA.conditionalTransfer({
        amount: transfer.amount.toString(),
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        lockHash,
        timelock,
        assetId: transfer.assetId,
        meta: { foo: "bar" },
        recipient: clientB.publicIdentifier,
      } as PublicParams.HashLockTransfer),
      new Promise(res => {
        const subject = `${clientB.publicIdentifier}.channel.${clientB.multisigAddress}.app-instance.*.install`;
        clientB.messaging.subscribe(subject, res);
      }),
    ]);

    const badPreImage = createRandom32ByteHexString();
    await expect(
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage: badPreImage,
      } as PublicParams.ResolveHashLockTransfer),
    ).to.eventually.be.rejectedWith(/Hashlock app has not been installed/);
  });

  it("cannot resolve a hashlock if timelock is expired", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = createRandom32ByteHexString();
    const timelock = (await provider.getBlockNumber()) + 101;

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    await Promise.all([
      clientA.conditionalTransfer({
        amount: transfer.amount.toString(),
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        lockHash,
        timelock,
        assetId: transfer.assetId,
        meta: { foo: "bar" },
        recipient: clientB.publicIdentifier,
      } as PublicParams.HashLockTransfer),
      new Promise(res => {
        const subject = `${clientB.publicIdentifier}.channel.${clientB.multisigAddress}.app-instance.*.install`;
        clientB.messaging.subscribe(subject, res);
      }),
    ]);

    await new Promise(resolve => provider.once("block", resolve));

    await expect(
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage,
      } as PublicParams.ResolveHashLockTransfer),
    ).to.be.rejectedWith(/Cannot take action if timelock is expired/);
  });

  it("Experimental: Average latency of 5 signed transfers with Eth", async () => {
    let runTime: number[] = [];
    let sum = 0;
    const numberOfRuns = 5;
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount.mul(25), transfer.assetId);
    await requestCollateral(clientB, transfer.assetId);

    for (let i = 0; i < numberOfRuns; i++) {
      const {
        [clientA.signerAddress]: clientAPreBal,
        [clientA.nodeSignerAddress]: nodeAPreBal,
      } = await clientA.getFreeBalance(transfer.assetId);
      const {
        [clientB.signerAddress]: clientBPreBal,
        [clientB.nodeSignerAddress]: nodeBPreBal,
      } = await clientB.getFreeBalance(transfer.assetId);

      const preImage = createRandom32ByteHexString();
      const timelock = ((await provider.getBlockNumber()) + 5000).toString();
      const lockHash = soliditySha256(["bytes32"], [preImage]);

      // Start timer
      const start = Date.now();

      // both sender + receiver apps installed, sender took action
      await Promise.all([
        clientA.conditionalTransfer({
          amount: transfer.amount.toString(),
          conditionType: ConditionalTransferTypes.HashLockTransfer,
          lockHash,
          timelock,
          assetId: transfer.assetId,
          meta: { foo: "bar" },
          recipient: clientB.publicIdentifier,
        } as PublicParams.HashLockTransfer),
        // eslint-disable-next-line no-loop-func
        new Promise(res => {
          const subject = `${clientB.publicIdentifier}.channel.${clientB.multisigAddress}.app-instance.*.install`;
          clientB.messaging.subscribe(subject, res);
        }),
      ]);

      // eslint-disable-next-line no-loop-func
      await new Promise(async res => {
        clientA.once("UNINSTALL_EVENT", async data => {
          res();
        });
        await clientB.resolveCondition({
          conditionType: ConditionalTransferTypes.HashLockTransfer,
          preImage,
        } as PublicParams.ResolveHashLockTransfer);
      });

      // Stop timer and add to sum
      runTime[i] = Date.now() - start;
      console.log(`Run: ${i}, Runtime: ${runTime[i]}`);
      sum = sum + runTime[i];

      const {
        [clientA.signerAddress]: clientAPostBal,
        [clientA.nodeSignerAddress]: nodeAPostBal,
      } = await clientA.getFreeBalance(transfer.assetId);
      const {
        [clientB.signerAddress]: clientBPostBal,
        [clientB.nodeSignerAddress]: nodeBPostBal,
      } = await clientB.getFreeBalance(transfer.assetId);
      expect(clientAPostBal).to.eq(clientAPreBal.sub(transfer.amount));
      expect(nodeAPostBal).to.eq(nodeAPreBal.add(transfer.amount));
      expect(nodeBPostBal).to.eq(nodeBPreBal.sub(transfer.amount));
      expect(clientBPostBal).to.eq(clientBPreBal.add(transfer.amount));
    }
    console.log(`Average = ${sum / numberOfRuns} ms`);
  });
});
