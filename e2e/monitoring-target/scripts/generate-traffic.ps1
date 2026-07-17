param(
    [ValidateRange(1, 1000)]
    [int]$Iterations = 3,
    [string]$NodeUrl = "http://127.0.0.1:18080",
    [string]$JavaUrl = "http://127.0.0.1:18081"
)

$ErrorActionPreference = "Stop"
$sensitiveBody = @{
    email = "tester@example.com"
    password = "should-be-masked"
    token = "should-be-masked"
    nested = @{ apiKey = "should-be-masked" }
} | ConvertTo-Json -Depth 4 -Compress

function Invoke-FixtureTraffic([string]$BaseUrl, [string]$Runtime) {
    Invoke-RestMethod "$BaseUrl/ok" | Out-Null
    Invoke-RestMethod "$BaseUrl/slow?ms=350" | Out-Null
    try { Invoke-RestMethod "$BaseUrl/error" | Out-Null } catch {
        if ($_.Exception.Response.StatusCode.value__ -ne 503) { throw }
    }
    Invoke-RestMethod "$BaseUrl/echo" -Method Post -ContentType "application/json" `
        -Headers @{ Authorization = "Bearer fixture-secret-token"; Cookie = "session=fixture-secret-cookie" } `
        -Body $sensitiveBody | Out-Null
    Invoke-RestMethod "$BaseUrl/large" | Out-Null
    Write-Host "Generated $Runtime traffic"
}

1..$Iterations | ForEach-Object {
    Invoke-FixtureTraffic $NodeUrl "node"
    Invoke-FixtureTraffic $JavaUrl "java"
}

Write-Host "Traffic generation complete ($Iterations iteration(s) per runtime)."
