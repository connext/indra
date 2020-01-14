import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { Wallet } from "ethers";
import { AddressZero } from "ethers/constants";
import { HDNode, hexlify, parseEther, randomBytes } from "ethers/utils";

import {
  asyncTransferAsset,
  createClient,
  ETH_AMOUNT_LG,
  ETH_AMOUNT_SM,
  fundChannel,
  ZERO_ONE,
  ZERO_ZERO_ONE,
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

    await asyncTransferAsset(clientA, clientB, transferAmount, assetId, nodeFreeBalanceAddress);
  });

  test("happy case: client A transfers tokens to client B through node", async () => {
    const transferAmount = ETH_AMOUNT_LG;
    const assetId = tokenAddress;
    await clientA.deposit({ amount: transferAmount.toString(), assetId });
    await clientB.requestCollateral(assetId);

    await asyncTransferAsset(clientA, clientB, transferAmount, assetId, nodeFreeBalanceAddress);
  });

  test("Bot A tries to transfer a negative amount", async () => {
    await fundChannel(clientA, ZERO_ZERO_ONE, tokenAddress);
    // verify collateral
    await clientB.requestCollateral(tokenAddress);

    await expect(
      clientA.transfer({
        amount: ETH_AMOUNT_SM.mul(-1).toString(),
        assetId: tokenAddress,
        recipient: clientB.publicIdentifier,
      }),
    ).rejects.toThrowError("Value -10000000000000000 is negative");
  });

  test("Bot A tries to transfer with an invalid token address", async () => {
    await fundChannel(clientA, ZERO_ZERO_ONE, tokenAddress);

    await expect(
      clientA.transfer({
        amount: ETH_AMOUNT_SM.toString(),
        assetId: "0xabc",
        recipient: clientB.publicIdentifier,
      }),
    ).rejects.toThrowError(
      `Value "0xabc" is not a valid eth address, Value (${ETH_AMOUNT_SM.toString()}) is not less than or equal to 0`,
    );
    // NOTE: will also include a `Value (..) is not less than or equal to 0
    // because it will not be able to fetch the free balance of the assetId
  });

  // TODO: need to add free balance of the asset in question to get to the
  // hub error
  test.skip("Bot A tries to transfer with an unsupported (but not invalid) token address", async () => {
    await fundChannel(clientA, ZERO_ZERO_ONE, tokenAddress);

    await expect(
      clientA.transfer({
        amount: ETH_AMOUNT_SM.toString(),
        assetId: Wallet.createRandom().address,
        recipient: clientB.publicIdentifier,
      }),
    ).rejects.toThrowError(`test`);
  });

  test("Bot A tries to transfer with invalid recipient xpub", async () => {
    await fundChannel(clientA, ZERO_ZERO_ONE, tokenAddress);

    await expect(
      clientA.transfer({
        amount: ETH_AMOUNT_SM.toString(),
        assetId: tokenAddress,
        recipient: `nope`,
      }),
    ).rejects.toThrowError(`Value \"nope\" must start with \"xpub\"`);
  });

  // tslint:disable-next-line: max-line-length
  test("Bot A tries to transfer an amount greater than they have in their free balance", async () => {
    await expect(
      clientA.transfer({
        amount: parseEther(ZERO_ZERO_ONE).toString(),
        assetId: tokenAddress,
        recipient: clientB.publicIdentifier,
      }),
    ).rejects.toThrowError(
      `Value (${parseEther(ZERO_ZERO_ONE).toString()}) is not less than or equal to 0`,
    );
  });

  test("Bot A tries to transfer with a paymentId that is not 32 bytes", async () => {
    await fundChannel(clientA, ZERO_ZERO_ONE, tokenAddress);

    await expect(
      clientA.conditionalTransfer({
        amount: ETH_AMOUNT_SM.toString(),
        assetId: tokenAddress,
        conditionType: "LINKED_TRANSFER_TO_RECIPIENT",
        paymentId: "nope",
        preImage: hexlify(randomBytes(32)),
        recipient: clientB.publicIdentifier,
      }),
    ).rejects.toThrowError(`Value \"nope\" is not a valid hex string`);
  });

  test("Bot A tries to transfer with a preimage that is not 32 bytes", async () => {
    await fundChannel(clientA, ZERO_ZERO_ONE, tokenAddress);

    await expect(
      clientA.conditionalTransfer({
        amount: parseEther(ZERO_ONE).toString(),
        assetId: tokenAddress,
        conditionType: "LINKED_TRANSFER_TO_RECIPIENT",
        paymentId: hexlify(randomBytes(32)),
        preImage: "nope",
        recipient: clientB.publicIdentifier,
      }),
    ).rejects.toThrowError(`Value \"nope\" is not a valid hex string`);
  });

  test("Bot A proposes a transfer to an xpub that doesn’t have a channel", async () => {
    await fundChannel(clientA, ZERO_ZERO_ONE, tokenAddress);

    await expect(
      clientA.transfer({
        amount: parseEther(ZERO_ZERO_ONE).toString(),
        assetId: tokenAddress,
        recipient: HDNode.fromMnemonic(Wallet.createRandom().mnemonic).neuter().extendedKey,
      }),
    ).rejects.toThrowError(`No channel exists for recipientPublicIdentifier`);
  });
});
