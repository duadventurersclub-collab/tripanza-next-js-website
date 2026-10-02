param(
    [Parameter(Mandatory = $true)]
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$pluginSource = Join-Path $PSScriptRoot '../wordpress/tripanza-site-controls'
$packagePath = [System.IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $packagePath) {
    throw "Package already exists; choose a new output filename: $packagePath"
}

# Compress-Archive produces backslash entry names on Windows. Explicit forward
# slashes keep the plugin folder structure portable to Linux WordPress hosts.
$packageStream = [System.IO.File]::Open($packagePath, [System.IO.FileMode]::CreateNew)
try {
    $packageArchive = New-Object System.IO.Compression.ZipArchive($packageStream, [System.IO.Compression.ZipArchiveMode]::Create, $true)
    try {
        foreach ($fileName in @('tripanza-site-controls.php', 'README.md')) {
            $sourcePath = Join-Path $pluginSource $fileName
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $packageArchive, $sourcePath, "tripanza-site-controls/$fileName",
                [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
        }
    } finally {
        $packageArchive.Dispose()
    }
} finally {
    $packageStream.Dispose()
}

$checkArchive = [System.IO.Compression.ZipFile]::OpenRead($packagePath)
try {
    $entryNames = @($checkArchive.Entries | ForEach-Object { $_.FullName })
    if ($entryNames.Count -ne 2 -or ($entryNames | Where-Object { $_.Contains('\') }) -or
        $entryNames -notcontains 'tripanza-site-controls/tripanza-site-controls.php') {
        throw 'Invalid plugin package layout.'
    }
    $entryNames | ForEach-Object { Write-Output "Verified ZIP entry: $_" }
} finally {
    $checkArchive.Dispose()
}
Write-Output "Package created: $packagePath"
