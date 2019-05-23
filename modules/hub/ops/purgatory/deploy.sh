#!/usr/bin/env bash

set -e

tar -czf - --exclude='./node_modules' --exclude='./dist' . | pv | \
  ssh root@165.227.202.164 'cat > /root/hub/hub.tgz'

ssh root@165.227.202.164 'cd /root/hub && tar -xzvf hub.tgz && rm hub.tgz && docker-compose stop && docker-compose up --build -d'
