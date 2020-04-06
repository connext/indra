/* global before */
import {
  ConditionalTransferTypes,
  createRandom32ByteHexString,
  EventNames,
  GetHashLockTransferResponse,
  HashLockTransferParameters,
  HashLockTransferStatus,
  IConnextClient,
  ResolveHashLockTransferParameters,
} from "@connext/types";
import { xkeyKthAddress } from "@connext/cf-core";
import { AddressZero } from "ethers/constants";
import { soliditySha256 } from "ethers/utils";
import { providers } from "ethers";

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
      } as HashLockTransferParameters),
      new Promise(res => {
        const subject = `${clientB.publicIdentifier}.channel.${clientB.multisigAddress}.app-instance.*.install`;
        clientB.messaging.subscribe(subject, res);
      }),
    ]);

    const {
      [clientA.freeBalanceAddress]: clientAPostTransferBal,
      [xkeyKthAddress(clientA.nodePublicIdentifier)]: nodePostTransferBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostTransferBal).to.eq(0);
    expect(nodePostTransferBal).to.eq(0);

    await new Promise(async res => {
      clientA.on(EventNames.UNINSTALL_EVENT, async data => {
        const {
          [clientA.freeBalanceAddress]: clientAPostReclaimBal,
          [xkeyKthAddress(clientA.nodePublicIdentifier)]: nodePostReclaimBal,
        } = await clientA.getFreeBalance(transfer.assetId);
        expect(clientAPostReclaimBal).to.eq(0);
        expect(nodePostReclaimBal).to.eq(transfer.amount);
        res();
      });
      await clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage,
      } as ResolveHashLockTransferParameters);
      const { [clientB.freeBalanceAddress]: clientBPostTransferBal } = await clientB.getFreeBalance(
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
      } as HashLockTransferParameters),
      new Promise(res => {
        const subject = `${clientB.publicIdentifier}.channel.${clientB.multisigAddress}.app-instance.*.install`;
        clientB.messaging.subscribe(subject, res);
      }),
    ]);

    const {
      [clientA.freeBalanceAddress]: clientAPostTransferBal,
      [xkeyKthAddress(clientA.nodePublicIdentifier)]: nodePostTransferBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostTransferBal).to.eq(0);
    expect(nodePostTransferBal).to.eq(0);

    await new Promise(async res => {
      clientA.on(EventNames.UNINSTALL_EVENT, async data => {
        const {
          [clientA.freeBalanceAddress]: clientAPostReclaimBal,
          [xkeyKthAddress(clientA.nodePublicIdentifier)]: nodePostReclaimBal,
        } = await clientA.getFreeBalance(transfer.assetId);
        expect(clientAPostReclaimBal).to.eq(0);
        expect(nodePostReclaimBal).to.eq(transfer.amount);
        res();
      });
      await clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage,
      } as ResolveHashLockTransferParameters);
      const { [clientB.freeBalanceAddress]: clientBPostTransferBal } = await clientB.getFreeBalance(
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
      } as HashLockTransferParameters),
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
      senderPublicIdentifier: clientA.publicIdentifier,
      receiverPublicIdentifier: clientB.publicIdentifier,
      status: HashLockTransferStatus.PENDING,
      meta: { foo: "bar" },
    } as GetHashLockTransferResponse);
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
      } as HashLockTransferParameters),
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
      senderPublicIdentifier: clientA.publicIdentifier,
      receiverPublicIdentifier: clientB.publicIdentifier,
      status: HashLockTransferStatus.COMPLETED,
      meta: { foo: "bar" },
    } as GetHashLockTransferResponse);
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
      } as HashLockTransferParameters),
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
      } as ResolveHashLockTransferParameters),
    ).to.eventually.be.rejectedWith(/Hashlock app has not been installed/);
  });

  it("cannot resolve a hashlock if timelock is expired", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = createRandom32ByteHexString();
    const timelock = await provider.getBlockNumber() + 101;

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
      } as HashLockTransferParameters),
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
      } as ResolveHashLockTransferParameters),
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
        [clientA.freeBalanceAddress]: clientAPreBal,
        [clientA.nodeFreeBalanceAddress]: nodeAPreBal,
      } = await clientA.getFreeBalance(transfer.assetId);
      const {
        [clientB.freeBalanceAddress]: clientBPreBal,
        [clientB.nodeFreeBalanceAddress]: nodeBPreBal,
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
      } as HashLockTransferParameters),
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
        } as ResolveHashLockTransferParameters);
      });

      // Stop timer and add to sum
      runTime[i] = Date.now() - start;
      console.log(`Run: ${i}, Runtime: ${runTime[i]}`);
      sum = sum + runTime[i];

      const {
        [clientA.freeBalanceAddress]: clientAPostBal,
        [clientA.nodeFreeBalanceAddress]: nodeAPostBal,
      } = await clientA.getFreeBalance(transfer.assetId);
      const {
        [clientB.freeBalanceAddress]: clientBPostBal,
        [clientB.nodeFreeBalanceAddress]: nodeBPostBal,
      } = await clientB.getFreeBalance(transfer.assetId);
      expect(clientAPostBal).to.eq(clientAPreBal.sub(transfer.amount));
      expect(nodeAPostBal).to.eq(nodeAPreBal.add(transfer.amount));
      expect(nodeBPostBal).to.eq(nodeBPreBal.sub(transfer.amount));
      expect(clientBPostBal).to.eq(clientBPreBal.add(transfer.amount));
    }
    console.log(`Average = ${sum / numberOfRuns} ms`);
  });
});
