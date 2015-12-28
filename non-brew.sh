#!/usr/bin/env bash
git clone https://github.com/tj/n.git
cd n && make install
cd -

n stable
npm i -g \
airplane-mode \
brightness-cli \
bunyan \
coffee-script \
emoji-random \
iron-node \
n_ \
node-inspector \
normit \
np \
pipeable-js \
pm2 \
speed-test \
standard \
wallpaper \
wifi-password \
;
