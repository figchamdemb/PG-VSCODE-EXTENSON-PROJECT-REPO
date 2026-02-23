param(
  [ValidateSet("quick", "named", "service-token")]
  [string]$Mode = "quick",
  [string]$TunnelName = "pg-ext-narrate",
  [string]$Hostname = "pg-ext.addresly.com",
  [string]$OriginUrl = "http://127.0.0.1:8787",
  [string]$Token = "",
  [switch]$InstallService
)

$ErrorActionPreference = "Stop"

function Get-CloudflaredPath {
  $fromPath = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($fromPath) {
    return $fromPath.Source
  }

  $knownPaths = @(
    "C:\Program Files (x86)\cloudflared\cloudflared.exe",
    "C:\Program Files\cloudflared\cloudflared.exe"
  )
  foreach ($candidate in $knownPaths) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }
  throw "cloudflared not found. Install it first with: winget install -e --id Cloudflare.cloudflared"
}

function Ensure-CloudflaredInstalled {
  $cloudflared = Get-CloudflaredPath
  & $cloudflared --version | Write-Host
  return $cloudflared
}

function Ensure-CloudflareLogin([string]$cloudflared) {
  $cfDir = Join-Path $HOME ".cloudflared"
  $certPath = Join-Path $cfDir "cert.pem"
  if (-not (Test-Path $certPath)) {
    Write-Host "No Cloudflare cert found. Starting login flow..."
    & $cloudflared tunnel login
  }
  if (-not (Test-Path $certPath)) {
    throw "Cloudflare login did not produce cert.pem in $cfDir"
  }
}

function Get-OrCreateTunnel([string]$cloudflared, [string]$name) {
  $listJson = & $cloudflared tunnel list --output json
  $tunnels = $listJson | ConvertFrom-Json
  $existing = $tunnels | Where-Object { $_.name -eq $name } | Select-Object -First 1
  if ($existing) {
    return $existing.id
  }

  Write-Host "Creating tunnel: $name"
  & $cloudflared tunnel create $name | Write-Host

  $listJsonAfter = & $cloudflared tunnel list --output json
  $tunnelsAfter = $listJsonAfter | ConvertFrom-Json
  $created = $tunnelsAfter | Where-Object { $_.name -eq $name } | Select-Object -First 1
  if (-not $created) {
    throw "Tunnel '$name' was not found after create."
  }
  return $created.id
}

function Write-TunnelConfig([string]$tunnelId, [string]$hostname, [string]$originUrl) {
  $cfDir = Join-Path $HOME ".cloudflared"
  if (-not (Test-Path $cfDir)) {
    New-Item -ItemType Directory -Path $cfDir | Out-Null
  }
  $credFile = Join-Path $cfDir "$tunnelId.json"
  $configPath = Join-Path $cfDir "config.yml"
  $config = @(
    "tunnel: $tunnelId",
    "credentials-file: $credFile",
    "ingress:",
    "  - hostname: $hostname",
    "    service: $originUrl",
    "  - service: http_status:404"
  ) -join "`n"
  Set-Content -Path $configPath -Value $config
  Write-Host "Wrote config: $configPath"
}

$cloudflaredExe = Ensure-CloudflaredInstalled

switch ($Mode) {
  "quick" {
    Write-Host "Starting quick tunnel to $OriginUrl"
    & $cloudflaredExe tunnel --url $OriginUrl
  }
  "named" {
    Ensure-CloudflareLogin -cloudflared $cloudflaredExe
    $tunnelId = Get-OrCreateTunnel -cloudflared $cloudflaredExe -name $TunnelName
    Write-Host "Tunnel ID: $tunnelId"
    Write-Host "Routing DNS hostname '$Hostname' to tunnel '$TunnelName'..."
    & $cloudflaredExe tunnel route dns $TunnelName $Hostname | Write-Host
    Write-TunnelConfig -tunnelId $tunnelId -hostname $Hostname -originUrl $OriginUrl

    if ($InstallService) {
      Write-Host "Installing cloudflared service..."
      & $cloudflaredExe service install
      Write-Host "Service installed. Use Windows Services to start/stop cloudflared."
    } else {
      Write-Host "Starting named tunnel in foreground..."
      & $cloudflaredExe tunnel run $TunnelName
    }
  }
  "service-token" {
    if (-not $Token) {
      throw "Token is required for service-token mode. Pass -Token '<cloudflare tunnel token>'."
    }
    Write-Host "Installing cloudflared service with token..."
    & $cloudflaredExe service install $Token
    Write-Host "Service installed."
  }
}
