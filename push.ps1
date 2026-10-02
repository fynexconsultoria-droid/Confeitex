# push.ps1 — Invalida cache PWA e faz push
# Uso: .\push.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$versionFile = Join-Path $PSScriptRoot 'version.txt'
$swFile      = Join-Path $PSScriptRoot 'sw.js'

# 1. Le e incrementa o patch
$current = (Get-Content $versionFile -Raw).Trim()
if ($current -notmatch '^(\d+)\.(\d+)\.(\d+)$') {
    Write-Error "Versao invalida em version.txt"
    exit 1
}
$newVer = "$($Matches[1]).$($Matches[2]).$([int]$Matches[3] + 1)"
Write-Host "Versao: $current -> $newVer" -ForegroundColor Cyan

# 2. Grava version.txt
[System.IO.File]::WriteAllText($versionFile, $newVer)

# 3. Substitui SW_VERSION em sw.js via string simples
$sw = [System.IO.File]::ReadAllText($swFile)
$oldLine = 'const SW_VERSION = ' + "'" + $current + "';"
$newLine = 'const SW_VERSION = ' + "'" + $newVer  + "';"

if ($sw.Contains($oldLine)) {
    $swNew = $sw.Replace($oldLine, $newLine)
    [System.IO.File]::WriteAllText($swFile, $swNew)
    Write-Host "Cache: confeitex-cache-v$newVer" -ForegroundColor Green
} else {
    Write-Warning "Linha SW_VERSION nao encontrada com versao $current"
    # Fallback via regex puro — monta padrao sem aspas especiais no shell
    $pattern = 'const SW_VERSION = ' + "'" + '[^' + "'" + ']+' + "'" + ';'
    $swNew = [regex]::Replace($sw, $pattern, $newLine)
    [System.IO.File]::WriteAllText($swFile, $swNew)
    Write-Host "Cache atualizado via regex." -ForegroundColor Yellow
}

# 4. Commit + push
git add version.txt sw.js
git commit -m "chore: bump cache para v$newVer"
git push
Write-Host "Push concluido com cache limpo!" -ForegroundColor Magenta
