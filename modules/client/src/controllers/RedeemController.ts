import { AbstractController } from "./AbstractController";
import Web3 = require('web3')

export class RedeemController extends AbstractController {
  public redeem = async (secret: string): Promise<{ purchaseId: string }> => {
    // check that the secret was generated as a hex
    if (!Web3.utils.isHex(secret)) {
      throw new Error(`The secret provided is not a hex string. Was it generated using the 'generateSecret' method of connext? Secret: ${secret}`)
    }
    try {
      const res = await this.hub.redeem(secret)
      this.connext.syncController.handleHubSync(res.sync)
      return { purchaseId: res.purchaseId }
    } catch (e) {
      throw new Error(`Error redeeming payment with secret: ${secret}` + e.message)
    }
  }
}