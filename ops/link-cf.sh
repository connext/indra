#!/usr/bin/env bash
set -e

repos="cf-apps cf-core cf-types cf-adjudicator-contracts cf-funding-protocol-contracts"

for repo in $repos;
do

  bridge_repo="git@github.com:bohendo/$repo.git"
  tmp_dir=".bridge-$repo"
  local_dot_git="modules/$repo/.git"
  if [[ "${repo:3}" == "core" ]]
  then cf_dot_git="counterfactual/packages/node/.git"
  elif [[ "${repo:3}" == "apps" ]]
  then cf_dot_git="counterfactual/packages/apps/.git"
  elif [[ "${repo:3}" == "types" ]]
  then cf_dot_git="counterfactual/packages/types/.git"
  else cf_dot_git="counterfactual/packages/$repo/.git"
  fi

  if [[ -d "$tmp_dir/" ]]
  then
    cd $tmp_dir
    git fetch --all --prune
    cd -
  else
    git clone $bridge_repo $tmp_dir
  fi

  mkdir -p "$local_dot_git"
  if [[ -f "$local_dot_git/index" ]]
  then
    cd $local_dot_git
    git fetch --all --prune
    cd -
  else
    echo "cp $tmp_dir/.git -> $local_dot_git"
    cp -rf $tmp_dir/.git $local_dot_git
  fi

  mkdir -p "$cf_dot_git"
  if [[ -f "$cf_dot_git/index" ]]
  then
    cd $cf_dot_git
    git fetch --all --prune
    cd -
  else
    echo "cp $tmp_dir/.git -> $cf_dot_git"
    cp -rf $tmp_dir/.git $cf_dot_git
  fi

done
