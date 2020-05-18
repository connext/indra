import { utils } from "ethers";

/////////////////////////////
//// Helper functions

export const randomState = (numBytes: number = 64) => utils.hexlify(utils.randomBytes(numBytes));

export const stateToHash = (state: string) => utils.keccak256(state);

export const nullify = (key: string, value: any) => (typeof value === "undefined" ? null : value);

/////////////////////////////
//// Constants

// ProxyFactory.createProxy uses assembly `call` so we can't estimate
// gas needed, so we hard-code this number to ensure the tx completes
export const CREATE_PROXY_AND_SETUP_GAS = 1e6;
