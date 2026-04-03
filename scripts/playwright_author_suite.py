from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

from playwright_author_templates import (
  ACCESSIBILITY_TEMPLATE,
  AUTH_TEMPLATE,
  COMMERCE_TEMPLATE,
  CONFIG_TEMPLATE,
  FORMS_TEMPLATE,
  HELPER_TEMPLATE,
  INPUT_HARDENING_TEMPLATE,
  ROUTES_TEMPLATE,
  SMOKE_TEMPLATE,
)

IGNORE_PARTS = {
    "node_modules",
    "dist",
    "build",
    "out",
    "coverage",
    "Memory-bank",
    ".git",
    ".next",
    "storybook-static",
    "android",
    "ios",
}
TEXT_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".html"}
ROUTE_PATTERNS = [
    re.compile(r"(?im)\bhref\s*[:=]\s*[\"'](?P<route>/[^\"']+?)[\"']"),
    re.compile(r"(?im)\bto\s*[:=]\s*[\"'](?P<route>/[^\"']+?)[\"']"),
    re.compile(r"(?im)\bpath\s*[:=]\s*[\"'](?P<route>/[^\"']+?)[\"']"),
    re.compile(r"(?im)\b(?:push|replace|goto)\(\s*[\"'](?P<route>/[^\"']+?)[\"']"),
]



def resolve_project_root(value: str) -> Path:
    if not value:
        return Path(__file__).resolve().parents[1]
    return Path(value).resolve()


def resolve_working_directory(project_root: Path, value: str) -> Path:
    if not value:
        return project_root
    candidate = Path(value)
    if not candidate.is_absolute():
        candidate = project_root / candidate
    return candidate.resolve()


def rel(path: Path, project_root: Path) -> str:
    try:
        return path.resolve().relative_to(project_root).as_posix()
    except Exception:
        return path.resolve().as_posix()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_text(path: Path, content: str) -> None:
    ensure_dir(path.parent)
    path.write_text(content, encoding="utf-8", newline="\n")


def load_manifest(working_directory: Path) -> dict | None:
    manifest_path = working_directory / "package.json"
    if not manifest_path.exists():
        return None
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        return None


def playwright_declared(manifest: dict | None) -> bool:
    if not manifest:
        return False
    for section_name in ("dependencies", "devDependencies"):
        section = manifest.get(section_name) or {}
        if "@playwright/test" in section:
            return True
    return False


def resolve_existing_config(working_directory: Path) -> Path | None:
    for name in ("playwright.config.ts", "playwright.config.js", "playwright.config.mjs", "playwright.config.cjs"):
        candidate = working_directory / name
        if candidate.exists():
            return candidate.resolve()
    return None


def normalize_route(route: str) -> str:
    route = (route or "").strip().replace("\\", "/")
    if not route or route.startswith(("http://", "https://")) or not route.startswith("/"):
        return ""
    route = re.sub(r"[?#].*$", "", route)
    route = re.sub(r"/{2,}", "/", route)
    if len(route) > 1:
        route = route.rstrip("/")
    if re.search(r"^/(api|assets|static|public)(/|$)", route):
        return ""
    if re.search(r"[*:\[\]{}$]", route):
        return ""
    if re.search(r"\.[A-Za-z0-9]{2,5}$", route):
        return ""
    return route


def route_from_path(working_directory: Path, file_path: Path) -> str:
    relative = file_path.resolve().relative_to(working_directory.resolve()).as_posix()
    for prefix in ("src/app/", "app/"):
        if relative.startswith(prefix) and re.search(r"/page\.[^.]+$", relative):
            remainder = relative[len(prefix):]
            parent = Path(remainder).parent.as_posix()
            segments = [segment for segment in parent.split("/") if segment and segment != "."]
            clean = []
            for segment in segments:
                if segment.startswith("(") and segment.endswith(")"):
                    continue
                if re.search(r"\[.+\]", segment):
                    return ""
                clean.append(segment)
            return "/" if not clean else "/" + "/".join(clean)
    for prefix in ("src/pages/", "pages/"):
        if relative.startswith(prefix):
            remainder = relative[len(prefix):]
            if remainder.startswith("api/"):
                return ""
            route_file = str(Path(remainder).with_suffix("")).replace("\\", "/")
            if re.search(r"(^|/)_", route_file):
                return ""
            if route_file.endswith("/index"):
                route_file = route_file[: -len("/index")]
            if not route_file:
                return "/"
            if re.search(r"\[.+\]", route_file):
                return ""
            return "/" + route_file.strip("/")
    return ""


def iter_text_files(base: Path):
    for path in base.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        if any(part in IGNORE_PARTS for part in path.parts):
            continue
        yield path


def discover_routes(working_directory: Path) -> list[str]:
    routes = {"/"}
    for file_path in iter_text_files(working_directory):
        path_route = normalize_route(route_from_path(working_directory, file_path))
        if path_route:
            routes.add(path_route)
        try:
            text = file_path.read_text(encoding="utf-8")
        except Exception:
            continue
        for pattern in ROUTE_PATTERNS:
            for match in pattern.finditer(text):
                route = normalize_route(match.group("route"))
                if route:
                    routes.add(route)
    return sorted(routes, key=lambda item: (item != "/", item))


