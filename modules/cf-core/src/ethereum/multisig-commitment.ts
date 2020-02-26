import { Interface, joinSignature, keccak256, Signature, solidityPack } from "ethers/utils";

import { MinimumViableMultisig } from "../contracts";
import { CFCoreTypes, EthereumCommitment, MultisigTransaction } from "../types";
import { sortSignaturesBySignerAddress } from "../utils";

/// A commitment to make MinimumViableMultisig perform a message call
export abstract class MultisigCommitment extends EthereumCommitment {
  constructor(
    readonly multisigAddress: string,
    readonly multisigOwners: string[],
    private participantSignatures: Signature[] = [],
  ) {
    super();
  }

  abstract getTransactionDetails(): MultisigTransaction;

  get signatures() {
    return this.participantSignatures;
  }

  set signatures(sigs: Signature[]) {
    this.participantSignatures = sigs;
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
  }
}
