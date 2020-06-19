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
import { getRandomBytes32, delay } from "@connext/utils";
import { BigNumber, providers, constants, utils } from "ethers";

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

const { AddressZero, HashZero } = constants;
const { soliditySha256 } = utils;

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
    tokenAddress = clientA.config.contractAddresses.Token!;
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
    await clientB.messaging.disconnect();
  });

  it("happy case: client A hashlock transfers eth to client B through node", async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = getRandomBytes32();
    const timelock = (5000).toString();
    const expiry = BigNumber.from(timelock).add(await provider.getBlockNumber());

    const lockHash = soliditySha256(["bytes32"], [preImage]);

    await Promise.all([
      new Promise((res) => {
        clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, (eventPayload) => {
          expect(eventPayload).to.deep.contain({
            amount: transfer.amount,
            assetId: transfer.assetId,
            type: ConditionalTransferTypes.HashLockTransfer,
            paymentId: lockHash,
            recipient: clientB.publicIdentifier,
          } as EventPayloads.HashLockTransferCreated);
          expect(eventPayload.transferMeta).to.deep.eq({
            timelock,
            lockHash,
            expiry: expiry.sub(100),
          });
          return res();
        });
      }),
      // new Promise((reso) => {
      //   clientA.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, (eventPayload) => {
      //     console.log("clientAeventPayload: ", eventPayload);
      //     expect(eventPayload).to.deep.contain({
      //       amount: transfer.amount,
      //       assetId: transfer.assetId,
      //       type: ConditionalTransferTypes.HashLockTransfer,
      //       paymentId: lockHash,
      //       recipient: clientB.publicIdentifier,
      //     } as EventPayloads.HashLockTransferCreated);
      //     expect(eventPayload.transferMeta).to.deep.eq({
      //       timelock,
      //       lockHash,
      //       expiry,
      //     });
      //     console.log("RESOLVING A");
      //     return reso();
      //   });
      // }),
      clientA.conditionalTransfer({
        amount: transfer.amount.toString(),
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        lockHash,
        timelock,
        assetId: transfer.assetId,
        meta: { foo: "bar", sender: clientA.publicIdentifier },
        recipient: clientB.publicIdentifier,
      } as PublicParams.HashLockTransfer),
    ]);

    const {
      [clientA.signerAddress]: clientAPostTransferBal,
      [clientA.nodeSignerAddress]: nodePostTransferBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostTransferBal).to.eq(0);

    await Promise.all([
      new Promise(async (res) => {
        clientA.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, res);
      }),
      new Promise(async (res) => {
        clientB.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, res);
      }),
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage,
        assetId: transfer.assetId,
      } as PublicParams.ResolveHashLockTransfer),
    ]);
    const {
      [clientA.signerAddress]: clientAPostReclaimBal,
      [clientA.nodeSignerAddress]: nodePostReclaimBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostReclaimBal).to.eq(0);
    expect(nodePostReclaimBal).to.eq(nodePostTransferBal.add(transfer.amount));
    const { [clientB.signerAddress]: clientBPostTransferBal } = await clientB.getFreeBalance(
      transfer.assetId,
    );
    expect(clientBPostTransferBal).to.eq(transfer.amount);
  });

  it("happy case: client A hashlock transfers tokens to client B through node", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = getRandomBytes32();
    const timelock = (5000).toString();
    const expiry = BigNumber.from(timelock).add(await provider.getBlockNumber());

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    // both sender + receiver apps installed, sender took action
    await Promise.all([
      clientA.conditionalTransfer({
        amount: transfer.amount.toString(),
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        lockHash,
        timelock,
        assetId: transfer.assetId,
        meta: { foo: "bar", sender: clientA.publicIdentifier },
        recipient: clientB.publicIdentifier,
      } as PublicParams.HashLockTransfer),
      new Promise((res) => {
        clientB.on(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, (eventPayload) => {
          expect(eventPayload).to.deep.contain({
            amount: transfer.amount,
            assetId: transfer.assetId,
            type: ConditionalTransferTypes.HashLockTransfer,
            paymentId: lockHash,
            recipient: clientB.publicIdentifier,
          } as EventPayloads.HashLockTransferCreated);
          expect(eventPayload.transferMeta).to.deep.eq({
            timelock,
            lockHash,
            expiry: expiry.sub(100),
          });
          res();
        });
      }),
    ]);

    const {
      [clientA.signerAddress]: clientAPostTransferBal,
      [clientA.nodeSignerAddress]: nodePostTransferBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostTransferBal).to.eq(0);

    await new Promise(async (res) => {
      clientA.on(EventNames.UNINSTALL_EVENT, async (data) => {
        const {
          [clientA.signerAddress]: clientAPostReclaimBal,
          [clientA.nodeSignerAddress]: nodePostReclaimBal,
        } = await clientA.getFreeBalance(transfer.assetId);
        expect(clientAPostReclaimBal).to.eq(0);
        expect(nodePostReclaimBal).to.eq(nodePostTransferBal.add(transfer.amount));
        res();
      });
      await clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage,
        assetId: transfer.assetId,
      } as PublicParams.ResolveHashLockTransfer);
      const { [clientB.signerAddress]: clientBPostTransferBal } = await clientB.getFreeBalance(
        transfer.assetId,
      );
      expect(clientBPostTransferBal).to.eq(transfer.amount);
    });
  });

  it("gets a pending hashlock transfer by lock hash", async () => {
    const TIMEOUT_BUFFER = 100; // This currently isn't exported by the node so must be hardcoded
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = getRandomBytes32();
    const timelock = (5000).toString();

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    const paymentId = soliditySha256(["address", "bytes32"], [transfer.assetId, lockHash]);
    const expiry = BigNumber.from(await provider.getBlockNumber())
      .add(timelock)
      .sub(TIMEOUT_BUFFER);
    // both sender + receiver apps installed, sender took action
    clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      assetId: transfer.assetId,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
      recipient: clientB.publicIdentifier,
    } as PublicParams.HashLockTransfer);
    await new Promise((res) => clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, res));

    const retrievedTransfer = await clientB.getHashLockTransfer(lockHash, transfer.assetId);
    expect(retrievedTransfer).to.deep.equal({
      amount: transfer.amount.toString(),
      assetId: transfer.assetId,
      lockHash,
      senderIdentifier: clientA.publicIdentifier,
      receiverIdentifier: clientB.publicIdentifier,
      status: HashLockTransferStatus.PENDING,
      meta: { foo: "bar", sender: clientA.publicIdentifier, timelock, paymentId },
      preImage: HashZero,
      expiry,
    } as NodeResponses.GetHashLockTransfer);
  });

  it("gets a completed hashlock transfer by lock hash", async () => {
    const TIMEOUT_BUFFER = 100; // This currently isn't exported by the node so must be hardcoded
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = getRandomBytes32();
    const timelock = (5000).toString();
    const expiry = BigNumber.from(await provider.getBlockNumber())
      .add(timelock)
      .sub(TIMEOUT_BUFFER);

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    const paymentId = soliditySha256(["address", "bytes32"], [transfer.assetId, lockHash]);

    // both sender + receiver apps installed, sender took action
    clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      assetId: transfer.assetId,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
      recipient: clientB.publicIdentifier,
    } as PublicParams.HashLockTransfer);
    await new Promise((res) => clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, res));

    // wait for transfer to be picked up by receiver
    await new Promise(async (resolve, reject) => {
      // Note: MUST wait for uninstall, bc UNLOCKED gets thrown on takeAction
      // at the moment, there's no way to filter the uninstalled app here so
      // we're just gonna resolve and hope for the best
      clientB.on(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, resolve);
      clientB.once(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, reject);
      await clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage,
        assetId: transfer.assetId,
      });
    });

    const retrievedTransfer = await clientB.getHashLockTransfer(lockHash, transfer.assetId);
    expect(retrievedTransfer).to.deep.equal({
      amount: transfer.amount.toString(),
      assetId: transfer.assetId,
      lockHash,
      senderIdentifier: clientA.publicIdentifier,
      receiverIdentifier: clientB.publicIdentifier,
      status: HashLockTransferStatus.COMPLETED,
      preImage,
      expiry,
      meta: { foo: "bar", sender: clientA.publicIdentifier, timelock, paymentId },
    } as NodeResponses.GetHashLockTransfer);
  });

  it("can send two hashlock transfers with different assetIds and the same lock hash", async () => {
    const transferToken: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transferToken.amount, transferToken.assetId);
    const transferEth: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(clientA, transferEth.amount, transferEth.assetId);
    const preImage = getRandomBytes32();
    const timelock = (5000).toString();
    const lockHash = soliditySha256(["bytes32"], [preImage]);

    clientA.conditionalTransfer({
      amount: transferToken.amount.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      assetId: transferToken.assetId,
      meta: { foo: "bar" },
      recipient: clientB.publicIdentifier,
    } as PublicParams.HashLockTransfer);
    await new Promise((res) => clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, res));

    clientA.conditionalTransfer({
      amount: transferEth.amount.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      assetId: transferEth.assetId,
      meta: { foo: "bar" },
      recipient: clientB.publicIdentifier,
    } as PublicParams.HashLockTransfer);
    await new Promise((res) => clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, res));

    await clientB.resolveCondition({
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      preImage,
      assetId: transferToken.assetId,
    } as PublicParams.ResolveHashLockTransfer);

    await clientB.resolveCondition({
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      preImage,
      assetId: transferEth.assetId,
    } as PublicParams.ResolveHashLockTransfer);

    const { [clientB.signerAddress]: freeBalanceToken } = await clientB.getFreeBalance(
      transferToken.assetId,
    );
    const { [clientB.signerAddress]: freeBalanceEth } = await clientB.getFreeBalance(
      transferEth.assetId,
    );

    expect(freeBalanceToken).to.eq(transferToken.amount);
    expect(freeBalanceEth).to.eq(transferEth.amount);
  });

  it("cannot resolve a hashlock transfer if pre image is wrong", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = getRandomBytes32();
    const timelock = (5000).toString();

    const lockHash = soliditySha256(["bytes32"], [preImage]);

    clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      assetId: transfer.assetId,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
      recipient: clientB.publicIdentifier,
    } as PublicParams.HashLockTransfer);
    await new Promise((res) => clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, res));

    const badPreImage = getRandomBytes32();
    await expect(
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage: badPreImage,
        assetId: transfer.assetId,
      } as PublicParams.ResolveHashLockTransfer),
    ).to.eventually.be.rejectedWith(/app has not been installed/);
  });

  // NOTE: if the node tries to collateralize or send a transaction during
  // this test, it will likely pass due to the 1 block margin of error in the
  // timelock variable
  it("cannot resolve a hashlock if timelock is expired", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = getRandomBytes32();
    const timelock = 101;

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    await new Promise((resolve, reject) => {
      clientA.conditionalTransfer({
        amount: transfer.amount.toString(),
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        lockHash,
        timelock,
        assetId: transfer.assetId,
        meta: { foo: "bar", sender: clientA.publicIdentifier },
        recipient: clientB.publicIdentifier,
      } as PublicParams.HashLockTransfer);
      clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, resolve);
      clientA.once(EventNames.REJECT_INSTALL_EVENT, reject);
    });

    await new Promise((resolve) => provider.once("block", resolve));
    await expect(
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage,
        assetId: transfer.assetId,
      } as PublicParams.ResolveHashLockTransfer),
    ).to.be.rejectedWith(/Cannot take action if expiry is expired/);
  });

  it("cannot install receiver app without sender app installed", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };

    const preImage = getRandomBytes32();
    const timelock = (5000).toString();

    const lockHash = soliditySha256(["bytes32"], [preImage]);

    clientA
      .conditionalTransfer({
        amount: transfer.amount.toString(),
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        lockHash,
        timelock,
        assetId: transfer.assetId,
        meta: { foo: "bar", sender: clientA.publicIdentifier },
        recipient: clientB.publicIdentifier,
      } as PublicParams.HashLockTransfer)
      .catch((e) => {
        console.log("Expected this error: ", e.message);
      });

    await expect(
      new Promise((res, rej) => {
        // should not see this event, wait 10 seconds to make sure it doesnt happen
        // TODO: change to rej
        clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, () => {
          rej("Should not get this event!");
        });
        setTimeout(res, 10_000);
      }),
    ).to.be.fulfilled;
  });

  it.skip("Experimental: Average latency of 5 hashlock transfers with Eth", async () => {
    const runTime: number[] = [];
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

      const preImage = getRandomBytes32();
      const timelock = (5000).toString();
      const lockHash = soliditySha256(["bytes32"], [preImage]);

      // Start timer
      const start = Date.now();

      // both sender + receiver apps installed, sender took action
      clientA.conditionalTransfer({
        amount: transfer.amount.toString(),
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        lockHash,
        timelock,
        assetId: transfer.assetId,
        meta: { foo: "bar", sender: clientA.publicIdentifier },
        recipient: clientB.publicIdentifier,
      } as PublicParams.HashLockTransfer);
      await new Promise((res) => clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, res));

      // eslint-disable-next-line no-loop-func
      await new Promise(async (res) => {
        clientA.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, async (data) => {
          res();
        });
        await clientB.resolveCondition({
          conditionType: ConditionalTransferTypes.HashLockTransfer,
          preImage,
          assetId: transfer.assetId,
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
