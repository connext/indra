/////////////////////////////
//// Helper functions

import { utils } from "ethers";

export const randomState = (numBytes: number = 64) => utils.hexlify(utils.randomBytes(numBytes));

export const stateToHash = (state: string) => utils.keccak256(state);
