#requires -Version 7.2
<#
.SYNOPSIS
  Mirrors OpenCode orchestration skill tree and a fixed agent set into .cursor/orchestration-bundle.

.DESCRIPTION
  - Skills: recursive copy from %USERPROFILE%\.config\opencode\skills\orchestration to
    <repo>/.cursor/orchestration-bundle/skills/orchestration
  - Excludes (skill tree only): directories node_modules, coverage, dist; files *.tmp
  - Agents: copies only basenames listed in $OrchestrationAgentBasenames (skip missing sources)
  - Writes .cursor/orchestration-bundle/bundle-version.txt (UTC ISO timestamp + synced_from paths)

  Excludes are also documented in scripts/sync-orchestration-bundle.syncignore (reference only).

.NOTES
  Idempotent: safe to re-run; skill destination is mirrored (extra files under the skill tree removed).
  Fails if the orchestration skill source directory is missing.

.EXAMPLE
  pwsh -File scripts/sync-orchestration-bundle.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptDir = $PSScriptRoot
$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $ScriptDir '..')).Path
$OpenCodeRoot = Join-Path $env:USERPROFILE '.config\opencode'
$SkillSource = Join-Path $OpenCodeRoot 'skills\orchestration'
$AgentsSource = Join-Path $OpenCodeRoot 'agents'
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
    return ($PSVersionTable.PSPlatform -eq 'Win32NT') -or ([System.Environment]::OSVersion.Platform -eq 'Win32NT')
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
$copiedAgents = [System.Collections.Generic.List[string]]::new()

Write-Host "Syncing orchestration agents..."
foreach ($base in $OrchestrationAgentBasenames) {
    $name = "$base.md"
    $from = Join-Path $AgentsSource $name
    if (-not (Test-Path -LiteralPath $from)) {
        $missingAgents.Add($name) | Out-Null
        Write-Warning "Skipping missing agent file: $from"
        continue
    }
    $to = Join-Path $AgentsDest $name
    Copy-Item -LiteralPath $from -Destination $to -Force
    $copiedAgents.Add($name) | Out-Null
}

$syncedAtUtc = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
$versionLines = @(
    "synced_at_utc=$syncedAtUtc",
    "synced_from_opencode_root=$OpenCodeRoot",
    "skills_source=$SkillSource",
    "agents_source=$AgentsSource",
    "skills_dest=$SkillDest",
    "agents_dest=$AgentsDest",
    "agent_files_copied=$($copiedAgents.Count)",
    "agent_files_missing_skipped=$($missingAgents.Count)"
)
Set-Content -LiteralPath $VersionFile -Value $versionLines -Encoding utf8

Write-Host ""
Write-Host "bundle-version.txt written: $VersionFile"
Write-Host ""
Write-Host "Copied agent files ($($copiedAgents.Count)):"
foreach ($f in ($copiedAgents | Sort-Object)) {
    Write-Host "  $f"
}
if ($missingAgents.Count -gt 0) {
    Write-Host ""
    Write-Host "Skipped (missing at source) ($($missingAgents.Count)):"
    foreach ($f in ($missingAgents | Sort-Object)) {
        Write-Host "  $f"
    }
}
