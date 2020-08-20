import { DEFAULT_APP_TIMEOUT, WITHDRAW_STATE_TIMEOUT, WithdrawCommitment } from "@connext/apps";
import {
  AppInstanceJson,
  CF_METHOD_TIMEOUT,
  ChannelMethods,
  DefaultApp,
  EventNames,
  GenericMessage,
  MethodParams,
  MinimalTransaction,
  PublicParams,
  PublicResults,
  WithdrawAppAction,
  WithdrawAppName,
  WithdrawAppState,
  EventPayloads,
} from "@connext/types";
import {
  getAddressFromAssetId,
  getRandomBytes32,
  getSignerAddressFromPublicIdentifier,
  stringify,
  toBN,
} from "@connext/utils";
import { providers, constants, utils } from "ethers";

import { AbstractController } from "./AbstractController";

const { AddressZero, Zero, HashZero } = constants;
const { getAddress } = utils;

export class WithdrawalController extends AbstractController {
  public async withdraw(params: PublicParams.Withdraw): Promise<PublicResults.Withdraw> {
    this.log.info(`withdraw started: ${stringify(params)}`);
    params.assetId = getAddressFromAssetId(params.assetId || AddressZero);
    // The following should throw an error if the recipient address has an invalid checksum
    params.recipient = getAddress(params.recipient || this.connext.signerAddress);
    params.nonce = params.nonce || getRandomBytes32();

    let withdrawCommitment: WithdrawCommitment;
    let withdrawerSignatureOnWithdrawCommitment: string;
    let transaction: providers.TransactionResponse | undefined;
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

      this.log.info(`Waiting for node to provide withdrawl tx hash`);
      const subject = `${this.connext.nodeIdentifier}.channel.${this.connext.multisigAddress}.app-instance.${withdrawAppId}.uninstall`;

      const uninstallEvent = (await Promise.race([
        this.listener.waitFor(
          EventNames.UNINSTALL_EVENT,
          CF_METHOD_TIMEOUT * 5,
          (data) => data.uninstalledApp.identityHash === withdrawAppId,
        ),
        new Promise((resolve) =>
          this.connext.node.messaging.subscribe(subject, (msg: GenericMessage) =>
            resolve(msg.data),
          ),
        ),
      ])) as EventPayloads.Uninstall;

      // if not finalized, the withdrawal was canceled
      if (!(uninstallEvent.uninstalledApp.latestState as WithdrawAppState).finalized) {
        throw new Error(
          `Withdrawal app was uninstalled without being finalized, canceling withdrawal. Final state: ${stringify(
            uninstallEvent.uninstalledApp.latestState,
          )}`,
        );
      }
      if (!uninstallEvent.protocolMeta?.withdrawTx) {
        throw new Error(
          `Cannot find withdrawal tx in uninstall event data. However, the withdrawal commitment was generated successfully and can be retrieved from store and manually sent to chain.`,
        );
      }
      transaction = await this.connext.ethProvider.getTransaction(
        uninstallEvent.protocolMeta!.withdrawTx,
      );
      if (!transaction) {
        // wait an extra block
        transaction = await new Promise((resolve) => {
          this.connext.ethProvider.on("block", async () => {
            const tx = await this.connext.ethProvider.getTransaction(
              uninstallEvent.protocolMeta!.withdrawTx,
            );
            return resolve(tx);
          });
        });
        if (!transaction) {
          throw new Error(`Cannot find withdrawal tx: ${uninstallEvent.protocolMeta?.withdrawTx}`);
        }
      }
      this.log.info(`Data from withdrawal app uninstall: ${stringify(uninstallEvent, true, 0)}`);

      transaction.wait().then(async (receipt) => {
        this.connext.emit(EventNames.WITHDRAWAL_CONFIRMED_EVENT, { transaction: receipt });
        this.log.debug(`Removing withdraw commitment`);
        await this.removeWithdrawCommitmentFromStore(transaction);
      });
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
    this.log.info(`withdraw for assetId ${params.assetId} completed: ${stringify(result)}`);
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

    // Dont need to validate sigs because we already did it during the propose flow
    this.log.debug(`Uninstalling with action ${appInstance.identityHash}`);
    await this.connext.uninstallApp(appInstance.identityHash, {
      signature: await this.connext.channelProvider.signMessage(hash),
    } as WithdrawAppAction);
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
      this.connext.config.contractAddresses[this.connext.chainId],
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
    withdrawTx: any,
  ): Promise<void> {
    // set the withdrawal tx in the store
    const commitment = await this.createWithdrawCommitment(params);
    await commitment.addSignatures(signatures[0], signatures[1]);
    const minTx: MinimalTransaction = await commitment.getSignedTransaction();
    await this.connext.channelProvider.send(ChannelMethods.chan_setUserWithdrawal, {
      withdrawalObject: { tx: minTx, retry: 0, withdrawTx },
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
