# Video Agent Team - desktop notification for the Claude Code Notification hook.
#
# Claude Code runs this (see .claude/settings.json) when it is waiting for the owner, and
# pipes the hook's JSON on stdin, e.g. {"message": "Claude needs your input", ...}.
# Shows a Windows toast titled "Video Agent Team" with that message, using the built-in
# Windows.UI.Notifications API (no extra modules). If that fails, shows a
# System.Windows.Forms.NotifyIcon balloon tip for 5 seconds instead.
# It never throws and always exits 0, so it can never break the session.
#
# Manual test (PowerShell):
#   '{"message":"Script ready"}' | powershell -NoProfile -ExecutionPolicy Bypass -File "tools/notify/notify.ps1"

$ErrorActionPreference = 'Stop'
$Title = 'Video Agent Team'
$Message = 'Video Agent Team needs you'

# 1. Read the hook JSON from stdin. Only read when stdin is redirected, so a run from an
#    interactive console never waits for input; an empty or closed stdin reads as "".
try {
    if ([Console]::IsInputRedirected) {
        $raw = [Console]::In.ReadToEnd()
        if ($raw -and $raw.Trim()) {
            $data = $raw | ConvertFrom-Json
            if ($data.message -and ([string]$data.message).Trim()) {
                $Message = ([string]$data.message).Trim()
            }
        }
    }
} catch {
    # Bad or missing JSON: keep the default message.
}

# 2. Windows toast (the AppId of Windows PowerShell, which is registered on every Windows PC).
$shown = $false
try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

    $t = [System.Security.SecurityElement]::Escape($Title)
    $m = [System.Security.SecurityElement]::Escape($Message)
    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml("<toast><visual><binding template=`"ToastGeneric`"><text>$t</text><text>$m</text></binding></visual></toast>")

    $appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
    $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
    $shown = $true
} catch {
    $shown = $false
}

# 3. Fallback: a balloon tip from the notification area, shown for 5 seconds.
if (-not $shown) {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $icon = New-Object System.Windows.Forms.NotifyIcon
        $icon.Icon = [System.Drawing.SystemIcons]::Information
        $icon.BalloonTipTitle = $Title
        $icon.BalloonTipText = $Message
        $icon.Visible = $true
        $icon.ShowBalloonTip(5000)
        Start-Sleep -Seconds 5
        $icon.Dispose()
    } catch {
        # No notification possible; never fail the hook.
    }
}

exit 0
