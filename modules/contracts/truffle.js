module.exports = {
  networks: {
    mainnet: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "1",
      gas: 4700000
    },
    ganache: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "4447",
      gas: 6721975
    },
    development: {
      host: "127.0.0.1",
      port: 9545,
      network_id: "4447",
      gas: 4700000
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 1
    }
  },
  mocha: {
    enableTimeouts: false
  }
};

/*
Available Accounts
==================
(0) 0xfb482f8f779fd96a857f1486471524808b97452d (~100 ETH)
(1) 0x2da565caa7037eb198393181089e92181ef5fb53 (~100 ETH)
(2) 0x8644406d56e3950975f10d063241208016f4b56f (~100 ETH)
(3) 0xc77f221e270ae13c5095d03047199d41b69c9f78 (~100 ETH)
(4) 0x98788265186c69d05648556a62279b572435170e (~100 ETH)
(5) 0x05ef57dd7670e0fca5bfa8c4c834bfb0bb95a9e0 (~100 ETH)
(6) 0x81c7dc2be16eef877779f63b33d22282e48ca15d (~100 ETH)
(7) 0x17b105bcb3f06b3098de6eed0497a3e36aa72471 (~100 ETH)
(8) 0x64d3c7c65ff1182ea882292a0012ed0ef74fcaaf (~100 ETH)
(9) 0x76fc3fe47393462c430108518080af400cf10dc4 (~100 ETH)

Private Keys
==================
(0) 0x09cd8192c4ad4dd3b023a8ef381a24d29266ebd4af88ecdac92ec874e1c2fed8
(1) 0x54dec5a04356ed96fc469803f3e45b901c69c5d5fd93a34fbf3568cd4c6efadd
(2) 0xa42d981869266bbb39aa894966f6430a85c2ed12836328fe23e403031f1a92b6
(3) 0xf1815522b81f88cf1ed7e232471012672f7f1144f5fd32136ecbcc2307fd3f0b
(4) 0x628ccc1a8fa5478fbd034d0bb964d1e05376710a3d14e8643deb5db37fd62243
(5) 0x31e7320fab7e4904be67562299bf098e44ed1a6c50132dd51ee83c33f1e9ea7b
(6) 0x40805dd14c3e361603a10198d25820235e8f237c182106f6d51d8fb364de4327
(7) 0x0aba2a064ba9dedf2eb7623e75b7701a72f21acbdad69f60ebaa728a8e00e5bb
(8) 0xa76d14d7fbbf2868ebd9580305aec6461319b2f261c7a75b0763c79165b41ec2
(9) 0xb75be88ddb9f86f4a21d168cde7ea35bca73b7d550075171498427d8334f5dc9
*/