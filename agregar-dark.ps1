# Agrega variantes dark: a paginas que no tienen soporte de modo oscuro.
# Solo toca archivos con 0 apariciones de "dark:" y anade la variante despues
# de cada utilidad clara estandar. Reversible via git.

$archivos = @(
  'frontend/src/pages/AdminDashboard.jsx',
  'frontend/src/pages/AdminEmployees.jsx',
  'frontend/src/pages/AdminParameters.jsx',
  'frontend/src/pages/AdminPayroll.jsx',
  'frontend/src/pages/AdminReports.jsx',
  'frontend/src/pages/AdminRequests.jsx',
  'frontend/src/pages/AdminUsuarios.jsx',
  'frontend/src/pages/AdminVacations.jsx',
  'frontend/src/pages/EmployeeDashboard.jsx',
  'frontend/src/pages/EmployeePayroll.jsx',
  'frontend/src/pages/EmployeeProfile.jsx',
  'frontend/src/pages/EmployeeRequests.jsx',
  'frontend/src/pages/EmployeeVacations.jsx',
  'frontend/src/pages/Login.jsx'
)

# Mapa: utilidad clara -> variante dark equivalente.
# El lookbehind/lookahead evita clases compuestas (bg-white/50) y prefijos (hover: ya cubierto aparte).
$mapa = [ordered]@{
  'hover:bg-slate-50'  = 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
  'hover:bg-slate-100' = 'hover:bg-slate-100 dark:hover:bg-slate-700'
  'bg-white'           = 'bg-white dark:bg-slate-800'
  'bg-slate-50'        = 'bg-slate-50 dark:bg-slate-800/60'
  'bg-slate-100'       = 'bg-slate-100 dark:bg-slate-700'
  'bg-slate-200'       = 'bg-slate-200 dark:bg-slate-700'
  'border-slate-200'   = 'border-slate-200 dark:border-slate-700'
  'border-slate-100'   = 'border-slate-100 dark:border-slate-700/60'
  'border-slate-300'   = 'border-slate-300 dark:border-slate-600'
  'divide-slate-200'   = 'divide-slate-200 dark:divide-slate-700'
  'text-slate-900'     = 'text-slate-900 dark:text-slate-100'
  'text-slate-800'     = 'text-slate-800 dark:text-slate-100'
  'text-slate-700'     = 'text-slate-700 dark:text-slate-300'
  'text-slate-600'     = 'text-slate-600 dark:text-slate-400'
  'text-slate-500'     = 'text-slate-500 dark:text-slate-400'
  'bg-green-50'        = 'bg-green-50 dark:bg-emerald-500/10'
  'text-green-800'     = 'text-green-800 dark:text-emerald-300'
  'text-green-700'     = 'text-green-700 dark:text-emerald-400'
  'bg-emerald-50'      = 'bg-emerald-50 dark:bg-emerald-500/10'
  'text-emerald-700'   = 'text-emerald-700 dark:text-emerald-400'
  'bg-red-50'          = 'bg-red-50 dark:bg-red-500/10'
  'bg-red-100'         = 'bg-red-100 dark:bg-red-500/20'
  'text-red-800'       = 'text-red-800 dark:text-red-300'
  'text-red-700'       = 'text-red-700 dark:text-red-400'
  'text-red-600'       = 'text-red-600 dark:text-red-400'
  'bg-blue-50'         = 'bg-blue-50 dark:bg-blue-500/10'
  'text-blue-800'      = 'text-blue-800 dark:text-blue-300'
  'text-blue-700'      = 'text-blue-700 dark:text-blue-400'
  'bg-amber-50'        = 'bg-amber-50 dark:bg-amber-500/10'
  'bg-amber-100'       = 'bg-amber-100 dark:bg-amber-500/20'
  'text-amber-800'     = 'text-amber-800 dark:text-amber-300'
  'text-amber-700'     = 'text-amber-700 dark:text-amber-400'
  'text-amber-600'     = 'text-amber-600 dark:text-amber-400'
  'bg-indigo-50'       = 'bg-indigo-50 dark:bg-indigo-500/10'
  'text-indigo-700'    = 'text-indigo-700 dark:text-indigo-400'
  'bg-purple-50'       = 'bg-purple-50 dark:bg-purple-500/10'
  'text-purple-700'    = 'text-purple-700 dark:text-purple-400'
}

foreach ($ruta in $archivos) {
  if (-not (Test-Path $ruta)) { Write-Output "FALTA: $ruta"; continue }
  $texto = Get-Content $ruta -Raw
  if ($texto -match 'dark:') { Write-Output "OMITIDO (ya tiene dark:): $ruta"; continue }
  $total = 0
  foreach ($clave in $mapa.Keys) {
    $patron = "(?<![\w:-])" + [regex]::Escape($clave) + "(?![\w/-])"
    $texto = [regex]::Replace($texto, $patron, $mapa[$clave])
    $total += ([regex]::Matches($texto, [regex]::Escape($mapa[$clave]))).Count
  }
  Set-Content -Path $ruta -Value $texto -NoNewline
  Write-Output ("{0}: ~{1} variantes anadidas" -f $ruta, $total)
}
