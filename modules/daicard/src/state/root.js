import { Machine } from 'xstate';

export const notifyStates = Machine(
  {
    initial: 'pending',
    states: {
      'pending': {
        on: {
          'DISMISS': 'hide',
          'SUCCESS': 'success',
          'ERROR': 'error',
        },
      },
      'success': {
        on: {
          'DISMISS': 'hide',
        },
      },
      'error': {
        on: {
          'DISMISS': 'hide',
        },
      },
      'hide': {}
    }
  }
);

export const rootMachine = Machine(
  {
    id: 'root',
    initial: 'idle',
    states: {
      'idle': { on: {
        'GOOD_MORNING': 'checkingMigrations'
      }},
      'checkingMigrations': { on: {
        'MIGRATE': 'migrating',
        'START': 'starting',
      }},
      'migrating': { on: {
        'DONE': 'starting',
        'ERROR': 'error',
        ...notifyStates,
      }},
      'starting': { on: {
        'READY': 'ready',
        'ERROR': 'error',
        ...notifyStates,
      }},
      'ready': { on: {
        'DEPOSIT': 'depositing',
        'SWAP': 'swapping',
        'RECEIVE': 'receiving',
        'SEND': 'sending',
        'WITHDRAW': 'withdrawing',
        'ERROR': 'error',
      }},
      'depositing': { on: {
        'DONE': 'ready',
        'ERROR': 'error',
        ...notifyStates,
      }},
      'swapping': { on: {
        'DONE': 'ready',
        'ERROR': 'error',
        ...notifyStates,
      }},
      'receiving': { on: {
        'DONE': 'ready',
        'ERROR': 'error',
        ...notifyStates,
      }},
      'sending': { on: {
        'DONE': 'ready',
        'ERROR': 'error',
        ...notifyStates,
      }},
      'withdrawing': { on: {
        'DONE': 'ready',
        'ERROR': 'error',
        ...notifyStates,
      }},
      'error': {},
    },
  },
  {
    actions: {},
  }
);

