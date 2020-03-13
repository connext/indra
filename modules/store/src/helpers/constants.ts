import { safeJsonStringify } from "./utils";

export const DEFAULT_ASYNC_STORAGE_KEY = "CONNEXT_STORE";
export const DEFAULT_STORE_PREFIX = "INDRA_CLIENT_CF_CORE";
export const DEFAULT_STORE_SEPARATOR = "/";
export const DEFAULT_FILE_STORAGE_EXT = ".json";
export const DEFAULT_FILE_STORAGE_DIR = "./connext-store";

export const PATH_CHANNEL = "channel";
export const PATH_PROPOSED_APP_INSTANCE_ID = "appInstanceIdToProposedAppInstance";

export const EMPTY_DATA = {};
export const EMPTY_STRINGIFIED_DATA = safeJsonStringify(EMPTY_DATA);

export const ASYNC_STORAGE_TEST_KEY = "__is_async_storage_test";

export const CHANNEL_KEY = "channel";
export const SET_STATE_COMMITMENT_KEY = "setstate_commitment";
export const CONDITIONAL_COMMITMENT_KEY = "conditional_commitment";
export const WITHDRAWAL_COMMITMENT_KEY = "withdrawal_commitment";
export const COMMITMENT_KEY = "_commitment"; // included in all commitments
export const PROPOSED_APP_KEY = "proposed";
export const FREE_BALANCE_KEY = "freebalance";
