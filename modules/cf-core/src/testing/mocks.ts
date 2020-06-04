import { EXPECTED_CONTRACT_NAMES_IN_NETWORK_CONTEXT, ContractAddresses } from "@connext/types";
import { getRandomAddress } from "@connext/utils";
import { utils } from "ethers";

const { getAddress } = utils;

export const getRandomContractAddresses = (): ContractAddresses => {
  return EXPECTED_CONTRACT_NAMES_IN_NETWORK_CONTEXT.reduce(
    (acc, contractName) => ({
      ...acc,
      [contractName]: getAddress(getRandomAddress()),
    }),
    {} as ContractAddresses,
  );
};
