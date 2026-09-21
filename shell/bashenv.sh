# Sourced by non-interactive bash via BASH_ENV (agent tool shells: pi, Claude Code).
# Gives them mise's per-repo env (_.path tool-stubs etc.) that `mise activate --shims` alone skips.
command -v mise >/dev/null 2>&1 || return 0

__mise_env() { eval "$(mise env -s bash 2>/dev/null)"; }
__mise_env

cd() { builtin cd "$@" && __mise_env; }
