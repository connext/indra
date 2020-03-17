/* global before after */
import {
  IConnextClient,
  HashLockTransferParameters,
  ResolveHashLockTransferParameters,
} from "@connext/types";
import { xkeyKthAddress } from "@connext/cf-core";
import { AddressZero } from "ethers/constants";
import { hexlify, randomBytes } from "ethers/utils";

import {
  AssetOptions,
  asyncTransferAsset,
  createClient,
  ETH_AMOUNT_SM,
  expect,
  fundChannel,
  TOKEN_AMOUNT,
} from "../util";
import { connectNats, closeNats } from "../util/nats";
import { Client } from "ts-nats";

describe("HashLock Transfers", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let tokenAddress: string;
  let nats: Client;

  before(async () => {
    nats = await connectNats();
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

  after(() => {
    closeNats();
  });

  it("happy case: client A transfers eth to client B through node", async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = hexlify(randomBytes(32));
    const {
      [clientA.freeBalanceAddress]: clientAPreTransferBal,
      [xkeyKthAddress(clientA.nodePublicIdentifier)]: nodePreTransferBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPreTransferBal).to.eq(transfer.amount);
    expect(nodePreTransferBal).to.eq(0);
    await clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: "HASHLOCK_TRANSFER",
      preImage,
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

  it("happy case: client A transfers tokens to client B through node", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    await clientB.requestCollateral(transfer.assetId);
    await asyncTransferAsset(clientA, clientB, transfer.amount, transfer.assetId, nats);
  });
});
