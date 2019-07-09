import { Node as NodeTypes, SolidityABIEncoderV2Type } from "@counterfactual/types";
import { utils } from "ethers";
import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";
import inquirer from "inquirer";

import { getConnextClient } from "./";

interface Transfers {
  to: string;
  amount: BigNumber;
}

type AppState = SolidityABIEncoderV2Type & {
  transfers: Transfers[];
  finalized: boolean;
};

let currentPrompt: any;

export function getCurrentPrompt(): any {
  return currentPrompt;
}

export function closeCurrentPrompt(): void {
  const p = getCurrentPrompt();
  if (!p || !p.ui) return;

  p.ui.close();
}

export const delay = (ms: number): Promise<void> =>
  new Promise((res: any): any => setTimeout(res, ms));

export async function showMainPrompt(): Promise<any> {
  const client = getConnextClient();
  const appInstances = await client.getAppInstances();
  if (appInstances && appInstances.length > 0) {
    showAppInstancesPrompt();
  } else {
    showDirectionPrompt();
  }
}

export async function showAppInstancesPrompt(): Promise<any> {
  closeCurrentPrompt();
  const client = getConnextClient();
  const appInstances = await client.getAppInstances();

  if (appInstances.length === 0) {
    return;
  }

  currentPrompt = inquirer.prompt({
    choices: appInstances.map((app: any): any => app.identityHash),
    message: "Select a payment thread to view options",
    name: "viewApp",
    type: "list",
  });
  currentPrompt.then((answers: any) => {
    const { viewApp } = answers as Record<string, string>;
    showAppOptions(viewApp);
  });
}

function logThreadBalances(balances: AppState): void {
  const senderBalance = balances.transfers[0].amount
    ? utils.formatEther(balances.transfers[0].amount)
    : utils.formatEther(balances.transfers[0][1]);

  const receiverBalance = balances.transfers[1].amount
    ? utils.formatEther(balances.transfers[1].amount)
    : utils.formatEther(balances.transfers[1][1]);
  console.log(`Balances: Sender - ${senderBalance}, Receiver - ${receiverBalance}`);
}

async function showAppOptions(appId: string): Promise<any> {
  closeCurrentPrompt();
  const client = getConnextClient();
  const getAppInstancesResult = await client.getAppInstanceDetails(appId);
  console.log("getAppInstancesResult: ", getAppInstancesResult);
  const choices = ["balances", "uninstall"];
  if (
    // TODO: make this comparison more resilient
    !new BigNumber((getAppInstancesResult.appInstance as any).myDeposit).isZero()
  ) {
    choices.unshift("send");
  }

  const getStateResult = await client.getAppState(appId);

  currentPrompt = inquirer.prompt({
    choices,
    message: "Select an action to take",
    name: "viewOptions",
    type: "list",
  });

  currentPrompt.then(
    async (answers: any): Promise<any> => {
      const { viewOptions } = answers as Record<string, string>;
      if (viewOptions === "balances") {
        logThreadBalances(getStateResult.state as AppState);
        showAppOptions(appId);
      } else if (viewOptions === "send") {
        logThreadBalances(getStateResult.state as AppState);
        showSendPrompt(appId);
      } else if (viewOptions === "uninstall") {
        await uninstallVirtualApp(appId);
      }
    },
  );
}

async function showSendPrompt(appId: string): Promise<any> {
  closeCurrentPrompt();
  const client = getConnextClient();

  currentPrompt = inquirer.prompt({
    message: "Amount to send",
    name: "sendInVirtualApp",
    type: "input",
  });

  currentPrompt.then(
    async (answers: any): Promise<any> => {
      const { sendInVirtualApp } = answers as Record<string, string>;
      await client.takeAction(appId, {
        finalize: false,
        transferAmount: utils.parseEther(sendInVirtualApp),
      });
    },
  );
}

export async function showDirectionPrompt(): Promise<void> {
  closeCurrentPrompt();
  currentPrompt = inquirer.prompt([
    {
      choices: ["receiving", "sending", "withdrawing"],
      message: "Are you sending payments, receiving payments, or withdrawing?",
      name: "direction",
      type: "list",
    },
  ]);

  currentPrompt.then(async (answers: any): Promise<any> => {
    if ((answers as Record<string, string>).direction === "sending") {
      await showTransferPrompt();
    } else if ((answers as Record<string, string>).direction === "receiving") {
      console.log("Waiting to receive virtual install request...");
    } else {
      await showWithdrawalPrompt();
    }
  });
}

export async function showWithdrawalPrompt(): Promise<void> {
  closeCurrentPrompt();
  currentPrompt = inquirer.prompt([
    {
      message: "Enter withdrawal amount:",
      name: "amount",
      type: "input",
    },
    {
      message: "Enter withdrawal recipient (optional):",
      name: "recipient",
      type: "input",
    },
  ]);

  currentPrompt.then((answers: any): void => {
    const { recipient, amount } = answers as Record<string, string>;
    withdrawBalance(amount, recipient);
  });
}

export async function showTransferPrompt(): Promise<void> {
  closeCurrentPrompt();
  currentPrompt = inquirer.prompt([
    {
      message: "Enter counterparty public identifier:",
      name: "counterpartyPublicId",
      type: "input",
    },
    {
      message: "Enter Party A deposit amount:",
      name: "depositPartyA",
      type: "input",
    },
  ]);

  currentPrompt.then((answers: any): void => {
    const { counterpartyPublicId, depositPartyA } = answers as Record<string, string>;
    clientTransfer(depositPartyA, counterpartyPublicId);
  });
}

async function clientTransfer(deposit: string, counterparty: string): Promise<any> {
  const client = getConnextClient();
  const res = await client.transfer({
    amount: utils.parseEther(deposit).toString(),
    recipient: counterparty,
  });
  console.log("client.transfer returns:", JSON.stringify(res, null, 2));
}

async function withdrawBalance(amount: string, recipient: string | undefined): Promise<any> {
  const client = getConnextClient();
  const channel = await client.withdraw({
    amount: utils.parseEther(amount).toString(),
    recipient,
  });
  console.log(`withdraw returns: ${JSON.stringify(channel, null, 2)}`);
}

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
      await showAppInstancesPrompt();
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
      await showMainPrompt();
    },
  );

  client.on(NodeTypes.EventName.WITHDRAWAL_CONFIRMED, async (data: any) => {
    await showMainPrompt();
  });

  if (
    client.listener.listenerCount(NodeTypes.EventName.PROPOSE_INSTALL_VIRTUAL) === 0 ||
    client.listener.listenerCount(NodeTypes.EventName.UNINSTALL_VIRTUAL) === 0 ||
    client.listener.listenerCount(NodeTypes.EventName.WITHDRAWAL_CONFIRMED) === 0
  ) {
    throw Error("Listeners failed to register.");
  }
}

async function uninstallVirtualApp(appInstanceId: string): Promise<any> {
  const client = getConnextClient();
  const appState = await client.getAppState(appInstanceId);
  if (!appState.state.finalized) {
    await client.takeAction(appInstanceId, {
      finalize: true,
      transferAmount: Zero,
    });
  }
  await client.uninstallVirtualApp(appInstanceId);

  while ((await client.getAppInstances()).length > 0) {
    console.log(
      "app still found in client, waiting 1s to uninstall. open apps: ",
      (await client.getAppInstances()).length,
    );
    await delay(1000);
  }

  await showMainPrompt();
}
