/* global before after */
import {
  IConnextClient,
  HashLockTransferParameters,
  ResolveHashLockTransferParameters,
  GetHashLockTransferResponse,
} from "@connext/types";
import { xkeyKthAddress } from "@connext/cf-core";
import { AddressZero } from "ethers/constants";
import { hexlify, randomBytes, soliditySha256 } from "ethers/utils";

import {
  AssetOptions,
  createClient,
  ETH_AMOUNT_SM,
  expect,
  fundChannel,
  TOKEN_AMOUNT,
  env,
} from "../util";
import { providers } from "ethers";

describe("HashLock Transfers", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let tokenAddress: string;
  const provider = new providers.JsonRpcProvider(env.ethProviderUrl);

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
    const preImage = hexlify(randomBytes(32));
    const timelock = ((await provider.getBlockNumber()) + 5000).toString();

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: "HASHLOCK_TRANSFER",
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
      clientA.on("UNINSTALL_EVENT", async data => {
        const {
          [clientA.freeBalanceAddress]: clientAPostReclaimBal,
          [xkeyKthAddress(clientA.nodePublicIdentifier)]: nodePostReclaimBal,
        } = await clientA.getFreeBalance(transfer.assetId);
        expect(clientAPostReclaimBal).to.eq(0);
        expect(nodePostReclaimBal).to.eq(transfer.amount);
        res();
      });
      await clientB.resolveCondition({
        conditionType: "HASHLOCK_TRANSFER",
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
    const preImage = hexlify(randomBytes(32));
    const timelock = ((await provider.getBlockNumber()) + 5000).toString();

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: "HASHLOCK_TRANSFER",
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
      clientA.on("UNINSTALL_EVENT", async data => {
        const {
          [clientA.freeBalanceAddress]: clientAPostReclaimBal,
          [xkeyKthAddress(clientA.nodePublicIdentifier)]: nodePostReclaimBal,
        } = await clientA.getFreeBalance(transfer.assetId);
        expect(clientAPostReclaimBal).to.eq(0);
        expect(nodePostReclaimBal).to.eq(transfer.amount);
        res();
      });
      await clientB.resolveCondition({
        conditionType: "HASHLOCK_TRANSFER",
        preImage,
      } as ResolveHashLockTransferParameters);
      const { [clientB.freeBalanceAddress]: clientBPostTransferBal } = await clientB.getFreeBalance(
        transfer.assetId,
      );
      expect(clientBPostTransferBal).to.eq(transfer.amount);
    });
  });

  it("gets a hashlock transfer by lock hash", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = hexlify(randomBytes(32));
    const timelock = ((await provider.getBlockNumber()) + 5000).toString();

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: "HASHLOCK_TRANSFER",
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
      sender: clientA.publicIdentifier,
      meta: {},
    } as GetHashLockTransferResponse);
  });

  it("cannot resolve a hashlock transfer if pre image is wrong", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = hexlify(randomBytes(32));
    const timelock = ((await provider.getBlockNumber()) + 5000).toString();

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: "HASHLOCK_TRANSFER",
      lockHash,
      timelock,
      assetId: transfer.assetId,
      meta: { foo: "bar" },
    } as HashLockTransferParameters);

    const badPreImage = hexlify(randomBytes(32));
    await expect(
      clientB.resolveCondition({
        conditionType: "HASHLOCK_TRANSFER",
        preImage: badPreImage,
      } as ResolveHashLockTransferParameters),
    ).to.eventually.be.rejectedWith(/No sender app installed for lockHash/);
  });

  it("cannot resolve a hashlock if timelock is expired", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = hexlify(randomBytes(32));
    const timelock = await provider.getBlockNumber();

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: "HASHLOCK_TRANSFER",
      lockHash,
      timelock: timelock.toString(),
      assetId: transfer.assetId,
      meta: { foo: "bar" },
    } as HashLockTransferParameters);
    await expect(
      clientB.resolveCondition({
        conditionType: "HASHLOCK_TRANSFER",
        preImage,
      } as ResolveHashLockTransferParameters),
    ).to.eventually.be.rejectedWith(/invalid BigNumber value/);
  });
});
