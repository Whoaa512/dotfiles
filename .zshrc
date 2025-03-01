# make history huge, really huge.
SAVEHIST=100000000
HISTSIZE=100000000

# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must gco above this block, everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

ulimit -n 9999
# Customize to your needs...
export GOPATH=~/go
ELM_PLAT_PATH=~/code/Elm-Platform/0.15.1/.cabal-sandbox/bin

export PATH=$GOPATH\
:$GOPATH/bin\
:$ELM_PLAT_PATH\
:$HOME/bin\
:/usr/local/sbin\
:/usr/local/bin\
:~/.local/bin\
:~/bin\
:/usr/local/share/npm/bin\
:$HOME/Library/Haskell/bin\
:$PATH

export NODE_REPL_HISTORY_SIZE=10000

# Path to your oh-my-zsh configuration.
ZSH=$HOME/.oh-my-zsh

# Set name of the theme to load.
# Look in ~/.oh-my-zsh/themes/
# Optionally, if you set this to "random", it'll load a random theme each
# time that oh-my-zsh is loaded.
ZSH_THEME="powerlevel10k/powerlevel10k"

fpath=(~/.zsh/completion $fpath)
fpath+=${ZSH_CUSTOM:-${ZSH:-~/.oh-my-zsh}/custom}/plugins/zsh-completions/src


# Example aliases
# alias zshconfig="mate ~/.zshrc"
# alias ohmyzsh="mate ~/.oh-my-zsh"

# Set to this to use case-sensitive completion
# CASE_SENSITIVE="true"

# Set to this to have history ignore commands prepended with a space
HIST_IGNORE_SPACE="true"

# Comment this out to disable bi-weekly auto-update checks
# DISABLE_AUTO_UPDATE="true"

# Uncomment to change how often before auto-updates occur? (in days)
export UPDATE_ZSH_DAYS=13

# Uncomment following line if you want to disable colors in ls
# DISABLE_LS_COLORS="true"

# Uncomment following line if you want to disable autosetting terminal title.
# DISABLE_AUTO_TITLE="true"

# Uncomment following line if you want to disable command autocorrection
# DISABLE_CORRECTION="true"

# Uncomment following line if you want red dots to be displayed while waiting for completion
COMPLETION_WAITING_DOTS="true"

# Uncomment following line if you want to disable marking untracked files under
# VCS as dirty. This makes repository status check for large repositories much,
# much faster.
# DISABLE_UNTRACKED_FILES_DIRTY="true"

# Which plugins would you like to load? (plugins can be found in ~/.oh-my-zsh/plugins/*)
# Custom plugins may be added to ~/.oh-my-zsh/custom/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
plugins=(zsh-syntax-highlighting zsh-autosuggestions asdf)

source $ZSH/oh-my-zsh.sh
[[ -f /opt/homebrew/bin/brew ]] && eval "$(/opt/homebrew/bin/brew shellenv)"

# No sudo on npm -- run once
  # sudo chown -R $USER /usr/local

source ~/dotfiles/zshrc.sh
source ~/dotfiles/.exports
source ~/dotfiles/.functions
source ~/dotfiles/.aliases
source ~/dotfiles/.fzf_aliases
source ~/dotfiles/.extras
# source ~/.fresh/build/shell.sh
###################################

###
#  CJ's shortcuts
###

## Keyboard
# `CAPSLock` remapped to be a second `Ctrl`
# `cmd` + `alt` + `⬆`                => current window, max size
# `cmd` + `alt` + `⬅`                => current window, 1/2 size, left
# `cmd` + `alt` + `➜`                 => current window, 1/2 size, right
# `ctrl` + `shift` + ( `⬅` || `➜` )  => OSX-native, change desktops
#


