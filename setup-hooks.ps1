# Confeitex - Configura os hooks do git
# Execute uma vez para ativar as validacoes automaticas.

Write-Host "=== Confeitex - Setup Git Hooks ===" -ForegroundColor Cyan
Write-Host ""

$hooksDir = Join-Path $PSScriptRoot ".githooks"

if (-not (Test-Path $hooksDir)) {
    Write-Host "[ERRO] Diretorio .githooks nao encontrado." -ForegroundColor Red
    exit 1
}

git config core.hooksPath ".githooks"

if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] git config core.hooksPath = .githooks" -ForegroundColor Green
} else {
    Write-Host "  [ERRO] Falha ao configurar hooksPath" -ForegroundColor Red
    exit 1
}

try {
    icacls "$hooksDir\pre-commit" /grant "Everyone:RX" 2>$null
} catch { }

Write-Host ""
Write-Host "Pronto! O hook pre-commit sera executado automaticamente" -ForegroundColor Green
Write-Host "antes de cada commit para validar integridade do codigo." -ForegroundColor Green
Write-Host ""
Write-Host "Para testar manualmente:" -ForegroundColor Cyan
Write-Host "  .githooks\pre-commit.ps1" -ForegroundColor White
