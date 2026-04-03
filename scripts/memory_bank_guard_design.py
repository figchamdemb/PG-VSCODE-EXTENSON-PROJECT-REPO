from __future__ import annotations

import re
from pathlib import Path

from memory_bank_guard_self_check import is_ui_impacting_change

DESIGN_DOC = Path("docs/FRONTEND_DESIGN_GUARDRAILS.md")
DESIGN_DOC_REQUIRED_PHRASES = (
    "similar patterns, not copied",
    "user-provided source overrides this default guide",
    ".btn-primary",
    "Dashboard Pattern",
    "Mobile Pattern Appendix",
    "Button Pattern Grammar",
    "translate the pattern grammar natively",
    "pattern library, not a single mandatory art direction",
    "Choose the closest approved pattern family",
)
REFERENCE_REQUIREMENTS = {
    Path("AGENTS.md"): "docs/FRONTEND_DESIGN_GUARDRAILS.md",
    Path("Memory-bank/coding-security-standards.md"): "docs/FRONTEND_DESIGN_GUARDRAILS.md",
    Path("Memory-bank/tools-and-commands.md"): "docs/FRONTEND_DESIGN_GUARDRAILS.md",
    Path("docs/PG_FIRST_RUN_GUIDE.md"): "docs/FRONTEND_DESIGN_GUARDRAILS.md",
}
STYLE_EXTENSIONS = {".css", ".scss", ".sass", ".less"}
MARKUP_EXTENSIONS = {".html", ".tsx", ".jsx", ".vue", ".svelte"}
INLINE_STYLE_RE = re.compile(r"style\s*=\s*(?:\"|\{)", re.IGNORECASE)
BUTTON_RE = re.compile(r"<button\b|<Button\b", re.IGNORECASE)
CONTROL_CLASS_RE = re.compile(
    r"(class|className)\s*=\s*[\"'][^\"']*(btn|button|action|chip|tab|field|select|input|cta)[^\"']*[\"']",
    re.IGNORECASE,
)
BUTTON_VARIANT_RE = re.compile(
    r"(class|className)\s*=\s*[\"'][^\"']*(primary|secondary|ghost|danger|destructive|fab|nav|approve|deny)[^\"']*[\"']",
    re.IGNORECASE,
)
LAYOUT_SIGNAL_RE = re.compile(
    r"(class|className)\s*=\s*[\"'][^\"']*(card|panel|section|sidebar|shell|hero|grid|nav|overview|dashboard|rail)[^\"']*[\"']",
    re.IGNORECASE,
)
TOKEN_SIGNAL_RE = re.compile(
    r"var\(--|--brand|--brand-dark|--accent|--radius|--line|--bg|--ink",
    re.IGNORECASE,
)


def validate_frontend_design_policy(
    repo_root: Path,
    code_changes: list[str],
) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    ui_changes = [path for path in code_changes if is_ui_impacting_change(path)]
    if not ui_changes:
        return errors, warnings

    errors.extend(validate_policy_docs(repo_root))
    for relative_path in ui_changes:
        errors.extend(validate_ui_file(repo_root, relative_path))
    return errors, warnings


def validate_policy_docs(repo_root: Path) -> list[str]:
    errors: list[str] = []
    design_doc_path = repo_root / DESIGN_DOC
    if not design_doc_path.exists():
        errors.append(
            "[UI-DES-001] UI changes require docs/FRONTEND_DESIGN_GUARDRAILS.md to exist."
        )
        return errors

    content = read_text_safe(design_doc_path)
    for phrase in DESIGN_DOC_REQUIRED_PHRASES:
        if phrase in content:
            continue
        errors.append(
            "[UI-DES-002] docs/FRONTEND_DESIGN_GUARDRAILS.md is missing a required policy phrase: "
            f"{phrase!r}."
        )

    for relative_path, required_text in REFERENCE_REQUIREMENTS.items():
        absolute_path = repo_root / relative_path
        if not absolute_path.exists():
            errors.append(
                f"[UI-DES-003] Required policy file is missing: {relative_path.as_posix()}."
            )
            continue
        if required_text in read_text_safe(absolute_path):
            continue
        errors.append(
            f"[UI-DES-004] {relative_path.as_posix()} must reference {required_text} "
            "for UI task enforcement."
        )
    return errors


def validate_ui_file(repo_root: Path, relative_path: str) -> list[str]:
    errors: list[str] = []
    absolute_path = repo_root / relative_path
    if not absolute_path.exists() or not absolute_path.is_file():
        return errors

    content = read_text_safe(absolute_path)
    lower = relative_path.lower()
    suffix = absolute_path.suffix.lower()

    if suffix in STYLE_EXTENSIONS:
        if not TOKEN_SIGNAL_RE.search(content):
            errors.append(
                f"[UI-DES-005] {relative_path} does not use shared design tokens "
                "(`var(--...)` / repo token names)."
            )
        return errors

    if not is_markup_like_file(lower, suffix):
        return errors

    inline_styles = len(INLINE_STYLE_RE.findall(content))
    if inline_styles > 2:
        errors.append(
            f"[UI-DES-006] {relative_path} uses too many inline style attributes "
            f"({inline_styles} > 2). Move styling into shared classes/CSS."
        )

    button_count = len(BUTTON_RE.findall(content))
    if button_count >= 2 and not CONTROL_CLASS_RE.search(content):
        errors.append(
            f"[UI-DES-007] {relative_path} renders multiple buttons without semantic "
            "button/action class naming."
        )

    if button_count >= 2 and not BUTTON_VARIANT_RE.search(content):
        errors.append(
            f"[UI-DES-009] {relative_path} renders multiple buttons without clear "
            "variant naming (primary/secondary/destructive/fab/nav)."
        )

    if is_major_surface(lower) and not LAYOUT_SIGNAL_RE.search(content):
        errors.append(
            f"[UI-DES-008] Major UI surface {relative_path} is missing semantic layout "
            "signals such as card/panel/section/sidebar/shell/grid classes."
        )

    return errors


def read_text_safe(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def is_markup_like_file(lower_path: str, suffix: str) -> bool:
    if suffix in MARKUP_EXTENSIONS:
        return True
    if lower_path.startswith("extension/src/ui/") and suffix in {".ts", ".js"}:
        return True
    return False


def is_major_surface(lower_path: str) -> bool:
    file_name = Path(lower_path).name
    return (
        lower_path.startswith("server/public/")
        or "/pages/" in lower_path
        or "/screens/" in lower_path
        or file_name in {"page.tsx", "page.jsx", "page.ts", "page.js"}
        or lower_path.startswith("extension/src/ui/")
    )
