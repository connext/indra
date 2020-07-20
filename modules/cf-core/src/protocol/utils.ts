import { artifacts } from "@connext/contracts";
import {
  Address,
  AssetId,
  ContractAddresses,
  HexString,
  ILoggerService,
  IStoreService,
  multiAssetMultiPartyCoinTransferEncoding,
  MultiAssetMultiPartyCoinTransferInterpreterParams,
  NetworkContext,
  OutcomeType,
  PureActionApps,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  TwoPartyFixedOutcome,
  TwoPartyFixedOutcomeInterpreterParams,
  ProtocolMessageData,
  ProtocolName,
  PublicIdentifier,
  CHANNEL_PROTOCOL_VERSION,
  ProtocolParam,
  ProtocolMessage,
} from "@connext/types";
import {
  logTime,
  recoverAddressFromChannelMessage,
  getAddressFromAssetId,
  stringify,
} from "@connext/utils";
import { BigNumber, utils, constants } from "ethers";

import {
  AppInstance,
  CoinTransfer,
  convertCoinTransfersToCoinTransfersMap,
  TokenIndexedCoinTransferMap,
  StateChannel,
} from "../models";
import { NO_STATE_CHANNEL_FOR_MULTISIG_ADDR, TWO_PARTY_OUTCOME_DIFFERENT_ASSETS } from "../errors";

const { MaxUint256 } = constants;
const { defaultAbiCoder, getAddress } = utils;

export const parseProtocolMessage = (message?: ProtocolMessage): ProtocolMessage => {
  const { data, type, from } = message || {};
  const {
    to,
    protocol,
    processID,
    seq,
    params,
    error,
    prevMessageReceived,
    customData,
    protocolVersion,
  } = data || {};

  // verify the correct protocol version
  // FIXME: remove when types package is published
  const toCompare = CHANNEL_PROTOCOL_VERSION || "1.0.0";
  if (!protocolVersion || protocolVersion !== toCompare) {
    throw new Error(
      `Incorrect protocol version number detected. Got ${protocolVersion}, expected: ${toCompare}. Please update packages. Message payload: ${stringify(
        data,
      )}`,
    );
  }

  // check that all mandatory fields are properly defined
  const exists = (x: any) => x !== undefined && x !== null;
  if (!exists(data) || !exists(type) || !exists(from)) {
    throw new Error(
      `Malformed message, missing one of the following fields: data, from, type. Message: ${stringify(
        message,
        false,
        1,
      )}`,
    );
  }

  if (
    !exists(to) ||
    !exists(protocol) ||
    !exists(processID) ||
    !exists(seq) ||
    !exists(params) ||
    !exists(customData)
  ) {
    throw new Error(
      `Malformed protocol message data, missing one of the following fields within the data object: to, protocol, processID, seq, params, customData. Message: ${stringify(
        message?.data,
        false,
        1,
      )}`,
    );
  }

  return {
    type: type!,
    from: from!,
    data: {
      processID: processID!, // uuid
      protocol: protocol!,
      protocolVersion,
      params: params!,
      to: to!,
      error,
      seq: seq!,
      // protocol responders should not send messages + error if the protocol
      // timeout has elapsed during their execution. this edgecase
      // is handled within the IO_SEND opcode for the final protocol message,
      // and by default when using IO_SEND_AND_WAIT
      prevMessageReceived,
      // customData: Additional data which depends on the protocol (or even the specific message
      // number in a protocol) lives here. Includes signatures
      customData: customData!,
    },
  };
};

