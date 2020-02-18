import { MinimumViableMultisig } from "@connext/contracts";
import {
  Interface,
  joinSignature,
  Signature,
  solidityKeccak256,
  id,
  keccak256,
} from "ethers/utils";

import { CFCoreTypes, EthereumCommitment, MultisigTransaction } from "../types";
import { sortSignaturesBySignerAddress } from "../utils";

/// A commitment to make MinimumViableMultisig perform a message call
export abstract class MultisigCommitment extends EthereumCommitment {
  constructor(readonly multisigAddress: string, readonly multisigOwners: string[]) {
    super();
  }

  abstract getTransactionDetails(): MultisigTransaction;

  public getSignedTransaction(sigs: Signature[]): CFCoreTypes.MinimalTransaction {
    const multisigInput = this.getTransactionDetails();

    const signaturesList = sortSignaturesBySignerAddress(this.hashToSign(), sigs).map(
      joinSignature,
    );

    const txData = new Interface(MinimumViableMultisig.abi).functions.execTransaction.encode([
      multisigInput.to,
      multisigInput.value,
      multisigInput.data,
      multisigInput.operation,
      multisigInput.domainName,
      multisigInput.domainVersion,
      multisigInput.chainId,
      multisigInput.domainSalt,
      multisigInput.transactionCount,
      signaturesList,
    ]);

    // TODO: Deterministically compute `to` address
    return { to: this.multisigAddress, value: 0, data: txData };
  }

  public hashToSign(): string {
    const {
      to,
      value,
      data,
      operation,
      domainName,
      domainVersion,
      chainId,
      domainSalt,
      transactionCount,
    } = this.getTransactionDetails();
    const domainSeparatorHash = solidityKeccak256(
      ["bytes32", "bytes32", "uint256", "address", "bytes32"],
      [id(domainName), id(domainVersion), chainId, this.multisigAddress, domainSalt],
    );
    return solidityKeccak256(
      ["bytes1", "address[]", "address", "uint256", "bytes32", "uint8", "bytes32", "uint256"],
      [
        "0x19",
        this.multisigOwners,
        to,
        value,
        keccak256(data),
        operation,
        domainSeparatorHash,
        transactionCount,
      ],
    );
  }
}
