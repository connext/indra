import { AppABIEncodings } from "@connext/types";
import { BigNumber, BigNumberish, constants } from "ethers";

const { Zero } = constants;

const singleAssetTwoPartyCoinTransferEncoding = `
tuple(address to, uint256 amount)[2]
`;

export const simpleTransferAbiEncodings: AppABIEncodings = {
  stateEncoding: `
    tuple(
      ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers
    )`,
  actionEncoding: "",
};

export function initialSimpleTransferState(
  senderAddr: string,
  receiverAddr: string,
  amount: BigNumberish = 1,
) {
  return {
    coinTransfers: [
      {
        amount: BigNumber.from(amount),
        to: senderAddr,
      },
      {
        to: receiverAddr,
        amount: Zero,
      },
    ],
  };
}
