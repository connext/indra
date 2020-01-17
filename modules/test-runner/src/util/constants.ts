import { parseEther } from "ethers/utils";

export const FUNDED_MNEMONICS = [
  "humble sense shrug young vehicle assault destroy cook property average silent travel",
  "roof traffic soul urge tenant credit protect conduct enable animal cinnamon adult",
];

export const WRONG_ADDRESS = "0xdeadbeef";

export const NEGATIVE_ONE = "-1";
export const NEGATIVE_ZERO_ZERO_ONE = "-0.01";

export const TEN = "10";
export const TWO = "2";
export const ONE = "1";
export const ZERO_ONE = "0.1";
export const ZERO_ZERO_TWO = "0.02";
export const ZERO_ZERO_ONE = "0.01";
export const ZERO_ZERO_ZERO_FIVE = "0.005";
export const ZERO_ZERO_ZERO_ONE = "0.001";

export const NEGATIVE_ONE_ETH = parseEther(NEGATIVE_ONE);
export const NEGATIVE_ZERO_ZERO_ONE_ETH = parseEther(NEGATIVE_ZERO_ZERO_ONE);

export const TEN_ETH = parseEther(TEN);
export const TWO_ETH = parseEther(TWO);
export const ONE_ETH = parseEther(ONE);
export const ZERO_ONE_ETH = parseEther(ZERO_ONE);
export const ZERO_ZERO_TWO_ETH = parseEther(ZERO_ZERO_TWO);
export const ZERO_ZERO_ONE_ETH = parseEther(ZERO_ZERO_ONE);
export const ZERO_ZERO_ZERO_FIVE_ETH = parseEther(ZERO_ZERO_ZERO_FIVE);
export const ZERO_ZERO_ZERO_ONE_ETH = parseEther(ZERO_ZERO_ZERO_ONE);

export const ETH_AMOUNT_SM = ZERO_ZERO_ONE_ETH;
export const ETH_AMOUNT_MD = ZERO_ONE_ETH;
export const ETH_AMOUNT_LG = ONE_ETH;
export const TOKEN_AMOUNT = TEN_ETH;

// Messaging constants
export const CREATE_RESPONDER_COUNT = ONE; // responder sends 1 message
export const CREATE_INITIATOR_COUNT = ONE; // initiator sends 1 message
