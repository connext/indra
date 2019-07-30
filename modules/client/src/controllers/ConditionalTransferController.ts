import {
  ConditionalTransferParameters,
  ConditionalTransferResponse,
  convert,
  RegisteredAppDetails,
  SupportedApplication,
  SupportedApplications,
  UnidirectionalLinkedTransferAppActionBigNumber,
  UnidirectionalLinkedTransferAppStage,
  UnidirectionalLinkedTransferAppStateBigNumber,
} from "@connext/types";
import { RejectInstallVirtualMessage } from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { Zero } from "ethers/constants";
import { BigNumber, solidityKeccak256 } from "ethers/utils";
import { fromExtendedKey } from "ethers/utils/hdnode";
import { v4 as uuidV4 } from "uuid";

import { falsy, invalidAddress, invalidXpub, notLessThanOrEqualTo } from "../validation";

import { AbstractController } from "./AbstractController";

export class ConditionalTransferController extends AbstractController {
  private appId: string;

  private timeout: NodeJS.Timeout;

  public conditionalTransfer = async (
    params: ConditionalTransferParameters,
  ): Promise<ConditionalTransferResponse> => {
    this.log.info(`Transfer called with parameters: ${JSON.stringify(params, null, 2)}`);

    // convert params + validate
    const { recipient, amount, assetId } = convert.TransferParameters("bignumber", params);
    this.log.info(`********** assetId: ${assetId}`);
    const invalid = await this.validate(recipient, amount, assetId);

    const appInfo = this.connext.getRegisteredAppDetails(
      SupportedApplications.UnidirectionalLinkedTransferApp as SupportedApplication,
    );

    // generate random payment id
    const paymentId = uuidV4();
    // generate hex string
    // TODO: pad?
    const preImage = `0x${crypto.getRandomValues(new Uint32Array(1))[0].toString(16)}`;
    // install the transfer application
    const appId = await this.conditionalTransferAppInstalled(
      amount,
      recipient,
      assetId,
      paymentId,
      preImage,
      appInfo,
    );
    if (!appId) {
      throw new Error(`App was not installed`);
    }

    if (invalid) {
      throw new Error(invalid.toString());
    }
    return { paymentId, preImage, freeBalance: await this.connext.getFreeBalance(assetId) };
  };

  /////////////////////////////////
  ////// PRIVATE METHODS
  private validate = async (
    recipient: string,
    amount: BigNumber,
    assetId: string,
  ): Promise<undefined | string> => {
    // check that there is sufficient free balance for amount
    const freeBalance = await this.connext.getFreeBalance(assetId);
    const preTransferBal = freeBalance[this.connext.freeBalanceAddress];
    const errs = [
      invalidXpub(recipient),
      invalidAddress(assetId),
      notLessThanOrEqualTo(amount, preTransferBal),
    ];
    return errs ? errs.filter(falsy)[0] : undefined;
  };

  private createLinkedHash(action: UnidirectionalLinkedTransferAppActionBigNumber): string {
    return solidityKeccak256(
      ["uint256", "address", "string", "string"],
      [action.amount, action.assetId, action.paymentId, action.preImage],
    );
  }

  // creates a promise that is resolved once the app is installed
  // and rejected if the virtual application is rejected
  private conditionalTransferAppInstalled = async (
    amount: BigNumber,
    recipient: string,
    assetId: string,
    paymentId: string,
    preImage: string,
    appInfo: RegisteredAppDetails,
  ): Promise<string | undefined> => {
    let boundResolve: (value?: any) => void;
    let boundReject: (reason?: any) => void;

    const linkedHash = this.createLinkedHash({ amount, assetId, paymentId, preImage });

    const initialState: UnidirectionalLinkedTransferAppStateBigNumber = {
      finalized: false,
      linkedHash,
      stage: UnidirectionalLinkedTransferAppStage.POST_FUND,
      transfers: [
        {
          amount: Zero,
          to: this.wallet.address,
          // TODO: replace? fromExtendedKey(this.publicIdentifier).derivePath("0").address
        },
        {
          amount,
          to: fromExtendedKey(recipient).derivePath("0").address,
        },
      ],
      turnNum: Zero,
    };

    // note: intermediary is added in connext.ts as well
    const { actionEncoding, appDefinitionAddress: appDefinition, stateEncoding } = appInfo;
    const params: NodeTypes.ProposeInstallVirtualParams = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: amount,
      initiatorDepositTokenAddress: assetId,
      intermediaries: [this.connext.nodePublicIdentifier],
      outcomeType: appInfo.outcomeType,
      proposedToIdentifier: recipient,
      responderDeposit: Zero,
      responderDepositTokenAddress: assetId,
      timeout: Zero,
    };

    const res = await this.connext.proposeInstallVirtualApp(params);
    // set app instance id
    this.appId = res.appInstanceId;

    try {
      await new Promise(
        (res: () => any, rej: () => any): void => {
          boundReject = this.rejectInstallTransfer.bind(null, rej);
          boundResolve = this.resolveInstallTransfer.bind(null, res);
          this.listener.on(NodeTypes.EventName.INSTALL_VIRTUAL, boundResolve);
          this.listener.on(NodeTypes.EventName.REJECT_INSTALL_VIRTUAL, boundReject);
        },
      );
      this.log.info(`App was installed successfully!: ${JSON.stringify(res)}`);
      return res.appInstanceId;
    } catch (e) {
      this.log.error(`Error installing app: ${e.toString()}`);
      return undefined;
    } finally {
      this.cleanupInstallListeners(boundResolve, boundReject);
    }
  };

  // TODO: fix type of data
  private resolveInstallTransfer = (res: (value?: unknown) => void, data: any): any => {
    if (this.appId !== data.params.appInstanceId) {
      this.log.info(
        `Caught INSTALL_VIRTUAL event for different app ${JSON.stringify(data)}, expected ${
          this.appId
        }`,
      );
      // TODO: do we need to recreate the handler here?
      res();
      return;
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    res(data);
    return data;
  };

  // TODO: fix types of data
  private rejectInstallTransfer = (
    rej: (reason?: any) => void,
    msg: RejectInstallVirtualMessage,
  ): any => {
    // check app id
    if (this.appId !== msg.data.appInstanceId) {
      return;
    }

    return rej(`Install virtual failed. Event data: ${JSON.stringify(msg, null, 2)}`);
  };

  private cleanupInstallListeners = (boundResolve: any, boundReject: any): void => {
    this.listener.removeListener(NodeTypes.EventName.INSTALL_VIRTUAL, boundResolve);
    this.listener.removeListener(NodeTypes.EventName.REJECT_INSTALL_VIRTUAL, boundReject);
  };
}
