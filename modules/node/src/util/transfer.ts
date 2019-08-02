import { UnidirectionalLinkedTransferAppActionBigNumber } from "@connext/types";
import { solidityKeccak256 } from "ethers/utils";

export const createLinkedHash = (
  action: UnidirectionalLinkedTransferAppActionBigNumber,
): string => {
  return solidityKeccak256(
    ["uint256", "address", "bytes32", "bytes32"],
    [action.amount, action.assetId, action.paymentId, action.preImage],
  );
};