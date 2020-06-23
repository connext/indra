import { OutcomeType } from "@connext/types";
import { getRandomAddress, toBN } from "@connext/utils";
import { constants, utils } from "ethers";

import { AppInstance } from "./app-instance";
import { getRandomPublicIdentifier } from "../testing/random-signing-keys";
import { expect } from "../testing/assertions";

const { AddressZero, Zero } = constants;
const { getAddress } = utils;

describe("AppInstance", () => {
  it("should be able to instantiate", () => {
    const participants = [getRandomPublicIdentifier(), getRandomPublicIdentifier()];

    const appInstance = new AppInstance(
      /* multisigAddres */ getRandomAddress(),
      /* initiator */ participants[0],
      /* initiatorDeposit */ "0",
      /* initiaotrDepositAssetId */ AddressZero,
      /* responder */ participants[1],
      /* responderDeposit */ "0",
      /* responderDepositAssetId */ AddressZero,
      /* abiEncodings */ {
        stateEncoding: "tuple(address foo, uint256 bar)",
        actionEncoding: undefined,
      },
      /* appDefinition */ getAddress(getRandomAddress()),
      /* appSeqNo */ Math.ceil(Math.random() * 2e10),
      /* latestState */ { foo: getRandomAddress(), bar: 0 },
      /* latestVersionNumber */ 999,
      /* defaultTimeout */ toBN(Math.ceil(Math.random() * 2e10)).toHexString(),
      /* stateTimeout */ toBN(Math.ceil(1000 * Math.random())).toHexString(),
      /* outcomeType */ OutcomeType.TWO_PARTY_FIXED_OUTCOME,
      /* interpreterParamsInternal*/ {
        playerAddrs: [AddressZero, AddressZero],
        amount: Zero,
        tokenAddress: AddressZero,
      },
      /* meta */ undefined,
      /* latestAction */ undefined,
    );

    expect(appInstance).not.eq(null);
    expect(appInstance).not.eq(undefined);
    expect(appInstance.initiatorIdentifier).eq(participants[0]);
    expect(appInstance.responderIdentifier).eq(participants[1]);

    // TODO: moar tests pl0x
  });
});
