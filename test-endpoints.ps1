# PowerShell script för att testa API-endpoints
# Kör: .\test-endpoints.ps1

$BASE_URL = "http://localhost:3000"
if ($env:BASE_URL) {
    $BASE_URL = $env:BASE_URL
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "API Endpoint Tester" -ForegroundColor Cyan
Write-Host "Base URL: $BASE_URL" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$passed = 0
$failed = 0
$results = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [int[]]$ExpectedStatus = @(200)
    )

    $url = "$BASE_URL$Path"
    Write-Host "`nTesting: $Method $Path" -ForegroundColor Blue

    try {
        $params = @{
            Uri = $url
            Method = $Method
            ContentType = "application/json"
            ErrorAction = "Stop"
        }

        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }

        $response = Invoke-WebRequest @params
        $status = $response.StatusCode

        if ($ExpectedStatus -contains $status) {
            Write-Host "✓ PASS - Status: $status" -ForegroundColor Green
            $script:passed++
            $script:results += [PSCustomObject]@{
                Status = "PASS"
                Name = $Name
                Method = $Method
                Path = $Path
                StatusCode = $status
                Error = ""
            }
        } else {
            Write-Host "✗ FAIL - Status: $status (Expected: $($ExpectedStatus -join ', '))" -ForegroundColor Red
            $script:failed++
            $script:results += [PSCustomObject]@{
                Status = "FAIL"
                Name = $Name
                Method = $Method
                Path = $Path
                StatusCode = $status
                Error = "Unexpected status code"
            }
        }
    }
    catch {
        $errorMsg = $_.Exception.Message
        $statusCode = $_.Exception.Response.StatusCode.value__

        if ($ExpectedStatus -contains $statusCode) {
            Write-Host "✓ PASS - Status: $statusCode (Expected error)" -ForegroundColor Green
            $script:passed++
            $script:results += [PSCustomObject]@{
                Status = "PASS"
                Name = $Name
                Method = $Method
                Path = $Path
                StatusCode = $statusCode
                Error = ""
            }
        } else {
            Write-Host "✗ ERROR - $errorMsg" -ForegroundColor Red
            $script:failed++
            $script:results += [PSCustomObject]@{
                Status = "ERROR"
                Name = $Name
                Method = $Method
                Path = $Path
                StatusCode = $statusCode
                Error = $errorMsg
            }
        }
    }
}

# Test customer endpoints
Write-Host "`n=== CUSTOMER ENDPOINTS ===" -ForegroundColor Yellow

Test-Endpoint -Name "Update customer" -Method "PATCH" -Path "/api/customers/test-123" `
    -Body @{ company_name = "Test AB" } -ExpectedStatus @(404, 409, 200)

Test-Endpoint -Name "Delete customer" -Method "DELETE" -Path "/api/customers/test-123" `
    -ExpectedStatus @(404, 200)

Test-Endpoint -Name "Get customer cards" -Method "GET" -Path "/api/customer-cards/get?customerId=test-123" `
    -ExpectedStatus @(200, 404)

# Test offer endpoints
Write-Host "`n=== OFFER ENDPOINTS ===" -ForegroundColor Yellow

Test-Endpoint -Name "Create offer from GPT" -Method "POST" -Path "/api/offers/create-from-gpt" `
    -Body @{
        customerId = $null
        textData = "# OFFERT`n`nKund: Test AB`nDatum: 2026-01-05`n`nTjänst: Test`nPris: 1000 kr"
        jsonData = @{
            titel = "Test"
            summa = 1000
            valuta = "SEK"
            kund = @{
                namn = "Test AB"
                epost = "test@test.se"
            }
        }
    } -ExpectedStatus @(200, 400, 500)

Test-Endpoint -Name "List offers" -Method "GET" -Path "/api/offers/list?customerId=test-123" `
    -ExpectedStatus @(200)

Test-Endpoint -Name "Parse offer" -Method "POST" -Path "/api/offers/parse" `
    -Body @{ bucket = "test"; path = "test.pdf" } -ExpectedStatus @(501, 400)

Test-Endpoint -Name "Delete offer" -Method "POST" -Path "/api/offers/delete" `
    -Body @{ offerId = "test-123" } -ExpectedStatus @(200, 404, 500)

# Results
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST RESULTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n✓ PASSED: $passed" -ForegroundColor Green
Write-Host "✗ FAILED: $failed" -ForegroundColor Red

$total = $passed + $failed
$passRate = if ($total -gt 0) { [math]::Round(($passed / $total) * 100, 1) } else { 0 }

Write-Host "`nPass Rate: $passRate%" -ForegroundColor Cyan

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "DETAILED RESULTS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$results | Format-Table -AutoSize

if ($failed -gt 0) {
    Write-Host "`n⚠ Some tests failed. Check details above." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "`n✓ All tests passed!" -ForegroundColor Green
    exit 0
}
