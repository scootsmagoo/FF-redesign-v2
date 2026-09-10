<#
.SYNOPSIS
  Exports the legacy FiltersFast SQL Server tables needed for the v2 migration.

.DESCRIPTION
  Runs every numbered .sql file in this folder with sqlcmd and writes one
  tab-delimited UTF-16 file per query (bcp-compatible, safe for HTML content).
  Read-only: every script is a SELECT.

.EXAMPLE
  .\Export-Legacy.ps1 -Server "SQLHOST\INSTANCE" -Database "filtersfast" -Out "..\..\packages\db\import\legacy"
  .\Export-Legacy.ps1 -Server "SQLHOST" -Database "filtersfast" -Out "C:\ff-export" -Username ro_user
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string] $Server,
  [Parameter(Mandatory)] [string] $Database,
  [Parameter(Mandatory)] [string] $Out,
  [string] $Username,
  [switch] $SkipPersonalData
)

$ErrorActionPreference = 'Stop'
if (-not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) {
  throw "sqlcmd not found. Install SQL Server command line tools (ships with SSMS) or add it to PATH."
}
New-Item -ItemType Directory -Force -Path $Out | Out-Null

$auth = @('-E')
if ($Username) {
  $pw = Read-Host -AsSecureString "Password for $Username"
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw))
  $auth = @('-U', $Username, '-P', $plain)
}

$files = Get-ChildItem -Path $PSScriptRoot -Filter '*.sql' | Sort-Object Name
foreach ($f in $files) {
  if ($SkipPersonalData -and $f.Name -match '^(13|14|15)-') { Write-Host "skip $($f.Name) (personal data)"; continue }
  $target = Join-Path $Out ($f.BaseName + '.tsv')
  Write-Host "exporting $($f.Name) -> $target"
  # -s tab separator, -W trim, -h -1 no header row (we keep headers via the first SELECT column names? no: keep header)
  # -y 0 / -Y 0 = unlimited column width so long HTML is not truncated. -f 65001 = UTF-8 output.
  & sqlcmd -S $Server -d $Database @auth -i $f.FullName -o $target -s "`t" -W -y 0 -Y 0 -f 65001 -b
  if ($LASTEXITCODE -ne 0) { Write-Warning "sqlcmd returned $LASTEXITCODE for $($f.Name); check the file for the error text." }
}
Write-Host "Done. Files are in $Out. Zip that folder and send it privately (13-15 contain personal data)."
