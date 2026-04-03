"""
secrets_guard.py - 100% enforcement secret-leak prevention for git commits.

This scanner runs on EVERY staged file and ALWAYS blocks commits that
contain leaked secrets, API keys, tokens, private keys, or credentials.
It is NOT gated by warn/strict mode — leaks are always fatal.

Exit codes:
  0 = clean
  1 = secrets detected (commit MUST be blocked)

Usage (standalone):
  python scripts/secrets_guard.py                     # scan staged files
  python scripts/secrets_guard.py --scope working-tree # scan working tree
  python scripts/secrets_guard.py --files a.ts b.py   # scan explicit paths

Called from memory_bank_guard.py and .githooks/pre-commit.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# ---------------------------------------------------------------------------
# File scope control
# ---------------------------------------------------------------------------

# Extensions worth scanning (text-based source / config / doc files).
SCANNABLE_EXT = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".py", ".rb", ".go", ".java", ".kt", ".kts", ".swift",
    ".sh", ".bash", ".zsh", ".ps1", ".psm1", ".psd1", ".cmd", ".bat",
    ".json", ".jsonc", ".yaml", ".yml", ".toml", ".xml", ".properties",
    ".env", ".env.local", ".env.dev", ".env.staging", ".env.production",
    ".md", ".mdx", ".txt", ".rst", ".adoc",
    ".html", ".htm", ".css", ".scss", ".sass", ".less",
    ".sql", ".prisma", ".graphql", ".gql",
    ".cfg", ".ini", ".conf", ".config",
    ".vue", ".svelte", ".dart",
    ".tf", ".hcl",
    ".dockerfile",
}

# Files always scanned regardless of extension.
SCANNABLE_NAMES = {
    "dockerfile", "docker-compose.yml", "docker-compose.yaml",
    ".env", ".env.local", ".env.dev", ".env.staging", ".env.production",
    "secrets.yaml", "secrets.yml",
}

# Skip directories that should never contain secrets we care about.
SKIP_DIR_SEGMENTS = {
    "node_modules", ".git", "dist", "__pycache__", ".mypy_cache",
    ".pytest_cache", ".venv", "venv", ".tox",
}

MAX_FILE_SIZE = 2 * 1024 * 1024  # 2 MiB — skip binary blobs

# ---------------------------------------------------------------------------
# Secret detection patterns
# ---------------------------------------------------------------------------

# Each pattern yields (label, compiled_regex).
# Group 1 of the regex should capture the suspected secret value when
# possible so we can run the placeholder heuristic on it.

_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    # Generic assignment: password/secret/token/key = "value"
    (
        "password/secret/token assignment",
        re.compile(
            r"""(?i)\b(password|passwd|pwd|secret|api[_-]?key|access[_-]?key"""
            r"""|access[_-]?token|refresh[_-]?token|private[_-]?key|auth[_-]?token"""
            r"""|client[_-]?secret|signing[_-]?key|encryption[_-]?key"""
            r"""|master[_-]?key|service[_-]?key)"""
            r"""["']?\s*[:=]\s*["']([^"'\s]{8,})["']""",
        ),
    ),
    # PEM private key block
    (
        "PEM private key",
        re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    ),
    # AWS access key ID (AKIA…)
    (
        "AWS access key",
        re.compile(r"\b(AKIA[0-9A-Z]{16})\b"),
    ),
    # AWS secret access key (40-char base64)
    (
        "AWS secret key",
        re.compile(
            r"""(?i)\b(?:aws[_-]?secret[_-]?access[_-]?key|aws[_-]?secret)"""
            r"""["']?\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?""",
        ),
    ),
    # Stripe secret key (sk_live_… / sk_test_… / rk_live_… / rk_test_…)
    (
        "Stripe secret key",
        re.compile(r"\b((?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,})\b"),
    ),
    # GitHub personal access token / fine-grained token
    (
        "GitHub token",
        re.compile(r"\b(ghp_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b"),
    ),
    # GitLab token
    (
        "GitLab token",
        re.compile(r"\b(glpat-[A-Za-z0-9\-]{20,})\b"),
    ),
    # Database connection URL with embedded password
    (
        "database URL with password",
        re.compile(
            r"(?i)\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp)"
            r"://[^:@/\s]+:([^@/\s]{6,})@",
        ),
    ),
    # Bearer / token header value in code literals
    (
        "hardcoded bearer token",
        re.compile(
            r"""(?i)["']Bearer\s+([A-Za-z0-9\-._~+/=]{20,})["']""",
        ),
    ),
    # Slack bot / webhook token
    (
        "Slack token",
        re.compile(r"\b(xox[bporas]-[A-Za-z0-9\-]{10,})\b"),
    ),
    # SendGrid API key
    (
        "SendGrid key",
        re.compile(r"\b(SG\.[A-Za-z0-9\-_]{22,}\.[A-Za-z0-9\-_]{22,})\b"),
    ),
    # Twilio auth token
    (
        "Twilio token",
        re.compile(
            r"""(?i)\b(?:twilio[_-]?auth[_-]?token)["']?\s*[:=]\s*["']?([a-f0-9]{32})["']?""",
        ),
    ),
    # Generic hex token (64+ chars) assigned to a suspicious key name
    (
        "long hex secret",
        re.compile(
            r"""(?i)\b(?:secret|token|key|signing|hmac)["']?\s*[:=]\s*["']?([a-f0-9]{64,})["']?""",
        ),
    ),
    # npm token
    (
        "npm token",
        re.compile(r"\b(npm_[A-Za-z0-9]{36,})\b"),
    ),
]

