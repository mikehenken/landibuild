---
name: orchestration-bundle-and-study-manifest
executable_plan: .cursor/plans/orchestration-bundle-and-study-manifest.plan.md
overview: >-
  Centralize OpenCode orchestration (agents + skill) into a repo-local bundle copied as a whole;
  drive execution paths from a per-study manifest; keep application source and unrelated code out of the bundle;
  optional study-end snapshot/zip. Cursor and OpenCode consume the same relative layout under each study root.
plan_type: infrastructure
status: draft
created: 2026-04-04
---

# Plan: Orchestration bundle mirror + per-study manifest

**Run with multi-agent-coordinator:** [orchestration-bundle-and-study-manifest.plan.md](../../../../.cursor/plans/orchestration-bundle-and-study-manifest.plan.md) (from repo root: `.cursor/plans/orchestration-bundle-and-study-manifest.plan.md`).

## Purpose

- **Single place while executing:** For each study run, all orchestration inputs/outputs for *that* execution live under one directory tree (`STUDY_ROOT`), resolved via one config file (`manifest.yaml`).
- **Whole-bundle copy:** Sync orchestration **as complete trees** (entire `skills/orchestration/` and designated agent files), not cherry-picked files, so versions stay consistent.
- **Exclude non-orchestration work:** Application code, dependency trees, and build artifacts are **not** part of the bundle copy and are **not** required to live under `STUDY_ROOT` unless a study explicitly places deliverables in `outputs/`.

## Principles

| Principle | Rule |
|-----------|------|
| Atomic skill mirror | Copy **`~/.config/opencode/skills/orchestration/`** in full (minus explicit junk excludes below). |
| Atomic agent set | Copy a **fixed list** of `~/.config/opencode/agents/*.md` that belong to the orchestration release (coordinator, orchestrator-builder, coordinator, error-coordinator, etc.). The list is versioned in the sync script, not hand-picked per file each run. |
| No app source in bundle | `src/`, `worker/`, `node_modules/`, `dist/`, and similar **never** go into `orchestration-bundle/` or `STUDY_ROOT/bundle/`. |
| Paths relative to study | `manifest.yaml` uses paths **relative to `STUDY_ROOT`**; optional `base_path` only for tools that cannot `chdir`. |
| Manifest points, does not duplicate | Feature prose lives under `bundle/skills/orchestration/`; manifest only references paths and metadata. |

## Repo layout (target)

```text
landibuild/
  .cursor/
    orchestration-bundle/           # whole mirror; git-tracked after sync
      agents/                       # full set of orchestration-related agent .md files
      skills/
        orchestration/              # full tree: features/, schemas/, templates/, patterns/, configuration/, docs/, …
      bundle-version.txt            # sync timestamp + optional source hash note
  scripts/
    sync-orchestration-bundle.ps1   # or .mjs: mirror from ~/.config/opencode → .cursor/orchestration-bundle
```

## Per-study layout (`STUDY_ROOT`)

```text
<STUDY_ROOT>/                       # e.g. landi-labs/studies/orchestration/<study-id>/ or .development/orchestration-runs/<id>/
  manifest.yaml
  workflow/                         # YAML exported for this run
  plans/
  state/
  inputs/
  outputs/                          # study deliverables (reports, synthesized docs); not the orchestration bundle
  logging/                          # coordinator logs; may include copies of Cursor session exports (see below)
  bundle/                           # optional: frozen copy of .cursor/orchestration-bundle at run start or end
```

## Cursor session logs (`cursor-history`)

- **Retrieval:** Cursor IDE/session logs can be fetched with the **`cursor-history`** command (CLI on PATH).
- **Invocation:** Run it **through CMD** with run-and-exit so resolution matches a normal shell: **`cmd /c cursor-history`**. If your runbooks standardize on **`cmd -c`**, use the same spawning pattern your environment already uses for other CLI tools; native **`cmd.exe`** expects **`/c`**, not **`-c`**.
- **Study closure (optional):** Save `cursor-history` output (or paths it prints) under **`logging/`** so `STUDY_ROOT` stays the single audit folder alongside orchestration artifacts.

## `manifest.yaml` (contract)

All paths below are relative to `STUDY_ROOT` unless `base_path` is set.

```yaml
schema_version: 1
study_id: "<string>"
created_at: "<ISO8601>"
closed_at: null                    # set when study archived

base_path: null                    # optional absolute path to STUDY_ROOT

paths:
  workflow_config: workflow/config.yaml
  plan: plans/run.plan.md
  state: state/run.state.md
  inputs: inputs
  outputs: outputs
  logging: logging

bundle:
  skill_root: bundle/skills/orchestration    # or .cursor/orchestration-bundle/skills/orchestration when running from repo root
  agents_glob: bundle/agents/*.md             # convention: coordinator reads directory

runtime:
  preferred: opencode              # cursor | opencode | either
```

