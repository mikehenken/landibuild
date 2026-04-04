# Acceptance criteria — orchestration-bundle-and-study-manifest

Derived from `.development/journal/planning/orchestration-bundle-and-study-manifest/plan.md` (Success criteria, principles, coordinator behavior) and `.cursor/plans/orchestration-bundle-and-study-manifest.plan.md` (Stated intention, Success checks, coordinator non-regression). Use as the Phase 6 / Phase 7 proof checklist.

## Stated intention

- **Single `STUDY_ROOT` per study execution:** `<STUDY_ROOT>/manifest.yaml` is the contract; `paths.*` and `bundle.*` resolve **relative to `STUDY_ROOT`** (with optional `base_path` only when a tool cannot `chdir`), matching the canonical `manifest.yaml` section in `plan.md`.
- **Whole-tree mirror, not cherry-picks:** The full `skills/orchestration/` tree from `~/.config/opencode/` plus a **versioned fixed list** of orchestration agent `.md` files from `~/.config/opencode/agents/` sync into **`.cursor/orchestration-bundle/`** as complete subtrees (`skills/orchestration/`, `agents/`).
- **Excludes and non-goals:** Sync and bundle contents **exclude** agreed junk only (`node_modules`, `coverage`, `dist`, `*.tmp`, OS junk / optional `.syncignore`). **Application source and build trees** (`src/`, `worker/`, `node_modules/`, `dist/`, etc.) **never** belong in `orchestration-bundle` or `STUDY_ROOT/bundle/` as product code; study **outputs** may live under `<STUDY_ROOT>/outputs/` by convention.
- **Cursor session logs:** Documentation and pilot materials require retrieval via **`cursor-history`**, invoked as **`cmd /c cursor-history`** on Windows (native `cmd.exe` uses `/c`). Optional: persist output or paths printed by that command under **`<STUDY_ROOT>/logging/`** for audit.
- **Reproducibility:** With a populated bundle and a valid manifest, orchestration instructions are **reproducible from the repo-local orchestration bundle plus manifest**; no execution doc **requires** scattered `~/.config` paths when a study manifest is in use.
- **Coordinator backward compatibility:** When **`STUDY_ROOT` is omitted** (or no manifest), **`multi-agent-coordinator` behavior remains valid**—existing OpenCode defaults such as **`.opencode/plans`** remain usable as optional defaults; manifest-first resolution applies **only** when `STUDY_ROOT` / manifest is supplied (no mandatory manifest for ordinary runs).

## Canonical plan success criteria (`plan.md`)

- **Audit folder:** One `STUDY_ROOT` contains **manifest**, **plans**, **state**, **logging**, **outputs**, and optionally a **`bundle/`** snapshot of `.cursor/orchestration-bundle/` for freeze/audit.
- **Repro bundle + manifest:** Orchestration instructions can be reproduced from **`orchestration-bundle`** and **`manifest.yaml`** without relying on ad hoc per-file paths under `~/.config` when the manifest workflow is active.
- **Docs vs global config:** Execution documentation does not **require** scattered `~/.config` references when a study manifest is in use.

## Executable plan success checks (`.cursor/plans/...`)

- **`scripts/sync-orchestration-bundle.ps1` exists** and, when run, **repopulates `.cursor/orchestration-bundle/`** as a **full tree** (entire skill subtree + listed agents), not partial copies, subject only to agreed excludes.
- **`manifest.schema.yaml` exists** under **`.cursor/orchestration-bundle/skills/orchestration/docs/`** (or the path recorded in phase outputs) and **documents** the fields from canonical `plan.md`’s `manifest.yaml` contract.
- **Pilot skeleton on disk** demonstrates the **`STUDY_ROOT` layout** (`manifest.yaml`, `workflow/`, `plans/`, `state/`, `inputs/`, `outputs/`, `logging/`, optional `bundle/`) with notes for **`cmd /c cursor-history` → `logging/`** where Cursor-heavy runs are closed.
- **Global `~/.config/opencode/agents/multi-agent-coordinator.md`** documents **manifest-first** resolution when `STUDY_ROOT` is provided (`bundle.skill_root`, `paths.plan`, `paths.state`, `paths.logging`, etc.); **`.cursor/orchestration-bundle/agents/multi-agent-coordinator.md`** **matches** after the mandated re-sync.
- **Landi Cursor skill, documentation topics, and orchestration-extension rule** reference **bundle paths** (e.g. `.cursor/orchestration-bundle/skills/orchestration/...`, schemas under bundle); **`orchestration-issues-index.md` lives under** bundle docs (or equivalent path per plan) and references are updated.
- **Phase review artifacts:** **`p6-review/outputs/agent-review.md`** and **`p7-objective-review/outputs/objective-review.md`** exist with **scores**, **gaps**, and **closure / legacy archive** notes as specified in the executable plan.
- **`cursor-history` is documented** as **`cmd /c cursor-history`** (with optional wrapper note if runbooks use a different but equivalent spawn pattern), including **optional capture under `logging/`**.

## Optional study closure (verify when pilot closes)

- Entire **`.cursor/orchestration-bundle/`** may be copied to **`<STUDY_ROOT>/bundle/`** for a self-contained audit folder.
- **`manifest.closed_at`** (and optional artifact hash for a zip) set when a study is archived, per canonical plan.

## Definition of Done (Phase 0)

- [x] `spine.md` and this file exist under the journal root and `p0-spine-acceptance/outputs/`.
- [x] Bullets above map to canonical Success criteria, Stated intention, Success checks, **`cmd /c`**, and **coordinator behavior when `STUDY_ROOT` is omitted**.