def render(template: str, **values: str) -> str:
    result = template
    for key, value in values.items():
        result = result.replace(f"__{key}__", value)
    return result.replace("{{", "{").replace("}}", "}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", default="")
    parser.add_argument("--working-directory", default="")
    parser.add_argument("--max-routes", type=int, default=12)
    parser.add_argument("--max-accessibility-routes", type=int, default=5)
    args = parser.parse_args()

    project_root = resolve_project_root(args.project_root)
    working_directory = resolve_working_directory(project_root, args.working_directory)
    routes = discover_routes(working_directory)
    selected_routes = routes[: max(args.max_routes, 1)] or ["/"]
    accessibility_routes = selected_routes[: max(args.max_accessibility_routes, 1)]
    auth_routes = [route for route in routes if re.search(r"(?i)/(login|sign-in|signin|register|signup|auth|account|forgot|reset)", route)][:5]
    commerce_routes = [route for route in routes if re.search(r"(?i)/(cart|checkout|billing|payment|orders?)", route)][:5]

    managed_dir = working_directory / "tests" / "pg-generated"
    if managed_dir.exists():
        resolved = managed_dir.resolve()
        if working_directory.resolve() not in resolved.parents:
            raise RuntimeError(f"Refusing to reset managed directory outside the working directory: {resolved}")
        shutil.rmtree(resolved)
    ensure_dir(managed_dir)

    config_path = resolve_existing_config(working_directory)
    config_created = False
    if config_path is None:
        config_path = working_directory / "playwright.config.ts"
        write_text(config_path, CONFIG_TEMPLATE)
        config_created = True

    generated_files: list[str] = []
    helper_path = managed_dir / "_pg.generated.helpers.ts"
    readme_path = managed_dir / "README.md"
    write_text(helper_path, HELPER_TEMPLATE)
    write_text(readme_path, "# PG generated Playwright suite\n\nThis directory is managed by `playwright-author` and `playwright-full-check`. Regenerate it instead of editing files here manually.\n")
    generated_files.extend([rel(helper_path, project_root), rel(readme_path, project_root)])

    spec_map = {
        "01-smoke.generated.spec.ts": render(SMOKE_TEMPLATE, HOME_ROUTE=("/" if "/" in selected_routes else selected_routes[0])),
        "02-routes.generated.spec.ts": render(ROUTES_TEMPLATE, ROUTES_JSON=json.dumps(selected_routes, indent=2)),
        "03-forms.generated.spec.ts": render(FORMS_TEMPLATE, ROUTES_JSON=json.dumps(selected_routes, indent=2)),
        "04-input-hardening.generated.spec.ts": render(INPUT_HARDENING_TEMPLATE, ROUTES_JSON=json.dumps(selected_routes, indent=2)),
        "05-accessibility.generated.spec.ts": render(ACCESSIBILITY_TEMPLATE, ROUTES_JSON=json.dumps(accessibility_routes, indent=2)),
    }
    if auth_routes:
        spec_map["06-auth-like.generated.spec.ts"] = render(AUTH_TEMPLATE, ROUTES_JSON=json.dumps(auth_routes, indent=2))
    if commerce_routes:
        spec_map["07-commerce-like.generated.spec.ts"] = render(COMMERCE_TEMPLATE, ROUTES_JSON=json.dumps(commerce_routes, indent=2))

    for name, content in spec_map.items():
        target = managed_dir / name
        write_text(target, content)
        generated_files.append(rel(target, project_root))

    manifest = load_manifest(working_directory)
    payload = {
        "generated_at_utc": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "project_root": str(project_root),
        "working_directory": str(working_directory),
        "config_path": rel(config_path, project_root),
        "config_created": config_created,
        "playwright_dependency_declared": playwright_declared(manifest),
        "dependency_install_required": not playwright_declared(manifest),
        "package_json_path": rel(working_directory / "package.json", project_root) if manifest else "",
        "discovered_route_count": len(routes),
        "discovered_routes": routes,
        "selected_routes": selected_routes,
        "auth_like_routes": auth_routes,
        "commerce_like_routes": commerce_routes,
        "managed_test_directory": rel(managed_dir, project_root),
        "generated_files": generated_files,
        "status": "ready" if playwright_declared(manifest) else "needs-playwright-dependency",
    }

    latest_dir = project_root / "Memory-bank" / "_generated" / "playwright-authoring"
    ensure_dir(latest_dir)
    latest_path = latest_dir / "playwright-authoring-latest.json"
    write_text(latest_path, json.dumps(payload, indent=2))
    print(f"- playwright_author_summary: {rel(latest_path, project_root)}")
    print(f"- playwright_config: {payload['config_path']}")
    print(f"- playwright_generated_tests: {', '.join(generated_files)}")
    print(f"PG_PLAYWRIGHT_AUTHOR_JSON:{json.dumps(payload, separators=(',', ':'))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

