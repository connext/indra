import { OutcomeType, createRandomAddress, toBN } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";
import { getAddress } from "ethers/utils";

import { AppInstance } from "./app-instance";

describe("AppInstance", () => {
  it("should be able to instantiate", () => {
    const participants = [getAddress(createRandomAddress()), getAddress(createRandomAddress())];

    const appInstance = new AppInstance(
      /* initiator */ participants[0],
      /* responder*/ participants[1],
      /* default timeout */ toBN(Math.ceil(Math.random() * 2e10)).toHexString(),
      /* appInterface */ {
        addr: getAddress(createRandomAddress()),
        stateEncoding: "tuple(address foo, uint256 bar)",
        actionEncoding: undefined,
      },
      /* appSeqNo */ Math.ceil(Math.random() * 2e10),
      /* latestState */ { foo: getAddress(createRandomAddress()), bar: 0 },
      /* latestVersionNumber */ 999,
      /* stateTimeout */ toBN(Math.ceil(1000 * Math.random())).toHexString(),
      /* outcomeType */ OutcomeType.TWO_PARTY_FIXED_OUTCOME,
      /* multisigAddress */ getAddress(createRandomAddress()),
      /* twoPartyOutcomeInterpreterParamsInternal */ {
        playerAddrs: [AddressZero, AddressZero],
        amount: Zero,
        tokenAddress: AddressZero,
      },
      /* multiAssetMultiPartyCoinTransferInterpreterParamsInternal */ undefined,
      /* singleAssetTwoPartyCoinTransferInterpreterParamsInternal */ undefined,
    );

    expect(appInstance).not.toBe(null);
    expect(appInstance).not.toBe(undefined);
    expect(appInstance.initiator).toBe(participants[0]);
    expect(appInstance.responder).toBe(participants[1]);

    // TODO: moar tests pl0x
  });
});
