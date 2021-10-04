import { connect } from "@connext/client";
import { ColorfulLogger, getRandomChannelSigner } from "@connext/utils";
import { BigNumber } from "ethers";
import { getMemoryStore } from "@connext/store";
import {
  ClientOptions,
  IConnextClient,
  AssetId,
  CONVENTION_FOR_ETH_ASSET_ID,
} from "@connext/types";

import { env, ethProviderUrl, expect, ethProvider, sugarDaddy } from ".";
import { parseEther } from "ethers/lib/utils";

export const TEN = "10";
export const TWO = "2";
export const ONE = "1";
export const ZERO_ONE = "0.1";
export const ZERO_ZERO_TWO = "0.02";
export const ZERO_ZERO_ONE = "0.01";
export const ZERO_ZERO_ZERO_FIVE = "0.005";
export const ZERO_ZERO_ZERO_ONE = "0.001";

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

export const getClient = async (
  id: string = "",
  overrides: Partial<ClientOptions> = {},
  fundAmount: BigNumber = ETH_AMOUNT_MD,
): Promise<IConnextClient> => {
  const log = new ColorfulLogger("getClient", env.logLevel, true, "T");
  const client = await connect({
    store: getMemoryStore(),
    signer: getRandomChannelSigner(ethProvider),
    ethProviderUrl,
    messagingUrl: env.messagingUrl,
    nodeUrl: env.nodeUrl,
    loggerService: new ColorfulLogger("", env.logLevel, true, id),
    ...overrides,
  });

  if (fundAmount.gt(0)) {
    const tx = await sugarDaddy.sendTransaction({
      to: client.signerAddress,
      value: fundAmount,
    });
    await ethProvider.waitForTransaction(tx.hash);

    log.info(`Created client: ${client.publicIdentifier}`);
    expect(client.signerAddress).to.be.a("string");
  }

  return client;
};

export const fundChannel = async (
  client: IConnextClient,
  amount: BigNumber = ETH_AMOUNT_SM,
  assetId: AssetId = CONVENTION_FOR_ETH_ASSET_ID,
) => {
  const { [client.signerAddress]: preBalance } = await client.getFreeBalance(assetId);
  const depositRes = await client.deposit({
    assetId,
    amount,
  });
  expect(depositRes.transaction).to.be.ok;
  const postBalance = await depositRes.completed();
  expect(preBalance.add(amount)).to.eq(postBalance.freeBalance[client.signerAddress]);
};
