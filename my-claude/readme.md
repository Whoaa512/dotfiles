# my-claude

Personal collection of my various claude things checked into source control


## Usage

I currently do hard links of the files in this repo to my `$HOME/.claude` folder since claude doesn't seem to like symlinks


Simple setup
```sh
mkdir -p $HOME/.claude/commands
ln $HOME/dotfiles/my-claude/settings.global.json ~/.claude/settings.json
ln $HOME/dotfiles/my-claude/CLAUDE.global.md ~/.claude/CLAUDE.md
for cmd_file in $HOME/dotfiles/my-claude/commands/*.md; do
    ln $cmd_file $HOME/.claude/commands/$(basename $cmd_file)
done
```
