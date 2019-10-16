import * as Connext from "connext";
import { parseEther } from "ethers/utils";

export const migrate = async (hubUrl, mnemonic, ethUrl) => {
  const legacy = await Connext.createClient({ ethUrl, hubUrl, mnemonic });
  const state = await legacy.getState();
  const balance = parseEther(state.persistent.latestValidState.balanceTokenUser);
  console.log(`Legacy channel has a balance of $${balance}`);
  return legacy;
};
