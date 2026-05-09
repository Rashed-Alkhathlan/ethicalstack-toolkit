Param()

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$targetPath = $scriptDir

$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -and $currentPath.ToLower().Contains($targetPath.ToLower())) {
    Write-Host "CLI path already added: $targetPath"
    exit 0
}

$newPath = if ($currentPath) { "$currentPath;$targetPath" } else { $targetPath }
[Environment]::SetEnvironmentVariable("Path", $newPath, "User")
Write-Host "Added CLI path to user PATH: $targetPath"
Write-Host "Restart your terminal to use ethicalstack.cmd"
