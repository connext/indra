import { hexlify, keccak256, randomBytes } from "ethers/utils";

/////////////////////////////
//// Helper functions

export const randomState = (numBytes: number = 64) => hexlify(randomBytes(numBytes));

export const stateToHash = (state: string) => keccak256(state);

/////////////////////////////
//// Constants

// ProxyFactory.createProxy uses assembly `call` so we can't estimate
// gas needed, so we hard-code this number to ensure the tx completes
export const CREATE_PROXY_AND_SETUP_GAS = 1e6;