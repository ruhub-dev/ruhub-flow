$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$ProgressPreference = 'SilentlyContinue'
$pointer = [IntPtr]::Zero
$phase = 'request'
function Reply($Value) { [Console]::Out.Write(($Value | ConvertTo-Json -Compress -Depth 12)) }
try {
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $allowed = @('https://api.github.com/repos/ruhub-dev/ruhub-flow/contents/connection/current.json', 'https://api.github.com/repos/ruhub-dev/ruhub-flow/contents/connection/current.json?ref=main')
    if ($request.url -notin $allowed -or $request.method -notin @('GET','PUT')) { throw 'Unsupported request' }
    $phase = 'credential'
    $secure = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'data\github-token.dpapi') -Raw | ConvertTo-SecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim()
    if ($token -notmatch '^(github_pat_|ghp_)[A-Za-z0-9_]+$') { throw 'Invalid local credential' }
    $phase = 'network'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $headers = @{ Authorization = ('Bearer ' + $token); Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28'; 'User-Agent' = 'RUHUB-Flow-local-server' }
    $arguments = @{ Uri = [string]$request.url; Method = [string]$request.method; Headers = $headers; UseBasicParsing = $true; TimeoutSec = 18; MaximumRedirection = 0; ErrorAction = 'Stop' }
    if ($request.method -eq 'PUT') { $arguments.Body = [Text.Encoding]::UTF8.GetBytes([string]$request.body); $arguments.ContentType = 'application/json; charset=utf-8' }
    $response = Invoke-WebRequest @arguments
    Reply @{ status = [int]$response.StatusCode; body = [string]$response.Content }
} catch {
    $response = $_.Exception.Response
    if ($phase -eq 'network' -and $null -ne $response) {
        try { $status = [int]$response.StatusCode } catch { $status = 0 }
        Reply @{ status = $status; body = ''; errorCode = 'HttpError' }
    } else {
        $code = if ($phase -eq 'credential') { 'CredentialError' } elseif ($null -ne $_.Exception.Status) { [string]$_.Exception.Status } else { 'WindowsRequestError' }
        Reply @{ status = 0; body = ''; errorCode = $code }
    }
} finally {
    $token = $null
    $headers = $null
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
