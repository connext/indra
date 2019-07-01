#!/usr/bin/env bash
set -e

reset="${1:-noreset}"

external_client="../indra/modules/client"

if [[ ! -d "$external_client" ]]
then echo "Error, couldn't find client to link at $external_client" && exit
fi

if [[ "$reset" == "reset" ]]
then
  echo "rm -rf connext"
  rm -rf connext

  echo "cp -rf $external_client connext"
  cp -Rf $external_client connext

  echo "npm install"
  cd connext
  npm install
  cd ..

else
  echo "rm -rf connext/src"
  rm -rf connext/src

  echo "cp -rf $external_client/src connext/src"
  cp -Rf $external_client/src connext/src

fi

echo "npm run build"
cd connext
rm -rf dist
npm run build
cd ..

echo "rm -rf node_modules/connext/dist"
rm -rf node_modules/connext/dist

mkdir -p node_modules/connext

echo "cp -r connext/dist node_modules/connext/dist"
cp -R connext/dist node_modules/connext/dist

echo "Done!"

# NOTE: You might want to replace line 80 of:
# node_modules/react-scripts/config/webpackDevServer.config.js
# with:
# ignored: [/node_modules\/(?!connext)/,/connext\/node_modules/], poll: 1000
# (Thanks: https://stackoverflow.com/a/44166532)
