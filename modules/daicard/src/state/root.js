import { Machine } from 'xstate';

const notifyStates = (prefix) => ({
  initial: 'idle',
  states: {
    'idle': {
      on: {
        [`START_${prefix.toUpperCase()}`]: 'pending',
      }
    },
    'pending': {
      on: {
        [`DISMISS_${prefix.toUpperCase()}`]: 'hide',
        [`ERROR_${prefix.toUpperCase()}`]: 'error',
        [`SUCCESS_${prefix.toUpperCase()}`]: 'success',
      },
    },
    'success': {
      on: {
        [`DISMISS_${prefix.toUpperCase()}`]: 'hide',
        [`RESET_${prefix.toUpperCase()}`]: 'idle',
      },
    },
    'error': {
      on: {
        [`DISMISS_${prefix.toUpperCase()}`]: 'hide',
        [`RESET_${prefix.toUpperCase()}`]: 'idle',
      },
    },
    'hide': {
      on: {
        [`ERROR_${prefix.toUpperCase()}`]: 'error',
        [`RESET_${prefix.toUpperCase()}`]: 'idle',
        [`SUCCESS_${prefix.toUpperCase()}`]: 'success',
      },
    }
  }
});

export const rootMachine = Machine(
  {
    id: 'root',
    strict: true,
    initial: 'idle',
    states: {
      'idle': {
        on: {
          'MIGRATE': 'migrating',
          'START': 'starting',
        },
      },
      'migrating': {
        on: {
          'START': 'starting',
        },
        ...notifyStates('migrate'),
      },
      'starting': {
        on: {
          'READY': 'ready',
          'ERROR': 'error',
        },
        ...notifyStates('start'),
      },
      'ready': {
        id: 'operations',
        type: 'parallel',
        states: {
          'deposit': notifyStates('deposit'),
          'swap': notifyStates('swap'),
          'receive': notifyStates('receive'),
          'redeem': notifyStates('redeem'),
          'send': notifyStates('send'),
          'withdraw': notifyStates('withdraw'),
        },
      },
      'error': {},
    },
  },
  {
    actions: {
    },
  }
);

