# Spine — orchestration-bundle-and-study-manifest

Running log for **decisions**, **artifact paths**, and **open questions** for the workflow that centralizes OpenCode orchestration in a repo-local bundle and drives per-study execution from `manifest.yaml`.

**Canonical design (full principles, layouts, checklist):** [plan.md](./plan.md)

**Journal root:** `.development/journal/planning/orchestration-bundle-and-study-manifest`  
**Executable coordinator plan:** `.cursor/plans/orchestration-bundle-and-study-manifest.plan.md`  
**State file:** `.cursor/state/orchestration-bundle-and-study-manifest.state.md`

---

## Decision log

| Date (UTC) | Decision | Rationale |
|------------|----------|-----------|
| 2026-04-04 | **Whole-tree sync** for skill and fixed agent set | Versions stay consistent; no cherry-picking per run (see canonical `plan.md` Principles). |
| 2026-04-04 | **Live edit in `~/.config/opencode/`**, sync into repo before commits or tagged studies | Bridge until a repo-only install is chosen; out of scope to replace global config entirely. |
| 2026-04-04 | **`manifest.yaml` paths relative to `STUDY_ROOT`**; optional `base_path` only for tools that cannot `chdir` | Single audit root per study; manifest points, does not duplicate feature prose. |
| 2026-04-04 | **Bundle destination:** `.cursor/orchestration-bundle/` (`agents/`, `skills/orchestration/`, `bundle-version.txt`) | Matches canonical repo layout; Cursor and OpenCode share relative layout under each study root when manifest references `bundle/`. |
| 2026-04-04 | **Excludes on sync:** `node_modules`, `coverage`, `dist`, `*.tmp`, OS junk (optional `.syncignore`); do not exclude feature folders, schemas, templates, tests, or skill config YAML except generated noise | App source (`src/`, `worker/`, etc.) never enters the bundle path by design of sync sources, not as arbitrary subtree deletes inside the skill. |
| 2026-04-04 | **Cursor session logs:** invoke `cursor-history` via **`cmd /c cursor-history`** on Windows (`cmd.exe` uses `/c`, not `-c`) | Matches normal shell resolution; optional capture under `<STUDY_ROOT>/logging/`. |
| 2026-04-04 | **Coordinator:** when `STUDY_ROOT` (or inferred root) is provided, **read `manifest.yaml` first** and resolve `paths.*` and `bundle.*` | Single contract for plan/state/logging/bundle roots. |
| 2026-04-04 | **When `STUDY_ROOT` is omitted:** preserve existing OpenCode defaults (e.g. `.opencode/plans` as optional default); do not require manifest for normal runs | Non-breaking migration; explicit in coordinator task prompts. |

---

## Key paths (repo-relative)

| Role | Path |
|------|------|
| Canonical plan | `.development/journal/planning/orchestration-bundle-and-study-manifest/plan.md` |
| Sync script (target) | `scripts/sync-orchestration-bundle.ps1` |
| Repo bundle mirror | `.cursor/orchestration-bundle/` (`agents/`, `skills/orchestration/`, `bundle-version.txt`) |
| OpenCode sources (machine) | `~/.config/opencode/skills/orchestration/`, `~/.config/opencode/agents/*.md` (listed subset) |
| Per-study root (examples) | e.g. `landi-labs/studies/orchestration/<study-id>/` or `.development/orchestration-runs/<id>/` |
| Study manifest | `<STUDY_ROOT>/manifest.yaml` |
| Study tree (target) | `<STUDY_ROOT>/workflow/`, `plans/`, `state/`, `inputs/`, `outputs/`, `logging/`, optional `bundle/` |
| Manifest schema (target) | `.cursor/orchestration-bundle/skills/orchestration/docs/manifest.schema.yaml` |
| Cursor skill bridge (target) | `.cursor/skills/orchestration/SKILL.md` → canonical prose under bundle |
| Issues index (target) | `.cursor/orchestration-bundle/skills/orchestration/docs/` (or equivalent under bundle) |
| Legacy (deprecate after grep-clean) | `.cursor/agents/orchestration/` |

---

## Artifacts index

| Phase / task_id | Artifact | Status |
|-----------------|----------|--------|
| p0-spine-acceptance | `spine.md`, `p0-spine-acceptance/outputs/acceptance-criteria.md` | Complete |
| p1-sync-script | `scripts/sync-orchestration-bundle.ps1`, `p1-sync-script/outputs/sync-script-notes.md` | Complete |
| p2-run-sync | Populated `.cursor/orchestration-bundle/`, `p2-run-sync/outputs/sync-run-log.md` | Complete |
| p3-manifest-and-pilot-skeleton | `manifest.schema.yaml`, pilot skeleton, `study-freeze-checklist.md` | Complete |
| p4-coordinator-manifest-protocol | Updated `multi-agent-coordinator.md` (global + bundle copy), `protocol-summary.md` | Complete |
| p5-repoint-paths | SKILL.md, issues index move, docs/rules, `grep-report.md` | Complete |
| p6-review | `p6-review/outputs/agent-review.md` | Complete |
| p7-objective-review | `p7-objective-review/outputs/objective-review.md` | Complete |
| p8-handoff | `p8-handoff/outputs/AGENTS-orchestration-snippet.md` | Complete |

---

## Open questions

1. **Sync implementation detail:** PowerShell-only vs dual `.mjs` for cross-platform—canonical plan allows either; pick one for repo default and document in p1 notes.
2. **Thin Cursor stubs:** If Cursor requires fixed `.cursor/agents/*.md` locations, whether stubs that defer to `.cursor/orchestration-bundle/agents/` are needed beyond repointing skill and rules.
3. **Pilot `STUDY_ROOT` location:** First pilot under `journal_root/.../outputs/` vs a real `landi-labs/studies/...` path—p3 deliverable defines skeleton; align with team convention.
4. **`cmd -c` vs `cmd /c`:** Runbooks that standardize on a wrapper must document the same spawning pattern as other CLI tools; canonical text uses **`cmd /c`** for native `cmd.exe`.
5. **Legacy archive timing:** `.cursor/agents/orchestration/` removal only after grep shows no remaining references (or documented exceptions); p7 owns explicit archive/remove steps.

---

## Changelog

- **2026-04-04:** Phase 0 — `spine.md` and `p0-spine-acceptance/outputs/acceptance-criteria.md` created from canonical `plan.md` and `.cursor/plans/orchestration-bundle-and-study-manifest.plan.md`.
