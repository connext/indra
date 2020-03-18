import { Interface, joinSignature, keccak256, Signature, solidityPack } from "ethers/utils";

import { MinimumViableMultisig } from "../contracts";
<<<<<<< HEAD
import { MinimalTransaction, EthereumCommitment, MultisigTransaction } from "../types";
import { sortSignaturesBySignerAddress } from "../utils";

// A commitment to make MinimumViableMultisig perform a message call
export abstract class MultisigCommitment extends EthereumCommitment {
=======
import { CFCoreTypes, EthereumCommitment, MultisigTransaction } from "../types";
import { sortSignaturesBySignerAddress, sortStringSignaturesBySignerAddress } from "../utils";

/// A commitment to make MinimumViableMultisig perform a message call
export abstract class MultisigCommitment implements EthereumCommitment {
>>>>>>> 845-store-refactor
  constructor(
    readonly multisigAddress: string,
    readonly multisigOwners: string[],
    private participantSignatures: Signature[] = [],
  ) {}

  abstract getTransactionDetails(): MultisigTransaction;

  get signatures(): Signature[] {
    return this.participantSignatures;
  }

  set signatures(sigs: Signature[]) {
    if (sigs.length < 2) {
      throw new Error(
        `Incorrect number of signatures supplied. Expected at least 2, got ${sigs.length}`,
      );
    }
    this.participantSignatures = sigs;
  }

<<<<<<< HEAD
  public getSignedTransaction(): MinimalTransaction {
=======
  public getSignedTransaction(sigs?: Signature[] | string[]): CFCoreTypes.MinimalTransaction {
>>>>>>> 845-store-refactor
    this.assertSignatures();
    const multisigInput = this.getTransactionDetails();
    let signaturesList: string[];

    if (sigs && typeof sigs[0] == "string") {
      //@ts-ignore
      signaturesList = sortStringSignaturesBySignerAddress(this.hashToSign(), sigs);
    } else {
      //@ts-ignore
      signaturesList = sortSignaturesBySignerAddress(this.hashToSign(), sigs).map(joinSignature);
    }

    const txData = new Interface(MinimumViableMultisig.abi).functions.execTransaction.encode([
      multisigInput.to,
      multisigInput.value,
      multisigInput.data,
      multisigInput.operation,
      signaturesList,
    ]);

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

  private assertSignatures() {
    if (!this.signatures || this.signatures.length === 0) {
      throw new Error(`No signatures detected`);
    }
  }
}
