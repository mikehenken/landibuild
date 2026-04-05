#requires -Version 5.1
<#
.SYNOPSIS
  Populates the repo-local Cursor bundle at .cursor/orchestration-bundle for landibuild.

.DESCRIPTION
  Primary consumer: Cursor (plans under .cursor/plans, state under .cursor/state, this bundle).

  - Skills: mirror from %USERPROFILE%\.config\opencode\skills\orchestration to
    <repo>/.cursor/orchestration-bundle/skills/orchestration
    (OpenCode global remains the usual source of truth for the skill tree; run sync after editing global.)

  - Agents: for each basename in $OrchestrationAgentBasenames:
      1) If <repo>/.cursor/agents/<name>.md exists, copy that (repo / Cursor wins).
      2) Else copy from %USERPROFILE%\.config\opencode\agents\<name>.md if present.
      3) Else skip and warn (missing in both places).

  - Excludes (skill tree only): directories node_modules, coverage, dist; files *.tmp

  - Writes .cursor/orchestration-bundle/bundle-version.txt (UTC timestamp, paths, counts).

  Excludes are also documented in scripts/sync-orchestration-bundle.syncignore (reference only).

.NOTES
  Idempotent for agents; skill destination is mirrored (/MIR on Windows — extra files under the skill tree removed).
  Fails if the orchestration skill source directory is missing.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/sync-orchestration-bundle.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptDir = $PSScriptRoot
$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $ScriptDir '..')).Path
$OpenCodeRoot = Join-Path $env:USERPROFILE '.config\opencode'
$SkillSource = Join-Path $OpenCodeRoot 'skills\orchestration'
$AgentsSource = Join-Path $OpenCodeRoot 'agents'
$RepoAgentsSource = Join-Path $RepoRoot '.cursor\agents'
$BundleRoot = Join-Path $RepoRoot '.cursor\orchestration-bundle'
$SkillDest = Join-Path $BundleRoot 'skills\orchestration'
$AgentsDest = Join-Path $BundleRoot 'agents'
$VersionFile = Join-Path $BundleRoot 'bundle-version.txt'

# Versioned list: orchestration workflow agents (basenames without .md). Duplicates removed.
$OrchestrationAgentBasenames = @(
    'multi-agent-coordinator',
    'orchestrator-builder',
    'coordinator',
    'error-coordinator',
    'context-manager',
    'research-analyst',
    'search-specialist',
    'architect-reviewer',
    'documentation-engineer',
    'refactoring-specialist',
    'ai-engineer',
    'opencode-architect-engineer',
    'tooling-engineer',
    'devops-engineer',
    'test-automator',
    'qa-expert',
    'platform-engineer',
    'ux-researcher',
    'dx-optimizer',
    'legacy-modernizer',
    'git-workflow-manager',
    'idea-log',
    'agent-builder',
    'chief-ux-ui-design',
    'content-marketer',
    'competitive-analyst',
    'market-researcher',
    'nextjs-developer',
    'python-pro',
    'sales-engineer',
    'security-engineer',
    'trend-analyst'
)

