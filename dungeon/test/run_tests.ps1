$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$htmlPath = "file:///" + (Resolve-Path "dungeon/test/test_runner.html").Path.Replace("\", "/")
$outputPath = Join-Path (Get-Location) "dungeon/test/test_output.html"

$proc = Start-Process -FilePath $edgePath -ArgumentList @("--headless=new", "--dump-dom", $htmlPath) -NoNewWindow -PassThru -RedirectStandardOutput $outputPath
$proc.WaitForExit(10000)

if (Test-Path $outputPath) {
    $content = Get-Content $outputPath -Raw
    $lines = [regex]::Matches($content, '<div class="(pass|fail)">([\s\S]*?)<\/div>')
    foreach ($m in $lines) {
        $type = $m.Groups[1].Value.ToUpper()
        $text = $m.Groups[2].Value -replace '<br>', ' ' -replace '&nbsp;', ' '
        Write-Output "[$type] $text"
    }
    if ($content -match '<h3>Summary: (.*?)<\/h3>') {
        Write-Output "`n==============================="
        Write-Output "SUMMARY: $($matches[1])"
        Write-Output "===============================`n"
    }
    Remove-Item $outputPath -Force
} else {
    Write-Error "No output generated"
}