export const generateProtocolMessageData = (
  to: PublicIdentifier,
  protocol: ProtocolName,
  processID: string,
  seq: number,
  params: ProtocolParam,
  messageData: Partial<{
    error: string;
    prevMessageReceived: number;
    customData: { [key: string]: any };
  }> = {},
): ProtocolMessageData => {
  const { error, prevMessageReceived, customData } = messageData;
  return {
    processID, // uuid
    protocol,
    // FIXME: remove optional default after publishing
    protocolVersion: CHANNEL_PROTOCOL_VERSION || "1.0.0",
    params,
    to,
    error,
    seq,
    // protocol responders should not send messages + error if the protocol
    // timeout has elapsed during their execution. this edgecase
    // is handled within the IO_SEND opcode for the final protocol message,
    // and by default when using IO_SEND_AND_WAIT
    prevMessageReceived,
    // customData: Additional data which depends on the protocol (or even the specific message
    // number in a protocol) lives here. Includes signatures
    customData: customData || {},
  };
};

export const getPureBytecode = (
  appDefinition: Address,
  contractAddresses: ContractAddresses,
): HexString | undefined => {
  // If this app's action is pure, provide bytecode to use for faster in-memory evm calls
  const appEntry = Object.entries(contractAddresses).find((entry) => entry[1] === appDefinition);
  const bytecode =
    appEntry && appEntry[0] && PureActionApps && PureActionApps.includes(appEntry[0])
      ? artifacts[appEntry[0]].deployedBytecode
      : undefined;
  return bytecode;
};

export async function assertIsValidSignature(
  expectedSigner: string,
  commitmentHash?: string,
  signature?: string,
  loggingContext?: string,
): Promise<void> {
  if (typeof commitmentHash === "undefined") {
    throw new Error(
      `assertIsValidSignature received an undefined commitment. ${
        loggingContext ? `${loggingContext}` : ""
      }`,
    );
  }
  if (typeof signature === "undefined") {
    throw new Error(
      `assertIsValidSignature received an undefined signature. ${
        loggingContext ? `${loggingContext}` : ""
      }`,
    );
  }
  // recoverAddressFromChannelMessage: 83 ms, hashToSign: 7 ms
  const signer = await recoverAddressFromChannelMessage(commitmentHash, signature);
  if (getAddress(expectedSigner).toLowerCase() !== signer.toLowerCase()) {
    throw new Error(
      `Validating a signature with expected signer ${expectedSigner} but recovered ${signer} for commitment hash ${commitmentHash}. ${
        loggingContext ? `${loggingContext}` : ""
      }`,
    );
  }
}

export async function stateChannelClassFromStoreByMultisig(
  multisigAddress: string,
  store: IStoreService,
) {
  const json = await store.getStateChannel(multisigAddress);
  if (!json) {
    throw new Error(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(multisigAddress));
  }
  return StateChannel.fromJson(json);
}

/**
 * Get the outcome of the app instance given, decode it according
 * to the outcome type stored in the app instance model, and return
 * a value uniformly across outcome type and whether the app is virtual
 * or direct. This return value must not contain the intermediary.
 */
export async function computeTokenIndexedFreeBalanceIncrements(
  appInstance: AppInstance,
  network: NetworkContext,
  encodedOutcomeOverride: string = "",
  log?: ILoggerService,
): Promise<TokenIndexedCoinTransferMap> {
  const { outcomeType } = appInstance;

  const checkpoint = Date.now();
  if (!encodedOutcomeOverride || encodedOutcomeOverride === "") {
    try {
      encodedOutcomeOverride = await appInstance.computeOutcomeWithCurrentState(
        network.provider,
        getPureBytecode(appInstance.appDefinition, network.contractAddresses),
      );
    } catch (e) {
      throw new Error(`Unable to compute outcome: ${e.stack || e.message}`);
    }
  }
  const encodedOutcome = encodedOutcomeOverride;

  if (log) logTime(log, checkpoint, `Computed outcome with current state`);

  switch (outcomeType) {
    case OutcomeType.TWO_PARTY_FIXED_OUTCOME: {
      return handleTwoPartyFixedOutcome(
        encodedOutcome,
        appInstance.outcomeInterpreterParameters as TwoPartyFixedOutcomeInterpreterParams,
      );
    }
    case OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER: {
      return handleSingleAssetTwoPartyCoinTransfer(
        encodedOutcome,
        appInstance.outcomeInterpreterParameters as SingleAssetTwoPartyCoinTransferInterpreterParams,
      );
    }
    case OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER: {
      return handleMultiAssetMultiPartyCoinTransfer(
        encodedOutcome,
        appInstance.outcomeInterpreterParameters as MultiAssetMultiPartyCoinTransferInterpreterParams,
      );
    }
    default: {
      throw new Error(
        `computeTokenIndexedFreeBalanceIncrements received an AppInstance with unknown OutcomeType: ${outcomeType}`,
      );
    }
  }
}

