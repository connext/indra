import { providers, BigNumber } from "ethers";
import { getRandomBytes32, getRandomAddress } from "@connext/utils";

export const getTestTransactionRequest = (
  overrides: Partial<providers.TransactionRequest> = {},
): providers.TransactionRequest => {
  return {
    chainId: 1337,
    data: getRandomBytes32(),
    from: getRandomAddress(),
    gasLimit: BigNumber.from(100),
    gasPrice: BigNumber.from(100),
    nonce: 1,
    to: getRandomAddress(),
    value: BigNumber.from(10),
    ...overrides,
  };
};

export const getTestTransactionResponse = (
  overrides: Partial<providers.TransactionResponse> = {},
): providers.TransactionResponse => {
  return {
    hash: getRandomBytes32(),
    blockHash: getRandomBytes32(),
    blockNumber: 1,
    raw: getRandomBytes32(),
    chainId: 1337,
    data: getRandomBytes32(),
    to: getRandomAddress(),
    value: BigNumber.from(10),
    confirmations: 1,
    from: getRandomAddress(),
    gasLimit: BigNumber.from(100),
    gasPrice: BigNumber.from(100),
    nonce: 1,
    wait: () => undefined,
    ...overrides,
  };
};
