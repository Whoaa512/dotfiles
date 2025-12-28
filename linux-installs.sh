#!/usr/bin/env bash

# Install command-line tools on Linux (Debian/Ubuntu)

set -e

# Ask for the administrator password upfront
sudo -v

# Keep-alive: update existing `sudo` time stamp until the script has finished
while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done 2>/dev/null &

echo "==> Updating apt..."
sudo apt-get update

# Core CLI tools via apt
echo "==> Installing apt packages..."
sudo apt-get install -y \
    curl \
    git \
    jq \
    unzip \
    build-essential

# fd (note: package is fd-find, binary is fdfind, we'll alias it)
echo "==> Installing fd..."
sudo apt-get install -y fd-find
# Create symlink so 'fd' works
sudo ln -sf "$(which fdfind)" /usr/local/bin/fd 2>/dev/null || true

# ripgrep
echo "==> Installing ripgrep..."
sudo apt-get install -y ripgrep

# bat (note: package is bat, but binary might be batcat on older Ubuntu)
echo "==> Installing bat..."
sudo apt-get install -y bat
# Create symlink if needed
if command -v batcat &>/dev/null && ! command -v bat &>/dev/null; then
    sudo ln -sf "$(which batcat)" /usr/local/bin/bat
fi

# eza (modern ls replacement, not in apt - install from GitHub releases)
echo "==> Installing eza..."
if ! command -v eza &>/dev/null; then
    EZA_VERSION=$(curl -s https://api.github.com/repos/eza-community/eza/releases/latest | jq -r '.tag_name' | tr -d 'v')
    curl -Lo /tmp/eza.tar.gz "https://github.com/eza-community/eza/releases/download/v${EZA_VERSION}/eza_x86_64-unknown-linux-gnu.tar.gz"
    sudo tar -xzf /tmp/eza.tar.gz -C /usr/local/bin
    rm /tmp/eza.tar.gz
fi


# mise (runtime version manager)
echo "==> Installing mise..."
if ! command -v mise &>/dev/null; then
    curl https://mise.run | sh
fi

# Ensure mise is in PATH for rest of script
export PATH="$HOME/.local/bin:$PATH"

# Install runtimes via mise
echo "==> Installing runtimes via mise..."
mise use -g go@latest
mise use -g node@lts
mise use -g rust@latest
mise use -g pnpm@latest
mise use -g python@3.13
mise use -g zig@latest

# Claude Code CLI
echo "==> Installing Claude Code..."
if ! command -v claude &>/dev/null; then
    npm install -g @anthropic-ai/claude-code
fi

echo ""
echo "==> Done!"
echo ""
echo "Add to your shell rc:"
echo '  eval "$(mise activate bash)"  # or zsh'
echo ""
echo "Then restart your shell or run: source ~/.bashrc"
