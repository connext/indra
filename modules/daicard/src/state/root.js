import { HashZero } from "ethers/constants";
import { Machine, assign } from "xstate";

const notifyStates = (prefix, initial = "idle") => ({
  initial,
  states: {
    idle: {
      on: {
        [`START_${prefix.toUpperCase()}`]: "pending",
      },
    },
    pending: {
      on: {
        [`ERROR_${prefix.toUpperCase()}`]: "error",
        [`SUCCESS_${prefix.toUpperCase()}`]: {
          target: "success",
          actions: ["setTxHash"],
        },
      },
      initial: "show",
      states: {
        show: {
          on: {
            [`DISMISS_${prefix.toUpperCase()}`]: "hide",
          },
        },
        hide: {
          type: "final",
        },
      },
    },
    success: {
      on: {
        [`DISMISS_${prefix.toUpperCase()}`]: "idle",
      },
    },
    error: {
      on: {
        [`DISMISS_${prefix.toUpperCase()}`]: "idle",
      },
    },
  },
});

export const rootMachine = Machine(
  {
    id: "root",
    strict: true,
    initial: "idle",
    context: {
      txHash: HashZero,
    },
    states: {
      idle: {
        on: {
          MIGRATE: "migrate",
          START: "start",
        },
      },
      migrate: {
        on: {
          START: "start",
        },
        ...notifyStates("migrate"),
      },
      start: {
        on: {
          READY: "ready",
          SAI: "sai",
        },
        ...notifyStates("start"),
      },
      sai: {
        on: {
          READY: "ready",
        },
        ...notifyStates("sai"),
      },
      ready: {
        id: "operations",
        type: "parallel",
        states: {
          deposit: notifyStates("deposit"),
          swap: notifyStates("swap"),
          receive: notifyStates("receive"),
          redeem: notifyStates("redeem"),
          send: notifyStates("send"),
          withdraw: notifyStates("withdraw"),
        },
      },
    },
  },
  {
    actions: {
      setTxHash: assign({ txHash: (context, event) => event.txHash || HashZero }),
    },
  },
);
