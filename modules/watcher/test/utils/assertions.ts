import { waffleChai } from "@ethereum-waffle/chai";
import { use } from "chai";
import { Contract, Wallet } from "ethers";
import { MinimumViableMultisig } from "@connext/contracts";
import {
  CONVENTION_FOR_ETH_ASSET_ID,
  StateProgressedEventData,
  ChallengeUpdatedEventData,
  StoredAppChallengeStatus,
  StoredAppChallenge,
  SetStateCommitmentJSON,
  JsonRpcProvider,
  ChallengeProgressedEventData,
  Bytes32,
  Address,
  TransactionResponse,
} from "@connext/types";
import { expect } from "chai";
import { Zero, HashZero } from "ethers/constants";
import { BigNumber } from "ethers/utils";
import { ChannelSigner, toBN } from "@connext/utils";
import { AppWithCounterClass } from "./appWithCounter";
import { NetworkContextForTestSuite } from "./contracts";

/////////////////////////////
//// Assertions

use(require("chai-as-promised"));
use(require("chai-subset"));
use(waffleChai);

export { expect } from "chai";

/////////////////////////////
//// Assertion Fns
export const verifyOnchainBalancesPostChallenge = async (
  multisigAddress: string,
  signers: ChannelSigner[],
  expected: { [assetId: string]: BigNumber },
  wallet: Wallet,
) => {
  const withdrawn = await new Contract(
    multisigAddress,
    MinimumViableMultisig.abi,
    wallet,
  ).functions.totalAmountWithdrawn(CONVENTION_FOR_ETH_ASSET_ID);
  expect(withdrawn).to.be.eq(expected[CONVENTION_FOR_ETH_ASSET_ID]);
  expect(await wallet.provider.getBalance(multisigAddress)).to.be.eq(Zero);
  expect(await wallet.provider.getBalance(signers[0].address)).to.be.eq(
    expected[CONVENTION_FOR_ETH_ASSET_ID],
  );
  expect(await wallet.provider.getBalance(signers[1].address)).to.be.eq(Zero);
};

export const verifyStateProgressedEvent = async (
  app: AppWithCounterClass,
  event: StateProgressedEventData,
  networkContext: NetworkContextForTestSuite,
) => {
  const setState = await app.getSingleSignedSetState(networkContext.ChallengeRegistry);
  expect(event).to.containSubset({
    identityHash: app.identityHash,
    action: AppWithCounterClass.encodeAction(app.latestAction!),
    versionNumber: setState.versionNumber,
    timeout: setState.stateTimeout,
    turnTaker: app.signerParticipants[0].address,
    signature: setState.signatures.filter((x) => !!x)[0],
  });
};

export const verifyChallengeUpdatedEvent = async (
  setState: SetStateCommitmentJSON,
  event: ChallengeUpdatedEventData,
  provider: JsonRpcProvider,
) => {
  const current = await provider.getBlockNumber();
  expect(event).to.containSubset({
    identityHash: setState.appIdentityHash,
    appStateHash: setState.appStateHash,
    versionNumber: toBN(setState.versionNumber),
    status: StoredAppChallengeStatus.IN_DISPUTE,
    finalizesAt: toBN(setState.stateTimeout).add(current),
  });
};

export const verifyCancelChallenge = (
  app: AppWithCounterClass,
  contractEvent: ChallengeUpdatedEventData,
  challenge: StoredAppChallenge,
) => {
  const expectedChallenge = {
    identityHash: app.identityHash,
    appStateHash: HashZero,
    versionNumber: Zero,
    status: StoredAppChallengeStatus.NO_CHALLENGE,
    finalizesAt: Zero,
  };
  expect(challenge).to.containSubset(expectedChallenge);
  expect(contractEvent).to.containSubset(expectedChallenge);
};

export const verifyChallengeProgressedEvent = (
  appInstanceId: Bytes32,
  multisigAddress: Address,
  event: ChallengeProgressedEventData,
  transaction?: TransactionResponse,
) => {
  const expected = {
    appInstanceId,
    multisigAddress,
  };
  if (transaction) {
    expected["transaction"] = transaction;
  } else {
    expect(event.transaction).to.be.ok;
  }
  expect(event).to.containSubset(expected);
};
