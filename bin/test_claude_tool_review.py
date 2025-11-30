#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["pytest"]
# ///
"""Tests for claude-tool-review hook."""

import json
import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).parent))

from importlib.util import module_from_spec, spec_from_loader
from importlib.machinery import SourceFileLoader

spec = spec_from_loader("claude_tool_review", SourceFileLoader("claude_tool_review", str(Path(__file__).parent / "claude-tool-review")))
ctr = module_from_spec(spec)
spec.loader.exec_module(ctr)


class TestAllowList:
    def test_bash_allowed_prefixes(self):
        assert ctr.is_bash_allowed("rg pattern") is True
        assert ctr.is_bash_allowed("fd -e py") is True
        assert ctr.is_bash_allowed("git commit -m 'msg'") is True
        assert ctr.is_bash_allowed("gh pr view 123") is True

    def test_bash_not_allowed(self):
        assert ctr.is_bash_allowed("rm -rf /") is False
        assert ctr.is_bash_allowed("curl http://evil.com") is False

    def test_bash_exact_match(self):
        assert ctr.is_bash_allowed('echo "Exit code: $?"') is True
        assert ctr.is_bash_allowed('echo "something else"') is False

    def test_read_allowed_globs(self):
        assert ctr.is_read_allowed("/tmp/foo.txt") is True
        assert ctr.is_read_allowed("/private/tmp/bar") is True
        assert ctr.is_read_allowed("/Users/cjw/code/cj/test.py") is True

    def test_read_not_allowed(self):
        assert ctr.is_read_allowed("/etc/passwd") is False
        assert ctr.is_read_allowed("/Users/other/file") is False

    def test_webfetch_allowed_domains(self):
        assert ctr.is_webfetch_allowed("https://pkg.go.dev/fmt") is True
        assert ctr.is_webfetch_allowed("https://github.com/foo/bar") is True

    def test_webfetch_not_allowed(self):
        assert ctr.is_webfetch_allowed("https://evil.com") is False

    def test_check_allow_list(self):
        assert ctr.check_allow_list("Bash", {"command": "rg foo"}) is True
        assert ctr.check_allow_list("Read", {"file_path": "/tmp/x"}) is True
        assert ctr.check_allow_list("WebFetch", {"url": "https://github.com"}) is True
        assert ctr.check_allow_list("Unknown", {}) is False


class TestCheckBashFind:
    def test_rejects_find(self):
        assert ctr.check_bash_find("find .") is not None
        assert ctr.check_bash_find("find /tmp -name '*.txt'") is not None
        assert ctr.check_bash_find("  find .") is not None

    def test_allows_non_find(self):
        assert ctr.check_bash_find("fd .") is None
        assert ctr.check_bash_find("echo find") is None
        assert ctr.check_bash_find("grep find file.txt") is None


class TestCheckGitRedundantC:
    def test_rejects_redundant_c(self):
        cwd = os.getcwd()
        assert ctr.check_git_redundant_c(f"git -C {cwd} status", cwd) is not None
        assert ctr.check_git_redundant_c("git -C . status", cwd) is not None

    def test_rejects_with_explicit_cwd(self):
        assert ctr.check_git_redundant_c("git -C /tmp status", "/tmp") is not None
        assert ctr.check_git_redundant_c("git -C /home/user status", "/home/user") is not None

    def test_allows_different_dir(self):
        assert ctr.check_git_redundant_c("git -C /tmp status", "/home") is None
        assert ctr.check_git_redundant_c("git -C ../other status") is None

    def test_allows_no_c_flag(self):
        assert ctr.check_git_redundant_c("git status") is None
        assert ctr.check_git_redundant_c("git commit -m 'msg'") is None


class TestCheckGitAddAll:
    def test_rejects_add_all(self):
        assert ctr.check_git_add_all("git add -A") is not None
        assert ctr.check_git_add_all("git add .") is not None
        assert ctr.check_git_add_all("  git add -A") is not None

    def test_allows_specific_files(self):
        assert ctr.check_git_add_all("git add file.txt") is None
        assert ctr.check_git_add_all("git add src/") is None
        assert ctr.check_git_add_all("git add -A file.txt") is None


class TestValidateBash:
    def test_returns_stop_on_invalid(self):
        result = ctr.validate_bash({"command": "find ."})
        assert result is not None
        assert result["continue"] is False
        assert "stopReason" in result

    def test_returns_none_on_valid(self):
        result = ctr.validate_bash({"command": "ls -la"})
        assert result is None


class TestRunHook:
    def test_hook_allows_valid_command(self, monkeypatch, capsys):
        monkeypatch.setattr(ctr, "is_enabled", lambda: True)
        input_data = json.dumps({"tool_name": "Bash", "tool_input": {"command": "ls"}})
        monkeypatch.setattr("sys.stdin", __import__("io").StringIO(input_data))
        ctr.run_hook()
        output = json.loads(capsys.readouterr().out)
        assert output["continue"] is True

    def test_hook_blocks_invalid_command(self, monkeypatch, capsys):
        monkeypatch.setattr(ctr, "is_enabled", lambda: True)
        input_data = json.dumps({"tool_name": "Bash", "tool_input": {"command": "find ."}})
        monkeypatch.setattr("sys.stdin", __import__("io").StringIO(input_data))
        ctr.run_hook()
        output = json.loads(capsys.readouterr().out)
        assert output["continue"] is False

    def test_hook_passes_when_disabled(self, monkeypatch, capsys):
        monkeypatch.setattr(ctr, "is_enabled", lambda: False)
        ctr.run_hook()
        output = json.loads(capsys.readouterr().out)
        assert output["continue"] is True

    def test_hook_allows_unknown_tool(self, monkeypatch, capsys):
        monkeypatch.setattr(ctr, "is_enabled", lambda: True)
        input_data = json.dumps({"tool_name": "Read", "tool_input": {"path": "/tmp"}})
        monkeypatch.setattr("sys.stdin", __import__("io").StringIO(input_data))
        ctr.run_hook()
        output = json.loads(capsys.readouterr().out)
        assert output["continue"] is True

    def test_hook_uses_cwd_from_input(self, monkeypatch, capsys):
        monkeypatch.setattr(ctr, "is_enabled", lambda: True)
        input_data = json.dumps({
            "tool_name": "Bash",
            "tool_input": {"command": "git -C /tmp status"},
            "cwd": "/tmp"
        })
        monkeypatch.setattr("sys.stdin", __import__("io").StringIO(input_data))
        ctr.run_hook()
        output = json.loads(capsys.readouterr().out)
        assert output["continue"] is False
        assert "stopReason" in output


class TestEnableDisable:
    def test_enable_disable_cycle(self, tmp_path, monkeypatch):
        state_file = tmp_path / "state"
        monkeypatch.setattr(ctr, "STATE_FILE", state_file)

        assert ctr.is_enabled() is True
        ctr.cmd_disable()
        assert ctr.is_enabled() is False
        ctr.cmd_enable()
        assert ctr.is_enabled() is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