ext-ip () { curl http://ipecho.net/plain; echo; }



### Added by the Heroku Toolbelt
export PATH="/usr/local/heroku/bin:$PATH"
###-begin-npm-completion-###
#
# npm command completion script
#
# Installation: npm completion >> ~/.bashrc  (or ~/.zshrc)
# Or, maybe: npm completion > /usr/local/etc/bash_completion.d/npm
#

COMP_WORDBREAKS=${COMP_WORDBREAKS/=/}
COMP_WORDBREAKS=${COMP_WORDBREAKS/@/}
export COMP_WORDBREAKS

if type complete &>/dev/null; then
  _npm_completion () {
    local si="$IFS"
    IFS=$'\n' COMPREPLY=($(COMP_CWORD="$COMP_CWORD" \
                           COMP_LINE="$COMP_LINE" \
                           COMP_POINT="$COMP_POINT" \
                           npm completion -- "${COMP_WORDS[@]}" \
                           2>/dev/null)) || return $?
    IFS="$si"
  }
  complete -F _npm_completion npm
elif type compdef &>/dev/null; then
  _npm_completion() {
    si=$IFS
    compadd -- $(COMP_CWORD=$((CURRENT-1)) \
                 COMP_LINE=$BUFFER \
                 COMP_POINT=0 \
                 npm completion -- "${words[@]}" \
                 2>/dev/null)
    IFS=$si
  }
  compdef _npm_completion npm
elif type compctl &>/dev/null; then
  _npm_completion () {
    local cword line point words si
    read -Ac words
    read -cn cword
    let cword-=1
    read -l line
    read -ln point
    si="$IFS"
    IFS=$'\n' reply=($(COMP_CWORD="$cword" \
                       COMP_LINE="$line" \
                       COMP_POINT="$point" \
                       npm completion -- "${words[@]}" \
                       2>/dev/null)) || return $?
    IFS="$si"
  }
  compctl -K _npm_completion npm
fi
###-end-npm-completion-###
###-begin-pm2-completion-###
### credits to npm for the completion file model
#
# Installation: pm2 completion >> ~/.bashrc  (or ~/.zshrc)
#

COMP_WORDBREAKS=${COMP_WORDBREAKS/=/}
COMP_WORDBREAKS=${COMP_WORDBREAKS/@/}
export COMP_WORDBREAKS

if type complete &>/dev/null; then
  _pm2_completion () {
    local si="$IFS"
    IFS=$'\n' COMPREPLY=($(COMP_CWORD="$COMP_CWORD" \
                           COMP_LINE="$COMP_LINE" \
                           COMP_POINT="$COMP_POINT" \
                           pm2 completion -- "${COMP_WORDS[@]}" \
                           2>/dev/null)) || return $?
    IFS="$si"
  }
  complete -o default -F _pm2_completion pm2
elif type compctl &>/dev/null; then
  _pm2_completion () {
    local cword line point words si
    read -Ac words
    read -cn cword
    let cword-=1
    read -l line
    read -ln point
    si="$IFS"
    IFS=$'\n' reply=($(COMP_CWORD="$cword" \
                       COMP_LINE="$line" \
                       COMP_POINT="$point" \
                       pm2 completion -- "${words[@]}" \
                       2>/dev/null)) || return $?
    IFS="$si"
  }
  compctl -K _pm2_completion + -f + pm2
fi
###-end-pm2-completion-###

export PATH="$HOME/.yarn/bin:$PATH"

# fnm
export PATH=~/.fnm:$PATH
[ -x "$(command -v fnm)" ] && eval "$(fnm env --use-on-cd)"


# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/dotfiles/.p10k.zsh ]] || source ~/dotfiles/.p10k.zsh

[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh
# asdf
# already handled by oh-my-zsh
# [ -f /opt/homebrew/opt/asdf/libexec/asdf.sh ] && source /opt/homebrew/opt/asdf/libexec/asdf.sh

# asdf plugins
[ -f ~/.asdf/plugins/java/set-java-home.zsh ] && . ~/.asdf/plugins/java/set-java-home.zsh

typeset -g POWERLEVEL9K_INSTANT_PROMPT=quiet

alias tmux="TERM=xterm-256color tmux"

# Brew completions
if type brew &>/dev/null
then
  FPATH="$(brew --prefix)/share/zsh/site-functions:${FPATH}"

  autoload -Uz compinit
  compinit
fi

[ -x "$(command -v kubectl)" ] && source <(kubectl completion zsh)

# bun completions
[ -s "/Users/cjw/.bun/_bun" ] && source "/Users/cjw/.bun/_bun"

# Added by Windsurf
export PATH="$HOME/.codeium/windsurf/bin:$PATH"
