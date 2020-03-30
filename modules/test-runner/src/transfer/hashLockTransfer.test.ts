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
  InstallMessage,
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

  it.only("happy case: client A hashlock transfers eth to client B through node", async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = createRandom32ByteHexString();
    const timelock = ((await provider.getBlockNumber()) + 5000).toString();

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      assetId: transfer.assetId,
      meta: { foo: "bar" },
    } as HashLockTransferParameters);

    const {
      [clientA.freeBalanceAddress]: clientAPostTransferBal,
      [xkeyKthAddress(clientA.nodePublicIdentifier)]: nodePostTransferBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostTransferBal).to.eq(0);
    expect(nodePostTransferBal).to.eq(0);

    // receiver app installed
    await new Promise(async res => {
      clientB.on("INSTALL_EVENT", async (msg: InstallMessage) => {
        const details = await clientB.getAppInstanceDetails(msg.data.params.appInstanceId);
        console.log("details: ", details);
        if (details.appInstance.latestState["lockHash"] === lockHash) {
          res();
        }
      });
    });

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
    await clientA.conditionalTransfer({
      amount: transfer.amount,
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      assetId: transfer.assetId,
      meta: { foo: "bar" },
    } as HashLockTransferParameters);

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
    await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      assetId: transfer.assetId,
      meta: { foo: "bar" },
    } as HashLockTransferParameters);

    const retrievedTransfer = await clientB.getHashLockTransfer(lockHash);
    expect(retrievedTransfer).to.deep.equal({
      amount: transfer.amount.toString(),
      assetId: transfer.assetId,
      lockHash,
      senderPublicIdentifier: clientA.publicIdentifier,
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
    await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      assetId: transfer.assetId,
      meta: { foo: "bar" },
    } as HashLockTransferParameters);
    // disconnect so that it cant be unlocked
    await clientA.messaging.disconnect();

    // wait for transfer to be picked up by receiver
    await new Promise(async (resolve, reject) => {
      clientB.once(EventNames.RECEIVE_TRANSFER_FINISHED_EVENT, resolve);
      clientB.once(EventNames.RECEIVE_TRANSFER_FAILED_EVENT, reject);
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
    await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      assetId: transfer.assetId,
      meta: { foo: "bar" },
    } as HashLockTransferParameters);

    const badPreImage = createRandom32ByteHexString();
    await expect(
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage: badPreImage,
      } as ResolveHashLockTransferParameters),
    ).to.eventually.be.rejectedWith(/No sender app installed for lockHash/);
  });

  it("cannot resolve a hashlock if timelock is expired", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = createRandom32ByteHexString();
    const timelock = await provider.getBlockNumber();

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock: timelock.toString(),
      assetId: transfer.assetId,
      meta: { foo: "bar" },
    } as HashLockTransferParameters);
    await expect(
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage,
      } as ResolveHashLockTransferParameters),
    ).to.be.rejectedWith(/Cannot resolve hash lock transfer with expired timelock/);
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

      await clientA.conditionalTransfer({
        amount: transfer.amount.toString(),
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        lockHash,
        timelock,
        assetId: transfer.assetId,
        meta: { foo: "bar" },
      } as HashLockTransferParameters);

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
