#!/usr/bin/env sh
# Sample git pre-commit hook fragment: verify handoff chain if log path is set.
# Copy into .husky/pre-commit or run from CI.
#
# Required env when this runs:
#   COORDINATOR_HANDOFF_LOG_PATH
# Optional (matches MCP strict verify):
#   COORDINATOR_HANDOFF_STRICT=true
#   COORDINATOR_HANDOFF_SIGNING_KEY_PEM / COORDINATOR_HANDOFF_VERIFY_KEY_PEM

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
VERIFY_JS="$REPO_ROOT/tools/coordinator-handoff-mcp/dist/cli/verify.js"

if [ -z "${COORDINATOR_HANDOFF_LOG_PATH:-}" ]; then
  exit 0
fi

if [ ! -f "$VERIFY_JS" ]; then
  echo "[pre-commit-handoff] SKIP: run npm run build in tools/coordinator-handoff-mcp"
  exit 0
fi

node "$VERIFY_JS" || exit 1
