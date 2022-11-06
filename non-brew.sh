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
yarn global add alfred-emoj
yarn global add nodemon
yarn global add trash-cli

# Golang
asdf plugin-add golang https://github.com/kennyp/asdf-golang.git
asdf install golang latest
asdf global golang latest

go install github.com/fiatjaf/jiq/cmd/jiq@latest

# Setup extras
touch ~/dotfiles/.extras

# append EOF to .extras
cat << EOF >> ~/dotfiles/.extras
GIT_AUTHOR_NAME=""
GIT_COMMITTER_NAME="\$GIT_AUTHOR_NAME"
git config --global user.name "\$GIT_AUTHOR_NAME"
GIT_AUTHOR_EMAIL=""
GIT_COMMITTER_EMAIL="\$GIT_AUTHOR_EMAIL"
git config --global user.email "\$GIT_AUTHOR_EMAIL"
EOF

yt_dl_version="$(brew info --installed --json | jq -r '.[] | select(.name == "youtube-dl") | .versions.stable')"
echo "source $(brew --cellar youtube-dl)/$yt_dl_version/etc/bash_completion.d/youtube-dl.bash-completion" >> ~/dotfiles/.extras


echo "Don't forget to run run `p10k configure` to install the fonts"
echo "And update your name & email in ~/dotfiles/.extras"
