#!/bin/bash
# Play notification sound unless on clawdbox
[[ "$(hostname)" == "clawdbox" ]] && exit 0
afplay /System/Library/Sounds/Funk.aiff &
