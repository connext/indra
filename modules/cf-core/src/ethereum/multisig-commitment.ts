import { Interface, keccak256, solidityPack } from "ethers/utils";

import { MinimumViableMultisig } from "../contracts";
import { CFCoreTypes, EthereumCommitment, MultisigTransaction } from "../types";
import { sortSignaturesBySignerAddress } from "../utils";

/// A commitment to make MinimumViableMultisig perform a message call
export abstract class MultisigCommitment implements EthereumCommitment {
  constructor(
    readonly multisigAddress: string,
    readonly multisigOwners: string[],
    private participantSignatures: string[] = [],
  ) {}

  abstract getTransactionDetails(): MultisigTransaction;

  get signatures(): string[] {
    return this.participantSignatures;
  }

  set signatures(sigs: string[]) {
    if (sigs.length < 2) {
      throw new Error(
        `Incorrect number of signatures supplied. Expected at least 2, got ${sigs.length}`,
      );
    }
    this.participantSignatures = sigs;
  }

  public getSignedTransaction(): CFCoreTypes.MinimalTransaction {
    this.assertSignatures();
    const multisigInput = this.getTransactionDetails();
    const hash = this.hashToSign();
    const signaturesList = sortSignaturesBySignerAddress(hash, this.signatures);

    const txData = new Interface(MinimumViableMultisig.abi).functions.execTransaction.encode([
      multisigInput.to,
      multisigInput.value,
      multisigInput.data,
      multisigInput.operation,
      signaturesList,
    ]);

    return { to: this.multisigAddress, value: 0, data: txData };
  }

  public encode(): string {
    const { to, value, data, operation } = this.getTransactionDetails();
    return solidityPack(
      ["bytes1", "address[]", "address", "uint256", "bytes", "uint8"],
      ["0x19", this.multisigOwners, to, value, data, operation],
    );
  }

  public hashToSign(): string {
    return keccak256(this.encode());
  }

  private assertSignatures() {
    if (!this.signatures || this.signatures.length === 0) {
      throw new Error(`No signatures detected`);
    }

    if (typeof this.signatures[0] === "string") {
      throw new Error(`Expected Signature type, not string`);
    }
  }
}
