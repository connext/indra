import {
  Address,
  AppABIEncodings,
  AppIdentity,
  AppInstanceJson,
  AssetId,
  DecString,
  HexString,
  MultiAssetMultiPartyCoinTransferInterpreterParams,
  multiAssetMultiPartyCoinTransferInterpreterParamsEncoding,
  OutcomeType,
  PublicIdentifier,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  singleAssetTwoPartyCoinTransferInterpreterParamsEncoding,
  SolidityValueType,
  TwoPartyFixedOutcomeInterpreterParams,
  twoPartyFixedOutcomeInterpreterParamsEncoding,
} from "@connext/types";
import {
  appIdentityToHash,
  bigNumberifyJson,
  deBigNumberifyJson,
  getSignerAddressFromPublicIdentifier,
  isBN,
  stringify,
  toBN,
  keyify
} from "@connext/utils";
import { BigNumber, Contract, constants, utils, providers } from "ethers";

import { execEvmBytecode } from "../pure-evm";
import { CounterfactualApp } from "../contracts";

const { Zero } = constants;
const { defaultAbiCoder, keccak256, Interface } = utils;

const appInterface = new Interface(CounterfactualApp.abi);

/**
 * Representation of an AppInstance.
 *
 * @property participants The sorted array of public keys used by the users of
 *           this AppInstance for which n-of-n consensus is needed on updates.

 * @property defaultTimeout The default timeout used when a new update is made.

 * @property latestState The unencoded representation of the latest state.

 * @property latestVersionNumber The versionNumber of the latest signed state update.

 * @property stateTimeout The timeout used in the latest signed state update.

 * @property multiAssetMultiPartyCoinTransferInterpreterParams The limit / maximum amount of funds
 *           to be distributed for an app where the interpreter type is COIN_TRANSFER

 * @property twoPartyOutcomeInterpreterParams Addresses of the two beneficiaries
 *           and the amount that is to be distributed for an app
 *           where the interpreter type is TWO_PARTY_FIXED_OUTCOME
 */
export class AppInstance {
  constructor(
    public readonly multisigAddress: string,
    public readonly initiatorIdentifier: PublicIdentifier,
    public readonly initiatorDeposit: DecString,
    public readonly initiatorDepositAssetId: AssetId,
    public readonly responderIdentifier: PublicIdentifier,
    public readonly responderDeposit: DecString,
    public readonly responderDepositAssetId: AssetId,
    public readonly abiEncodings: AppABIEncodings,
    public readonly appDefinition: Address,
    public readonly appSeqNo: number, // channel nonce at app proposal
    public readonly latestState: any,
    public readonly latestVersionNumber: number, // app nonce
    public readonly defaultTimeout: HexString,
    public readonly stateTimeout: HexString,
    public readonly outcomeType: OutcomeType,
    private readonly outcomeInterpreterParametersInternal:
      | TwoPartyFixedOutcomeInterpreterParams
      | MultiAssetMultiPartyCoinTransferInterpreterParams
      | SingleAssetTwoPartyCoinTransferInterpreterParams,
    public readonly meta?: any,
    public readonly latestAction?: any,
  ) {}

  get outcomeInterpreterParameters() {
    return this.outcomeInterpreterParametersInternal!;
  }

  public static fromJson(json: AppInstanceJson) {
    const deserialized = bigNumberifyJson<AppInstanceJson>(json);

    return new AppInstance(
      deserialized.multisigAddress,
      deserialized.initiatorIdentifier,
      deserialized.initiatorDeposit,
      deserialized.initiatorDepositAssetId,
      deserialized.responderIdentifier,
      deserialized.responderDeposit,
      deserialized.responderDepositAssetId,
      deserialized.abiEncodings,
      deserialized.appDefinition,
      deserialized.appSeqNo, // channel nonce at app proposal
      deserialized.latestState,
      deserialized.latestVersionNumber, // app nonce
      deserialized.defaultTimeout,
      deserialized.stateTimeout,
      deserialized.outcomeType,
      bigNumberifyJson(deserialized.outcomeInterpreterParameters),
      deserialized.meta,
      deserialized.latestAction,
    );
  }

