#!/usr/bin/env bash

# oh-my-zsh
sh -c "$(curl -fsSL https://raw.github.com/robbyrussell/oh-my-zsh/master/tools/install.sh)"

# Node
git clone https://github.com/tj/n.git
cd n && make install
cd -

n stable
# Npm globals
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
