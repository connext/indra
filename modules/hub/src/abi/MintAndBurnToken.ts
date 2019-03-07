export const ABI = {
  "contractName": "MintAndBurnToken",
  "abi": [
    {
      "constant": true,
      "inputs": [],
      "name": "mintingFinished",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "name",
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
      "constant": false,
      "inputs": [
        {
          "name": "_spender",
          "type": "address"
        },
        {
          "name": "_value",
          "type": "uint256"
        }
      ],
      "name": "approve",
      "outputs": [
        {
          "name": "success",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "totalSupply",
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
          "name": "_from",
          "type": "address"
        },
        {
          "name": "_to",
          "type": "address"
        },
        {
          "name": "_value",
          "type": "uint256"
        }
      ],
      "name": "transferFrom",
      "outputs": [
        {
          "name": "success",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "decimals",
      "outputs": [
        {
          "name": "",
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
      "name": "version",
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
      "inputs": [
        {
          "name": "_owner",
          "type": "address"
        }
      ],
      "name": "balanceOf",
      "outputs": [
        {
          "name": "balance",
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
      "name": "owner",
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
      "name": "symbol",
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
      "constant": false,
      "inputs": [
        {
          "name": "_to",
          "type": "address"
        },
        {
          "name": "_value",
          "type": "uint256"
        }
      ],
      "name": "transfer",
      "outputs": [
        {
          "name": "success",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "_owner",
          "type": "address"
        },
        {
          "name": "_spender",
          "type": "address"
        }
      ],
      "name": "allowance",
      "outputs": [
        {
          "name": "remaining",
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
          "name": "newOwner",
          "type": "address"
        }
      ],
      "name": "transferOwnership",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "name": "_tokenName",
          "type": "string"
        },
        {
          "name": "_decimalUnits",
          "type": "uint8"
        },
        {
          "name": "_tokenSymbol",
          "type": "string"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "to",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "Mint",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [],
      "name": "MintFinished",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "burner",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "Burn",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "previousOwner",
          "type": "address"
        },
        {
          "indexed": true,
          "name": "newOwner",
          "type": "address"
        }
      ],
      "name": "OwnershipTransferred",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "_from",
          "type": "address"
        },
        {
          "indexed": true,
          "name": "_to",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "_value",
          "type": "uint256"
        }
      ],
      "name": "Transfer",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "_owner",
          "type": "address"
        },
        {
          "indexed": true,
          "name": "_spender",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "_value",
          "type": "uint256"
        }
      ],
      "name": "Approval",
      "type": "event"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "_to",
          "type": "address"
        },
        {
          "name": "_amount",
          "type": "uint256"
        }
      ],
      "name": "mint",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [],
      "name": "finishMinting",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "_value",
          "type": "uint256"
        }
      ],
      "name": "burn",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ],
  "bytecode": "0x60806040526000600360146101000a81548160ff0219169083151502179055506040805190810160405280600481526020017f48302e3100000000000000000000000000000000000000000000000000000000815250600790805190602001906200006c9291906200014a565b503480156200007a57600080fd5b50604051620016c0380380620016c083398101806040528101908080518201929190602001805190602001909291908051820192919050505033600360006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555082600490805190602001906200010c9291906200014a565b5081600560006101000a81548160ff021916908360ff1602179055508060069080519060200190620001409291906200014a565b50505050620001f9565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106200018d57805160ff1916838001178555620001be565b82800160010185558215620001be579182015b82811115620001bd578251825591602001919060010190620001a0565b5b509050620001cd9190620001d1565b5090565b620001f691905b80821115620001f2576000816000905550600101620001d8565b5090565b90565b6114b780620002096000396000f3006080604052600436106100e6576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff16806305d2035b146100eb57806306fdde031461011a578063095ea7b3146101aa57806318160ddd1461020f57806323b872dd1461023a578063313ce567146102bf57806340c10f19146102f057806342966c681461035557806354fd4d501461038257806370a08231146104125780637d64bcb4146104695780638da5cb5b1461049857806395d89b41146104ef578063a9059cbb1461057f578063dd62ed3e146105e4578063f2fde38b1461065b575b600080fd5b3480156100f757600080fd5b5061010061069e565b604051808215151515815260200191505060405180910390f35b34801561012657600080fd5b5061012f6106b1565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561016f578082015181840152602081019050610154565b50505050905090810190601f16801561019c5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b3480156101b657600080fd5b506101f5600480360381019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291908035906020019092919050505061074f565b604051808215151515815260200191505060405180910390f35b34801561021b57600080fd5b50610224610841565b6040518082815260200191505060405180910390f35b34801561024657600080fd5b506102a5600480360381019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610847565b604051808215151515815260200191505060405180910390f35b3480156102cb57600080fd5b506102d4610ab3565b604051808260ff1660ff16815260200191505060405180910390f35b3480156102fc57600080fd5b5061033b600480360381019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610ac6565b604051808215151515815260200191505060405180910390f35b34801561036157600080fd5b5061038060048036038101908080359060200190929190505050610c9c565b005b34801561038e57600080fd5b50610397610d05565b6040518080602001828103825283818151815260200191508051906020019080838360005b838110156103d75780820151818401526020810190506103bc565b50505050905090810190601f1680156104045780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34801561041e57600080fd5b50610453600480360381019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610da3565b6040518082815260200191505060405180910390f35b34801561047557600080fd5b5061047e610dec565b604051808215151515815260200191505060405180910390f35b3480156104a457600080fd5b506104ad610eb4565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b3480156104fb57600080fd5b50610504610eda565b6040518080602001828103825283818151815260200191508051906020019080838360005b83811015610544578082015181840152602081019050610529565b50505050905090810190601f1680156105715780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34801561058b57600080fd5b506105ca600480360381019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610f78565b604051808215151515815260200191505060405180910390f35b3480156105f057600080fd5b50610645600480360381019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff1690602001909291905050506110d1565b6040518082815260200191505060405180910390f35b34801561066757600080fd5b5061069c600480360381019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050611158565b005b600360149054906101000a900460ff1681565b60048054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156107475780601f1061071c57610100808354040283529160200191610747565b820191906000526020600020905b81548152906001019060200180831161072a57829003601f168201915b505050505081565b600081600260003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925846040518082815260200191505060405180910390a36001905092915050565b60005481565b600081600160008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410158015610914575081600260008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410155b151561091f57600080fd5b81600160008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000828254019250508190555081600160008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000828254039250508190555081600260008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825403925050819055508273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040518082815260200191505060405180910390a3600190509392505050565b600560009054906101000a900460ff1681565b6000600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16141515610b2457600080fd5b600360149054906101000a900460ff16151515610b4057600080fd5b610b4c826000546112b0565b600081905550610b9b82600160008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020546112b0565b600160008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508273ffffffffffffffffffffffffffffffffffffffff167f0f6798a560793a54c3bcfe86a93cde1e73087d944c0ea20544137d4121396885836040518082815260200191505060405180910390a28273ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040518082815260200191505060405180910390a36001905092915050565b600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16141515610cf857600080fd5b610d0233826112ce565b50565b60078054600181600116156101000203166002900480601f016020809104026020016040519081016040528092919081815260200182805460018160011615610100020316600290048015610d9b5780601f10610d7057610100808354040283529160200191610d9b565b820191906000526020600020905b815481529060010190602001808311610d7e57829003601f168201915b505050505081565b6000600160008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b6000600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16141515610e4a57600080fd5b600360149054906101000a900460ff16151515610e6657600080fd5b6001600360146101000a81548160ff0219169083151502179055507fae5184fba832cb2b1f702aca6117b8d265eaf03ad33eb133f19dde0f5920fa0860405160405180910390a16001905090565b600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b60068054600181600116156101000203166002900480601f016020809104026020016040519081016040528092919081815260200182805460018160011615610100020316600290048015610f705780601f10610f4557610100808354040283529160200191610f70565b820191906000526020600020905b815481529060010190602001808311610f5357829003601f168201915b505050505081565b600081600160003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410151515610fc857600080fd5b81600160003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000828254039250508190555081600160008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040518082815260200191505060405180910390a36001905092915050565b6000600260008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415156111b457600080fd5b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16141515156111f057600080fd5b8073ffffffffffffffffffffffffffffffffffffffff16600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a380600360006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050565b60008082840190508381101515156112c457fe5b8091505092915050565b600160008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054811115151561131c57600080fd5b611365600160008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205482611472565b600160008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506113b460005482611472565b6000819055508173ffffffffffffffffffffffffffffffffffffffff167fcc16f5dbb4873280815c1ee09dbd06736cffcc184412cf7a71a0fdb75d397ca5826040518082815260200191505060405180910390a2600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040518082815260200191505060405180910390a35050565b600082821115151561148057fe5b8183039050929150505600a165627a7a72305820366bc1eddf44f6669f792ace6df0a78020f54842887e12e74e49e453ec0f083d0029",
  "deployedBytecode": "0x6080604052600436106100e6576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff16806305d2035b146100eb57806306fdde031461011a578063095ea7b3146101aa57806318160ddd1461020f57806323b872dd1461023a578063313ce567146102bf57806340c10f19146102f057806342966c681461035557806354fd4d501461038257806370a08231146104125780637d64bcb4146104695780638da5cb5b1461049857806395d89b41146104ef578063a9059cbb1461057f578063dd62ed3e146105e4578063f2fde38b1461065b575b600080fd5b3480156100f757600080fd5b5061010061069e565b604051808215151515815260200191505060405180910390f35b34801561012657600080fd5b5061012f6106b1565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561016f578082015181840152602081019050610154565b50505050905090810190601f16801561019c5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b3480156101b657600080fd5b506101f5600480360381019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291908035906020019092919050505061074f565b604051808215151515815260200191505060405180910390f35b34801561021b57600080fd5b50610224610841565b6040518082815260200191505060405180910390f35b34801561024657600080fd5b506102a5600480360381019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610847565b604051808215151515815260200191505060405180910390f35b3480156102cb57600080fd5b506102d4610ab3565b604051808260ff1660ff16815260200191505060405180910390f35b3480156102fc57600080fd5b5061033b600480360381019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610ac6565b604051808215151515815260200191505060405180910390f35b34801561036157600080fd5b5061038060048036038101908080359060200190929190505050610c9c565b005b34801561038e57600080fd5b50610397610d05565b6040518080602001828103825283818151815260200191508051906020019080838360005b838110156103d75780820151818401526020810190506103bc565b50505050905090810190601f1680156104045780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34801561041e57600080fd5b50610453600480360381019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610da3565b6040518082815260200191505060405180910390f35b34801561047557600080fd5b5061047e610dec565b604051808215151515815260200191505060405180910390f35b3480156104a457600080fd5b506104ad610eb4565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b3480156104fb57600080fd5b50610504610eda565b6040518080602001828103825283818151815260200191508051906020019080838360005b83811015610544578082015181840152602081019050610529565b50505050905090810190601f1680156105715780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34801561058b57600080fd5b506105ca600480360381019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610f78565b604051808215151515815260200191505060405180910390f35b3480156105f057600080fd5b50610645600480360381019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff1690602001909291905050506110d1565b6040518082815260200191505060405180910390f35b34801561066757600080fd5b5061069c600480360381019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050611158565b005b600360149054906101000a900460ff1681565b60048054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156107475780601f1061071c57610100808354040283529160200191610747565b820191906000526020600020905b81548152906001019060200180831161072a57829003601f168201915b505050505081565b600081600260003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925846040518082815260200191505060405180910390a36001905092915050565b60005481565b600081600160008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410158015610914575081600260008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410155b151561091f57600080fd5b81600160008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000828254019250508190555081600160008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000828254039250508190555081600260008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825403925050819055508273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040518082815260200191505060405180910390a3600190509392505050565b600560009054906101000a900460ff1681565b6000600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16141515610b2457600080fd5b600360149054906101000a900460ff16151515610b4057600080fd5b610b4c826000546112b0565b600081905550610b9b82600160008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020546112b0565b600160008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508273ffffffffffffffffffffffffffffffffffffffff167f0f6798a560793a54c3bcfe86a93cde1e73087d944c0ea20544137d4121396885836040518082815260200191505060405180910390a28273ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040518082815260200191505060405180910390a36001905092915050565b600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16141515610cf857600080fd5b610d0233826112ce565b50565b60078054600181600116156101000203166002900480601f016020809104026020016040519081016040528092919081815260200182805460018160011615610100020316600290048015610d9b5780601f10610d7057610100808354040283529160200191610d9b565b820191906000526020600020905b815481529060010190602001808311610d7e57829003601f168201915b505050505081565b6000600160008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b6000600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16141515610e4a57600080fd5b600360149054906101000a900460ff16151515610e6657600080fd5b6001600360146101000a81548160ff0219169083151502179055507fae5184fba832cb2b1f702aca6117b8d265eaf03ad33eb133f19dde0f5920fa0860405160405180910390a16001905090565b600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b60068054600181600116156101000203166002900480601f016020809104026020016040519081016040528092919081815260200182805460018160011615610100020316600290048015610f705780601f10610f4557610100808354040283529160200191610f70565b820191906000526020600020905b815481529060010190602001808311610f5357829003601f168201915b505050505081565b600081600160003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410151515610fc857600080fd5b81600160003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000828254039250508190555081600160008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040518082815260200191505060405180910390a36001905092915050565b6000600260008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415156111b457600080fd5b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16141515156111f057600080fd5b8073ffffffffffffffffffffffffffffffffffffffff16600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a380600360006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050565b60008082840190508381101515156112c457fe5b8091505092915050565b600160008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054811115151561131c57600080fd5b611365600160008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205482611472565b600160008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506113b460005482611472565b6000819055508173ffffffffffffffffffffffffffffffffffffffff167fcc16f5dbb4873280815c1ee09dbd06736cffcc184412cf7a71a0fdb75d397ca5826040518082815260200191505060405180910390a2600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040518082815260200191505060405180910390a35050565b600082821115151561148057fe5b8183039050929150505600a165627a7a72305820366bc1eddf44f6669f792ace6df0a78020f54842887e12e74e49e453ec0f083d0029",
  "sourceMap": "399:3132:3:-;;;560:5;530:35;;;;;;;;;;;;;;;;;;;;1294:30;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;1396:423;8:9:-1;5:2;;;30:1;27;20:12;5:2;1396:423:3;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;503:10:5;495:5;;:18;;;;;;;;;;;;;;;;;;1527:10:3;1520:4;:17;;;;;;;;;;;;:::i;:::-;;1629:13;1618:8;;:24;;;;;;;;;;;;;;;;;;1731:12;1722:6;:21;;;;;;;;;;;;:::i;:::-;;1396:423;;;399:3132;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::i;:::-;;;:::o;:::-;;;;;;;;;;;;;;;;;;;;;;;;;;;:::o;:::-;;;;;;;",
  "deployedSourceMap": "399:3132:3:-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;530:35;;8:9:-1;5:2;;;30:1;27;20:12;5:2;530:35:3;;;;;;;;;;;;;;;;;;;;;;;;;;;963:18;;8:9:-1;5:2;;;30:1;27;20:12;5:2;963:18:3;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;23:1:-1;8:100;33:3;30:1;27:10;8:100;;;99:1;94:3;90:11;84:18;80:1;75:3;71:11;64:39;52:2;49:1;45:10;40:15;;8:100;;;12:14;963:18:3;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;1774:210:8;;8:9:-1;5:2;;;30:1;27;20:12;5:2;1774:210:8;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;609:26:9;;8:9:-1;5:2;;;30:1;27;20:12;5:2;609:26:9;;;;;;;;;;;;;;;;;;;;;;;1043:602:8;;8:9:-1;5:2;;;30:1;27;20:12;5:2;1043:602:8;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;1034:21:3;;8:9:-1;5:2;;;30:1;27;20:12;5:2;1034:21:3;;;;;;;;;;;;;;;;;;;;;;;;;;;2055:291;;8:9:-1;5:2;;;30:1;27;20:12;5:2;2055:291:3;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;2988:83;;8:9:-1;5:2;;;30:1;27;20:12;5:2;2988:83:3;;;;;;;;;;;;;;;;;;;;;;;;;;1294:30;;8:9:-1;5:2;;;30:1;27;20:12;5:2;1294:30:3;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;23:1:-1;8:100;33:3;30:1;27:10;8:100;;;99:1;94:3;90:11;84:18;80:1;75:3;71:11;64:39;52:2;49:1;45:10;40:15;;8:100;;;12:14;1294:30:3;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;1651:117:8;;8:9:-1;5:2;;;30:1;27;20:12;5:2;1651:117:8;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;2460:140:3;;8:9:-1;5:2;;;30:1;27;20:12;5:2;2460:140:3;;;;;;;;;;;;;;;;;;;;;;;;;;;237:20:5;;8:9:-1;5:2;;;30:1;27;20:12;5:2;237:20:5;;;;;;;;;;;;;;;;;;;;;;;;;;;1228::3;;8:9:-1;5:2;;;30:1;27;20:12;5:2;1228:20:3;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;23:1:-1;8:100;33:3;30:1;27:10;8:100;;;99:1;94:3;90:11;84:18;80:1;75:3;71:11;64:39;52:2;49:1;45:10;40:15;;8:100;;;12:14;1228:20:3;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;424:613:8;;8:9:-1;5:2;;;30:1;27;20:12;5:2;424:613:8;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;1990:144;;8:9:-1;5:2;;;30:1;27;20:12;5:2;1990:144:8;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;826:174:5;;8:9:-1;5:2;;;30:1;27;20:12;5:2;826:174:5;;;;;;;;;;;;;;;;;;;;;;;;;;;;530:35:3;;;;;;;;;;;;;:::o;963:18::-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::o;1774:210:8:-;1841:12;1897:6;1865:7;:19;1873:10;1865:19;;;;;;;;;;;;;;;:29;1885:8;1865:29;;;;;;;;;;;;;;;:38;;;;1939:8;1918:38;;1927:10;1918:38;;;1949:6;1918:38;;;;;;;;;;;;;;;;;;1973:4;1966:11;;1774:210;;;;:::o;609:26:9:-;;;;:::o;1043:602:8:-;1125:12;1413:6;1394:8;:15;1403:5;1394:15;;;;;;;;;;;;;;;;:25;;:65;;;;;1453:6;1423:7;:14;1431:5;1423:14;;;;;;;;;;;;;;;:26;1438:10;1423:26;;;;;;;;;;;;;;;;:36;;1394:65;1386:74;;;;;;;;1487:6;1470:8;:13;1479:3;1470:13;;;;;;;;;;;;;;;;:23;;;;;;;;;;;1522:6;1503:8;:15;1512:5;1503:15;;;;;;;;;;;;;;;;:25;;;;;;;;;;;1568:6;1538:7;:14;1546:5;1538:14;;;;;;;;;;;;;;;:26;1553:10;1538:26;;;;;;;;;;;;;;;;:36;;;;;;;;;;;1605:3;1589:28;;1598:5;1589:28;;;1610:6;1589:28;;;;;;;;;;;;;;;;;;1634:4;1627:11;;1043:602;;;;;:::o;1034:21:3:-;;;;;;;;;;;;;:::o;2055:291::-;2133:4;647:5:5;;;;;;;;;;;633:19;;:10;:19;;;625:28;;;;;;;;605:15:3;;;;;;;;;;;604:16;596:25;;;;;;;;2159:34;2172:7;2181:11;;2159:12;:34::i;:::-;2145:11;:48;;;;2215:35;2228:7;2236:8;:13;2245:3;2236:13;;;;;;;;;;;;;;;;2215:12;:35::i;:::-;2199:8;:13;2208:3;2199:13;;;;;;;;;;;;;;;:51;;;;2266:3;2261:18;;;2271:7;2261:18;;;;;;;;;;;;;;;;;;2311:3;2290:34;;2307:1;2290:34;;;2316:7;2290:34;;;;;;;;;;;;;;;;;;2337:4;2330:11;;2055:291;;;;:::o;2988:83::-;647:5:5;;;;;;;;;;;633:19;;:10;:19;;;625:28;;;;;;;;3041:25:3;3047:10;3059:6;3041:5;:25::i;:::-;2988:83;:::o;1294:30::-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::o;1651:117:8:-;1711:15;1745:8;:16;1754:6;1745:16;;;;;;;;;;;;;;;;1738:23;;1651:117;;;:::o;2460:140:3:-;2519:4;647:5:5;;;;;;;;;;;633:19;;:10;:19;;;625:28;;;;;;;;605:15:3;;;;;;;;;;;604:16;596:25;;;;;;;;2549:4;2531:15;;:22;;;;;;;;;;;;;;;;;;2564:14;;;;;;;;;;2591:4;2584:11;;2460:140;:::o;237:20:5:-;;;;;;;;;;;;;:::o;1228::3:-;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::o;424:613:8:-;487:12;881:6;857:8;:20;866:10;857:20;;;;;;;;;;;;;;;;:30;;849:39;;;;;;;;922:6;898:8;:20;907:10;898:20;;;;;;;;;;;;;;;;:30;;;;;;;;;;;955:6;938:8;:13;947:3;938:13;;;;;;;;;;;;;;;;:23;;;;;;;;;;;997:3;976:33;;985:10;976:33;;;1002:6;976:33;;;;;;;;;;;;;;;;;;1026:4;1019:11;;424:613;;;;:::o;1990:144::-;2068:17;2102:7;:15;2110:6;2102:15;;;;;;;;;;;;;;;:25;2118:8;2102:25;;;;;;;;;;;;;;;;2095:32;;1990:144;;;;:::o;826:174:5:-;647:5;;;;;;;;;;;633:19;;:10;:19;;;625:28;;;;;;;;922:1;902:22;;:8;:22;;;;894:31;;;;;;;;964:8;936:37;;957:5;;;;;;;;;;;936:37;;;;;;;;;;;;987:8;979:5;;:16;;;;;;;;;;;;;;;;;;826:174;:::o;667:129:6:-;725:7;740:9;756:1;752;:5;740:17;;775:1;770;:6;;763:14;;;;;;790:1;783:8;;667:129;;;;;:::o;3075:454:3:-;3153:8;:14;3162:4;3153:14;;;;;;;;;;;;;;;;3143:6;:24;;3135:33;;;;;;;;3363:35;3376:8;:14;3385:4;3376:14;;;;;;;;;;;;;;;;3391:6;3363:12;:35::i;:::-;3346:8;:14;3355:4;3346:14;;;;;;;;;;;;;;;:52;;;;3418:32;3431:11;;3443:6;3418:12;:32::i;:::-;3404:11;:46;;;;3466:4;3461:18;;;3472:6;3461:18;;;;;;;;;;;;;;;;;;3513:1;3490:34;;3499:4;3490:34;;;3517:6;3490:34;;;;;;;;;;;;;;;;;;3075:454;;:::o;553:110:6:-;611:7;638:1;633;:6;;626:14;;;;;;657:1;653;:5;646:12;;553:110;;;;:::o",
  "source": "pragma solidity 0.4.24;\n\nimport \"./StandardToken.sol\";\nimport \"./OZ_Ownable.sol\";\nimport \"./SafeMath.sol\";\n\n\n/**\n * @title Mintable token\n * @dev Simple ERC20 Token example, with mintable token creation\n * @dev Issue: * https://github.com/OpenZeppelin/zeppelin-solidity/issues/120\n * Based on code by TokenMarketNet: https://github.com/TokenMarketNet/ico/blob/master/contracts/MintableToken.sol\n */\ncontract MintAndBurnToken is StandardToken, Ownable {\n  event Mint(address indexed to, uint256 amount);\n  event MintFinished();\n\n  bool public mintingFinished = false;\n\n\n  modifier canMint() {\n    require(!mintingFinished);\n    _;\n  }\n\n/* Public variables of the token */\n\n    /*\n    NOTE:\n    The following variables are OPTIONAL vanities. One does not have to include them.\n    They allow one to customise the token contract & in no way influences the core functionality.\n    Some wallets/interfaces might not even bother to look at this information.\n    */\n    string public name;                   //fancy name: eg Simon Bucks\n    uint8 public decimals;                //How many decimals to show. ie. There could 1000 base units with 3 decimals. Meaning 0.980 SBX = 980 base units. It's like comparing 1 wei to 1 ether.\n    string public symbol;                 //An identifier: eg SBX\n    string public version = 'H0.1';       //human 0.1 standard. Just an arbitrary versioning scheme.\n\n    constructor(\n        string _tokenName,\n        uint8 _decimalUnits,\n        string _tokenSymbol\n        ) public {\n        name = _tokenName;                                   // Set the name for display purposes\n        decimals = _decimalUnits;                            // Amount of decimals for display purposes\n        symbol = _tokenSymbol;                               // Set the symbol for display purposes\n    }\n\n  /**\n   * @dev Function to mint tokens\n   * @param _to The address that will receive the minted tokens.\n   * @param _amount The amount of tokens to mint.\n   * @return A boolean that indicates if the operation was successful.\n   */\n  function mint(address _to, uint256 _amount) onlyOwner canMint public returns (bool) {\n    totalSupply = SafeMath.add(_amount, totalSupply);\n    balances[_to] = SafeMath.add(_amount,balances[_to]);\n    emit Mint(_to, _amount);\n    emit Transfer(address(0), _to, _amount);\n    return true;\n  }\n\n  /**\n   * @dev Function to stop minting new tokens.\n   * @return True if the operation was successful.\n   */\n  function finishMinting() onlyOwner canMint public returns (bool) {\n    mintingFinished = true;\n    emit MintFinished();\n    return true;\n  }\n\n  // -----------------------------------\n  // BURN FUNCTIONS BELOW\n  // https://github.com/OpenZeppelin/openzeppelin-solidity/blob/master/contracts/token/ERC20/BurnableToken.sol\n  // -----------------------------------\n\n  event Burn(address indexed burner, uint256 value);\n\n  /**\n   * @dev Burns a specific amount of tokens.\n   * @param _value The amount of token to be burned.\n   */\n  function burn(uint256 _value) onlyOwner public {\n    _burn(msg.sender, _value);\n  }\n\n  function _burn(address _who, uint256 _value) internal {\n    require(_value <= balances[_who]);\n    // no need to require value <= totalSupply, since that would imply the\n    // sender's balance is greater than the totalSupply, which *should* be an assertion failure\n\n    balances[_who] = SafeMath.sub(balances[_who],_value);\n    totalSupply = SafeMath.sub(totalSupply,_value);\n    emit Burn(_who, _value);\n    emit Transfer(_who, address(0), _value);\n  }\n}\n",
  "sourcePath": "/Users/wolever/SpankChain/repos/spankbank/contracts/MintAndBurnToken.sol",
  "ast": {
    "absolutePath": "/Users/wolever/SpankChain/repos/spankbank/contracts/MintAndBurnToken.sol",
    "exportedSymbols": {
      "MintAndBurnToken": [
        494
      ]
    },
    "id": 495,
    "nodeType": "SourceUnit",
    "nodes": [
      {
        "id": 298,
        "literals": [
          "solidity",
          "0.4",
          ".24"
        ],
        "nodeType": "PragmaDirective",
        "src": "0:23:3"
      },
      {
        "absolutePath": "/Users/wolever/SpankChain/repos/spankbank/contracts/StandardToken.sol",
        "file": "./StandardToken.sol",
        "id": 299,
        "nodeType": "ImportDirective",
        "scope": 495,
        "sourceUnit": 3345,
        "src": "25:29:3",
        "symbolAliases": [],
        "unitAlias": ""
      },
      {
        "absolutePath": "/Users/wolever/SpankChain/repos/spankbank/contracts/OZ_Ownable.sol",
        "file": "./OZ_Ownable.sol",
        "id": 300,
        "nodeType": "ImportDirective",
        "scope": 495,
        "sourceUnit": 1556,
        "src": "55:26:3",
        "symbolAliases": [],
        "unitAlias": ""
      },
      {
        "absolutePath": "/Users/wolever/SpankChain/repos/spankbank/contracts/SafeMath.sol",
        "file": "./SafeMath.sol",
        "id": 301,
        "nodeType": "ImportDirective",
        "scope": 495,
        "sourceUnit": 1651,
        "src": "82:24:3",
        "symbolAliases": [],
        "unitAlias": ""
      },
      {
        "baseContracts": [
          {
            "arguments": null,
            "baseName": {
              "contractScope": null,
              "id": 302,
              "name": "StandardToken",
              "nodeType": "UserDefinedTypeName",
              "referencedDeclaration": 3344,
              "src": "428:13:3",
              "typeDescriptions": {
                "typeIdentifier": "t_contract$_StandardToken_$3344",
                "typeString": "contract StandardToken"
              }
            },
            "id": 303,
            "nodeType": "InheritanceSpecifier",
            "src": "428:13:3"
          },
          {
            "arguments": null,
            "baseName": {
              "contractScope": null,
              "id": 304,
              "name": "Ownable",
              "nodeType": "UserDefinedTypeName",
              "referencedDeclaration": 1555,
              "src": "443:7:3",
              "typeDescriptions": {
                "typeIdentifier": "t_contract$_Ownable_$1555",
                "typeString": "contract Ownable"
              }
            },
            "id": 305,
            "nodeType": "InheritanceSpecifier",
            "src": "443:7:3"
          }
        ],
        "contractDependencies": [
          1555,
          3344,
          3410
        ],
        "contractKind": "contract",
        "documentation": "@title Mintable token\n@dev Simple ERC20 Token example, with mintable token creation\n@dev Issue: * https://github.com/OpenZeppelin/zeppelin-solidity/issues/120\nBased on code by TokenMarketNet: https://github.com/TokenMarketNet/ico/blob/master/contracts/MintableToken.sol",
        "fullyImplemented": true,
        "id": 494,
        "linearizedBaseContracts": [
          494,
          1555,
          3344,
          3410
        ],
        "name": "MintAndBurnToken",
        "nodeType": "ContractDefinition",
        "nodes": [
          {
            "anonymous": false,
            "documentation": null,
            "id": 311,
            "name": "Mint",
            "nodeType": "EventDefinition",
            "parameters": {
              "id": 310,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 307,
                  "indexed": true,
                  "name": "to",
                  "nodeType": "VariableDeclaration",
                  "scope": 311,
                  "src": "466:18:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_address",
                    "typeString": "address"
                  },
                  "typeName": {
                    "id": 306,
                    "name": "address",
                    "nodeType": "ElementaryTypeName",
                    "src": "466:7:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_address",
                      "typeString": "address"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 309,
                  "indexed": false,
                  "name": "amount",
                  "nodeType": "VariableDeclaration",
                  "scope": 311,
                  "src": "486:14:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 308,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "486:7:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                }
              ],
              "src": "465:36:3"
            },
            "src": "455:47:3"
          },
          {
            "anonymous": false,
            "documentation": null,
            "id": 313,
            "name": "MintFinished",
            "nodeType": "EventDefinition",
            "parameters": {
              "id": 312,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "523:2:3"
            },
            "src": "505:21:3"
          },
          {
            "constant": false,
            "id": 316,
            "name": "mintingFinished",
            "nodeType": "VariableDeclaration",
            "scope": 494,
            "src": "530:35:3",
            "stateVariable": true,
            "storageLocation": "default",
            "typeDescriptions": {
              "typeIdentifier": "t_bool",
              "typeString": "bool"
            },
            "typeName": {
              "id": 314,
              "name": "bool",
              "nodeType": "ElementaryTypeName",
              "src": "530:4:3",
              "typeDescriptions": {
                "typeIdentifier": "t_bool",
                "typeString": "bool"
              }
            },
            "value": {
              "argumentTypes": null,
              "hexValue": "66616c7365",
              "id": 315,
              "isConstant": false,
              "isLValue": false,
              "isPure": true,
              "kind": "bool",
              "lValueRequested": false,
              "nodeType": "Literal",
              "src": "560:5:3",
              "subdenomination": null,
              "typeDescriptions": {
                "typeIdentifier": "t_bool",
                "typeString": "bool"
              },
              "value": "false"
            },
            "visibility": "public"
          },
          {
            "body": {
              "id": 324,
              "nodeType": "Block",
              "src": "590:43:3",
              "statements": [
                {
                  "expression": {
                    "argumentTypes": null,
                    "arguments": [
                      {
                        "argumentTypes": null,
                        "id": 320,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": false,
                        "lValueRequested": false,
                        "nodeType": "UnaryOperation",
                        "operator": "!",
                        "prefix": true,
                        "src": "604:16:3",
                        "subExpression": {
                          "argumentTypes": null,
                          "id": 319,
                          "name": "mintingFinished",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 316,
                          "src": "605:15:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_bool",
                            "typeString": "bool"
                          }
                        },
                        "typeDescriptions": {
                          "typeIdentifier": "t_bool",
                          "typeString": "bool"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_bool",
                          "typeString": "bool"
                        }
                      ],
                      "id": 318,
                      "name": "require",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [
                        3428,
                        3429
                      ],
                      "referencedDeclaration": 3428,
                      "src": "596:7:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_require_pure$_t_bool_$returns$__$",
                        "typeString": "function (bool) pure"
                      }
                    },
                    "id": 321,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "596:25:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 322,
                  "nodeType": "ExpressionStatement",
                  "src": "596:25:3"
                },
                {
                  "id": 323,
                  "nodeType": "PlaceholderStatement",
                  "src": "627:1:3"
                }
              ]
            },
            "documentation": null,
            "id": 325,
            "name": "canMint",
            "nodeType": "ModifierDefinition",
            "parameters": {
              "id": 317,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "587:2:3"
            },
            "src": "571:62:3",
            "visibility": "internal"
          },
          {
            "constant": false,
            "id": 327,
            "name": "name",
            "nodeType": "VariableDeclaration",
            "scope": 494,
            "src": "963:18:3",
            "stateVariable": true,
            "storageLocation": "default",
            "typeDescriptions": {
              "typeIdentifier": "t_string_storage",
              "typeString": "string"
            },
            "typeName": {
              "id": 326,
              "name": "string",
              "nodeType": "ElementaryTypeName",
              "src": "963:6:3",
              "typeDescriptions": {
                "typeIdentifier": "t_string_storage_ptr",
                "typeString": "string"
              }
            },
            "value": null,
            "visibility": "public"
          },
          {
            "constant": false,
            "id": 329,
            "name": "decimals",
            "nodeType": "VariableDeclaration",
            "scope": 494,
            "src": "1034:21:3",
            "stateVariable": true,
            "storageLocation": "default",
            "typeDescriptions": {
              "typeIdentifier": "t_uint8",
              "typeString": "uint8"
            },
            "typeName": {
              "id": 328,
              "name": "uint8",
              "nodeType": "ElementaryTypeName",
              "src": "1034:5:3",
              "typeDescriptions": {
                "typeIdentifier": "t_uint8",
                "typeString": "uint8"
              }
            },
            "value": null,
            "visibility": "public"
          },
          {
            "constant": false,
            "id": 331,
            "name": "symbol",
            "nodeType": "VariableDeclaration",
            "scope": 494,
            "src": "1228:20:3",
            "stateVariable": true,
            "storageLocation": "default",
            "typeDescriptions": {
              "typeIdentifier": "t_string_storage",
              "typeString": "string"
            },
            "typeName": {
              "id": 330,
              "name": "string",
              "nodeType": "ElementaryTypeName",
              "src": "1228:6:3",
              "typeDescriptions": {
                "typeIdentifier": "t_string_storage_ptr",
                "typeString": "string"
              }
            },
            "value": null,
            "visibility": "public"
          },
          {
            "constant": false,
            "id": 334,
            "name": "version",
            "nodeType": "VariableDeclaration",
            "scope": 494,
            "src": "1294:30:3",
            "stateVariable": true,
            "storageLocation": "default",
            "typeDescriptions": {
              "typeIdentifier": "t_string_storage",
              "typeString": "string"
            },
            "typeName": {
              "id": 332,
              "name": "string",
              "nodeType": "ElementaryTypeName",
              "src": "1294:6:3",
              "typeDescriptions": {
                "typeIdentifier": "t_string_storage_ptr",
                "typeString": "string"
              }
            },
            "value": {
              "argumentTypes": null,
              "hexValue": "48302e31",
              "id": 333,
              "isConstant": false,
              "isLValue": false,
              "isPure": true,
              "kind": "string",
              "lValueRequested": false,
              "nodeType": "Literal",
              "src": "1318:6:3",
              "subdenomination": null,
              "typeDescriptions": {
                "typeIdentifier": "t_stringliteral_d6d58ef494a91661d08cde370ab3ac80b175fdf7fb2bea79e75e8276633326a2",
                "typeString": "literal_string \"H0.1\""
              },
              "value": "H0.1"
            },
            "visibility": "public"
          },
          {
            "body": {
              "id": 355,
              "nodeType": "Block",
              "src": "1510:309:3",
              "statements": [
                {
                  "expression": {
                    "argumentTypes": null,
                    "id": 345,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "leftHandSide": {
                      "argumentTypes": null,
                      "id": 343,
                      "name": "name",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 327,
                      "src": "1520:4:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_string_storage",
                        "typeString": "string storage ref"
                      }
                    },
                    "nodeType": "Assignment",
                    "operator": "=",
                    "rightHandSide": {
                      "argumentTypes": null,
                      "id": 344,
                      "name": "_tokenName",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 336,
                      "src": "1527:10:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_string_memory_ptr",
                        "typeString": "string memory"
                      }
                    },
                    "src": "1520:17:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_string_storage",
                      "typeString": "string storage ref"
                    }
                  },
                  "id": 346,
                  "nodeType": "ExpressionStatement",
                  "src": "1520:17:3"
                },
                {
                  "expression": {
                    "argumentTypes": null,
                    "id": 349,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "leftHandSide": {
                      "argumentTypes": null,
                      "id": 347,
                      "name": "decimals",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 329,
                      "src": "1618:8:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint8",
                        "typeString": "uint8"
                      }
                    },
                    "nodeType": "Assignment",
                    "operator": "=",
                    "rightHandSide": {
                      "argumentTypes": null,
                      "id": 348,
                      "name": "_decimalUnits",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 338,
                      "src": "1629:13:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint8",
                        "typeString": "uint8"
                      }
                    },
                    "src": "1618:24:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint8",
                      "typeString": "uint8"
                    }
                  },
                  "id": 350,
                  "nodeType": "ExpressionStatement",
                  "src": "1618:24:3"
                },
                {
                  "expression": {
                    "argumentTypes": null,
                    "id": 353,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "leftHandSide": {
                      "argumentTypes": null,
                      "id": 351,
                      "name": "symbol",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 331,
                      "src": "1722:6:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_string_storage",
                        "typeString": "string storage ref"
                      }
                    },
                    "nodeType": "Assignment",
                    "operator": "=",
                    "rightHandSide": {
                      "argumentTypes": null,
                      "id": 352,
                      "name": "_tokenSymbol",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 340,
                      "src": "1731:12:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_string_memory_ptr",
                        "typeString": "string memory"
                      }
                    },
                    "src": "1722:21:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_string_storage",
                      "typeString": "string storage ref"
                    }
                  },
                  "id": 354,
                  "nodeType": "ExpressionStatement",
                  "src": "1722:21:3"
                }
              ]
            },
            "documentation": null,
            "id": 356,
            "implemented": true,
            "isConstructor": true,
            "isDeclaredConst": false,
            "modifiers": [],
            "name": "",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 341,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 336,
                  "name": "_tokenName",
                  "nodeType": "VariableDeclaration",
                  "scope": 356,
                  "src": "1417:17:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_string_memory_ptr",
                    "typeString": "string"
                  },
                  "typeName": {
                    "id": 335,
                    "name": "string",
                    "nodeType": "ElementaryTypeName",
                    "src": "1417:6:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_string_storage_ptr",
                      "typeString": "string"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 338,
                  "name": "_decimalUnits",
                  "nodeType": "VariableDeclaration",
                  "scope": 356,
                  "src": "1444:19:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint8",
                    "typeString": "uint8"
                  },
                  "typeName": {
                    "id": 337,
                    "name": "uint8",
                    "nodeType": "ElementaryTypeName",
                    "src": "1444:5:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint8",
                      "typeString": "uint8"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 340,
                  "name": "_tokenSymbol",
                  "nodeType": "VariableDeclaration",
                  "scope": 356,
                  "src": "1473:19:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_string_memory_ptr",
                    "typeString": "string"
                  },
                  "typeName": {
                    "id": 339,
                    "name": "string",
                    "nodeType": "ElementaryTypeName",
                    "src": "1473:6:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_string_storage_ptr",
                      "typeString": "string"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                }
              ],
              "src": "1407:95:3"
            },
            "payable": false,
            "returnParameters": {
              "id": 342,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "1510:0:3"
            },
            "scope": 494,
            "src": "1396:423:3",
            "stateMutability": "nonpayable",
            "superFunction": null,
            "visibility": "public"
          },
          {
            "body": {
              "id": 404,
              "nodeType": "Block",
              "src": "2139:207:3",
              "statements": [
                {
                  "expression": {
                    "argumentTypes": null,
                    "id": 375,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "leftHandSide": {
                      "argumentTypes": null,
                      "id": 369,
                      "name": "totalSupply",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 3348,
                      "src": "2145:11:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      }
                    },
                    "nodeType": "Assignment",
                    "operator": "=",
                    "rightHandSide": {
                      "argumentTypes": null,
                      "arguments": [
                        {
                          "argumentTypes": null,
                          "id": 372,
                          "name": "_amount",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 360,
                          "src": "2172:7:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        },
                        {
                          "argumentTypes": null,
                          "id": 373,
                          "name": "totalSupply",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 3348,
                          "src": "2181:11:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        }
                      ],
                      "expression": {
                        "argumentTypes": [
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          },
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        ],
                        "expression": {
                          "argumentTypes": null,
                          "id": 370,
                          "name": "SafeMath",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 1650,
                          "src": "2159:8:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_type$_t_contract$_SafeMath_$1650_$",
                            "typeString": "type(library SafeMath)"
                          }
                        },
                        "id": 371,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": false,
                        "lValueRequested": false,
                        "memberName": "add",
                        "nodeType": "MemberAccess",
                        "referencedDeclaration": 1649,
                        "src": "2159:12:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_function_internal_pure$_t_uint256_$_t_uint256_$returns$_t_uint256_$",
                          "typeString": "function (uint256,uint256) pure returns (uint256)"
                        }
                      },
                      "id": 374,
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "kind": "functionCall",
                      "lValueRequested": false,
                      "names": [],
                      "nodeType": "FunctionCall",
                      "src": "2159:34:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      }
                    },
                    "src": "2145:48:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "id": 376,
                  "nodeType": "ExpressionStatement",
                  "src": "2145:48:3"
                },
                {
                  "expression": {
                    "argumentTypes": null,
                    "id": 387,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "leftHandSide": {
                      "argumentTypes": null,
                      "baseExpression": {
                        "argumentTypes": null,
                        "id": 377,
                        "name": "balances",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 3337,
                        "src": "2199:8:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_mapping$_t_address_$_t_uint256_$",
                          "typeString": "mapping(address => uint256)"
                        }
                      },
                      "id": 379,
                      "indexExpression": {
                        "argumentTypes": null,
                        "id": 378,
                        "name": "_to",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 358,
                        "src": "2208:3:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      "isConstant": false,
                      "isLValue": true,
                      "isPure": false,
                      "lValueRequested": true,
                      "nodeType": "IndexAccess",
                      "src": "2199:13:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      }
                    },
                    "nodeType": "Assignment",
                    "operator": "=",
                    "rightHandSide": {
                      "argumentTypes": null,
                      "arguments": [
                        {
                          "argumentTypes": null,
                          "id": 382,
                          "name": "_amount",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 360,
                          "src": "2228:7:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        },
                        {
                          "argumentTypes": null,
                          "baseExpression": {
                            "argumentTypes": null,
                            "id": 383,
                            "name": "balances",
                            "nodeType": "Identifier",
                            "overloadedDeclarations": [],
                            "referencedDeclaration": 3337,
                            "src": "2236:8:3",
                            "typeDescriptions": {
                              "typeIdentifier": "t_mapping$_t_address_$_t_uint256_$",
                              "typeString": "mapping(address => uint256)"
                            }
                          },
                          "id": 385,
                          "indexExpression": {
                            "argumentTypes": null,
                            "id": 384,
                            "name": "_to",
                            "nodeType": "Identifier",
                            "overloadedDeclarations": [],
                            "referencedDeclaration": 358,
                            "src": "2245:3:3",
                            "typeDescriptions": {
                              "typeIdentifier": "t_address",
                              "typeString": "address"
                            }
                          },
                          "isConstant": false,
                          "isLValue": true,
                          "isPure": false,
                          "lValueRequested": false,
                          "nodeType": "IndexAccess",
                          "src": "2236:13:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        }
                      ],
                      "expression": {
                        "argumentTypes": [
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          },
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        ],
                        "expression": {
                          "argumentTypes": null,
                          "id": 380,
                          "name": "SafeMath",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 1650,
                          "src": "2215:8:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_type$_t_contract$_SafeMath_$1650_$",
                            "typeString": "type(library SafeMath)"
                          }
                        },
                        "id": 381,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": false,
                        "lValueRequested": false,
                        "memberName": "add",
                        "nodeType": "MemberAccess",
                        "referencedDeclaration": 1649,
                        "src": "2215:12:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_function_internal_pure$_t_uint256_$_t_uint256_$returns$_t_uint256_$",
                          "typeString": "function (uint256,uint256) pure returns (uint256)"
                        }
                      },
                      "id": 386,
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "kind": "functionCall",
                      "lValueRequested": false,
                      "names": [],
                      "nodeType": "FunctionCall",
                      "src": "2215:35:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      }
                    },
                    "src": "2199:51:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "id": 388,
                  "nodeType": "ExpressionStatement",
                  "src": "2199:51:3"
                },
                {
                  "eventCall": {
                    "argumentTypes": null,
                    "arguments": [
                      {
                        "argumentTypes": null,
                        "id": 390,
                        "name": "_to",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 358,
                        "src": "2266:3:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "argumentTypes": null,
                        "id": 391,
                        "name": "_amount",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 360,
                        "src": "2271:7:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      ],
                      "id": 389,
                      "name": "Mint",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 311,
                      "src": "2261:4:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_event_nonpayable$_t_address_$_t_uint256_$returns$__$",
                        "typeString": "function (address,uint256)"
                      }
                    },
                    "id": 392,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "2261:18:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 393,
                  "nodeType": "EmitStatement",
                  "src": "2256:23:3"
                },
                {
                  "eventCall": {
                    "argumentTypes": null,
                    "arguments": [
                      {
                        "argumentTypes": null,
                        "arguments": [
                          {
                            "argumentTypes": null,
                            "hexValue": "30",
                            "id": 396,
                            "isConstant": false,
                            "isLValue": false,
                            "isPure": true,
                            "kind": "number",
                            "lValueRequested": false,
                            "nodeType": "Literal",
                            "src": "2307:1:3",
                            "subdenomination": null,
                            "typeDescriptions": {
                              "typeIdentifier": "t_rational_0_by_1",
                              "typeString": "int_const 0"
                            },
                            "value": "0"
                          }
                        ],
                        "expression": {
                          "argumentTypes": [
                            {
                              "typeIdentifier": "t_rational_0_by_1",
                              "typeString": "int_const 0"
                            }
                          ],
                          "id": 395,
                          "isConstant": false,
                          "isLValue": false,
                          "isPure": true,
                          "lValueRequested": false,
                          "nodeType": "ElementaryTypeNameExpression",
                          "src": "2299:7:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_type$_t_address_$",
                            "typeString": "type(address)"
                          },
                          "typeName": "address"
                        },
                        "id": 397,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": true,
                        "kind": "typeConversion",
                        "lValueRequested": false,
                        "names": [],
                        "nodeType": "FunctionCall",
                        "src": "2299:10:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "argumentTypes": null,
                        "id": 398,
                        "name": "_to",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 358,
                        "src": "2311:3:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "argumentTypes": null,
                        "id": 399,
                        "name": "_amount",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 360,
                        "src": "2316:7:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      ],
                      "id": 394,
                      "name": "Transfer",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 3401,
                      "src": "2290:8:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_event_nonpayable$_t_address_$_t_address_$_t_uint256_$returns$__$",
                        "typeString": "function (address,address,uint256)"
                      }
                    },
                    "id": 400,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "2290:34:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 401,
                  "nodeType": "EmitStatement",
                  "src": "2285:39:3"
                },
                {
                  "expression": {
                    "argumentTypes": null,
                    "hexValue": "74727565",
                    "id": 402,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": true,
                    "kind": "bool",
                    "lValueRequested": false,
                    "nodeType": "Literal",
                    "src": "2337:4:3",
                    "subdenomination": null,
                    "typeDescriptions": {
                      "typeIdentifier": "t_bool",
                      "typeString": "bool"
                    },
                    "value": "true"
                  },
                  "functionReturnParameters": 368,
                  "id": 403,
                  "nodeType": "Return",
                  "src": "2330:11:3"
                }
              ]
            },
            "documentation": "@dev Function to mint tokens\n@param _to The address that will receive the minted tokens.\n@param _amount The amount of tokens to mint.\n@return A boolean that indicates if the operation was successful.",
            "id": 405,
            "implemented": true,
            "isConstructor": false,
            "isDeclaredConst": false,
            "modifiers": [
              {
                "arguments": null,
                "id": 363,
                "modifierName": {
                  "argumentTypes": null,
                  "id": 362,
                  "name": "onlyOwner",
                  "nodeType": "Identifier",
                  "overloadedDeclarations": [],
                  "referencedDeclaration": 1529,
                  "src": "2099:9:3",
                  "typeDescriptions": {
                    "typeIdentifier": "t_modifier$__$",
                    "typeString": "modifier ()"
                  }
                },
                "nodeType": "ModifierInvocation",
                "src": "2099:9:3"
              },
              {
                "arguments": null,
                "id": 365,
                "modifierName": {
                  "argumentTypes": null,
                  "id": 364,
                  "name": "canMint",
                  "nodeType": "Identifier",
                  "overloadedDeclarations": [],
                  "referencedDeclaration": 325,
                  "src": "2109:7:3",
                  "typeDescriptions": {
                    "typeIdentifier": "t_modifier$__$",
                    "typeString": "modifier ()"
                  }
                },
                "nodeType": "ModifierInvocation",
                "src": "2109:7:3"
              }
            ],
            "name": "mint",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 361,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 358,
                  "name": "_to",
                  "nodeType": "VariableDeclaration",
                  "scope": 405,
                  "src": "2069:11:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_address",
                    "typeString": "address"
                  },
                  "typeName": {
                    "id": 357,
                    "name": "address",
                    "nodeType": "ElementaryTypeName",
                    "src": "2069:7:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_address",
                      "typeString": "address"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 360,
                  "name": "_amount",
                  "nodeType": "VariableDeclaration",
                  "scope": 405,
                  "src": "2082:15:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 359,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "2082:7:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                }
              ],
              "src": "2068:30:3"
            },
            "payable": false,
            "returnParameters": {
              "id": 368,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 367,
                  "name": "",
                  "nodeType": "VariableDeclaration",
                  "scope": 405,
                  "src": "2133:4:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_bool",
                    "typeString": "bool"
                  },
                  "typeName": {
                    "id": 366,
                    "name": "bool",
                    "nodeType": "ElementaryTypeName",
                    "src": "2133:4:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_bool",
                      "typeString": "bool"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                }
              ],
              "src": "2132:6:3"
            },
            "scope": 494,
            "src": "2055:291:3",
            "stateMutability": "nonpayable",
            "superFunction": null,
            "visibility": "public"
          },
          {
            "body": {
              "id": 423,
              "nodeType": "Block",
              "src": "2525:75:3",
              "statements": [
                {
                  "expression": {
                    "argumentTypes": null,
                    "id": 416,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "leftHandSide": {
                      "argumentTypes": null,
                      "id": 414,
                      "name": "mintingFinished",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 316,
                      "src": "2531:15:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_bool",
                        "typeString": "bool"
                      }
                    },
                    "nodeType": "Assignment",
                    "operator": "=",
                    "rightHandSide": {
                      "argumentTypes": null,
                      "hexValue": "74727565",
                      "id": 415,
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": true,
                      "kind": "bool",
                      "lValueRequested": false,
                      "nodeType": "Literal",
                      "src": "2549:4:3",
                      "subdenomination": null,
                      "typeDescriptions": {
                        "typeIdentifier": "t_bool",
                        "typeString": "bool"
                      },
                      "value": "true"
                    },
                    "src": "2531:22:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_bool",
                      "typeString": "bool"
                    }
                  },
                  "id": 417,
                  "nodeType": "ExpressionStatement",
                  "src": "2531:22:3"
                },
                {
                  "eventCall": {
                    "argumentTypes": null,
                    "arguments": [],
                    "expression": {
                      "argumentTypes": [],
                      "id": 418,
                      "name": "MintFinished",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 313,
                      "src": "2564:12:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_event_nonpayable$__$returns$__$",
                        "typeString": "function ()"
                      }
                    },
                    "id": 419,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "2564:14:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 420,
                  "nodeType": "EmitStatement",
                  "src": "2559:19:3"
                },
                {
                  "expression": {
                    "argumentTypes": null,
                    "hexValue": "74727565",
                    "id": 421,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": true,
                    "kind": "bool",
                    "lValueRequested": false,
                    "nodeType": "Literal",
                    "src": "2591:4:3",
                    "subdenomination": null,
                    "typeDescriptions": {
                      "typeIdentifier": "t_bool",
                      "typeString": "bool"
                    },
                    "value": "true"
                  },
                  "functionReturnParameters": 413,
                  "id": 422,
                  "nodeType": "Return",
                  "src": "2584:11:3"
                }
              ]
            },
            "documentation": "@dev Function to stop minting new tokens.\n@return True if the operation was successful.",
            "id": 424,
            "implemented": true,
            "isConstructor": false,
            "isDeclaredConst": false,
            "modifiers": [
              {
                "arguments": null,
                "id": 408,
                "modifierName": {
                  "argumentTypes": null,
                  "id": 407,
                  "name": "onlyOwner",
                  "nodeType": "Identifier",
                  "overloadedDeclarations": [],
                  "referencedDeclaration": 1529,
                  "src": "2485:9:3",
                  "typeDescriptions": {
                    "typeIdentifier": "t_modifier$__$",
                    "typeString": "modifier ()"
                  }
                },
                "nodeType": "ModifierInvocation",
                "src": "2485:9:3"
              },
              {
                "arguments": null,
                "id": 410,
                "modifierName": {
                  "argumentTypes": null,
                  "id": 409,
                  "name": "canMint",
                  "nodeType": "Identifier",
                  "overloadedDeclarations": [],
                  "referencedDeclaration": 325,
                  "src": "2495:7:3",
                  "typeDescriptions": {
                    "typeIdentifier": "t_modifier$__$",
                    "typeString": "modifier ()"
                  }
                },
                "nodeType": "ModifierInvocation",
                "src": "2495:7:3"
              }
            ],
            "name": "finishMinting",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 406,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "2482:2:3"
            },
            "payable": false,
            "returnParameters": {
              "id": 413,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 412,
                  "name": "",
                  "nodeType": "VariableDeclaration",
                  "scope": 424,
                  "src": "2519:4:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_bool",
                    "typeString": "bool"
                  },
                  "typeName": {
                    "id": 411,
                    "name": "bool",
                    "nodeType": "ElementaryTypeName",
                    "src": "2519:4:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_bool",
                      "typeString": "bool"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                }
              ],
              "src": "2518:6:3"
            },
            "scope": 494,
            "src": "2460:140:3",
            "stateMutability": "nonpayable",
            "superFunction": null,
            "visibility": "public"
          },
          {
            "anonymous": false,
            "documentation": null,
            "id": 430,
            "name": "Burn",
            "nodeType": "EventDefinition",
            "parameters": {
              "id": 429,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 426,
                  "indexed": true,
                  "name": "burner",
                  "nodeType": "VariableDeclaration",
                  "scope": 430,
                  "src": "2835:22:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_address",
                    "typeString": "address"
                  },
                  "typeName": {
                    "id": 425,
                    "name": "address",
                    "nodeType": "ElementaryTypeName",
                    "src": "2835:7:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_address",
                      "typeString": "address"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 428,
                  "indexed": false,
                  "name": "value",
                  "nodeType": "VariableDeclaration",
                  "scope": 430,
                  "src": "2859:13:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 427,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "2859:7:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                }
              ],
              "src": "2834:39:3"
            },
            "src": "2824:50:3"
          },
          {
            "body": {
              "id": 443,
              "nodeType": "Block",
              "src": "3035:36:3",
              "statements": [
                {
                  "expression": {
                    "argumentTypes": null,
                    "arguments": [
                      {
                        "argumentTypes": null,
                        "expression": {
                          "argumentTypes": null,
                          "id": 438,
                          "name": "msg",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 3425,
                          "src": "3047:3:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_magic_message",
                            "typeString": "msg"
                          }
                        },
                        "id": 439,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": false,
                        "lValueRequested": false,
                        "memberName": "sender",
                        "nodeType": "MemberAccess",
                        "referencedDeclaration": null,
                        "src": "3047:10:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "argumentTypes": null,
                        "id": 440,
                        "name": "_value",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 432,
                        "src": "3059:6:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      ],
                      "id": 437,
                      "name": "_burn",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 493,
                      "src": "3041:5:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_nonpayable$_t_address_$_t_uint256_$returns$__$",
                        "typeString": "function (address,uint256)"
                      }
                    },
                    "id": 441,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "3041:25:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 442,
                  "nodeType": "ExpressionStatement",
                  "src": "3041:25:3"
                }
              ]
            },
            "documentation": "@dev Burns a specific amount of tokens.\n@param _value The amount of token to be burned.",
            "id": 444,
            "implemented": true,
            "isConstructor": false,
            "isDeclaredConst": false,
            "modifiers": [
              {
                "arguments": null,
                "id": 435,
                "modifierName": {
                  "argumentTypes": null,
                  "id": 434,
                  "name": "onlyOwner",
                  "nodeType": "Identifier",
                  "overloadedDeclarations": [],
                  "referencedDeclaration": 1529,
                  "src": "3018:9:3",
                  "typeDescriptions": {
                    "typeIdentifier": "t_modifier$__$",
                    "typeString": "modifier ()"
                  }
                },
                "nodeType": "ModifierInvocation",
                "src": "3018:9:3"
              }
            ],
            "name": "burn",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 433,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 432,
                  "name": "_value",
                  "nodeType": "VariableDeclaration",
                  "scope": 444,
                  "src": "3002:14:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 431,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "3002:7:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                }
              ],
              "src": "3001:16:3"
            },
            "payable": false,
            "returnParameters": {
              "id": 436,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "3035:0:3"
            },
            "scope": 494,
            "src": "2988:83:3",
            "stateMutability": "nonpayable",
            "superFunction": null,
            "visibility": "public"
          },
          {
            "body": {
              "id": 492,
              "nodeType": "Block",
              "src": "3129:400:3",
              "statements": [
                {
                  "expression": {
                    "argumentTypes": null,
                    "arguments": [
                      {
                        "argumentTypes": null,
                        "commonType": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        },
                        "id": 456,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": false,
                        "lValueRequested": false,
                        "leftExpression": {
                          "argumentTypes": null,
                          "id": 452,
                          "name": "_value",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 448,
                          "src": "3143:6:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        },
                        "nodeType": "BinaryOperation",
                        "operator": "<=",
                        "rightExpression": {
                          "argumentTypes": null,
                          "baseExpression": {
                            "argumentTypes": null,
                            "id": 453,
                            "name": "balances",
                            "nodeType": "Identifier",
                            "overloadedDeclarations": [],
                            "referencedDeclaration": 3337,
                            "src": "3153:8:3",
                            "typeDescriptions": {
                              "typeIdentifier": "t_mapping$_t_address_$_t_uint256_$",
                              "typeString": "mapping(address => uint256)"
                            }
                          },
                          "id": 455,
                          "indexExpression": {
                            "argumentTypes": null,
                            "id": 454,
                            "name": "_who",
                            "nodeType": "Identifier",
                            "overloadedDeclarations": [],
                            "referencedDeclaration": 446,
                            "src": "3162:4:3",
                            "typeDescriptions": {
                              "typeIdentifier": "t_address",
                              "typeString": "address"
                            }
                          },
                          "isConstant": false,
                          "isLValue": true,
                          "isPure": false,
                          "lValueRequested": false,
                          "nodeType": "IndexAccess",
                          "src": "3153:14:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        },
                        "src": "3143:24:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_bool",
                          "typeString": "bool"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_bool",
                          "typeString": "bool"
                        }
                      ],
                      "id": 451,
                      "name": "require",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [
                        3428,
                        3429
                      ],
                      "referencedDeclaration": 3428,
                      "src": "3135:7:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_require_pure$_t_bool_$returns$__$",
                        "typeString": "function (bool) pure"
                      }
                    },
                    "id": 457,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "3135:33:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 458,
                  "nodeType": "ExpressionStatement",
                  "src": "3135:33:3"
                },
                {
                  "expression": {
                    "argumentTypes": null,
                    "id": 469,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "leftHandSide": {
                      "argumentTypes": null,
                      "baseExpression": {
                        "argumentTypes": null,
                        "id": 459,
                        "name": "balances",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 3337,
                        "src": "3346:8:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_mapping$_t_address_$_t_uint256_$",
                          "typeString": "mapping(address => uint256)"
                        }
                      },
                      "id": 461,
                      "indexExpression": {
                        "argumentTypes": null,
                        "id": 460,
                        "name": "_who",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 446,
                        "src": "3355:4:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      "isConstant": false,
                      "isLValue": true,
                      "isPure": false,
                      "lValueRequested": true,
                      "nodeType": "IndexAccess",
                      "src": "3346:14:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      }
                    },
                    "nodeType": "Assignment",
                    "operator": "=",
                    "rightHandSide": {
                      "argumentTypes": null,
                      "arguments": [
                        {
                          "argumentTypes": null,
                          "baseExpression": {
                            "argumentTypes": null,
                            "id": 464,
                            "name": "balances",
                            "nodeType": "Identifier",
                            "overloadedDeclarations": [],
                            "referencedDeclaration": 3337,
                            "src": "3376:8:3",
                            "typeDescriptions": {
                              "typeIdentifier": "t_mapping$_t_address_$_t_uint256_$",
                              "typeString": "mapping(address => uint256)"
                            }
                          },
                          "id": 466,
                          "indexExpression": {
                            "argumentTypes": null,
                            "id": 465,
                            "name": "_who",
                            "nodeType": "Identifier",
                            "overloadedDeclarations": [],
                            "referencedDeclaration": 446,
                            "src": "3385:4:3",
                            "typeDescriptions": {
                              "typeIdentifier": "t_address",
                              "typeString": "address"
                            }
                          },
                          "isConstant": false,
                          "isLValue": true,
                          "isPure": false,
                          "lValueRequested": false,
                          "nodeType": "IndexAccess",
                          "src": "3376:14:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        },
                        {
                          "argumentTypes": null,
                          "id": 467,
                          "name": "_value",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 448,
                          "src": "3391:6:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        }
                      ],
                      "expression": {
                        "argumentTypes": [
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          },
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        ],
                        "expression": {
                          "argumentTypes": null,
                          "id": 462,
                          "name": "SafeMath",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 1650,
                          "src": "3363:8:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_type$_t_contract$_SafeMath_$1650_$",
                            "typeString": "type(library SafeMath)"
                          }
                        },
                        "id": 463,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": false,
                        "lValueRequested": false,
                        "memberName": "sub",
                        "nodeType": "MemberAccess",
                        "referencedDeclaration": 1625,
                        "src": "3363:12:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_function_internal_pure$_t_uint256_$_t_uint256_$returns$_t_uint256_$",
                          "typeString": "function (uint256,uint256) pure returns (uint256)"
                        }
                      },
                      "id": 468,
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "kind": "functionCall",
                      "lValueRequested": false,
                      "names": [],
                      "nodeType": "FunctionCall",
                      "src": "3363:35:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      }
                    },
                    "src": "3346:52:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "id": 470,
                  "nodeType": "ExpressionStatement",
                  "src": "3346:52:3"
                },
                {
                  "expression": {
                    "argumentTypes": null,
                    "id": 477,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "leftHandSide": {
                      "argumentTypes": null,
                      "id": 471,
                      "name": "totalSupply",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 3348,
                      "src": "3404:11:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      }
                    },
                    "nodeType": "Assignment",
                    "operator": "=",
                    "rightHandSide": {
                      "argumentTypes": null,
                      "arguments": [
                        {
                          "argumentTypes": null,
                          "id": 474,
                          "name": "totalSupply",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 3348,
                          "src": "3431:11:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        },
                        {
                          "argumentTypes": null,
                          "id": 475,
                          "name": "_value",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 448,
                          "src": "3443:6:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        }
                      ],
                      "expression": {
                        "argumentTypes": [
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          },
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        ],
                        "expression": {
                          "argumentTypes": null,
                          "id": 472,
                          "name": "SafeMath",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 1650,
                          "src": "3418:8:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_type$_t_contract$_SafeMath_$1650_$",
                            "typeString": "type(library SafeMath)"
                          }
                        },
                        "id": 473,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": false,
                        "lValueRequested": false,
                        "memberName": "sub",
                        "nodeType": "MemberAccess",
                        "referencedDeclaration": 1625,
                        "src": "3418:12:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_function_internal_pure$_t_uint256_$_t_uint256_$returns$_t_uint256_$",
                          "typeString": "function (uint256,uint256) pure returns (uint256)"
                        }
                      },
                      "id": 476,
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "kind": "functionCall",
                      "lValueRequested": false,
                      "names": [],
                      "nodeType": "FunctionCall",
                      "src": "3418:32:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      }
                    },
                    "src": "3404:46:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "id": 478,
                  "nodeType": "ExpressionStatement",
                  "src": "3404:46:3"
                },
                {
                  "eventCall": {
                    "argumentTypes": null,
                    "arguments": [
                      {
                        "argumentTypes": null,
                        "id": 480,
                        "name": "_who",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 446,
                        "src": "3466:4:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "argumentTypes": null,
                        "id": 481,
                        "name": "_value",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 448,
                        "src": "3472:6:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      ],
                      "id": 479,
                      "name": "Burn",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 430,
                      "src": "3461:4:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_event_nonpayable$_t_address_$_t_uint256_$returns$__$",
                        "typeString": "function (address,uint256)"
                      }
                    },
                    "id": 482,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "3461:18:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 483,
                  "nodeType": "EmitStatement",
                  "src": "3456:23:3"
                },
                {
                  "eventCall": {
                    "argumentTypes": null,
                    "arguments": [
                      {
                        "argumentTypes": null,
                        "id": 485,
                        "name": "_who",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 446,
                        "src": "3499:4:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "argumentTypes": null,
                        "arguments": [
                          {
                            "argumentTypes": null,
                            "hexValue": "30",
                            "id": 487,
                            "isConstant": false,
                            "isLValue": false,
                            "isPure": true,
                            "kind": "number",
                            "lValueRequested": false,
                            "nodeType": "Literal",
                            "src": "3513:1:3",
                            "subdenomination": null,
                            "typeDescriptions": {
                              "typeIdentifier": "t_rational_0_by_1",
                              "typeString": "int_const 0"
                            },
                            "value": "0"
                          }
                        ],
                        "expression": {
                          "argumentTypes": [
                            {
                              "typeIdentifier": "t_rational_0_by_1",
                              "typeString": "int_const 0"
                            }
                          ],
                          "id": 486,
                          "isConstant": false,
                          "isLValue": false,
                          "isPure": true,
                          "lValueRequested": false,
                          "nodeType": "ElementaryTypeNameExpression",
                          "src": "3505:7:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_type$_t_address_$",
                            "typeString": "type(address)"
                          },
                          "typeName": "address"
                        },
                        "id": 488,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": true,
                        "kind": "typeConversion",
                        "lValueRequested": false,
                        "names": [],
                        "nodeType": "FunctionCall",
                        "src": "3505:10:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "argumentTypes": null,
                        "id": 489,
                        "name": "_value",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 448,
                        "src": "3517:6:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      ],
                      "id": 484,
                      "name": "Transfer",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 3401,
                      "src": "3490:8:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_event_nonpayable$_t_address_$_t_address_$_t_uint256_$returns$__$",
                        "typeString": "function (address,address,uint256)"
                      }
                    },
                    "id": 490,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "3490:34:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 491,
                  "nodeType": "EmitStatement",
                  "src": "3485:39:3"
                }
              ]
            },
            "documentation": null,
            "id": 493,
            "implemented": true,
            "isConstructor": false,
            "isDeclaredConst": false,
            "modifiers": [],
            "name": "_burn",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 449,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 446,
                  "name": "_who",
                  "nodeType": "VariableDeclaration",
                  "scope": 493,
                  "src": "3090:12:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_address",
                    "typeString": "address"
                  },
                  "typeName": {
                    "id": 445,
                    "name": "address",
                    "nodeType": "ElementaryTypeName",
                    "src": "3090:7:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_address",
                      "typeString": "address"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 448,
                  "name": "_value",
                  "nodeType": "VariableDeclaration",
                  "scope": 493,
                  "src": "3104:14:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 447,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "3104:7:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                }
              ],
              "src": "3089:30:3"
            },
            "payable": false,
            "returnParameters": {
              "id": 450,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "3129:0:3"
            },
            "scope": 494,
            "src": "3075:454:3",
            "stateMutability": "nonpayable",
            "superFunction": null,
            "visibility": "internal"
          }
        ],
        "scope": 495,
        "src": "399:3132:3"
      }
    ],
    "src": "0:3532:3"
  },
  "legacyAST": {
    "absolutePath": "/Users/wolever/SpankChain/repos/spankbank/contracts/MintAndBurnToken.sol",
    "exportedSymbols": {
      "MintAndBurnToken": [
        494
      ]
    },
    "id": 495,
    "nodeType": "SourceUnit",
    "nodes": [
      {
        "id": 298,
        "literals": [
          "solidity",
          "0.4",
          ".24"
        ],
        "nodeType": "PragmaDirective",
        "src": "0:23:3"
      },
      {
        "absolutePath": "/Users/wolever/SpankChain/repos/spankbank/contracts/StandardToken.sol",
        "file": "./StandardToken.sol",
        "id": 299,
        "nodeType": "ImportDirective",
        "scope": 495,
        "sourceUnit": 3345,
        "src": "25:29:3",
        "symbolAliases": [],
        "unitAlias": ""
      },
      {
        "absolutePath": "/Users/wolever/SpankChain/repos/spankbank/contracts/OZ_Ownable.sol",
        "file": "./OZ_Ownable.sol",
        "id": 300,
        "nodeType": "ImportDirective",
        "scope": 495,
        "sourceUnit": 1556,
        "src": "55:26:3",
        "symbolAliases": [],
        "unitAlias": ""
      },
      {
        "absolutePath": "/Users/wolever/SpankChain/repos/spankbank/contracts/SafeMath.sol",
        "file": "./SafeMath.sol",
        "id": 301,
        "nodeType": "ImportDirective",
        "scope": 495,
        "sourceUnit": 1651,
        "src": "82:24:3",
        "symbolAliases": [],
        "unitAlias": ""
      },
      {
        "baseContracts": [
          {
            "arguments": null,
            "baseName": {
              "contractScope": null,
              "id": 302,
              "name": "StandardToken",
              "nodeType": "UserDefinedTypeName",
              "referencedDeclaration": 3344,
              "src": "428:13:3",
              "typeDescriptions": {
                "typeIdentifier": "t_contract$_StandardToken_$3344",
                "typeString": "contract StandardToken"
              }
            },
            "id": 303,
            "nodeType": "InheritanceSpecifier",
            "src": "428:13:3"
          },
          {
            "arguments": null,
            "baseName": {
              "contractScope": null,
              "id": 304,
              "name": "Ownable",
              "nodeType": "UserDefinedTypeName",
              "referencedDeclaration": 1555,
              "src": "443:7:3",
              "typeDescriptions": {
                "typeIdentifier": "t_contract$_Ownable_$1555",
                "typeString": "contract Ownable"
              }
            },
            "id": 305,
            "nodeType": "InheritanceSpecifier",
            "src": "443:7:3"
          }
        ],
        "contractDependencies": [
          1555,
          3344,
          3410
        ],
        "contractKind": "contract",
        "documentation": "@title Mintable token\n@dev Simple ERC20 Token example, with mintable token creation\n@dev Issue: * https://github.com/OpenZeppelin/zeppelin-solidity/issues/120\nBased on code by TokenMarketNet: https://github.com/TokenMarketNet/ico/blob/master/contracts/MintableToken.sol",
        "fullyImplemented": true,
        "id": 494,
        "linearizedBaseContracts": [
          494,
          1555,
          3344,
          3410
        ],
        "name": "MintAndBurnToken",
        "nodeType": "ContractDefinition",
        "nodes": [
          {
            "anonymous": false,
            "documentation": null,
            "id": 311,
            "name": "Mint",
            "nodeType": "EventDefinition",
            "parameters": {
              "id": 310,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 307,
                  "indexed": true,
                  "name": "to",
                  "nodeType": "VariableDeclaration",
                  "scope": 311,
                  "src": "466:18:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_address",
                    "typeString": "address"
                  },
                  "typeName": {
                    "id": 306,
                    "name": "address",
                    "nodeType": "ElementaryTypeName",
                    "src": "466:7:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_address",
                      "typeString": "address"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 309,
                  "indexed": false,
                  "name": "amount",
                  "nodeType": "VariableDeclaration",
                  "scope": 311,
                  "src": "486:14:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 308,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "486:7:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                }
              ],
              "src": "465:36:3"
            },
            "src": "455:47:3"
          },
          {
            "anonymous": false,
            "documentation": null,
            "id": 313,
            "name": "MintFinished",
            "nodeType": "EventDefinition",
            "parameters": {
              "id": 312,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "523:2:3"
            },
            "src": "505:21:3"
          },
          {
            "constant": false,
            "id": 316,
            "name": "mintingFinished",
            "nodeType": "VariableDeclaration",
            "scope": 494,
            "src": "530:35:3",
            "stateVariable": true,
            "storageLocation": "default",
            "typeDescriptions": {
              "typeIdentifier": "t_bool",
              "typeString": "bool"
            },
            "typeName": {
              "id": 314,
              "name": "bool",
              "nodeType": "ElementaryTypeName",
              "src": "530:4:3",
              "typeDescriptions": {
                "typeIdentifier": "t_bool",
                "typeString": "bool"
              }
            },
            "value": {
              "argumentTypes": null,
              "hexValue": "66616c7365",
              "id": 315,
              "isConstant": false,
              "isLValue": false,
              "isPure": true,
              "kind": "bool",
              "lValueRequested": false,
              "nodeType": "Literal",
              "src": "560:5:3",
              "subdenomination": null,
              "typeDescriptions": {
                "typeIdentifier": "t_bool",
                "typeString": "bool"
              },
              "value": "false"
            },
            "visibility": "public"
          },
          {
            "body": {
              "id": 324,
              "nodeType": "Block",
              "src": "590:43:3",
              "statements": [
                {
                  "expression": {
                    "argumentTypes": null,
                    "arguments": [
                      {
                        "argumentTypes": null,
                        "id": 320,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": false,
                        "lValueRequested": false,
                        "nodeType": "UnaryOperation",
                        "operator": "!",
                        "prefix": true,
                        "src": "604:16:3",
                        "subExpression": {
                          "argumentTypes": null,
                          "id": 319,
                          "name": "mintingFinished",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 316,
                          "src": "605:15:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_bool",
                            "typeString": "bool"
                          }
                        },
                        "typeDescriptions": {
                          "typeIdentifier": "t_bool",
                          "typeString": "bool"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_bool",
                          "typeString": "bool"
                        }
                      ],
                      "id": 318,
                      "name": "require",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [
                        3428,
                        3429
                      ],
                      "referencedDeclaration": 3428,
                      "src": "596:7:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_require_pure$_t_bool_$returns$__$",
                        "typeString": "function (bool) pure"
                      }
                    },
                    "id": 321,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "596:25:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 322,
                  "nodeType": "ExpressionStatement",
                  "src": "596:25:3"
                },
                {
                  "id": 323,
                  "nodeType": "PlaceholderStatement",
                  "src": "627:1:3"
                }
              ]
            },
            "documentation": null,
            "id": 325,
            "name": "canMint",
            "nodeType": "ModifierDefinition",
            "parameters": {
              "id": 317,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "587:2:3"
            },
            "src": "571:62:3",
            "visibility": "internal"
          },
          {
            "constant": false,
            "id": 327,
            "name": "name",
            "nodeType": "VariableDeclaration",
            "scope": 494,
            "src": "963:18:3",
            "stateVariable": true,
            "storageLocation": "default",
            "typeDescriptions": {
              "typeIdentifier": "t_string_storage",
              "typeString": "string"
            },
            "typeName": {
              "id": 326,
              "name": "string",
              "nodeType": "ElementaryTypeName",
              "src": "963:6:3",
              "typeDescriptions": {
                "typeIdentifier": "t_string_storage_ptr",
                "typeString": "string"
              }
            },
            "value": null,
            "visibility": "public"
          },
          {
            "constant": false,
            "id": 329,
            "name": "decimals",
            "nodeType": "VariableDeclaration",
            "scope": 494,
            "src": "1034:21:3",
            "stateVariable": true,
            "storageLocation": "default",
            "typeDescriptions": {
              "typeIdentifier": "t_uint8",
              "typeString": "uint8"
            },
            "typeName": {
              "id": 328,
              "name": "uint8",
              "nodeType": "ElementaryTypeName",
              "src": "1034:5:3",
              "typeDescriptions": {
                "typeIdentifier": "t_uint8",
                "typeString": "uint8"
              }
            },
            "value": null,
            "visibility": "public"
          },
          {
            "constant": false,
            "id": 331,
            "name": "symbol",
            "nodeType": "VariableDeclaration",
            "scope": 494,
            "src": "1228:20:3",
            "stateVariable": true,
            "storageLocation": "default",
            "typeDescriptions": {
              "typeIdentifier": "t_string_storage",
              "typeString": "string"
            },
            "typeName": {
              "id": 330,
              "name": "string",
              "nodeType": "ElementaryTypeName",
              "src": "1228:6:3",
              "typeDescriptions": {
                "typeIdentifier": "t_string_storage_ptr",
                "typeString": "string"
              }
            },
            "value": null,
            "visibility": "public"
          },
          {
            "constant": false,
            "id": 334,
            "name": "version",
            "nodeType": "VariableDeclaration",
            "scope": 494,
            "src": "1294:30:3",
            "stateVariable": true,
            "storageLocation": "default",
            "typeDescriptions": {
              "typeIdentifier": "t_string_storage",
              "typeString": "string"
            },
            "typeName": {
              "id": 332,
              "name": "string",
              "nodeType": "ElementaryTypeName",
              "src": "1294:6:3",
              "typeDescriptions": {
                "typeIdentifier": "t_string_storage_ptr",
                "typeString": "string"
              }
            },
            "value": {
              "argumentTypes": null,
              "hexValue": "48302e31",
              "id": 333,
              "isConstant": false,
              "isLValue": false,
              "isPure": true,
              "kind": "string",
              "lValueRequested": false,
              "nodeType": "Literal",
              "src": "1318:6:3",
              "subdenomination": null,
              "typeDescriptions": {
                "typeIdentifier": "t_stringliteral_d6d58ef494a91661d08cde370ab3ac80b175fdf7fb2bea79e75e8276633326a2",
                "typeString": "literal_string \"H0.1\""
              },
              "value": "H0.1"
            },
            "visibility": "public"
          },
          {
            "body": {
              "id": 355,
              "nodeType": "Block",
              "src": "1510:309:3",
              "statements": [
                {
                  "expression": {
                    "argumentTypes": null,
                    "id": 345,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "leftHandSide": {
                      "argumentTypes": null,
                      "id": 343,
                      "name": "name",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 327,
                      "src": "1520:4:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_string_storage",
                        "typeString": "string storage ref"
                      }
                    },
                    "nodeType": "Assignment",
                    "operator": "=",
                    "rightHandSide": {
                      "argumentTypes": null,
                      "id": 344,
                      "name": "_tokenName",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 336,
                      "src": "1527:10:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_string_memory_ptr",
                        "typeString": "string memory"
                      }
                    },
                    "src": "1520:17:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_string_storage",
                      "typeString": "string storage ref"
                    }
                  },
                  "id": 346,
                  "nodeType": "ExpressionStatement",
                  "src": "1520:17:3"
                },
                {
                  "expression": {
                    "argumentTypes": null,
                    "id": 349,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "leftHandSide": {
                      "argumentTypes": null,
                      "id": 347,
                      "name": "decimals",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 329,
                      "src": "1618:8:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint8",
                        "typeString": "uint8"
                      }
                    },
                    "nodeType": "Assignment",
                    "operator": "=",
                    "rightHandSide": {
                      "argumentTypes": null,
                      "id": 348,
                      "name": "_decimalUnits",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 338,
                      "src": "1629:13:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint8",
                        "typeString": "uint8"
                      }
                    },
                    "src": "1618:24:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint8",
                      "typeString": "uint8"
                    }
                  },
                  "id": 350,
                  "nodeType": "ExpressionStatement",
                  "src": "1618:24:3"
                },
                {
                  "expression": {
                    "argumentTypes": null,
                    "id": 353,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "leftHandSide": {
                      "argumentTypes": null,
                      "id": 351,
                      "name": "symbol",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 331,
                      "src": "1722:6:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_string_storage",
                        "typeString": "string storage ref"
                      }
                    },
                    "nodeType": "Assignment",
                    "operator": "=",
                    "rightHandSide": {
                      "argumentTypes": null,
                      "id": 352,
                      "name": "_tokenSymbol",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 340,
                      "src": "1731:12:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_string_memory_ptr",
                        "typeString": "string memory"
                      }
                    },
                    "src": "1722:21:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_string_storage",
                      "typeString": "string storage ref"
                    }
                  },
                  "id": 354,
                  "nodeType": "ExpressionStatement",
                  "src": "1722:21:3"
                }
              ]
            },
            "documentation": null,
            "id": 356,
            "implemented": true,
            "isConstructor": true,
            "isDeclaredConst": false,
            "modifiers": [],
            "name": "",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 341,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 336,
                  "name": "_tokenName",
                  "nodeType": "VariableDeclaration",
                  "scope": 356,
                  "src": "1417:17:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_string_memory_ptr",
                    "typeString": "string"
                  },
                  "typeName": {
                    "id": 335,
                    "name": "string",
                    "nodeType": "ElementaryTypeName",
                    "src": "1417:6:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_string_storage_ptr",
                      "typeString": "string"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 338,
                  "name": "_decimalUnits",
                  "nodeType": "VariableDeclaration",
                  "scope": 356,
                  "src": "1444:19:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint8",
                    "typeString": "uint8"
                  },
                  "typeName": {
                    "id": 337,
                    "name": "uint8",
                    "nodeType": "ElementaryTypeName",
                    "src": "1444:5:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint8",
                      "typeString": "uint8"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 340,
                  "name": "_tokenSymbol",
                  "nodeType": "VariableDeclaration",
                  "scope": 356,
                  "src": "1473:19:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_string_memory_ptr",
                    "typeString": "string"
                  },
                  "typeName": {
                    "id": 339,
                    "name": "string",
                    "nodeType": "ElementaryTypeName",
                    "src": "1473:6:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_string_storage_ptr",
                      "typeString": "string"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                }
              ],
              "src": "1407:95:3"
            },
            "payable": false,
            "returnParameters": {
              "id": 342,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "1510:0:3"
            },
            "scope": 494,
            "src": "1396:423:3",
            "stateMutability": "nonpayable",
            "superFunction": null,
            "visibility": "public"
          },
          {
            "body": {
              "id": 404,
              "nodeType": "Block",
              "src": "2139:207:3",
              "statements": [
                {
                  "expression": {
                    "argumentTypes": null,
                    "id": 375,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "leftHandSide": {
                      "argumentTypes": null,
                      "id": 369,
                      "name": "totalSupply",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 3348,
                      "src": "2145:11:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      }
                    },
                    "nodeType": "Assignment",
                    "operator": "=",
                    "rightHandSide": {
                      "argumentTypes": null,
                      "arguments": [
                        {
                          "argumentTypes": null,
                          "id": 372,
                          "name": "_amount",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 360,
                          "src": "2172:7:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        },
                        {
                          "argumentTypes": null,
                          "id": 373,
                          "name": "totalSupply",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 3348,
                          "src": "2181:11:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        }
                      ],
                      "expression": {
                        "argumentTypes": [
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          },
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        ],
                        "expression": {
                          "argumentTypes": null,
                          "id": 370,
                          "name": "SafeMath",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 1650,
                          "src": "2159:8:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_type$_t_contract$_SafeMath_$1650_$",
                            "typeString": "type(library SafeMath)"
                          }
                        },
                        "id": 371,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": false,
                        "lValueRequested": false,
                        "memberName": "add",
                        "nodeType": "MemberAccess",
                        "referencedDeclaration": 1649,
                        "src": "2159:12:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_function_internal_pure$_t_uint256_$_t_uint256_$returns$_t_uint256_$",
                          "typeString": "function (uint256,uint256) pure returns (uint256)"
                        }
                      },
                      "id": 374,
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "kind": "functionCall",
                      "lValueRequested": false,
                      "names": [],
                      "nodeType": "FunctionCall",
                      "src": "2159:34:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      }
                    },
                    "src": "2145:48:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "id": 376,
                  "nodeType": "ExpressionStatement",
                  "src": "2145:48:3"
                },
                {
                  "expression": {
                    "argumentTypes": null,
                    "id": 387,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "leftHandSide": {
                      "argumentTypes": null,
                      "baseExpression": {
                        "argumentTypes": null,
                        "id": 377,
                        "name": "balances",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 3337,
                        "src": "2199:8:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_mapping$_t_address_$_t_uint256_$",
                          "typeString": "mapping(address => uint256)"
                        }
                      },
                      "id": 379,
                      "indexExpression": {
                        "argumentTypes": null,
                        "id": 378,
                        "name": "_to",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 358,
                        "src": "2208:3:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      "isConstant": false,
                      "isLValue": true,
                      "isPure": false,
                      "lValueRequested": true,
                      "nodeType": "IndexAccess",
                      "src": "2199:13:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      }
                    },
                    "nodeType": "Assignment",
                    "operator": "=",
                    "rightHandSide": {
                      "argumentTypes": null,
                      "arguments": [
                        {
                          "argumentTypes": null,
                          "id": 382,
                          "name": "_amount",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 360,
                          "src": "2228:7:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        },
                        {
                          "argumentTypes": null,
                          "baseExpression": {
                            "argumentTypes": null,
                            "id": 383,
                            "name": "balances",
                            "nodeType": "Identifier",
                            "overloadedDeclarations": [],
                            "referencedDeclaration": 3337,
                            "src": "2236:8:3",
                            "typeDescriptions": {
                              "typeIdentifier": "t_mapping$_t_address_$_t_uint256_$",
                              "typeString": "mapping(address => uint256)"
                            }
                          },
                          "id": 385,
                          "indexExpression": {
                            "argumentTypes": null,
                            "id": 384,
                            "name": "_to",
                            "nodeType": "Identifier",
                            "overloadedDeclarations": [],
                            "referencedDeclaration": 358,
                            "src": "2245:3:3",
                            "typeDescriptions": {
                              "typeIdentifier": "t_address",
                              "typeString": "address"
                            }
                          },
                          "isConstant": false,
                          "isLValue": true,
                          "isPure": false,
                          "lValueRequested": false,
                          "nodeType": "IndexAccess",
                          "src": "2236:13:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        }
                      ],
                      "expression": {
                        "argumentTypes": [
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          },
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        ],
                        "expression": {
                          "argumentTypes": null,
                          "id": 380,
                          "name": "SafeMath",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 1650,
                          "src": "2215:8:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_type$_t_contract$_SafeMath_$1650_$",
                            "typeString": "type(library SafeMath)"
                          }
                        },
                        "id": 381,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": false,
                        "lValueRequested": false,
                        "memberName": "add",
                        "nodeType": "MemberAccess",
                        "referencedDeclaration": 1649,
                        "src": "2215:12:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_function_internal_pure$_t_uint256_$_t_uint256_$returns$_t_uint256_$",
                          "typeString": "function (uint256,uint256) pure returns (uint256)"
                        }
                      },
                      "id": 386,
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "kind": "functionCall",
                      "lValueRequested": false,
                      "names": [],
                      "nodeType": "FunctionCall",
                      "src": "2215:35:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      }
                    },
                    "src": "2199:51:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "id": 388,
                  "nodeType": "ExpressionStatement",
                  "src": "2199:51:3"
                },
                {
                  "eventCall": {
                    "argumentTypes": null,
                    "arguments": [
                      {
                        "argumentTypes": null,
                        "id": 390,
                        "name": "_to",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 358,
                        "src": "2266:3:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "argumentTypes": null,
                        "id": 391,
                        "name": "_amount",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 360,
                        "src": "2271:7:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      ],
                      "id": 389,
                      "name": "Mint",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 311,
                      "src": "2261:4:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_event_nonpayable$_t_address_$_t_uint256_$returns$__$",
                        "typeString": "function (address,uint256)"
                      }
                    },
                    "id": 392,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "2261:18:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 393,
                  "nodeType": "EmitStatement",
                  "src": "2256:23:3"
                },
                {
                  "eventCall": {
                    "argumentTypes": null,
                    "arguments": [
                      {
                        "argumentTypes": null,
                        "arguments": [
                          {
                            "argumentTypes": null,
                            "hexValue": "30",
                            "id": 396,
                            "isConstant": false,
                            "isLValue": false,
                            "isPure": true,
                            "kind": "number",
                            "lValueRequested": false,
                            "nodeType": "Literal",
                            "src": "2307:1:3",
                            "subdenomination": null,
                            "typeDescriptions": {
                              "typeIdentifier": "t_rational_0_by_1",
                              "typeString": "int_const 0"
                            },
                            "value": "0"
                          }
                        ],
                        "expression": {
                          "argumentTypes": [
                            {
                              "typeIdentifier": "t_rational_0_by_1",
                              "typeString": "int_const 0"
                            }
                          ],
                          "id": 395,
                          "isConstant": false,
                          "isLValue": false,
                          "isPure": true,
                          "lValueRequested": false,
                          "nodeType": "ElementaryTypeNameExpression",
                          "src": "2299:7:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_type$_t_address_$",
                            "typeString": "type(address)"
                          },
                          "typeName": "address"
                        },
                        "id": 397,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": true,
                        "kind": "typeConversion",
                        "lValueRequested": false,
                        "names": [],
                        "nodeType": "FunctionCall",
                        "src": "2299:10:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "argumentTypes": null,
                        "id": 398,
                        "name": "_to",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 358,
                        "src": "2311:3:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "argumentTypes": null,
                        "id": 399,
                        "name": "_amount",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 360,
                        "src": "2316:7:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      ],
                      "id": 394,
                      "name": "Transfer",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 3401,
                      "src": "2290:8:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_event_nonpayable$_t_address_$_t_address_$_t_uint256_$returns$__$",
                        "typeString": "function (address,address,uint256)"
                      }
                    },
                    "id": 400,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "2290:34:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 401,
                  "nodeType": "EmitStatement",
                  "src": "2285:39:3"
                },
                {
                  "expression": {
                    "argumentTypes": null,
                    "hexValue": "74727565",
                    "id": 402,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": true,
                    "kind": "bool",
                    "lValueRequested": false,
                    "nodeType": "Literal",
                    "src": "2337:4:3",
                    "subdenomination": null,
                    "typeDescriptions": {
                      "typeIdentifier": "t_bool",
                      "typeString": "bool"
                    },
                    "value": "true"
                  },
                  "functionReturnParameters": 368,
                  "id": 403,
                  "nodeType": "Return",
                  "src": "2330:11:3"
                }
              ]
            },
            "documentation": "@dev Function to mint tokens\n@param _to The address that will receive the minted tokens.\n@param _amount The amount of tokens to mint.\n@return A boolean that indicates if the operation was successful.",
            "id": 405,
            "implemented": true,
            "isConstructor": false,
            "isDeclaredConst": false,
            "modifiers": [
              {
                "arguments": null,
                "id": 363,
                "modifierName": {
                  "argumentTypes": null,
                  "id": 362,
                  "name": "onlyOwner",
                  "nodeType": "Identifier",
                  "overloadedDeclarations": [],
                  "referencedDeclaration": 1529,
                  "src": "2099:9:3",
                  "typeDescriptions": {
                    "typeIdentifier": "t_modifier$__$",
                    "typeString": "modifier ()"
                  }
                },
                "nodeType": "ModifierInvocation",
                "src": "2099:9:3"
              },
              {
                "arguments": null,
                "id": 365,
                "modifierName": {
                  "argumentTypes": null,
                  "id": 364,
                  "name": "canMint",
                  "nodeType": "Identifier",
                  "overloadedDeclarations": [],
                  "referencedDeclaration": 325,
                  "src": "2109:7:3",
                  "typeDescriptions": {
                    "typeIdentifier": "t_modifier$__$",
                    "typeString": "modifier ()"
                  }
                },
                "nodeType": "ModifierInvocation",
                "src": "2109:7:3"
              }
            ],
            "name": "mint",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 361,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 358,
                  "name": "_to",
                  "nodeType": "VariableDeclaration",
                  "scope": 405,
                  "src": "2069:11:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_address",
                    "typeString": "address"
                  },
                  "typeName": {
                    "id": 357,
                    "name": "address",
                    "nodeType": "ElementaryTypeName",
                    "src": "2069:7:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_address",
                      "typeString": "address"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 360,
                  "name": "_amount",
                  "nodeType": "VariableDeclaration",
                  "scope": 405,
                  "src": "2082:15:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 359,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "2082:7:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                }
              ],
              "src": "2068:30:3"
            },
            "payable": false,
            "returnParameters": {
              "id": 368,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 367,
                  "name": "",
                  "nodeType": "VariableDeclaration",
                  "scope": 405,
                  "src": "2133:4:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_bool",
                    "typeString": "bool"
                  },
                  "typeName": {
                    "id": 366,
                    "name": "bool",
                    "nodeType": "ElementaryTypeName",
                    "src": "2133:4:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_bool",
                      "typeString": "bool"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                }
              ],
              "src": "2132:6:3"
            },
            "scope": 494,
            "src": "2055:291:3",
            "stateMutability": "nonpayable",
            "superFunction": null,
            "visibility": "public"
          },
          {
            "body": {
              "id": 423,
              "nodeType": "Block",
              "src": "2525:75:3",
              "statements": [
                {
                  "expression": {
                    "argumentTypes": null,
                    "id": 416,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "leftHandSide": {
                      "argumentTypes": null,
                      "id": 414,
                      "name": "mintingFinished",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 316,
                      "src": "2531:15:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_bool",
                        "typeString": "bool"
                      }
                    },
                    "nodeType": "Assignment",
                    "operator": "=",
                    "rightHandSide": {
                      "argumentTypes": null,
                      "hexValue": "74727565",
                      "id": 415,
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": true,
                      "kind": "bool",
                      "lValueRequested": false,
                      "nodeType": "Literal",
                      "src": "2549:4:3",
                      "subdenomination": null,
                      "typeDescriptions": {
                        "typeIdentifier": "t_bool",
                        "typeString": "bool"
                      },
                      "value": "true"
                    },
                    "src": "2531:22:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_bool",
                      "typeString": "bool"
                    }
                  },
                  "id": 417,
                  "nodeType": "ExpressionStatement",
                  "src": "2531:22:3"
                },
                {
                  "eventCall": {
                    "argumentTypes": null,
                    "arguments": [],
                    "expression": {
                      "argumentTypes": [],
                      "id": 418,
                      "name": "MintFinished",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 313,
                      "src": "2564:12:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_event_nonpayable$__$returns$__$",
                        "typeString": "function ()"
                      }
                    },
                    "id": 419,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "2564:14:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 420,
                  "nodeType": "EmitStatement",
                  "src": "2559:19:3"
                },
                {
                  "expression": {
                    "argumentTypes": null,
                    "hexValue": "74727565",
                    "id": 421,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": true,
                    "kind": "bool",
                    "lValueRequested": false,
                    "nodeType": "Literal",
                    "src": "2591:4:3",
                    "subdenomination": null,
                    "typeDescriptions": {
                      "typeIdentifier": "t_bool",
                      "typeString": "bool"
                    },
                    "value": "true"
                  },
                  "functionReturnParameters": 413,
                  "id": 422,
                  "nodeType": "Return",
                  "src": "2584:11:3"
                }
              ]
            },
            "documentation": "@dev Function to stop minting new tokens.\n@return True if the operation was successful.",
            "id": 424,
            "implemented": true,
            "isConstructor": false,
            "isDeclaredConst": false,
            "modifiers": [
              {
                "arguments": null,
                "id": 408,
                "modifierName": {
                  "argumentTypes": null,
                  "id": 407,
                  "name": "onlyOwner",
                  "nodeType": "Identifier",
                  "overloadedDeclarations": [],
                  "referencedDeclaration": 1529,
                  "src": "2485:9:3",
                  "typeDescriptions": {
                    "typeIdentifier": "t_modifier$__$",
                    "typeString": "modifier ()"
                  }
                },
                "nodeType": "ModifierInvocation",
                "src": "2485:9:3"
              },
              {
                "arguments": null,
                "id": 410,
                "modifierName": {
                  "argumentTypes": null,
                  "id": 409,
                  "name": "canMint",
                  "nodeType": "Identifier",
                  "overloadedDeclarations": [],
                  "referencedDeclaration": 325,
                  "src": "2495:7:3",
                  "typeDescriptions": {
                    "typeIdentifier": "t_modifier$__$",
                    "typeString": "modifier ()"
                  }
                },
                "nodeType": "ModifierInvocation",
                "src": "2495:7:3"
              }
            ],
            "name": "finishMinting",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 406,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "2482:2:3"
            },
            "payable": false,
            "returnParameters": {
              "id": 413,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 412,
                  "name": "",
                  "nodeType": "VariableDeclaration",
                  "scope": 424,
                  "src": "2519:4:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_bool",
                    "typeString": "bool"
                  },
                  "typeName": {
                    "id": 411,
                    "name": "bool",
                    "nodeType": "ElementaryTypeName",
                    "src": "2519:4:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_bool",
                      "typeString": "bool"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                }
              ],
              "src": "2518:6:3"
            },
            "scope": 494,
            "src": "2460:140:3",
            "stateMutability": "nonpayable",
            "superFunction": null,
            "visibility": "public"
          },
          {
            "anonymous": false,
            "documentation": null,
            "id": 430,
            "name": "Burn",
            "nodeType": "EventDefinition",
            "parameters": {
              "id": 429,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 426,
                  "indexed": true,
                  "name": "burner",
                  "nodeType": "VariableDeclaration",
                  "scope": 430,
                  "src": "2835:22:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_address",
                    "typeString": "address"
                  },
                  "typeName": {
                    "id": 425,
                    "name": "address",
                    "nodeType": "ElementaryTypeName",
                    "src": "2835:7:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_address",
                      "typeString": "address"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 428,
                  "indexed": false,
                  "name": "value",
                  "nodeType": "VariableDeclaration",
                  "scope": 430,
                  "src": "2859:13:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 427,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "2859:7:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                }
              ],
              "src": "2834:39:3"
            },
            "src": "2824:50:3"
          },
          {
            "body": {
              "id": 443,
              "nodeType": "Block",
              "src": "3035:36:3",
              "statements": [
                {
                  "expression": {
                    "argumentTypes": null,
                    "arguments": [
                      {
                        "argumentTypes": null,
                        "expression": {
                          "argumentTypes": null,
                          "id": 438,
                          "name": "msg",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 3425,
                          "src": "3047:3:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_magic_message",
                            "typeString": "msg"
                          }
                        },
                        "id": 439,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": false,
                        "lValueRequested": false,
                        "memberName": "sender",
                        "nodeType": "MemberAccess",
                        "referencedDeclaration": null,
                        "src": "3047:10:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "argumentTypes": null,
                        "id": 440,
                        "name": "_value",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 432,
                        "src": "3059:6:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      ],
                      "id": 437,
                      "name": "_burn",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 493,
                      "src": "3041:5:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_internal_nonpayable$_t_address_$_t_uint256_$returns$__$",
                        "typeString": "function (address,uint256)"
                      }
                    },
                    "id": 441,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "3041:25:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 442,
                  "nodeType": "ExpressionStatement",
                  "src": "3041:25:3"
                }
              ]
            },
            "documentation": "@dev Burns a specific amount of tokens.\n@param _value The amount of token to be burned.",
            "id": 444,
            "implemented": true,
            "isConstructor": false,
            "isDeclaredConst": false,
            "modifiers": [
              {
                "arguments": null,
                "id": 435,
                "modifierName": {
                  "argumentTypes": null,
                  "id": 434,
                  "name": "onlyOwner",
                  "nodeType": "Identifier",
                  "overloadedDeclarations": [],
                  "referencedDeclaration": 1529,
                  "src": "3018:9:3",
                  "typeDescriptions": {
                    "typeIdentifier": "t_modifier$__$",
                    "typeString": "modifier ()"
                  }
                },
                "nodeType": "ModifierInvocation",
                "src": "3018:9:3"
              }
            ],
            "name": "burn",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 433,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 432,
                  "name": "_value",
                  "nodeType": "VariableDeclaration",
                  "scope": 444,
                  "src": "3002:14:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 431,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "3002:7:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                }
              ],
              "src": "3001:16:3"
            },
            "payable": false,
            "returnParameters": {
              "id": 436,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "3035:0:3"
            },
            "scope": 494,
            "src": "2988:83:3",
            "stateMutability": "nonpayable",
            "superFunction": null,
            "visibility": "public"
          },
          {
            "body": {
              "id": 492,
              "nodeType": "Block",
              "src": "3129:400:3",
              "statements": [
                {
                  "expression": {
                    "argumentTypes": null,
                    "arguments": [
                      {
                        "argumentTypes": null,
                        "commonType": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        },
                        "id": 456,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": false,
                        "lValueRequested": false,
                        "leftExpression": {
                          "argumentTypes": null,
                          "id": 452,
                          "name": "_value",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 448,
                          "src": "3143:6:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        },
                        "nodeType": "BinaryOperation",
                        "operator": "<=",
                        "rightExpression": {
                          "argumentTypes": null,
                          "baseExpression": {
                            "argumentTypes": null,
                            "id": 453,
                            "name": "balances",
                            "nodeType": "Identifier",
                            "overloadedDeclarations": [],
                            "referencedDeclaration": 3337,
                            "src": "3153:8:3",
                            "typeDescriptions": {
                              "typeIdentifier": "t_mapping$_t_address_$_t_uint256_$",
                              "typeString": "mapping(address => uint256)"
                            }
                          },
                          "id": 455,
                          "indexExpression": {
                            "argumentTypes": null,
                            "id": 454,
                            "name": "_who",
                            "nodeType": "Identifier",
                            "overloadedDeclarations": [],
                            "referencedDeclaration": 446,
                            "src": "3162:4:3",
                            "typeDescriptions": {
                              "typeIdentifier": "t_address",
                              "typeString": "address"
                            }
                          },
                          "isConstant": false,
                          "isLValue": true,
                          "isPure": false,
                          "lValueRequested": false,
                          "nodeType": "IndexAccess",
                          "src": "3153:14:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        },
                        "src": "3143:24:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_bool",
                          "typeString": "bool"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_bool",
                          "typeString": "bool"
                        }
                      ],
                      "id": 451,
                      "name": "require",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [
                        3428,
                        3429
                      ],
                      "referencedDeclaration": 3428,
                      "src": "3135:7:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_require_pure$_t_bool_$returns$__$",
                        "typeString": "function (bool) pure"
                      }
                    },
                    "id": 457,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "3135:33:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 458,
                  "nodeType": "ExpressionStatement",
                  "src": "3135:33:3"
                },
                {
                  "expression": {
                    "argumentTypes": null,
                    "id": 469,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "leftHandSide": {
                      "argumentTypes": null,
                      "baseExpression": {
                        "argumentTypes": null,
                        "id": 459,
                        "name": "balances",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 3337,
                        "src": "3346:8:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_mapping$_t_address_$_t_uint256_$",
                          "typeString": "mapping(address => uint256)"
                        }
                      },
                      "id": 461,
                      "indexExpression": {
                        "argumentTypes": null,
                        "id": 460,
                        "name": "_who",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 446,
                        "src": "3355:4:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      "isConstant": false,
                      "isLValue": true,
                      "isPure": false,
                      "lValueRequested": true,
                      "nodeType": "IndexAccess",
                      "src": "3346:14:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      }
                    },
                    "nodeType": "Assignment",
                    "operator": "=",
                    "rightHandSide": {
                      "argumentTypes": null,
                      "arguments": [
                        {
                          "argumentTypes": null,
                          "baseExpression": {
                            "argumentTypes": null,
                            "id": 464,
                            "name": "balances",
                            "nodeType": "Identifier",
                            "overloadedDeclarations": [],
                            "referencedDeclaration": 3337,
                            "src": "3376:8:3",
                            "typeDescriptions": {
                              "typeIdentifier": "t_mapping$_t_address_$_t_uint256_$",
                              "typeString": "mapping(address => uint256)"
                            }
                          },
                          "id": 466,
                          "indexExpression": {
                            "argumentTypes": null,
                            "id": 465,
                            "name": "_who",
                            "nodeType": "Identifier",
                            "overloadedDeclarations": [],
                            "referencedDeclaration": 446,
                            "src": "3385:4:3",
                            "typeDescriptions": {
                              "typeIdentifier": "t_address",
                              "typeString": "address"
                            }
                          },
                          "isConstant": false,
                          "isLValue": true,
                          "isPure": false,
                          "lValueRequested": false,
                          "nodeType": "IndexAccess",
                          "src": "3376:14:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        },
                        {
                          "argumentTypes": null,
                          "id": 467,
                          "name": "_value",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 448,
                          "src": "3391:6:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        }
                      ],
                      "expression": {
                        "argumentTypes": [
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          },
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        ],
                        "expression": {
                          "argumentTypes": null,
                          "id": 462,
                          "name": "SafeMath",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 1650,
                          "src": "3363:8:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_type$_t_contract$_SafeMath_$1650_$",
                            "typeString": "type(library SafeMath)"
                          }
                        },
                        "id": 463,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": false,
                        "lValueRequested": false,
                        "memberName": "sub",
                        "nodeType": "MemberAccess",
                        "referencedDeclaration": 1625,
                        "src": "3363:12:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_function_internal_pure$_t_uint256_$_t_uint256_$returns$_t_uint256_$",
                          "typeString": "function (uint256,uint256) pure returns (uint256)"
                        }
                      },
                      "id": 468,
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "kind": "functionCall",
                      "lValueRequested": false,
                      "names": [],
                      "nodeType": "FunctionCall",
                      "src": "3363:35:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      }
                    },
                    "src": "3346:52:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "id": 470,
                  "nodeType": "ExpressionStatement",
                  "src": "3346:52:3"
                },
                {
                  "expression": {
                    "argumentTypes": null,
                    "id": 477,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "lValueRequested": false,
                    "leftHandSide": {
                      "argumentTypes": null,
                      "id": 471,
                      "name": "totalSupply",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 3348,
                      "src": "3404:11:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      }
                    },
                    "nodeType": "Assignment",
                    "operator": "=",
                    "rightHandSide": {
                      "argumentTypes": null,
                      "arguments": [
                        {
                          "argumentTypes": null,
                          "id": 474,
                          "name": "totalSupply",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 3348,
                          "src": "3431:11:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        },
                        {
                          "argumentTypes": null,
                          "id": 475,
                          "name": "_value",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 448,
                          "src": "3443:6:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        }
                      ],
                      "expression": {
                        "argumentTypes": [
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          },
                          {
                            "typeIdentifier": "t_uint256",
                            "typeString": "uint256"
                          }
                        ],
                        "expression": {
                          "argumentTypes": null,
                          "id": 472,
                          "name": "SafeMath",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 1650,
                          "src": "3418:8:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_type$_t_contract$_SafeMath_$1650_$",
                            "typeString": "type(library SafeMath)"
                          }
                        },
                        "id": 473,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": false,
                        "lValueRequested": false,
                        "memberName": "sub",
                        "nodeType": "MemberAccess",
                        "referencedDeclaration": 1625,
                        "src": "3418:12:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_function_internal_pure$_t_uint256_$_t_uint256_$returns$_t_uint256_$",
                          "typeString": "function (uint256,uint256) pure returns (uint256)"
                        }
                      },
                      "id": 476,
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "kind": "functionCall",
                      "lValueRequested": false,
                      "names": [],
                      "nodeType": "FunctionCall",
                      "src": "3418:32:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_uint256",
                        "typeString": "uint256"
                      }
                    },
                    "src": "3404:46:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "id": 478,
                  "nodeType": "ExpressionStatement",
                  "src": "3404:46:3"
                },
                {
                  "eventCall": {
                    "argumentTypes": null,
                    "arguments": [
                      {
                        "argumentTypes": null,
                        "id": 480,
                        "name": "_who",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 446,
                        "src": "3466:4:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "argumentTypes": null,
                        "id": 481,
                        "name": "_value",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 448,
                        "src": "3472:6:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      ],
                      "id": 479,
                      "name": "Burn",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 430,
                      "src": "3461:4:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_event_nonpayable$_t_address_$_t_uint256_$returns$__$",
                        "typeString": "function (address,uint256)"
                      }
                    },
                    "id": 482,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "3461:18:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 483,
                  "nodeType": "EmitStatement",
                  "src": "3456:23:3"
                },
                {
                  "eventCall": {
                    "argumentTypes": null,
                    "arguments": [
                      {
                        "argumentTypes": null,
                        "id": 485,
                        "name": "_who",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 446,
                        "src": "3499:4:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "argumentTypes": null,
                        "arguments": [
                          {
                            "argumentTypes": null,
                            "hexValue": "30",
                            "id": 487,
                            "isConstant": false,
                            "isLValue": false,
                            "isPure": true,
                            "kind": "number",
                            "lValueRequested": false,
                            "nodeType": "Literal",
                            "src": "3513:1:3",
                            "subdenomination": null,
                            "typeDescriptions": {
                              "typeIdentifier": "t_rational_0_by_1",
                              "typeString": "int_const 0"
                            },
                            "value": "0"
                          }
                        ],
                        "expression": {
                          "argumentTypes": [
                            {
                              "typeIdentifier": "t_rational_0_by_1",
                              "typeString": "int_const 0"
                            }
                          ],
                          "id": 486,
                          "isConstant": false,
                          "isLValue": false,
                          "isPure": true,
                          "lValueRequested": false,
                          "nodeType": "ElementaryTypeNameExpression",
                          "src": "3505:7:3",
                          "typeDescriptions": {
                            "typeIdentifier": "t_type$_t_address_$",
                            "typeString": "type(address)"
                          },
                          "typeName": "address"
                        },
                        "id": 488,
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": true,
                        "kind": "typeConversion",
                        "lValueRequested": false,
                        "names": [],
                        "nodeType": "FunctionCall",
                        "src": "3505:10:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        }
                      },
                      {
                        "argumentTypes": null,
                        "id": 489,
                        "name": "_value",
                        "nodeType": "Identifier",
                        "overloadedDeclarations": [],
                        "referencedDeclaration": 448,
                        "src": "3517:6:3",
                        "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      }
                    ],
                    "expression": {
                      "argumentTypes": [
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                        },
                        {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                        }
                      ],
                      "id": 484,
                      "name": "Transfer",
                      "nodeType": "Identifier",
                      "overloadedDeclarations": [],
                      "referencedDeclaration": 3401,
                      "src": "3490:8:3",
                      "typeDescriptions": {
                        "typeIdentifier": "t_function_event_nonpayable$_t_address_$_t_address_$_t_uint256_$returns$__$",
                        "typeString": "function (address,address,uint256)"
                      }
                    },
                    "id": 490,
                    "isConstant": false,
                    "isLValue": false,
                    "isPure": false,
                    "kind": "functionCall",
                    "lValueRequested": false,
                    "names": [],
                    "nodeType": "FunctionCall",
                    "src": "3490:34:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_tuple$__$",
                      "typeString": "tuple()"
                    }
                  },
                  "id": 491,
                  "nodeType": "EmitStatement",
                  "src": "3485:39:3"
                }
              ]
            },
            "documentation": null,
            "id": 493,
            "implemented": true,
            "isConstructor": false,
            "isDeclaredConst": false,
            "modifiers": [],
            "name": "_burn",
            "nodeType": "FunctionDefinition",
            "parameters": {
              "id": 449,
              "nodeType": "ParameterList",
              "parameters": [
                {
                  "constant": false,
                  "id": 446,
                  "name": "_who",
                  "nodeType": "VariableDeclaration",
                  "scope": 493,
                  "src": "3090:12:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_address",
                    "typeString": "address"
                  },
                  "typeName": {
                    "id": 445,
                    "name": "address",
                    "nodeType": "ElementaryTypeName",
                    "src": "3090:7:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_address",
                      "typeString": "address"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                },
                {
                  "constant": false,
                  "id": 448,
                  "name": "_value",
                  "nodeType": "VariableDeclaration",
                  "scope": 493,
                  "src": "3104:14:3",
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                    "typeIdentifier": "t_uint256",
                    "typeString": "uint256"
                  },
                  "typeName": {
                    "id": 447,
                    "name": "uint256",
                    "nodeType": "ElementaryTypeName",
                    "src": "3104:7:3",
                    "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                    }
                  },
                  "value": null,
                  "visibility": "internal"
                }
              ],
              "src": "3089:30:3"
            },
            "payable": false,
            "returnParameters": {
              "id": 450,
              "nodeType": "ParameterList",
              "parameters": [],
              "src": "3129:0:3"
            },
            "scope": 494,
            "src": "3075:454:3",
            "stateMutability": "nonpayable",
            "superFunction": null,
            "visibility": "internal"
          }
        ],
        "scope": 495,
        "src": "399:3132:3"
      }
    ],
    "src": "0:3532:3"
  },
  "compiler": {
    "name": "solc",
    "version": "0.4.24+commit.e67f0147.Emscripten.clang"
  },
  "networks": {},
  "schemaVersion": "3.0.0-beta.0",
  "updatedAt": "2019-02-02T21:09:16.063Z"
}
