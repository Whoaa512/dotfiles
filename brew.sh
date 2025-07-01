#!/usr/bin/env bash

# Install command-line tools using Homebrew.

# Ask for the administrator password upfront.
sudo -v

# Keep-alive: update existing `sudo` time stamp until the script has finished.
while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done 2>/dev/null &

# Make sure we’re using the latest Homebrew.
brew update

# Upgrade any already-installed formulae.
# brew upgrade

# Install GNU core utilities (those that come with OS X are outdated).
# Don’t forget to add `$(brew --prefix coreutils)/libexec/gnubin` to `$PATH`.
brew install coreutils
sudo ln -s /usr/local/bin/gsha256sum /usr/local/bin/sha256sum

# Install some other useful utilities like `sponge`.
brew install moreutils
# Install GNU `find`, `locate`, `updatedb`, and `xargs`, `g`-prefixed.
brew install findutils
# Install GNU `sed`, overwriting the built-in `sed`.
brew install gnu-sed #--with-default-names
# Install Bash 4.
# Note: don’t forget to add `/usr/local/bin/bash` to `/etc/shells` before
# running `chsh`.
brew install bash
# brew tap homebrew/versions
brew install bash-completion@2
brew install zsh-syntax-highlighting
brew install zsh-autosuggestions

# Install `wget` with IRI support.
brew install wget #--with-iri

# Install RingoJS and Narwhal.
# Note that the order in which these are installed is important;
# see http://git.io/brew-narwhal-ringo.
# brew install ringojs
# brew install narwhal

# Install more recent versions of some OS X tools.
brew install vim #--override-system-vi
# brew install homebrew/dupes/grep
# brew install homebrew/dupes/openssh
# brew install homebrew/dupes/screen
# brew install homebrew/php/php55 --with-gmp

# Install font tools.
brew tap bramstein/webfonttools
brew install sfnt2woff
brew install sfnt2woff-zopfli
brew install woff2

# Install some CTF tools; see https://github.com/ctfs/write-ups.
brew install aircrack-ng
brew install awscli
brew install bfg
brew install binutils
brew install binwalk
brew install cifer
brew install dex2jar
brew install dns2tcp
brew install fcrackzip
brew install ffmpeg
brew install foremost
brew install hashpump
brew install hydra
brew install john
brew install knock
brew install netpbm
brew install nmap
brew install pngcheck
brew install prettyping
brew install socat
brew install sqlmap
brew install tcpflow
brew install tcpreplay
brew install tcptrace
brew install ucspi-tcp # `tcpserver` etc.
brew install xpdf
brew install xz

# Install other useful binaries.
brew install eza
brew install mise
brew install lsd
# brew install asdf
brew install ack
brew install btop
brew install dark-mode
# brew install bro
brew install ccat
#brew install exiv2
brew install git
brew install git-lfs
brew install htop
brew install hub
brew install jq
brew install fx
brew install imagemagick #--with-webp
brew install lua
brew install lynx
# brew install mas
brew install mosh
brew install p7zip
brew install pigz
brew install pv
brew install rename
# brew install rhino
brew install s3cmd
brew install spoof-mac
brew install shellcheck
brew install ssh-copy-id
brew install svn
brew install tree
# brew install unrar # doesn't exist anymore
brew install watch
brew install webkit2png
# brew install youtube-dl # deprecated
brew install yt-dlp
brew install zopfli
brew install fzf
brew install ripgrep
brew install fd
brew install rustup
brew install pygitup
brew install miniforge
brew install ncdu
# node.js version manager
brew install fnm

# Cask installs
# prerequisites:
brew tap homebrew/cask-fonts
brew tap homebrew/cask-versions

brew install --cask alfred
# brew install --cask atom
# brew install --cask battle-net
brew install --cask bettertouchtool
# brew install --cask disk-inventory-x
brew install --cask dropbox
brew install --cask firefox
# brew install --cask flux
brew install font-source-code-pro
brew install font-source-code-pro-for-powerline
brew install font-meslo-for-powerlevel10k
# brew install --cask google-chrome
# brew install --cask google-drive
brew install --cask iterm2
brew install --cask visual-studio-code
# brew install --cask minecraft
brew install --cask monitorcontrol
# brew install --cask ngrok
# brew install --cask omnifocus
brew install --cask rocket
# brew install --cask skype
brew install --cask sourcetree
brew install --cask spotify
brew install --cask stay
# brew install --cask vlc
# Dash should be installed via AppStore, since I purchased v3 from there
# brew install --cask dash
brew install --cask plistedit-pro
brew install --cask 1password

# Mac Store installs
# mas sigin whoaa512@gmail.com
# mas install 803453959 # Slack
# mas install 449589707 # Dash
# mas install 866773894 # Quiver

# Quick look plugins https://github.com/sindresorhus/quick-look-plugins
# brew install --cask qlcolorcode qlstephen qlmarkdown quicklook-json qlprettypatch quicklook-csv betterzipql qlimagesize webpquicklook suspicious-package

# Remove outdated versions from the cellar.
brew cleanup
