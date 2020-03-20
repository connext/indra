import {
  Interface,
  joinSignature,
  keccak256,
  Signature,
  solidityPack,
  splitSignature,
} from "ethers/utils";

import { MinimumViableMultisig } from "../contracts";
import { CFCoreTypes, EthereumCommitment, MultisigTransaction } from "../types";
import { sortSignaturesBySignerAddress } from "../utils";

/// A commitment to make MinimumViableMultisig perform a message call
export abstract class MultisigCommitment implements EthereumCommitment {
  constructor(
    readonly multisigAddress: string,
    readonly multisigOwners: string[],
    private participantSignatures: Signature[] = [],
  ) {}

  abstract getTransactionDetails(): MultisigTransaction;

  // @ts-ignore -- will complain about the string conversion
  get signatures(): Signature[] {
    return this.participantSignatures;
  }

  // @ts-ignore -- will complain about the string issue
  set signatures(sigs: Signature[] | string[]) {
    if (sigs.length < 2) {
      throw new Error(
        `Incorrect number of signatures supplied. Expected at least 2, got ${sigs.length}`,
      );
    }
    if (typeof sigs[0] === "string") {
      this.participantSignatures = (sigs as string[]).map(splitSignature);
      return;
    }
    this.participantSignatures = sigs as Signature[];
  }

  public getSignedTransaction(): CFCoreTypes.MinimalTransaction {
    this.assertSignatures();
    const multisigInput = this.getTransactionDetails();
    const signaturesList = sortSignaturesBySignerAddress(this.hashToSign(), this.signatures).map(
      joinSignature,
    );

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

    if (typeof this.signatures[0] === "string") {
      throw new Error(`Expected Signature type, not string`);
    }
  }
}
