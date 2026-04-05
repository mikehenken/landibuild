# coordinator-handoff-mcp

MCP server for **tamper-evident** coordinator / subagent handoffs: canonical JSON, **SHA-256** fingerprints, **hash chain**, **server-side file digest binding**, optional **strict mode** (mandatory **Ed25519** + **chain tip**), and **`verify_phase_gate`** so acceptance can require “on-disk files match what was committed.”

## What this does *not* do

- **Does not** encrypt LLM vendor traffic or Cursor IPC end-to-end.
- **Does not** defeat a motivated **insider on the same machine** who controls keys, env, and files: they can still mint a valid signed log for arbitrary content.
- **Does** make **accidental or sloppy fakery** very hard: blind appends without the current tip fail, client-supplied digests are ignored (server hashes files), the log is hash-chained, duplicates are rejected, and **strict** mode requires every record to carry a valid signature.

## Tools

| Tool | Purpose |
|------|---------|
| `get_chain_tip` | Return current `prev_chain_tip` (64 hex) before appending |
| `append_handoff` | Append record; optional `artifact_paths` (server injects `body.artifacts`) |
| `commit_handoff` | **Preferred gate close:** requires `prev_chain_tip` + `artifact_paths` (single read/hash then append) |
| `verify_phase_gate` | Full chain verify → latest record for `(study_id, phase_id)` → **re-hash files** → must match logged artifacts; optional `expected_fingerprint` pin |
| `verify_log` | Replay chain; strict mode requires **every** signature |
| `get_entry_by_fingerprint` | Audit lookup |

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `COORDINATOR_HANDOFF_LOG_PATH` | **Yes** | JSONL log path |
| `COORDINATOR_HANDOFF_WORKSPACE_ROOT` | For artifact tools | Absolute path to repo or **study root**; all `artifact_paths` are relative to this |
| `COORDINATOR_HANDOFF_SIGNING_KEY_PEM` | Strict: **yes** | PKCS#8 PEM Ed25519 private key |
| `COORDINATOR_HANDOFF_VERIFY_KEY_PEM` | No | Public key PEM; else derived from private |
| `COORDINATOR_HANDOFF_STRICT` | No | `1` / `true` — mandatory signing, mandatory signatures on verify, mandatory `prev_chain_tip` on `append_handoff` |
| `COORDINATOR_HANDOFF_REQUIRE_CHAIN_TIP` | No | If `true`, `append_handoff` requires `prev_chain_tip` even when not strict |
| `COORDINATOR_HANDOFF_TRANSCRIPT_ROOT` | No | **Watch:** absolute path to Cursor `agent-transcripts` directory (see below) |
| `COORDINATOR_HANDOFF_WATCH_MCP_ONLY` | No | If `true`, transcript stream only prints lines that look like MCP / handoff calls |
| `COORDINATOR_HANDOFF_WATCH_FROM_END` | No | Default `true`: on first sight of a transcript file, skip historical lines |

## Git hook + live watchers

**Verify hook (pre-commit / CI)** — runs the same chain replay as `verify_log`:

```bash
cd tools/coordinator-handoff-mcp
npm run build
export COORDINATOR_HANDOFF_LOG_PATH=/absolute/path/handoff.jsonl
export COORDINATOR_HANDOFF_STRICT=true   # optional
node dist/cli/verify.js   # exit 1 on tamper / bad signatures
```

Sample shell fragment: `scripts/pre-commit-verify.sample.sh` (source the env vars in your shell profile or husky).

**Live watch** — debounced **log integrity** on every append + optional **subagent transcript tail**:

```bash
export COORDINATOR_HANDOFF_LOG_PATH=/absolute/handoff.jsonl
export COORDINATOR_HANDOFF_TRANSCRIPT_ROOT="C:/Users/you/.cursor/projects/c-Users-you-Projects-landi-landibuild/agent-transcripts"
export COORDINATOR_HANDOFF_WATCH_MCP_ONLY=true
node dist/cli/watch.js
```

Transcript lines are parsed as Cursor JSONL: assistant `tool_use` blocks are printed with tool name and truncated input so you can **see Task / Read / MCP calls as they are written** (format depends on Cursor version). This is **observability**, not cryptographic proof—proof stays in the signed JSONL log.

Generate keys (OpenSSL):

```bash
openssl genpkey -algorithm Ed25519 -out coordinator-handoff.pem
openssl pkey -in coordinator-handoff.pem -pubout -out coordinator-handoff.pub.pem
```

## Recommended acceptance flow (cannot “accept” without match)

1. Set `COORDINATOR_HANDOFF_STRICT=true` and point `COORDINATOR_HANDOFF_WORKSPACE_ROOT` at the **study root** (or repo root if paths are from there).
2. `get_chain_tip` → note `prev_chain_tip`.
3. When deliverables are final: **`commit_handoff`** with `study_id`, `phase_id`, `actor_type`, `prev_chain_tip`, `artifact_paths` (relative paths to gate files), optional `body` metadata. Server reads bytes once and appends signed record.
4. Immediately run **`verify_phase_gate`** with the **same** `study_id`, `phase_id`, and `artifact_paths`. If the tool returns `"accepted": true`, disk and log agree. If files drifted, it returns `artifact_mismatch_disk_vs_log`.
5. Only then update human checklist / `HANDOFF.md` and cite returned **`fingerprint`**.

## Build and run

```bash
cd tools/coordinator-handoff-mcp
npm install
npm run build
```

## Cursor `mcp.json` (strict example)

```json
{
  "mcpServers": {
    "coordinator-handoff": {
      "command": "node",
      "args": ["C:/Users/you/Projects/landi/landibuild/tools/coordinator-handoff-mcp/dist/index.js"],
      "env": {
        "COORDINATOR_HANDOFF_STRICT": "true",
        "COORDINATOR_HANDOFF_LOG_PATH": "C:/Users/you/Projects/landi/landibuild/.development/coordinator-handoff.jsonl",
        "COORDINATOR_HANDOFF_WORKSPACE_ROOT": "C:/Users/you/Projects/landi/landibuild/.development/studies/orchestration-encyclopedia-isolated-2026-04-05-run2",
        "COORDINATOR_HANDOFF_SIGNING_KEY_PEM": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
      }
    }
  }
}
```

Prefer injecting PEM via a wrapper or OS secret store, not committing keys.

## Record shape (committed bytes)

Each JSONL line: `sequence`, `prev_chain_hash`, `chain_hash`, `fingerprint`, `canonical`, `signature_ed25519_base64` (when signing). Inside `canonical`, `body` may include `artifacts`: sorted `[{ "path", "content_sha256" }]` computed only by the server.

## Artifact path rules

Paths must stay inside `COORDINATOR_HANDOFF_WORKSPACE_ROOT`, must be **regular files**, and **symlinks are rejected**.
