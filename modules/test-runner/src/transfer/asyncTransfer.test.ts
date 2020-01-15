import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";

import { expect } from "../util";
import {
  AssetOptions,
  asyncTransferAsset,
  createClient,
  ETH_AMOUNT_LG,
  ETH_AMOUNT_SM,
} from "../util";

describe("Async Transfers", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let tokenAddress: string;
  let nodeFreeBalanceAddress: string;
  let nodePublicIdentifier: string;

  beforeEach(async () => {
    clientA = await createClient();
    clientB = await createClient();

    tokenAddress = clientA.config.contractAddresses.Token;
    nodePublicIdentifier = clientA.config.nodePublicIdentifier;
    nodeFreeBalanceAddress = xkeyKthAddress(nodePublicIdentifier);
  }, 90_000);

  it("happy case: client A transfers eth to client B through node", async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await clientA.deposit({ amount: transfer.amount.toString(), assetId: transfer.assetId });
    await clientB.requestCollateral(transfer.assetId);

    const { [nodeFreeBalanceAddress]: freeBalanceNodeB } = await clientB.getFreeBalance(
      transfer.assetId,
    );

    await asyncTransferAsset(
      clientA,
      clientB,
      transfer.amount,
      transfer.assetId,
      nodeFreeBalanceAddress,
      { freeBalanceNodeB },
    );
  });

  it("happy case: client A transfers tokens to client B through node", async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_LG, assetId: tokenAddress };
    await clientA.deposit({ amount: transfer.amount.toString(), assetId: transfer.assetId });
    await clientB.requestCollateral(transfer.assetId);

    const { [nodeFreeBalanceAddress]: freeBalanceNodeB } = await clientB.getFreeBalance(
      transfer.assetId,
    );

    await asyncTransferAsset(
      clientA,
      clientB,
      transfer.amount,
      transfer.assetId,
      nodeFreeBalanceAddress,
      { freeBalanceNodeB },
    );
  });
});
