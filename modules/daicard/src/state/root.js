import { Machine } from 'xstate';

const notifyStates = (prefix, initial = 'idle') => ({
  initial,
  states: {
    'idle': {
      on: {
        [`START_${prefix.toUpperCase()}`]: 'pending',
      }
    },
    'pending': {
      on: {
        [`ERROR_${prefix.toUpperCase()}`]: 'error',
        [`SUCCESS_${prefix.toUpperCase()}`]: 'success',
      },
      initial: 'show',
      states: {
        'show': {
          on: {
            [`DISMISS_${prefix.toUpperCase()}`]: 'hide',
          }
        },
        'hide': {
          type: 'final',
        },
      }
    },
    // TODO: withdrawal success event has a txHash payload, gotta add this to metadata/context/idk
    'success': {
      on: {
        [`DISMISS_${prefix.toUpperCase()}`]: 'idle',
      },
    },
    'error': {
      on: {
        [`DISMISS_${prefix.toUpperCase()}`]: 'idle',
      },
    },
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
          'MIGRATE': 'migrate',
          'START': 'start',
        },
      },
      'migrate': {
        on: {
          'START': 'start',
        },
        ...notifyStates('migrate'),
      },
      'start': {
        on: {
          'READY': 'ready',
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
    },
  },
  {
    actions: {
    },
  }
);

