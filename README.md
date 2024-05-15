# CJ’s dotfiles

![Screenshot of my shell prompt](https://github.com/Whoaa512/dotfiles/assets/1581943/77f4f838-7dd2-4762-94e4-e32f9d63473d)

## Installation

**Warning:** If you want to give these dotfiles a try, you should first fork this repository, review the code, and remove things you don’t want or need. Don’t blindly use my settings unless you know what that entails. Use at your own risk!

### tl;dr:

In general I do the following on a new laptop:
```bash
# Install brew
ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
# Install oh-my-zsh
sh -c "$(curl -fsSL https://raw.github.com/robbyrussell/oh-my-zsh/master/tools/install.sh)"
# Install powerlevel10k and some oh-my-zsh plugins
git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
git clone https://github.com/zsh-users/zsh-syntax-highlighting ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
# Clone repo & bootstrap
mkdir -p ~/code
git clone https://github.com/whoaa512/dotfiles.git ~/code/dotfiles
ln -s ~/code/dotfiles ~/dotfiles
cd ~/code/dotfiles && zsh bootstrap.sh
# [Optional] Run the brew formulae
bash brew.sh
# [Optional] Run the non-brew stuff
bash non-brew.sh
# [Optional] OS X Defaults, review before applying
~/code/dotfiles/.macos
```

### Things of note

My dotfiles is a fork of the awesome [@mathiasbynens/dotfiles](https://github.com/mathiasbynens/dotfiles) and then I have incrementally added/edited things for my personal use over the years.

At a high level, this includes:
- [Oh-my-zsh](https://ohmyz.sh/) as the general framework for plugins
- [powerlevel10k](https://github.com/romkatv/powerlevel10k) for the theme and some good git speed boosts. Also provides the awesome font with icons
- [zsh-autosuggestions](https://github.com/zsh-users/zsh-autosuggestions) plugin to offer recently used commands
- [zsh-syntax-highlighting](https://github.com/zsh-users/zsh-syntax-highlighting) plugin to do some basic shell syntax highlighting
- [MacOS sensible defaults](./.macos) from [@mathiasbynens/dotfiles](https://github.com/mathiasbynens/dotfiles) (though I don't update super frequently from upstream, and have made slight modifications)
- History search on the up/down arrow keys provided by [.inputrc](./.inputrc)
- and a general install point for the various tools I use/need


### Add custom commands without creating a new fork

If `~/dotfiles/.extras` exists, it will be sourced along with the other files. You can use this to add a few custom commands without the need to fork this entire repository, or to add commands you don’t want to commit to a public repository.

My `~/dotfiles/.extras` looks something like this:

```bash
# Git credentials
# Not in the repository, to prevent people from accidentally committing under my name
GIT_AUTHOR_NAME="CJ Winslow"
GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME"
git config --global user.name "$GIT_AUTHOR_NAME"
GIT_AUTHOR_EMAIL="cj@mailinator.com"
GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"
git config --global user.email "$GIT_AUTHOR_EMAIL"

# Also useful to add anything extra that doesn't make sense for all setups
export PATH="/some/path/my-cool-bin-dir:$PATH"

```

You could also use `~/.extra` to override settings, functions and aliases from my dotfiles repository. It’s probably better to [fork this repository](https://github.com/whoaa512/dotfiles/fork) instead, though.

### Sensible OS X defaults
> Lovingly borrowed from [@mathiasbynens/dotfiles](https://github.com/mathiasbynens/dotfiles)
When setting up a new Mac, you may want to set some sensible OS X defaults:

```bash
./.macos
```


## Thanks to…

* The original author [Mathias Bynens](https://mathiasbynens.be/)!
* @ptb and [his _OS X Lion Setup_ repository](https://github.com/ptb/Mac-OS-X-Lion-Setup)
* [Ben Alman](http://benalman.com/) and his [dotfiles repository](https://github.com/cowboy/dotfiles)
* [Chris Gerke](http://www.randomsquared.com/) and his [tutorial on creating an OS X SOE master image](http://chris-gerke.blogspot.com/2012/04/mac-osx-soe-master-image-day-7.html) + [_Insta_ repository](https://github.com/cgerke/Insta)
* [Cătălin Mariș](https://github.com/alrra) and his [dotfiles repository](https://github.com/alrra/dotfiles)
* [Gianni Chiappetta](http://gf3.ca/) for sharing his [amazing collection of dotfiles](https://github.com/gf3/dotfiles)
* [Jan Moesen](http://jan.moesen.nu/) and his [ancient `.bash_profile`](https://gist.github.com/1156154) + [shiny _tilde_ repository](https://github.com/janmoesen/tilde)
* [Lauri ‘Lri’ Ranta](http://lri.me/) for sharing [loads of hidden preferences](http://osxnotes.net/defaults.html)
* [Matijs Brinkhuis](http://hotfusion.nl/) and his [dotfiles repository](https://github.com/matijs/dotfiles)
* [Nicolas Gallagher](http://nicolasgallagher.com/) and his [dotfiles repository](https://github.com/necolas/dotfiles)
* [Sindre Sorhus](http://sindresorhus.com/)
* [Tom Ryder](http://blog.sanctum.geek.nz/) and his [dotfiles repository](https://github.com/tejr/dotfiles)
* [Kevin Suttle](http://kevinsuttle.com/) and his [dotfiles repository](https://github.com/kevinSuttle/dotfiles) and [OSXDefaults project](https://github.com/kevinSuttle/OSXDefaults), which aims to provide better documentation for [`~/.osx`](https://mths.be/osx)
* [Haralan Dobrev](http://hkdobrev.com/)
* anyone who [contributed a patch](https://github.com/mathiasbynens/dotfiles/contributors) or [made a helpful suggestion](https://github.com/mathiasbynens/dotfiles/issues)
