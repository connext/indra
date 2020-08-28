import { connect } from "@connext/client";
import { getMemoryStore } from "@connext/store";
import { ClientOptions, IConnextClient, ProtocolNames } from "@connext/types";
import { ColorfulLogger, getRandomChannelSigner } from "@connext/utils";
import { Wallet, constants, utils } from "ethers";

import {
  createClient,
  createClientWithMessagingLimits,
  createDefaultClient,
  env,
  ETH_AMOUNT_SM,
  ethProviderUrl,
  expect,
  fundChannel,
  getTestLoggers,
  RECEIVED,
  SEND,
  sendOnchainValue,
  SETUP_RESPONDER_RECEIVED_COUNT,
  SETUP_RESPONDER_SENT_COUNT,
  TestMessagingService,
} from "./util";

const { AddressZero, One, HashZero } = constants;
const { hexlify, randomBytes } = utils;

const name = "Connect";
const { timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let client: IConnextClient;
  let start: number;

  beforeEach(async () => {
    start = Date.now();
  });

  afterEach(async () => {
    if (client) {
      await client.off();
    }
  });

  it("Happy case: user creates channel with mainnet network string", async () => {
    client = await createDefaultClient("mainnet");
    expect(client.multisigAddress).to.be.ok;
    timeElapsed("Test complete", start);
  });

  it("Happy case: user creates channel with rinkeby network string", async () => {
    client = await createDefaultClient("rinkeby");
    expect(client.multisigAddress).to.be.ok;
  });

  it("Happy case: user creates channel with node and is given multisig address", async () => {
    client = await createClient();
    expect(client.multisigAddress).to.be.ok;
  });

  it("Happy case: user creates channel with client and is given multisig address using test messaging service", async () => {
    client = await createClientWithMessagingLimits();
    expect(client.multisigAddress).to.be.ok;
    const messaging = client.messaging as TestMessagingService;
    expect(messaging).to.be.ok;
    expect(messaging.apiCount[SEND]).to.be.at.least(SETUP_RESPONDER_SENT_COUNT);
    expect(messaging.apiCount[RECEIVED]).to.be.at.least(SETUP_RESPONDER_RECEIVED_COUNT);
    expect(messaging.setupCount[SEND]).to.be.eq(SETUP_RESPONDER_SENT_COUNT);
    expect(messaging.setupCount[RECEIVED]).to.be.eq(SETUP_RESPONDER_RECEIVED_COUNT);
  });

  it("Creating a channel with mainnet network string fails if no signer is provided", async () => {
    await expect(createDefaultClient("mainnet", { signer: undefined })).to.be.rejectedWith(
      "Signer required for Mainnet",
    );
  });

  it("Creating a channel fails if user address and node address are the same", async () => {
    const nodeMnemonic: string =
      "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";
    const { privateKey } = Wallet.fromMnemonic(nodeMnemonic);
    await expect(createClient({ signer: privateKey })).to.be.rejectedWith(
      "Client must be instantiated with a signer that is different from the node's",
    );
  });

  it("should fail if the client goes offline", async () => {
    await expect(
      createClientWithMessagingLimits({
        ceiling: { [RECEIVED]: 0 },
        protocol: ProtocolNames.setup,
      }),
    ).to.be.rejectedWith("Could not enable channel");
    const client = await createClientWithMessagingLimits();
    expect(client.multisigAddress).to.be.ok;
  });

  it("Client should be able to connect to indra w/out a messaging url", async () => {
    const signer = getRandomChannelSigner();
    const client = await connect({
      ethProviderUrl,
      loggerService: new ColorfulLogger("ClientConnect", env.logLevel, true),
      nodeUrl: env.nodeUrl,
      signer,
      store: getMemoryStore({ prefix: signer.publicIdentifier }),
    });
    expect(client.publicIdentifier).to.eq(signer.publicIdentifier);
  });

  it("Client should be able to connect to indra url w /api suffix", async () => {
    const signer = getRandomChannelSigner();
    const protocol = env.nodeUrl.replace(/:\/\/.*/, "://");
    const nodeHost = env.nodeUrl.replace(/.*:\/\//, "").replace(/\/.*/, "");
    const client = await connect({
      ethProviderUrl,
      loggerService: new ColorfulLogger("ClientConnect", env.logLevel, true),
      nodeUrl: `${protocol}${nodeHost}/api`,
      signer,
      store: getMemoryStore({ prefix: signer.publicIdentifier }),
      logLevel: 4,
    });
    expect(client.publicIdentifier).to.eq(signer.publicIdentifier);
  });

  it("Client should be able to connect to indra w a messaging url", async () => {
    const signer = getRandomChannelSigner();
    const client = await connect({
      ethProviderUrl,
      loggerService: new ColorfulLogger("ClientConnect", env.logLevel, true),
      messagingUrl: env.natsUrl,
      nodeUrl: env.nodeUrl,
      signer,
      store: getMemoryStore({ prefix: signer.publicIdentifier }),
    });
    expect(client.publicIdentifier).to.eq(signer.publicIdentifier);
  });

  it("Client should not rescind deposit rights if no transfers have been made to the multisig", async () => {
    const signer = getRandomChannelSigner();
    let client = await createClient({ signer });
    const { appIdentityHash: ethDeposit } = await client.requestDepositRights({
      assetId: AddressZero,
    });
    const { appIdentityHash: tokenDeposit } = await client.requestDepositRights({
      assetId: client.config.contractAddresses[client.chainId].Token!,
    });

    // verify
    const { appIdentityHash: retrievedEth } = await client.checkDepositRights({
      assetId: AddressZero,
    });
    expect(retrievedEth).to.eq(ethDeposit);

    const { appIdentityHash: retrievedToken } = await client.checkDepositRights({
      assetId: client.config.contractAddresses[client.chainId].Token!,
    });
    expect(retrievedToken).to.eq(tokenDeposit);

    // disconnect + reconnect
    await client.off();
    await client.store.clear();
    client = await createClient({ signer });

    // verify still installed
    const { appIdentityHash: retrievedEth2 } = await client.checkDepositRights({
      assetId: AddressZero,
    });
    expect(retrievedEth2).to.eq(ethDeposit);

    const { appIdentityHash: retrievedToken2 } = await client.checkDepositRights({
      assetId: client.config.contractAddresses[client.chainId].Token!,
    });
    expect(retrievedToken2).to.eq(tokenDeposit);
  });

  it("Client should wait for transfers and rescind deposit rights if it's offline", async () => {
    const pk = Wallet.createRandom().privateKey;
    const store = getMemoryStore();
    let client = await createClient({ signer: pk, store } as Partial<ClientOptions>);
    await client.requestDepositRights({ assetId: AddressZero });
    await client.requestDepositRights({
      assetId: client.config.contractAddresses[client.chainId].Token!,
    });
    let apps = await client.getAppInstances();
    const initDepositApps = apps.filter(
      (app) =>
        app.appDefinition === client.config.contractAddresses[client.chainId].DepositApp &&
        app.initiatorIdentifier === client.publicIdentifier,
    );
    expect(initDepositApps.length).to.be.eq(2);
    await client.off();

    await sendOnchainValue(client.multisigAddress, One);
    await sendOnchainValue(
      client.multisigAddress,
      One,
      client.config.contractAddresses[client.chainId].Token!,
    );

    client = await createClient({ signer: pk, store });
    apps = await client.getAppInstances();
    const depositApps = apps.filter(
      (app) =>
        app.appDefinition === client.config.contractAddresses[client.chainId].DepositApp &&
        app.initiatorIdentifier === client.publicIdentifier,
    );
    expect(depositApps.length).to.be.eq(0);
  });

  it.skip("Client should attempt to wait for user withdrawal if there are withdraw commitments in store", async () => {
    const pk = Wallet.createRandom().privateKey;
    const store = getMemoryStore();
    store.saveUserWithdrawal({
      tx: {
        to: Wallet.createRandom().address,
        value: 0,
        data: hexlify(randomBytes(32)),
      },
      retry: 0,
      withdrawalTx: HashZero,
    });
    expect(await createClient({ signer: pk, store })).rejectedWith("Something");
  });

  it("Client should not need to wait for user withdrawal after successful withdraw", async () => {
    const pk = Wallet.createRandom().privateKey;
    const store = getMemoryStore();
    const client = await createClient({ signer: pk, store });
    await fundChannel(client, ETH_AMOUNT_SM);
    await client.withdraw({
      amount: ETH_AMOUNT_SM,
      recipient: Wallet.createRandom().address,
      assetId: AddressZero,
    });
    await client.off();

    // now try to restart client (should succeed)
    expect(await createClient({ signer: pk, store })).to.be.ok;
  });
});
