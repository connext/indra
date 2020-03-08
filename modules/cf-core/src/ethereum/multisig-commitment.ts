import { Interface, joinSignature, keccak256, Signature, solidityPack } from "ethers/utils";

import { MinimumViableMultisig } from "../contracts";
import { CFCoreTypes, EthereumCommitment, MultisigTransaction } from "../types";
import { sortSignaturesBySignerAddress, sortStringSignaturesBySignerAddress } from "../utils";

/// A commitment to make MinimumViableMultisig perform a message call
export abstract class MultisigCommitment extends EthereumCommitment {
  constructor(readonly multisigAddress: string, readonly multisigOwners: string[]) {
    super();
  }

  abstract getTransactionDetails(): MultisigTransaction;

  public getSignedTransaction(sigs: Signature[] | string[]): CFCoreTypes.MinimalTransaction {
    const multisigInput = this.getTransactionDetails();
    let signaturesList: string[];

    if(typeof sigs[0] == "string") {
      //@ts-ignore
      signaturesList = sortStringSignaturesBySignerAddress(this.hashToSign(), sigs);
    } else {
      //@ts-ignore
      signaturesList = sortSignaturesBySignerAddress(this.hashToSign(), sigs).map(
        joinSignature,
      );
    }

    const txData = new Interface(MinimumViableMultisig.abi).functions.execTransaction.encode([
      multisigInput.to,
      multisigInput.value,
      multisigInput.data,
      multisigInput.operation,
      signaturesList,
    ]);

    // TODO: Deterministically compute `to` address
    return { to: this.multisigAddress, value: 0, data: txData };
  }

  public hashToSign(): string {
    const { to, value, data, operation } = this.getTransactionDetails();
    return keccak256(
      solidityPack(
        ["bytes1", "address[]", "address", "uint256", "bytes", "uint8"],
        ["0x19", this.multisigOwners, to, value, data, operation],
      ),
    );
  }
}
