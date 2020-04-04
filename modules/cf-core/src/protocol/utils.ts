import { IStoreService, ILoggerService } from "@connext/types";
import { recoverAddress } from "@connext/crypto";
import { JsonRpcProvider } from "ethers/providers";
import { BigNumber, defaultAbiCoder, getAddress } from "ethers/utils";

import {
  AppInstance,
  CoinTransfer,
  convertCoinTransfersToCoinTransfersMap,
  TokenIndexedCoinTransferMap,
  StateChannel,
} from "../models";
import {
  multiAssetMultiPartyCoinTransferEncoding,
  MultiAssetMultiPartyCoinTransferInterpreterParams,
  OutcomeType,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  TwoPartyFixedOutcome,
  TwoPartyFixedOutcomeInterpreterParams,
} from "../types";
import { NO_STATE_CHANNEL_FOR_MULTISIG_ADDR } from "../errors";
import { logTime } from "../utils";

export async function assertIsValidSignature(
  expectedSigner: string,
  commitmentHash?: string,
  signature?: string,
): Promise<void> {
  if (typeof commitmentHash === "undefined") {
    throw new Error("assertIsValidSignature received an undefined commitment");
  }
  if (typeof signature === "undefined") {
    throw new Error("assertIsValidSignature received an undefined signature");
  }
  // recoverAddress: 83 ms, hashToSign: 7 ms
  const signer = await recoverAddress(commitmentHash, signature);
  if (getAddress(expectedSigner).toLowerCase() !== signer.toLowerCase()) {
    throw new Error(
      `Validating a signature with expected signer ${expectedSigner} but recovered ${signer} for commitment hash ${commitmentHash}.`,
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
  provider: JsonRpcProvider,
  encodedOutcomeOverride: string = "",
  blockNumberToUseIfNecessary?: number,
  log?: ILoggerService,
): Promise<TokenIndexedCoinTransferMap> {
  const { outcomeType } = appInstance;

  let checkpoint = Date.now();
  if (!encodedOutcomeOverride || encodedOutcomeOverride === "") {
    try {
      encodedOutcomeOverride = await appInstance.computeOutcomeWithCurrentState(provider);
    } catch (e) {
      throw new Error(`Unable to compute outcome: ${e.stack || e.message}`);
    }
  };
  const encodedOutcome = encodedOutcomeOverride;

  if (log) logTime(log, checkpoint, `Computed outcome with current state`);

  switch (outcomeType) {
    case OutcomeType.TWO_PARTY_FIXED_OUTCOME: {
      return handleTwoPartyFixedOutcome(
        encodedOutcome,
        appInstance.twoPartyOutcomeInterpreterParams,
      );
    }
    case OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER: {
      return handleSingleAssetTwoPartyCoinTransfer(
        encodedOutcome,
        appInstance.singleAssetTwoPartyCoinTransferInterpreterParams,
        log,
      );
    }
    case OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER: {
      return handleMultiAssetMultiPartyCoinTransfer(
        encodedOutcome,
        appInstance.multiAssetMultiPartyCoinTransferInterpreterParams,
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
  log?: ILoggerService,
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

function decodeRefundAppState(encodedOutcome: string): [CoinTransfer] {
  const [[{ to, amount }]] = defaultAbiCoder.decode(
    ["tuple(address to, uint256 amount)[2]"],
    encodedOutcome,
  );

  return [{ to, amount }];
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

  return coinTransferListOfLists.map(coinTransferList =>
    coinTransferList.map(({ to, amount }) => ({ to, amount })),
  );
}
