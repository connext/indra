import { ConnextStore, getMemoryStore } from "@connext/store";
import {
  EXPECTED_CONTRACT_NAMES_IN_NETWORK_CONTEXT,
  NetworkContext,
  ProtocolNames,
  IStoreService,
} from "@connext/types";
import {
  getRandomBytes32,
  getSignerAddressFromPublicIdentifier,
  nullLogger,
  toBNJson,
} from "@connext/utils";
import { Wallet } from "ethers";
import { AddressZero, HashZero, Zero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { anything, instance, mock, when } from "ts-mockito";

import {
  NO_APP_IDENTITY_HASH_TO_INSTALL,
  NO_MULTISIG_FOR_APP_IDENTITY_HASH,
  NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH,
} from "../../errors";
import { ProtocolRunner } from "../../machine";
import { StateChannel } from "../../models";

import { createAppInstanceProposalForTest } from "../../testing/utils";

import { install } from "./install";
import { getRandomPublicIdentifiers } from "../../testing/random-signing-keys";

const NETWORK_CONTEXT_OF_ALL_ZERO_ADDRESSES = EXPECTED_CONTRACT_NAMES_IN_NETWORK_CONTEXT.reduce(
  (acc, contractName) => ({
    ...acc,
    [contractName]: AddressZero,
  }),
  {} as NetworkContext,
);

describe("Can handle correct & incorrect installs", () => {
  let store: IStoreService;
  let protocolRunner: ProtocolRunner;
  let initiatorIdentifier: string;

  beforeAll(() => {
    store = getMemoryStore();
    protocolRunner = new ProtocolRunner(
      NETWORK_CONTEXT_OF_ALL_ZERO_ADDRESSES,
      {} as JsonRpcProvider,
      store,
      nullLogger,
    );
    [initiatorIdentifier] = getRandomPublicIdentifiers(1);
  });

  it("fails to install with undefined appIdentityHash", async () => {
    await expect(
      install(store, protocolRunner, { appIdentityHash: undefined! }, initiatorIdentifier),
    ).rejects.toThrowError(NO_APP_IDENTITY_HASH_TO_INSTALL);
  });

  it("fails to install with empty string appIdentityHash", async () => {
    await expect(
      install(store, protocolRunner, { appIdentityHash: "" }, initiatorIdentifier),
    ).rejects.toThrowError(NO_APP_IDENTITY_HASH_TO_INSTALL);
  });

  it("fails to install without the AppInstance being proposed first", async () => {
    await expect(
      install(store, protocolRunner, { appIdentityHash: HashZero }, initiatorIdentifier),
    ).rejects.toThrowError(NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH(HashZero));
  });

  it("fails to install without the appIdentityHash being in a channel", async () => {
    expect.hasAssertions();

    const mockedStore: IStoreService = mock(ConnextStore);

    const appIdentityHash = getRandomBytes32();
    const appInstanceProposal = createAppInstanceProposalForTest(appIdentityHash);

    when(mockedStore.getAppProposal(appIdentityHash)).thenResolve(appInstanceProposal);

    when(mockedStore.getStateChannelByAppIdentityHash(appIdentityHash)).thenThrow(
      Error(NO_MULTISIG_FOR_APP_IDENTITY_HASH),
    );

    await expect(
      install(instance(mockedStore), protocolRunner, { appIdentityHash }, initiatorIdentifier),
    ).rejects.toThrowError(NO_MULTISIG_FOR_APP_IDENTITY_HASH);
  });

  it("succeeds to install a proposed AppInstance", async () => {
    const mockedProtocolRunner = mock(ProtocolRunner);
    const protocolRunner = instance(mockedProtocolRunner);

    const mockedStore: IStoreService = mock(ConnextStore);
    const store = instance(mockedStore);

    const appIdentityHash = getRandomBytes32();
    const multisigAddress = Wallet.createRandom().address;
    const publicIdentifiers = getRandomPublicIdentifiers(2);
    const participants = [
      getSignerAddressFromPublicIdentifier(publicIdentifiers[0]),
      getSignerAddressFromPublicIdentifier(publicIdentifiers[1]),
    ];

    const stateChannel = StateChannel.setupChannel(
      AddressZero,
      { proxyFactory: AddressZero, multisigMastercopy: AddressZero },
      multisigAddress,
      publicIdentifiers[0],
      publicIdentifiers[1],
    );

    expect(stateChannel.getFreeBalanceClass().getBalance(AddressZero, participants[0])).toEqual(
      Zero,
    );
    expect(stateChannel.getFreeBalanceClass().getBalance(AddressZero, participants[1])).toEqual(
      Zero,
    );

    await store.createStateChannel(
      stateChannel.toJson(),
      {
        data: "0x",
        to: stateChannel.multisigAddress,
        value: Zero,
      },
      {
        appIdentity: {} as any,
        stateTimeout: toBNJson("0"),
        appIdentityHash,
        appStateHash: HashZero,
        challengeRegistryAddress: AddressZero,
        signatures: ["0x0", "0x0"],
        versionNumber: toBNJson(1),
      },
    );

    const appInstanceProposal = createAppInstanceProposalForTest(appIdentityHash);

    when(mockedStore.getAppProposal(appIdentityHash)).thenResolve(appInstanceProposal);

    when(mockedStore.getStateChannelByAppIdentityHash(appIdentityHash)).thenResolve(
      stateChannel.toJson(),
    );

    // Gets around having to register middleware into the machine
    // and just returns a basic <string, StateChannel> map with the
    // expected multisigAddress in it.
    when(mockedProtocolRunner.initiateProtocol(ProtocolNames.install, anything())).thenResolve();

    // The AppInstanceProposal that's returned is the one that was installed, which
    // is the same one as the one that was proposed
    await expect(
      install(
        store,
        protocolRunner,
        {
          appIdentityHash,
        },
        publicIdentifiers[0],
      ),
    ).resolves.toEqual(appInstanceProposal);
  });
});
