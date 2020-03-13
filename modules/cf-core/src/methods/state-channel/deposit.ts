import {
  DEPOSIT_CONFIRMED_EVENT,
  DEPOSIT_STARTED_EVENT,
  DEPOSIT_FAILED_EVENT,
} from "@connext/types";
import { Contract } from "ethers";
import { Zero } from "ethers/constants";
import { BaseProvider, TransactionRequest, TransactionResponse } from "ethers/providers";
import { BigNumber, bigNumberify } from "ethers/utils";
import { jsonRpcMethod } from "rpc-server";

import {
  CANNOT_DEPOSIT,
  COIN_BALANCE_NOT_PROPOSED,
  DEPOSIT_FAILED,
  FAILED_TO_GET_ERC20_BALANCE,
  INCORRECT_MULTISIG_ADDRESS,
  INSUFFICIENT_ERC20_FUNDS_TO_DEPOSIT,
  INSUFFICIENT_FUNDS,
  INVALID_FACTORY_ADDRESS,
  INVALID_MASTERCOPY_ADDRESS,
  NOT_YOUR_BALANCE_REFUND_APP,
} from "../../errors";
import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../constants";
import { ERC20 } from "../../contracts";
import { StateChannel } from "../../models";
import { RequestHandler } from "../../request-handler";
import {
  AppInterface,
  CoinBalanceRefundAppState,
  coinBalanceRefundAppStateEncoding,
  DepositConfirmationMessage,
  DepositFailedMessage,
  DepositParams,
  DepositResult,
  InstallProtocolParams,
  MethodNames,
  MethodParams,
  MethodResult,
  NetworkContext,
  OutcomeType,
  Protocol,
  SolidityValueType,
} from "../../types";
import { logTime, getCreate2MultisigAddress } from "../../utils";
import { xkeyKthAddress } from "../../xkeys";

import { NodeController } from "../controller";

const DEPOSIT_RETRY_COUNT = 3;

interface DepositContext {
  initialState: SolidityValueType;
  appInterface: AppInterface;
}

export class DepositController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_deposit)
  public executeMethod: (
    requestHandler: RequestHandler,
    params: MethodParams,
  ) => Promise<MethodResult> = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: DepositParams,
  ): Promise<string[]> {
    return [params.multisigAddress];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: DepositParams,
  ): Promise<void> {
    const { store, provider, networkContext } = requestHandler;
    const { multisigAddress, amount, tokenAddress: tokenAddressParam } = params;

    const tokenAddress = tokenAddressParam || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    const channel = await store.getStateChannel(multisigAddress);

    if (!channel.addresses.proxyFactory) {
      throw Error(INVALID_FACTORY_ADDRESS(channel.addresses.proxyFactory));
    }

    if (!channel.addresses.multisigMastercopy) {
      throw Error(INVALID_MASTERCOPY_ADDRESS(channel.addresses.multisigMastercopy));
    }

    const expectedMultisigAddress = await getCreate2MultisigAddress(
      channel.userNeuteredExtendedKeys,
      channel.addresses,
      provider,
    );

    if (expectedMultisigAddress !== channel.multisigAddress) {
      throw Error(INCORRECT_MULTISIG_ADDRESS);
    }

    if (channel.hasBalanceRefundAppInstance(networkContext.CoinBalanceRefundApp, tokenAddress)) {
      throw Error(CANNOT_DEPOSIT);
    }

    if (
      !channel.hasProposedBalanceRefundAppInstance(
        networkContext.CoinBalanceRefundApp,
        tokenAddress,
      )
    ) {
      throw Error(COIN_BALANCE_NOT_PROPOSED);
    }

    const address = await requestHandler.getSignerAddress();

    if (tokenAddress !== CONVENTION_FOR_ETH_TOKEN_ADDRESS) {
      const contract = new Contract(tokenAddress, ERC20.abi, provider);

      let balance: BigNumber;
      try {
        balance = await contract.functions.balanceOf(address);
      } catch (e) {
        throw Error(FAILED_TO_GET_ERC20_BALANCE(tokenAddress, address));
      }

      if (balance.lt(amount)) {
        throw Error(INSUFFICIENT_ERC20_FUNDS_TO_DEPOSIT(address, tokenAddress, amount, balance));
      }
    } else {
      const balanceOfSigner = await provider.getBalance(address);

      if (balanceOfSigner.lt(amount)) {
        throw Error(`${INSUFFICIENT_FUNDS}: ${address}`);
      }
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: DepositParams,
  ): Promise<DepositResult> {
    const { outgoing, provider } = requestHandler;
    const { multisigAddress, tokenAddress } = params;

    params.tokenAddress = tokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    await installBalanceRefundApp(requestHandler, params);
    const depositTxHash = await makeDeposit(requestHandler, params);
    await uninstallBalanceRefundApp(requestHandler, params);

    // send deposit confirmation to counter party _after_ the balance refund
    // app is installed so as to prevent needing to handle the case of
    // the counter party hitting the issue of
    // "Cannot deposit while another deposit is occurring in the channel."
    const { messagingService, publicIdentifier, store } = requestHandler;
    const [counterpartyAddress] = await StateChannel.getPeersAddressFromChannel(
      publicIdentifier,
      store,
      multisigAddress,
    );

    const payload: DepositConfirmationMessage = {
      from: publicIdentifier,
      type: DEPOSIT_CONFIRMED_EVENT,
      data: params,
    };

    await messagingService.send(counterpartyAddress, payload);
    outgoing.emit(DEPOSIT_CONFIRMED_EVENT, payload);

    const multisigBalance =
      params.tokenAddress === CONVENTION_FOR_ETH_TOKEN_ADDRESS
        ? await provider.getBalance(multisigAddress)
        : await new Contract(tokenAddress!, ERC20.abi, provider).functions.balanceOf(
            multisigAddress,
          );

    return {
      multisigBalance,
      tokenAddress: params.tokenAddress!,
      transactionHash: depositTxHash!,
    };
  }
}

