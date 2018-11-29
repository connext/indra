export default [
  {
    constant: true,
    inputs: [
      {
        name: '',
        type: 'bytes32',
      },
    ],
    name: 'virtualChannels',
    outputs: [
      {
        name: 'isClose',
        type: 'bool',
      },
      {
        name: 'isInSettlementState',
        type: 'bool',
      },
      {
        name: 'sequence',
        type: 'uint256',
      },
      {
        name: 'challenger',
        type: 'address',
      },
      {
        name: 'updateVCtimeout',
        type: 'uint256',
      },
      {
        name: 'partyA',
        type: 'address',
      },
      {
        name: 'partyB',
        type: 'address',
      },
      {
        name: 'partyI',
        type: 'address',
      },
      {
        name: 'token',
        type: 'address',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'numChannels',
    outputs: [
      {
        name: '',
        type: 'uint256',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'NAME',
    outputs: [
      {
        name: '',
        type: 'string',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      {
        name: '',
        type: 'bytes32',
      },
    ],
    name: 'Channels',
    outputs: [
      {
        name: 'sequence',
        type: 'uint256',
      },
      {
        name: 'confirmTime',
        type: 'uint256',
      },
      {
        name: 'VCrootHash',
        type: 'bytes32',
      },
      {
        name: 'LCopenTimeout',
        type: 'uint256',
      },
      {
        name: 'updateLCtimeout',
        type: 'uint256',
      },
      {
        name: 'isOpen',
        type: 'bool',
      },
      {
        name: 'isUpdateLCSettling',
        type: 'bool',
      },
      {
        name: 'numOpenVC',
        type: 'uint256',
      },
      {
        name: 'token',
        type: 'address',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'VERSION',
    outputs: [
      {
        name: '',
        type: 'string',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'channelId',
        type: 'bytes32',
      },
      {
        indexed: true,
        name: 'partyA',
        type: 'address',
      },
      {
        indexed: true,
        name: 'partyI',
        type: 'address',
      },
      {
        indexed: false,
        name: 'ethBalanceA',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'token',
        type: 'address',
      },
      {
        indexed: false,
        name: 'tokenBalanceA',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'LCopenTimeout',
        type: 'uint256',
      },
    ],
    name: 'DidLCOpen',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'channelId',
        type: 'bytes32',
      },
      {
        indexed: false,
        name: 'ethBalanceI',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'tokenBalanceI',
        type: 'uint256',
      },
    ],
    name: 'DidLCJoin',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'channelId',
        type: 'bytes32',
      },
      {
        indexed: true,
        name: 'recipient',
        type: 'address',
      },
      {
        indexed: false,
        name: 'deposit',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'isToken',
        type: 'bool',
      },
    ],
    name: 'DidLCDeposit',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'channelId',
        type: 'bytes32',
      },
      {
        indexed: false,
        name: 'sequence',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'numOpenVc',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'ethBalanceA',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'tokenBalanceA',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'ethBalanceI',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'tokenBalanceI',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'vcRoot',
        type: 'bytes32',
      },
      {
        indexed: false,
        name: 'updateLCtimeout',
        type: 'uint256',
      },
    ],
    name: 'DidLCUpdateState',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'channelId',
        type: 'bytes32',
      },
      {
        indexed: false,
        name: 'sequence',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'ethBalanceA',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'tokenBalanceA',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'ethBalanceI',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'tokenBalanceI',
        type: 'uint256',
      },
    ],
    name: 'DidLCClose',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'lcId',
        type: 'bytes32',
      },
      {
        indexed: true,
        name: 'vcId',
        type: 'bytes32',
      },
      {
        indexed: false,
        name: 'proof',
        type: 'bytes',
      },
      {
        indexed: false,
        name: 'sequence',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'partyA',
        type: 'address',
      },
      {
        indexed: false,
        name: 'partyB',
        type: 'address',
      },
      {
        indexed: false,
        name: 'balanceA',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'balanceB',
        type: 'uint256',
      },
    ],
    name: 'DidVCInit',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'lcId',
        type: 'bytes32',
      },
      {
        indexed: true,
        name: 'vcId',
        type: 'bytes32',
      },
      {
        indexed: false,
        name: 'updateSeq',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'updateBalA',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'updateBalB',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'challenger',
        type: 'address',
      },
      {
        indexed: false,
        name: 'updateVCtimeout',
        type: 'uint256',
      },
    ],
    name: 'DidVCSettle',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'lcId',
        type: 'bytes32',
      },
      {
        indexed: true,
        name: 'vcId',
        type: 'bytes32',
      },
      {
        indexed: false,
        name: 'balanceA',
        type: 'uint256',
      },
      {
        indexed: false,
        name: 'balanceB',
        type: 'uint256',
      },
    ],
    name: 'DidVCClose',
    type: 'event',
  },
  {
    constant: false,
    inputs: [
      {
        name: '_lcID',
        type: 'bytes32',
      },
      {
        name: '_partyI',
        type: 'address',
      },
      {
        name: '_confirmTime',
        type: 'uint256',
      },
      {
        name: '_token',
        type: 'address',
      },
      {
        name: '_balances',
        type: 'uint256[2]',
      },
    ],
    name: 'createChannel',
    outputs: [],
    payable: true,
    stateMutability: 'payable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      {
        name: '_lcID',
        type: 'bytes32',
      },
    ],
    name: 'LCOpenTimeout',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      {
        name: '_lcID',
        type: 'bytes32',
      },
      {
        name: '_balances',
        type: 'uint256[2]',
      },
    ],
    name: 'joinChannel',
    outputs: [],
    payable: true,
    stateMutability: 'payable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      {
        name: '_lcID',
        type: 'bytes32',
      },
      {
        name: 'recipient',
        type: 'address',
      },
      {
        name: '_balance',
        type: 'uint256',
      },
      {
        name: 'isToken',
        type: 'bool',
      },
    ],
    name: 'deposit',
    outputs: [],
    payable: true,
    stateMutability: 'payable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      {
        name: '_lcID',
        type: 'bytes32',
      },
      {
        name: '_sequence',
        type: 'uint256',
      },
      {
        name: '_balances',
        type: 'uint256[4]',
      },
      {
        name: '_sigA',
        type: 'string',
      },
      {
        name: '_sigI',
        type: 'string',
      },
    ],
    name: 'consensusCloseChannel',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      {
        name: '_lcID',
        type: 'bytes32',
      },
      {
        name: 'updateParams',
        type: 'uint256[6]',
      },
      {
        name: '_VCroot',
        type: 'bytes32',
      },
      {
        name: '_sigA',
        type: 'string',
      },
      {
        name: '_sigI',
        type: 'string',
      },
    ],
    name: 'updateLCstate',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      {
        name: '_lcID',
        type: 'bytes32',
      },
      {
        name: '_vcID',
        type: 'bytes32',
      },
      {
        name: '_proof',
        type: 'bytes',
      },
      {
        name: '_partyA',
        type: 'address',
      },
      {
        name: '_partyB',
        type: 'address',
      },
      {
        name: '_bond',
        type: 'uint256[2]',
      },
      {
        name: '_balances',
        type: 'uint256[4]',
      },
      {
        name: 'sigA',
        type: 'string',
      },
    ],
    name: 'initVCstate',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      {
        name: '_lcID',
        type: 'bytes32',
      },
      {
        name: '_vcID',
        type: 'bytes32',
      },
      {
        name: 'updateSeq',
        type: 'uint256',
      },
      {
        name: '_partyA',
        type: 'address',
      },
      {
        name: '_partyB',
        type: 'address',
      },
      {
        name: 'updateBal',
        type: 'uint256[4]',
      },
      {
        name: 'sigA',
        type: 'string',
      },
    ],
    name: 'settleVC',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      {
        name: '_lcID',
        type: 'bytes32',
      },
      {
        name: '_vcID',
        type: 'bytes32',
      },
    ],
    name: 'closeVirtualChannel',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      {
        name: '_lcID',
        type: 'bytes32',
      },
    ],
    name: 'byzantineCloseChannel',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      {
        name: 'id',
        type: 'bytes32',
      },
    ],
    name: 'getChannel',
    outputs: [
      {
        name: '',
        type: 'address[2]',
      },
      {
        name: '',
        type: 'uint256[4]',
      },
      {
        name: '',
        type: 'uint256[4]',
      },
      {
        name: '',
        type: 'uint256[2]',
      },
      {
        name: '',
        type: 'uint256',
      },
      {
        name: '',
        type: 'uint256',
      },
      {
        name: '',
        type: 'bytes32',
      },
      {
        name: '',
        type: 'uint256',
      },
      {
        name: '',
        type: 'uint256',
      },
      {
        name: '',
        type: 'bool',
      },
      {
        name: '',
        type: 'bool',
      },
      {
        name: '',
        type: 'uint256',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      {
        name: 'id',
        type: 'bytes32',
      },
    ],
    name: 'getVirtualChannel',
    outputs: [
      {
        name: '',
        type: 'bool',
      },
      {
        name: '',
        type: 'bool',
      },
      {
        name: '',
        type: 'uint256',
      },
      {
        name: '',
        type: 'address',
      },
      {
        name: '',
        type: 'uint256',
      },
      {
        name: '',
        type: 'address',
      },
      {
        name: '',
        type: 'address',
      },
      {
        name: '',
        type: 'address',
      },
      {
        name: '',
        type: 'uint256[2]',
      },
      {
        name: '',
        type: 'uint256[2]',
      },
      {
        name: '',
        type: 'uint256[2]',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
]
