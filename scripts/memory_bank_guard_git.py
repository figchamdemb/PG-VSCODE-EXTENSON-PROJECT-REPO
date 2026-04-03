from __future__ import annotations

import subprocess
from pathlib import Path


def run_git(root: Path, args: list[str]) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


def collect_git_paths(root: Path, args: list[str]) -> list[str]:
    out = run_git(root, args)
    if not out:
        return []
    prefix = run_git(root, ["rev-parse", "--show-prefix"]).strip().replace("\\", "/")
    if prefix and not prefix.endswith("/"):
        prefix += "/"
    results: list[str] = []
    for raw in out.splitlines():
        path = raw.strip().replace("\\", "/")
        if not path:
            continue
        if prefix:
            if not path.startswith(prefix):
                continue
            path = path[len(prefix):]
        if path.startswith("../") or not path:
            continue
        results.append(path)
    return results


def changed_files(root: Path, scope: str) -> list[str]:
    if scope == "working-tree":
        combined: set[str] = set()
        commands = [
            ["diff", "--name-only", "--diff-filter=ACMR"],
            ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
            ["ls-files", "--others", "--exclude-standard"],
        ]
        for command in commands:
            combined.update(collect_git_paths(root, command))
        return sorted(combined)
    return collect_git_paths(root, ["diff", "--cached", "--name-only", "--diff-filter=ACMR"])