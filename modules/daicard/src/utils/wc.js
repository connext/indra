import WalletConnectBrowser from "@walletconnect/browser";

export let walletConnector = null;

export function initWalletConnect(uri, client, chainId) {
  walletConnector = new WalletConnectBrowser({ uri });

  registerWalletConnectListeners(client, chainId);
}

export function registerWalletConnectListeners(client, chainId) {
  walletConnector.on("session_request", (error, payload) => {
    if (error) {
      throw error;
    }
    displaySessionApproval(payload.params[0], chainId);
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
  localStorage.removeItem(`wcUri`);
}

export function displaySessionApproval(session, chainId) {
  //TODO: proc modal that approves the walletconnection from the wallet
  walletConnector.approveSession({ accounts: [], chainId });
}

function prettyPrint(obj) {
  return JSON.stringify(obj, null, 2);
}

function verifyPayload(payload) {
  const { params, id, method } = payload;

  if (!params || typeof params !== "object") {
    throw new Error(`WalletConnect Error - invalid payload params. Payload: ${prettyPrint(payload)}`);
  }

  if (!id || typeof id !== "number") {
    throw new Error(`WalletConnect Error - invalid payload id. Payload: ${prettyPrint(payload)}`);
  }

  if (!method || typeof method !== "string") {
    throw new Error(`WalletConnect Error - invalid payload method. Payload: ${prettyPrint(payload)}`);
  }

  return;
}

async function mapPayloadToClient(payload, channel) {
  try {
    verifyPayload(payload);

    let result = await channel.channelProvider.send(payload.method, payload.params);

    if (typeof result === "undefined") {
      const message = "WalletConnect Error - result is undefined";
      console.error(message);
      walletConnector.rejectRequest({ id: payload.id, error: { message } });
    } else {
      walletConnector.approveRequest({ id: payload.id, result });
    }
  } catch (e) {
    console.error(e.message);
    walletConnector.rejectRequest({ id: payload.id, error: { message: e.message } });
  }
}
