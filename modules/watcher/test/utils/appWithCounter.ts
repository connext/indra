import {
  AppIdentity,
  BigNumber,
  AppInterface,
  AppInstanceJson,
  Address,
  OutcomeType,
  TwoPartyFixedOutcomeInterpreterParamsJson,
  CONVENTION_FOR_ETH_ASSET_ID,
  SetStateCommitmentJSON,
  ConditionalTransactionCommitmentJSON,
  NetworkContext,
  CoinTransfer,
} from "@connext/types";
import { defaultAbiCoder, solidityPack, keccak256 } from "ethers/utils";
import { ChannelSigner, toBNJson } from "@connext/utils";
import { One, Zero } from "ethers/constants";
import { stateToHash } from "./utils";
import { ConditionalTransactionCommitment, SetStateCommitment } from "@connext/contracts";

/////////////////////////////
//// Helper class

export class AppWithCounterClass {
  public readonly outcomeType = OutcomeType.TWO_PARTY_FIXED_OUTCOME;
  constructor(
    public readonly signerParticipants: ChannelSigner[],
    public readonly multisigAddress: string,
    public readonly appDefinition: string,
    public readonly defaultTimeout: BigNumber,
    public readonly channelNonce: BigNumber,
    public readonly tokenIndexedBalances: {
      [tokenAddress: string]: CoinTransfer[];
    } = {
      [CONVENTION_FOR_ETH_ASSET_ID]: [
        { to: signerParticipants[0].address, amount: One },
        { to: signerParticipants[1].address, amount: Zero },
      ], // initiator, resp
    },
    public readonly stateTimeout: BigNumber = Zero,
    public versionNumber: BigNumber = One,
    public latestState: AppWithCounterState = { counter: One },
    public latestAction: AppWithCounterAction | undefined = undefined,
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

  get appInterface(): AppInterface {
    return {
      stateEncoding: `tuple(uint256 counter)`,
      actionEncoding: `tuple(uint8 actionType, uint256 increment)`,
      addr: this.appDefinition,
    };
  }

  get interpreterParams(): TwoPartyFixedOutcomeInterpreterParamsJson {
    const coinTransfer = this.tokenIndexedBalances[CONVENTION_FOR_ETH_ASSET_ID][0];
    return {
      playerAddrs: this.participants as [string, string],
      amount: toBNJson(coinTransfer.amount) as any,
      tokenAddress: CONVENTION_FOR_ETH_ASSET_ID,
    };
  }

  get appStateHash(): string {
    return stateToHash(AppWithCounterClass.encodeState(this.latestState));
  }

  public static encodeState(state: AppWithCounterState) {
    return defaultAbiCoder.encode([`tuple(uint256 counter)`], [state]);
  }

  public static encodeInterpreterParams(
    interpreterParams: TwoPartyFixedOutcomeInterpreterParamsJson,
  ): string {
    return defaultAbiCoder.encode([`tuple(address[] playerAddrs, uint256 amount, address tokenAddress)`], [interpreterParams]);
  }

  public static encodeAction(action: AppWithCounterAction) {
    return defaultAbiCoder.encode([`tuple(uint8 actionType, uint256 increment)`], [action]);
  }

  public toJson(): AppInstanceJson {
    return {
      identityHash: this.identityHash,
      multisigAddress: this.multisigAddress,
      initiatorIdentifier: this.signerParticipants[0].publicIdentifier,
      responderIdentifier: this.signerParticipants[1].publicIdentifier,
      defaultTimeout: this.defaultTimeout.toHexString(),
      appInterface: this.appInterface,
      appSeqNo: this.channelNonce.toNumber(),
      latestState: this.latestState,
      latestVersionNumber: this.versionNumber.toNumber(),
      stateTimeout: this.stateTimeout.toString(),
      outcomeType: this.outcomeType,
      latestAction: this.latestAction,
      twoPartyOutcomeInterpreterParams: this.interpreterParams,
    };
  }

  public async getSetState(challengeRegistryAddress: string): Promise<SetStateCommitmentJSON> {
    const setState = new SetStateCommitment(
      challengeRegistryAddress,
      this.appIdentity,
      this.appStateHash,
      this.versionNumber,
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

  public async getConditional(
    freeBalanceHash: string,
    networkContext: NetworkContext,
  ): Promise<ConditionalTransactionCommitmentJSON> {
    const conditional = new ConditionalTransactionCommitment(
      networkContext,
      this.multisigAddress,
      this.participants,
      this.identityHash,
      freeBalanceHash,
      networkContext.TwoPartyFixedOutcomeInterpreter, // interpreter address
      AppWithCounterClass.encodeInterpreterParams(this.interpreterParams),
    );
    const digest = conditional.hashToSign();
    const signatures = await Promise.all([
      this.signerParticipants[0].signMessage(digest),
      this.signerParticipants[1].signMessage(digest),
    ]);
    await conditional.addSignatures(signatures[0], signatures[1]);
    return conditional.toJson();
  }
}

export type AppWithCounterAction = {
  actionType: ActionType;
  increment: BigNumber;
};

export type AppWithCounterState = {
  counter: BigNumber;
};

export enum ActionType {
  SUBMIT_COUNTER_INCREMENT,
  ACCEPT_INCREMENT,
}
