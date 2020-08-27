import {
  AppInstanceJson,
  IConnextClient,
  MinimalTransaction,
  OutcomeType,
  SetStateCommitmentJSON,
  StateChannelJSON,
  StateSchemaVersion,
} from "@connext/types";
import { toBN, toBNJson } from "@connext/utils";
import { constants, utils } from "ethers";

import {
  createClient,
  ETH_AMOUNT_SM,
  expect,
  getTestLoggers,
} from "../util";

const { AddressZero, One } = constants;
const { hexlify, randomBytes } = utils;

const TEST_STORE_ETH_ADDRESS: string = "0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4b";

const TEST_STORE_MINIMAL_TX: MinimalTransaction = {
  to: TEST_STORE_ETH_ADDRESS,
  value: One,
  data: hexlify(randomBytes(64)),
};

const TEST_STORE_APP_INSTANCE: AppInstanceJson = {
  identityHash: "identityHashApp",
  multisigAddress: TEST_STORE_ETH_ADDRESS,
  initiatorIdentifier: "sender",
  responderIdentifier: "receiver",
  defaultTimeout: "0x00",
  abiEncodings: {
    actionEncoding: `action encoding`,
    stateEncoding: `state encoding`,
  },
  appDefinition: TEST_STORE_ETH_ADDRESS,
  appSeqNo: 1,
  latestVersionNumber: 2,
  stateTimeout: "0x01",
  latestState: {
    counter: 4,
  },
  outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
  outcomeInterpreterParameters: {
    amount: { _hex: "0x42", _isBigNumber: true } as any,
    playerAddrs: [AddressZero, AddressZero],
    tokenAddress: AddressZero,
  },
  initiatorDeposit: "0",
  initiatorDepositAssetId: TEST_STORE_ETH_ADDRESS,
  responderDeposit: "0",
  responderDepositAssetId: TEST_STORE_ETH_ADDRESS,
};

const TEST_STORE_SET_STATE_COMMITMENT: SetStateCommitmentJSON = {
  appIdentity: {
    channelNonce: toBN(TEST_STORE_APP_INSTANCE.appSeqNo),
    participants: [
      TEST_STORE_APP_INSTANCE.initiatorIdentifier,
      TEST_STORE_APP_INSTANCE.responderIdentifier,
    ],
    multisigAddress: TEST_STORE_APP_INSTANCE.multisigAddress,
    appDefinition: TEST_STORE_APP_INSTANCE.appDefinition,
    defaultTimeout: toBN(35),
  },
  appIdentityHash: TEST_STORE_APP_INSTANCE.identityHash,
  appStateHash: "setStateAppStateHash",
  challengeRegistryAddress: TEST_STORE_ETH_ADDRESS,
  stateTimeout: toBNJson(17),
  versionNumber: toBNJson(23),
  transactionData: "0xdeadbeef",
  signatures: ["sig1", "sig2"] as any[], // Signature type, lazy mock
};

const name = "Get State Channel";
const { timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let clientA: IConnextClient;
  let start: number;
  let tokenAddress: string;

  beforeEach(async () => {
    start = Date.now();
    clientA = await createClient();
    tokenAddress = clientA.config.contractAddresses[clientA.chainId].Token!;
    await clientA.deposit({ amount: ETH_AMOUNT_SM.toString(), assetId: AddressZero });
    await clientA.requestCollateral(tokenAddress);
    timeElapsed("beforeEach complete", start);
  });

  afterEach(async () => {
    await clientA.off();
  });

  it("Happy case: should return stateChannelJSON from store with multisig address", async () => {
    const stateChannel: StateChannelJSON = (await clientA.getStateChannel()).data;
    expect(stateChannel.multisigAddress).to.be.eq(clientA.multisigAddress);
  });

  it("Happy case: should return stateChannelJSON from store with proper version", async () => {
    const stateChannel: StateChannelJSON = (await clientA.getStateChannel()).data;
    expect(stateChannel.schemaVersion).to.be.eq(StateSchemaVersion);
  });

  it("Store does not contain state channel", async () => {
    await clientA.store.clear();
    await expect(clientA.getStateChannel()).to.be.rejectedWith(
      "Call to getStateChannel failed when searching for multisig address",
    );
  });

  it("Store contains multiple state channels", async () => {
    // Client with same store and new signer
    const clientB = await createClient({ store: clientA.store });
    await clientB.deposit({ amount: ETH_AMOUNT_SM.toString(), assetId: AddressZero });
    await clientB.requestCollateral(tokenAddress);

    // Now check both exist in the same store
    const stateChannelA: StateChannelJSON = (await clientA.getStateChannel()).data;
    const stateChannelB: StateChannelJSON = (await clientB.getStateChannel()).data;
    expect(stateChannelA.multisigAddress).to.be.eq(clientA.multisigAddress);
    expect(stateChannelB.multisigAddress).to.be.eq(clientB.multisigAddress);
  });

  /*
    Skipping the next three tests for now. Right now, getStateChannel returns objects
    even if they're missing information or have invalid multisig addresses. These tests
    are only useful if we decide to throw errors/take recovery action on broken channels.
    Otherwise, we can just delete the following:
  */

  it.skip("Store contains state channel on wrong multisig address", async () => {
    const wrongAddress: string = "0xe8f67a5b66B01b301dF0ED1fC91F6F29B78ccf8C";
    const channel = await clientA.store.getStateChannel(clientA.multisigAddress);
    expect(channel).to.be.ok;
    expect(channel!.multisigAddress).to.be.eq(
      (await clientA.getStateChannel()).data.multisigAddress,
    );

    (channel as any).multisigAddress = wrongAddress;
    expect(channel!.multisigAddress).to.be.eq(wrongAddress);
    await clientA.store.createStateChannel(
      channel!,
      TEST_STORE_MINIMAL_TX,
      TEST_STORE_SET_STATE_COMMITMENT,
    );

    // Expect to error in case we keep this test
    await expect(clientA.getStateChannel()).to.be.rejectedWith("");
  });

  it.skip("State channel under multisig key has no proxy factory address", async () => {
    const channel = await clientA.store.getStateChannel(clientA.multisigAddress);

    expect(channel).to.be.ok;
    expect(channel!.addresses.ProxyFactory).to.be.eq(
      (await clientA.getStateChannel()).data.addresses.ProxyFactory,
    );

    (channel as any).addresses.ProxyFactory = null;
    expect(channel!.addresses.ProxyFactory).to.not.be.ok;
    await clientA.store.createStateChannel(
      channel!,
      TEST_STORE_MINIMAL_TX,
      TEST_STORE_SET_STATE_COMMITMENT,
    );

    await expect(clientA.getStateChannel()).to.be.rejected;
  });

  it.skip("State channel under multisig key has freeBalanceAppInstance", async () => {
    const channel = await clientA.store.getStateChannel(clientA.multisigAddress);
    expect(channel).to.be.ok;

    // expect(value.freeBalanceAppInstance).to.be.eqDefined();

    (channel as any).freeBalanceAppInstance = null;
    expect(channel!.freeBalanceAppInstance).to.not.be.ok;
    await clientA.store.createStateChannel(
      channel!,
      TEST_STORE_MINIMAL_TX,
      TEST_STORE_SET_STATE_COMMITMENT,
    );

    await expect(clientA.getStateChannel()).to.be.rejected;
  });
});
