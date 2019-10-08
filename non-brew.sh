#!/usr/bin/env bash

echo "Please ensure you have Sublime Text 3 installed. Adding symlink"
ln -s "/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl" ~/bin/subl

echo "Please ensure you have Oh My Zsh installed"
git clone https://github.com/adolfoabegg/browse-commit ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/browse-commit
git clone https://github.com/zsh-users/zsh-syntax-highlighting ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions

# Node
cd ~/code && git clone https://github.com/tj/n.git
cd n && make install
cd -

n stable
# Npm globals
npm i -g \
airplane-mode \
ava \
brightness-cli \
bunyan \
coffee-script \
emoji-random \
iron-node \
n_ \
ndu \
node-inspector \
nodemon \
normit \
np \
ntl \
pipeable-js \
pm2 \
speed-test \
standard \
tldr \
trymodule \
wallpaper \
wifi-password \
;
