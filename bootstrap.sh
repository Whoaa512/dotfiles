#!/usr/bin/env zsh

cd "$(dirname "${0:A}")"

localSource="$(cd "$(dirname ".zshrc")"; pwd)/$(basename ".zshrc")"

# git pull origin master;

function doIt() {
	rsync --exclude ".git/" \
		--exclude ".DS_Store" \
		--exclude "bootstrap.sh" \
		--exclude "README.md" \
		--exclude ".zshrc" \
		--exclude "zshrc.sh" \
		--exclude ".functions" \
		--exclude ".aliases" \
		--exclude ".extras" \
		--exclude "my-claude" \
		--exclude "dotfiles.sublime-workspace" \
		--exclude "LICENSE-MIT.txt" \
		-avh --no-perms . ~
	if [ -f ~/.zshrc ] && [[ "$(realpath ~/.zshrc)" != "$localSource" ]]; then
		mv ~/.zshrc ~/.zshrc.old
	fi
	ln -s $localSource ~/.zshrc
	source ~/.zshrc
}

if [[ "$1" = "--force" ]] || [[ "$1" = "-f" ]]; then
	doIt
else
	read -q "REPLY?This may overwrite existing files in your home directory. Are you sure? (y/n) "
	echo ""
	if [[ $REPLY =~ ^[Yy]$ ]]; then
		doIt
	fi
fi

unset doIt
