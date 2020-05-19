#!/usr/bin/env bash
set -e

concurrency="${1:-1}"
limit="${2:-5}"

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

INDRA_ETH_RPC_URL="${INDRA_ETH_RPC_URL:-http://172.17.0.1:3000/api/ethprovider}"
INDRA_NODE_URL="${INDRA_NODE_URL:-http://172.17.0.1:3000/api}"
INDRA_NATS_URL="${INDRA_NATS_URL:-nats://172.17.0.1:4222}"

receiver_name="${project}_bot_receiver"
sender_name="${project}_bot_sender"

# Kill the dependency containers when this script exits
function cleanup {
  exit_code="0"
  echo;
  for (( n=1; n<=$concurrency; n++ ))
  do 
    if [[ -n "`docker container ls -a | grep $receiver_name`" ]]
    then
      echo "Stopping receiver for ping pong pair $n.."
      docker container stop ${receiver_name}_$n &> /dev/null || true
      receiver_code="`docker container inspect ${receiver_name}_$n | jq '.[0].State.ExitCode'`"
      if [[ "$receiver_code" != "0" ]]
      then
        echo "receiver failed: $receiver_code";
        exit_code="$receiver_code";
      fi
      echo "Removing receiver ping pong pair $n.."
      docker container rm ${receiver_name}_$n &> /dev/null || true
    fi

    if [[ -n "`docker container ls -a | grep $sender_name`" ]]
    then
      echo "Stopping sender for ping pong pair $n.."
      docker container stop ${sender_name}_$n &> /dev/null || true
      sender_code="`docker container inspect ${sender_name}_$n | jq '.[0].State.ExitCode'`"
      if [[ "$sender_code" != "0" ]]
      then
        echo "sender failed: $sender_code";
        exit_code="$sender_code";
      fi
      echo "Removing sender ping pong pair $n.."
      docker container rm ${sender_name}_$n &> /dev/null || true
    fi
  done
  exit $exit_code
}
trap cleanup EXIT SIGINT

if [[ -t 0 && -t 1 && -t 2 ]]
then interactive="--interactive --tty"
else echo "Running in non-interactive mode"
fi

for (( n=1; n<=$concurrency; n++ ))
do
  receiver="${receiver_name}_$n"
  sender="${sender_name}_$n"

  echo "Creating new private keys"
  receiver_key="0x`hexdump -n 32 -e '"%08X"' < /dev/urandom | tr '[:upper:]' '[:lower:]'`"
  sender_key="0x`hexdump -n 32 -e '"%08X"' < /dev/urandom | tr '[:upper:]' '[:lower:]'`"

  receiver_address="`node <<<'var eth = require("ethers"); console.log((new eth.Wallet("'"$receiver_key"'")).address);'`"
  receiver_pub_key="`node <<<'var eth = require("ethers"); console.log((new eth.Wallet("'"$receiver_key"'")).signingKey.publicKey);'`"
  sender_address="`node <<<'var eth = require("ethers"); console.log((new eth.Wallet("'"$sender_key"'")).address);'`"

  echo "Funding receiver: $receiver_address (pubKey: ${receiver_pub_key})"
  bash ops/fund.sh $receiver_address

  echo "Funding sender: $sender_address"
  bash ops/fund.sh $sender_address

  echo "Starting receiver container $n"
  docker run \
    --detach \
    --entrypoint="bash" \
    --env="LOG_LEVEL=$LOG_LEVEL" \
    --env="INDRA_ETH_RPC_URL=$INDRA_ETH_RPC_URL" \
    --env="INDRA_NODE_URL=$INDRA_NODE_URL" \
    --env="INDRA_NATS_URL=$INDRA_NATS_URL" \
    $interactive \
    --name="$receiver" \
    --volume="`pwd`:/root" \
    ${project}_builder -c '
      set -e
      echo "Bot container launched!"
      cd modules/bot
      export PATH=./node_modules/.bin:$PATH
      function finish {
        echo && echo "Bot container exiting.." && exit
      }
      trap finish SIGTERM SIGINT
      echo "Launching receiver bot!";echo
      npm run start -- receiver --private-key '$receiver_key' --concurrency-index '$n' --payment-limit '$limit'
    '

  docker logs --follow $receiver &

  echo "Starting sender container $n"
  docker run \
    --detach \
    --entrypoint="bash" \
    --env="LOG_LEVEL=$LOG_LEVEL" \
    --env="INDRA_ETH_RPC_URL=$INDRA_ETH_RPC_URL" \
    --env="INDRA_NODE_URL=$INDRA_NODE_URL" \
    --env="INDRA_NATS_URL=$INDRA_NATS_URL" \
    $interactive \
    --name="$sender" \
    --volume="`pwd`:/root" \
    ${project}_builder -c '
      set -e
      echo "Bot container launched!"
      cd modules/bot
      export PATH=./node_modules/.bin:$PATH
      function finish {
        echo && echo "Bot container exiting.." && exit
      }
      trap finish SIGTERM SIGINT
      echo "Launching sender bot!";echo
      npm run start -- sender --private-key '$sender_key' --receiver-public-key '$receiver_pub_key' --concurrency-index '$n' --payment-limit '$limit'
    '

  docker logs --follow $sender &

done

# wait for bots to finish
while true
do
  if [[ \
    -z "`docker container ls | grep $receiver_name | grep "Up"`" && \
    -z "`docker container ls | grep $sender_name | grep "Up"`" \
  ]]
  then break
  else sleep 3;
  fi
done
