$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$root = $PSScriptRoot
$credentialPath = Join-Path $root 'data\github-token.dpapi'
$settings = 'https://github.com/settings/personal-access-tokens/new?name=RUHUB%20Flow%20Link&description=Update%20RUHUB%20Flow%20server%20address&target_name=ruhub-dev&contents=write&expires_in=365'
Write-Host ''
Write-Host 'Однократное подключение постоянной ссылки RUHUB Flow' -ForegroundColor Cyan
Write-Host '1. В браузере войдите в GitHub под ruhub-dev.'
Write-Host '2. Repository access: Only select repositories -> ruhub-flow.'
Write-Host '3. Repository permissions: Contents -> Read and write.'
Write-Host '4. Нажмите Generate token и скопируйте полученный ключ.'
Write-Host 'Новые аккаунты не нужны. Ключ вставляется только здесь, НЕ в чат.'
Start-Process $settings
$secureToken = Read-Host 'Вставьте ключ GitHub и нажмите Enter (ввод скрыт)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
    $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim()
    if ($plainToken -notmatch '^github_pat_[A-Za-z0-9_]+$') { throw 'Нужен fine-grained token, начинающийся с github_pat_.' }
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $headers = @{ Authorization = ('Bearer ' + $plainToken); Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28'; 'User-Agent' = 'RUHUB-Flow-local-setup' }
    try {
        $null = Invoke-RestMethod -Uri 'https://api.github.com/repos/ruhub-dev/ruhub-flow/contents/connection/current.json?ref=main' -Headers $headers -TimeoutSec 20
    } catch { throw 'GitHub не принял ключ или нет доступа к ruhub-dev/ruhub-flow. Проверьте аккаунт, репозиторий и Contents: Read and write.' }
    $secureToken = ConvertTo-SecureString -String $plainToken -AsPlainText -Force
    $encrypted = ConvertFrom-SecureString -SecureString $secureToken
    $null = New-Item -ItemType Directory -Path (Split-Path $credentialPath) -Force
    [IO.File]::WriteAllText($credentialPath, $encrypted, [Text.UTF8Encoding]::new($false))
    Write-Host ''
    Write-Host 'Ключ проверен и сохранён с шифрованием Windows.' -ForegroundColor Green
    Write-Host 'Теперь запустите START_INTERNET.cmd.'
    Write-Host 'Постоянная ссылка: https://ruhub-dev.github.io/ruhub-flow/'
} finally {
    $plainToken = $null
    $headers = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
