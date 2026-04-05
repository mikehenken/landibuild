# p1-sync-script: orchestration bundle sync notes

## Purpose

`scripts/sync-orchestration-bundle.ps1` mirrors OpenCode orchestration assets from the user profile into the repo under `.cursor/orchestration-bundle/`, without copying application source or dependency trees from the skill folder.

## How to run

From the **repository root** (`landibuild`):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/sync-orchestration-bundle.ps1
```

Requires **Windows PowerShell 5.1+** or **PowerShell 7+** (`#requires -Version 5.1`). If `pwsh` is installed, `pwsh -File scripts/sync-orchestration-bundle.ps1` also works.

## Paths

| Role | Windows source | Repo destination |
|------|----------------|------------------|
| Skill tree | `%USERPROFILE%\.config\opencode\skills\orchestration` | `.cursor/orchestration-bundle/skills/orchestration` |
| Agent files | `%USERPROFILE%\.config\opencode\agents\*.md` (subset) | `.cursor/orchestration-bundle/agents/` |
| Version stamp | — | `.cursor/orchestration-bundle/bundle-version.txt` |

On Windows, `%USERPROFILE%\.config\opencode` is the same as `$env:USERPROFILE\.config\opencode` in PowerShell.

## Agent list (versioned in script)

The script copies **only** the following basenames (each as `<basename>.md`) if the file exists under the OpenCode `agents` directory. Missing files are skipped with a warning and are **not** treated as a fatal error.

1. `multi-agent-coordinator.md`
2. `orchestrator-builder.md`
3. `coordinator.md`
4. `error-coordinator.md`
5. `context-manager.md`
6. `research-analyst.md`
7. `search-specialist.md`
8. `architect-reviewer.md`
9. `documentation-engineer.md`
10. `refactoring-specialist.md`
11. `ai-engineer.md`
12. `opencode-architect-engineer.md`
13. `tooling-engineer.md`
14. `devops-engineer.md`
15. `test-automator.md`
16. `qa-expert.md`
17. `platform-engineer.md`
18. `ux-researcher.md`
19. `dx-optimizer.md`
20. `legacy-modernizer.md`
21. `git-workflow-manager.md`
22. `idea-log.md`
23. `agent-builder.md`
24. `chief-ux-ui-design.md`
25. `content-marketer.md`
26. `competitive-analyst.md`
27. `market-researcher.md`
28. `nextjs-developer.md`
29. `python-pro.md`
30. `sales-engineer.md`
31. `security-engineer.md`
32. `trend-analyst.md`

**Alignment check (this workspace, 2026-04-04):** Under `C:\Users\mikeh\.config\opencode\agents\`, all 32 of the above files were present. Other `.md` files there (e.g. `kotlin-pro.md`, `browseruse.md`) are **not** part of this bundle list and are not copied.

## Skill tree excludes (rationale)

| Exclude | Rationale |
|---------|-----------|
| `node_modules/` | Third-party dependencies; not skill source; large and non-reproducible in-bundle. |
| `coverage/` | Test coverage output; generated artifact. |
| `dist/` | Build output; generated artifact. |
| `*.tmp` | Ephemeral temporary files. |

Optional OS junk (`.DS_Store`, `Thumbs.db`, `desktop.ini`) is **not** filtered by the script; see `scripts/sync-orchestration-bundle.syncignore` for documentation.

## Outputs

- **`bundle-version.txt`**: UTC ISO timestamp (`synced_at_utc`), `synced_from_opencode_root`, absolute paths for skill/agent sources and destinations, and counts of copied vs skipped agents.

## Behavior and self-review

- **Idempotent:** Re-running overwrites agents and re-mirrors the skill tree (Windows: `robocopy /MIR` with excludes).
- **Fatal if skill source missing:** If `skills/orchestration` does not exist under OpenCode config, the script throws and exits non-zero.
- **Agents:** Every **successfully copied** agent filename is listed on stdout under `Copied agent files`.
- **p2:** Full bundle population in git is intentionally **not** part of p1; run the script when ready to populate `.cursor/orchestration-bundle/`.

## Related files

- `scripts/sync-orchestration-bundle.ps1` — implementation
- `scripts/sync-orchestration-bundle.syncignore` — exclude reference (not parsed by the script)
