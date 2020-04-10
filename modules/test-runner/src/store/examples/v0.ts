/////////////////////////////////////////////////////////////

import { env } from "../../util";
import { xkeyKthAddress } from "@connext/cf-core";

// from past cf
const sortAddresses = (addrs: string[]): string[] =>
  addrs.sort((a: string, b: string): number => (parseInt(a, 16) < parseInt(b, 16) ? -1 : 1));

const xkeysToSortedKthAddresses = (xkeys: string[], k: number | string = "0"): string[] =>
  sortAddresses(xkeys.map((xkey: string): string => xkeyKthAddress(xkey, k)));


// Don't import from types in case types change
export const ConnextClientStorePrefixV0 = "INDRA_CLIENT_CF_CORE";
export const ConnextNodeStorePrefixV0 = "INDRA_NODE_CF_CORE";

// must have the node pub id to properly convert the keys in the tests
const NODE_PUB_ID = env.nodePubId;

// Description -- free balance app installed, no active apps
export const MNEMONIC_V0_1 =
  "usual sense execute bleak giant school runway age wash alien virus vibrant";
export const XPUB_V0_1 =
  "xpub661MyMwAqRbcGxL2is6iyms2GhezmMXThyEZpvTGPfNvfiUq5hAyKGtch3TEGpM8SQA3EKun4mvSUVJekMgMVuNozJeALrrdUVhcNCpgAeG";
export const CHANNEL_KEY_VO_1 = `${ConnextClientStorePrefixV0}/${XPUB_V0_1}/channel/0x8C0A6Fee57539DCF1e2F8414ded4C3692742f994`;

export const CHANNEL_VALUE_VO_1 = {
  [CHANNEL_KEY_VO_1]: {
    multisigAddress: "0x8C0A6Fee57539DCF1e2F8414ded4C3692742f994",
    userNeuteredExtendedKeys: [NODE_PUB_ID, XPUB_V0_1],
    appInstances: [],
    freeBalanceAppInstance: {
      participants: xkeysToSortedKthAddresses([NODE_PUB_ID, XPUB_V0_1]),
      defaultTimeout: 172800,
      appInterface: {
        addr: "0xde8d1288e2c7eC3e0b7279F8395b87A996Cc02f4",
        stateEncoding:
          "\n  tuple(\n    address[] tokenAddresses,\n    tuple(\n      address to,\n      uint256 amount\n    )[][] balances,\n    bytes32[] activeApps\n  )\n",
      },
      appSeqNo: 0,
      latestState: {
        activeApps: [],
        tokenAddresses: ["0x0000000000000000000000000000000000000000"],
        balances: [
          [
            { to: xkeyKthAddress(NODE_PUB_ID), amount: { _hex: "0x00" } },
            { to: xkeyKthAddress(XPUB_V0_1), amount: { _hex: "0x00" } },
          ],
        ],
      },
      latestVersionNumber: 0,
      latestTimeout: 172800,
      outcomeType: "MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER",
      identityHash: "0x52c908640f7e6f947060d1d7a88bb3d1c6675bd2addef594cd0157d267408fc8",
    },
    monotonicNumProposedApps: 1,
    singleAssetTwoPartyIntermediaryAgreements: [],
    createdAt: 1569188857018,
    proxyFactoryAddress: "0x8eb543b35DE94B0E636402C7cA32947b22853eDF",
    addresses: {
      proxyFactory: "0x8eb543b35DE94B0E636402C7cA32947b22853eDF",
      multisigMastercopy: "0xe54f4EBeCE507477dFb86FA226394bdbA0b85d66",
    },
  },
};

/////////////////////////////////////////////////////////////
// Description -- free balance app installed, no active apps
export const MNEMONIC_V0_2 = "wet topic erase object they fat trial tent rebuild area joy ceiling";
export const XPUB_V0_2 =
  "xpub6EBMQUSnGZBHh7xMmcP2u26v7zp1b69QgtCqV6WNWYfzTi5BioRGQYW1Js9ua1BmkzWJipKqLmGwcYUmXAKveWKQCNUg5rfXgC6gpDyYraS";
