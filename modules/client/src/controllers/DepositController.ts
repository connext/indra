import { Contract } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import tokenAbi from "human-standard-token-abi";

import { CF_METHOD_TIMEOUT, delayAndThrow, stringify, xpubToAddress } from "../lib";
import {
  BigNumber,
  CFCoreTypes,
  ChannelState,
  CoinBalanceRefundAppStateBigNumber,
  convert,
  DepositParameters,
  SupportedApplication,
  SupportedApplications,
} from "../types";
import { invalidAddress, notLessThanOrEqualTo, notPositive, validate } from "../validation";

import { AbstractController } from "./AbstractController";

// TODO: refactor to use unrolled version
export class DepositController extends AbstractController {
  public deposit = async (params: DepositParameters): Promise<ChannelState> => {
    const myFreeBalanceAddress = this.connext.freeBalanceAddress;

    const { assetId, amount } = convert.Deposit("bignumber", params);

    // check asset balance of address
    let bal: BigNumber;
    if (assetId === AddressZero) {
      bal = await this.ethProvider.getBalance(myFreeBalanceAddress);
    } else {
      // get token balance
      const token = new Contract(assetId, tokenAbi, this.ethProvider);
      // TODO: correct? how can i use allowance?
      bal = await token.balanceOf(myFreeBalanceAddress);
    }
    validate(
      invalidAddress(assetId),
      notPositive(amount),
      notLessThanOrEqualTo(amount, bal), // cant deposit more than default addr owns
    );

    // TODO: remove free balance stuff?
    const preDepositBalances = await this.connext.getFreeBalance(assetId);

    this.log.info(`\nDepositing ${amount} of ${assetId} into ${this.connext.multisigAddress}\n`);

    // propose coin balance refund app
    const appId = await this.proposeDepositInstall(assetId);
    this.log.debug(`Coin balance refund app proposed with id: ${appId}`);

    try {
      this.log.info(`Calling ${CFCoreTypes.RpcMethodNames.chan_deposit}`);
      await this.connext.rescindDepositRights({ assetId });
      const depositResponse = await this.connext.providerDeposit(amount, assetId);
      this.log.info(`Deposit Response: ${stringify(depositResponse)}`);

      const postDepositBalances = await this.connext.getFreeBalance(assetId);

      const diff = postDepositBalances[myFreeBalanceAddress].sub(
        preDepositBalances[myFreeBalanceAddress],
      );

      // changing this from !eq to lt. now that we have async deposits there is an edge case
      // where it could be more than amount
      if (diff.lt(amount)) {
        throw new Error("My balance was not increased by the deposit amount.");
      }

      this.log.info("Deposited!");
    } catch (e) {
      this.log.error(`Failed to deposit: ${e.stack || e.message}`);
      throw e;
    }

    return {
      apps: await this.connext.getAppInstances(this.connext.multisigAddress),
      freeBalance: await this.connext.getFreeBalance(assetId),
    };
  };

  /////////////////////////////////
  ////// PRIVATE METHODS

  private proposeDepositInstall = async (assetId: string): Promise<string> => {
    const threshold =
      assetId === AddressZero
        ? await this.ethProvider.getBalance(this.connext.multisigAddress)
        : await new Contract(assetId!, tokenAbi, this.ethProvider).functions.balanceOf(
            this.connext.multisigAddress,
          );

    const initialState: CoinBalanceRefundAppStateBigNumber = {
      multisig: this.connext.multisigAddress,
      recipient: this.connext.freeBalanceAddress,
      threshold,
      tokenAddress: assetId,
    };

    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      stateEncoding,
      outcomeType,
    } = this.connext.getRegisteredAppDetails(
      SupportedApplications.CoinBalanceRefundApp as SupportedApplication,
    );

    const params: CFCoreTypes.ProposeInstallParams = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: Zero,
      initiatorDepositTokenAddress: assetId,
      outcomeType,
      proposedToIdentifier: this.connext.nodePublicIdentifier,
      responderDeposit: Zero,
      responderDepositTokenAddress: assetId,
      timeout: Zero,
    };

    const appId = await this.proposeAndWaitForAccepted(params);
    return appId;
  };
}
