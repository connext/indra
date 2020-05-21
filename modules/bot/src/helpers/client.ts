import { connect } from "@connext/client";
import { getFileStore } from "@connext/store";
import { IConnextClient } from "@connext/types";
import { ColorfulLogger } from "@connext/utils";
import { AddressZero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { BigNumber } from "ethers/utils";

export const createClient = async (
  privateKey: string,
  name: string,
  log: ColorfulLogger,
  transferAmount: BigNumber,
  nodeUrl: string,
  ethProviderUrl: string,
  messagingUrl: string,
  logLevel: number,
): Promise<IConnextClient> => {
  const store = getFileStore(`.connext-store/${name}`);
  const client = await connect({
    ethProviderUrl,
    messagingUrl,
    nodeUrl,
    signer: privateKey,
    loggerService: new ColorfulLogger(name, logLevel, true, name),
    store,
  });

  const ethProvider = new JsonRpcProvider(ethProviderUrl);

  log.info(`Client ${name}:
      publicIdentifier: ${client.publicIdentifier}
      signer: ${client.signerAddress}
      nodeIdentifier: ${client.nodeIdentifier}
      nodeSignerAddress: ${client.nodeSignerAddress}`);

  let {
    [client.signerAddress]: clientFreeBalance,
    [client.nodeSignerAddress]: nodeFreeBalance,
  } = await client.getFreeBalance(AddressZero);
  log.info(`clientFreeBalance: ${clientFreeBalance}`);
  log.info(`nodeFreeBalance: ${nodeFreeBalance}`);
  if (clientFreeBalance.lt(transferAmount)) {
    log.info(
      `Client freeBalance ${clientFreeBalance} is less than transfer amount ${transferAmount}, attempting deposit`,
    );
    const ethBalance = await ethProvider.getBalance(client.signerAddress);
    log.info(`client.signerAddress ethBalance: ${ethBalance}`);

    const minSignerBalance = transferAmount.mul(2);
    if (ethBalance.lt(minSignerBalance)) {
      log.info(
        `Signer address onchain balance ${ethBalance} is less than min deposit amount ${minSignerBalance}, waiting for transfer`,
      );

      await new Promise((resolve) => {
        ethProvider.on(client.signerAddress, (balance) => {
          if (balance.gt(minSignerBalance)) {
            log.info(`Received transfer to signer address, new balance: ${balance}`);
            ethProvider.removeAllListeners(client.signerAddress);
            resolve();
          }
        });
      });
    }
    log.info(`Depositing....`);
    await client.deposit({ amount: transferAmount, assetId: AddressZero });
    ({
      [client.signerAddress]: clientFreeBalance,
      [client.nodeSignerAddress]: nodeFreeBalance,
    } = await client.getFreeBalance(AddressZero));
    log.info(`Finished depositing!`);
    log.info(`clientFreeBalance: ${clientFreeBalance}`);
    log.info(`nodeFreeBalance: ${nodeFreeBalance}`);
  }
  return client;
};
