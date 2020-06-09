import { AppABIEncodings, tidy } from "@connext/types";
import { getRandomBytes32 } from "@connext/utils";
import { BigNumber, BigNumberish, utils, constants } from "ethers";

const { Zero, AddressZero } = constants;
const { solidityKeccak256 } = utils;

const singleAssetTwoPartyCoinTransferEncoding = tidy(`
tuple(address to, uint256 amount)[2]
`);

export const linkedAbiEncodings: AppABIEncodings = {
  stateEncoding: tidy(`
    tuple(
      uint8 stage,
      ${singleAssetTwoPartyCoinTransferEncoding} transfers,
      bytes32 linkedHash,
      uint256 turnNum,
      bool finalized
    )`),
  actionEncoding: tidy(`
    tuple(
      uint256 amount,
      address assetId,
      bytes32 paymentId,
      bytes32 preImage
    )`),
};

export function validAction(amount: BigNumberish = 1, assetId: string = AddressZero) {
  return {
    assetId,
    amount: BigNumber.from(amount),
    paymentId: getRandomBytes32(),
    preImage: getRandomBytes32(),
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
          amount: BigNumber.from(amount),
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
