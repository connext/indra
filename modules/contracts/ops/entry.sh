#!/bin/bash

ganache_rpc_port=8545
migration_flag_port=8546

mkdir -p /data build/contracts
ganache=./node_modules/.bin/ganache-cli
truffle=./node_modules/.bin/truffle

# Set default env vars
netid=$ETH_NETWORK_ID
[[ -n "$netid" ]] || netid=4447
mnemonic=$ETH_MNEMONIC
[[ -n "$mnemonic" ]] || mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"

echo "Starting Ganache with options: netid=$netid, mnemonic=$mnemonic..."
$ganache --host="0.0.0.0" --port="$ganache_rpc_port" --db="/data" --mnemonic="$mnemonic" --networkId="$netid" --blockTime=3 &
sleep 5
echo 'lets go'

function getHash {
  find build/contracts contracts migrations -type f -not -name "*.swp" |\
  xargs cat |\
  sha256sum |\
  tr -d ' -'
}

function migrate {
    $truffle compile
    $truffle migrate --reset --network docker
    getHash > build/state-hash
    echo "Watching contracts/migrations for changes (`getHash`)"
}

if [[ ! -f build/state-hash ]]
then
    echo 
    echo "First migration..."
    migrate
elif [[ "`getHash`" == "`cat build/state-hash`" ]]
then
    echo "Contracts & migrations are up to date"
    echo "Watching contracts/migrations for changes (`getHash`)"
fi

function migrations_done_flag {
  echo "===> Signalling the completion of migrations..."
  while true # unix.stackexchange.com/a/37762
  do echo 'eth migrations complete' | nc -lk -p $migration_flag_port
  done > /dev/null
}
migrations_done_flag &
migrations_flag_pid=$!

while true;
do
    if [[ "`getHash`" == "`cat build/state-hash`" ]]
    then
        sleep 3;
    else
        echo 
        echo "Changes detected! Re-migrating (`getHash`)"
        kill $migrations_flag_pid
        migrate
        migrations_done_flag &
        migrations_flag_pid=$!
    fi
done