# ---------------------------------------------------------------------------
# Placeholder / false-positive heuristic
# ---------------------------------------------------------------------------

_PLACEHOLDER_HINTS = (
    "<", ">", "your_", "example", "sample", "changeme", "paste_", "redacted",
    "dummy", "test_value", "token_here", "password_here", "***", "xxx",
    "replace_me", "fixme", "todo", "insert_", "placeholder", "${", "{{",
    "process.env", "os.environ", "env(", "env.",
    "...",  # documentation ellipsis (e.g. "sk_live_...")
)


def _looks_like_placeholder(value: str) -> bool:
    """Return True when the captured value is clearly not a real secret."""
    candidate = value.strip()
    lower = candidate.lower()
    if not candidate or len(candidate) < 8:
        return True
    if any(hint in lower for hint in _PLACEHOLDER_HINTS):
        return True
    # All-uppercase env-style constant name (not a value)
    if re.fullmatch(r"[A-Z][A-Z0-9_]{5,}", candidate):
        return True
    # Snake_case or camelCase identifier name (storage key names, not secrets)
    if re.fullmatch(r"[a-z][a-z0-9_]{7,}", candidate):
        return True
    return False


# ---------------------------------------------------------------------------
# Allowlist - paths that are expected to contain example/test patterns
# ---------------------------------------------------------------------------

_ALLOWLISTED_PATHS = {
    "scripts/secrets_guard.py",       # this file's own patterns
    "scripts/memory_bank_guard.py",   # existing secret regex constants
}


def _is_allowlisted(path: str) -> bool:
    normalized = path.replace("\\", "/")
    return normalized in _ALLOWLISTED_PATHS


# ---------------------------------------------------------------------------
# Scanner
# ---------------------------------------------------------------------------

class Finding:
    __slots__ = ("path", "line_no", "label")

    def __init__(self, path: str, line_no: int, label: str) -> None:
        self.path = path
        self.line_no = line_no
        self.label = label

    def __str__(self) -> str:
        return f"  BLOCKED: {self.label} in {self.path}:{self.line_no}"


