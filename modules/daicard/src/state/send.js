import { Machine } from "xstate";

export const sendMachine = Machine({
  id: "payment",
  strict: true,
  initial: "idle",
  states: {
    idle: {
      on: {
        NEW_P2P: "processingP2p",
        NEW_LINK: "processingLink",
        ERROR: "error",
      },
    },
    processingP2p: {
      on: {
        DONE: "successP2p",
        ERROR: "error",
      },
    },
    processingLink: {
      on: {
        DONE: "successLink",
        ERROR: "error",
      },
    },
    successP2p: {
      on: {
        DISMISS: "idle",
      },
    },
    successLink: {
      on: {
        DISMISS: "idle",
      },
    },
    error: {
      on: {
        DISMISS: "idle",
      },
    },
  },
});
