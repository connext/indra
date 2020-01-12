import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";

import {
  asyncTransferAsset,
  createClient,
  ETH_AMOUNT_LG,
  ETH_AMOUNT_SM,
  verifyPayment,
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

  test("happy case: client A transfers eth to client B through node", async () => {
    const transferAmount = ETH_AMOUNT_SM;
    const assetId = AddressZero;
    await clientA.deposit({ amount: transferAmount.toString(), assetId });
    await clientB.requestCollateral(assetId);

    const paymentId = await asyncTransferAsset(
      clientA,
      clientB,
      transferAmount,
      assetId,
      nodeFreeBalanceAddress,
    );

    await verifyPayment(clientA, clientB, transferAmount, assetId, paymentId);
  });

  test("happy case: client A transfers tokens to client B through node", async () => {
    const transferAmount = ETH_AMOUNT_LG;
    const assetId = tokenAddress;
    await clientA.deposit({ amount: transferAmount.toString(), assetId: tokenAddress });
    await clientB.requestCollateral(tokenAddress);

    const paymentId = await asyncTransferAsset(
      clientA,
      clientB,
      transferAmount,
      assetId,
      nodeFreeBalanceAddress,
    );

    await verifyPayment(clientA, clientB, transferAmount, assetId, paymentId);
  });
});
