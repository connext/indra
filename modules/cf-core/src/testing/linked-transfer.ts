import { AppABIEncodings } from "@connext/types";
import { createRandom32ByteHexString } from "@connext/utils";
import { Zero, AddressZero } from "ethers/constants";
import { bigNumberify, BigNumberish, solidityKeccak256 } from "ethers/utils";

const singleAssetTwoPartyCoinTransferEncoding = `
tuple(address to, uint256 amount)[2]
`;

export const linkedAbiEncodings: AppABIEncodings = {
  stateEncoding: `
    tuple(
      uint8 stage,
      ${singleAssetTwoPartyCoinTransferEncoding} transfers,
      bytes32 linkedHash,
      uint256 turnNum,
      bool finalized
    )`,
  actionEncoding: `
    tuple(
      uint256 amount,
      address assetId,
      bytes32 paymentId,
      bytes32 preImage
    )`,
};

export function validAction(
  amount: BigNumberish = 1,
  assetId: string = AddressZero,
) {
  return {
    assetId,
    amount: bigNumberify(amount),
    paymentId: createRandom32ByteHexString(),
    preImage: createRandom32ByteHexString(),
  };
}

function createLinkedHash(
  action: any, // SolidityValueType <-- y no work
  // SHOULD BE TYPE OF ABOVE, NOT SURE WHERE TO GET / PUT APP TYPES
): string {
  return solidityKeccak256(
    ["uint256", "address", "bytes32", "bytes32"],
    [action.amount, action.assetId, action.paymentId, action.preImage],
  );
}

export function initialLinkedState(
  senderAddr: string,
  redeemerAddr: string,
  amount: BigNumberish = 1,
  assetId: string = AddressZero,
) {
  const action = validAction(amount, assetId);
  const linkedHash = createLinkedHash(action);
  return {
    action,
    state: {
      linkedHash,
      stage: 0, // POST_FUND
      finalized: false,
      turnNum: Zero,
      transfers: [
        {
          amount: bigNumberify(amount),
          to: senderAddr,
        },
        {
          amount: Zero,
          to: redeemerAddr,
        },
      ],
    },
  };
}
