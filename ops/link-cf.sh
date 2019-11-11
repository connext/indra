#!/usr/bin/env bash
set -e

repos="core types"

for repo in $repos;
do

  bridge_repo="git@github.com:bohendo/cf-$repo.git"
  tmp_dir=".cf-$repo-bridge"
  local_dot_git="modules/cf-$repo/.git"
  if [[ "$repo" == "core" ]]
  then cf_dot_git="counterfactual/packages/node/.git"
  else cf_dot_git="counterfactual/packages/$repo/.git"
  fi

  rm -rf $tmp_dir
  git clone $bridge_repo $tmp_dir

  mkdir -p $local_dot_git
  rm -rf $local_dot_git
  echo "cp $tmp_dir/.git -> $local_dot_git"
  cp -rf $tmp_dir/.git $local_dot_git

  mkdir -p $cf_dot_git
  rm -rf $cf_dot_git
  echo "cp $tmp_dir/.git -> $cf_dot_git"
  cp -rf $tmp_dir/.git $cf_dot_git

done
