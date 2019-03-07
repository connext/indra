const ABI = {
  "contractName": "ChannelManager",
  "abi": [
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
      "type": "function"
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
      "type": "function"
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
      "type": "function"
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
          "name": "status",
          "type": "uint8"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
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
      "type": "function"
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
      "type": "function"
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
      "type": "function"
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
      "type": "function"
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
      "type": "constructor"
    },
    {
      "payable": true,
      "stateMutability": "payable",
      "type": "fallback"
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
      "type": "event"
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
      "type": "event"
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
      "type": "event"
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
      "type": "event"
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
          "name": "threadId",
          "type": "uint256"
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
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
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
          "name": "threadId",
          "type": "uint256"
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
      "name": "DidChallengeThread",
      "type": "event"
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
          "name": "threadId",
          "type": "uint256"
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
      "type": "event"
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
      "type": "event"
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
      "type": "function"
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
      "type": "function"
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
      "type": "function"
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
      "type": "function"
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
      "type": "function"
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
      "type": "function"
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
      "type": "function"
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
      "type": "function"
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
      "type": "function"
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
          "name": "threadId",
          "type": "uint256"
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
      "type": "function"
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
          "name": "threadId",
          "type": "uint256"
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
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "sender",
          "type": "address"
        },
        {
          "name": "receiver",
          "type": "address"
        },
        {
          "name": "threadId",
          "type": "uint256"
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
      "name": "challengeThread",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
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
          "name": "threadId",
          "type": "uint256"
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
          "name": "proof",
          "type": "bytes"
        },
        {
          "name": "sig",
          "type": "string"
        }
      ],
      "name": "emptyThread",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
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
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "user",
          "type": "address"
        }
      ],
      "name": "getChannelBalances",
      "outputs": [
        {
          "name": "weiHub",
          "type": "uint256"
        },
        {
          "name": "weiUser",
          "type": "uint256"
        },
        {
          "name": "weiTotal",
          "type": "uint256"
        },
        {
          "name": "tokenHub",
          "type": "uint256"
        },
        {
          "name": "tokenUser",
          "type": "uint256"
        },
        {
          "name": "tokenTotal",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "user",
          "type": "address"
        }
      ],
      "name": "getChannelDetails",
      "outputs": [
        {
          "name": "txCountGlobal",
          "type": "uint256"
        },
        {
          "name": "txCountChain",
          "type": "uint256"
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
          "name": "exitInitiator",
          "type": "address"
        },
        {
          "name": "channelClosingTime",
          "type": "uint256"
        },
        {
          "name": "status",
          "type": "uint8"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    }
  ],
}


export default ABI

