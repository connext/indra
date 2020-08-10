import { BigNumber, constants, utils } from "ethers";
import {
  CoinTransfer,
  Address,
  AppIdentity,
  AppInstanceJson,
  OutcomeType,
  SetStateCommitmentJSON,
  StateChannelJSON,
  StateSchemaVersion,
  MinimalTransaction,
  AppABIEncodings,
} from "@connext/types";
import { ChannelSigner, toBN } from "@connext/utils";
import { SetStateCommitment, SetupCommitment } from "@connext/contracts";

import { stateToHash } from "./utils";
import { TestNetworkContext } from "./contracts";
import { AppWithCounterClass } from "./appWithCounter";
import { TokenIndexedBalance } from "./context";

const { One, Zero, AddressZero } = constants;
const { keccak256, solidityPack, defaultAbiCoder } = utils;

type FreeBalanceStateJSON = {
  tokenAddresses: string[];
  balances: CoinTransfer[][]; // why is this serialized?
  activeApps: string[];
};

const freeBalStateEncoding = `tuple(address[] tokenAddresses, tuple(address to, uint256 amount)[][] balances, bytes32[] activeApps)`;

export class MiniFreeBalance {
  public channelNonce = One;
  public defaultTimeout = Zero;
  public stateTimeout = Zero;

  constructor(
    public readonly signerParticipants: ChannelSigner[],
    public readonly multisigAddress: string,
    private balancesIndexedByToken: TokenIndexedBalance,
    private readonly networkContext: TestNetworkContext,
    public versionNumber: BigNumber = One,
    private activeApps: string[] = [],
  ) {}

  get identityHash(): string {
    return keccak256(
      solidityPack(
        ["address", "uint256", "bytes32", "address", "uint256"],
        [
          this.multisigAddress,
          this.channelNonce,
          keccak256(solidityPack(["address[]"], [this.participants])),
          this.appDefinition,
          this.defaultTimeout,
        ],
      ),
    );
  }

  get balances() {
    return this.balancesIndexedByToken;
  }

  get appDefinition(): string {
    return this.networkContext.IdentityApp;
  }

  get participants(): Address[] {
    return [this.signerParticipants[0].address, this.signerParticipants[1].address];
  }

  get appIdentity(): AppIdentity {
    return {
      participants: this.participants,
      multisigAddress: this.multisigAddress,
      appDefinition: this.appDefinition,
      defaultTimeout: this.defaultTimeout,
      channelNonce: this.channelNonce,
    };
  }

  get abiEncodings(): AppABIEncodings {
    return {
      stateEncoding: freeBalStateEncoding,
      actionEncoding: undefined,
    };
  }

  get latestState(): FreeBalanceStateJSON {
    return {
      activeApps: this.activeApps,
      balances: Object.values(this.balancesIndexedByToken).map((balances) =>
        balances.map(({ to, amount }) => ({ to, amount })),
      ),
      tokenAddresses: Object.keys(this.balancesIndexedByToken),
    };
  }

  get initialState(): FreeBalanceStateJSON {
    return {
      activeApps: [],
      balances: Object.values(this.balancesIndexedByToken).map((balances) =>
        balances.map(({ to }) => ({ to, amount: Zero })),
      ),
      tokenAddresses: Object.keys(this.balancesIndexedByToken),
    };
  }

  public static encodeState(state: FreeBalanceStateJSON) {
    return defaultAbiCoder.encode([freeBalStateEncoding], [state]);
  }

  public static channelFactory(
    signers: ChannelSigner[],
    chainId: number,
    multisigAddress: string,
    networkContext: TestNetworkContext,
    activeApps: AppWithCounterClass[],
    remainingBalance: {
      [tokenAddress: string]: CoinTransfer[];
    },
  ): [MiniFreeBalance, StateChannelJSON] {
    const appIds = activeApps.map((app) => app.identityHash);
    const channelNonce = toBN(activeApps.length).add(1);
    const freeBalance = new MiniFreeBalance(
      signers,
      multisigAddress,
      remainingBalance,
      networkContext,
      toBN(appIds.length + 1),
      appIds,
    );
    const channel: StateChannelJSON = {
      schemaVersion: StateSchemaVersion,
      multisigAddress,
      addresses: {
        ProxyFactory: networkContext.ProxyFactory,
        MinimumViableMultisig: networkContext.MinimumViableMultisig,
      },
      userIdentifiers: [signers[0].publicIdentifier, signers[1].publicIdentifier],
      proposedAppInstances: [],
      appInstances: activeApps.map((app) => [app.identityHash, app.toJson()]) as [
        string,
        AppInstanceJson,
      ][],
      freeBalanceAppInstance: freeBalance.toJson(),
      monotonicNumProposedApps: channelNonce.toNumber(),
      chainId,
    };
    return [freeBalance, channel];
  }

  public toJson(): AppInstanceJson {
    return {
      identityHash: this.identityHash,
      multisigAddress: this.multisigAddress,
      initiatorIdentifier: this.signerParticipants[0].publicIdentifier,
      responderIdentifier: this.signerParticipants[1].publicIdentifier,
      defaultTimeout: this.defaultTimeout.toHexString(),
      abiEncodings: this.abiEncodings,
      appSeqNo: this.channelNonce.toNumber(),
      latestState: this.latestState,
      latestVersionNumber: this.versionNumber.toNumber(),
      stateTimeout: this.stateTimeout.toString(),
      outcomeType: OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER,
      latestAction: undefined,
      appDefinition: this.appDefinition,
      responderDeposit: Zero.toString(),
      responderDepositAssetId: AddressZero,
      initiatorDeposit: Zero.toString(),
      initiatorDepositAssetId: AddressZero,
      outcomeInterpreterParameters: {} as any,
    };
  }

  public async getSetup(): Promise<MinimalTransaction> {
    const setup = new SetupCommitment(
      this.networkContext,
      this.multisigAddress,
      this.participants,
      this.appIdentity,
    );
    const signatures = await Promise.all([
      this.signerParticipants[0].signMessage(setup.hashToSign()),
      this.signerParticipants[1].signMessage(setup.hashToSign()),
    ]);
    await setup.addSignatures(signatures[0], signatures[1]);

    return setup.getSignedTransaction();
  }

  public async getInitialSetState(): Promise<SetStateCommitmentJSON> {
    const setState = new SetStateCommitment(
      this.networkContext.ChallengeRegistry,
      this.appIdentity,
      stateToHash(MiniFreeBalance.encodeState(this.initialState)),
      One,
      this.stateTimeout,
      this.identityHash,
    );
    const signatures = await Promise.all([
      this.signerParticipants[0].signMessage(setState.hashToSign()),
      this.signerParticipants[1].signMessage(setState.hashToSign()),
    ]);
    await setState.addSignatures(signatures[0], signatures[1]);
    return setState.toJson();
  }

  // defaults to getting current set state, but will add sigs on any
  // passed in free balance state
  public async getSetState(): Promise<SetStateCommitmentJSON> {
    const setState = new SetStateCommitment(
      this.networkContext.ChallengeRegistry,
      this.appIdentity,
      stateToHash(MiniFreeBalance.encodeState(this.latestState)),
      this.versionNumber,
      this.stateTimeout,
      this.identityHash,
    );
    const digest = setState.hashToSign();
    const signatures = await Promise.all([
      this.signerParticipants[0].signMessage(digest),
      this.signerParticipants[1].signMessage(digest),
    ]);
    await setState.addSignatures(signatures[0], signatures[1]);

    return setState.toJson();
  }
}
