import { Interface, Signature } from "ethers/utils";

import { ConditionalTransactionDelegateTarget } from "../contracts";
import { AppIdentity, MultisigOperation, MultisigTransaction, NetworkContext } from "../types";

import { MultisigCommitment } from "./multisig-commitment";
import { appIdentityToHash } from "./utils";

const iface = new Interface(ConditionalTransactionDelegateTarget.abi);

export class SetupCommitment extends MultisigCommitment {
  public constructor(
    public readonly networkContext: NetworkContext,
    public readonly multisigAddress: string,
    public readonly multisigOwners: string[],
    public readonly freeBalanceAppIdentity: AppIdentity,
    private _signatures: Signature[] = [],
  ) {
    super(multisigAddress, multisigOwners);
  }

  get signatures() {
    return this._signatures;
  }

  set signatures(sigs: Signature[]) {
    if (sigs.length !== 2) {
      throw new Error(
        `Setup commitment received incorrect number of sigs. Expected 2, got ${sigs.length}`,
      );
    }
    this._signatures = sigs;
  }

  public getTransactionDetails(): MultisigTransaction {
    return {
      data: iface.functions.executeEffectOfFreeBalance.encode([
        this.networkContext.ChallengeRegistry,
        appIdentityToHash(this.freeBalanceAppIdentity),
        this.networkContext.MultiAssetMultiPartyCoinTransferInterpreter,
      ]),
      operation: MultisigOperation.DelegateCall,
      to: this.networkContext.ConditionalTransactionDelegateTarget,
      value: 0,
    };
  }
}
