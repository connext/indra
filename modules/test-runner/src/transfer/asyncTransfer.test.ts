import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { ContractFactory, Wallet } from "ethers";
import { AddressZero } from "ethers/constants";
import { HDNode, hexlify, randomBytes } from "ethers/utils";
const tokenArtifacts = require("openzeppelin-solidity/build/contracts/ERC20Mintable.json");
import {
  asyncTransferAsset,
  createClient,
  ETH_AMOUNT_LG,
  ETH_AMOUNT_MD,
  ETH_AMOUNT_SM,
  ethProvider,
  expect,
  fundChannel,
  FUNDED_MNEMONICS,
  TOKEN_AMOUNT,
} from "../util";

describe.only("Async Transfers", () => {
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
    await fundChannel(clientA, ETH_AMOUNT_MD, AddressZero);
    await clientB.requestCollateral(AddressZero);
    // NOTE: will fail if not collateralized by transfer amount exactly
    // when pretransfer balances are not supplied.
    await asyncTransferAsset(clientA, clientB, ETH_AMOUNT_MD, AddressZero, nodeFreeBalanceAddress);
  });

  it("happy case: client A transfers tokens to client B through node", async () => {
    await fundChannel(clientA, TOKEN_AMOUNT, tokenAddress);
    await clientB.requestCollateral(tokenAddress);

    // NOTE: will fail if not collateralized by transfer amount exactly
    // when pretransfer balances are not supplied.
    await asyncTransferAsset(clientA, clientB, TOKEN_AMOUNT, tokenAddress, nodeFreeBalanceAddress);
  });

  it("Bot A tries to transfer a negative amount", async () => {
    await fundChannel(clientA, ETH_AMOUNT_MD, tokenAddress);
    // verify collateral
    await clientB.requestCollateral(tokenAddress);

    await expect(
      clientA.transfer({
        amount: ETH_AMOUNT_SM.mul(-1).toString(),
        assetId: tokenAddress,
        recipient: clientB.publicIdentifier,
      }),
    ).to.be.rejectedWith("Value -10000000000000000 is negative");
  });

  it("Bot A tries to transfer with an invalid token address", async () => {
    await fundChannel(clientA, ETH_AMOUNT_SM, tokenAddress);

    await expect(
      clientA.transfer({
        amount: ETH_AMOUNT_SM.toString(),
        assetId: "0xabc",
        recipient: clientB.publicIdentifier,
      }),
    ).to.be.rejectedWith(
      `Value "0xabc" is not a valid eth address, Value (${ETH_AMOUNT_SM.toString()}) is not less than or equal to 0`,
    );
    // NOTE: will also include a `Value (..) is not less than or equal to 0
    // because it will not be able to fetch the free balance of the assetId
  });

  it("Bot A tries to transfer with an unsupported (but not invalid) token address", async () => {
    // deploy a token
    const factory = ContractFactory.fromSolidity(tokenArtifacts);
    const token = await factory
      .connect(Wallet.fromMnemonic(FUNDED_MNEMONICS[0]).connect(ethProvider))
      .deploy();
    const deployHash = token.deployTransaction.hash;
    expect(deployHash).to.exist;
    await ethProvider.waitForTransaction(token.deployTransaction.hash!);
    // mint token to client
    await token.mint(clientA.signerAddress, TOKEN_AMOUNT);
    // assert sender balance
    const senderBal = await token.balanceOf(clientA.signerAddress);
    expect(senderBal).to.be.bigNumberEq(TOKEN_AMOUNT);

    // fund channel
    await fundChannel(clientA, ETH_AMOUNT_LG, token.address);

    await expect(
      clientA.transfer({
        amount: ETH_AMOUNT_LG.toString(),
        assetId: token.address,
        recipient: clientB.publicIdentifier,
      }),
    ).to.be.rejectedWith(`Install failed`);
    // NOTE: you will not get a more descriptive title
    // because the node maintains the valid tokens list
  });

  it("Bot A tries to transfer with invalid recipient xpub", async () => {
    await fundChannel(clientA, ETH_AMOUNT_SM, tokenAddress);

    await expect(
      clientA.transfer({
        amount: ETH_AMOUNT_SM.toString(),
        assetId: tokenAddress,
        recipient: `nope`,
      }),
    ).to.be.rejectedWith(`Value \"nope\" must start with \"xpub\"`);
  });

  // tslint:disable-next-line: max-line-length
  it("Bot A tries to transfer an amount greater than they have in their free balance", async () => {
    await expect(
      clientA.transfer({
        amount: ETH_AMOUNT_SM.toString(),
        assetId: tokenAddress,
        recipient: clientB.publicIdentifier,
      }),
    ).to.be.rejectedWith(`Value (${ETH_AMOUNT_SM.toString()}) is not less than or equal to 0`);
  });

  it("Bot A tries to transfer with a paymentId that is not 32 bytes", async () => {
    await fundChannel(clientA, ETH_AMOUNT_SM, tokenAddress);

    await expect(
      clientA.conditionalTransfer({
        amount: ETH_AMOUNT_SM.toString(),
        assetId: tokenAddress,
        conditionType: "LINKED_TRANSFER_TO_RECIPIENT",
        paymentId: "nope",
        preImage: hexlify(randomBytes(32)),
        recipient: clientB.publicIdentifier,
      }),
    ).to.be.rejectedWith(`Value \"nope\" is not a valid hex string`);
  });

  it("Bot A tries to transfer with a preimage that is not 32 bytes", async () => {
    await fundChannel(clientA, ETH_AMOUNT_SM, tokenAddress);

    await expect(
      clientA.conditionalTransfer({
        amount: ETH_AMOUNT_SM.toString(),
        assetId: tokenAddress,
        conditionType: "LINKED_TRANSFER_TO_RECIPIENT",
        paymentId: hexlify(randomBytes(32)),
        preImage: "nope",
        recipient: clientB.publicIdentifier,
      }),
    ).to.be.rejectedWith(`Value \"nope\" is not a valid hex string`);
  });

  it("Bot A proposes a transfer to an xpub that doesn’t have a channel", async () => {
    await fundChannel(clientA, ETH_AMOUNT_SM, tokenAddress);

    await expect(
      clientA.transfer({
        amount: ETH_AMOUNT_SM.toString(),
        assetId: tokenAddress,
        recipient: HDNode.fromMnemonic(Wallet.createRandom().mnemonic).neuter().extendedKey,
      }),
    ).to.be.rejectedWith(`No channel exists for recipientPublicIdentifier`);
  });
});
