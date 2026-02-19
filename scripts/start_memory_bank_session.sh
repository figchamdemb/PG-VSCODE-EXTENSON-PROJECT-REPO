#!/usr/bin/env bash
set -euo pipefail

max_commits="${MB_SESSION_MAX_COMMITS:-5}"
max_hours="${MB_SESSION_MAX_HOURS:-12}"
author="${MB_SESSION_AUTHOR:-agent}"
yes_flag=""
skip_refresh="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes)
      yes_flag="--ack-read"
      shift
      ;;
    --skip-refresh)
      skip_refresh="1"
      shift
      ;;
    --max-commits)
      max_commits="$2"
      shift 2
      ;;
    --max-hours)
      max_hours="$2"
      shift 2
      ;;
    --author)
      author="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

if [[ "$skip_refresh" != "1" ]]; then
  python "scripts/build_frontend_summary.py"
  python "scripts/generate_memory_bank.py" --profile "frontend" --keep-days "7"
fi

python "scripts/start_memory_bank_session.py" \
  --profile "frontend" \
  --max-commits "$max_commits" \
  --max-hours "$max_hours" \
  --author "$author" \
  $yes_flag