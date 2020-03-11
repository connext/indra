import { CoinBalanceRefundAppStateBigNumber, CoinBalanceRefundApp } from "@connext/types";
import { Contract } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import { formatEther } from "ethers/utils";
import tokenAbi from "human-standard-token-abi";

import { stringify } from "../lib";
import { BigNumber, CFCoreTypes, ChannelState, convert, DepositParameters } from "../types";
import { invalidAddress, notLessThanOrEqualTo, notPositive, validate } from "../validation";

import { AbstractController } from "./AbstractController";

// TODO: refactor to use unrolled version
export class DepositController extends AbstractController {
  public deposit = async (params: DepositParameters): Promise<ChannelState> => {
    const myFreeBalanceAddress = this.connext.freeBalanceAddress;

    const { assetId, amount } = convert.Deposit(`bignumber`, params);
    validate(invalidAddress(assetId), notPositive(amount));

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
    validate(notLessThanOrEqualTo(amount, bal)); // cant deposit more than default addr owns

    // TODO: remove free balance stuff?
    const preDepositBalances = await this.connext.getFreeBalance(assetId);

    this.log.info(
      `Depositing ${formatEther(amount)} ${
        assetId === AddressZero ? "ETH" : "Tokens"
      } into channel ${this.connext.multisigAddress}`,
    );

    // propose coin balance refund app
    const appId = await this.proposeDepositInstall(assetId);
    this.log.debug(`Proposed coin balance refund app, appId: ${appId}`);

    try {
      await this.connext.rescindDepositRights({ assetId });
      const depositResponse = await this.connext.providerDeposit(amount, assetId);
      this.log.debug(`Deposit response: ${stringify(depositResponse)}`);

      const postDepositBalances = await this.connext.getFreeBalance(assetId);

      const diff = postDepositBalances[myFreeBalanceAddress].sub(
        preDepositBalances[myFreeBalanceAddress],
      );

      // changing this from !eq to lt. now that we have async deposits there is an edge case
      // where it could be more than amount
      if (diff.lt(amount)) {
        throw new Error(`My balance was not increased by the deposit amount.`);
      }
    } catch (e) {
      const msg = `Failed to deposit: ${e.stack || e.message}`;
      this.log.error(msg);
      throw new Error(msg);
    }

    return {
      apps: await this.connext.getAppInstances(),
      freeBalance: await this.connext.getFreeBalance(assetId),
    };
  };

  /////////////////////////////////
  ////// PRIVATE METHODS

  private proposeDepositInstall = async (assetId: string): Promise<string> => {
    const token = new Contract(assetId!, tokenAbi, this.ethProvider);
    const threshold =
      assetId === AddressZero
        ? await this.ethProvider.getBalance(this.connext.multisigAddress)
        : await token.functions.balanceOf(this.connext.multisigAddress);

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
    } = this.connext.getRegisteredAppDetails(CoinBalanceRefundApp);

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
