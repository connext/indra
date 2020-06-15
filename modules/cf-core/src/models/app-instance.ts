import {
  AppIdentity,
  AppInstanceJson,
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
  DecString,
  AssetId,
  AppABIEncodings,
  Address,
} from "@connext/types";
import {
  appIdentityToHash,
  bigNumberifyJson,
  deBigNumberifyJson,
  getSignerAddressFromPublicIdentifier,
  isBN,
  stringify,
  toBN,
} from "@connext/utils";
import { BigNumber, Contract, constants, utils, providers } from "ethers";
import { Memoize } from "typescript-memoize";

import { CounterfactualApp } from "../contracts";

const { Zero } = constants;
const { defaultAbiCoder, keccak256 } = utils;
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
      multisigAddress: this.multisigAddress,
      identityHash: this.identityHash,
      initiatorIdentifier: this.initiatorIdentifier,
      initiatorDeposit: this.initiatorDeposit,
      initiatorDepositAssetId: this.initiatorDepositAssetId,
      responderIdentifier: this.responderIdentifier,
      responderDeposit: this.responderDeposit,
      responderDepositAssetId: this.responderDepositAssetId,
      abiEncodings: this.abiEncodings,
      appDefinition: this.appDefinition,
      appSeqNo: this.appSeqNo,
      defaultTimeout: this.defaultTimeout,
      stateTimeout: this.stateTimeout,
      latestState: this.latestState,
      latestVersionNumber: this.latestVersionNumber,
      outcomeType: this.outcomeType,
      meta: this.meta,
      latestAction: this.latestAction,
      outcomeInterpreterParameters: this.outcomeInterpreterParametersInternal,
    });
  }

  @Memoize()
  public get identityHash() {
    return appIdentityToHash(this.identity);
  }

  @Memoize()
  public get participants() {
    return [
      getSignerAddressFromPublicIdentifier(this.initiatorIdentifier),
      getSignerAddressFromPublicIdentifier(this.responderIdentifier),
    ];
  }

  @Memoize()
  public get identity(): AppIdentity {
    return {
      participants: this.participants,
      multisigAddress: this.multisigAddress,
      appDefinition: this.appDefinition,
      defaultTimeout: toBN(this.defaultTimeout),
      channelNonce: toBN(this.appSeqNo),
    };
  }

  @Memoize()
  public get hashOfLatestState() {
    return keccak256(this.encodedLatestState);
  }

  @Memoize()
  public get encodedLatestState() {
    return defaultAbiCoder.encode([this.abiEncodings.stateEncoding], [this.latestState]);
  }

  @Memoize()
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
  ): Promise<string> {
    return this.toEthersContract(provider).computeOutcome(this.encodeState(state));
  }

  public async isStateTerminal(
    state: SolidityValueType,
    provider: providers.JsonRpcProvider,
  ): Promise<string> {
    return this.toEthersContract(provider).isStateTerminal(this.encodeState(state));
  }

  public async computeOutcomeWithCurrentState(
    provider: providers.JsonRpcProvider,
  ): Promise<string> {
    return this.computeOutcome(this.state, provider);
  }

  public async computeStateTransition(
    action: SolidityValueType,
    provider: providers.JsonRpcProvider,
  ): Promise<SolidityValueType> {
    const encoded = await this.toEthersContract(provider).applyAction(
      this.encodedLatestState,
      this.encodeAction(action),
    );
    const computedNextState = this.decodeAppState(encoded);

    // ethers returns an array of [ <each value by index>, <each value by key> ]
    // so we need to recursively clean this response before returning
    const keyify = (templateObj: any, dataObj: any, key?: string): Promise<any> => {
      const template = key ? templateObj[key] : templateObj;
      const data = key ? dataObj[key] : dataObj;
      let output;
      if (isBN(template) || typeof template !== "object") {
        output = data;
      } else if (typeof template === "object" && typeof template.length === "number") {
        output = [];
        for (const index in template) {
          output.push(keyify(template, data, index));
        }
      } else if (typeof template === "object" && typeof template.length !== "number") {
        output = {};
        for (const subkey in template) {
          output[subkey] = keyify(template, data, subkey);
        }
      } else {
        throw new Error(`Couldn't keyify, unrecogized key/value: ${key}/${data}`);
      }
      return output;
    };

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
