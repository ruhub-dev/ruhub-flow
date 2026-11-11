$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new()
Add-Type -AssemblyName System.Windows.Forms
Write-Host 'Обновление RUHUB Flow 3.0.1: мобильная версия, библиотека и удаление схем' -ForegroundColor Cyan
Write-Host 'Сначала остановите прежний START_INTERNET.cmd сочетанием Ctrl+C.'
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Выберите существующую папку RUHUB-Flow (в ней лежат START_INTERNET.cmd, data и runtime)'
$dialog.ShowNewFolderButton = $false
if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { Write-Host 'Обновление отменено.'; exit 0 }
$target = $dialog.SelectedPath
if (!(Test-Path -LiteralPath (Join-Path $target 'runtime\node.exe')) -or !(Test-Path -LiteralPath (Join-Path $target 'app\server.mjs')) -or !(Test-Path -LiteralPath (Join-Path $target 'data\flow.sqlite'))) { throw 'Это не рабочая папка RUHUB Flow. Выберите папку с runtime\node.exe и data\flow.sqlite.' }
$running = Get-CimInstance Win32_Process -Filter "name='node.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($target, [StringComparison]::OrdinalIgnoreCase) -ge 0 }
if ($running) { throw 'RUHUB Flow ещё работает. Остановите его Ctrl+C в окне запуска и повторите обновление.' }
$payload = Join-Path $PSScriptRoot 'files'
$allowed = @('app','public','migrations','launcher.mjs','github-publisher.mjs','github-request.ps1','SETUP_GITHUB.cmd','SETUP_GITHUB.ps1','PERMANENT_LINK_RU.txt')
$actual = @(Get-ChildItem -LiteralPath $payload -Force)
if (@($actual | Where-Object { $_.Name -notin $allowed }).Count -gt 0) { throw 'Неверный состав обновления.' }
$backup = Join-Path $target ('updates\before-v3-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$null = New-Item -ItemType Directory -Path $backup -Force
function Copy-Tree([string]$Source, [string]$Destination) {
    if (Test-Path -LiteralPath $Source -PathType Container) {
        $null = New-Item -ItemType Directory -Path $Destination -Force
        foreach ($child in Get-ChildItem -LiteralPath $Source -Force) { Copy-Tree $child.FullName (Join-Path $Destination $child.Name) }
    } else { Copy-Item -LiteralPath $Source -Destination $Destination -Force }
}
foreach ($name in $allowed) {
    $old = Join-Path $target $name
    if (Test-Path -LiteralPath $old) { Copy-Tree $old (Join-Path $backup $name) }
}
foreach ($item in $actual) { Copy-Tree $item.FullName (Join-Path $target $item.Name) }
Write-Host ''
Write-Host 'Обновление установлено. База data и резервные копии не изменялись.' -ForegroundColor Green
Write-Host ('Прежние файлы программы: ' + $backup)
if (Test-Path -LiteralPath (Join-Path $target 'data\github-token.dpapi')) {
    Write-Host 'Сохранённый ключ GitHub оставлен на месте. Запустите START_INTERNET.cmd.'
} else {
    Write-Host 'Сейчас откроется однократная настройка GitHub.'
    Start-Process -FilePath (Join-Path $target 'SETUP_GITHUB.cmd') -WorkingDirectory $target
}
