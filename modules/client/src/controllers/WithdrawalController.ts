import { DEFAULT_APP_TIMEOUT, WITHDRAW_STATE_TIMEOUT, WithdrawCommitment } from "@connext/apps";
import {
  AppInstanceJson,
  ChannelMethods,
  EventNames,
  MethodParams,
  MinimalTransaction,
  PublicParams,
  PublicResults,
  WithdrawAppAction,
  WithdrawAppName,
  WithdrawAppState,
  DefaultApp,
} from "@connext/types";
import {
  getSignerAddressFromPublicIdentifier,
  invalidAddress,
  stringify,
  toBN,
  validate,
} from "@connext/utils";
import { AddressZero, Zero, HashZero } from "ethers/constants";
import { TransactionResponse } from "ethers/providers";
import { getAddress, hexlify, randomBytes } from "ethers/utils";

import { AbstractController } from "./AbstractController";

export class WithdrawalController extends AbstractController {
  public async withdraw(params: PublicParams.Withdraw): Promise<PublicResults.Withdraw> {
    this.log.info(`withdraw started: ${stringify(params)}`);
    // Set defaults
    if (!params.assetId) {
      params.assetId = AddressZero;
    }
    params.assetId = getAddress(params.assetId);

    if (!params.recipient) {
      params.recipient = this.connext.signerAddress;
    }
    params.recipient = getAddress(params.recipient);

    if (!params.nonce) {
      params.nonce = hexlify(randomBytes(32));
    }

    const { assetId, recipient } = params;
    let transaction: TransactionResponse | undefined;

    validate(invalidAddress(recipient), invalidAddress(assetId));

    let withdrawCommitment: WithdrawCommitment;
    let withdrawerSignatureOnWithdrawCommitment: string;
    try {
      this.log.debug(`Creating withdraw commitment`);
      withdrawCommitment = await this.createWithdrawCommitment(params);
      const hash = withdrawCommitment.hashToSign();
      this.log.debug(`Signing commitment hash: ${hash}`);
      withdrawerSignatureOnWithdrawCommitment = await this.connext.channelProvider.signMessage(
        hash,
      );

      this.log.debug(`Installing withdrawal app`);
      await this.proposeWithdrawApp(params, hash, withdrawerSignatureOnWithdrawCommitment);
      this.log.debug(`Successfully installed!`);

      this.connext.listener.emit(EventNames.WITHDRAWAL_STARTED_EVENT, {
        params,
        withdrawCommitment,
        withdrawerSignatureOnWithdrawCommitment,
      });

      this.log.debug(`Watching chain for user withdrawal`);
      [transaction] = await this.connext.watchForUserWithdrawal();
      this.log.debug(`Node put withdrawal onchain: ${transaction.hash}`);
      this.log.debug(`Transaction details: ${stringify(transaction)}`);

      this.connext.listener.emit(EventNames.WITHDRAWAL_CONFIRMED_EVENT, { transaction });

      this.log.debug(`Removing withdraw commitment`);
      await this.removeWithdrawCommitmentFromStore(transaction);
    } catch (e) {
      this.connext.listener.emit(EventNames.WITHDRAWAL_FAILED_EVENT, {
        params,
        withdrawCommitment,
        withdrawerSignatureOnWithdrawCommitment,
        error: e.stack || e.message,
      });
      throw new Error(e.stack || e.message);
    }

    // Note that we listen for the signed commitment and save it to store only in listener.ts

    const result: PublicResults.Withdraw = { transaction };
    this.log.info(`withdraw for assetId ${assetId} completed: ${stringify(result)}`);
    return result;
  }

