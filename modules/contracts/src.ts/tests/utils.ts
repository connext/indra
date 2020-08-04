import { AppIdentity, ChallengeStatus, TwoPartyFixedOutcome } from "@connext/types";
import { recoverAddressFromChannelMessage, toBN } from "@connext/utils";
import { waffle as buidler } from "@nomiclabs/buidler";
import * as chai from "chai";
import { solidity } from "ethereum-waffle";
import { use } from "chai";
import { BigNumber, constants, utils } from "ethers";

const { HashZero, Zero } = constants;
const { defaultAbiCoder, keccak256, solidityPack } = utils;

use(require("chai-subset"));
use(solidity);

export const expect = chai.use(solidity).expect;

export const provider = buidler.provider;

export const mkAddress = (prefix: string = "0xa") : string => {
  return prefix.padEnd(42, "0");
}

export const mineBlocks = async (n: number = 1) => {
  for (let i = 0; i < n; i++) {
    await provider.send("evm_mine", []);
  }
};

export const snapshot = async () => await provider.send("evm_snapshot", []);

export const restore = async (snapshotId: any) => await provider.send("evm_revert", [snapshotId]);

export const sortSignaturesBySignerAddress = async (
  digest: string,
  signatures: string[],
): Promise<string[]> => {
  return (
    await Promise.all(
      signatures.map(async (sig) => ({
        sig,
        addr: await recoverAddressFromChannelMessage(digest, sig),
      })),
    )
  )
    .sort((a, b) => (toBN(a.addr).lt(toBN(b.addr)) ? -1 : 1))
    .map((x) => x.sig);
};

export const emptyChallenge = {
  appStateHash: HashZero,
  finalizesAt: Zero,
  status: ChallengeStatus.NO_CHALLENGE,
  versionNumber: Zero,
};

////////////////////////////////////////
// Example counter app for testing adjudicator

// App State With Action types for testing
export type AppWithCounterState = {
  counter: BigNumber;
};

export const encodeState = (state: AppWithCounterState) => {
  return defaultAbiCoder.encode([`tuple(uint256 counter)`], [state]);
};

export enum ActionType {
  SUBMIT_COUNTER_INCREMENT,
  ACCEPT_INCREMENT,
}

export type AppWithCounterAction = {
  actionType: ActionType;
  increment: BigNumber;
};

export const encodeAction = (action: AppWithCounterAction) => {
  return defaultAbiCoder.encode([`tuple(uint8 actionType, uint256 increment)`], [action]);
};

export const encodeOutcome = () => {
  return defaultAbiCoder.encode([`uint`], [TwoPartyFixedOutcome.SEND_TO_ADDR_ONE]);
};

export class AppWithCounterClass {
  constructor(
    readonly participants: string[],
    readonly multisigAddress: string,
    readonly appDefinition: string,
    readonly defaultTimeout: number,
    readonly channelNonce: number,
  ) {}
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
      defaultTimeout: toBN(this.defaultTimeout),
      channelNonce: toBN(this.channelNonce),
    };
  }
}