export const CHANNEL_KEY_VO_2 = `${ConnextClientStorePrefixV0}/${XPUB_V0_2}/channel/0x9E746946146Da59D4d0daBfEA159ed791FB42FD1`;

export const CHANNEL_VALUE_VO_2 = {
  [CHANNEL_KEY_VO_2]: {
    multisigAddress: "0x9E746946146Da59D4d0daBfEA159ed791FB42FD1",
    userNeuteredExtendedKeys: [NODE_PUB_ID, XPUB_V0_2],
    appInstances: [],
    freeBalanceAppInstance: {
      participants: xkeysToSortedKthAddresses([NODE_PUB_ID, XPUB_V0_2]),
      defaultTimeout: 172800,
      appInterface: {
        addr: "0xde8d1288e2c7eC3e0b7279F8395b87A996Cc02f4",
        stateEncoding:
          "\n  tuple(\n    address[] tokenAddresses,\n    tuple(\n      address to,\n      uint256 amount\n    )[][] balances,\n    bytes32[] activeApps\n  )\n",
      },
      appSeqNo: 0,
      latestState: {
        activeApps: [],
        tokenAddresses: [
          "0x0000000000000000000000000000000000000000",
          "0xFab46E002BbF0b4509813474841E0716E6730136",
        ],
        balances: [
          [
            { to: xkeyKthAddress(NODE_PUB_ID), amount: { _hex: "0x00" } },
            { to: xkeyKthAddress(XPUB_V0_2), amount: { _hex: "0x00" } },
          ],
          [
            {
              to: xkeyKthAddress(NODE_PUB_ID),
              amount: { _hex: "0x68155a43676e0000" },
            },
            {
              to: xkeyKthAddress(XPUB_V0_2),
              amount: { _hex: "0x22b1c8c1227a0000" },
            },
          ],
        ],
      },
      latestVersionNumber: 24,
      latestTimeout: 172800,
      outcomeType: "MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER",
      identityHash: "0x082711ac8315040fd189a9101a337cd8a55656260deed29ccf8a5e6699e0862a",
    },
    monotonicNumProposedApps: 5,
    singleAssetTwoPartyIntermediaryAgreements: [],
    createdAt: 1569070400584,
    proxyFactoryAddress: "0x8eb543b35DE94B0E636402C7cA32947b22853eDF",
    addresses: {
      proxyFactory: "0x8eb543b35DE94B0E636402C7cA32947b22853eDF",
      multisigMastercopy: "0xe54f4EBeCE507477dFb86FA226394bdbA0b85d66",
    },
  },
};

/////////////////////////////////////////////////////////////
// Description -- has fb and proposed apps, balance $18.35

export const MNEMONIC_V0_3 =
  "loud skin cement buffalo target laugh swarm paper jelly swear near coconut";

export const XPUB_V0_3 =
  "xpub661MyMwAqRbcFKi9JLCi2PSBniGziyoPeYDjQN5gYuNJ7xDAW6Mmxh7M3Jn8NJ4w262nFwtBefFy8Um21zqvStxt2V7aowSfXtcSBN1jmTv";

export const CHANNEL_KEY_VO_3 = `${ConnextClientStorePrefixV0}/${XPUB_V0_3}/channel/0x7353b879FCd7d9269d3d95D843B4CC754d98F1e1`;

