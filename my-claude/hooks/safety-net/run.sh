#!/bin/bash
set -e
cd "$(dirname "$0")"
cat | bun run safety-net.ts
