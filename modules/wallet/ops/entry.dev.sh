#!/bin/bash

echo "Wallet entrypoint activated"
env

cd /client
yarn link

cd $HOME
yarn link connext

yarn start
