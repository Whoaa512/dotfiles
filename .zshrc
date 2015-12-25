ulimit -n 9999
# Customize to your needs...
export GOPATH=~/go
ELM_PLAT_PATH=~/code/Elm-Platform/0.15.1/.cabal-sandbox/bin

export PATH=$GOPATH:$ELM_PLAT_PATH:$HOME/bin:/usr/local/sbin:/usr/local/bin:/usr/local/share/npm/bin:$HOME/Library/Haskell/bin:$PATH


# Path to your oh-my-zsh configuration.
ZSH=$HOME/.oh-my-zsh

# Set name of the theme to load.
# Look in ~/.oh-my-zsh/themes/
# Optionally, if you set this to "random", it'll load a random theme each
# time that oh-my-zsh is loaded.
ZSH_THEME="cloud"

# fpath=(~/.zsh/completion $fpath)

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
plugins=(git browse-commit)

source $ZSH/oh-my-zsh.sh

# No sudo on npm -- run once
  # sudo chown -R $USER /usr/local

source ~/dotfiles/zshrc.sh
source ~/dotfiles/.aliases
source ~/dotfiles/.functions
source ~/dotfiles/.extra
source ~/.fresh/build/shell.sh
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


# Alias vi => vim
  alias vi='vim'

# Bash Aliases
  alias wh='which'
  alias c='clear'
  alias k='clear'
  alias rmrf='rm -rf'
  alias tczf='tar czf'
  alias s='subl'
  alias s.='subl .'
  alias l='ls -al'
  alias ll='ls -l'
  alias t='tree'
  alias se='subl ~/dotfiles/.extras'
  alias sf='subl ~/dotfiles/.functions'
  alias sz='subl ~/.zshrc'
  alias szh='subl ~/.zsh_history'
  alias srz='source ~/.zshrc'
  alias st3='cd ~/Library/Application\ Support/Sublime\ Text\ 3/'
  alias sbp='subl ~/.bash_profile'
  alias sj='subl "~/personal/Google Drive/journal.md"'
  alias ssh_='sshrc'

# Short Git aliases
  alias gi='git init'
  alias gir='git init; touch README.md;gaa;'
  alias gii='git init; touch .gitignore;gaa;'
  alias giir='git init; touch .gitignore README.md; echo "node_modules/\ncoverage/" > .gitignore;gaa;'
  alias inm='echo "node_modules/" >> .gitignore'
  alias gs='git status'
  alias gss='git status -s'
  alias ghis='git log --pretty=format:"%h %ad | %s%d [%an]" --graph --date=short'
  alias gst='git stash'
  alias gstl='git stash list'
  alias gsta='git stash apply'
  alias gstp='git stash save --patch'
  alias ga='git add'
  alias gap='git add -p'
  alias gaa='git add .;gss'
  alias gre='git reset'
  alias greh='git reset --h'
  alias gmff='git merge --ff'
  alias gmv='git mv'
  alias grm='git rm'
  alias grmf='git rm -f'
  alias grmrf='git rm -rf'
  alias grmdel='git rm $(git ls-files --deleted)'
  alias gb='git branch'
  alias gcfg='git config'
  alias gcl=clonecd
  alias gclr='git clone --recursive'
  alias gc='git commit'
  alias gc!='git commit --amend'
  alias gcm='git commit -v -m'
  alias gcam='git commit -v --amend -m'
  alias gco='git checkout'
  alias gcob='git checkout -b'
  alias gcop='git checkout -p'
  alias gclean='git clean '
  alias gd='git diff'
  alias gdc='git diff --cached'
  alias gdh='git diff head'
  alias gf='git fetch'
  alias gl='git log --oneline'
  alias gll='git log'
  alias gpl='git pull'
  alias gplr='git pull --rebase'
  alias gplro='git pull --rebase origin'
  alias gplru='git pull --rebase upst'
  alias gplrom='git pull --rebase origin master'
  alias gplrogh='git pull --rebase origin gh-pages'
  alias gplrod='git pull --rebase origin develop; gsu'
  alias gplrum='git pull --rebase upst master'
  alias gplrugh='git pull --rebase upst gh-pages'
  alias gplrud='git pull --rebase upst develop'
  alias gplo='git pull origin'
  alias gplom='git pull origin master'
  alias gplod='git pull origin develop'
  alias gplu='git pull upst'
  alias gplum='git pull upst master'
  alias gplud='git pull upst develop'
  alias gp='git push'
  alias gpo='git push origin'
  alias gpodel='git push origin --delete'
  alias gpu='git push upst'
  alias gpfom='git push -f origin master'
  alias gpom='git push origin master'
  alias gpod='git push origin develop'
  alias gpogh='git push origin gh-pages'
  alias gpum='git push upst master'
  alias gpud='git push upst develop'
  alias gpugh='git push upst gh-pages'
  alias grb='git rebase'
  alias grbc='git rebase --continue'
  alias gr='git remote'
  alias gra='git remote add'
  alias grao='git remote add origin'
  alias grau='git remote add upst'
  alias grr='git remote rm'
  alias grro='git remote rm origin'
  alias grru='git remote rm upst'
  alias grv='git remote -v'
  alias gsu='git submodule update --init --recursive'
  alias gsuc='git submodule update --init --recursive --checkout'
  alias gsur='git submodule update --init --recursive --rebase'
  alias gba='git branch -a'
  alias del='git branch -d'

