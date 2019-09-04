#!/usr/bin/env bash
set -e

bridge_repo="git@github.com:bohendo/cf-core.git"
tmp_dir=".cf-core-bridge"
local_dot_git="modules/cf-core/.git"
cf_dot_git="counterfactual/packages/node/.git"

rm -rf $tmp_dir
git clone $bridge_repo $tmp_dir

rm -rf $local_dot_git
cp -r $tmp_dir/.git $local_dot_git

rm -rf $cf_dot_git
cp -r $tmp_dir/.git $cf_dot_git
