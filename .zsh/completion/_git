#compdef git gitk

# zsh completion wrapper for git
#
# You need git's bash completion script installed somewhere, by default on the
# same directory as this script.
#
# If your script is on ~/.git-completion.sh instead, you can configure it on
# your ~/.zshrc:
#
#  zstyle ':completion:*:*:git:*' script ~/.git-completion.sh
#
# The recommended way to install this script is to copy to
# '~/.zsh/completion/_git', and then add the following to your ~/.zshrc file:
#
#  fpath=(~/.zsh/completion $fpath)

complete ()
{
	# do nothing
	return 0
}

zstyle -s ":completion:*:*:git:*" script script
test -z "$script" && script="$(dirname ${funcsourcetrace[1]%:*})"/git-completion.bash
ZSH_VERSION='' . "$script"

_get_comp_words_by_ref ()
{
	emulate -L zsh
	while [ $# -gt 0 ]; do
		case "$1" in
		cur)
			cur=${_words[CURRENT]}
			;;
		prev)
			prev=${_words[CURRENT-1]}
			;;
		words)
			words=("${_words[@]}")
			;;
		cword)
			((cword = CURRENT - 1))
			;;
		esac
		shift
	done
}

__gitcompadd ()
{
	compadd -Q -S "$3" -P "$2" -p "${(M)cur#*[=:]}" -- ${=1} && _ret=0
}

__gitcomp ()
{
	local cur_="${3-$cur}"

	case "$cur_" in
	--*=)
		;;
	*)
		local IFS=$'\n'
		__gitcompadd "$(__gitcomp_1 "${1-}")" "${2-}" ""
		;;
	esac
}

__gitcomp_nl ()
{
	local IFS=$'\n'
	__gitcompadd "$1" "${2-}" "${4- }"
}

do_wrap ()
{
	typeset -f $1 | sed "s/${1} ()/${1}_wrap ()/"
}

eval "$(do_wrap _git)"
eval "$(do_wrap _gitk)"

_git ()
{
	local _ret=1
	local -a _words
	_words=( $words )
	() {
		emulate -L ksh
		typeset -h words
		_${service}_wrap
	}
	let _ret && _default -S '' && _ret=0
	return _ret
}

_git
