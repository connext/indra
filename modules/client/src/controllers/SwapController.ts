import { AppRegistry, convert, SwapParameters, NodeChannel } from "@connext/types";
import { RejectInstallVirtualMessage } from "@counterfactual/node";
import { AppInstanceInfo, Node as NodeTypes } from "@counterfactual/types";
import { constants } from "ethers";
import { BigNumber } from "ethers/utils";

import { delay } from "../lib/utils";
import { invalidAddress, invalidXpub } from "../validation/addresses";
import { falsy, notLessThanOrEqualTo } from "../validation/bn";

import { AbstractController } from "./AbstractController";
import { fromExtendedKey } from "ethers/utils/hdnode";
import { Zero } from "ethers/constants";

export class SwapController extends AbstractController {
  private appId: string;
  private timeout: NodeJS.Timeout;

  public async swap(params: SwapParameters): Promise<NodeChannel> {
    this.log.info("Swap called, yay!");

    // convert params + validate
    const { amount, toAssetId, fromAssetId } = convert.SwapParameters("bignumber", params);
    const invalid = await this.validate(amount, toAssetId, fromAssetId);
    if (invalid) {
      throw new Error(invalid.toString());
    }

    // get app definition from constants
    // TODO: this should come from a db on the node
    const appInfo = AppRegistry[this.connext.network.name].SimpleTwoPartySwapApp;

    // install the swap app
    try {
      await this.swapAppInstall(amount, toAssetId, fromAssetId, swapRate, appInfo); // TODO need to listen for swap rate
    } catch (e) {
      // TODO: can add more checks in `rejectInstall`. Could be any of:
      // 1) Incorrect assetIds (or assetIds are just not supported by node)
      // 2) Not enough balance on node to enact swap
      // 3) Swap rate not accepted by node
      throw new Error("Swap rejected by node");
    }

    // if app installed, that means swap was accepted
    // now uninstall
    try {
      await this.swapAppUninstall(this.appId)
    }

    // Sanity check to see if swap was executed correctly
    const postSwapBal = await this.connext.getFreeBalance();
    // TODO (after freebalance change)

    const newState = await this.connext.getChannel();

    // TODO: fix the state / types!!
    return newState as NodeChannel;
  }

  /////////////////////////////////
  ////// PRIVATE METHODS
  private validate = async (
    amount: BigNumber,
    toAssetId: string,
    fromAssetId: string,
  ): Promise<undefined | string> => {
    // check that there is sufficient free balance for amount
    const freeBalance = await this.connext.getFreeBalance();
    const preTransferFromBal = freeBalance[this.cfModule.ethFreeBalanceAddress]; // TODO will this work? Check
    const errs = [
      invalidAddress(fromAssetId),
      invalidAddress(toAssetId),
      notLessThanOrEqualTo(amount, preTransferFromBal),
    ];
    return errs ? errs.filter(falsy)[0] : undefined;
  };

  private swapAppInstall = async (
    amount: BigNumber, 
    toAssetId: string, 
    fromAssetId: string, 
    swapRate: BigNumber,
    appInfo: any,
  ): Promise<any> => {
    let boundResolve;
    let boundReject;

    const params: NodeTypes.ProposeInstallParams = {
      ...appInfo,
      initialState: {
        coinBalances: [
          {
            to: fromExtendedKey(this.connext.publicIdentifier).derivePath("0").address,
            coinAddress: [fromAssetId, toAssetId],
            balance: [amount, Zero],
          },
          {
            to: fromExtendedKey(this.connext.nodePublicIdentifier).derivePath("0").address,
            coinAddress: [fromAssetId, toAssetId],
            balance: [Zero, amount.mul(swapRate)]
          },
        ],
      },
      myDeposit: amount, // TODO will this work?
      peerDeposit: amount.mul(swapRate), // TODO will this work? ERC20 context?
      proposedToIdentifier: this.connext.nodePublicIdentifier,
    };

    const res = await this.connext.proposeInstallApp(params);

    // set app instance id
    this.appId = res.appInstanceId;

    await new Promise((res, rej) => {
      boundReject = this.rejectInstallTransfer.bind(null, rej);
      boundResolve = this.resolveInstallTransfer.bind(null, res);
      this.listener.on(NodeTypes.EventName.INSTALL_VIRTUAL, boundResolve);
      this.listener.on(NodeTypes.EventName.REJECT_INSTALL_VIRTUAL, boundReject);
      this.timeout = setTimeout(() => {
        this.cleanupInstallListeners(boundResolve, boundReject);
        boundReject({ data: { data: this.appId } });
      }, 5000);
    });

    this.cleanupInstallListeners(boundResolve, boundReject);
    return res.appInstanceId;
  }
}
