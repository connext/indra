const ABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "totalChannelWei",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function",
    "signature": "0x009e8690"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "totalChannelToken",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function",
    "signature": "0x32b573e1"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "hub",
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function",
    "signature": "0x365a86fc"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "name": "channels",
    "outputs": [
      {
        "name": "threadRoot",
        "type": "bytes32"
      },
      {
        "name": "threadCount",
        "type": "uint256"
      },
      {
        "name": "exitInitiator",
        "type": "address"
      },
      {
        "name": "channelClosingTime",
        "type": "uint256"
      },
      {
        "name": "threadClosingTime",
        "type": "uint256"
      },
      {
        "name": "status",
        "type": "uint8"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function",
    "signature": "0x7dce34f7"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "NAME",
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function",
    "signature": "0xa3f4df7e"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "approvedToken",
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function",
    "signature": "0xbab46259"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "challengePeriod",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function",
    "signature": "0xf3f480d9"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "VERSION",
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function",
    "signature": "0xffa1ad74"
  },
  {
    "inputs": [
      {
        "name": "_hub",
        "type": "address"
      },
      {
        "name": "_challengePeriod",
        "type": "uint256"
      },
      {
        "name": "_tokenAddress",
        "type": "address"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "constructor",
    "signature": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "name": "weiAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "name": "tokenAmount",
        "type": "uint256"
      }
    ],
    "name": "DidHubContractWithdraw",
    "type": "event",
    "signature": "0x60a3ff34ec09137572f54ff0fde3035ae459c9bebfdb1643a897de83211ebdf0"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "senderIdx",
        "type": "uint256"
      },
      {
        "indexed": false,
        "name": "weiBalances",
        "type": "uint256[2]"
      },
      {
        "indexed": false,
        "name": "tokenBalances",
        "type": "uint256[2]"
      },
      {
        "indexed": false,
        "name": "pendingWeiUpdates",
        "type": "uint256[4]"
      },
      {
        "indexed": false,
        "name": "pendingTokenUpdates",
        "type": "uint256[4]"
      },
      {
        "indexed": false,
        "name": "txCount",
        "type": "uint256[2]"
      },
      {
        "indexed": false,
        "name": "threadRoot",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "name": "threadCount",
        "type": "uint256"
      }
    ],
    "name": "DidUpdateChannel",
    "type": "event",
    "signature": "0xeace9ecdebd30bbfc243bdc30bfa016abfa8f627654b4989da4620271dc77b1c"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "senderIdx",
        "type": "uint256"
      },
      {
        "indexed": false,
        "name": "weiBalances",
        "type": "uint256[2]"
      },
      {
        "indexed": false,
        "name": "tokenBalances",
        "type": "uint256[2]"
      },
      {
        "indexed": false,
        "name": "txCount",
        "type": "uint256[2]"
      },
      {
        "indexed": false,
        "name": "threadRoot",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "name": "threadCount",
        "type": "uint256"
      }
    ],
    "name": "DidStartExitChannel",
    "type": "event",
    "signature": "0x6e65112e059a868cb1c7c4aed27e34fbbe470d2df0cbaa09bb5f82e5cba029fa"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "senderIdx",
        "type": "uint256"
      },
      {
        "indexed": false,
        "name": "weiBalances",
        "type": "uint256[2]"
      },
      {
        "indexed": false,
        "name": "tokenBalances",
        "type": "uint256[2]"
      },
      {
        "indexed": false,
        "name": "txCount",
        "type": "uint256[2]"
      },
      {
        "indexed": false,
        "name": "threadRoot",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "name": "threadCount",
        "type": "uint256"
      }
    ],
    "name": "DidEmptyChannel",
    "type": "event",
    "signature": "0xff678da893f9e68225fd9be0e51123341ba6d50fe0df41edebef4e9c0d242f77"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "name": "user",
        "type": "address"
      },
      {
        "indexed": true,
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": true,
        "name": "receiver",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "senderAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "weiBalances",
        "type": "uint256[2]"
      },
      {
        "indexed": false,
        "name": "tokenBalances",
        "type": "uint256[2]"
      },
      {
        "indexed": false,
        "name": "txCount",
        "type": "uint256"
      }
    ],
    "name": "DidStartExitThread",
    "type": "event",
    "signature": "0xec1400c0655dc6f65a7011943d0ec24434e26b4424c72ad1303583b935d341b8"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "name": "user",
        "type": "address"
      },
      {
        "indexed": true,
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": true,
        "name": "receiver",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "senderAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "channelWeiBalances",
        "type": "uint256[2]"
      },
      {
        "indexed": false,
        "name": "channelTokenBalances",
        "type": "uint256[2]"
      },
      {
        "indexed": false,
        "name": "channelTxCount",
        "type": "uint256[2]"
      },
      {
        "indexed": false,
        "name": "channelThreadRoot",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "name": "channelThreadCount",
        "type": "uint256"
      }
    ],
    "name": "DidEmptyThread",
    "type": "event",
    "signature": "0xe3ca8452573b3b4b7701fdb0d72a5cbb6604d7a08339902352fd5bdcbb9c33f8"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "senderAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "weiAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "name": "tokenAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "name": "channelWeiBalances",
        "type": "uint256[2]"
      },
      {
        "indexed": false,
        "name": "channelTokenBalances",
        "type": "uint256[2]"
      },
      {
        "indexed": false,
        "name": "channelTxCount",
        "type": "uint256[2]"
      },
      {
        "indexed": false,
        "name": "channelThreadRoot",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "name": "channelThreadCount",
        "type": "uint256"
      }
    ],
    "name": "DidNukeThreads",
    "type": "event",
    "signature": "0x02d2d0f262d032138bbd82feccd6d357a4441f394333cfa7d61792f44a70a0ed"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "weiAmount",
        "type": "uint256"
      },
      {
        "name": "tokenAmount",
        "type": "uint256"
      }
    ],
    "name": "hubContractWithdraw",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function",
    "signature": "0x01dd7da9"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getHubReserveWei",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function",
    "signature": "0xad872d03"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getHubReserveTokens",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function",
    "signature": "0x9bcf63cd"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "user",
        "type": "address"
      },
      {
        "name": "recipient",
        "type": "address"
      },
      {
        "name": "weiBalances",
        "type": "uint256[2]"
      },
      {
        "name": "tokenBalances",
        "type": "uint256[2]"
      },
      {
        "name": "pendingWeiUpdates",
        "type": "uint256[4]"
      },
      {
        "name": "pendingTokenUpdates",
        "type": "uint256[4]"
      },
      {
        "name": "txCount",
        "type": "uint256[2]"
      },
      {
        "name": "threadRoot",
        "type": "bytes32"
      },
      {
        "name": "threadCount",
        "type": "uint256"
      },
      {
        "name": "timeout",
        "type": "uint256"
      },
      {
        "name": "sigUser",
        "type": "string"
      }
    ],
    "name": "hubAuthorizedUpdate",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function",
    "signature": "0x686bf460"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "recipient",
        "type": "address"
      },
      {
        "name": "weiBalances",
        "type": "uint256[2]"
      },
      {
        "name": "tokenBalances",
        "type": "uint256[2]"
      },
      {
        "name": "pendingWeiUpdates",
        "type": "uint256[4]"
      },
      {
        "name": "pendingTokenUpdates",
        "type": "uint256[4]"
      },
      {
        "name": "txCount",
        "type": "uint256[2]"
      },
      {
        "name": "threadRoot",
        "type": "bytes32"
      },
      {
        "name": "threadCount",
        "type": "uint256"
      },
      {
        "name": "timeout",
        "type": "uint256"
      },
      {
        "name": "sigHub",
        "type": "string"
      }
    ],
    "name": "userAuthorizedUpdate",
    "outputs": [],
    "payable": true,
    "stateMutability": "payable",
    "type": "function",
    "signature": "0xea682e37"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "user",
        "type": "address"
      }
    ],
    "name": "startExit",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function",
    "signature": "0x72cc174c"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "user",
        "type": "address[2]"
      },
      {
        "name": "weiBalances",
        "type": "uint256[2]"
      },
      {
        "name": "tokenBalances",
        "type": "uint256[2]"
      },
      {
        "name": "pendingWeiUpdates",
        "type": "uint256[4]"
      },
      {
        "name": "pendingTokenUpdates",
        "type": "uint256[4]"
      },
      {
        "name": "txCount",
        "type": "uint256[2]"
      },
      {
        "name": "threadRoot",
        "type": "bytes32"
      },
      {
        "name": "threadCount",
        "type": "uint256"
      },
      {
        "name": "timeout",
        "type": "uint256"
      },
      {
        "name": "sigHub",
        "type": "string"
      },
      {
        "name": "sigUser",
        "type": "string"
      }
    ],
    "name": "startExitWithUpdate",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function",
    "signature": "0x69f81776"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "user",
        "type": "address[2]"
      },
      {
        "name": "weiBalances",
        "type": "uint256[2]"
      },
      {
        "name": "tokenBalances",
        "type": "uint256[2]"
      },
      {
        "name": "pendingWeiUpdates",
        "type": "uint256[4]"
      },
      {
        "name": "pendingTokenUpdates",
        "type": "uint256[4]"
      },
      {
        "name": "txCount",
        "type": "uint256[2]"
      },
      {
        "name": "threadRoot",
        "type": "bytes32"
      },
      {
        "name": "threadCount",
        "type": "uint256"
      },
      {
        "name": "timeout",
        "type": "uint256"
      },
      {
        "name": "sigHub",
        "type": "string"
      },
      {
        "name": "sigUser",
        "type": "string"
      }
    ],
    "name": "emptyChannelWithChallenge",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function",
    "signature": "0xa1e1fe93"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "user",
        "type": "address"
      }
    ],
    "name": "emptyChannel",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function",
    "signature": "0x4e2a5c5a"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "user",
        "type": "address"
      },
      {
        "name": "sender",
        "type": "address"
      },
      {
        "name": "receiver",
        "type": "address"
      },
      {
        "name": "weiBalances",
        "type": "uint256[2]"
      },
      {
        "name": "tokenBalances",
        "type": "uint256[2]"
      },
      {
        "name": "txCount",
        "type": "uint256"
      },
      {
        "name": "proof",
        "type": "bytes"
      },
      {
        "name": "sig",
        "type": "string"
      }
    ],
    "name": "startExitThread",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function",
    "signature": "0x29056646"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "user",
        "type": "address"
      },
      {
        "name": "threadMembers",
        "type": "address[2]"
      },
      {
        "name": "weiBalances",
        "type": "uint256[2]"
      },
      {
        "name": "tokenBalances",
        "type": "uint256[2]"
      },
      {
        "name": "txCount",
        "type": "uint256"
      },
      {
        "name": "proof",
        "type": "bytes"
      },
      {
        "name": "sig",
        "type": "string"
      },
      {
        "name": "updatedWeiBalances",
        "type": "uint256[2]"
      },
      {
        "name": "updatedTokenBalances",
        "type": "uint256[2]"
      },
      {
        "name": "updatedTxCount",
        "type": "uint256"
      },
      {
        "name": "updateSig",
        "type": "string"
      }
    ],
    "name": "startExitThreadWithUpdate",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function",
    "signature": "0xd4ea0754"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "user",
        "type": "address"
      },
      {
        "name": "sender",
        "type": "address"
      },
      {
        "name": "receiver",
        "type": "address"
      },
      {
        "name": "weiBalances",
        "type": "uint256[2]"
      },
      {
        "name": "tokenBalances",
        "type": "uint256[2]"
      },
      {
        "name": "txCount",
        "type": "uint256"
      },
      {
        "name": "sig",
        "type": "string"
      }
    ],
    "name": "fastEmptyThread",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function",
    "signature": "0xb51c007d"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "user",
        "type": "address"
      },
      {
        "name": "sender",
        "type": "address"
      },
      {
        "name": "receiver",
        "type": "address"
      }
    ],
    "name": "emptyThread",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function",
    "signature": "0x8520ec6b"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "user",
        "type": "address"
      }
    ],
    "name": "nukeThreads",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function",
    "signature": "0x7651a86b"
  }
]

export default ABI