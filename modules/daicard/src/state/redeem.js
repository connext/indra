import { Machine } from "xstate";

export const redeemMachine = Machine({
  id: "redeem",
  strict: true,
  initial: "idle",
  states: {
    idle: {
      on: {
        CHECK: "checking",
      },
    },
    checking: {
      on: {
        ERROR: "error",
        INVALIDATE: "invalid",
        VALIDATE: "ready",
      },
    },
    invalid: {
      on: {
        CLEAR: "idle",
        CHECK: "checking",
      },
    },
    ready: {
      on: {
        CONFIRM: "modal.confirm",
      },
    },
    error: {
      on: {
        CHECK: "checking",
        CLEAR: "idle",
      },
    },
    modal: {
      id: "modal",
      initial: "confirm",
      on: {
        GO_BACK: "ready",
        DISMISS: "idle",
      },
      states: {
        confirm: {
          on: {
            COLLATERALIZE: "collateralizing",
            REDEEM: "redeeming",
          },
        },
        collateralizing: {
          on: {
            ERROR: "error",
            REDEEM: "redeeming",
          },
        },
        redeeming: {
          on: {
            ERROR: "error",
            SUCCESS: "success",
          },
        },
        error: {},
        success: {},
      },
    },
  },
});
