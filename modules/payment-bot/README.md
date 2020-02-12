# Payment Bot
Functionality of installing, updating, and uninstalling payment threads from state channels.

# Instructions
Payment functionality is demonstrated by using two payment bots connected to an intermediary (in this demo, the `indra`).

## Initial Setup
All setup is from root of repository.
* `make start` or `INDRA_ETH_NETWORK="kovan" bash ops/start-dev.sh` to run Indra node locally on Ganache or Kovan.

## Bot Functionality
The bot can be run with the following optional command line arguments:
`-x, --debug`: output extra debugging
`-d, --deposit <amount>`: Deposit amount in Ether units
`-a, --asset-id`: Asset ID/Token Address of deposited asset
`-t, --transfer <amount>`: Transfer amount in Ether units
`-c, --counterparty <id>`: Counterparty public identifier (xpub)
`-i, --identifier <id>`: Bot identifier, use 1 or 2

## Usage Examples
### Create Channel (If Not Exists)
`bash ops/payment-bot.sh -i 1`

### Deposit ETH Into Channel
`bash ops/payment-bot.sh -i 2 -d 0.1`

### Transfer ETH to Other Bot
`bash ops/payment-bot.sh -i 2 -t 0.01 -c xpub6DXwZMmWUq4bRZ3LtaBYwu47XV4Td19pnngok2Y7DnRzcCJSKCmD1AcLJDbZZf5dzZpvHqYzmRaKf7Gd2MV9qDvWwwN7VpBPNXQCZCbfyoK`

TODO: Add ERC20 stuff