export const CHANNEL_VALUE_VO_3 = {
  [CHANNEL_KEY_VO_3]: {
    multisigAddress: "0x7353b879FCd7d9269d3d95D843B4CC754d98F1e1",
    addresses: {
      proxyFactory: "0x8eb543b35DE94B0E636402C7cA32947b22853eDF",
      multisigMastercopy: "0xe54f4EBeCE507477dFb86FA226394bdbA0b85d66",
    },
    userNeuteredExtendedKeys: [NODE_PUB_ID, XPUB_V0_3],
    proposedAppInstances: [
      [
        "0x090482fe110e64b6ab59356c62bdd23d57caf4b528ab3b3d0e99f73da377d12e",
        {
          appDefinition: "0x11D5f8fB334E7dfBb5555945aF988e9971010325",
          abiEncodings: {
            stateEncoding:
              "tuple(address recipient, address multisig, uint256 threshold, address tokenAddress)",
          },
          initialState: {
            multisig: "0x7353b879FCd7d9269d3d95D843B4CC754d98F1e1",
            recipient: "0x5307B4F67ca8746562A4a9fdEb0714033008Ef4A",
            threshold: {
              _hex: "0x00",
            },
            tokenAddress: "0xaFF4481D10270F50f203E0763e2597776068CBc5",
          },
          outcomeType: "SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER",
          initiatorDeposit: "0x00",
          responderDeposit: "0x00",
          timeout: "0x00",
          identityHash: "0x090482fe110e64b6ab59356c62bdd23d57caf4b528ab3b3d0e99f73da377d12e",
          proposedByIdentifier:
            "xpub6DZv6JzHGBAqDnJ8CLgy3cuVLsMYTeK4vRuycDEdYcmTo3cehiDg46iShdwzyWEG11DUbTQKETGVqPhAa9Ns7gbjFE7ajmW9n8fQj6XmSQa",
          proposedToIdentifier:
            "xpub6Ew7ALFHU48CVUjJwS8Z5dPLzDq5B45nCQWXR94oMQdzMkbBsgDyScK7VpFSobRp87StcoLJJDUj2mh1bRfMAJFkKjBCf4nDnvtrvAA5HYa",
          appSeqNo: 3,
          initiatorDepositTokenAddress: "0xaFF4481D10270F50f203E0763e2597776068CBc5",
          responderDepositTokenAddress: "0xaFF4481D10270F50f203E0763e2597776068CBc5",
        },
      ],
    ],
    appInstances: [],
    freeBalanceAppInstance: {
      participants: xkeysToSortedKthAddresses([NODE_PUB_ID, XPUB_V0_3]),
      defaultTimeout: 172800,
      appInterface: {
        addr: "0xde8d1288e2c7eC3e0b7279F8395b87A996Cc02f4",
        stateEncoding:
          "tuple(address[] tokenAddresses, tuple(address to, uint256 amount)[][] balances, bytes32[] activeApps)",
      },
      isVirtualApp: false,
      appSeqNo: 0,
      latestState: {
        activeApps: [],
        tokenAddresses: [
          "0x0000000000000000000000000000000000000000",
          "0xaFF4481D10270F50f203E0763e2597776068CBc5",
          "0x16655FAf612D714039F92c408407D46c5A394a6C",
        ],
        balances: [
          [
            {
              to: xkeyKthAddress(XPUB_V0_1),
              amount: {
                _hex: "0x00",
              },
            },
            {
              to: xkeyKthAddress(NODE_PUB_ID),
              amount: {
                _hex: "0x01a901f111d5d000",
              },
            },
          ],
          [
            {
              to: xkeyKthAddress(NODE_PUB_ID),
              amount: {
                _hex: "0xb312881391b1d800",
              },
            },
            {
              to: xkeyKthAddress(XPUB_V0_3),
              amount: {
                _hex: "0x627bbdf5821e2800",
              },
            },
          ],
          [
            {
              to: xkeyKthAddress(NODE_PUB_ID),
              amount: {
                _hex: "0x022238f30c36dc59a1",
              },
            },
            {
              to: xkeyKthAddress(XPUB_V0_3),
              amount: {
                _hex: "0xfec9f64f7ba859a1",
              },
            },
          ],
        ],
      },
      latestVersionNumber: 52,
      latestTimeout: 172800,
      outcomeType: "MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER",
      identityHash: "0x3ca94c637dcea2d1ef777e4be06211a1a08e69aba0b970c71fa607598947164e",
    },
    monotonicNumProposedApps: 14,
    singleAssetTwoPartyIntermediaryAgreements: [],
    schemaVersion: 1,
  },
};

