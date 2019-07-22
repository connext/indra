import { Node } from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { Logger } from "@nestjs/common";
import { ethers as eth } from "ethers";

export function freeBalanceAddressFromXpub(xpub: string): string {
  return eth.utils.HDNode.fromExtendedKey(xpub).derivePath("0").address;
}

export function registerCfNodeListener(
  node: Node,
  event: NodeTypes.EventName,
  callback: (data: any) => any,
  context?: string,
): void {
  Logger.log(`Registering node callback for event ${event}`, context);
  node.on(event, callback);
}
