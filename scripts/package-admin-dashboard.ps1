param([Parameter(Mandatory = $true)][string]$OutputPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$adminPluginSource = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../wordpress/tripanza-headless-admin'))
$adminPackagePath = [System.IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $adminPackagePath) { throw "Package already exists: $adminPackagePath" }
$adminPackageStream = [System.IO.File]::Open($adminPackagePath, [System.IO.FileMode]::CreateNew)
try {
    $adminArchive = New-Object System.IO.Compression.ZipArchive($adminPackageStream, [System.IO.Compression.ZipArchiveMode]::Create, $true)
    try {
        foreach ($relativePath in @('tripanza-headless-admin.php', 'README.md', 'includes/analytics.php', 'includes/presets.php', 'includes/holidays.php', 'includes/itinerary.php', 'includes/bookings.php', 'includes/booking-editor.php', 'includes/booking-editor-calculations.php', 'includes/booking-create.php')) {
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($adminArchive, (Join-Path $adminPluginSource $relativePath), "tripanza-headless-admin/$relativePath", [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally { $adminArchive.Dispose() }
} finally { $adminPackageStream.Dispose() }
$adminCheckArchive = [System.IO.Compression.ZipFile]::OpenRead($adminPackagePath)
try {
    if ($adminCheckArchive.Entries.Count -ne 10 -or ($adminCheckArchive.Entries | Where-Object { $_.FullName.Contains('\') })) { throw 'Invalid plugin package layout.' }
    $adminCheckArchive.Entries | ForEach-Object { Write-Output "Verified ZIP entry: $($_.FullName)" }
} finally { $adminCheckArchive.Dispose() }
Write-Output "Package created: $adminPackagePath"
