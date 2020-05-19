import { parseEther } from "ethers/utils";
import { CF_METHOD_TIMEOUT } from "@connext/types";

export const FUNDED_MNEMONICS = [
  "humble sense shrug young vehicle assault destroy cook property average silent travel",
  "roof traffic soul urge tenant credit protect conduct enable animal cinnamon adult",
];

export const WRONG_ADDRESS = "0xdeadbeef";

// error messages
export const APP_PROTOCOL_TOO_LONG = (protocol: string): string => {
  if (protocol === `takeAction`) {
    return `Couldn't run TakeAction protocol: IO_SEND_AND_WAIT timed out after ${CF_METHOD_TIMEOUT/1000}s`;
  }
  return `App ${protocol} took longer than ${CF_METHOD_TIMEOUT/1000} seconds`;
};
export const MESSAGE_FAILED_TO_SEND = (reason?: string): string =>
  `Failed to send message: ${reason}`;
export const NODE_HAS_RIGHTS_ERROR = `Cannot uninstall a balance refund app without being the recipient`;

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
export const TOKEN_AMOUNT_SM = ONE_ETH;
export const COLLATERAL_AMOUNT_TOKEN = TEN_ETH.mul(TWO);

// Messaging constants
export const SETUP_RESPONDER_RECEIVED_COUNT = 1;
export const SETUP_RESPONDER_SENT_COUNT = 1;
// - propose 1 sent, 1 received (initiator)
export const PROPOSE_INSTALL_SUPPORTED_APP_COUNT_RECEIVED = 1;
export const PROPOSE_INSTALL_SUPPORTED_APP_COUNT_SENT = 1;
// - install 2 sent, 2 received (responder)
export const INSTALL_SUPPORTED_APP_COUNT_RECEIVED = 2;
export const INSTALL_SUPPORTED_APP_COUNT_SENT = 2;
// - install 1 sent, 1 received (initiator)
export const UNINSTALL_SUPPORTED_APP_COUNT_RECEIVED = 1;
export const UNINSTALL_SUPPORTED_APP_COUNT_SENT = 1;
