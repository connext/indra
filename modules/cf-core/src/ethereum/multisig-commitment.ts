import { EthereumCommitment, MinimalTransaction, MultisigTransaction } from "@connext/types";
import { defaultAbiCoder, Interface, keccak256, solidityKeccak256 } from "ethers/utils";
import { verifyChannelMessage } from "@connext/crypto";

import { MinimumViableMultisig } from "../contracts";

// A commitment to make MinimumViableMultisig perform a message call
export abstract class MultisigCommitment implements EthereumCommitment {
  constructor(
    readonly multisigAddress: string,
    readonly multisigOwners: string[],
    private initiatorSignature?: string,
    private responderSignature?: string,
  ) {}

  abstract getTransactionDetails(): MultisigTransaction;

  get signatures(): string[] {
    if (!this.initiatorSignature && !this.responderSignature) {
      return [];
    }
    return [this.initiatorSignature!, this.responderSignature!];
  }

  public async addSignatures(
    signature1: string,
    signature2: string,
  ): Promise<void> {
    for (const sig of [signature1, signature2]) {
      const recovered = await verifyChannelMessage(this.hashToSign(), sig);
      if (recovered === this.multisigOwners[0]) {
        this.initiatorSignature = sig;
      } else if (recovered === this.multisigOwners[1]) {
        this.responderSignature = sig;
      } else {
        throw new Error(`Invalid signer detected. Got ${recovered}, expected one of: ${this.multisigOwners}`);
      }
    }
  }

  set signatures(sigs: string[]) {
    throw new Error(`Use "addSignatures" to ensure the correct sorting`);
  }

  public async getSignedTransaction(): Promise<MinimalTransaction> {
    this.assertSignatures();
    const multisigInput = this.getTransactionDetails();

    const txData = new Interface(MinimumViableMultisig.abi).functions.execTransaction.encode([
      multisigInput.to,
      multisigInput.value,
      multisigInput.data,
      multisigInput.operation,
      this.signatures,
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

  private async assertSignatures() {
    if (!this.signatures || this.signatures.length === 0) {
      throw new Error(`No signatures detected`);
    }
  }
}
