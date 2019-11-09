import { BigNumber, solidityKeccak256 } from "ethers/utils";

export const createLinkedHash = (
  amount: BigNumber,
  assetId: string,
  paymentId: string,
  preImage: string,
): string => {
  return solidityKeccak256(
    ["uint256", "address", "bytes32", "bytes32"],
    [amount, assetId, paymentId, preImage],
  );
};