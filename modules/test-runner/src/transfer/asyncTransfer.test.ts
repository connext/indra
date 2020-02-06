import { ERC20TokenArtifacts, IConnextClient, LINKED_TRANSFER_TO_RECIPIENT, toBN } from "@connext/types";
import { ContractFactory, Wallet } from "ethers";
import { AddressZero } from "ethers/constants";
import { HDNode, hexlify, randomBytes } from "ethers/utils";
import {
  AssetOptions,
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
  requestCollateral,
  delay,
} from "../util";
import { xpubToAddress } from "@connext/client/dist/lib";

describe("Async Transfers", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let tokenAddress: string;

  beforeEach(async () => {
    clientA = await createClient();
    clientB = await createClient();
    tokenAddress = clientA.config.contractAddresses.Token;
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
    await clientB.messaging.disconnect();
  });

  it("happy case: client A transfers eth to client B through node", async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    await requestCollateral(clientB, transfer.assetId);
    await asyncTransferAsset(clientA, clientB, transfer.amount, transfer.assetId);
  });

  it("happy case: client A transfers tokens to client B through node", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    await clientB.requestCollateral(transfer.assetId);
    await asyncTransferAsset(clientA, clientB, transfer.amount, transfer.assetId);
  });

  it.only("latency test: client A transfers eth to client B through node", async function (done) {
    this.timeout(1200000)
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    await requestCollateral(clientB, transfer.assetId);
    let startTime: number[] = [];
    let y = 0;
    clientB.on("RECEIVE_TRANSFER_FINISHED_EVENT", (data) => {
      // console.log(data)
      const duration = Date.now() - startTime[data.meta.index];
      console.log("Caught #: " + y + ". Index: " + data.meta.index + ". Time: " + duration / 1000)
      console.log("===========================")
      y++
      if(y==5){
        done()
      }
    })

    for(let i = 0; i<5; i++) {
      startTime[i] = Date.now()
      await clientA.transfer({
        assetId: AddressZero,
        recipient: clientB.publicIdentifier,
        amount: transfer.amount.div(toBN(10)).toString(),
        meta: {index: i}
      })
      delay(30000)
      console.log("i: " + i)
    }
  });

  it("client A transfers eth to client B without collateralizing", async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    const receiverBal = await clientB.getFreeBalance(transfer.assetId);
    expect(receiverBal[xpubToAddress(clientB.nodePublicIdentifier)].lt(transfer.amount)).to.be.true;

    await asyncTransferAsset(clientA, clientB, transfer.amount, transfer.assetId);
  });

  it("client A transfers tokens to client B without collateralizing", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    await asyncTransferAsset(clientA, clientB, transfer.amount, transfer.assetId);
  });

  it("Bot A tries to transfer a negative amount", async () => {
    await fundChannel(clientA, ETH_AMOUNT_MD, tokenAddress);
    // verify collateral
    await clientB.requestCollateral(tokenAddress);

    const amount = ETH_AMOUNT_SM.mul(-1).toString();
    await expect(
      clientA.transfer({
        amount,
        assetId: tokenAddress,
        recipient: clientB.publicIdentifier,
      }),
    ).to.be.rejectedWith(`Value ${amount} is negative`);
  });

  it("Bot A tries to transfer with an invalid token address", async () => {
    await fundChannel(clientA, ETH_AMOUNT_SM, tokenAddress);

    const amount = ETH_AMOUNT_SM.toString();
    const assetId = "0xabc";
    await expect(
      clientA.transfer({
        amount,
        assetId,
        recipient: clientB.publicIdentifier,
      }),
    ).to.be.rejectedWith(
      `Value "${assetId}" is not a valid eth address, Value (${amount}) is not less than or equal to 0`,
    );
    // NOTE: will also include a `Value (..) is not less than or equal to 0
    // because it will not be able to fetch the free balance of the assetId
  });

  // TODO: Fix race condition in this one
  it.skip("Bot A transfers w a valid, unsupported token address", async () => {
    // deploy a token
    const factory = ContractFactory.fromSolidity(ERC20TokenArtifacts);
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
    expect(senderBal).to.equal(TOKEN_AMOUNT);

    // fund channel
    await fundChannel(clientA, ETH_AMOUNT_LG, token.address);

    await expect(
      clientA.transfer({
        amount: ETH_AMOUNT_LG.toString(),
        assetId: token.address,
        recipient: clientB.publicIdentifier,
      }),
    ).to.be.rejectedWith("Install failed");
    // NOTE: you will not get a more descriptive title
    // because the node maintains the valid tokens list
  });

  it("Bot A tries to transfer with invalid recipient xpub", async () => {
    await fundChannel(clientA, ETH_AMOUNT_SM, tokenAddress);

    const recipient = "nope";
    await expect(
      clientA.transfer({
        amount: ETH_AMOUNT_SM.toString(),
        assetId: tokenAddress,
        recipient,
      }),
    ).to.be.rejectedWith(`Value "${recipient}" must start with "xpub"`);
  });

  it("Bot A tries to transfer an amount greater than they have in their free balance", async () => {
    const amount = ETH_AMOUNT_SM.toString();
    await expect(
      clientA.transfer({
        amount,
        assetId: tokenAddress,
        recipient: clientB.publicIdentifier,
      }),
    ).to.be.rejectedWith(`Value (${amount}) is not less than or equal to 0`);
  });

  it("Bot A tries to transfer with a paymentId that is not 32 bytes", async () => {
    await fundChannel(clientA, ETH_AMOUNT_SM, tokenAddress);

    const paymentId = "nope";
    await expect(
      clientA.conditionalTransfer({
        amount: ETH_AMOUNT_SM.toString(),
        assetId: tokenAddress,
        conditionType: LINKED_TRANSFER_TO_RECIPIENT,
        paymentId,
        preImage: hexlify(randomBytes(32)),
        recipient: clientB.publicIdentifier,
      }),
    ).to.be.rejectedWith(`Value "${paymentId}" is not a valid hex string`);
  });

  it("Bot A tries to transfer with a preimage that is not 32 bytes", async () => {
    await fundChannel(clientA, ETH_AMOUNT_SM, tokenAddress);

    const preImage = "nope";
    await expect(
      clientA.conditionalTransfer({
        amount: ETH_AMOUNT_SM.toString(),
        assetId: tokenAddress,
        conditionType: LINKED_TRANSFER_TO_RECIPIENT,
        paymentId: hexlify(randomBytes(32)),
        preImage,
        recipient: clientB.publicIdentifier,
      }),
    ).to.be.rejectedWith(`Value "${preImage}" is not a valid hex string`);
  });

  it("Bot A proposes a transfer to an xpub that doesn’t have a channel", async () => {
    await fundChannel(clientA, ETH_AMOUNT_SM, tokenAddress);

    await expect(
      clientA.transfer({
        amount: ETH_AMOUNT_SM.toString(),
        assetId: tokenAddress,
        recipient: HDNode.fromMnemonic(Wallet.createRandom().mnemonic).neuter().extendedKey,
      }),
    ).to.be.rejectedWith("No channel exists for recipientPublicIdentifier");
  });
});
