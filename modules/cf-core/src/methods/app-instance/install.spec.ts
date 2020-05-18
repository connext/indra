import { getMemoryStore } from "@connext/store";
import {
  EXPECTED_CONTRACT_NAMES_IN_NETWORK_CONTEXT,
  NetworkContext,
  IStoreService,
} from "@connext/types";
import {
  getRandomBytes32,
  getSignerAddressFromPublicIdentifier,
  nullLogger,
  toBNJson,
} from "@connext/utils";
import { Wallet, providers, constants } from "ethers";
import { instance, mock } from "ts-mockito";

import {
  NO_APP_IDENTITY_HASH_TO_INSTALL,
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
    [contractName]: constants.AddressZero,
  }),
  {} as NetworkContext,
);

describe("Can handle correct & incorrect installs", () => {
  let store: IStoreService;
  let protocolRunner: ProtocolRunner;
  let initiatorIdentifier: string;

  beforeAll(async () => {
    store = getMemoryStore();
    await store.init();
    protocolRunner = new ProtocolRunner(
      NETWORK_CONTEXT_OF_ALL_ZERO_ADDRESSES,
      {} as providers.JsonRpcProvider,
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
      install(store, protocolRunner, { appIdentityHash: constants.HashZero }, initiatorIdentifier),
    ).rejects.toThrowError(NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH(constants.HashZero));
  });

  it("succeeds to install a proposed AppInstance", async () => {
    const mockedProtocolRunner = mock(ProtocolRunner);
    const protocolRunner = instance(mockedProtocolRunner);

    const appIdentityHash = getRandomBytes32();
    const multisigAddress = Wallet.createRandom().address;
    const publicIdentifiers = getRandomPublicIdentifiers(2);
    const participants = [
      getSignerAddressFromPublicIdentifier(publicIdentifiers[0]),
      getSignerAddressFromPublicIdentifier(publicIdentifiers[1]),
    ];

    const stateChannel = StateChannel.setupChannel(
      constants.AddressZero,
      { proxyFactory: constants.AddressZero, multisigMastercopy: constants.AddressZero },
      multisigAddress,
      publicIdentifiers[0],
      publicIdentifiers[1],
    );

    expect(
      stateChannel.getFreeBalanceClass().getBalance(constants.AddressZero, participants[0]),
    ).toEqual(constants.Zero);
    expect(
      stateChannel.getFreeBalanceClass().getBalance(constants.AddressZero, participants[1]),
    ).toEqual(constants.Zero);

    const commitment = {
      appIdentity: {} as any,
      stateTimeout: toBNJson("0"),
      appIdentityHash,
      appStateHash: constants.HashZero,
      challengeRegistryAddress: constants.AddressZero,
      signatures: ["0x0", "0x0"],
      versionNumber: toBNJson(1),
    };

    await store.createStateChannel(
      stateChannel.toJson(),
      {
        data: "0x",
        to: stateChannel.multisigAddress,
        value: constants.Zero,
      },
      commitment,
    );

    const appInstanceProposal = createAppInstanceProposalForTest(appIdentityHash, stateChannel);

    appInstanceProposal.abiEncodings.actionEncoding = null as any; // TODO: why?

    await store.createAppProposal(stateChannel.multisigAddress, appInstanceProposal, 0, commitment);

    /*
    when(mockedStore.getAppProposal(appIdentityHash)).thenResolve(appInstanceProposal);

    when(mockedStore.getStateChannelByAppIdentityHash(appIdentityHash)).thenResolve(
      stateChannel.toJson(),
    );

    // Gets around having to register middleware into the machine
    // and just returns a basic <string, StateChannel> map with the
    // expected multisigAddress in it.
    when(mockedProtocolRunner.initiateProtocol(ProtocolNames.install, anything())).thenResolve();
*/

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
