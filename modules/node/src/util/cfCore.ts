import { ethers as eth } from "ethers";
export {
  CreateChannelMessage,
  DepositConfirmationMessage,
  EXTENDED_PRIVATE_KEY_PATH,
  InstallMessage,
  InstallVirtualMessage,
  JsonRpcResponse,
  Node as CFCore,
  ProposeMessage,
  RejectInstallVirtualMessage,
  UninstallMessage,
  UninstallVirtualMessage,
  UpdateStateMessage,
  WithdrawMessage,
} from "@counterfactual/node";

// cf-core imports are segregated so that later,
// importing from a local module is an easy option

export function freeBalanceAddressFromXpub(xpub: string): string {
  return eth.utils.getAddress(eth.utils.HDNode.fromExtendedKey(xpub).derivePath("0").address);
}
