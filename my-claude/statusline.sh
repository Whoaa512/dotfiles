#!/bin/bash
# Thin wrapper: real statusline lives in statusline.ts (bun)
exec bun "$(dirname "$(readlink -f "$0")")/statusline.ts"