export const BYTECODE = '0x60806040523480156200001157600080fd5b5060405160608062005e9e83398101806040526200003391908101906200008e565b60008054600160a060020a03948516600160a060020a03199182161790915560019290925560028054919093169116179055620000f1565b6000620000798251620000e2565b9392505050565b6000620000798251620000ee565b600080600060608486031215620000a457600080fd5b6000620000b286866200006b565b9350506020620000c58682870162000080565b9250506040620000d8868287016200006b565b9150509250925092565b600160a060020a031690565b90565b615d9d80620001016000396000f3006080604052600436106101235763ffffffff60e060020a6000350416629e8690811461012557806301dd7da9146101505780630955acd41461017057806325c29be01461019057806332b573e1146101b0578063365a86fc146101c557806345a92009146101e75780634e2a5c5a14610219578063686bf4601461023957806369f817761461025957806372cc174c1461027957806374c25c20146102995780637651a86b146102cc5780637dce34f7146102ec5780639bcf63cd1461031d578063a1e1fe9314610332578063a3f4df7e14610352578063ad872d0314610374578063b04993ef14610389578063bab46259146103a9578063c8b2f7d6146103cb578063ea682e37146103eb578063f3f480d9146103fe578063ffa1ad7414610413575b005b34801561013157600080fd5b5061013a610428565b6040516101479190615a22565b60405180910390f35b34801561015c57600080fd5b5061012361016b36600461439b565b61042e565b34801561017c57600080fd5b5061012361018b366004614053565b610604565b34801561019c57600080fd5b506101236101ab366004613f9e565b61099b565b3480156101bc57600080fd5b5061013a610c1e565b3480156101d157600080fd5b506101da610c24565b60405161014791906153ab565b3480156101f357600080fd5b50610207610202366004613d72565b610c33565b60405161014796959493929190615ae8565b34801561022557600080fd5b50610123610234366004613d72565b610d8f565b34801561024557600080fd5b50610123610254366004613e96565b611159565b34801561026557600080fd5b5061012361027436600461425e565b611396565b34801561028557600080fd5b50610123610294366004613d72565b61169b565b3480156102a557600080fd5b506102b96102b4366004613d72565b611827565b6040516101479796959493929190615a80565b3480156102d857600080fd5b506101236102e7366004613d72565b611991565b3480156102f857600080fd5b5061030c610307366004613d72565b611c99565b604051610147959493929190615577565b34801561032957600080fd5b5061013a611cd8565b34801561033e57600080fd5b5061012361034d36600461425e565b611d6b565b34801561035e57600080fd5b506103676121b0565b6040516101479190615691565b34801561038057600080fd5b5061013a6121dc565b34801561039557600080fd5b506101236103a4366004613db6565b6121f4565b3480156103b557600080fd5b506103be612889565b60405161014791906155c3565b3480156103d757600080fd5b506101236103e6366004613db6565b612898565b6101236103f936600461416a565b612ac7565b34801561040a57600080fd5b5061013a612dc7565b34801561041f57600080fd5b50610367612dcd565b60035481565b60075460ff161561045d5760405160e560020a62461bcd028152600401610454906157d2565b60405180910390fd5b6007805460ff1916600117905560005433600160a060020a039091161461048357600080fd5b8161048c6121dc565b10156104ad5760405160e560020a62461bcd02815260040161045490615872565b806104b6611cd8565b10156104d75760405160e560020a62461bcd02815260040161045490615802565b60008054604051600160a060020a039091169184156108fc02918591818181858888f19350505050158015610510573d6000803e3d6000fd5b5060025460005460405160e060020a63a9059cbb028152600160a060020a039283169263a9059cbb9261054a9291169085906004016153e7565b602060405180830381600087803b15801561056457600080fd5b505af1158015610578573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525061059c919081019061435f565b15156105bd5760405160e560020a62461bcd02815260040161045490615832565b7f60a3ff34ec09137572f54ff0fde3035ae459c9bebfdb1643a897de83211ebdf082826040516105ee929190615a72565b60405180910390a150506007805460ff19169055565b600754600090819060ff161561062f5760405160e560020a62461bcd028152600401610454906157d2565b6007805460ff19166001179055600160a060020a038d16600090815260056020526040902091506002600c83015460ff16600281111561066b57fe5b1461068b5760405160e560020a62461bcd028152600401610454906159a2565b600054600160a060020a03163314806106ac575033600160a060020a038e16145b15156106cd5760405160e560020a62461bcd02815260040161045490615902565b8b51600160a060020a038e8116911614806106f7575060208c0151600160a060020a038e81169116145b15156107185760405160e560020a62461bcd02815260040161045490615a12565b60208a015115801561072c57506020890151155b151561074d5760405160e560020a62461bcd02815260040161045490615892565b8b51600160a060020a03166000908152600660205260408120908d60016020020151600160a060020a0316600160a060020a0316815260200190815260200160002060008c81526020019081526020016000209050806005015460001415156107cb5760405160e560020a62461bcd028152600401610454906157b2565b6107ef8c600060200201518d600160200201518d8d8d60008e8e8a60080154612def565b600084116108125760405160e560020a62461bcd02815260040161045490615972565b89516108358760015b60200201518860005b60200201519063ffffffff6130d816565b146108555760405160e560020a62461bcd028152600401610454906158b2565b885161086b8660015b6020020151876000610824565b1461088b5760405160e560020a62461bcd028152600401610454906157e2565b8b516020808e015160408051928301905260008083526108b693928f918b918b918b91908b90612def565b6108c281876002613ac4565b506108d36002808301908790613ac4565b50600481018490556001546108ef90429063ffffffff6130d816565b60058201558b60016020020151600160a060020a03168c60006020020151600160a060020a0316600080516020615ce48339815191528f8e6000809054906101000a9004600160a060020a0316600160a060020a031633600160a060020a03161461095b57600161095e565b60005b600487015460405161097a9493929189916002830191906154ff565b60405180910390a350506007805460ff191690555050505050505050505050565b60075460009060ff16156109c45760405160e560020a62461bcd028152600401610454906157d2565b6007805460ff1916600117905560005433600160a060020a0390911614806109f4575033600160a060020a038916145b80610a07575033600160a060020a038816145b1515610a285760405160e560020a62461bcd02815260040161045490615a02565b50600160a060020a038088166000908152600660209081526040808320938a16835292815282822088835290522060058101544210610a7c5760405160e560020a62461bcd02815260040161045490615882565b60048101548311610aa25760405160e560020a62461bcd028152600401610454906159f2565b610abc81600101548260005b01549063ffffffff6130d816565b610ac786600161085e565b14610ae75760405160e560020a62461bcd02815260040161045490615762565b6003810154610afb90600283016000610aae565b6020850151610b0c90866000610824565b14610b2c5760405160e560020a62461bcd02815260040161045490615852565b6001810154602086015110801590610b4c57506003810154602085015110155b1515610b6d5760405160e560020a62461bcd02815260040161045490615732565b610b928888888888886020604051908101604052806000815250896000600102612def565b610b9e81866002613ac4565b50610baf6002808301908690613ac4565b5060048101839055604051600160a060020a0380891691908a16907f738f3bb8a8a2b4d0dc29a4076d3a4e41e510cd1044877421546903039766ad1990610c02908a903390879060028201908b90615a30565b60405180910390a350506007805460ff19169055505050505050565b60045481565b600054600160a060020a031681565b600080600080600080610c44613b02565b600160a060020a03881660009081526005602052604090819020815161016081019092528161010081018260038282826020028201915b815481526020019060010190808311610c7b5750505091835250506040805160608101918290526020909201919060038481019182845b815481526020019060010190808311610cb2575050509183525050604080518082019182905260209092019190600684019060029082845b815481526020019060010190808311610cea5750505091835250506008820154602082015260098201546040820152600a820154600160a060020a03166060820152600b8201546080820152600c82015460a09091019060ff166002811115610d4f57fe5b6002811115610d5a57fe5b9052508051805160208083015160409384015194820151805192810151940151929d909c50939a509850909650945092505050565b60075460009060ff1615610db85760405160e560020a62461bcd028152600401610454906157d2565b6007805460ff19166001179055600054600160a060020a0383811691161415610df65760405160e560020a62461bcd02815260040161045490615942565b600160a060020a038216301415610e225760405160e560020a62461bcd028152600401610454906159b2565b50600160a060020a03811660009081526005602052604090206001600c82015460ff166002811115610e5057fe5b14610e705760405160e560020a62461bcd02815260040161045490615752565b4281600b01541080610eb65750600a810154600160a060020a03163314801590610eb65750600054600160a060020a0316331480610eb6575033600160a060020a038316145b1515610ed75760405160e560020a62461bcd028152600401610454906159c2565b610f048160015b01548254610ef8908460025b01549063ffffffff6130f516565b9063ffffffff6130f516565b8160020155610f266003820160015b0154600383018054610ef8916002610eea565b6005820155610f4c8160015b0154610ef88360005b01546003549063ffffffff6130f516565b6003556001810154604051600160a060020a0384169180156108fc02916000818181858888f19350505050158015610f88573d6000803e3d6000fd5b5060008181015560008160010155610fbd6003820160015b0154610ef86003840160005b01546004549063ffffffff6130f516565b600455600254600160a060020a031663a9059cbb8360038401600101546040518363ffffffff1660e060020a028152600401610ffa9291906153e7565b602060405180830381600087803b15801561101457600080fd5b505af1158015611028573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525061104c919081019061435f565b151561106d5760405160e560020a62461bcd02815260040161045490615722565b600060038201819055600482018190556009820154111561109c57600c8101805460ff191660021790556110b0565b6000600b820155600c8101805460ff191690555b600a81018054600160a060020a0319169055600054600160a060020a0383811691600080516020615d44833981519152911633146110ef5760016110f2565b60005b6040805180820182528554815260018601546020808301919091528251808401845260038801548152600488015491810191909152600887015460098801549351611143959460068a019291615b37565b60405180910390a250506007805460ff19169055565b60075460009060ff16156111825760405160e560020a62461bcd028152600401610454906157d2565b6007805460ff1916600117905560005433600160a060020a03909116146111a857600080fd5b50600160a060020a038b1660009081526005602052604090206111d281878c8c8c8c89600161310c565b604080518082018252600160a060020a03808f1682528d166020808301919091528251808201845260008082528451808601909552845260019184019190915261122d928d918d918d918d918d918d918d918d918d906133d0565b61123a818b8b8b8b613799565b6060880151604051600160a060020a038d169180156108fc02916000818181858888f19350505050158015611273573d6000803e3d6000fd5b50600254606088015160405160e060020a63a9059cbb028152600160a060020a039092169163a9059cbb916112ad918f91906004016153e7565b602060405180830381600087803b1580156112c757600080fd5b505af11580156112db573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506112ff919081019061435f565b15156113205760405160e560020a62461bcd02815260040161045490615722565b61132f60068201876002613ac4565b506008810185905560098101849055604051600160a060020a038d1690600080516020615d0483398151915290611376906000908e908e908e908e908e908e908e906155d1565b60405180910390a250506007805460ff1916905550505050505050505050565b60075460009060ff16156113bf5760405160e560020a62461bcd028152600401610454906157d2565b506007805460ff191660011790558a51600160a060020a0316600090815260056020526040812090600c82015460ff1660028111156113fa57fe5b1461141a5760405160e560020a62461bcd02815260040161045490615792565b600054600160a060020a031633148061143c57508b51600160a060020a031633145b151561145d5760405160e560020a62461bcd02815260040161045490615992565b831561147e5760405160e560020a62461bcd02815260040161045490615842565b6114b08c8c8c8c8c8c8c8c8c8c8c604080519081016040528060011515151581526020016001151515158152506133d0565b60068101548751116114d75760405160e560020a62461bcd028152600401610454906158c2565b6007810154602088015110156115025760405160e560020a62461bcd028152600401610454906156c2565b806002015461151b8c60015b60200201518d6000610824565b111561153c5760405160e560020a62461bcd028152600401610454906156e2565b60058101546115558b60015b60200201518c6000610824565b11156115765760405160e560020a62461bcd02815260040161045490615862565b6007810154602088015114156115a457611591818c8b61386a565b61159f816003018b8a61386a565b6115bd565b6115af818c8b6138f8565b6115bd816003018b8a6138f8565b6115cc60068201886002613ac4565b506008810186905560098101859055600a81018054600160a060020a0319163317905560015461160390429063ffffffff6130d816565b600b820155600c8101805460ff191660011790558b51600054600160a060020a0391821691600080516020615cc4833981519152913391161461164757600161164a565b60005b6040805180820182528554815260018601546020808301919091528251808401845260038801548152600488015491810191909152600887015460098801549351611376959460068a019291615b37565b60075460009060ff16156116c45760405160e560020a62461bcd028152600401610454906157d2565b6007805460ff19166001179055600054600160a060020a03838116911614156117025760405160e560020a62461bcd02815260040161045490615942565b600160a060020a03821630141561172e5760405160e560020a62461bcd028152600401610454906159b2565b50600160a060020a038116600090815260056020526040812090600c82015460ff16600281111561175b57fe5b1461177b5760405160e560020a62461bcd02815260040161045490615792565b600054600160a060020a031633148061179c575033600160a060020a038316145b15156117bd5760405160e560020a62461bcd02815260040161045490615992565b600a81018054600160a060020a031916331790556001546117e590429063ffffffff6130d816565b600b820155600c8101805460ff19166001179055600054600160a060020a0383811691600080516020615cc483398151915291339116146110ef5760016110f2565b600080600080600080600061183a613b02565b600160a060020a03891660009081526005602052604090819020815161016081019092528161010081018260038282826020028201915b8154815260200190600101908083116118715750505091835250506040805160608101918290526020909201919060038481019182845b8154815260200190600101908083116118a8575050509183525050604080518082019182905260209092019190600684019060029082845b8154815260200190600101908083116118e05750505091835250506008820154602082015260098201546040820152600a820154600160a060020a03166060820152600b8201546080820152600c82015460a09091019060ff16600281111561194557fe5b600281111561195057fe5b905250604081015180516020909101516060830151608084015160a085015160c086015160e090960151949f939e50919c509a509850919650945092505050565b6007546000908190819060ff16156119be5760405160e560020a62461bcd028152600401610454906157d2565b6007805460ff19166001179055600054600160a060020a03858116911614156119fc5760405160e560020a62461bcd02815260040161045490615942565b600160a060020a038416301415611a285760405160e560020a62461bcd028152600401610454906159b2565b600160a060020a038416600090815260056020526040902092506002600c84015460ff166002811115611a5757fe5b14611a775760405160e560020a62461bcd02815260040161045490615922565b42611aa2611a91600a60015461395e90919063ffffffff16565b600b8601549063ffffffff6130d816565b10611ac25760405160e560020a62461bcd028152600401610454906156b2565b611acd836002610f3b565b6003556002830154604051600160a060020a0386169180156108fc02916000818181858888f19350505050158015611b09573d6000803e3d6000fd5b508260020154915060008360020155611b26600384016002610fac565b6004908155600254600585015460405160e060020a63a9059cbb028152600160a060020a039092169263a9059cbb92611b639289929091016153e7565b602060405180830381600087803b158015611b7d57600080fd5b505af1158015611b91573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250611bb5919081019061435f565b1515611bd65760405160e560020a62461bcd02815260040161045490615722565b506005820180546000918290556009840182905560088401829055600b8401829055600c8401805460ff19169055604080518082018252855481526001860154602080830191909152825180840184526003880154815260048801549181019190915291519293600160a060020a038816937f02d2d0f262d032138bbd82feccd6d357a4441f394333cfa7d61792f44a70a0ed93611c81933393899389939160068d019181906154d6565b60405180910390a250506007805460ff191690555050565b600560205260009081526040902060088101546009820154600a830154600b840154600c9094015492939192600160a060020a03909116919060ff1685565b6004805460025460405160e060020a6370a08231028152600093611d659392600160a060020a0316916370a0823191611d13913091016153ab565b602060405180830381600087803b158015611d2d57600080fd5b505af1158015611d41573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250610ef8919081019061437d565b90505b90565b60075460009060ff1615611d945760405160e560020a62461bcd028152600401610454906157d2565b506007805460ff191660019081179091558b51600160a060020a0316600090815260056020526040902090600c82015460ff166002811115611dd257fe5b14611df25760405160e560020a62461bcd02815260040161045490615752565b600b8101544210611e185760405160e560020a62461bcd02815260040161045490615712565b600a810154600160a060020a0316331415611e485760405160e560020a62461bcd028152600401610454906157a2565b600054600160a060020a0316331480611e6a57508b51600160a060020a031633145b1515611e8b5760405160e560020a62461bcd028152600401610454906158a2565b8315611eac5760405160e560020a62461bcd02815260040161045490615842565b611ede8c8c8c8c8c8c8c8c8c8c8c604080519081016040528060011515151581526020016001151515158152506133d0565b6006810154875111611f055760405160e560020a62461bcd028152600401610454906158c2565b600781015460208801511015611f305760405160e560020a62461bcd028152600401610454906156c2565b8060020154611f408c600161150e565b1115611f615760405160e560020a62461bcd028152600401610454906156e2565b6005810154611f718b6001611548565b1115611f925760405160e560020a62461bcd02815260040161045490615862565b600781015460208801511415611fc057611fad818c8b61386a565b611fbb816003018b8a61386a565b611fd9565b611fcb818c8b6138f8565b611fd9816003018b8a6138f8565b611fe4816001610ede565b8160020155611ff7600382016001610f13565b6005820155612007816001610f32565b6003558b516001820154604051600160a060020a039092169181156108fc0291906000818181858888f19350505050158015612047573d6000803e3d6000fd5b5060008181015560008160010155612063600382016001610fa0565b60049081556002548d518383015460405160e060020a63a9059cbb028152600160a060020a039093169363a9059cbb9361209f939291016153e7565b602060405180830381600087803b1580156120b957600080fd5b505af11580156120cd573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506120f1919081019061435f565b15156121125760405160e560020a62461bcd02815260040161045490615722565b600060038201819055600482015561212f60068201886002613ac4565b506008810186905560098101859055600085111561215b57600c8101805460ff1916600217905561216f565b6000600b820155600c8101805460ff191690555b600a81018054600160a060020a03191690558b51600054600160a060020a0391821691600080516020615d448339815191529116331461164757600161164a565b60408051808201909152600f8152608960020a6e21b430b73732b61026b0b730b3b2b902602082015281565b600354600090611d659030319063ffffffff6130f516565b600754600090819060ff161561221f5760405160e560020a62461bcd028152600401610454906157d2565b6007805460ff19166001179055600160a060020a038a16600090815260056020526040902091506002600c83015460ff16600281111561225b57fe5b1461227b5760405160e560020a62461bcd02815260040161045490615922565b600054600160a060020a031633148061229c575033600160a060020a038b16145b15156122bd5760405160e560020a62461bcd028152600401610454906156d2565b88600160a060020a03168a600160a060020a031614806122ee575087600160a060020a03168a600160a060020a0316145b151561230f5760405160e560020a62461bcd02815260040161045490615a12565b602086015115801561232357506020850151155b15156123445760405160e560020a62461bcd02815260040161045490615892565b50600160a060020a038089166000908152600660209081526040808320938b1683529281528282208983529052206005810154158015906123885750428160050154105b15156123a95760405160e560020a62461bcd02815260040161045490615932565b8060060189600160a060020a03168b600160a060020a0316146123cd5760016123d0565b60005b60ff16600281106123dd57fe5b602081049091015460ff601f9092166101000a900416156124135760405160e560020a62461bcd02815260040161045490615822565b612429898989898960008a8a8a60080154612def565b8551600182015461243c90836000610aae565b1461245c5760405160e560020a62461bcd028152600401610454906158e2565b8451600382015461247290600284016000610aae565b146124925760405160e560020a62461bcd02815260040161045490615952565b6124aa8160010154610ef88360000154856002610eea565b82600201556124d06002820160010154610ef86002840160000154600386016002610eea565b600583015560018101546124e990610ef8836000610f3b565b600355600160a060020a038a8116908916141561253f576001810154604051600160a060020a038c169180156108fc02916000818181858888f19350505050158015612539573d6000803e3d6000fd5b50612591565b88600160a060020a03168a600160a060020a03161415612591578054604051600160a060020a038c169180156108fc02916000818181858888f1935050505015801561258f573d6000803e3d6000fd5b505b60038101546125a890610ef8600284016000610fac565b600455600160a060020a038a8116908916141561267057600254600382015460405160e060020a63a9059cbb028152600160a060020a039092169163a9059cbb916125f8918e91906004016153e7565b602060405180830381600087803b15801561261257600080fd5b505af1158015612626573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525061264a919081019061435f565b151561266b5760405160e560020a62461bcd028152600401610454906159d2565b612736565b88600160a060020a03168a600160a060020a0316141561273657600280549082015460405160e060020a63a9059cbb028152600160a060020a039092169163a9059cbb916126c3918e91906004016153e7565b602060405180830381600087803b1580156126dd57600080fd5b505af11580156126f1573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250612715919081019061435f565b15156127365760405160e560020a62461bcd02815260040161045490615982565b6001816006018a600160a060020a03168c600160a060020a03161461275c57600161275f565b60005b60ff166002811061276c57fe5b602091828204019190066101000a81548160ff0219169083151502179055506127a3600183600901546130f590919063ffffffff16565b6009830181905515156127cb57600060088301819055600b830155600c8201805460ff191690555b87600160a060020a031689600160a060020a03167ff45587a14ff8928bdd940cbf0564b42320b5e46a8fdecaf8a98a9eab63ab1f968c8a33604080519081016040528089600001600060038110151561282057fe5b0154815260018a015460209182015260408051808201825260038c0154815260048c01549281019290925260088b015460098c0154915161286b97969594939260068e019291615402565b60405180910390a350506007805460ff191690555050505050505050565b600254600160a060020a031681565b600754600090819060ff16156128c35760405160e560020a62461bcd028152600401610454906157d2565b6007805460ff19166001179055600160a060020a038a16600090815260056020526040902091506002600c83015460ff1660028111156128ff57fe5b1461291f5760405160e560020a62461bcd028152600401610454906159a2565b600054600160a060020a0316331480612940575033600160a060020a038b16145b15156129615760405160e560020a62461bcd02815260040161045490615902565b88600160a060020a03168a600160a060020a03161480612992575087600160a060020a03168a600160a060020a0316145b15156129b35760405160e560020a62461bcd02815260040161045490615a12565b60208601511580156129c757506020850151155b15156129e85760405160e560020a62461bcd02815260040161045490615892565b50600160a060020a038089166000908152600660209081526040808320938b168352928152828220898352905220600581015415612a3b5760405160e560020a62461bcd028152600401610454906157b2565b612a51898989898960008a8a8a60080154612def565b612a5d81876002613ac4565b50612a6e6002808301908790613ac4565b50600154612a8390429063ffffffff6130d816565b60058201556004810154604051600160a060020a03808b1692908c1691600080516020615ce48339815191529161286b918f918d913391899160028301919061547b565b60075460009060ff1615612af05760405160e560020a62461bcd028152600401610454906157d2565b6007805460ff1916600117905587600260200201513414612b265760405160e560020a62461bcd028152600401610454906159e2565b6005600033600160a060020a0316600160a060020a031681526020019081526020016000209050612b5e81878c8c8c8c89600061310c565b604080518082018252338152600160a060020a038d1660208083019190915282518082018452600080825284518086019095526001855291840191909152612bb8928d918d918d918d918d918d918d918d918d91906133d0565b600254604080890151905160e060020a6323b872dd028152600160a060020a03909216916323b872dd91612bf291339130916004016153bf565b602060405180830381600087803b158015612c0c57600080fd5b505af1158015612c20573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250612c44919081019061435f565b1515612c655760405160e560020a62461bcd028152600401610454906158f2565b612c72818b8b8b8b613799565b6060880151604051600160a060020a038d169180156108fc02916000818181858888f19350505050158015612cab573d6000803e3d6000fd5b50600254606088015160405160e060020a63a9059cbb028152600160a060020a039092169163a9059cbb91612ce5918f91906004016153e7565b602060405180830381600087803b158015612cff57600080fd5b505af1158015612d13573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250612d37919081019061435f565b1515612d585760405160e560020a62461bcd02815260040161045490615722565b612d6760068201876002613ac4565b5060088101859055600981018490556040513390600080516020615d0483398151915290612da8906001908e908e908e908e9060068a01908e908e9061563f565b60405180910390a250506007805460ff19169055505050505050505050565b60015481565b604080518082019091526005815260d860020a64302e302e3102602082015281565b6000600160a060020a038a8116908a161415612e205760405160e560020a62461bcd028152600401610454906157c2565b600054600160a060020a038b8116911614801590612e4c5750600054600160a060020a038a8116911614155b1515612e6d5760405160e560020a62461bcd028152600401610454906158d2565b600160a060020a038a163014801590612e8f5750600160a060020a0389163014155b1515612eb05760405160e560020a62461bcd02815260040161045490615702565b308a8a8a8a8a8a6040516020018088600160a060020a0316600160a060020a0316606060020a02815260140187600160a060020a0316600160a060020a0316606060020a02815260140186600160a060020a0316600160a060020a0316606060020a02815260140185815260200184600260200280838360005b83811015612f42578181015183820152602001612f2a565b5050505090500183600260200280838360005b83811015612f6d578181015183820152602001612f55565b505050509050018281526020019750505050505050506040516020818303038152906040526040518082805190602001908083835b60208310612fc15780518252601f199092019160209182019101612fa2565b5181516020939093036101000a60001901801990911692169190911790526040519201829003822060e060020a631052506f028352945073__ECTools_______________________________9350631052506f92506130299185915087908f90600401615548565b60206040518083038186803b15801561304157600080fd5b505af4158015613055573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250613079919081019061435f565b151561309a5760405160e560020a62461bcd028152600401610454906156f2565b81156130cc576130ab81858461398c565b15156130cc5760405160e560020a62461bcd02815260040161045490615772565b50505050505050505050565b6000828201838110156130ea57600080fd5b8091505b5092915050565b6000808383111561310557600080fd5b5050900390565b6000600c89015460ff16600281111561312157fe5b146131415760405160e560020a62461bcd02815260040161045490615792565b81158061314d57508142105b151561316e5760405160e560020a62461bcd02815260040161045490615962565b60068801548751116131955760405160e560020a62461bcd028152600401610454906158c2565b6007880154602088015110156131c05760405160e560020a62461bcd028152600401610454906156c2565b87600201546131d087600161081b565b11156131f15760405160e560020a62461bcd028152600401610454906156e2565b600588015461320186600161085e565b11156132225760405160e560020a62461bcd02815260040161045490615862565b80156132a1576132306121dc565b604085015161324190866000610824565b11156132625760405160e560020a62461bcd02815260040161045490615912565b61326a611cd8565b604084015161327b90856000610824565b111561329c5760405160e560020a62461bcd02815260040161045490615812565b6132f7565b6132a96121dc565b845111156132cc5760405160e560020a62461bcd02815260040161045490615912565b6132d4611cd8565b835111156132f75760405160e560020a62461bcd02815260040161045490615812565b60608401516020808601519088015161332592916133199182908b6000610824565b9063ffffffff6130d816565b6040850151613342906133198760005b60200201518c6002610aae565b10156133635760405160e560020a62461bcd028152600401610454906156a2565b60608301516020808501519087015161338592916133199182908a6000610824565b60408401516133a5906133198660005b602002015160038d016002610aae565b10156133c65760405160e560020a62461bcd02815260040161045490615782565b5050505050505050565b600080548d51600160a060020a03908116911614156134045760405160e560020a62461bcd02815260040161045490615942565b8c51600160a060020a03163014156134315760405160e560020a62461bcd028152600401610454906159b2565b308d8d8d8d8d8d8d8d8d604051602001808b600160a060020a0316600160a060020a0316606060020a0281526014018a600260200280838360005b8381101561348457818101518382015260200161346c565b5050505090500189600260200280838360005b838110156134af578181015183820152602001613497565b5050505090500188600260200280838360005b838110156134da5781810151838201526020016134c2565b5050505090500187600460200280838360005b838110156135055781810151838201526020016134ed565b5050505090500186600460200280838360005b83811015613530578181015183820152602001613518565b5050505090500185600260200280838360005b8381101561355b578181015183820152602001613543565b5050505090500184600019166000191681526020018381526020018281526020019a50505050505050505050506040516020818303038152906040526040518082805190602001908083835b602083106135c65780518252601f1990920191602091820191016135a7565b5181516020939093036101000a600019018019909116921691909117905260405192018290039091209350849250600091506135ff9050565b6020020151156136c55760405160e060020a63dca9541902815273__ECTools_______________________________9063dca95419906136459084908890600401615528565b60206040518083038186803b15801561365d57600080fd5b505af4158015613671573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506136959190810190613d98565b600054600160a060020a039081169116146136c55760405160e560020a62461bcd02815260040161045490615742565b60208201511561378a5760405160e060020a63dca9541902815273__ECTools_______________________________9063dca954199061370b9084908790600401615528565b60206040518083038186803b15801561372357600080fd5b505af4158015613737573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525061375b9190810190613d98565b8d51600160a060020a0390811691161461378a5760405160e560020a62461bcd028152600401610454906157f2565b50505050505050505050505050565b6137a485858461386a565b6137b285600301848361386a565b60608201516020830151604084015184516003546137dc9493610ef89390928492613319916130d8565b60035560608101516020820151604083015183516004546138099493610ef89390928492613319916130d8565b6004556060820151602083015160408401516138319291610ef8918290613319886000613335565b600286015560608101516020820151604083015161385b9291610ef8918290613319876000613395565b60038601600201555050505050565b6020810151815111156138a9576138a261389a82600160200201518360005b60200201519063ffffffff6130f516565b836000610824565b83556138ae565b815183555b6060810151604082015111156138e7576138dc6138d48260036020020151836002613889565b836001610824565b8360015b01556138f3565b60208201518360015b01555b505050565b60208101518151111561390e5781518355613923565b80516139209061389a90836001613889565b83555b6060810151604082015111156139405760208201518360016138e0565b6139566138d48260026020020151836003613889565b8360016138f0565b60008083151561397157600091506130ee565b5082820282848281151561398157fe5b04146130ea57600080fd5b6000838160405b85518111613ab75785810151915081831015613a2e57604080516020808201869052818301859052825180830384018152606090920192839052815191929182918401908083835b602083106139fa5780518252601f1990920191602091820191016139db565b6001836020036101000a03801982511681845116808217855250505050505090500191505060405180910390209250613aaf565b604080516020808201859052818301869052825180830384018152606090920192839052815191929182918401908083835b60208310613a7f5780518252601f199092019160209182019101613a60565b6001836020036101000a038019825116818451168082178552505050505050905001915050604051809103902092505b602001613993565b5050919091149392505050565b8260028101928215613af2579160200282015b82811115613af2578251825591602001919060010190613ad7565b50613afe929150613b5a565b5090565b6101a060405190810160405280613b17613b74565b8152602001613b24613b74565b8152602001613b31613b93565b815260006020820181905260408201819052606082018190526080820181905260a09091015290565b611d6891905b80821115613afe5760008155600101613b60565b6060604051908101604052806003906020820280388339509192915050565b60408051808201825290600290829080388339509192915050565b6000613bba8235615c0e565b9392505050565b6000613bba8251615c0e565b6000601f82018313613bde57600080fd5b6002613bf1613bec82615bae565b615b88565b91508183856020840282011115613c0757600080fd5b60005b83811015613c335781613c1d8882613bae565b8452506020928301929190910190600101613c0a565b5050505092915050565b6000601f82018313613c4e57600080fd5b6002613c5c613bec82615bae565b91508183856020840282011115613c7257600080fd5b60005b83811015613c335781613c888882613d0b565b8452506020928301929190910190600101613c75565b6000601f82018313613caf57600080fd5b6004613cbd613bec82615bae565b91508183856020840282011115613cd357600080fd5b60005b83811015613c335781613ce98882613d0b565b8452506020928301929190910190600101613cd6565b6000613bba8251615c2c565b6000613bba8235611d68565b6000601f82018313613d2857600080fd5b8135613d36613bec82615bcb565b91508082526020830160208301858383011115613d5257600080fd5b613d5d838284615c5d565b50505092915050565b6000613bba8251611d68565b600060208284031215613d8457600080fd5b6000613d908484613bae565b949350505050565b600060208284031215613daa57600080fd5b6000613d908484613bc1565b600080600080600080600080610140898b031215613dd357600080fd5b6000613ddf8b8b613bae565b9850506020613df08b828c01613bae565b9750506040613e018b828c01613bae565b9650506060613e128b828c01613d0b565b9550506080613e238b828c01613c3d565b94505060c0613e348b828c01613c3d565b9350506101008901356001604060020a03811115613e5157600080fd5b613e5d8b828c01613d17565b9250506101208901356001604060020a03811115613e7a57600080fd5b613e868b828c01613d17565b9150509295985092959890939650565b60008060008060008060008060008060006102808c8e031215613eb857600080fd5b6000613ec48e8e613bae565b9b50506020613ed58e828f01613bae565b9a50506040613ee68e828f01613c3d565b9950506080613ef78e828f01613c3d565b98505060c0613f088e828f01613c9e565b975050610140613f1a8e828f01613c9e565b9650506101c0613f2c8e828f01613c3d565b955050610200613f3e8e828f01613d0b565b945050610220613f508e828f01613d0b565b935050610240613f628e828f01613d0b565b9250506102608c01356001604060020a03811115613f7f57600080fd5b613f8b8e828f01613d17565b9150509295989b509295989b9093969950565b6000806000806000806000610120888a031215613fba57600080fd5b6000613fc68a8a613bae565b9750506020613fd78a828b01613bae565b9650506040613fe88a828b01613d0b565b9550506060613ff98a828b01613c3d565b94505060a061400a8a828b01613c3d565b93505060e061401b8a828b01613d0b565b9250506101008801356001604060020a0381111561403857600080fd5b6140448a828b01613d17565b91505092959891949750929550565b60008060008060008060008060008060006102008c8e03121561407557600080fd5b60006140818e8e613bae565b9b505060206140928e828f01613bcd565b9a505060606140a38e828f01613d0b565b99505060806140b48e828f01613c3d565b98505060c06140c58e828f01613c3d565b9750506101008c01356001604060020a038111156140e257600080fd5b6140ee8e828f01613d17565b9650506101208c01356001604060020a0381111561410b57600080fd5b6141178e828f01613d17565b9550506101406141298e828f01613c3d565b94505061018061413b8e828f01613c3d565b9350506101c061414d8e828f01613d0b565b9250506101e08c01356001604060020a03811115613f7f57600080fd5b6000806000806000806000806000806102608b8d03121561418a57600080fd5b60006141968d8d613bae565b9a505060206141a78d828e01613c3d565b99505060606141b88d828e01613c3d565b98505060a06141c98d828e01613c9e565b9750506101206141db8d828e01613c9e565b9650506101a06141ed8d828e01613c3d565b9550506101e06141ff8d828e01613d0b565b9450506102006142118d828e01613d0b565b9350506102206142238d828e01613d0b565b9250506102408b01356001604060020a0381111561424057600080fd5b61424c8d828e01613d17565b9150509295989b9194979a5092959850565b60008060008060008060008060008060006102a08c8e03121561428057600080fd5b600061428c8e8e613bcd565b9b5050604061429d8e828f01613c3d565b9a505060806142ae8e828f01613c3d565b99505060c06142bf8e828f01613c9e565b9850506101406142d18e828f01613c9e565b9750506101c06142e38e828f01613c3d565b9650506102006142f58e828f01613d0b565b9550506102206143078e828f01613d0b565b9450506102406143198e828f01613d0b565b9350506102608c01356001604060020a0381111561433657600080fd5b6143428e828f01613d17565b9250506102808c01356001604060020a03811115613f7f57600080fd5b60006020828403121561437157600080fd5b6000613d908484613cff565b60006020828403121561438f57600080fd5b6000613d908484613d66565b600080604083850312156143ae57600080fd5b60006143ba8585613d0b565b92505060206143cb85828601613d0b565b9150509250929050565b6143de81615c0e565b82525050565b6143ed81615bf2565b6143f682611d68565b60005b828110156144265761440c8583516144b1565b61441582615c02565b6020959095019491506001016143f9565b5050505050565b61443681615bf2565b61443f82611d68565b60005b82811015614426576144558583546144b1565b61445e82615c08565b602095909501949150600101614442565b61447881615bf8565b61448182611d68565b60005b82811015614426576144978583516144b1565b6144a082615c02565b602095909501949150600101614484565b6143de81611d68565b6143de81615c31565b6143de81615c3c565b6143de81615c47565b60006144e082615bfe565b8084526144f4816020860160208601615c69565b6144fd81615c99565b9093016020019392505050565b60108152608060020a6f696e73756666696369656e742077656902602082015260400190565b603d8152600080516020615d2483398151915260208201527f6173736564206279203130206368616c6c656e676520706572696f6473000000604082015260600190565b604681527f6f6e636861696e207478436f756e74206d75737420626520686967686572206f60208201527f7220657175616c20746f207468652063757272656e74206f6e636861696e2074604082015260d260020a651e10dbdd5b9d02606082015260800190565b602181527f6f6e6c7920687562206f7220757365722063616e20656d707479207468726561602082015260fa60020a601902604082015260600190565b60158152605a60020a741dd95a481b5d5cdd0818994818dbdb9cd95c9d995902602082015260400190565b60118152607a60020a701cda59db985d1d5c99481a5b9d985b1a5902602082015260400190565b602d81527f6368616e6e656c206d616e616765722063616e206e6f742062652073656e64656020820152609960020a6c391037b9103932b1b2b4bb32b902604082015260600190565b602981527f6368616e6e656c20636c6f73696e672074696d65206d757374206e6f74206861602082015260ba60020a681d99481c185cdcd95902604082015260600190565b602581527f7573657220746f6b656e207769746864726177616c207472616e736665722066602082015260da60020a64185a5b195902604082015260600190565b602481527f72656365697665722062616c616e636573206d6179206e657665722064656372602082015260e060020a636561736502604082015260600190565b60158152605a60020a741a1d58881cda59db985d1d5c99481a5b9d985b1a5902602082015260400190565b601a81527f6368616e6e656c206d75737420626520696e2064697370757465000000000000602082015260400190565b603a81527f75706461746564207765692062616c616e636573206d757374206d617463682060208201527f73756d206f6620746872656164207765692062616c616e636573000000000000604082015260600190565b603381527f696e697469616c20746872656164207374617465206973206e6f7420636f6e746020820152606a60020a72185a5b9959081a5b881d1a1c995859149bdbdd02604082015260600190565b60128152607160020a7134b739bab33334b1b4b2b73a103a37b5b2b702602082015260400190565b60148152606160020a7331b430b73732b61036bab9ba1031329037b832b702602082015260400190565b602481527f6368616c6c656e6765722063616e206e6f74206265206578697420696e697469602082015260e160020a6330ba37b902604082015260600190565b60208082527f74687265616420636c6f73696e672074696d65206d757374206265207a65726f9082015260400190565b601a81527f73656e6465722063616e206e6f74206265207265636569766572000000000000602082015260400190565b600f8152608960020a6e2932b2b73a3930b73a1031b0b6361702602082015260400190565b604781527f73756d206f66207570646174656420746f6b656e2062616c616e636573206d7560208201527f7374206d617463682073656e646572277320696e697469616c20746f6b656e20604082015260c860020a6662616c616e636502606082015260800190565b60168152605260020a751d5cd95c881cda59db985d1d5c99481a5b9d985b1a5902602082015260400190565b604481527f687562436f6e747261637457697468647261773a20436f6e747261637420746f60208201527f6b656e2066756e6473206e6f742073756666696369656e7420746f2077697468604082015260e060020a636472617702606082015260800190565b602881527f696e73756666696369656e74207265736572766520746f6b656e7320666f7220602082015260c060020a676465706f7369747302604082015260600190565b60178152604860020a76757365722063616e6e6f7420656d70747920747769636502602082015260400190565b602b81527f687562436f6e747261637457697468647261773a20546f6b656e207472616e73602082015260a860020a6a666572206661696c75726502604082015260600190565b602b81527f63616e2774207374617274206578697420776974682074696d652d73656e7369602082015260a860020a6a746976652073746174657302604082015260600190565b603e81527f7570646174656420746f6b656e2062616c616e636573206d757374206d61746360208201527f682073756d206f662074687265616420746f6b656e2062616c616e6365730000604082015260600190565b60188152604260020a771d1bdad95b9cc81b5d5cdd0818994818dbdb9cd95c9d995902602082015260400190565b604281527f687562436f6e747261637457697468647261773a20436f6e747261637420776560208201527f692066756e6473206e6f742073756666696369656e7420746f20776974686472604082015260f060020a61617702606082015260800190565b602881527f74687265616420636c6f73696e672074696d65206d757374206e6f7420686176602082015260c260020a6719481c185cdcd95902604082015260600190565b602681527f696e697469616c2072656365697665722062616c616e636573206d7573742062602082015260d060020a6565207a65726f02604082015260600190565b602581527f6368616c6c656e676572206d757374206265206569746865722075736572206f602082015260d960020a643910343ab102604082015260600190565b604381527f73756d206f662075706461746564207765692062616c616e636573206d75737460208201527f206d617463682073656e646572277320696e697469616c207765692062616c61604082015260e860020a626e636502606082015260800190565b603d81527f676c6f62616c207478436f756e74206d7573742062652068696768657220746860208201527f616e207468652063757272656e7420676c6f62616c207478436f756e74000000604082015260600190565b602181527f6875622063616e206e6f742062652073656e646572206f722072656365697665602082015260f960020a603902604082015260600190565b604281527f73756d206f6620746872656164207765692062616c616e636573206d7573742060208201527f6d617463682073656e646572277320696e697469616c207765692062616c616e604082015260f060020a61636502606082015260800190565b60198152603a60020a781d5cd95c881d1bdad95b8819195c1bdcda5d0819985a5b195902602082015260400190565b602981527f746872656164206578697420696e69746961746f72206d757374206265207573602082015260b960020a6832b91037b910343ab102604082015260600190565b602581527f696e73756666696369656e7420726573657276652077656920666f7220646570602082015260d860020a646f7369747302604082015260600190565b60218152600080516020615ca4833981519152602082015260f860020a606502604082015260600190565b602481527f54687265616420636c6f73696e672074696d65206d7573742068617665207061602082015260e260020a631cdcd95902604082015260600190565b60138152606960020a723ab9b2b91031b0b7103737ba10313290343ab102602082015260400190565b604681527f73756d206f662074687265616420746f6b656e2062616c616e636573206d757360208201527f74206d617463682073656e646572277320696e697469616c20746f6b656e2062604082015260d060020a65616c616e636502606082015260800190565b602b81527f7468652074696d656f7574206d757374206265207a65726f206f72206e6f7420602082015260aa60020a6a1a185d99481c185cdcd95902604082015260600190565b602c81527f7570646174656420746872656164207478436f756e74206d7573742062652068602082015260a460020a6b06967686572207468616e20302604082015260600190565b602e81527f75736572205b73656e6465725d20746f6b656e207769746864726177616c20746020820152609260020a6d1c985b9cd9995c8819985a5b195902604082015260600190565b602281527f6578697420696e69746961746f72206d7573742062652075736572206f722068602082015260f160020a613ab102604082015260600190565b60278152600080516020615ca4833981519152602082015260c860020a666520706861736502604082015260600190565b601f81527f757365722063616e206e6f74206265206368616e6e656c206d616e6167657200602082015260400190565b60558152600080516020615d2483398151915260208201527f6173736564206f72206d73672e73656e646572206d757374206265206e6f6e2d6040820152605860020a74657869742d696e6974696174696e6720706172747902606082015260800190565b603081527f75736572205b72656365697665725d20746f6b656e207769746864726177616c6020820152608260020a6f081d1c985b9cd9995c8819985a5b195902604082015260600190565b602e81527f6d73672e76616c7565206973206e6f7420657175616c20746f2070656e64696e6020820152609260020a6d19c81d5cd95c8819195c1bdcda5d02604082015260600190565b603d81527f746872656164207478436f756e74206d7573742062652068696768657220746860208201527f616e207468652063757272656e7420746872656164207478436f756e74000000604082015260600190565b603481527f6f6e6c79206875622c2073656e6465722c206f722072656365697665722063616020820152606160020a73371031b0b636103a3434b990333ab731ba34b7b702604082015260600190565b602681527f75736572206d757374206265207468726561642073656e646572206f72207265602082015260d160020a6531b2b4bb32b902604082015260600190565b6143de81615c52565b602081016153b982846143d5565b92915050565b606081016153cd82866143d5565b6153da60208301856143d5565b613d9060408301846144b1565b604081016153f582856143d5565b613bba60208301846144b1565b6101608101615411828b6143d5565b61541e602083018a6144b1565b61542b60408301896143d5565b61543860608301886143e4565b61544560a08301876143e4565b61545260e083018661442d565b6154606101208301856144b1565b61546e6101408301846144b1565b9998505050505050505050565b610100810161548a82896143d5565b61549760208301886144b1565b6154a460408301876143d5565b6154b1606083018661442d565b6154be60a083018561442d565b6154cb60e08301846144b1565b979650505050505050565b61016081016154e5828b6143d5565b6154f2602083018a6144b1565b61542b60408301896144b1565b610100810161550e82896143d5565b61551b60208301886144b1565b6154a460408301876153a2565b6040810161553682856144b1565b8181036020830152613d9081846144d5565b6060810161555682866144b1565b818103602083015261556881856144d5565b9050613d9060408301846143d5565b60a0810161558582886144b1565b61559260208301876144b1565b61559f60408301866143d5565b6155ac60608301856144b1565b6155b960808301846144c3565b9695505050505050565b602081016153b982846144ba565b61022081016155e0828b6144cc565b6155ed602083018a6143e4565b6155fa60608301896143e4565b61560760a083018861446f565b61561561012083018761446f565b6156236101a08301866143e4565b6156316101e08301856144b1565b61546e6102008301846144b1565b610220810161564e828b6144cc565b61565b602083018a6143e4565b61566860608301896143e4565b61567560a083018861446f565b61568361012083018761446f565b6156236101a083018661442d565b60208082528101613bba81846144d5565b602080825281016153b98161450a565b602080825281016153b981614530565b602080825281016153b981614574565b602080825281016153b9816145dc565b602080825281016153b981614619565b602080825281016153b981614644565b602080825281016153b98161466b565b602080825281016153b9816146b4565b602080825281016153b9816146f9565b602080825281016153b98161473a565b602080825281016153b98161477a565b602080825281016153b9816147a5565b602080825281016153b9816147d5565b602080825281016153b98161482b565b602080825281016153b98161487a565b602080825281016153b9816148a2565b602080825281016153b9816148cc565b602080825281016153b98161490c565b602080825281016153b98161493c565b602080825281016153b98161496c565b602080825281016153b981614991565b602080825281016153b9816149fa565b602080825281016153b981614a26565b602080825281016153b981614a8c565b602080825281016153b981614ad0565b602080825281016153b981614afd565b602080825281016153b981614b44565b602080825281016153b981614b8b565b602080825281016153b981614be1565b602080825281016153b981614c0f565b602080825281016153b981614c73565b602080825281016153b981614cb7565b602080825281016153b981614cf9565b602080825281016153b981614d3a565b602080825281016153b981614d9f565b602080825281016153b981614df5565b602080825281016153b981614e32565b602080825281016153b981614e96565b602080825281016153b981614ec5565b602080825281016153b981614f0a565b602080825281016153b981614f4b565b602080825281016153b981614f76565b602080825281016153b981614fb6565b602080825281016153b981614fdf565b602080825281016153b981615047565b602080825281016153b98161508e565b602080825281016153b9816150d6565b602080825281016153b981615120565b602080825281016153b98161515e565b602080825281016153b98161518f565b602080825281016153b9816151bf565b602080825281016153b981615224565b602080825281016153b981615270565b602080825281016153b9816152ba565b602080825281016153b981615310565b602080825281016153b981615360565b602081016153b982846144b1565b60e08101615a3e82886144b1565b615a4b60208301876143d5565b615a58604083018661442d565b615a65608083018561442d565b6155b960c08301846144b1565b604081016153f582856144b1565b60e08101615a8e828a6144b1565b615a9b60208301896144b1565b615aa860408301886144b1565b615ab560608301876144b1565b615ac260808301866143d5565b615acf60a08301856144b1565b615adc60c08301846144c3565b98975050505050505050565b60c08101615af682896144b1565b615b0360208301886144b1565b615b1060408301876144b1565b615b1d60608301866144b1565b615b2a60808301856144b1565b6154cb60a08301846144b1565b6101208101615b4682896153a2565b615b5360208301886143e4565b615b6060608301876143e4565b615b6d60a083018661442d565b615b7a60e08301856144b1565b6154cb6101008301846144b1565b6040518181016001604060020a0381118282101715615ba657600080fd5b604052919050565b60006001604060020a03821115615bc457600080fd5b5060200290565b60006001604060020a03821115615be157600080fd5b506020601f91909101601f19160190565b50600290565b50600490565b5190565b60200190565b60010190565b600160a060020a031690565b600060038210613afe57fe5b60ff1690565b151590565b60006153b982615c0e565b60006153b982615c1a565b60006153b982611d68565b60006153b982615c26565b82818337506000910152565b60005b83811015615c84578181015183820152602001615c6c565b83811115615c93576000848401525b50505050565b601f01601f19169056006368616e6e656c206d75737420626520696e20746872656164206469737075746e65112e059a868cb1c7c4aed27e34fbbe470d2df0cbaa09bb5f82e5cba029fadbf69f39706ae3cb4e5b9dbca5780e14ba4968cdd060d5c3268f335ad6c25761eace9ecdebd30bbfc243bdc30bfa016abfa8f627654b4989da4620271dc77b1c6368616e6e656c20636c6f73696e672074696d65206d75737420686176652070ff678da893f9e68225fd9be0e51123341ba6d50fe0df41edebef4e9c0d242f77a265627a7a72305820389f96f409c8d57004ed8198cd107948d49902f7b7397f4e20799f11c0faacff6c6578706572696d656e74616cf50037'
