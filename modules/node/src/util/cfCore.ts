import MinimumViableMultisig from "@counterfactual/cf-funding-protocol-contracts/expected-build-artifacts/MinimumViableMultisig.json";
import Proxy from "@counterfactual/cf-funding-protocol-contracts/expected-build-artifacts/Proxy.json";
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
  RejectProposalMessage,
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

export function xkeyKthHDNode(xkey: string, k: number): eth.utils.HDNode.HDNode {
  return eth.utils.HDNode.fromExtendedKey(xkey).derivePath(`${k}`);
}

export function xkeyKthAddress(xkey: string, k: number): string {
  return eth.utils.computeAddress(xkeyKthHDNode(xkey, k).publicKey);
}

export function sortAddresses(addrs: string[]): string[] {
  return addrs.sort((a, b) => (parseInt(a, 16) < parseInt(b, 16) ? -1 : 1));
}

export function xkeysToSortedKthAddresses(xkeys: string[], k: number): string[] {
  return sortAddresses(xkeys.map(xkey => xkeyKthAddress(xkey, k)));
}

// TODO: this should be imported from the counterfactual utils
export function getMultisigAddressfromXpubs(
  owners: string[],
  proxyFactoryAddress: string,
  minimumViableMultisigAddress: string,
): string {
  return eth.utils.getAddress(
    eth.utils
      .solidityKeccak256(
        ["bytes1", "address", "uint256", "bytes32"],
        [
          "0xff",
          proxyFactoryAddress,
          eth.utils.solidityKeccak256(
            ["bytes32", "uint256"],
            [
              eth.utils.keccak256(
                new eth.utils.Interface(MinimumViableMultisig.abi).functions.setup.encode([
                  xkeysToSortedKthAddresses(owners, 0),
                ]),
              ),
              0,
            ],
          ),
          eth.utils.solidityKeccak256(
            ["bytes", "uint256"],
            [`0x${Proxy.evm.bytecode.object}`, minimumViableMultisigAddress],
          ),
        ],
      )
      .slice(-40),
  );
}
