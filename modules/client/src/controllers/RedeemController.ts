import { AbstractController } from "./AbstractController";
import Web3 = require('web3')
import { UpdateRequest, PaymentArgs, Payment } from "../types";

export class RedeemController extends AbstractController {
  public redeem = async (secret: string): Promise<{ purchaseId: string, amount: Payment }> => {
    // check that the secret was generated as a hex
    if (!Web3.utils.isHex(secret)) {
      throw new Error(`The secret provided is not a hex string. Was it generated using the 'generateSecret' method of connext? Secret: ${secret}`)
    }

    const state = this.getState()

    try {
      const { purchaseId, sync, amount } = await this.hub.redeem(
        secret, 
        state.persistent.channel.txCountGlobal, state.persistent.lastThreadUpdateId,
      )
      this.connext.syncController.handleHubSync(sync)
      // get amount of purchase
      return { purchaseId, amount }
    } catch (e) {
      throw new Error(`Error redeeming payment with secret: ${secret}. ` + e.message)
    }
    
  }
}