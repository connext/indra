import { parseEther } from "ethers/utils";

export const FUNDED_MNEMONICS = [
  "humble sense shrug young vehicle assault destroy cook property average silent travel",
  "roof traffic soul urge tenant credit protect conduct enable animal cinnamon adult",
];

export const WRONG_ADDRESS = "0xdeadbeef";

export const NEGATIVE_ONE = "-1";
export const NEGATIVE_ZERO__ZERO_ONE = "-0.01";

export const TEN = "10";
export const TWO = "2";
export const ONE = "1";
export const ZERO_ONE = "0.1";
export const ZERO_ZERO_TWO = "0.02";
export const ZERO_ZERO_ONE = "0.01";
export const ZERO_ZERO_ZERO_FIVE = "0.005";
export const ZERO_ZERO_ZERO_ONE = "0.001";

export const ETH_AMOUNT_SM = parseEther(ZERO_ZERO_ONE);
export const ETH_AMOUNT_MD = parseEther(ZERO_ONE);
export const ETH_AMOUNT_LG = parseEther(ONE);
export const TOKEN_AMOUNT = parseEther(TEN);