function handleTwoPartyFixedOutcome(
  encodedOutcome: string,
  interpreterParams: TwoPartyFixedOutcomeInterpreterParams,
): TokenIndexedCoinTransferMap {
  const { amount, playerAddrs, tokenAddress } = interpreterParams;

  switch (decodeTwoPartyFixedOutcome(encodedOutcome)) {
    case TwoPartyFixedOutcome.SEND_TO_ADDR_ONE:
      return {
        [tokenAddress]: {
          [playerAddrs[0]]: amount,
        },
      };
    case TwoPartyFixedOutcome.SEND_TO_ADDR_TWO:
      return {
        [tokenAddress]: {
          [playerAddrs[1]]: amount,
        },
      };
    case TwoPartyFixedOutcome.SPLIT_AND_SEND_TO_BOTH_ADDRS:
    default:
      return {
        [tokenAddress]: {
          [playerAddrs[0]]: amount.div(2),
          [playerAddrs[1]]: amount.sub(amount.div(2)),
        },
      };
  }
}

function handleMultiAssetMultiPartyCoinTransfer(
  encodedOutcome: string,
  interpreterParams: MultiAssetMultiPartyCoinTransferInterpreterParams,
): TokenIndexedCoinTransferMap {
  const decodedTransfers = decodeMultiAssetMultiPartyCoinTransfer(encodedOutcome);

  return interpreterParams.tokenAddresses.reduce(
    (acc, tokenAddress, index) => ({
      ...acc,
      [tokenAddress]: convertCoinTransfersToCoinTransfersMap(decodedTransfers[index]),
    }),
    {},
  );
}

function handleSingleAssetTwoPartyCoinTransfer(
  encodedOutcome: string,
  interpreterParams: SingleAssetTwoPartyCoinTransferInterpreterParams,
): TokenIndexedCoinTransferMap {
  const { tokenAddress } = interpreterParams;

  // 0ms
  const [
    { to: to1, amount: amount1 },
    { to: to2, amount: amount2 },
  ] = decodeSingleAssetTwoPartyCoinTransfer(encodedOutcome);

  return {
    [tokenAddress]: {
      [to1 as string]: amount1 as BigNumber,
      [to2 as string]: amount2 as BigNumber,
    },
  };
}

function decodeTwoPartyFixedOutcome(encodedOutcome: string): TwoPartyFixedOutcome {
  const [twoPartyFixedOutcome] = defaultAbiCoder.decode(["uint256"], encodedOutcome) as [BigNumber];

  return twoPartyFixedOutcome.toNumber();
}

function decodeSingleAssetTwoPartyCoinTransfer(
  encodedOutcome: string,
): [CoinTransfer, CoinTransfer] {
  const [[[to1, amount1], [to2, amount2]]] = defaultAbiCoder.decode(
    ["tuple(address to, uint256 amount)[2]"],
    encodedOutcome,
  );

  return [
    { to: to1, amount: amount1 },
    { to: to2, amount: amount2 },
  ];
}

function decodeMultiAssetMultiPartyCoinTransfer(encodedOutcome: string): CoinTransfer[][] {
  const [coinTransferListOfLists] = defaultAbiCoder.decode(
    [multiAssetMultiPartyCoinTransferEncoding],
    encodedOutcome,
  );

  return coinTransferListOfLists.map((coinTransferList) =>
    coinTransferList.map(({ to, amount }) => ({ to, amount })),
  );
}

