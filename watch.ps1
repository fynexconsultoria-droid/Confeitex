# Confeitex - File Watcher + Test Runner Automatico
# Monitora alteracoes nos arquivos e executa as validacoes automaticamente.

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $PSScriptRoot
$watcher.IncludeSubdirectories = $true
$watcher.Filter = '*.*'
$watcher.EnableRaisingEvents = $true

$extensions = @('.js', '.html', '.css')
$debounce = 500
$lastRun = 0

$action = {
    $file = $Event.SourceEventArgs.FullPath
    $ext = [System.IO.Path]::GetExtension($file)
    if ($ext -notin @('.js', '.html', '.css')) { return }
    if ($file -match '\\node_modules\\|\\\.git\\|\\teste\.html$') { return }

    $now = [Environment]::TickCount
    if ($now - $script:lastRun -lt $script:debounce) { return }
    $script:lastRun = $now

    Clear-Host
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host "  Arquivo alterado: $([System.IO.Path]::GetFileName($file))" -ForegroundColor Magenta
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host ""

    # 1. Roda as validacoes CLI (mesmas do pre-commit)
    & "$using:PSScriptRoot\.githooks\pre-commit.ps1"

    # 2. Abre o teste.html no navegador (com cache buster)
    $testUrl = "file:///$($using:PSScriptRoot.Replace('\','/'))/teste.html?t=$([DateTime]::Now.Ticks)"
    Start-Process $testUrl
}

Register-ObjectEvent -InputObject $watcher -EventName "Changed" -Action $action | Out-Null
Register-ObjectEvent -InputObject $watcher -EventName "Created" -Action $action | Out-Null
Register-ObjectEvent -InputObject $watcher -EventName "Renamed" -Action $action | Out-Null

Clear-Host
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Confeitex - Watch de Testes Automaticos" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Monitorando alteracoes em .js, .html e .css..." -ForegroundColor Yellow
Write-Host "Pressione CTRL+C para parar." -ForegroundColor Yellow
Write-Host ""

# Mantem o script rodando
while ($true) {
    Start-Sleep -Seconds 1
}
