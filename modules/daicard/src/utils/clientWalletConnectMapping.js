import WalletConnectBrowser from "@walletconnect/browser";
import { Node as NodeTypes } from "@counterfactual/types";

export let walletConnector = null;

export function initWalletConnect(uri, client) {
  walletConnector = new WalletConnectBrowser({ uri });

  registerWalletConnectListeners(client)
}

export function registerWalletConnectListeners(client) {
  walletConnector.on("session_request", (error, payload) => {
    if (error) {
      throw error;
    }
    displaySessionApproval(payload.params[0]);
  });

  // Subscribe to call requests
  walletConnector.on("call_request", async (error, payload) => {
    if (error) {
      throw error;
    }

    if (payload.method.startsWith("chan_")) {
      await mapPayloadToClient(payload, client);
    } else {
      walletConnector.rejectRequest({ id: payload.id });
    }
  });

  walletConnector.on("disconnect", (error, payload) => {
    if (error) {
      throw error;
    }

    // Delete walletConnector
    cleanWalletConnect();
  });
}

export function cleanWalletConnect() {
  // Delete walletConnector
  walletConnector = null;
  // delete url
  localStorage.removeItem(`wcUri`)
}

export function displaySessionApproval(payload) {
  verifyFields(payload, ["chainId"]);
  walletConnector.approveSession({ accounts: [], chainId: payload.chainId });
  //TODO: proc modal that approves the walletconnection from the wallet
}

function verifyFields(params, keys) {
  if (keys.length <= 0 || keys.filter(k => typeof k !== "string").length !== 0) {
    throw new Error(`[verifyFields] Must provide an array of fields to check`);
  }
  if (typeof params !== "object") {
    throw new Error(`[verifyFields] Must provide a params object`);
  }

  const naStr = keys.filter(k => !!!params[k]);
  if (naStr.length !== 0) {
    throw new Error(
      `[verifyFields] Params missing needed keys. Params: ${prettyPrint(
        params,
      )}, keys: ${prettyPrint(keys)}`,
    );
  }
  return;
}

function prettyPrint(obj) {
  return JSON.stringify(obj, null, 2);
}

async function mapPayloadToClient(payload, channel) {
  const { params, id, method } = payload;
  if (!params || typeof params !== "object") {
    throw new Error(`Invalid payload params. Payload: ${prettyPrint(payload)}`);
  }

  if (!id) {
    throw new Error(`Invalid payload id. Payload: ${prettyPrint(payload)}`);
  }

  if (!method || typeof method !== "string") {
    throw new Error(`Invalid payload method. Payload: ${prettyPrint(payload)}`);
  }

  let result;
  try {
    switch (method) {
      case "chan_store_set":
        verifyFields(params, ["pairs"]);
        const { pairs } = params;
        result = await channel.channelRouter.set(pairs);
        break;

      case "chan_store_get":
        verifyFields(params, ["path"]);
        const { path } = params;
        result = await channel.channelRouter.get(path);
        break;

      case "chan_node_auth":
        verifyFields(params, ["message"]);
        const { message } = params;
        result = await channel.channelRouter.signMessage(message);
        break;

      case "chan_config":
        result = await channel.channelProviderConfig(params);
        break;

      case NodeTypes.RpcMethodName.DEPOSIT:
        result = await channel.providerDeposit(params);
        break;
      case NodeTypes.RpcMethodName.GET_STATE:
        result = await channel.getState(params);
        break;
      case NodeTypes.RpcMethodName.GET_APP_INSTANCES:
        result = await channel.getAppInstances(params);
        break;
      case NodeTypes.RpcMethodName.GET_FREE_BALANCE_STATE:
        verifyFields(params, ["tokenAddress", "multisigAddress"]);
        const { tokenAddress } = params;
        result = await channel.getFreeBalance(tokenAddress);
        break;

      case NodeTypes.RpcMethodName.GET_PROPOSED_APP_INSTANCES:
        result = await channel.getProposedAppInstances(params);
        break;
      case NodeTypes.RpcMethodName.GET_APP_INSTANCE_DETAILS:
        result = await channel.getAppInstanceDetails(params);
        break;
      case NodeTypes.RpcMethodName.TAKE_ACTION:
        result = await channel.takeAction(params);
        break;
      case NodeTypes.RpcMethodName.UPDATE_STATE:
        result = await channel.updateState(params);
        break;
      case NodeTypes.RpcMethodName.PROPOSE_INSTALL:
        result = await channel.proposeInstallApp(params);
        break;
      case NodeTypes.RpcMethodName.INSTALL_VIRTUAL:
        result = await channel.installVirtualApp(params);
        break;
      case NodeTypes.RpcMethodName.INSTALL:
        result = await channel.installApp(params);
        break;
      case NodeTypes.RpcMethodName.UNINSTALL:
        result = await channel.uninstallApp(params);
        break;
      case NodeTypes.RpcMethodName.UNINSTALL_VIRTUAL:
        result = await channel.uninstallVirtualApp(params);
        break;
      case NodeTypes.RpcMethodName.REJECT_INSTALL:
        result = await channel.rejectInstallApp(params);
        break;
      case NodeTypes.RpcMethodName.WITHDRAW:
        result = await channel.providerWithdraw(params);
        break;
      case NodeTypes.RpcMethodName.WITHDRAW_COMMITMENT:
        result = await channel.withdrawCommitment(params);
        break;
      default:
        console.error(
          `Wallet connect mapping error, unknown method. Payload: ${JSON.stringify(
            payload,
            null,
            2,
          )}`,
        );
        break;
    }
  } catch (e) {
    console.error(`Wallet connect error: ${JSON.stringify(e, null, 2)}`);
  }
  walletConnector.approveRequest({ id, result });
}
