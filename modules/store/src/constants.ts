export const storeDefaults = {
  DATABASE_TABLE_NAME: "connext_client_data",
  PREFIX: "INDRA_CLIENT_CF_CORE",
  SEPARATOR: "/",
  DATABASE_NAME: "indra",
  DATABASE_USERNAME: "indra",
  DATABASE_PASSWORD: "indra",
  SQLITE_STORE_NAME: "connext-store.sqlite",
  SQLITE_MEMORY_STORE_STRING: ":memory:",
};

export const storeKeys = {
  BLOCK_PROCESSED: "block_processed",
  CHALLENGE: "challenge",
  CHALLENGE_UPDATED_EVENT: "challenge_updated_event",
  CHANNEL: "channel",
  CONDITIONAL_COMMITMENT: "conditional_commitment",
  SET_STATE_COMMITMENT: "setstate_commitment",
  SETUP_COMMITMENT: "setup_commitment",
  STATE_PROGRESSED_EVENT: "state_progressed_event",
  STORE: "STORE",
  STORE_SCHEMA_VERSION: "version",
  WITHDRAWAL_COMMITMENT: "withdrawal_commitment",
} as const;

export const storePaths = {
  CHANNEL: "channel",
  PROPOSED_APP_IDENTITY_HASH: "appIdentityHashToProposedAppInstance",
};
