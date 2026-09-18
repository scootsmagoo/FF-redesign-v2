# Run ON the legacy web server (read-only on the source). Copies the files named in
# prodimages-manifest.txt out of the site's ProdImages folder, keeping sub-folders, then zip $Dest.
#   .\copy-prodimages.ps1 -Source "D:\inetpub\filtersfast\ProdImages" -Dest "D:\temp\ProdImages-export"
param([Parameter(Mandatory)][string]$Source, [Parameter(Mandatory)][string]$Dest, [string]$Manifest = "$PSScriptRoot\prodimages-manifest.txt")
$missing = New-Object System.Collections.Generic.List[string]; $copied = 0; $bytes = 0
foreach ($rel in Get-Content -LiteralPath $Manifest -Encoding UTF8) {
  if (-not $rel.Trim()) { continue }
  $from = Join-Path $Source ($rel -replace "/", "\")
  if (-not (Test-Path -LiteralPath $from -PathType Leaf)) { $missing.Add($rel); continue }
  $to = Join-Path $Dest ($rel -replace "/", "\")
  New-Item -ItemType Directory -Force -Path (Split-Path $to) | Out-Null
  Copy-Item -LiteralPath $from -Destination $to -Force
  $copied++; $bytes += (Get-Item -LiteralPath $from).Length
}
$missing | Set-Content -LiteralPath (Join-Path $Dest "_missing.txt") -Encoding UTF8
Write-Host ("copied {0} files, {1:N0} MB; {2} listed files not found (see _missing.txt)" -f $copied, ($bytes / 1MB), $missing.Count)