# Work aliases
  alias glint='grunt parallelize:coffeelint:app'
  alias tb='coffee ./run-tests.coffee "*" -l smoke --to 80000'
  alias lf='lastfails'
  alias lfa='lastfailsacc'
  alias lfw='lastfailswat'
  alias mm='coffee ./run-tests.coffee'
  alias mw='coffee ./run-tests.coffee -a wwwstage'
  alias az1='ssh carey.winslow@10.150.4.21'
  alias az2='ssh carey.winslow@10.150.4.42'
  alias tanq='ssh carey.winslow@tanqueray.docusignhq.com'
  # use az2
  #   su - docusign
  #   ssh ec2-jenkins01


# Common cd for convenience
  alias cc='cd ~/personal/Dropbox/devWork/code'
  alias cce='cd ~/personal/Dropbox/devWork/code/elm'
  alias cn='cd ~/personal/Dropbox/devWork/nonCodeProjects'
  alias cw='cd ~/work'
  alias cwa='cd ~/work/app'
  alias cwad='cd ~/work/devApp'
  alias cwar='cd ~/work/code_work/aperture-rift'
  alias cwarf='cd ~/work/code_work/aperture-rift/dev-portal'
  alias cwd='cd ~/work/debugApp'
  alias cwas='cd ~/work/code_work/edited_account_creation_scripts'
  alias cwc='cd ~/work/code_work'
  alias cwf='cd ~/work/code_work/flo'
  alias cwj='cd ~/work/code_work/jeeves'
  alias cwo='cd ~/work/code_work/olive'
  alias cwn='cd ~/work/npmE-ds'
  alias cwr='cd ~/work/code_work/radmin'
  alias cco='cd ~/personal/Dropbox/devWork/open_source'
  alias ccm='cd ~/personal/Dropbox/devWork/code/node/modules'
  alias ccp='cd ~/personal'
  alias cws='cd ~/work/code_work/statsBoard'
  alias cwt='cd ~/work/testApp'
  alias cwb='cd ~/work/debugApp'
  alias cww='cd ~/work/code_work/wookie'
  alias csub='cd ~/Library/Application\ Support/Sublime\ Text\ 3/'
  alias d='cd ~/personal/Dropbox'
  alias p='cd ~/personal/Dropbox/devWork/code/node/projects'
  alias dot='cd ~/personal/Dropbox/devEnv/dotfiles'
  alias lew="cd ~/personal/Dropbox/devWork/code/node/projects/htmlLemmings/projects/lemmings"

  alias nw='/Applications/node-webkit.app/Contents/MacOS/node-webkit'

# npm aliases
  alias ni='npm i'
  alias nig='npm i -g'
  alias nupdate='npm i -g npm'
  alias nt='npm test'
  alias nr='npm run'
  alias nig='npm install -g'
  alias nis='npm install --save'
  alias nisd='npm install --save-dev'
  alias nus="npm uninstall $@ --save"
  alias nusd="npm uninstall $@ --save-dev"
  alias nise='npm i --save --save-exact'
  alias nisde='npm i --save-dev --save-exact'


########### appended aliases
  alias met='meteor'
  alias metls='meteor list'
  alias metlu='meteor list --using'
  # alias npm='npm substack'
  alias chr='open -a /Applications/Google\ Chrome\ Canary.app'

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
