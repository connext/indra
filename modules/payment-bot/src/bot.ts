import { Node as NodeTypes } from "@counterfactual/types";

import { getConnextClient } from "./";

export const delay = (ms: number): Promise<void> =>
  new Promise((res: any): any => setTimeout(res, ms));

export function registerClientListeners(): void {
  const client = getConnextClient();
  client.on(
    NodeTypes.EventName.PROPOSE_INSTALL_VIRTUAL,
    async (data: NodeTypes.ProposeInstallVirtualResult) => {
      console.log(`Bot event caught: ${NodeTypes.EventName.PROPOSE_INSTALL_VIRTUAL}`);
      const appInstanceId = data.appInstanceId;
      console.log("Installing appInstanceId:", appInstanceId);
      await client.installVirtualApp(appInstanceId);
      // TODO: why doesnt the event for install virtual get emitted
      // in your node if you send the install first??
      while ((await client.getAppInstances()).length === 0) {
        console.log("no new apps found for client, waiting one second and trying again...");
        await delay(1000);
      }
      client.logEthFreeBalance(await client.getFreeBalance());
    },
  );

  client.on(
    NodeTypes.EventName.UNINSTALL_VIRTUAL,
    async (data: NodeTypes.UninstallVirtualResult) => {
      console.log(`Bot event caught: ${NodeTypes.EventName.UNINSTALL_VIRTUAL}`);
      while ((await client.getAppInstances()).length > 0) {
        console.log(
          "app still found in client, waiting 1s to uninstall. open apps: ",
          (await client.getAppInstances()).length,
        );
        await delay(1000);
      }
      client.logEthFreeBalance(await client.getFreeBalance());
    },
  );

  client.on(NodeTypes.EventName.WITHDRAWAL_CONFIRMED, async (data: any) => {
    client.logEthFreeBalance(await client.getFreeBalance());
  });

  if (
    client.listener.listenerCount(NodeTypes.EventName.PROPOSE_INSTALL_VIRTUAL) === 0 ||
    client.listener.listenerCount(NodeTypes.EventName.UNINSTALL_VIRTUAL) === 0 ||
    client.listener.listenerCount(NodeTypes.EventName.WITHDRAWAL_CONFIRMED) === 0
  ) {
    throw Error("Listeners failed to register.");
  }
}