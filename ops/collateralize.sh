#!/usr/bin/env bash
set -e

########################################
# Setup Some Local Vars

dir="`cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd`/.."

project="`cat $dir/package.json | grep '"name":' | awk -F '"' '{print $4}'`"
name="${project}_collateralizer"
service=${project}_hub
service_id="`docker service ps -q $service | head -n 1`"
container_id="`docker inspect --format '{{.Status.ContainerStatus.ContainerID}}' $service_id`"
secret="`docker service inspect $service | grep "SecretName" | grep "hub_key" | awk -F '"' '{print $4}'`"

########################################
# Load our arguments and do some sanity checks

value="$1"
currency="$2"

if [[ -z "$value" || -z "$currency" ]]
then
  echo 'Usage: bash ops/collateralize.sh <AMOUNT> <CURRENCY>'
  echo ' - AMOUNT: "3.1415" or another number in units of ether or tokens'
  echo ' - CURRENCY: "eth" or "token"'
  exit
fi

if [[ -n "`echo $value | sed 's/[0-9.]//g'`" ]]
then
  echo "Usage: bash ops/collateralize.sh <AMOUNT> <CURRENCY>"
  echo ' - AMOUNT: "3.1415" or another number in units of ether or tokens'
  exit
fi

if [[ "$currency" == "eth" ]]
then isEth="true"
elif [[ "${currency::5}" == "token" ]]
then isEth="false"
else
  echo "Usage: bash ops/collateralize.sh <AMOUNT> <CURRENCY>"
  echo ' - CURRENCY: "eth" or "token"'
  exit
fi

docker exec -i $container_id node - <<EOF
  const fs = require("fs")
  const eth = require("ethers")
  const abi = (require("./dist/abi/MintAndBurnToken.js")).ABI.abi
  const key = "0x" + fs.readFileSync("/run/secrets/$secret", "utf8")
  const channelManagerAddress = process.env.CHANNEL_MANAGER_ADDRESS
  const value = eth.utils.parseEther("$value")
  const provider = new eth.providers.JsonRpcProvider(process.env.ETH_RPC_URL)
  const url = provider.connection.url
  const wallet = new eth.Wallet(key, provider)
  const token = new eth.Contract(process.env.TOKEN_ADDRESS, abi, wallet)
  let ethBalance, tokenBalance, tx

  // Start async part of script, first print network id
  ;(async function () {
    const chainId = (await provider.getNetwork()).chainId
    console.log("Using provider for chain id "+chainId+" at url: "+url)

    // Print hub balance before
    ethBalance = eth.utils.formatEther(await wallet.getBalance())
    tokenBalance = eth.utils.formatEther(await token.balanceOf(wallet.address))
    console.log("\nHub ("+wallet.address+") balance: "+ethBalance+" ETH + "+tokenBalance+" tokens")

    // Send collateralization tx
    if ($isEth) {
      tx = await wallet.sendTransaction({ to: channelManagerAddress, value })
    } else {
      tx = await token.transfer(channelManagerAddress, value)
    }

    // Wait for tx to be mined
    console.log("\nWaiting for transaction "+tx.hash+" to get mined...")
    await wallet.provider.waitForTransaction(tx.hash)
    console.log("Confirmed!")

    // Print hub balance after
    ethBalance = eth.utils.formatEther(await wallet.getBalance())
    tokenBalance = eth.utils.formatEther(await token.balanceOf(wallet.address))
    console.log("\nHub ("+wallet.address+") balance: "+ethBalance+" ETH + "+tokenBalance+" tokens")
  })()
EOF
