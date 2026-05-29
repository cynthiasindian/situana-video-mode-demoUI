# Simple PowerShell HTTP Server
$port = 8000
$path = $PSScriptRoot

Write-Host "Starting server at http://localhost:$port" -ForegroundColor Green
Write-Host "Serving files from: $path" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Cyan
Write-Host ""

# Try Python first, fall back to .NET
try {
    python -m http.server $port --directory $path
} catch {
    # .NET HttpListener fallback
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Start()

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $localPath = Join-Path $path ($request.Url.LocalPath -replace '^/', '')
        if ($request.Url.LocalPath -eq '/') {
            $localPath = Join-Path $path 'index.html'
        }

        if (Test-Path $localPath) {
            $content = [System.IO.File]::ReadAllBytes($localPath)
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
        } else {
            $response.StatusCode = 404
        }
        $response.Close()
    }
}