/**
 * Returns the parameters for two hard-coded possible interpreter types.
 *
 * Note that this is _not_ a built-in part of the protocol. Here we are _restricting_
 * all newly installed AppInstances to be either of type COIN_TRANSFER or
 * TWO_PARTY_FIXED_OUTCOME. In the future, we will be extending the ProtocolParams.Install
 * to indidicate the interpreterAddress and interpreterParams so the developers
 * installing apps have more control, however for now we are putting this logic
 * inside of the client (the Node) by adding an "outcomeType" variable which
 * is a simplification of the actual decision a developer has to make with their app.
 *
 * TODO: update doc on how MultiAssetMultiPartyCoinTransferInterpreterParams work
 *
 * @param {OutcomeType} outcomeType - either COIN_TRANSFER or TWO_PARTY_FIXED_OUTCOME
 * @param {utils.BigNumber} initiatorBalanceDecrement - amount Wei initiator deposits
 * @param {utils.BigNumber} responderBalanceDecrement - amount Wei responder deposits
 * @param {string} initiatorFbAddress - the address of the recipient of initiator
 * @param {string} responderFbAddress - the address of the recipient of responder
 *
 * @returns An object with the required parameters for both interpreter types, one
 * will be undefined and the other will be a correctly structured POJO. The AppInstance
 * object currently accepts both in its constructor and internally manages them.
 */
export function computeInterpreterParameters(
  multisigOwners: string[],
  outcomeType: OutcomeType,
  initiatorAssetId: AssetId,
  responderAssetId: AssetId,
  initiatorBalanceDecrement: BigNumber,
  responderBalanceDecrement: BigNumber,
  initiatorFbAddress: string,
  responderFbAddress: string,
  disableLimit: boolean,
):
  | TwoPartyFixedOutcomeInterpreterParams
  | MultiAssetMultiPartyCoinTransferInterpreterParams
  | SingleAssetTwoPartyCoinTransferInterpreterParams {
  const initiatorDepositAssetId = getAddressFromAssetId(initiatorAssetId);
  const responderDepositAssetId = getAddressFromAssetId(responderAssetId);
  // make sure the interpreter params ordering corr. with the fb
  const sameOrder = initiatorFbAddress === multisigOwners[0];
  switch (outcomeType) {
    case OutcomeType.TWO_PARTY_FIXED_OUTCOME: {
      if (initiatorDepositAssetId !== responderDepositAssetId) {
        throw new Error(
          TWO_PARTY_OUTCOME_DIFFERENT_ASSETS(initiatorDepositAssetId, responderDepositAssetId),
        );
      }

      return {
        tokenAddress: initiatorDepositAssetId,
        playerAddrs: sameOrder
          ? [initiatorFbAddress, responderFbAddress]
          : [responderFbAddress, initiatorFbAddress],
        amount: initiatorBalanceDecrement.add(responderBalanceDecrement),
      };
    }
    case OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER: {
      if (initiatorDepositAssetId === responderDepositAssetId) {
        return {
          limit: [initiatorBalanceDecrement.add(responderBalanceDecrement)],
          tokenAddresses: [initiatorDepositAssetId],
        };
      }
      const limit = sameOrder
        ? [initiatorBalanceDecrement, responderBalanceDecrement]
        : [responderBalanceDecrement, initiatorBalanceDecrement];
      const tokenAddresses = sameOrder
        ? [initiatorDepositAssetId, responderDepositAssetId]
        : [responderDepositAssetId, initiatorDepositAssetId];
      return {
        limit,
        tokenAddresses,
      };
    }

    case OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER: {
      if (initiatorDepositAssetId !== responderDepositAssetId) {
        throw new Error(
          TWO_PARTY_OUTCOME_DIFFERENT_ASSETS(initiatorDepositAssetId, responderDepositAssetId),
        );
      }

      return {
        limit: disableLimit ? MaxUint256 : initiatorBalanceDecrement.add(responderBalanceDecrement),
        tokenAddress: initiatorDepositAssetId,
      };
    }

    default: {
      throw new Error("The outcome type in this application logic contract is not supported yet.");
    }
  }
}
