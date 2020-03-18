import { EthereumCommitment, MinimalTransaction, MultisigTransaction  } from "@connext/types";
import { Interface, joinSignature, keccak256, Signature, solidityPack } from "ethers/utils";

import { MinimumViableMultisig } from "../contracts";
import { sortSignaturesBySignerAddress, sortStringSignaturesBySignerAddress } from "../utils";

// A commitment to make MinimumViableMultisig perform a message call
export abstract class MultisigCommitment implements EthereumCommitment {
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

  public getSignedTransaction(inputSigs?: Signature[] | string[]): MinimalTransaction {
    this.assertSignatures();
    const multisigInput = this.getTransactionDetails();
    let signaturesList: string[];
    const sigs = inputSigs || this.participantSignatures;

    if (sigs && typeof sigs[0] == "string") {
      signaturesList = sortStringSignaturesBySignerAddress(this.hashToSign(), sigs as string[]);
    } else if (sigs && typeof sigs[0] == "object") {
      signaturesList = sortSignaturesBySignerAddress(
        this.hashToSign(),
        sigs as Signature[],
      ).map(joinSignature);
    } else {
      throw new Error(`Missing signatures`);
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
