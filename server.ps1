# Servidor Web Local Leve para o Somador de Notas
# Baseado em .NET HttpListener - Sem necessidade de Node.js, Python ou instalação adicional.
# Execução 100% local e segura no próprio computador.

$port = 8080
$prefix = "http://localhost:$port/"
$rootPath = $PSScriptRoot

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".xml"  = "application/xml; charset=utf-8"
    ".pdf"  = "application/pdf"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".wasm" = "application/wasm"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  SOMADOR DE NOTAS - Servidor Local Ativo" -ForegroundColor Cyan
    Write-Host "  Acesse no navegador: $prefix" -ForegroundColor Yellow
    Write-Host "  Pressione Ctrl+C para encerrar o servidor" -ForegroundColor Gray
    Write-Host "==========================================================" -ForegroundColor Green

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $response.KeepAlive = $false
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        $rawUrl = $request.Url.LocalPath

        # Endpoint de log para testes do navegador
        if ($request.HttpMethod -eq "POST" -and $rawUrl -eq "/log") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $logMsg = $reader.ReadToEnd()
            Write-Host "[BROWSER] $logMsg" -ForegroundColor Yellow
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        if ($rawUrl -eq "/" -or [string]::IsNullOrWhiteSpace($rawUrl)) {
            $rawUrl = "/index.html"
        }

        $decodedUrl = [System.Uri]::UnescapeDataString($rawUrl.TrimStart('/'))
        $filePath = Join-Path $rootPath ($decodedUrl.Replace('/', '\'))

        # Proteção contra Directory Traversal
        $fullPath = [System.IO.Path]::GetFullPath($filePath)
        if (-not $fullPath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
            $response.StatusCode = 403
            $bytes = [System.Text.Encoding]::UTF8.GetBytes("Acesso negado.")
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        if (Test-Path $fullPath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
            $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $response.ContentType = $mime
            $response.StatusCode = 200

            try {
                $fileBytes = [System.IO.File]::ReadAllBytes($fullPath)
                $response.ContentLength64 = $fileBytes.Length
                $response.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
            } catch {
                $response.StatusCode = 500
            }
        } else {
            $response.StatusCode = 404
            $response.ContentType = "text/plain; charset=utf-8"
            $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 - Arquivo não encontrado: $rawUrl")
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        }

        $response.Close()
    }
} catch {
    Write-Host "Erro no servidor: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    $listener.Stop()
    $listener.Close()
}