**Coordinator behavior (both platforms):** If the user provides `STUDY_ROOT` (or it is inferred from plan frontmatter), **read `manifest.yaml` first** and resolve `paths.*` and `bundle.*` relative to `STUDY_ROOT`.

## Sync script behavior

1. **Source:** `~/.config/opencode/skills/orchestration/` → **Dest:** `.cursor/orchestration-bundle/skills/orchestration/` (recursive full copy).
2. **Source:** listed agents under `~/.config/opencode/agents/` → **Dest:** `.cursor/orchestration-bundle/agents/`.
3. **Excludes only:** `node_modules`, `coverage`, `dist`, `*.tmp`, OS junk (optional `.syncignore` beside script).
4. **Do not exclude** feature folders, schemas, templates, tests, or config YAML inside the skill unless they are clearly generated noise (e.g. local `coverage/` from running vitest in the skill package).
5. Write **`bundle-version.txt`**: UTC timestamp + short note (e.g. `synced_from=$HOME/.config/opencode`).

## Study freeze (optional, end of run)

- Copy **entire** `.cursor/orchestration-bundle/` → `<STUDY_ROOT>/bundle/` so the study folder is self-contained for audit.
- Run **`cmd /c cursor-history`** (or your documented **`cmd -c`** wrapper) and store results under **`logging/`** if Cursor-side history is part of the audit trail.
- Optionally **zip** `<STUDY_ROOT>/` (excluding nothing inside bundle/skill except standard junk excludes).
- Set `manifest.closed_at` and optional `artifact_sha256` for the zip.

## Cursor wiring

- Point Cursor agent definitions at **`.cursor/orchestration-bundle/agents/*.md`** (or thin `.cursor/agents/*.md` stubs that defer to the bundle path if Cursor requires fixed locations).
- Update **`.cursor/skills/orchestration/SKILL.md`** to reference **`../orchestration-bundle/skills/orchestration/SKILL.md`** as canonical in-repo content (or merge and deprecate duplicate prose).
- Move **`orchestration-issues-index.md`** into **`orchestration-bundle/skills/orchestration/docs/`** (or `bundle/`) so it ships with the whole skill tree.

## OpenCode wiring

- Keep **`~/.config/opencode/`** as the live editing location; **sync to repo** before commits or tagged studies.
- Align coordinator default plan/state paths with **`manifest.paths`** when `STUDY_ROOT` is supplied; keep **`.opencode/plans`** as optional default only when no manifest is used.

## Migration from current scatter

| Current | Action |
|---------|--------|
| `.cursor/agents/orchestration/` | Deprecate after references updated; archive or delete once `orchestration-bundle` is authoritative. |
| Plans citing `.cursor/agents/orchestration/features/...` | Update to `bundle/skills/orchestration/features/...` or relative from `STUDY_ROOT`. |
| `.cursor/rules/orchestration-extension-detection.mdc` | Scan state via manifest or both `.opencode/state` and `**/state/*.state.md` under known study roots. |
| Documentation skill pointing at `.cursor/agents/orchestration/schemas/` | Point at `.cursor/orchestration-bundle/skills/orchestration/schemas/`. |

## Implementation checklist (ordered)

1. Add `.cursor/orchestration-bundle/` placeholder and **`scripts/sync-orchestration-bundle.ps1`** (whole-tree copy + excludes + `bundle-version.txt`).
2. Run first sync from `~/.config/opencode` → repo; commit bundle + script.
3. Add **`manifest.schema.yaml`** (or document embedded schema) under `orchestration-bundle/skills/orchestration/docs/`.
4. Update **`multi-agent-coordinator`** (OpenCode + bundle copy) to honor **`STUDY_ROOT` + manifest** when provided.
5. Repoint **Landi Cursor skill**, **documentation** topic links, and **orchestration-extension** rule to bundle paths.
6. Pilot one new study using `<STUDY_ROOT>/manifest.yaml` + `bundle/` freeze at end; include **`cmd /c cursor-history`** (or **`cmd -c`** per your wrapper) output under `logging/` when closing a Cursor-heavy run.
7. Archive/remove legacy **`.cursor/agents/orchestration/`** after grep shows no remaining references.

## Out of scope

- Centralizing normal product code changes into `STUDY_ROOT` (only study artifacts belong there by default).
- Replacing OpenCode global config with repo-only installs (sync remains the bridge unless you later drop globals entirely).

## Success criteria

- One `STUDY_ROOT` contains manifest + plans + state + logging + outputs (+ optional `bundle/` snapshot).
- Orchestration instructions are reproducible from **`orchestration-bundle`** alone plus manifest.
- No execution doc **requires** scattered `~/.config` paths when a study manifest is in use.
