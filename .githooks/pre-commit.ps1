# Confeitex - Pre-commit Validation Script
# Executa verificacoes de integridade antes de cada commit.

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$errors = @()
$warnings = @()

Write-Host ""
Write-Host "=== Confeitex Pre-commit Validation ===" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# 1. Verifica se a versao no changelog corresponde a verAtual
# ============================================================
$updatesJs = Get-Content "$rootDir\js\updates.js" -Raw
$verAtualMatch = [regex]::Match($updatesJs, "verAtual:\s*'([\d.]+)'")
$changelogVerMatch = [regex]::Match($updatesJs, "{ ver:\s*'([\d.]+)'")

if ($verAtualMatch.Success -and $changelogVerMatch.Success) {
    $verAtual = $verAtualMatch.Groups[1].Value
    $changelogFirst = $changelogVerMatch.Groups[1].Value
    if ($verAtual -ne $changelogFirst) {
        $errors += "versao atual '$verAtual' difere da primeira entrada do changelog '$changelogFirst'"
    } else {
        Write-Host "  [OK] verAtual ($verAtual) = changelog" -ForegroundColor Green
    }
}

# ============================================================
# 2. IDs mortos - nenhum JS deve referenciar elementos removidos
# ============================================================
$deadIds = @(
    'updateOverlay', 'updateProgressBar', 'updateProgressPercent',
    'updateStatusText', 'updateStageText', 'updateProgressBytes',
    'btnReloadNow', 'btnCloseApp'
)

$jsFiles = Get-ChildItem "$rootDir\js\*.js" -Exclude "*.min.js"
$hasDeadRef = $false
foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw
    foreach ($id in $deadIds) {
        if ($content -match [regex]::Escape($id)) {
            $relative = Resolve-Path -Path $file.FullName -Relative
            $errors += "'$id' encontrado em $relative (codigo morto)"
            $hasDeadRef = $true
        }
    }
}

if (-not $hasDeadRef) {
    Write-Host "  [OK] Nenhuma referencia a IDs de overlay antigo" -ForegroundColor Green
}

# ============================================================
# 3. Chaves fyntex_ nao devem existir nos JS (legado)
# ============================================================
$hasFyntex = $false
foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match 'fyntex_') {
        $relative = Resolve-Path -Path $file.FullName -Relative
        $warnings += "'fyntex_' encontrado em $relative (migrar para confeitex_ se aplicavel)"
        $hasFyntex = $true
    }
}

if (-not $hasFyntex) {
    Write-Host "  [OK] Nenhuma chave fyntex_ nos JS" -ForegroundColor Green
}

# ============================================================
# 4. Elementos obrigatorios do banner no HTML
# ============================================================
$indexHtml = Get-Content "$rootDir\index.html" -Raw
$requiredElements = @(
    'updateNotification', 'updateNotifText', 'btnUpdateNow',
    'btnUpdateLater', 'btnUpdateCloseApp'
)