/////////////////////////////////////////////////////////////
// Description -- has fb and apps, balance $12.91

export const MNEMONIC_V0_4 =
  "useless exhibit spray catalog craft arrive walk hedgehog harsh either dignity trial";

export const XPUB_V0_4 =
  "xpub661MyMwAqRbcGJ5NH5QFLegmPAtmmh5N6Cf79puaDW7gsHvxvhKqRjzsiKpPMT7ozThARSY6RajUKZRo5Tw7NocoRnjxxkyqpvktJ2mnxCa";

export const CHANNEL_KEY_VO_4 = `${ConnextClientStorePrefixV0}/${XPUB_V0_4}/channel/0xfd01aA324932B2D97Cf2064f94ac97E85c8BA788`;

export const CHANNEL_VALUE_VO_4 = {
  [CHANNEL_KEY_VO_4]: {
    multisigAddress: "0xfd01aA324932B2D97Cf2064f94ac97E85c8BA788",
    addresses: {
      proxyFactory: "0xCE7cBC12c4d2b49A4c0ee77683F3fDefF721940D",
      multisigMastercopy: "0xdD7dbCCdd42d7bFC10c2D23B8A1fa8bAaE95bc69",
    },
    userNeuteredExtendedKeys: [NODE_PUB_ID, XPUB_V0_4],
    proposedAppInstances: [],
    appInstances: [
      [
        "0xd5e8fed193710fd5261d00c0ceba8d6ffe8e454fc96c70161366b28c6bb1dd6d",
        {
          participants: xkeysToSortedKthAddresses([NODE_PUB_ID, XPUB_V0_4], 6),
          defaultTimeout: 0,
          appInterface: {
            actionEncoding: "tuple(bytes32 preImage)",
            stateEncoding:
              "\n  tuple(\n    tuple(address to, uint256 amount)[2] coinTransfers,\n    bytes32 linkedHash,\n    uint256 amount,\n    address assetId,\n    bytes32 paymentId,\n    bytes32 preImage\n  )\n",
            addr: "0xAc59699e5fD43fadb464b9C88b80038B29Cc4E7C",
          },
          isVirtualApp: false,
          appSeqNo: 6,
          latestState: {
            amount: {
              _hex: "0x0de0b6b3a7640000",
            },
            assetId: "0x16655FAf612D714039F92c408407D46c5A394a6C",
            coinTransfers: [
              {
                amount: {
                  _hex: "0x0de0b6b3a7640000",
                },
                to: `${xkeyKthAddress(XPUB_V0_4)}`,
              },
              {
                amount: {
                  _hex: "0x00",
                },
                to: `${xkeyKthAddress(NODE_PUB_ID)}`,
              },
            ],
            linkedHash: "0x5a92ffed328b7391ddfe63fc55eaddc7e4e4d751936a25342800f03f32d70945",
            paymentId: "0x7acafe7e0948696e5d3462b3266d46510826776974d8c56c98de679fe4742acd",
            preImage: "0x0000000000000000000000000000000000000000000000000000000000000000",
          },
          latestVersionNumber: 0,
          latestTimeout: 0,
          outcomeType: "SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER",
          singleAssetTwoPartyCoinTransferInterpreterParams: {
            limit: {
              _hex: "0x0de0b6b3a7640000",
            },
            tokenAddress: "0x16655FAf612D714039F92c408407D46c5A394a6C",
          },
          identityHash: "0xd5e8fed193710fd5261d00c0ceba8d6ffe8e454fc96c70161366b28c6bb1dd6d",
        },
      ],
      [
        "0xb5ada5765aceab979dbb36f6d8511f2b07b992a73d496bd196bf949d2df8c262",
        {
          participants: xkeysToSortedKthAddresses([NODE_PUB_ID, XPUB_V0_4], 7),
          defaultTimeout: 0,
          appInterface: {
            actionEncoding: "tuple(bytes32 preImage)",
            stateEncoding:
              "\n  tuple(\n    tuple(address to, uint256 amount)[2] coinTransfers,\n    bytes32 linkedHash,\n    uint256 amount,\n    address assetId,\n    bytes32 paymentId,\n    bytes32 preImage\n  )\n",
            addr: "0xAc59699e5fD43fadb464b9C88b80038B29Cc4E7C",
          },
          isVirtualApp: false,
          appSeqNo: 7,
          latestState: {
            amount: {
              _hex: "0x0de0b6b3a7640000",
            },
            assetId: "0x16655FAf612D714039F92c408407D46c5A394a6C",
            coinTransfers: [
              {
                amount: {
                  _hex: "0x0de0b6b3a7640000",
                },
                to: `${xkeyKthAddress(XPUB_V0_4)}`,
              },
              {
                amount: {
                  _hex: "0x00",
                },
                to: `${xkeyKthAddress(NODE_PUB_ID)}`,
              },
            ],
            linkedHash: "0xe41e4ddb5a183920232126597ab0c4fc407ebd2294dfd7e1da114eef8e24f106",
            paymentId: "0xe0fae50007e8c7a80c985e5bba60c00e75db1c18e4c87e5cb23b9b884c623b39",
            preImage: "0x0000000000000000000000000000000000000000000000000000000000000000",
          },
          latestVersionNumber: 0,
          latestTimeout: 0,
          outcomeType: "SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER",
          singleAssetTwoPartyCoinTransferInterpreterParams: {
            limit: {
              _hex: "0x0de0b6b3a7640000",
            },
            tokenAddress: "0x16655FAf612D714039F92c408407D46c5A394a6C",
          },
          identityHash: "0xb5ada5765aceab979dbb36f6d8511f2b07b992a73d496bd196bf949d2df8c262",
        },
      ],
    ],
    freeBalanceAppInstance: {
      participants: xkeysToSortedKthAddresses([NODE_PUB_ID, XPUB_V0_4]),
      defaultTimeout: 172800,
      appInterface: {
        addr: "0x9Df07A7f9251b48C8caB45c7ff61669746aAA908",
        stateEncoding:
          "tuple(address[] tokenAddresses, tuple(address to, uint256 amount)[][] balances, bytes32[] activeApps)",
      },
      isVirtualApp: false,
      appSeqNo: 0,
      latestState: {
        activeApps: [
          "0xd5e8fed193710fd5261d00c0ceba8d6ffe8e454fc96c70161366b28c6bb1dd6d",
          "0xb5ada5765aceab979dbb36f6d8511f2b07b992a73d496bd196bf949d2df8c262",
        ],
        tokenAddresses: [
          "0x0000000000000000000000000000000000000000",
          "0x16655FAf612D714039F92c408407D46c5A394a6C",
        ],
        balances: [
          [
            {
              to: `${xkeyKthAddress(NODE_PUB_ID)}`,
              amount: {
                _hex: "0x00",
              },
            },
            {
              to: `${xkeyKthAddress(XPUB_V0_4)}`,
              amount: {
                _hex: "0x01a9150a83602000",
              },
            },
          ],
          [
            {
              to: `${xkeyKthAddress(NODE_PUB_ID)}`,
              amount: {
                _hex: "0x014e4ac8febb905fd0",
              },
            },
            {
              to: `${xkeyKthAddress(XPUB_V0_4)}`,
              amount: {
                _hex: "0xb32f9ef875e3a030",
              },
            },
          ],
        ],
      },
      latestVersionNumber: 22,
      latestTimeout: 172800,
      outcomeType: "MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER",
      identityHash: "0x2b440f884bb1d99df93c6590c77fa80d3e9cf03d6bef944265ea28fdf487fbc2",
    },
    monotonicNumProposedApps: 8,
    singleAssetTwoPartyIntermediaryAgreements: [],
    schemaVersion: 1,
  },
};
