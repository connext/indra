import { EthereumCommitment, MinimalTransaction, MultisigTransaction } from "@connext/types";
import { defaultAbiCoder, Interface, keccak256, solidityKeccak256 } from "ethers/utils";
import { sortSignaturesBySignerAddress } from "@connext/types";
import { verifyChannelMessage } from "@connext/crypto";

import { MinimumViableMultisig } from "../contracts";

// A commitment to make MinimumViableMultisig perform a message call
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

  public async getSignedTransaction(): Promise<MinimalTransaction> {
    this.assertSignatures();
    const multisigInput = this.getTransactionDetails();
    const hash = this.hashToSign();
    const signaturesList = await sortSignaturesBySignerAddress(
      hash,
      this.signatures,
      verifyChannelMessage,
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

  public encode(): string {
    const { to, value, data, operation } = this.getTransactionDetails();
    return defaultAbiCoder.encode(
      ["bytes1", "address", "address", "uint256", "bytes32", "uint8"],
      ["0x19", this.multisigAddress, to, value, solidityKeccak256(["bytes"], [data]), operation],
    );
  }

  public hashToSign(): string {
    return keccak256(this.encode());
  }

  private assertSignatures() {
    if (!this.signatures || this.signatures.length === 0) {
      throw new Error(`No signatures detected`);
    }
  }
}
