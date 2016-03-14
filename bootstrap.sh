#!/usr/bin/env bash

cd "$(dirname "${BASH_SOURCE}")";

localSource="$(cd "$(dirname ".zshrc")"; pwd)/$(basename ".zshrc")"

git pull origin master;

function doIt() {
	rsync --exclude ".git/" --exclude ".DS_Store" --exclude "bootstrap.sh" \
		--exclude "README.md" --exclude ".zshrc" --exclude "dotfiles.sublime-workspace" \
		--exclude "LICENSE-MIT.txt" -avh --no-perms . ~;
	ln -s $localSource ~/.zshrc
	source ~/.bash_profile;
}

if [ "$1" == "--force" -o "$1" == "-f" ]; then
	doIt;
else
	read -p "This may overwrite existing files in your home directory. Are you sure? (y/n) " -n 1;
	echo "";
	if [[ $REPLY =~ ^[Yy]$ ]]; then
		doIt;
	fi;
fi;
unset doIt;