  public toJson(): AppInstanceJson {
    // removes any fields which have an `undefined` value, as that's invalid JSON
    // an example would be having an `undefined` value for the `actionEncoding`
    // of an AppInstance that's not turn based
    return deBigNumberifyJson({
      abiEncodings: this.abiEncodings,
      appDefinition: this.appDefinition,
      appSeqNo: this.appSeqNo,
      defaultTimeout: this.defaultTimeout,
      identityHash: this.identityHash,
      initiatorDeposit: this.initiatorDeposit,
      initiatorDepositAssetId: this.initiatorDepositAssetId,
      initiatorIdentifier: this.initiatorIdentifier,
      latestAction: this.latestAction,
      latestState: this.latestState,
      latestVersionNumber: this.latestVersionNumber,
      meta: this.meta,
      multisigAddress: this.multisigAddress,
      outcomeInterpreterParameters: this.outcomeInterpreterParametersInternal,
      outcomeType: this.outcomeType,
      responderDeposit: this.responderDeposit,
      responderDepositAssetId: this.responderDepositAssetId,
      responderIdentifier: this.responderIdentifier,
      stateTimeout: this.stateTimeout,
    });
  }

  public get identityHash() {
    return appIdentityToHash(this.identity);
  }

  public get participants() {
    return [
      getSignerAddressFromPublicIdentifier(this.initiatorIdentifier),
      getSignerAddressFromPublicIdentifier(this.responderIdentifier),
    ];
  }

  public get identity(): AppIdentity {
    return {
      participants: this.participants,
      multisigAddress: this.multisigAddress,
      appDefinition: this.appDefinition,
      defaultTimeout: toBN(this.defaultTimeout),
      channelNonce: toBN(this.appSeqNo),
    };
  }

  public get hashOfLatestState() {
    return keccak256(this.encodedLatestState);
  }

  public get encodedLatestState() {
    return defaultAbiCoder.encode([this.abiEncodings.stateEncoding], [this.latestState]);
  }

  public get encodedInterpreterParams() {
    switch (this.outcomeType) {
      case OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER: {
        return defaultAbiCoder.encode(
          [singleAssetTwoPartyCoinTransferInterpreterParamsEncoding],
          [this.outcomeInterpreterParametersInternal],
        );
      }

      case OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER: {
        return defaultAbiCoder.encode(
          [multiAssetMultiPartyCoinTransferInterpreterParamsEncoding],
          [this.outcomeInterpreterParametersInternal],
        );
      }

      case OutcomeType.TWO_PARTY_FIXED_OUTCOME: {
        return defaultAbiCoder.encode(
          [twoPartyFixedOutcomeInterpreterParamsEncoding],
          [this.outcomeInterpreterParametersInternal],
        );
      }

      default: {
        throw new Error(
          `The outcome type in this application logic contract is not supported yet. Outcome type: ${this.outcomeType}, expected one of: ${OutcomeType.TWO_PARTY_FIXED_OUTCOME}, ${OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER}, or ${OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER}`,
        );
      }
    }
  }

  public get state() {
    return this.latestState;
  }

  public get versionNumber() {
    return this.latestVersionNumber;
  }

  public get timeout() {
    return this.stateTimeout;
  }

  public setState(newState: SolidityValueType, stateTimeout: BigNumber = Zero) {
    try {
      defaultAbiCoder.encode([this.abiEncodings.stateEncoding], [newState]);
    } catch (e) {
      // TODO: Catch ethers.errors.INVALID_ARGUMENT specifically in catch {}

      throw new Error(
        `Attempted to setState on an app with an invalid state object.
          - appIdentityHash = ${this.identityHash}
          - newState = ${stringify(newState)}
          - encodingExpected = ${this.abiEncodings.stateEncoding}
          Error: ${e.message}`,
      );
    }

    return AppInstance.fromJson({
      ...this.toJson(),
      latestState: newState,
      latestVersionNumber: this.versionNumber + 1,
      latestAction: undefined,
      // any time you set app state, you should remove
      // any existing actions from previous states
      stateTimeout: stateTimeout.toHexString(),
    });
  }

  public setAction(action: SolidityValueType) {
    if (!this.abiEncodings.actionEncoding) {
      throw new Error(`Cannot set an action without providing an encoding`);
    }
    try {
      defaultAbiCoder.encode([this.abiEncodings.actionEncoding], [action]);
    } catch (e) {
      // TODO: Catch ethers.errors.INVALID_ARGUMENT specifically in catch {}

      throw new Error(
        `Attempted to setAction on an app with an invalid state object.
          - appIdentityHash = ${this.identityHash}
          - action = ${stringify(action)}
          - encodingExpected = ${this.abiEncodings.stateEncoding}
          Error: ${e.message}`,
      );
    }

    return AppInstance.fromJson({
      ...this.toJson(),
      latestAction: action,
    });
  }

