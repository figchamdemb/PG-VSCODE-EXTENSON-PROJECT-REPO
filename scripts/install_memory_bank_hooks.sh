#!/usr/bin/env bash
set -euo pipefail

mode="${1:-warn}"
if [[ "$mode" != "warn" && "$mode" != "strict" ]]; then
  echo "Invalid mode: $mode (allowed: warn|strict)"
  exit 1
fi

project_root="$(cd "$(dirname "$0")/.." && pwd)"
git_root="$(git -C "$project_root" rev-parse --show-toplevel)"
hooks_dir="$project_root/.githooks"
guard_script="$project_root/scripts/memory_bank_guard.py"

mkdir -p "$hooks_dir"

if command -v python3 >/dev/null 2>&1; then
  pybin="python3"
else
  pybin="python"
fi

guard_rel="$(python - <<PY
import os
print(os.path.relpath(r"$guard_script", r"$git_root").replace("\\\\", "/"))
PY
)"

hooks_rel="$(python - <<PY
import os
print(os.path.relpath(r"$hooks_dir", r"$git_root").replace("\\\\", "/"))
PY
)"

cat > "$hooks_dir/pre-commit" <<EOF
#!/usr/bin/env bash
set -euo pipefail

repo_root="\$(git rev-parse --show-toplevel)"
$pybin "\$repo_root/$guard_rel"
EOF

chmod +x "$hooks_dir/pre-commit"

git -C "$git_root" config core.hooksPath "$hooks_rel"
git -C "$git_root" config memorybank.mode "$mode"

echo "Configured core.hooksPath=$hooks_rel"
echo "Configured memorybank.mode=$mode"