export const storeDefaults = {
  DATABASE_TABLE_NAME: "connext_client_data",
  PREFIX: "INDRA_CLIENT_CF_CORE",
  SEPARATOR: "/",
};

export const storeKeys = {
  BLOCK_PROCESSED: "block_processed",
  CHALLENGE: "challenge",
  CHALLENGE_UPDATED_EVENT: "challenge_updated_event",
  CHANNEL: "channel",
  COMMITMENT: "_commitment",
  CONDITIONAL_COMMITMENT: "conditional_commitment",
  DEFAULT_ASYNC_STORAGE: "CONNEXT_STORE",
  FREE_BALANCE: "freebalance",
  PROPOSED_APP: "proposed",
  SET_STATE_COMMITMENT: "setstate_commitment",
  SETUP_COMMITMENT: "setup_commitment",
  STATE_PROGRESSED_EVENT: "state_progressed_event",
  STORE: "STORE",
  STORE_SCHEMA_VERSION: "version",
  WITHDRAWAL_COMMITMENT: "withdrawal_commitment",
};

export const storePaths = {
  CHANNEL: "channel",
  PROPOSED_APP_IDENTITY_HASH: "appIdentityHashToProposedAppInstance",
};
