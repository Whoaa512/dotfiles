#!/usr/bin/env bash

echo "Please ensure you have Sublime Text 3 installed. Adding symlink"
ln -s "/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl" ~/bin/subl

# oh-my-zsh
sh -c "$(curl -fsSL https://raw.github.com/robbyrussell/oh-my-zsh/master/tools/install.sh)"

# Node
cd ~/code && git clone https://github.com/tj/n.git
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
nodemon \
normit \
np \
pipeable-js \
pm2 \
speed-test \
standard \
tldr \
wallpaper \
wifi-password \
;
