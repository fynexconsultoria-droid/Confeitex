# push.ps1 — Invalida cache PWA, compila assets e faz push para GitHub
# Uso: .\push.ps1 ["mensagem opcional de commit"] [-TargetVersion "x.y.z"]
param(
    [string]$CommitMessage = "",
    [string]$TargetVersion = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Exec-Command {
    param([scriptblock]$Command, [string]$ErrorMessage)
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$ErrorMessage (Código de saída: $LASTEXITCODE)"
    }
}

$versionFile = Join-Path $PSScriptRoot 'version.txt'
$swFile      = Join-Path $PSScriptRoot 'sw.js'
$pkgFile     = Join-Path $PSScriptRoot 'package.json'
$htmlFile    = Join-Path $PSScriptRoot 'index.html'
$appHtmlFile = Join-Path $PSScriptRoot 'app.html'

# 1. Executa a suite de testes ANTES de alterar versões
Write-Host "Executando suite de testes..." -ForegroundColor Yellow
Exec-Command { npm test } "A suite de testes falhou! O push foi abortado sem alterar a versao."

# 2. Compila bundle de teste/producao
Write-Host "Compilando assets..." -ForegroundColor Yellow
Exec-Command { node build.js } "A compilacao falhou! O push foi abortado."

# 3. Le e incrementa o patch (ou usa TargetVersion se fornecido)
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

# 4. Grava version.txt
[System.IO.File]::WriteAllText($versionFile, $newVer)

# 5. Atualiza sw.js (SW_VERSION)
$sw = [System.IO.File]::ReadAllText($swFile)
$pattern = "const SW_VERSION = '[^']+';"
$replacement = "const SW_VERSION = '$newVer';"
$swNew = [regex]::Replace($sw, $pattern, $replacement)
[System.IO.File]::WriteAllText($swFile, $swNew)
Write-Host "SW_VERSION atualizada para: $newVer" -ForegroundColor Green

# 6. Atualiza package.json
$pkg = [System.IO.File]::ReadAllText($pkgFile)
$pkgPattern = '"version":\s*"[^"]+"'
$pkgReplacement = '"version": "' + $newVer + '"'
$pkgNew = [regex]::Replace($pkg, $pkgPattern, $pkgReplacement)
[System.IO.File]::WriteAllText($pkgFile, $pkgNew)

# 7. Atualiza meta version em index.html e app.html
$metaPattern = '<meta name="version" content="[^"]*">'
$metaReplacement = '<meta name="version" content="' + $newVer + '">'

$html = [System.IO.File]::ReadAllText($htmlFile)
$htmlNew = [regex]::Replace($html, $metaPattern, $metaReplacement)
[System.IO.File]::WriteAllText($htmlFile, $htmlNew)

if (Test-Path $appHtmlFile) {
    $appHtml = [System.IO.File]::ReadAllText($appHtmlFile)
    $appHtmlNew = [regex]::Replace($appHtml, $metaPattern, $metaReplacement)
    [System.IO.File]::WriteAllText($appHtmlFile, $appHtmlNew)
}

# 8. Recompila assets com a nova versao gravada
Write-Host "Recompilando assets para versao final v$newVer..." -ForegroundColor Yellow
Exec-Command { node build.js } "Falha na compilacao final."

# 9. Git add controlado e push
$trackedPaths = @(
    'version.txt', 'sw.js', 'package.json', 'package-lock.json',
    'index.html', 'app.html', 'privacidade.html', 'termos.html',
    'style.css', 'manifest.json', 'build.js', 'push.ps1', 'README.md',
    'CNAME', 'robots.txt', 'sitemap.xml', 'js', 'css', 'api', 'tests', 'icons', 'vendor'
)

foreach ($item in $trackedPaths) {
    if (Test-Path (Join-Path $PSScriptRoot $item)) {
        git add $item
    }
}

$msg = if ($CommitMessage -ne "") { $CommitMessage } else { "chore: bump versao para v$newVer e atualiza cache" }
git commit -m $msg
Exec-Command { git push origin (git branch --show-current) } "Falha ao enviar commits para o repositorio remoto."

Write-Host "Push concluido com sucesso! Versao v$newVer publicada com cache limpo." -ForegroundColor Magenta
