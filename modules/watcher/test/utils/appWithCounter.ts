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
  twoPartyFixedOutcomeInterpreterParamsEncoding,
  AppInstanceProposal,
  SignedCancelChallengeRequest,
} from "@connext/types";
import { defaultAbiCoder, solidityPack, keccak256 } from "ethers/utils";
import {
  ChannelSigner,
  toBNJson,
  bigNumberifyJson,
  computeCancelDisputeHash,
} from "@connext/utils";
import { One, Zero } from "ethers/constants";
import { stateToHash } from "./utils";
import { ConditionalTransactionCommitment, SetStateCommitment } from "@connext/contracts";

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
    public latestVersionNumber: BigNumber = One,
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

  get nextState(): AppWithCounterState {
    if (!this.latestAction) {
      throw new Error(`Cannot generate next state without action`);
    }
    return this.latestAction.actionType === ActionType.ACCEPT_INCREMENT
      ? { counter: this.latestState.counter }
      : { counter: this.latestState.counter.add(this.latestAction.increment) };
  }

  get interpreterParams(): TwoPartyFixedOutcomeInterpreterParamsJson {
    const coinTransfers = this.tokenIndexedBalances[CONVENTION_FOR_ETH_ASSET_ID];
    return {
      playerAddrs: coinTransfers.map(({ to }) => to) as [string, string],
      amount: toBNJson(
        coinTransfers.reduce(
          (prev, curr) => {
            return { amount: prev.amount.add(curr.amount), to: "" };
          },
          { to: "", amount: Zero },
        ).amount,
      ) as any,
      tokenAddress: CONVENTION_FOR_ETH_ASSET_ID,
    };
  }

  get encodedInterpreterParams() {
    return defaultAbiCoder.encode(
      [twoPartyFixedOutcomeInterpreterParamsEncoding],
      [this.interpreterParams],
    );
  }

  get appStateHash(): string {
    return stateToHash(AppWithCounterClass.encodeState(this.latestState));
  }

  public static encodeState(state: AppWithCounterState) {
    return defaultAbiCoder.encode([`tuple(uint256 counter)`], [state]);
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
      latestVersionNumber: this.latestVersionNumber.toNumber(),
      stateTimeout: this.stateTimeout.toString(),
      outcomeType: this.outcomeType,
      latestAction: this.latestAction,
      twoPartyOutcomeInterpreterParams: this.interpreterParams,
    };
  }

  public getProposal(): AppInstanceProposal {
    return {
      identityHash: this.identityHash,
      initiatorIdentifier: this.signerParticipants[0].publicIdentifier,
      responderIdentifier: this.signerParticipants[1].publicIdentifier,
      appSeqNo: this.channelNonce.toNumber(),
      defaultTimeout: this.defaultTimeout.toString(),
      stateTimeout: this.stateTimeout.toString(),
      abiEncodings: {
        stateEncoding: this.appInterface.stateEncoding,
        actionEncoding: this.appInterface.actionEncoding,
      },
      outcomeType: OutcomeType.TWO_PARTY_FIXED_OUTCOME,
      appDefinition: this.appInterface.addr,
      initialState: { counter: Zero },
      initiatorDeposit: this.tokenIndexedBalances[CONVENTION_FOR_ETH_ASSET_ID][0].amount.toString(),
      initiatorDepositAssetId: CONVENTION_FOR_ETH_ASSET_ID,
      responderDeposit: this.tokenIndexedBalances[CONVENTION_FOR_ETH_ASSET_ID][1].amount.toString(),
      responderDepositAssetId: CONVENTION_FOR_ETH_ASSET_ID,
      twoPartyOutcomeInterpreterParams: bigNumberifyJson(this.interpreterParams),
    };
  }

  public async getInitialSetState(
    challengeRegistryAddress: string,
  ): Promise<SetStateCommitmentJSON> {
    const setState = new SetStateCommitment(
      challengeRegistryAddress,
      this.appIdentity,
      stateToHash(AppWithCounterClass.encodeState({ counter: Zero })),
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

  public async getCancelDisputeRequest(
    versionNumber: BigNumber = this.latestVersionNumber,
  ): Promise<SignedCancelChallengeRequest> {
    const digest = computeCancelDisputeHash(this.identityHash, versionNumber);
    const signatures = await Promise.all([
      this.signerParticipants[0].signMessage(digest),
      this.signerParticipants[1].signMessage(digest),
    ]);
    return {
      signatures,
      versionNumber,
    };
  }

  public async getSingleSignedSetState(
    challengeRegistryAddress: string,
  ): Promise<SetStateCommitmentJSON> {
    if (!this.latestAction) {
      throw new Error(`Cannot generate next set state commitment`);
    }
    const turnTakerIdx = this.latestState.counter.gt(Zero) ? 0 : 1;
    const setState = new SetStateCommitment(
      challengeRegistryAddress,
      this.appIdentity,
      stateToHash(AppWithCounterClass.encodeState(this.nextState)),
      this.latestVersionNumber.add(1),
      this.stateTimeout,
      this.identityHash,
    );
    const sig = await this.signerParticipants[turnTakerIdx].signMessage(setState.hashToSign());
    await setState.addSignatures(
      turnTakerIdx === 0 ? sig : undefined,
      turnTakerIdx === 0 ? undefined : sig,
    );
    return setState.toJson();
  }

  public async getDoubleSignedSetState(
    challengeRegistryAddress: string,
  ): Promise<SetStateCommitmentJSON> {
    const setState = new SetStateCommitment(
      challengeRegistryAddress,
      this.appIdentity,
      this.appStateHash,
      this.latestVersionNumber,
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
      this.encodedInterpreterParams,
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