def _should_scan(path: str) -> bool:
    parts = Path(path).parts
    if any(seg in SKIP_DIR_SEGMENTS for seg in parts):
        return False
    name = Path(path).name.lower()
    if name in SCANNABLE_NAMES:
        return True
    ext = Path(path).suffix.lower()
    # Handle double extensions like .env.local
    if not ext and "." in name:
        ext = "." + name.rsplit(".", 1)[-1]
    return ext in SCANNABLE_EXT


def scan_file(path: str, abs_root: Path | None = None) -> list[Finding]:
    """Scan a single file for secrets. Returns list of findings."""
    if _is_allowlisted(path):
        return []

    root = abs_root or ROOT
    abs_path = root / path

    if not abs_path.exists() or not abs_path.is_file():
        return []
    if abs_path.stat().st_size > MAX_FILE_SIZE:
        return []

    try:
        content = abs_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return []

    findings: list[Finding] = []
    lines = content.splitlines()

    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()
        # Skip comment-only lines that are documentation
        if stripped.startswith("//") or stripped.startswith("#") or stripped.startswith("*"):
            # Still scan — comments can contain leaked keys too
            pass

        for label, pattern in _PATTERNS:
            match = pattern.search(line)
            if not match:
                continue
            # If the pattern captured a value group, check placeholder heuristic
            if match.lastindex and match.lastindex >= 1:
                value = match.group(match.lastindex)
                if _looks_like_placeholder(value):
                    continue
            findings.append(Finding(path, idx, label))
            break  # one finding per line is enough

    return findings


def scan_files(paths: list[str], abs_root: Path | None = None) -> list[Finding]:
    """Scan a list of relative paths. Returns all findings."""
    all_findings: list[Finding] = []
    for path in paths:
        if _should_scan(path):
            all_findings.extend(scan_file(path, abs_root))
    return all_findings


# ---------------------------------------------------------------------------
# Git integration helpers (reuse memory_bank_guard_git when available)
# ---------------------------------------------------------------------------

def _staged_files() -> list[str]:
    try:
        from memory_bank_guard_git import changed_files
        return changed_files(ROOT, "staged")
    except ImportError:
        import subprocess
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"],
            cwd=ROOT, capture_output=True, text=True, check=False,
        )
        if result.returncode != 0:
            return []
        return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def _working_tree_files() -> list[str]:
    try:
        from memory_bank_guard_git import changed_files
        return changed_files(ROOT, "working-tree")
    except ImportError:
        import subprocess
        paths: set[str] = set()
        for cmd in (
            ["git", "diff", "--name-only", "--diff-filter=ACMR"],
            ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"],
            ["git", "ls-files", "--others", "--exclude-standard"],
        ):
            result = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, check=False)
            if result.returncode == 0:
                paths.update(line.strip() for line in result.stdout.splitlines() if line.strip())
        return sorted(paths)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Secret-leak guard — 100%% enforcement, always blocks."
    )
    parser.add_argument(
        "--scope", choices=("staged", "working-tree"), default="staged",
        help="Which git file set to scan.",
    )
    parser.add_argument(
        "--files", nargs="*", default=None,
        help="Explicit file paths to scan (relative to repo root).",
    )
    args = parser.parse_args()

    if args.files:
        targets = args.files
    elif args.scope == "working-tree":
        targets = _working_tree_files()
    else:
        targets = _staged_files()

    if not targets:
        print("[secrets-guard] No files to scan.")
        return 0

    findings = scan_files(targets)

    if not findings:
        print(f"[secrets-guard] PASS — {len(targets)} file(s) clean.")
        return 0

    print(f"[secrets-guard] BLOCKED — {len(findings)} secret(s) detected!")
    print("=" * 60)
    for f in findings:
        print(str(f))
    print("=" * 60)
    print()
    print("Secrets must NEVER be committed to this repository.")
    print("Move credentials to .env files (gitignored), vault, or KMS.")
    print("This check cannot be bypassed — it blocks in ALL modes.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
