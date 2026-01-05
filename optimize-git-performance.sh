#!/bin/bash
# Git Performance Optimization Script
# Optimizes git operations for large repositories with many files
# 
# Usage: 
#   cd /path/to/large/repo
#   source ~/dotfiles/optimize-git-performance.sh
#   optimize_git_repo

optimize_git_repo() {
    echo "Optimizing git performance for large repository: $(pwd)"
    
    # Enable preload index for faster git operations
    # This preloads the git index into memory for better performance
    git config --local core.preloadindex true
    echo "✓ Enabled core.preloadindex"
    
    # Enable filesystem caching (works on macOS/Windows)
    # Caches filesystem metadata to reduce stat() calls
    git config --local core.fscache true
    echo "✓ Enabled core.fscache"
    
    # Enable untracked file caching 
    # Caches the list of untracked files to avoid expensive filesystem scans
    git config --local core.untrackedCache true
    echo "✓ Enabled core.untrackedCache"
    
    # Disable showing untracked files in git status by default
    # This prevents expensive directory traversals in large repos
    # Note: You can still see untracked files with 'git status -u'
    git config --local status.showUntrackedFiles no
    echo "✓ Disabled status.showUntrackedFiles (use 'git status -u' to see untracked)"
    
    echo ""
    echo "Git performance optimization complete!"
    echo "These settings only apply to this repository (stored in .git/config)"
    echo ""
    echo "To verify settings:"
    echo "  git config --local --list | grep -E '(preloadindex|fscache|untrackedCache|showUntrackedFiles)'"
}

# Function to revert optimizations if needed
revert_git_optimizations() {
    echo "Reverting git performance optimizations..."
    git config --local --unset core.preloadindex
    git config --local --unset core.fscache
    git config --local --unset core.untrackedCache
    git config --local --unset status.showUntrackedFiles
    echo "✓ Reverted all local git optimizations"
}

# Show current optimization status
show_git_optimizations() {
    echo "Current git optimizations for $(pwd):"
    echo "preloadindex: $(git config --local --get core.preloadindex || echo 'not set')"
    echo "fscache: $(git config --local --get core.fscache || echo 'not set')"
    echo "untrackedCache: $(git config --local --get core.untrackedCache || echo 'not set')"
    echo "showUntrackedFiles: $(git config --local --get status.showUntrackedFiles || echo 'not set')"
}