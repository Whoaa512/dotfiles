# Customize to your needs...

export PATH=$HOME/bin:/usr/local/sbin:/usr/local/bin:$HOME/.rvm/bin:/usr/local/share/npm/bin:$HOME/Library/Haskell/bin:$PATH

source ~/.nvm/nvm.sh

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
plugins=(git)

source $ZSH/oh-my-zsh.sh
source $HOME/c_personal/Dropbox/devEnv/dotfiles/.tab.bash


# No sudo on npm -- run once
  # sudo chown -R $USER /usr/local

source ~/zshrc.sh
source ~/.aliases
source ~/.functions
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



# Handy functions
  findit() {
    grep -iHR $1 .
  }

  replacefilename () {
    original_name="$1"
    new_name="$2"
    # original line from StackOverflow
    # find . -depth -name "*foo.*" -execdir bash -c 'mv -i "$1" "${1//foo/bar}"' bash {} \;
    find . -depth -name "*$original_name*" -execdir bash -c 'mv -i "$1" "${1//$original_name/$new_name}"' bash {} \;
  }

  # gcm() { # @todo
  #   git commit -m "$1"
  # }

stashgrep() {
  for i in `git stash list |  awk -F ':' '{print $1}'`; git stash show -p $i | grep -H --label="$i" "$1"
}

# Work functions
lastfails() {
  rsync -avz -e ssh carey.winslow@10.150.4.21:/home/docusign/jenkins/workspace/Martini0_Auto_Deploy/jenkins-Martini0_Auto_Deploy-"$1"/test-results ~/rynced_copies/jenkins-Martini0_Auto_Deploy-"$1";
  open -a /Applications/Google\ Chrome\ Canary.app "file://localhost/Users/carey.winslow/rynced_copies/jenkins-Martini0_Auto_Deploy-$1/test-results";
}
lastfailsacc() {
  rsync -avz -e ssh root@10.10.50.25:/home/docusign/saved-test-results/build_jenkins-Martini_Acceptance_Test-"$1" ~/rynced_copies;
  open -a /Applications/Google\ Chrome\ Canary.app "file://localhost/Users/carey.winslow/rynced_copies/build_jenkins-Martini_Acceptance_Test-$1";
}
lastfailswat() {
  rsync -avz -e ssh root@martini-ut0.docusignhq.com:/home/docusign/saved-test-results/build_jenkins-Martini0_Deploy-"$1" ~/rynced_copies;
  open -a /Applications/Google\ Chrome\ Canary.app "file://localhost/Users/carey.winslow/rynced_copies/build_jenkins-Martini0_Deploy-$1";
}



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
  alias o.='open .'
  alias l='ls -al'
  alias ll='ls -l'
  alias t='tree'
  alias sz='s ~/.zshrc'
  alias szh='s ~/.zsh_history'
  alias srz='source ~/.zshrc'
  alias sbp='s ~/.bash_profile'

# Short Git aliases
  alias gi='git init'
  alias gir='git init; touch README.md;gaa;'
  alias gii='git init; touch .gitignore;gaa;'
  alias giir='git init; touch .gitignore README.md;gaa;'
  alias inm='echo "node_modules/" >> .gitignore'
  alias gs='git status'
  alias gss='git status -s'
  alias ghis='git log --pretty=format:"%h %ad | %s%d [%an]" --graph --date=short'
  alias gst='git stash'
  alias gstl='git stash list'
  alias gsta='git stash apply'
  alias gstp='git stash --patch'
  alias ga='git add'
  alias gap='git add -p'
  alias gaa='git add .;gss'
  alias gre='git reset'
  alias gmm='git mv'
  alias grm='git rm'
  alias grmf='git rm -f'
  alias grmrf='git rm -rf'
  alias grmdel='git rm $(git ls-files --deleted)'
  alias gb='git branch'
  alias gcl='git clone'
  alias gclr='git clone --recursive'
  alias gc='git commit'
  alias gcm='git commit -m'
  alias gcam='git commit --amend -m'
  alias gco='git checkout'
  alias gcob='git checkout -b'
  alias gd='git diff'
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


# Common cd for convenience
  alias cc='~/c_personal/Dropbox/devWork/code'
  alias cce='~/c_personal/Dropbox/devWork/code/elm'
  alias cn='~/c_personal/Dropbox/devWork/nonCodeProjects'
  alias cw='~/work'
  alias cwj='~/work/code_work/jeeves'
  alias cwc='~/work/code_work'
  alias cwa='~/work/app'
  alias cwad='~/work/devApp'
  alias cwt='~/work/testApp'
  alias cwas='~/work/code_work/edited_account_creation_scripts'
  alias ccp='~/c_personal'
  alias d='cd ~/c_personal/Dropbox'
  alias nw='/Applications/node-webkit.app/Contents/MacOS/node-webkit'

########### appended aliases
  alias met='meteor'
  alias metls='meteor list'
  alias metlu='meteor list --using'
  alias npm='npm substack'
  alias ni='npm i'
  alias nis='npm i --save'
  alias nisd='npm i --save-dev'
  alias nodeh='node --harmony'
  alias chr='open -a /Applications/Google\ Chrome\ Canary.app'
