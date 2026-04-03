from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def rel(path: str | Path, repo_root: Path) -> str:
    candidate = Path(path)
    try:
        resolved = candidate.resolve()
        return resolved.relative_to(repo_root.resolve()).as_posix()
    except Exception:
        try:
            return candidate.resolve().as_posix()
        except Exception:
            return str(candidate).replace('\\', '/')


def short_message(text: str) -> str:
    clean = ANSI_RE.sub('', text or '').replace('\r', '')
    lines = [line for line in clean.split('\n') if line.strip()]
    return '\n'.join(lines[:12]).strip()


def collect_failures(node: dict, parents: list[str], repo_root: Path, out: list[dict]) -> None:
    next_parents = list(parents)
    title = node.get('title')
    if title:
        next_parents.append(str(title))
    for spec in node.get('specs', []) or []:
        spec_parts = list(next_parents)
        if spec.get('title'):
            spec_parts.append(str(spec['title']))
        for test in spec.get('tests', []) or []:
            for result in test.get('results', []) or []:
                if result.get('status') in {'passed', 'skipped'}:
                    continue
                first_error = (result.get('errors') or [None])[0] or {}
                location = first_error.get('location') or {}
                attachments = [
                    {
                        'name': str(attachment.get('name', '')),
                        'content_type': str(attachment.get('contentType', '')),
                        'path': rel(attachment.get('path', ''), repo_root),
                    }
                    for attachment in (result.get('attachments') or [])
                ]
                out.append(
                    {
                        'title': str(spec.get('title', '')),
                        'full_title': ' > '.join(part for part in spec_parts if part),
                        'project_name': str(test.get('projectName', '')),
                        'status': str(result.get('status', '')),
                        'duration_ms': int(result.get('duration', 0) or 0),
                        'file': rel(location.get('file') or spec.get('file') or '', repo_root),
                        'line': int(location.get('line') or spec.get('line') or 0),
                        'column': int(location.get('column') or spec.get('column') or 0),
                        'error_summary': short_message(first_error.get('message', '')) or 'Playwright result reported a non-passing status without an error message.',
                        'attachments': attachments,
                    }
                )
    for child in node.get('suites', []) or []:
        collect_failures(child, next_parents, repo_root, out)


def write_markdown(path: Path, failures: list[dict], browser_matrix: str, requested_mode: str, effective_mode: str) -> None:
    lines = [
        '# Playwright Failure List',
        '',
        f'- Browser matrix: {browser_matrix}',
        f'- Requested run mode: {requested_mode}',
        f'- Effective run mode: {effective_mode}',
        f'- Failure count: {len(failures)}',
        '',
    ]
    if not failures:
        lines.append('No non-passing Playwright tests were recorded in this run.')
    else:
        for index, failure in enumerate(failures, start=1):
            lines.append(f'## {index}. {failure["full_title"]}')
            lines.append(f'- Project: {failure["project_name"]}')
            lines.append(f'- Status: {failure["status"]}')
            if failure['file']:
                lines.append(f'- Location: {failure["file"]}:{failure["line"]}:{failure["column"]}')
            lines.append('- Error:')
            lines.append('```text')
            lines.append(failure['error_summary'])
            lines.append('```')
            for attachment in failure['attachments']:
                lines.append(f'- {attachment["name"]}: {attachment["path"]}')
            lines.append('')
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--report-json', required=True)
    parser.add_argument('--repo-root', required=True)
    parser.add_argument('--failures-json', required=True)
    parser.add_argument('--failures-markdown', required=True)
    parser.add_argument('--browser-matrix', required=True)
    parser.add_argument('--requested-run-mode', required=True)
    parser.add_argument('--effective-run-mode', required=True)
    args = parser.parse_args()

    report_path = Path(args.report_json)
    repo_root = Path(args.repo_root)
    failures_json_path = Path(args.failures_json)
    failures_markdown_path = Path(args.failures_markdown)
    report = json.loads(report_path.read_text(encoding='utf-8')) if report_path.exists() else {}
    failures: list[dict] = []
    for suite in report.get('suites', []) or []:
        collect_failures(suite, [], repo_root, failures)
    failures_json_path.write_text(json.dumps(failures, indent=2), encoding='utf-8')
    write_markdown(failures_markdown_path, failures, args.browser_matrix, args.requested_run_mode, args.effective_run_mode)
    print(json.dumps({'failure_count': len(failures), 'failures': failures}, separators=(',', ':')))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