export async function installBalanceRefundApp(
  requestHandler: RequestHandler,
  params: DepositParams,
) {
  const { publicIdentifier, protocolRunner, networkContext, store, provider } = requestHandler;

  const { multisigAddress, tokenAddress } = params;

  const [peerAddress] = await StateChannel.getPeersAddressFromChannel(
    publicIdentifier,
    store,
    multisigAddress,
  );

  const stateChannel = await store.getStateChannel(multisigAddress);

  const depositContext = await getDepositContext(
    params,
    publicIdentifier,
    provider,
    networkContext,
    tokenAddress!,
  );

  const installProtocolParams: InstallProtocolParams = {
    initialState: depositContext.initialState,
    initiatorXpub: publicIdentifier,
    responderXpub: peerAddress,
    multisigAddress: stateChannel.multisigAddress,
    initiatorBalanceDecrement: Zero,
    responderBalanceDecrement: Zero,
    participants: stateChannel.getNextSigningKeys(),
    appInterface: depositContext.appInterface,
    // this is the block-time equivalent of 7 days
    defaultTimeout: 1008,
    appSeqNo: stateChannel.numProposedApps,
    outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
    initiatorDepositTokenAddress: tokenAddress!, // params object is mutated in caller
    responderDepositTokenAddress: tokenAddress!,
    // the balance refund is a special case where we want to set the limit to be
    // MAX_UINT256 instead of
    // `initiatorBalanceDecrement + responderBalanceDecrement` = 0
    disableLimit: true,
  };

  await protocolRunner.initiateProtocol(Protocol.Install, installProtocolParams);
}

