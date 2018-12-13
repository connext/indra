#!/bin/bash
set -e
project=connext

docker run --rm --network=$project ${project}_hub:test
