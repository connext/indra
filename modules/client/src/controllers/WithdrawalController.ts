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
  CF_METHOD_TIMEOUT,
  EventPayloads,
} from "@connext/types";
import {
  getSignerAddressFromPublicIdentifier,
  getAddressError,
  stringify,
  toBN,
} from "@connext/utils";
import { providers, constants, utils } from "ethers";

import { AbstractController } from "./AbstractController";

const { AddressZero, Zero, HashZero } = constants;
const { getAddress, hexlify, randomBytes } = utils;

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
    let transaction: providers.TransactionResponse | undefined;

    this.throwIfAny(getAddressError(recipient), getAddressError(assetId));

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
      const withdrawAppId = await this.proposeWithdrawApp(
        params,
        hash,
        withdrawerSignatureOnWithdrawCommitment,
      );
      this.log.debug(`Successfully installed!`);

      this.connext.emit(EventNames.WITHDRAWAL_STARTED_EVENT, {
        params,
        // @ts-ignore
        withdrawCommitment,
        withdrawerSignatureOnWithdrawCommitment,
      });

      this.log.debug(`Watching chain for user withdrawal`);
      const raceRes = (await Promise.race([
        this.listener.waitFor(
          EventNames.UPDATE_STATE_FAILED_EVENT,
          CF_METHOD_TIMEOUT * 3,
          (msg) => msg.params.appIdentityHash === withdrawAppId,
        ),
        new Promise(async (resolve, reject) => {
          try {
            const [tx] = await this.connext.watchForUserWithdrawal();
            return resolve(tx);
          } catch (e) {
            return reject(new Error(e));
          }
        }),
      ])) as EventPayloads.UpdateStateFailed | providers.TransactionResponse;
      if ((raceRes as EventPayloads.UpdateStateFailed).error) {
        throw new Error((raceRes as EventPayloads.UpdateStateFailed).error);
      }
      transaction = raceRes as providers.TransactionResponse;
      this.log.info(`Node put withdrawal onchain: ${transaction.hash}`);
      this.log.debug(`Transaction details: ${stringify(transaction)}`);

      this.connext.emit(EventNames.WITHDRAWAL_CONFIRMED_EVENT, { transaction });

      this.log.debug(`Removing withdraw commitment`);
      await this.removeWithdrawCommitmentFromStore(transaction);
    } catch (e) {
      this.connext.emit(EventNames.WITHDRAWAL_FAILED_EVENT, {
        params,
        // @ts-ignore
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
      assetId: appInstance.outcomeInterpreterParameters["tokenAddress"],
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
      multisigAddress: this.connext.multisigAddress,
      outcomeType,
      responderIdentifier: this.connext.nodeIdentifier,
      responderDeposit: Zero,
      responderDepositAssetId: assetId,
      defaultTimeout: DEFAULT_APP_TIMEOUT,
      stateTimeout: WITHDRAW_STATE_TIMEOUT,
    };
    this.log.debug(`Installing withdrawal app with params: ${stringify(params)}`);
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

  public async removeWithdrawCommitmentFromStore(
    transaction: providers.TransactionResponse,
  ): Promise<void> {
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