export async function makeDeposit(
  requestHandler: RequestHandler,
  params: DepositParams,
): Promise<string | undefined> {
  const { multisigAddress, amount, tokenAddress } = params;
  const { provider, blocksNeededForConfirmation, outgoing, publicIdentifier } = requestHandler;

  const log = requestHandler.log.newContext(`CF-makeDeposit`);
  let start;

  const signer = await requestHandler.getSigner();
  const signerAddress = await signer.getAddress();

  let txResponse: TransactionResponse;

  let retryCount = DEPOSIT_RETRY_COUNT;
  const errors: string[] = [];
  while (retryCount > 0) {
    try {
      if (tokenAddress === CONVENTION_FOR_ETH_TOKEN_ADDRESS) {
        const tx: TransactionRequest = {
          to: multisigAddress,
          value: bigNumberify(amount),
          gasLimit: 30000,
          gasPrice: await provider.getGasPrice(),
          nonce: provider.getTransactionCount(signerAddress, `pending`),
        };

        txResponse = await signer.sendTransaction(tx);
      } else {
        const erc20Contract = new Contract(tokenAddress!, ERC20.abi, signer);
        txResponse = await erc20Contract.functions.transfer(multisigAddress, bigNumberify(amount), {
          nonce: provider.getTransactionCount(signerAddress, `pending`),
        });
      }
      start = Date.now();
      break;
    } catch (e) {
      errors.push(e.toString());
      const failMsg: DepositFailedMessage = {
        from: publicIdentifier,
        type: DEPOSIT_FAILED_EVENT,
        data: { errors, params },
      };
      if (e.toString().includes(`reject`) || e.toString().includes(`denied`)) {
        outgoing.emit(DEPOSIT_FAILED_EVENT, failMsg);
        throw Error(`${DEPOSIT_FAILED}: ${e.message}`);
      }

      retryCount -= 1;

      if (retryCount === 0) {
        outgoing.emit(DEPOSIT_FAILED_EVENT, failMsg);
        throw Error(`${DEPOSIT_FAILED}: ${e.message}`);
      }
    }
  }

  outgoing.emit(DEPOSIT_STARTED_EVENT, {
    from: publicIdentifier,
    type: DEPOSIT_STARTED_EVENT,
    data: {
      value: amount,
      txHash: txResponse!.hash,
    },
  });

  await txResponse!.wait(blocksNeededForConfirmation);
  logTime(log, start, `Deposit tx ${txResponse!.hash} was confirmed`);
  return txResponse!.hash;
}

export async function uninstallBalanceRefundApp(
  requestHandler: RequestHandler,
  params: DepositParams,
  blockNumberToUseIfNecessary?: number,
) {
  const { publicIdentifier, store, protocolRunner, networkContext } = requestHandler;

  const { multisigAddress, tokenAddress } = params;

  const { CoinBalanceRefundApp } = networkContext;

  const [peerAddress] = await StateChannel.getPeersAddressFromChannel(
    publicIdentifier,
    store,
    multisigAddress,
  );

  const stateChannel = await store.getStateChannel(params.multisigAddress);

  let refundApp;
  try {
    refundApp = stateChannel.getBalanceRefundAppInstance(CoinBalanceRefundApp, tokenAddress);
  } catch (e) {
    if (e.message.includes(`No CoinBalanceRefund app instance`)) {
      // no need to unintall, already uninstalled
      return;
    }
    throw new Error(e.stack || e.message);
  }

  // make sure its your app
  const { recipient } = refundApp.latestState;
  if (recipient !== xkeyKthAddress(publicIdentifier)) {
    throw new Error(NOT_YOUR_BALANCE_REFUND_APP);
  }

  await protocolRunner.initiateProtocol(Protocol.Uninstall, {
    initiatorXpub: publicIdentifier,
    responderXpub: peerAddress,
    multisigAddress: stateChannel.multisigAddress,
    appIdentityHash: refundApp.identityHash,
    blockNumberToUseIfNecessary,
  });
}

async function getDepositContext(
  params: DepositParams,
  publicIdentifier: string,
  provider: BaseProvider,
  networkContext: NetworkContext,
  tokenAddress: string,
): Promise<DepositContext> {
  const { multisigAddress } = params;

  const threshold =
    tokenAddress === CONVENTION_FOR_ETH_TOKEN_ADDRESS
      ? await provider.getBalance(multisigAddress)
      : await new Contract(tokenAddress!, ERC20.abi, provider).functions.balanceOf(multisigAddress);

  const initialState = {
    threshold,
    tokenAddress,
    recipient: xkeyKthAddress(publicIdentifier, 0),
    multisig: multisigAddress,
  } as CoinBalanceRefundAppState;

  return {
    initialState,
    appInterface: {
      addr: networkContext.CoinBalanceRefundApp,
      stateEncoding: coinBalanceRefundAppStateEncoding,
      actionEncoding: undefined,
    },
  };
}
