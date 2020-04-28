import { AppIdentity, BigNumber } from "@connext/types";
import { defaultAbiCoder, solidityPack, keccak256 } from "ethers/utils";

/////////////////////////////
//// Helper class

export class AppWithCounterClass {
  get identityHash(): string {
    return keccak256(
      solidityPack(
        ["address", "uint256", "bytes32", "address", "uint256"],
        [
          this.multisigAddress,
          this.channelNonce,
          keccak256(solidityPack(["address[]"], [this.participants])),
          this.appDefinition,
          this.defaultTimeout,
        ],
      ),
    );
  }

  get appIdentity(): AppIdentity {
    return {
      participants: this.participants,
      multisigAddress: this.multisigAddress,
      appDefinition: this.appDefinition,
      defaultTimeout: this.defaultTimeout,
      channelNonce: this.channelNonce,
    };
  }

  public static encodeState(state: AppWithCounterState) {
    return defaultAbiCoder.encode([`tuple(uint256 counter)`], [state]);
  }

  public static encodeAction(action: AppWithCounterAction) {
    return defaultAbiCoder.encode([`tuple(uint8 actionType, uint256 increment)`], [action]);
  }

  constructor(
    readonly participants: string[],
    readonly multisigAddress: string,
    readonly appDefinition: string,
    readonly defaultTimeout: BigNumber,
    readonly channelNonce: BigNumber,
  ) {}
}

export type AppWithCounterAction = {
  actionType: ActionType;
  increment: BigNumber;
};


export type AppWithCounterState = {
  counter: BigNumber;
};

export enum ActionType {
  SUBMIT_COUNTER_INCREMENT,
  ACCEPT_INCREMENT,
}
