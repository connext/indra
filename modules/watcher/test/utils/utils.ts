/////////////////////////////
//// Helper functions

import { hexlify, keccak256, randomBytes } from "ethers/utils";

export const randomState = (numBytes: number = 64) => hexlify(randomBytes(numBytes));

export const stateToHash = (state: string) => keccak256(state);
