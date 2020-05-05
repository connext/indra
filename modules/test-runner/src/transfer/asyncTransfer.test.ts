import { getLocalStore } from "@connext/store";
import { ConditionalTransferTypes, IConnextClient } from "@connext/types";
import { ChannelSigner, getRandomBytes32 } from "@connext/utils";
import { ContractFactory, Wallet, constants } from "ethers";
import tokenArtifacts from "@openzeppelin/contracts/build/contracts/ERC20Mintable.json";
import { before } from "mocha";
import { Client } from "ts-nats";

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
  withdrawFromChannel,
  ZERO_ZERO_ONE_ETH,
} from "../util";
import { getNatsClient } from "../util/nats";

describe("Async Transfers", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let tokenAddress: string;
  let nats: Client;

  before(async () => {
    nats = getNatsClient();
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

  it("happy case: client A transfers eth to client B through node", async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: constants.AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    await requestCollateral(clientB, transfer.assetId);
    await asyncTransferAsset(clientA, clientB, transfer.amount, transfer.assetId, nats);
  });

  it("happy case: client A transfers eth to client B through node with localstorage", async () => {
    const localStorageClient = await createClient({ store: getLocalStore() });
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: constants.AddressZero };
    await fundChannel(localStorageClient, transfer.amount, transfer.assetId);
    await requestCollateral(clientB, transfer.assetId);
    await asyncTransferAsset(localStorageClient, clientB, transfer.amount, transfer.assetId, nats);
  });

  it("happy case: client A transfers tokens to client B through node", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    await clientB.requestCollateral(transfer.assetId);
    await asyncTransferAsset(clientA, clientB, transfer.amount, transfer.assetId, nats);
  });

  it("happy case: client A successfully transfers to an address that doesn’t have a channel", async () => {
    const receiverSigner = new ChannelSigner(
      Wallet.createRandom().privateKey,
      ethProvider.connection.url,
    );
    await fundChannel(clientA, ETH_AMOUNT_SM, tokenAddress);
    await clientA.transfer({
      amount: ETH_AMOUNT_SM.toString(),
      assetId: tokenAddress,
      recipient: receiverSigner.publicIdentifier,
    });
    const receiverClient = await createClient({ signer: receiverSigner }, false);
    expect(receiverClient.publicIdentifier).to.eq(receiverSigner.publicIdentifier);
    const freeBalance = await receiverClient.getFreeBalance(tokenAddress);
    expect(freeBalance[receiverClient.signerAddress]).to.be.above(0);
    receiverClient.messaging.disconnect();
  });

  it.skip("latency test: deposit, collateralize, many transfers, withdraw", async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: constants.AddressZero };
    await fundChannel(clientA, ETH_AMOUNT_MD, transfer.assetId);
    await requestCollateral(clientB, transfer.assetId);
    await asyncTransferAsset(clientA, clientB, transfer.amount, transfer.assetId, nats);
    await asyncTransferAsset(clientA, clientB, transfer.amount, transfer.assetId, nats);
    await asyncTransferAsset(clientA, clientB, transfer.amount, transfer.assetId, nats);
    await asyncTransferAsset(clientA, clientB, transfer.amount, transfer.assetId, nats);
    await asyncTransferAsset(clientA, clientB, transfer.amount, transfer.assetId, nats);
    await withdrawFromChannel(clientA, ZERO_ZERO_ONE_ETH, constants.AddressZero);
    /*
      // @ts-ignore
      this.timeout(1200000);
      const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: constants.AddressZero };
      await fundChannel(clientA, transfer.amount, transfer.assetId);
      await requestCollateral(clientB, transfer.assetId);
      let startTime: number[] = [];
      let y = 0;
      clientB.on("RECEIVE_TRANSFER_FINISHED_EVENT", data => {
        // log.info(data)
        const duration = Date.now() - startTime[data.meta.index];
        log.info("Caught #: " + y + ". Index: " + data.meta.index + ". Time: " + duration / 1000);
        y++;
        if (y === 5) {
          res();
        }
      });
      for (let i = 0; i < 5; i++) {
        startTime[i] = Date.now();
        await clientA.transfer({
          amount: transfer.amount.div(toBN(10)).toString(),
          assetId: constants.AddressZero,
          meta: { index: i },
          recipient: clientB.publicIdentifier,
        });
        delay(30000);
        log.info("i: " + i);
      }
    });
    */
  });

  it("client A transfers eth to client B without collateralizing", async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: constants.AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    const receiverBal = await clientB.getFreeBalance(transfer.assetId);
    expect(receiverBal[clientB.nodeSignerAddress].lt(transfer.amount)).to.be.true;

    await asyncTransferAsset(clientA, clientB, transfer.amount, transfer.assetId, nats);
  });

  it("client A transfers tokens to client B without collateralizing", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    await asyncTransferAsset(clientA, clientB, transfer.amount, transfer.assetId, nats);
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
    ).to.be.rejectedWith(`invalid number value`);
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
    ).to.be.rejectedWith(`invalid address`);
    // NOTE: will also include a `Value (..) is not less than or equal to 0
    // because it will not be able to fetch the free balance of the assetId
  });

  // TODO: Fix race condition in this one
  it.skip("Bot A transfers w a valid, unsupported token address", async () => {
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

  it("Bot A tries to transfer with invalid recipient identifier", async () => {
    await fundChannel(clientA, ETH_AMOUNT_SM, tokenAddress);

    const recipient = "nope";
    await expect(
      clientA.transfer({
        amount: ETH_AMOUNT_SM.toString(),
        assetId: tokenAddress,
        recipient,
      }),
    ).to.be.rejectedWith(`Invalid public identifier`);
  });

  it("Bot A tries to transfer an amount greater than they have in their free balance", async () => {
    const amount = ETH_AMOUNT_SM.toString();
    await expect(
      clientA.transfer({
        amount,
        assetId: tokenAddress,
        recipient: clientB.publicIdentifier,
      }),
    ).to.be.rejectedWith(`Install failed.`);
  });

  it("Bot A tries to transfer with a paymentId that is not 32 bytes", async () => {
    await fundChannel(clientA, ETH_AMOUNT_SM, tokenAddress);

    const paymentId = "nope";
    await expect(
      clientA.conditionalTransfer({
        amount: ETH_AMOUNT_SM.toString(),
        assetId: tokenAddress,
        conditionType: ConditionalTransferTypes.LinkedTransfer,
        paymentId,
        preImage: getRandomBytes32(),
        recipient: clientB.publicIdentifier,
      }),
    ).to.be.rejectedWith(`Invalid hex string`);
  });

  it("Bot A tries to transfer with a preImage that is not 32 bytes", async () => {
    await fundChannel(clientA, ETH_AMOUNT_SM, tokenAddress);

    const preImage = "nope";
    await expect(
      clientA.conditionalTransfer({
        amount: ETH_AMOUNT_SM.toString(),
        assetId: tokenAddress,
        conditionType: ConditionalTransferTypes.LinkedTransfer,
        paymentId: getRandomBytes32(),
        preImage,
        recipient: clientB.publicIdentifier,
      }),
    ).to.be.rejectedWith(`Invalid hex string`);
  });

  it("Experimental: Average latency of 10 async transfers with Eth", async () => {
    let runTime: number[] = [];
    let sum = 0;
    const numberOfRuns = 5;
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: constants.AddressZero };
    await fundChannel(clientA, transfer.amount.mul(25), transfer.assetId);
    await requestCollateral(clientB, transfer.assetId);
    for (let i = 0; i < numberOfRuns; i++) {
      const start = Date.now();
      await asyncTransferAsset(clientA, clientB, transfer.amount, transfer.assetId, nats);
      runTime[i] = Date.now() - start;
      console.log(`Run: ${i}, Runtime: ${runTime[i]}`);
      sum = sum + runTime[i];
    }
    console.log(`Average = ${sum / numberOfRuns} ms`);
  });
});
