import { OutcomeType } from "@connext/types";
import { getRandomAddress, toBN } from "@connext/utils";
import { utils, constants } from "ethers";

import { AppInstance } from "./app-instance";
import { getRandomPublicIdentifier } from "../testing/random-signing-keys";

describe("AppInstance", () => {
  it("should be able to instantiate", () => {
    const participants = [getRandomPublicIdentifier(), getRandomPublicIdentifier()];

    const appInstance = new AppInstance(
      /* initiator */ participants[0],
      /* responder*/ participants[1],
      /* default timeout */ toBN(Math.ceil(Math.random() * 2e10)).toHexString(),
      /* appInterface */ {
        addr: utils.getAddress(getRandomAddress()),
        stateEncoding: "tuple(address foo, uint256 bar)",
        actionEncoding: undefined,
      },
      /* appSeqNo */ Math.ceil(Math.random() * 2e10),
      /* latestState */ { foo: utils.getAddress(getRandomAddress()), bar: 0 },
      /* latestVersionNumber */ 999,
      /* stateTimeout */ toBN(Math.ceil(1000 * Math.random())).toHexString(),
      /* outcomeType */ OutcomeType.TWO_PARTY_FIXED_OUTCOME,
      /* multisigAddress */ utils.getAddress(getRandomAddress()),
      /* twoPartyOutcomeInterpreterParamsInternal */ {
        playerAddrs: [constants.AddressZero, constants.AddressZero],
        amount: constants.Zero,
        tokenAddress: constants.AddressZero,
      },
      /* multiAssetMultiPartyCoinTransferInterpreterParamsInternal */ undefined,
      /* singleAssetTwoPartyCoinTransferInterpreterParamsInternal */ undefined,
    );

    expect(appInstance).not.toBe(null);
    expect(appInstance).not.toBe(undefined);
    expect(appInstance.initiatorIdentifier).toBe(participants[0]);
    expect(appInstance.responderIdentifier).toBe(participants[1]);

    // TODO: moar tests pl0x
  });
});
