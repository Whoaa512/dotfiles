#!/usr/bin/env bash

# https://github.com/trailofbits/graphtage
# pip3 install graphtage

# subl_bin="/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl"
# if [[ -s "$subl_bin" ]]; then
#   ln -s "$subl_bin" ~/bin/subl
# else
#   echo "Please ensure you have Sublime Text installed. Could not find subl binary"
# fi

echo "Please ensure you have Oh My Zsh installed"
git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k
git clone https://github.com/adolfoabegg/browse-commit ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/browse-commit
git clone https://github.com/zsh-users/zsh-syntax-highlighting ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
git clone https://github.com/asdf-vm/asdf.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/asdf

# fnm
curl -fsSL https://fnm.vercel.app/install | bash

node_version="$(fnm list-remote | tail -n 1)"
fnm install "$node_version"
fnm default "$node_version"

# yarn
curl -o- -L https://yarnpkg.com/install.sh | bash

# alfred search workflow
yarn global add alfred-npms
yarn global add nodemon
yarn global add trash-cli

# n stable
# Npm globals
# npm i -g \
# airplane-mode \
# ava \
# brightness-cli \
# bunyan \
# coffee-script \
# emoji-random \
# iron-node \
# n_ \
# ndu \
# node-inspector \
# nodemon \
# normit \
# np \
# ntl \
# pipeable-js \
# pm2 \
# speed-test \
# standard \
# tldr \
# trymodule \
# wallpaper \
# wifi-password \
# ;

echo "Don't forget to run run `p10k configure` to install the fonts"