  public async respondToNodeWithdraw(appInstance: AppInstanceJson) {
    this.log.info(`Responding to node withdrawal`);
    const state = appInstance.latestState as WithdrawAppState;

    const generatedCommitment = await this.createWithdrawCommitment({
      amount: state.transfers[0].amount,
      assetId: appInstance.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress,
      recipient: state.transfers[0].to,
      nonce: state.nonce,
    } as PublicParams.Withdraw);
    const hash = generatedCommitment.hashToSign();
    this.log.debug(`Signing withdrawal commitment: ${hash}`);

    // Dont need to validate anything because we already did it during the propose flow
    const counterpartySignatureOnWithdrawCommitment = await this.connext.channelProvider.signMessage(
      hash,
    );
    this.log.debug(`Taking action on ${appInstance.identityHash}`);
    await this.connext.takeAction(appInstance.identityHash, {
      signature: counterpartySignatureOnWithdrawCommitment,
    } as WithdrawAppAction);
    this.log.debug(`Uninstalling ${appInstance.identityHash}`);
    await this.connext.uninstallApp(appInstance.identityHash);
  }

  private async createWithdrawCommitment(
    params: PublicParams.Withdraw,
  ): Promise<WithdrawCommitment> {
    const { assetId, amount, nonce, recipient } = params;
    const { data: channel } = await this.connext.getStateChannel();
    const multisigOwners = [
      getSignerAddressFromPublicIdentifier(channel.userIdentifiers[0]),
      getSignerAddressFromPublicIdentifier(channel.userIdentifiers[1]),
    ];
    return new WithdrawCommitment(
      this.connext.config.contractAddresses,
      channel.multisigAddress,
      multisigOwners,
      recipient,
      assetId,
      amount,
      nonce,
    );
  }

  private async proposeWithdrawApp(
    params: PublicParams.Withdraw,
    withdrawCommitmentHash: string,
    withdrawerSignatureOnWithdrawCommitment: string,
  ): Promise<string> {
    const amount = toBN(params.amount);
    const { assetId, nonce, recipient } = params;
    const network = await this.ethProvider.getNetwork();
    const appInfo = (await this.connext.getAppRegistry({
      name: WithdrawAppName,
      chainId: network.chainId,
    })) as DefaultApp;
    const {
      appDefinitionAddress: appDefinition,
      outcomeType,
      stateEncoding,
      actionEncoding,
    } = appInfo;
    const initialState: WithdrawAppState = {
      transfers: [
        { amount: amount, to: recipient },
        { amount: Zero, to: this.connext.nodeSignerAddress },
      ],
      signatures: [withdrawerSignatureOnWithdrawCommitment, HashZero],
      signers: [this.connext.signerAddress, this.connext.nodeSignerAddress],
      data: withdrawCommitmentHash,
      nonce,
      finalized: false,
    };
    const installParams: MethodParams.ProposeInstall = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: amount,
      initiatorDepositAssetId: assetId,
      outcomeType,
      responderIdentifier: this.connext.nodeIdentifier,
      responderDeposit: Zero,
      responderDepositAssetId: assetId,
      defaultTimeout: DEFAULT_APP_TIMEOUT,
      stateTimeout: WITHDRAW_STATE_TIMEOUT,
    };
    this.log.debug(`Installing withdrawal app with params: ${stringify(params, 2)}`);
    return this.proposeAndInstallLedgerApp(installParams);
  }

  public async saveWithdrawCommitmentToStore(
    params: PublicParams.Withdraw,
    signatures: string[],
  ): Promise<void> {
    // set the withdrawal tx in the store
    const commitment = await this.createWithdrawCommitment(params);
    await commitment.addSignatures(signatures[0], signatures[1]);
    const minTx: MinimalTransaction = await commitment.getSignedTransaction();
    await this.connext.channelProvider.send(ChannelMethods.chan_setUserWithdrawal, {
      withdrawalObject: { tx: minTx, retry: 0 },
    });
    return;
  }

  public async removeWithdrawCommitmentFromStore(transaction: TransactionResponse): Promise<void> {
    const minTx: MinimalTransaction = {
      to: transaction.to,
      value: transaction.value,
      data: transaction.data,
    };
    await this.connext.channelProvider.send(ChannelMethods.chan_setUserWithdrawal, {
      withdrawalObject: { tx: minTx, retry: 0 },
      remove: true,
    });
  }
}
