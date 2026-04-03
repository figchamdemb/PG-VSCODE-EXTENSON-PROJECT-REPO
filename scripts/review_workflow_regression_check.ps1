param()

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$scriptPath = Join-Path $repoRoot "scripts\review_workflow.ps1"
$scratchPage = Join-Path $repoRoot "Memory-bank\_generated\review-workflow-null-path-regression.md"

try {
    Push-Location $repoRoot

    $sourceText = Get-Content -LiteralPath $scriptPath -Raw -Encoding utf8
    $jsonCompatIndex = $sourceText.IndexOf("function ConvertFrom-JsonCompat")
    $resolveAccessTokenIndex = $sourceText.IndexOf("function Resolve-AccessToken")
    if ($jsonCompatIndex -lt 0 -or $resolveAccessTokenIndex -lt 0) {
        throw "review_workflow.ps1 no longer contains the expected helper functions."
    }
    if ($jsonCompatIndex -gt $resolveAccessTokenIndex) {
        throw "ConvertFrom-JsonCompat must stay defined before Resolve-AccessToken."
    }

    $null = . .\scripts\review_workflow.ps1 -Action status -Json 2>$null

    $page = [pscustomobject][ordered]@{
        page_title = "Regression Null Path"
        page_id = "regression-null-path"
        page_file = "Memory-bank/_generated/review-workflow-null-path-regression.md"
        status = "builder_in_progress"
        next_actor = "builder"
        current_round = 0
        details = "Regression coverage for null changed_paths entries."
        changed_paths = @("", $null, "scripts/review_workflow.ps1")
        findings = @()
        responses = @()
        approvals = @()
    }

    Write-PageMarkdown -Page $page

    if (-not (Test-Path -LiteralPath $scratchPage)) {
        throw "Write-PageMarkdown did not write the regression scratch page."
    }

    $content = Get-Content -LiteralPath $scratchPage -Raw -Encoding utf8
    if ($content -notmatch [regex]::Escape("scripts/review_workflow.ps1")) {
        throw "Write-PageMarkdown did not retain the non-empty changed path entry."
    }
    if ($content -match "(?m)^-\s*$") {
        throw "Write-PageMarkdown emitted a blank changed-path bullet."
    }

    Write-Host "review workflow regression check passed"
}
finally {
    Pop-Location -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $scratchPage) {
        Remove-Item -LiteralPath $scratchPage -Force -ErrorAction SilentlyContinue
    }
}