import { ChannelProviderRpcMethods } from "@connext/types";
import WalletConnectBrowser from "@walletconnect/browser";

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
      case ChannelProviderRpcMethods.chan_storeSet:
        verifyFields(params, ["pairs"]);
        const { pairs } = params;
        result = await channel.channelRouter.set(pairs);
        break;

      case ChannelProviderRpcMethods.chan_storeGet:
        verifyFields(params, ["path"]);
        const { path } = params;
        result = await channel.channelRouter.get(path);
        break;

      case ChannelProviderRpcMethods.chan_nodeAuth:
        verifyFields(params, ["message"]);
        const { message } = params;
        result = await channel.channelRouter.signMessage(message);
        break;

      case ChannelProviderRpcMethods.chan_config:
        result = await channel.channelProviderConfig(params);
        break;

      case ChannelProviderRpcMethods.chan_deposit:
        result = await channel.providerDeposit(params);
        break;
      
      case ChannelProviderRpcMethods.chan_getState:
        result = await channel.getState(params);
        break;

      case ChannelProviderRpcMethods.chan_getStateChannel:
        result = await channel.getStateChannel();
        break;
      
      case ChannelProviderRpcMethods.chan_getAppInstances:
        const { multisigAddress } = params;
        result = await channel.getAppInstances(multisigAddress);
        break;
    
      case ChannelProviderRpcMethods.chan_getFreeBalanceState:
        verifyFields(params, ["tokenAddress", "multisigAddress"]);
        const { tokenAddress } = params;
        result = await channel.getFreeBalance(tokenAddress);
        break;

      case ChannelProviderRpcMethods.chan_getProposedAppInstances:
        result = await channel.getProposedAppInstances(params);
        break;
      case ChannelProviderRpcMethods.chan_getAppInstance:
        result = await channel.getAppInstanceDetails(params);
        break;
      case ChannelProviderRpcMethods.chan_takeAction:
        result = await channel.takeAction(params);
        break;
      case ChannelProviderRpcMethods.chan_updateState:
        result = await channel.updateState(params);
        break;
      case ChannelProviderRpcMethods.chan_proposeInstall:
        result = await channel.proposeInstallApp(params);
        break;
      case ChannelProviderRpcMethods.chan_installVirtual:
        result = await channel.installVirtualApp(params);
        break;
      case ChannelProviderRpcMethods.chan_install:
        result = await channel.installApp(params);
        break;
      case ChannelProviderRpcMethods.chan_uninstall:
        result = await channel.uninstallApp(params);
        break;
      case ChannelProviderRpcMethods.chan_uninstallVirtual:
        result = await channel.uninstallVirtualApp(params);
        break;
      case ChannelProviderRpcMethods.chan_rejectInstall:
        result = await channel.rejectInstallApp(params);
        break;
      case ChannelProviderRpcMethods.chan_withdraw:
        result = await channel.providerWithdraw(params);
        break;
      case ChannelProviderRpcMethods.chan_withdrawCommitment:
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
    console.error(`Wallet connect error: ${JSON.stringify(e.stack, null, 2)}`);
  }
  walletConnector.approveRequest({ id, result });
}