$missingElements = @()
foreach ($el in $requiredElements) {
    if ($indexHtml -notmatch "id=\`"$el\`"") {
        $missingElements += $el
    }
}

if ($missingElements.Count -eq 0) {
    Write-Host "  [OK] Todos os elementos do banner existem no HTML" -ForegroundColor Green
} else {
    foreach ($el in $missingElements) {
        $errors += "Elemento '#$el' nao encontrado no index.html"
    }
}

# ============================================================
# 5. console.log - avisar sobre logs esquecidos
# ============================================================
$hasConsoleLog = $false
foreach ($file in $jsFiles) {
    $lines = Get-Content $file.FullName
    $lineNum = 0
    foreach ($line in $lines) {
        $lineNum++
        if ($line -match 'console\.(log|warn|error)\(' -and $line -notmatch '//.*console\.') {
            $relative = Resolve-Path -Path $file.FullName -Relative
            $warnings += "$relative($lineNum): $($line.Trim())"
            $hasConsoleLog = $true
        }
    }
}

if ($hasConsoleLog) {
    Write-Host "  [!] console.log encontrado (avisos abaixo)" -ForegroundColor Yellow
} else {
    Write-Host "  [OK] Sem console.log nos arquivos" -ForegroundColor Green
}

# ============================================================
# 6. Verifica se HTML tem o banner de atualizacao
# ============================================================
if ($indexHtml -notmatch 'class="update-notif-bar"') {
    $errors += "Banner .update-notif-bar nao encontrado no index.html"
}

# ============================================================
# 7. Duplicacao de IDs HTML
# ============================================================
$idCounts = @{}
$idMatches = [regex]::Matches($indexHtml, 'id="([^"]+)"')
foreach ($m in $idMatches) {
    $id = $m.Groups[1].Value
    $idCounts[$id] = if ($idCounts.ContainsKey($id)) { $idCounts[$id] + 1 } else { 1 }
}
$duplicatedIds = $idCounts.GetEnumerator() | Where-Object { $_.Value -gt 1 }
if ($duplicatedIds) {
    foreach ($d in $duplicatedIds) {
        $warnings += "ID duplicado no HTML: '$($d.Key)' aparece $($d.Value) vezes"
    }
} else {
    Write-Host "  [OK] Nenhum ID duplicado no HTML" -ForegroundColor Green
}

# ============================================================
# 8. Duplicacao de objetos/funcoes principais entre os JS
# ============================================================
$globalNames = @('State', 'Orders', 'Clients', 'Dashboard', 'Settings', 'Updates', 'Notifications', 'Auth', 'Chart', 'UI', 'PWA')
$definedConsts = @{}
foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw
    $matches = [regex]::Matches($content, '(?:const|let|var)\s+(State|Orders|Clients|Dashboard|Settings|Updates|Notifications|Auth|Chart|UI)\s*=')
    foreach ($m in $matches) {
        $name = $m.Groups[1].Value
        if (-not $definedConsts.ContainsKey($name)) { $definedConsts[$name] = @() }
        $definedConsts[$name] += $file.Name
    }
}
$duplicatedGlobal = $definedConsts.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 }
if ($duplicatedGlobal) {
    foreach ($d in $duplicatedGlobal) {
        $errors += "Objeto global '$($d.Key)' definido em: $($d.Value -join ', ')"
    }
} else {
    Write-Host "  [OK] Nenhum objeto global duplicado entre os JS" -ForegroundColor Green
}

# ============================================================
# 9. Duplicacao de metodos entre os modulos
# ============================================================
$methodCounts = @{}
foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw
    $methodMatches = [regex]::Matches($content, '\w+\s*:\s*(?:async\s+)?function\s*\(|(\w+)\(\)\s*\{')
    foreach ($m in $methodMatches) {
        $name = $m.Groups[1].Value
        if ($name -and $name.Length -gt 2) {
            if (-not $methodCounts.ContainsKey($name)) { $methodCounts[$name] = @() }
            $methodCounts[$name] += $file.Name
        }
    }
}
$duplicatedMethods = $methodCounts.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 -and $_.Key -notin @('init', 'render', 'setup', 'update', 'check', 'load', 'enable', 'disable', 'toggle') }
if ($duplicatedMethods) {
    foreach ($d in $duplicatedMethods) {
        $warnings += "Metodo '$($d.Key)' aparece em: $(($d.Value | Select-Object -Unique) -join ', ')"
    }
}

# ============================================================
# Resultado final
# ============================================================
Write-Host ""

if ($errors.Count -gt 0) {
    Write-Host "===  ERROS ENCONTRADOS  ===" -ForegroundColor Red
    foreach ($e in $errors) { Write-Host "  - $e" -ForegroundColor Red }
    Write-Host ""
    Write-Host "Corrija os erros antes de commitar." -ForegroundColor Red
    exit 1
}

if ($warnings.Count -gt 0) {
    Write-Host "===  ATENCAO: AVISOS (nao bloqueiam)  ===" -ForegroundColor Yellow
    foreach ($w in $warnings) { Write-Host "  - $w" -ForegroundColor Yellow }
    Write-Host ""
}

Write-Host "===  VALIDACAO PASSOU  ===" -ForegroundColor Green
Write-Host ""
exit 0
