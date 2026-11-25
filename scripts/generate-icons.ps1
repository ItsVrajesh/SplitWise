Add-Type -AssemblyName System.Drawing

function New-OrbitIcon([string]$Target, [int]$Size, [bool]$Transparent, [bool]$Mono) {
  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.ScaleTransform($Size / 1024, $Size / 1024)
  $dark = [System.Drawing.ColorTranslator]::FromHtml('#090911')
  $mint = [System.Drawing.ColorTranslator]::FromHtml('#A06BFF')
  if (-not $Transparent) { $graphics.Clear($dark) }
  $ink = if ($Mono) { [System.Drawing.Color]::White } else { $mint }
  $pen = [System.Drawing.Pen]::new($ink, 37)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.TranslateTransform(512, 512)
  $graphics.RotateTransform(-29)
  $graphics.DrawEllipse($pen, -350, -194, 700, 388)
  $graphics.ResetTransform()
  $graphics.FillEllipse([System.Drawing.SolidBrush]::new($ink), 365, 365, 294, 294)
  $graphics.FillEllipse([System.Drawing.SolidBrush]::new($dark), 431, 431, 162, 162)
  $graphics.FillEllipse([System.Drawing.SolidBrush]::new($ink), 724, 280, 87, 87)
  $graphics.Dispose()
  $bitmap.Save($Target, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

$assets = Join-Path $PSScriptRoot '..\assets'
New-OrbitIcon (Join-Path $assets 'icon.png') 1024 $false $false
New-OrbitIcon (Join-Path $assets 'android-icon-foreground.png') 1024 $true $false
New-OrbitIcon (Join-Path $assets 'android-icon-monochrome.png') 1024 $true $true
New-OrbitIcon (Join-Path $assets 'favicon.png') 48 $false $false
$background = [System.Drawing.Bitmap]::new(1024, 1024)
$g = [System.Drawing.Graphics]::FromImage($background)
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#090911'))
$g.Dispose()
$background.Save((Join-Path $assets 'android-icon-background.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$background.Dispose()