  public async computeOutcome(
    state: SolidityValueType,
    provider: providers.JsonRpcProvider,
    bytecode?: HexString,
  ): Promise<string> {
    if (bytecode) {
      try {
        const functionData = appInterface.encodeFunctionData("computeOutcome", [
          this.encodedLatestState,
        ]);
        const output = await execEvmBytecode(bytecode, functionData);
        return appInterface.decodeFunctionResult("computeOutcome", output)[0];
      } catch (e) {
        return this.toEthersContract(provider).computeOutcome(this.encodeState(state));
      }
    } else {
      return this.toEthersContract(provider).computeOutcome(this.encodeState(state));
    }
  }

  public async isStateTerminal(
    state: SolidityValueType,
    provider: providers.JsonRpcProvider,
  ): Promise<string> {
    return this.toEthersContract(provider).isStateTerminal(this.encodeState(state));
  }

  public async computeOutcomeWithCurrentState(
    provider: providers.JsonRpcProvider,
    bytecode?: HexString,
  ): Promise<string> {
    return this.computeOutcome(this.state, provider, bytecode);
  }

  public async computeTurnTaker(
    provider: providers.JsonRpcProvider,
    bytecode?: HexString,
  ): Promise<string> {
    let turnTaker: undefined | string = undefined;
    // attempt evm if available
    if (bytecode) {
      try {
        const functionData = appInterface.encodeFunctionData("getTurnTaker", [
          this.encodedLatestState,
          this.participants,
        ]);
        const output = await execEvmBytecode(bytecode, functionData);
        turnTaker = appInterface.decodeFunctionResult("getTurnTaker", output)[0];
      } catch (e) {}
    }
    if (turnTaker) {
      return turnTaker;
    }
    // otherwise, if err or if no bytecode, execute read fn
    turnTaker = (await this.toEthersContract(provider).getTurnTaker(
      this.encodedLatestState,
      this.participants,
    )) as string;
    return turnTaker;
  }

  public async isCorrectTurnTaker(
    attemptedTurnTaker: string,
    provider: providers.JsonRpcProvider,
    bytecode?: HexString,
  ) {
    const turnTaker = await this.computeTurnTaker(provider, bytecode);
    return attemptedTurnTaker === turnTaker;
  }

  public async computeStateTransition(
    actionTaker: Address,
    action: SolidityValueType,
    provider: providers.JsonRpcProvider,
    bytecode?: HexString,
  ): Promise<SolidityValueType> {
    let computedNextState: SolidityValueType;
    const turnTaker = await this.computeTurnTaker(provider, bytecode);
    if (actionTaker !== turnTaker) {
      throw new Error(
        `Cannot compute state transition, got invalid turn taker for action on app at ${this.appDefinition}. Expected ${turnTaker}, got ${actionTaker}`,
      );
    }
    if (bytecode) {
      try {
        const functionData = appInterface.encodeFunctionData("applyAction", [
          this.encodedLatestState,
          this.encodeAction(action),
        ]);
        const output = await execEvmBytecode(bytecode, functionData);
        computedNextState = this.decodeAppState(
          appInterface.decodeFunctionResult("applyAction", output)[0],
        );
      } catch (e) {
        const encoded = await this.toEthersContract(provider).applyAction(
          this.encodedLatestState,
          this.encodeAction(action),
        );
        computedNextState = this.decodeAppState(encoded);
      }
    } else {
      const encoded = await this.toEthersContract(provider).applyAction(
        this.encodedLatestState,
        this.encodeAction(action),
      );
      computedNextState = this.decodeAppState(encoded);
    }

    const keyified = keyify(this.state, computedNextState);
    return bigNumberifyJson(keyified);
  }

  public encodeAction(action: SolidityValueType) {
    return defaultAbiCoder.encode([this.abiEncodings.actionEncoding!], [action]);
  }

  public encodeState(state: SolidityValueType) {
    return defaultAbiCoder.encode([this.abiEncodings.stateEncoding], [state]);
  }

  public decodeAppState(encodedSolidityValueType: string): SolidityValueType {
    return defaultAbiCoder.decode([this.abiEncodings.stateEncoding], encodedSolidityValueType)[0];
  }

  public toEthersContract(provider: providers.JsonRpcProvider) {
    return new Contract(this.appDefinition, CounterfactualApp.abi, provider);
  }
}