function Test-IsWindowsPlatform {
    # PS 5.1 has no $PSVersionTable.PSPlatform; rely on OS platform.
    return [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
}

function Sync-SkillTree {
    param(
        [string]$Source,
        [string]$Destination
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        throw "Orchestration skill source path is missing (required): $Source"
    }

    $null = New-Item -ItemType Directory -Path $Destination -Force

    if (Test-IsWindowsPlatform) {
        $robocopyArgs = @(
            $Source,
            $Destination,
            '/MIR',
            '/XD', 'node_modules', 'coverage', 'dist',
            '/XF', '*.tmp',
            '/R:2',
            '/W:1'
        )
        & robocopy.exe @robocopyArgs
        $rc = $LASTEXITCODE
        if ($rc -ge 8) {
            throw "robocopy failed with exit code $rc while syncing skill tree from $Source to $Destination"
        }
        return
    }

    $excludeDirs = @('node_modules', 'coverage', 'dist')
    $sourceFull = (Resolve-Path -LiteralPath $Source).Path

    if (Test-Path -LiteralPath $Destination) {
        Remove-Item -LiteralPath $Destination -Recurse -Force
    }
    $null = New-Item -ItemType Directory -Path $Destination -Force

    Get-ChildItem -LiteralPath $sourceFull -Recurse -File -Force | ForEach-Object {
        $full = $_.FullName
        $rel = $full.Substring($sourceFull.Length).TrimStart([char]'\', [char]'/')
        $parentRel = Split-Path -Parent $rel
        if ($parentRel) {
            $segments = $parentRel -split '[\\/]'
            foreach ($seg in $segments) {
                if ($excludeDirs -contains $seg) {
                    return
                }
            }
        }
        if ($_.Name -like '*.tmp') {
            return
        }
        $destPath = Join-Path $Destination $rel
        $destDir = Split-Path -Parent $destPath
        if (-not (Test-Path -LiteralPath $destDir)) {
            $null = New-Item -ItemType Directory -Path $destDir -Force
        }
        Copy-Item -LiteralPath $full -Destination $destPath -Force
    }
}

$null = New-Item -ItemType Directory -Path $BundleRoot -Force
$null = New-Item -ItemType Directory -Path $AgentsDest -Force

Write-Host "Syncing orchestration skill tree..."
Write-Host "  Source: $SkillSource"
Write-Host "  Dest:   $SkillDest"
Sync-SkillTree -Source $SkillSource -Destination $SkillDest

$missingAgents = [System.Collections.Generic.List[string]]::new()
$agentsFromRepo = [System.Collections.Generic.List[string]]::new()
$agentsFromGlobal = [System.Collections.Generic.List[string]]::new()

Write-Host "Syncing orchestration agents (repo .cursor/agents wins when present)..."
Write-Host "  Repo agents:  $RepoAgentsSource"
Write-Host "  Global agents: $AgentsSource"
foreach ($base in $OrchestrationAgentBasenames) {
    $name = "$base.md"
    $fromRepo = Join-Path $RepoAgentsSource $name
    $fromGlobal = Join-Path $AgentsSource $name
    $to = Join-Path $AgentsDest $name

    if (Test-Path -LiteralPath $fromRepo) {
        Copy-Item -LiteralPath $fromRepo -Destination $to -Force
        $agentsFromRepo.Add($name) | Out-Null
        continue
    }
    if (Test-Path -LiteralPath $fromGlobal) {
        Copy-Item -LiteralPath $fromGlobal -Destination $to -Force
        $agentsFromGlobal.Add($name) | Out-Null
        continue
    }
    $missingAgents.Add($name) | Out-Null
    Write-Warning "Skipping agent (not in repo .cursor/agents and not in global): $name"
}

$syncedAtUtc = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
$copiedTotal = $agentsFromRepo.Count + $agentsFromGlobal.Count
$versionLines = @(
    "synced_at_utc=$syncedAtUtc",
    "primary_consumer=cursor_landibuild",
    "synced_from_opencode_root=$OpenCodeRoot",
    "repo_agents_overlay_root=$RepoAgentsSource",
    "skills_source=$SkillSource",
    "agents_source=$AgentsSource",
    "agents_global_source=$AgentsSource",
    "skills_dest=$SkillDest",
    "agents_dest=$AgentsDest",
    "agent_files_from_repo=$($agentsFromRepo.Count)",
    "agent_files_from_opencode_global=$($agentsFromGlobal.Count)",
    "agent_files_total_bundle=$copiedTotal",
    "agent_files_missing_skipped=$($missingAgents.Count)"
)
Set-Content -LiteralPath $VersionFile -Value $versionLines -Encoding utf8

Write-Host ""
Write-Host "bundle-version.txt written: $VersionFile"
Write-Host ""
Write-Host "Agent files from repo .cursor/agents ($($agentsFromRepo.Count)):"
foreach ($f in ($agentsFromRepo | Sort-Object)) {
    Write-Host "  $f"
}
Write-Host "Agent files from OpenCode global only ($($agentsFromGlobal.Count)):"
foreach ($f in ($agentsFromGlobal | Sort-Object)) {
    Write-Host "  $f"
}
if ($missingAgents.Count -gt 0) {
    Write-Host ""
    Write-Host "Skipped (missing at source) ($($missingAgents.Count)):"
    foreach ($f in ($missingAgents | Sort-Object)) {
        Write-Host "  $f"
    }
}
