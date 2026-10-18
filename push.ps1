# push.ps1 — Invalida cache PWA, compila assets e faz push para GitHub
# Uso: .\push.ps1 ["mensagem opcional de commit"]
param(
    [string]$CommitMessage = "",
    [string]$TargetVersion = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$versionFile = Join-Path $PSScriptRoot 'version.txt'
$swFile      = Join-Path $PSScriptRoot 'sw.js'
$pkgFile     = Join-Path $PSScriptRoot 'package.json'
$htmlFile    = Join-Path $PSScriptRoot 'index.html'

# 1. Le e incrementa o patch (ou usa TargetVersion se fornecido)
$current = (Get-Content $versionFile -Raw).Trim()
if ($TargetVersion -ne "") {
    $newVer = $TargetVersion
} elseif ($current -match '(\d+)\.(\d+)(?:\.(\d+))?') {
    $major = $Matches[1]
    $minor = $Matches[2]
    $patch = if ($Matches[3]) { [int]$Matches[3] + 1 } else { 1 }
    $newVer = "$major.$minor.$patch"
} else {
    $newVer = "1.3.0"
}

Write-Host "Atualizando versao: $current -> $newVer" -ForegroundColor Cyan

# 2. Grava version.txt
[System.IO.File]::WriteAllText($versionFile, $newVer)

# 3. Atualiza sw.js (SW_VERSION)
$sw = [System.IO.File]::ReadAllText($swFile)
$pattern = "const SW_VERSION = '[^']+';"
$replacement = "const SW_VERSION = '$newVer';"
$swNew = [regex]::Replace($sw, $pattern, $replacement)
[System.IO.File]::WriteAllText($swFile, $swNew)
Write-Host "SW_VERSION atualizada para: $newVer" -ForegroundColor Green

# 4. Atualiza package.json
$pkg = [System.IO.File]::ReadAllText($pkgFile)
$pkgPattern = '"version":\s*"[^"]+"'
$pkgReplacement = '"version": "' + $newVer + '"'
$pkgNew = [regex]::Replace($pkg, $pkgPattern, $pkgReplacement)
[System.IO.File]::WriteAllText($pkgFile, $pkgNew)

# 5. Atualiza meta version em index.html e app.html
$html = [System.IO.File]::ReadAllText($htmlFile)
$metaPattern = '<meta name="version" content="[^"]*">'
$metaReplacement = '<meta name="version" content="' + $newVer + '">'
$htmlNew = [regex]::Replace($html, $metaPattern, $metaReplacement)
[System.IO.File]::WriteAllText($htmlFile, $htmlNew)

$appHtmlFile = Join-Path $PSScriptRoot 'app.html'
if (Test-Path $appHtmlFile) {
    $appHtml = [System.IO.File]::ReadAllText($appHtmlFile)
    $appHtmlNew = [regex]::Replace($appHtml, $metaPattern, $metaReplacement)
    [System.IO.File]::WriteAllText($appHtmlFile, $appHtmlNew)
}

# 6. Compila bundle de producao (dist/)
Write-Host "Compilando assets (dist/)..." -ForegroundColor Yellow
node build.js

# 7. Executa suite de testes
Write-Host "Executando testes..." -ForegroundColor Yellow
npm test

# 8. Git add, commit e push
git add .
$msg = if ($CommitMessage -ne "") { $CommitMessage } else { "chore: bump versao para v$newVer e atualiza cache" }
git commit -m $msg
git push origin main
Write-Host "Push concluido com sucesso! Versao v$newVer publicada com cache limpo." -ForegroundColor Magenta
