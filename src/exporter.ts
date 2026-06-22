import { CaseRecord } from "./types";

export function exportToStandaloneHTML(cases: CaseRecord[]): string {
  // Convert current cases to JSON for embedding
  const casesJson = JSON.stringify(cases, null, 2);

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seguimiento Zoonosis · Alcaldía de Medellín</title>
  
  <!-- CDNs -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>

  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            syne: ['Syne', 'sans-serif'],
          },
          colors: {
            brand: {
              deep: '#0A4057',
              sky: '#1DABE3',
              orange: '#F16729',
              bg: '#F4F8FB',
              success: '#2E7D52',
              danger: '#C0392B',
              warning: '#E67E22',
            }
          }
        }
      }
    }
  </script>
  <style>
    /* Estilos personalizados */
    body {
      font-family: 'Inter', sans-serif;
      background-color: #F4F8FB;
    }
    .font-title {
      font-family: 'Syne', sans-serif;
    }
  </style>
</head>
<body class="bg-brand-bg text-slate-800 antialiased min-h-screen">

  <!-- HEADER -->
  <header class="bg-brand-deep text-white shadow-md sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
      <div class="flex items-center gap-3">
        <span class="text-3xl animate-bounce">🐾</span>
        <div>
          <h1 class="text-xl md:text-2xl font-title font-extrabold tracking-tight">Seguimiento Zoonosis</h1>
          <p class="text-xs text-brand-sky font-semibold tracking-wide uppercase">Secretaría de Salud de Medellín</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="bg-brand-sky/20 border border-brand-sky/40 px-3 py-1.5 rounded-full text-xs font-semibold text-brand-sky flex items-center gap-2">
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-brand-sky animate-ping"></span>
          Semana Activa: <span id="week-badge">Semanas 20-22</span>
        </div>
        <div id="excluded-badge" class="bg-brand-orange/20 border border-brand-orange/40 px-3 py-1.5 rounded-full text-xs font-semibold text-brand-orange hidden">
          Excluidos: 0
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 py-6 space-y-6">

    <!-- CONTROLES DE CARGA Y FILTROS -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 class="text-lg font-title font-bold text-brand-deep">Carga de Datos de Seguimiento</h2>
          <p class="text-xs text-slate-400">Carga archivos .xlsx o .csv acumulativos</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <label class="bg-brand-sky hover:bg-brand-sky/90 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition-all duration-150 cursor-pointer flex items-center gap-1.5">
            📂 Cargar archivo
            <input type="file" id="file-uploader" class="hidden" accept=".xlsx,.csv">
          </label>
          <button id="btn-add-week" class="bg-brand-deep hover:bg-brand-deep/90 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all duration-150 flex items-center gap-1.5">
            ➕ Agregar semana
          </button>
          <button id="btn-clear" class="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold px-4 py-2 rounded-xl transition-all duration-150">
            🧹 Limpiar todo
          </button>
        </div>
      </div>

      <!-- FILTROS RATIOS -->
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        <!-- SEMANA MULTI -->
        <div class="flex flex-col space-y-1.5">
          <label class="text-xs font-semibold text-slate-500">Semana Epidemiológica</label>
          <select id="filter-semana" class="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-sky transition-all">
            <option value="Todas">Todas las semanas</option>
          </select>
        </div>

        <!-- RESPONSABLE -->
        <div class="flex flex-col space-y-1.5">
          <label class="text-xs font-semibold text-slate-500">Responsable asignado</label>
          <div class="flex rounded-xl bg-slate-100 p-1" id="filter-responsable-group">
            <button class="flex-1 text-center py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white shadow-sm transition-all" data-value="Todos">Todos</button>
            <button class="flex-1 text-center py-1.5 text-xs font-medium rounded-lg text-slate-700 hover:text-slate-900 transition-all" data-value="Prada">Prada</button>
            <button class="flex-1 text-center py-1.5 text-xs font-medium rounded-lg text-slate-700 hover:text-slate-900 transition-all" data-value="Juan">Juan</button>
          </div>
        </div>

        <!-- ESPECIE -->
        <div class="flex flex-col space-y-1.5 col-span-1 md:col-span-2">
          <label class="text-xs font-semibold text-slate-500">Especie animal</label>
          <div class="flex rounded-xl bg-slate-100 p-1" id="filter-especie-group">
            <button class="flex-1 text-center py-1.5 text-[11px] md:text-xs font-medium rounded-lg text-slate-700 bg-white shadow-sm" data-value="Todas">Especies</button>
            <button class="flex-1 text-center py-1.5 text-[11px] md:text-xs font-medium rounded-lg text-slate-700" data-value="Canino">🐶 Caninos</button>
            <button class="flex-1 text-center py-1.5 text-[11px] md:text-xs font-medium rounded-lg text-slate-700" data-value="Felino">🐱 Felinos</button>
            <button class="flex-1 text-center py-1.5 text-[11px] md:text-xs font-medium rounded-lg text-slate-700" data-value="Otro">🐾 Otros</button>
          </div>
        </div>

        <!-- CLASIFICACIÓN -->
        <div class="flex flex-col space-y-1.5">
          <label class="text-xs font-semibold text-slate-500">Exposición</label>
          <select id="filter-exposicion" class="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-sky transition-all">
            <option value="Todas">Todas las exposiciones</option>
            <option value="0">Sin clasificar</option>
            <option value="1">Exposición leve</option>
            <option value="2">Exposición grave</option>
          </select>
        </div>
      </div>

      <div class="flex flex-wrap justify-between items-center gap-3 pt-2">
        <label class="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" id="filter-prioritarios" class="rounded text-brand-sky focus:ring-brand-sky border-slate-300 w-4 h-4">
          <span class="text-xs font-medium text-slate-600">⭐ Mostrar solo casos prioritarios (Prioritario = Si)</span>
        </label>
        <div class="px-3 py-1 bg-brand-deep text-white text-xs font-bold rounded-lg shadow-sm">
          <span id="active-cases-count">0</span> Casos Activos
        </div>
      </div>
    </div>

    <!-- TOASTS -->
    <div id="toast" class="hidden transition-all duration-300 fixed bottom-5 right-5 z-50 max-w-sm bg-white border border-slate-100 rounded-xl shadow-xl p-4 flex items-center gap-3">
      <span id="toast-icon" class="text-lg"></span>
      <p id="toast-text" class="text-xs font-medium"></p>
    </div>

    <!-- CARDS DE METRICAS KPI -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-5">
      <!-- CONTROL 1 -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 relative overflow-hidden">
        <p class="text-xs font-bold text-slate-400 tracking-wide uppercase">📋 Total Casos</p>
        <h3 id="kpi-total" class="text-4xl font-title font-extrabold text-brand-deep mt-2">0</h3>
        <p class="text-[10px] text-slate-400 mt-1">Casos totales en base actual</p>
        <div class="absolute right-4 bottom-4 text-3xl opacity-10">📋</div>
      </div>
      <!-- CONTROL 2 -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 relative overflow-hidden">
        <p class="text-xs font-bold text-slate-400 tracking-wide uppercase">👤 Prada (Asignados)</p>
        <div class="flex items-baseline gap-2 mt-2">
          <h3 id="kpi-prada" class="text-4xl font-title font-extrabold text-[#1DABE3]">0</h3>
          <span id="kpi-prada-pct" class="text-xs font-semibold text-slate-500">(0%)</span>
        </div>
        <p class="text-[10px] text-slate-400 mt-1">Casos activos asignados</p>
        <div class="absolute right-4 bottom-4 text-3xl opacity-10 text-[#1DABE3]">👤</div>
      </div>
      <!-- CONTROL 3 -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 relative overflow-hidden">
        <p class="text-xs font-bold text-slate-400 tracking-wide uppercase">👤 Juan (Asignados)</p>
        <div class="flex items-baseline gap-2 mt-2">
          <h3 id="kpi-juan" class="text-4xl font-title font-extrabold text-[#F16729]">0</h3>
          <span id="kpi-juan-pct" class="text-xs font-semibold text-slate-500">(0%)</span>
        </div>
        <p class="text-[10px] text-slate-400 mt-1">Casos activos asignados</p>
        <div class="absolute right-4 bottom-4 text-3xl opacity-10 text-[#F16729]">👤</div>
      </div>
      <!-- CONTROL 4 -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 relative overflow-hidden bg-rose-50/20 border-rose-100">
        <p class="text-xs font-bold text-slate-400 tracking-wide uppercase text-brand-danger">🚨 Exposición Grave</p>
        <div class="flex items-baseline gap-2 mt-2">
          <h3 id="kpi-grave" class="text-4xl font-title font-extrabold text-brand-danger">0</h3>
          <span id="kpi-grave-pct" class="text-xs font-semibold text-brand-danger bg-brand-danger/10 px-1.5 py-0.5 rounded-md">(0%)</span>
        </div>
        <p class="text-[10px] text-brand-danger/80 mt-1">Casos de alto riesgo</p>
        <div class="absolute right-4 bottom-4 text-3xl opacity-10 text-brand-danger">🚨</div>
      </div>
    </div>

    <!-- SECCION GRÁFICOS (grid 2x2) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      <!-- G1: Casos por semana -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 class="text-sm font-title font-bold text-brand-deep mb-4 flex items-center gap-2">
          📈 Evolución semanal por responsable
        </h3>
        <div class="h-64 relative w-full">
          <canvas id="chart-g1"></canvas>
        </div>
      </div>

      <!-- G2: Especie -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 class="text-sm font-title font-bold text-brand-deep mb-4 flex items-center gap-2">
          🍩 Casos por especie animal
        </h3>
        <div class="h-64 relative w-full flex justify-center">
          <div class="w-64"><canvas id="chart-g2"></canvas></div>
        </div>
      </div>

      <!-- G3: Clasificación semana -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 class="text-sm font-title font-bold text-brand-deep mb-4 flex items-center gap-2">
          📊 Clasificación de exposición por semana
        </h3>
        <div class="h-64 relative w-full">
          <canvas id="chart-g3"></canvas>
        </div>
      </div>

      <!-- G4: Carga -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 class="text-sm font-title font-bold text-brand-deep mb-4 flex items-center gap-2">
          📋 Distribución de casos por responsable y clasificación
        </h3>
        <div class="h-64 relative w-full">
          <canvas id="chart-g4"></canvas>
        </div>
      </div>
    </div>

    <!-- SECCION TABLAS CRUSTADAS -->
    <div class="space-y-6">
      <div>
        <h3 class="text-md font-title font-bold text-brand-deep mb-1">📊 Tablas de Resumen Cruzado</h3>
        <p class="text-xs text-slate-400">Totales agregados e indicadores por semana</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- TABLA 1 -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col justify-between">
          <div>
            <div class="bg-brand-deep text-white px-4 py-3 flex justify-between items-center">
              <span class="text-xs font-bold uppercase tracking-wider">Semana × Casos</span>
              <button onclick="downloadTableCSV('table1', 'Semana_x_Casos.csv')" class="bg-white/10 hover:bg-white/20 text-white border border-white/10 text-[10px] px-2 py-1 rounded transition-all">
                ⬇ CSV
              </button>
            </div>
            <div class="overflow-x-auto">
              <table id="table1" class="w-full text-xs text-left">
                <thead>
                  <tr class="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <th class="p-3">Semana</th>
                    <th class="p-3 text-right">Cantidad de Casos</th>
                  </tr>
                </thead>
                <tbody id="table1-body"></tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- TABLA 2 -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col justify-between">
          <div>
            <div class="bg-brand-deep text-white px-4 py-3 flex justify-between items-center">
              <span class="text-xs font-bold uppercase tracking-wider">Semana × Especie</span>
              <button onclick="downloadTableCSV('table2', 'Semana_x_Especie.csv')" class="bg-white/10 hover:bg-white/20 text-white border border-white/10 text-[10px] px-2 py-1 rounded transition-all">
                ⬇ CSV
              </button>
            </div>
            <div class="overflow-x-auto">
              <table id="table2" class="w-full text-xs text-left">
                <thead>
                  <tr class="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[10px]">
                    <th class="p-2.5">Semana</th>
                    <th class="p-2.5 text-right">🐶 Canino</th>
                    <th class="p-2.5 text-right">🐱 Felino</th>
                    <th class="p-2.5 text-right">🐾 Otro</th>
                    <th class="p-2.5 text-right bg-slate-50">Total</th>
                  </tr>
                </thead>
                <tbody id="table2-body"></tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- TABLA 3 -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col justify-between">
          <div>
            <div class="bg-brand-deep text-white px-4 py-3 flex justify-between items-center">
              <span class="text-xs font-bold uppercase tracking-wider">Semana × Exposición</span>
              <button onclick="downloadTableCSV('table3', 'Semana_x_Exposicion.csv')" class="bg-white/10 hover:bg-white/20 text-white border border-white/10 text-[10px] px-2 py-1 rounded transition-all">
                ⬇ CSV
              </button>
            </div>
            <div class="overflow-x-auto">
              <table id="table3" class="w-full text-xs text-left">
                <thead>
                  <tr class="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[10px]">
                    <th class="p-2.5">Semana</th>
                    <th class="p-2.5 text-right">Sin Clasif.</th>
                    <th class="p-2.5 text-right">Leve</th>
                    <th class="p-2.5 text-right">Grave</th>
                    <th class="p-2.5 text-right bg-slate-50">Total</th>
                  </tr>
                </thead>
                <tbody id="table3-body"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SECCION DETALLE DETALLADO CON PAGINACIÓN -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div class="bg-brand-deep text-white px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 class="text-sm font-title font-bold">📋 Registro Detallado de Casos</h3>
          <p class="text-[11px] text-brand-sky">Filtra, busca y audita cada caso individual</p>
        </div>
        <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <input type="text" id="table-search" placeholder="Buscar por localidad, barrio, código..." class="text-xs bg-white text-slate-800 placeholder-slate-400 px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-sky w-full md:w-64">
          <button id="btn-export-all" class="bg-brand-sky hover:bg-brand-sky/95 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap">
            ⬇ Exportar todo (CSV)
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-xs text-left">
          <thead>
            <tr class="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <th class="p-4">cod_pre</th>
              <th class="p-4">semana</th>
              <th class="p-4">responsable</th>
              <th class="p-4">especie</th>
              <th class="p-4">exposición</th>
              <th class="p-4">localidad</th>
              <th class="p-4">barrio</th>
              <th class="p-4">sexo</th>
              <th class="p-4">prioridad</th>
              <th class="p-4">Post Seguimiento</th>
            </tr>
          </thead>
          <tbody id="table-detail-body"></tbody>
        </table>
      </div>

      <div class="bg-slate-50 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 border-t border-slate-100 text-xs text-slate-500">
        <div>
          Mostrando registros de <span id="pag-indices" class="font-semibold text-slate-700">0 a 0</span> de un total de <span id="pag-total" class="font-semibold text-slate-700">0</span>
        </div>
        <div class="flex items-center gap-2">
          <button id="btn-prev" class="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-600 font-semibold">Anterior</button>
          <span id="page-indicator">Pág. 1 de 1</span>
          <button id="btn-next" class="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-600 font-semibold">Siguiente</button>
        </div>
      </div>
    </div>

  </main>

  <!-- BASE DE DATOS INICIAL -->
  <script>
    // Embedded initial demo dataset
    let ALL_CASES = ${casesJson};

    const ESP_ANI = { 1: "🐶 Canino", 2: "🐱 Felino", 4: "🐾 Otro" };
    const CLASIF_EXP = { 0: "Sin clasificar", 1: "Exposición leve", 2: "Exposición grave" };
    const ESTADO_ANI = { 1: "En observación", 2: "Muerto", 3: "Desaparecido" };
    const RESPONSABLE_COLORES = { "Prada": "#1DABE3", "Juan": "#F16729" };

    // FILTROS
    let selectedSemana = "Todas";
    let selectedResponsable = "Todos";
    let selectedEspecie = "Todas";
    let selectedExposicion = "Todas";
    let onlyPrioritarios = false;
    let searchQuery = "";

    // Paginacion
    let detailPage = 0;
    const detailPageSize = 20;

    // Charts instances
    let chart1, chart2, chart3, chart4;

    function init() {
      setupEvents();
      populateSemanaDropdown();
      renderAll();
    }

    function setupEvents() {
      // Semana
      document.getElementById('filter-semana').addEventListener('change', (e) => {
        selectedSemana = e.target.value;
        detailPage = 0;
        renderAll();
      });

      // Exposicion
      document.getElementById('filter-exposicion').addEventListener('change', (e) => {
        selectedExposicion = e.target.value;
        detailPage = 0;
        renderAll();
      });

      // Solo prioritarios
      document.getElementById('filter-prioritarios').addEventListener('change', (e) => {
        onlyPrioritarios = e.target.checked;
        detailPage = 0;
        renderAll();
      });

      // Search bar
      document.getElementById('table-search').addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        detailPage = 0;
        renderAll();
      });

      // Responsable toggle
      const respBtns = document.querySelectorAll('#filter-responsable-group button');
      respBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          respBtns.forEach(b => b.classList.remove('bg-white', 'shadow-sm'));
          btn.classList.add('bg-white', 'shadow-sm');
          selectedResponsable = btn.getAttribute('data-value');
          detailPage = 0;
          renderAll();
        });
      });

      // Especie toggle
      const espBtns = document.querySelectorAll('#filter-especie-group button');
      espBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          espBtns.forEach(b => b.classList.remove('bg-white', 'shadow-sm'));
          btn.classList.add('bg-white', 'shadow-sm');
          selectedEspecie = btn.getAttribute('data-value');
          detailPage = 0;
          renderAll();
        });
      });

      // Pag
      document.getElementById('btn-prev').addEventListener('click', () => {
        if (detailPage > 0) {
          detailPage--;
          renderTableDetail();
        }
      });
      document.getElementById('btn-next').addEventListener('click', () => {
        const filtered = getFilteredRecords();
        if ((detailPage + 1) * detailPageSize < filtered.length) {
          detailPage++;
          renderTableDetail();
        }
      });

      // Cargar archivo
      document.getElementById('file-uploader').addEventListener('change', (e) => {
        handleFileUpload(e, false);
      });

      document.getElementById('btn-add-week').addEventListener('click', () => {
        // Trigger file uploader to aggregate week
        const triggerInput = document.getElementById('file-uploader-add') || document.createElement('input');
        triggerInput.type = 'file';
        triggerInput.id = 'file-uploader-add';
        triggerInput.className = 'hidden';
        triggerInput.accept = '.xlsx,.csv';
        triggerInput.onchange = (ev) => handleFileUpload(ev, true);
        document.body.appendChild(triggerInput);
        triggerInput.click();
      });

      // Limpiar
      document.getElementById('btn-clear').addEventListener('click', () => {
        ALL_CASES = [];
        detailPage = 0;
        populateSemanaDropdown();
        renderAll();
        showToast("🧹 Base de datos reiniciada", "warning");
      });

      // Export all CSV
      document.getElementById('btn-export-all').addEventListener('click', () => {
        const active = getFilteredRecords();
        if (active.length === 0) {
          showToast("No hay registros para exportar", "warning");
          return;
        }
        let csv = "cod_pre,semana,año,responsable,especie,exposicion,localidad,barrio,sexo,prioritario,clas_post_seg,estado\\n";
        active.forEach(r => {
          csv += \`"\${r.cod_pre}","\${r.semana}","\${r.año}","\${r.responsable}","\${ESP_ANI[r.esp_ani] || r.esp_ani}","\${CLASIF_EXP[r.clasificacion_exposicion] || r.clasificacion_exposicion}","\${r.localidad_ || ''}","\${r.bar_ver_ || ''}","\${r.sexo_ || ''}","\${r.seg_prioritario || ''}","\${r.clas_post_seg || ''}","\${ESTADO_ANI[r.estado_ani] || ''}"\\n\`;
        });
        triggerDownload(csv, "Zoonosis_Detalle_Completo.csv");
      });
    }

    function populateSemanaDropdown() {
      const select = document.getElementById('filter-semana');
      const weeks = [...new Set(ALL_CASES.map(r => r.semana))].sort((a,b) => a-b);
      
      // Save original option selection value
      const prevVal = select.value;
      
      select.innerHTML = '<option value="Todas">Todas las semanas</option>';
      weeks.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w.toString();
        opt.innerText = "Semana " + w;
        select.appendChild(opt);
      });

      // Preserve selection
      if (weeks.includes(parseInt(prevVal))) {
        select.value = prevVal;
        selectedSemana = prevVal;
      } else {
        select.value = "Todas";
        selectedSemana = "Todas";
      }
    }

    function getFilteredRecords() {
      return ALL_CASES.filter(r => {
        // Exclude previous weeks
        const isExcluded = r.rep_se_ant && r.rep_se_ant.toString().toLowerCase().trim() === "si";
        if (isExcluded) return false;

        // Semanas
        if (selectedSemana !== "Todas" && r.semana.toString() !== selectedSemana) return false;

        // Responsable
        if (selectedResponsable !== "Todos" && r.responsable !== selectedResponsable) return false;

        // Especie
        if (selectedEspecie !== "Todas") {
          const matchedSpecies = (selectedEspecie === "Canino" && r.esp_ani === 1) ||
                                 (selectedEspecie === "Felino" && r.esp_ani === 2) ||
                                 (selectedEspecie === "Otro" && r.esp_ani === 4);
          if (!matchedSpecies) return false;
        }

        // Clasificación de Exposición
        if (selectedExposicion !== "Todas" && r.clasificacion_exposicion.toString() !== selectedExposicion) return false;

        // Prioritario
        if (onlyPrioritarios && r.seg_prioritario !== "Si") return false;

        // Buscador
        if (searchQuery) {
          const t = searchQuery;
          const matchCod = r.cod_pre && r.cod_pre.toString().includes(t);
          const matchLoc = r.localidad_ && r.localidad_.toLowerCase().includes(t);
          const matchBar = r.bar_ver_ && r.bar_ver_.toLowerCase().includes(t);
          const matchResp = r.responsable && r.responsable.toLowerCase().includes(t);
          if (!matchCod && !matchLoc && !matchBar && !matchResp) return false;
        }

        return true;
      });
    }

    function getExcludedCount() {
      return ALL_CASES.filter(r => r.rep_se_ant && r.rep_se_ant.toString().toLowerCase().trim() === "si").length;
    }

    function renderAll() {
      renderHeaderAndKPIs();
      renderCharts();
      renderCrossTabs();
      renderTableDetail();
    }

    function renderHeaderAndKPIs() {
      const activeRecords = getFilteredRecords();
      const weeks = [...new Set(ALL_CASES.map(r => r.semana))].sort((a,b) => a-b);
      const badge = document.getElementById('week-badge');
      if (weeks.length > 0) {
        badge.innerText = weeks.length === 1 ? \`Semana \${weeks[0]}\` : \`Semanas \${weeks[0]}–\${weeks[weeks.length-1]}\`;
      } else {
        badge.innerText = "Sin datos";
      }

      // Exclusiones
      const countExcluded = getExcludedCount();
      const exBadge = document.getElementById('excluded-badge');
      if (countExcluded > 0) {
        exBadge.innerText = \`Excluidos: \${countExcluded}\`;
        exBadge.classList.remove('hidden');
      } else {
        exBadge.classList.add('hidden');
      }

      // Contador activos
      document.getElementById('active-cases-count').innerText = activeRecords.length;

      // KPIs
      document.getElementById('kpi-total').innerText = ALL_CASES.filter(r => !(r.rep_se_ant && r.rep_se_ant.toString().toLowerCase().trim() === "si")).length;
      
      const pradaCount = activeRecords.filter(r => r.responsable === "Prada").length;
      const juanCount = activeRecords.filter(r => r.responsable === "Juan").length;
      const graveCount = activeRecords.filter(r => r.clasificacion_exposicion === 2).length;
      
      const pctDenom = activeRecords.length || 1;
      
      document.getElementById('kpi-prada').innerText = pradaCount;
      document.getElementById('kpi-prada-pct').innerText = \`(\${Math.round(pradaCount/pctDenom*100)}%)\`;

      document.getElementById('kpi-juan').innerText = juanCount;
      document.getElementById('kpi-juan-pct').innerText = \`(\${Math.round(juanCount/pctDenom*100)}%)\`;

      document.getElementById('kpi-grave').innerText = graveCount;
      document.getElementById('kpi-grave-pct').innerText = \`(\${Math.round(graveCount/pctDenom*100)}%)\`;
    }

    function renderCharts() {
      const records = getFilteredRecords();
      
      // Weeks of filtered data
      const weeks = [...new Set(records.map(r => r.semana))].sort((a,b) => a-b);

      // --- Chart 1: Evolution por responsable ---
      const pradaSeries = weeks.map(w => records.filter(r => r.semana === w && r.responsable === 'Prada').length);
      const juanSeries = weeks.map(w => records.filter(r => r.semana === w && r.responsable === 'Juan').length);

      if (chart1) chart1.destroy();
      const ctx1 = document.getElementById('chart-g1').getContext('2d');
      chart1 = new Chart(ctx1, {
        type: 'line',
        data: {
          labels: weeks.map(w => "Sem. " + w),
          datasets: [
            { label: 'Prada', data: pradaSeries, borderColor: '#1DABE3', backgroundColor: 'rgba(29, 171, 227, 0.1)', tension: 0.25, borderWidth: 3.5 },
            { label: 'Juan', data: juanSeries, borderColor: '#F16729', backgroundColor: 'rgba(241, 103, 41, 0.1)', tension: 0.25, borderWidth: 3.5 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
      });

      // --- Chart 2: Especies Donut ---
      const canines = records.filter(r => r.esp_ani === 1).length;
      const felines = records.filter(r => r.esp_ani === 2).length;
      const others = records.filter(r => r.esp_ani === 4).length;

      if (chart2) chart2.destroy();
      const ctx2 = document.getElementById('chart-g2').getContext('2d');
      chart2 = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: ['🐶 Canino', '🐱 Felino', '🐾 Otro'],
          datasets: [{
            data: [canines, felines, others],
            backgroundColor: ['#0A4057', '#1DABE3', '#F16729'],
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } }
        }
      });

      // --- Chart 3: Clasif por semana stacked bar ---
      const unclassifiedSeries = weeks.map(w => records.filter(r => r.semana === w && r.clasificacion_exposicion === 0).length);
      const mildSeries = weeks.map(w => records.filter(r => r.semana === w && r.clasificacion_exposicion === 1).length);
      const graveSeries = weeks.map(w => records.filter(r => r.semana === w && r.clasificacion_exposicion === 2).length);

      if (chart3) chart3.destroy();
      const ctx3 = document.getElementById('chart-g3').getContext('2d');
      chart3 = new Chart(ctx3, {
        type: 'bar',
        data: {
          labels: weeks.map(w => "Sem. " + w),
          datasets: [
            { label: 'Sin clasificar', data: unclassifiedSeries, backgroundColor: '#D1E3EE' },
            { label: 'Exposición leve', data: mildSeries, backgroundColor: '#E67E22' },
            { label: 'Exposición grave', data: graveSeries, backgroundColor: '#C0392B' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
        }
      });

      // --- Chart 4: Grouped horizontal bars for Workload ---
      const pradaUnclass = records.filter(r => r.responsable === 'Prada' && r.clasificacion_exposicion === 0).length;
      const pradaMild = records.filter(r => r.responsable === 'Prada' && r.clasificacion_exposicion === 1).length;
      const pradaGrave = records.filter(r => r.responsable === 'Prada' && r.clasificacion_exposicion === 2).length;

      const juanUnclass = records.filter(r => r.responsable === 'Juan' && r.clasificacion_exposicion === 0).length;
      const juanMild = records.filter(r => r.responsable === 'Juan' && r.clasificacion_exposicion === 1).length;
      const juanGrave = records.filter(r => r.responsable === 'Juan' && r.clasificacion_exposicion === 2).length;

      if (chart4) chart4.destroy();
      const ctx4 = document.getElementById('chart-g4').getContext('2d');
      chart4 = new Chart(ctx4, {
        type: 'bar',
        data: {
          labels: ['Prada', 'Juan'],
          datasets: [
            { label: 'Sin clasificar', data: [pradaUnclass, juanUnclass], backgroundColor: '#D1E3EE' },
            { label: 'Exposición leve', data: [pradaMild, juanMild], backgroundColor: '#E67E22' },
            { label: 'Exposición grave', data: [pradaGrave, juanGrave], backgroundColor: '#C0392B' }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { beginAtZero: true } }
        }
      });
    }

    function renderCrossTabs() {
      const records = getFilteredRecords();
      const weeks = [...new Set(records.map(r => r.semana))].sort((a,b) => a-b);

      // --- Table 1: Semana x total ---
      const t1Body = document.getElementById('table1-body');
      let t1Html = "";
      let t1Sum = 0;
      weeks.forEach(w => {
        const count = records.filter(r => r.semana === w).length;
        t1Sum += count;
        t1Html += \`<tr class="border-b border-slate-100 hover:bg-slate-50 transition-all font-medium">
          <td class="p-3">Semana \${w}</td>
          <td class="p-3 text-right text-slate-700 font-semibold">\${count}</td>
        </tr>\`;
      });
      t1Html += \`<tr class="bg-[#D6E4F0] font-extrabold text-brand-deep">
        <td class="p-3 uppercase">Total general</td>
        <td class="p-3 text-right">\${t1Sum}</td>
      </tr>\`;
      t1Body.innerHTML = t1Html;

      // --- Table 2: Semana x especie ---
      const t2Body = document.getElementById('table2-body');
      let t2Html = "";
      let sumCanines = 0, sumFelines = 0, sumOthers = 0, grandTotalSpecies = 0;
      weeks.forEach(w => {
        const c1 = records.filter(r => r.semana === w && r.esp_ani === 1).length;
        const c2 = records.filter(r => r.semana === w && r.esp_ani === 2).length;
        const c4 = records.filter(r => r.semana === w && r.esp_ani === 4).length;
        const tot = c1 + c2 + c4;
        sumCanines += c1; sumFelines += c2; sumOthers += c4; grandTotalSpecies += tot;

        t2Html += \`<tr class="border-b border-slate-100 hover:bg-slate-50 transition-all">
          <td class="p-2.5 font-bold">Semana \${w}</td>
          <td class="p-2.5 text-right text-slate-600">\${c1}</td>
          <td class="p-2.5 text-right text-slate-600">\${c2}</td>
          <td class="p-2.5 text-right text-slate-600">\${c4}</td>
          <td class="p-2.5 text-right font-bold bg-slate-50/70 text-slate-800">\${tot}</td>
        </tr>\`;
      });
      t2Html += \`<tr class="bg-[#D6E4F0] font-extrabold text-brand-deep">
        <td class="p-2.5 uppercase text-[10px]">Total</td>
        <td class="p-2.5 text-right">\${sumCanines}</td>
        <td class="p-2.5 text-right">\${sumFelines}</td>
        <td class="p-2.5 text-right">\${sumOthers}</td>
        <td class="p-2.5 text-right bg-[#C9DBEB] text-brand-deep">\${grandTotalSpecies}</td>
      </tr>\`;
      t2Body.innerHTML = t2Html;

      // --- Table 3: Semana x exposicion ---
      const t3Body = document.getElementById('table3-body');
      let t3Html = "";
      let sum0 = 0, sum1 = 0, sum2 = 0, grandTotalClasif = 0;
      weeks.forEach(w => {
        const c0 = records.filter(r => r.semana === w && r.clasificacion_exposicion === 0).length;
        const c1 = records.filter(r => r.semana === w && r.clasificacion_exposicion === 1).length;
        const c2 = records.filter(r => r.semana === w && r.clasificacion_exposicion === 2).length;
        const tot = c0 + c1 + c2;
        sum0 += c0; sum1 += c1; sum2 += c2; grandTotalClasif += tot;

        t3Html += \`<tr class="border-b border-slate-100 hover:bg-slate-50 transition-all">
          <td class="p-2.5 font-bold">Semana \${w}</td>
          <td class="p-2.5 text-right text-slate-600">\${c0}</td>
          <td class="p-2.5 text-right text-slate-600">\${c1}</td>
          <td class="p-2.5 text-right text-slate-600">\${c2}</td>
          <td class="p-2.5 text-right font-bold bg-slate-50/70 text-slate-800">\${tot}</td>
        </tr>\`;
      });
      t3Html += \`<tr class="bg-[#D6E4F0] font-extrabold text-brand-deep">
        <td class="p-2.5 uppercase text-[10px]">Total</td>
        <td class="p-2.5 text-right">\${sum0}</td>
        <td class="p-2.5 text-right">\${sum1}</td>
        <td class="p-2.5 text-right">\${sum2}</td>
        <td class="p-2.5 text-right bg-[#C9DBEB] text-brand-deep">\${grandTotalClasif}</td>
      </tr>\`;
      t3Body.innerHTML = t3Html;
    }

    function renderTableDetail() {
      const records = getFilteredRecords();
      const pagTotal = document.getElementById('pag-total');
      const pagIndices = document.getElementById('pag-indices');
      const pageIndicator = document.getElementById('page-indicator');
      const nextBtn = document.getElementById('btn-next');
      const prevBtn = document.getElementById('btn-prev');

      pagTotal.innerText = records.length;

      if (records.length === 0) {
        pagIndices.innerText = "0 a 0";
        pageIndicator.innerText = "Pág. 1 de 1";
        document.getElementById('table-detail-body').innerHTML = \`<tr><td colspan="10" class="text-center p-8 text-slate-400 font-semibold text-xs">⚠️ No se encontraron registros con los filtros activos</td></tr>\`;
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
      }

      const totalPages = Math.ceil(records.length / detailPageSize);
      if (detailPage >= totalPages) detailPage = totalPages - 1;
      if (detailPage < 0) detailPage = 0;

      const startIdx = detailPage * detailPageSize;
      const endIdx = Math.min(startIdx + detailPageSize, records.length);
      pagIndices.innerText = \`\${startIdx + 1} a \${endIdx}\`;
      pageIndicator.innerText = \`Pág. \${detailPage + 1} de \${totalPages}\`;

      prevBtn.disabled = detailPage === 0;
      nextBtn.disabled = endIdx >= records.length;

      const pageRecords = records.slice(startIdx, endIdx);
      const tableBody = document.getElementById('table-detail-body');
      let html = "";

      pageRecords.forEach(r => {
        // Responsable badge
        const respColor = RESPONSABLE_COLORES[r.responsable] || '#64748b';
        const respBadge = \`<span class="px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm" style="background-color: \${respColor}">\${r.responsable}</span>\`;

        // Clasif badge
        let clasColor = "bg-slate-100 text-slate-700 border-slate-200";
        let clasLabel = "Sin clasificar";
        if (r.clasificacion_exposicion === 1) {
          clasColor = "bg-orange-50 text-orange-700 border-orange-200";
          clasLabel = "Leve";
        } else if (r.clasificacion_exposicion === 2) {
          clasColor = "bg-red-50 text-red-700 border-red-200";
          clasLabel = "Grave";
        }
        const clasBadge = \`<span class="px-2 py-0.5 rounded border text-[10px] font-bold \${clasColor}">\${clasLabel}</span>\`;

        // Star priority
        const priorityStar = r.seg_prioritario === "Si" ? '<span class="text-amber-500 text-lg animate-pulse" title="Seguimiento prioritario">⭐</span>' : '';

        html += \`<tr class="border-b border-slate-100 hover:bg-slate-50/50 transition-all">
          <td class="p-4 font-mono font-bold text-brand-deep">\${r.cod_pre}</td>
          <td class="p-4 font-medium">\${r.semana}</td>
          <td class="p-4">\${respBadge}</td>
          <td class="p-4 font-medium">\${ESP_ANI[r.esp_ani] || 'Otro'}</td>
          <td class="p-4">\${clasBadge}</td>
          <td class="p-4 font-medium text-slate-600">\${r.localidad_ || '-'}</td>
          <td class="p-4 text-slate-500">\${r.bar_ver_ || '-'}</td>
          <td class="p-4">\${r.sexo_ || '-'}</td>
          <td class="p-4 text-center">\${priorityStar}</td>
          <td class="p-4"><span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#D6E4F0]/60 text-brand-deep">\${r.clas_post_seg || 'N/A'}</span></td>
        </tr>\`;
      });

      tableBody.innerHTML = html;
    }

    function getRowVal(row, ...keys) {
      if (!row) return undefined;
      const normKeys = keys.map(k => k.toLowerCase().replace(/[\s_\-]/g, ""));
      for (const rk of Object.keys(row)) {
        const normRowKey = rk.toLowerCase().replace(/[\s_\-]/g, "");
        if (normKeys.includes(normRowKey)) {
          return row[rk];
        }
      }
      return undefined;
    }

    function handleFileUpload(e, isAppend) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      const ext = file.name.split('.').pop().toLowerCase();

      reader.onload = function(evt) {
        try {
          const data = evt.target.result;
          let parsedRows = [];

          if (ext === 'xlsx') {
            const XLSX = window.XLSX;
            const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
            
            // Requerimiento: Hoja2
            const sheetName = workbook.SheetNames.includes("Hoja2") ? "Hoja2" : workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            parsedRows = XLSX.utils.sheet_to_json(sheet);
          } else {
            // Nativo CSV parser (checks for semicolon or comma)
            const lines = data.split(/\r?\n/);
            if (lines.length > 1) {
              const firstLine = lines[0];
              const separator = firstLine.includes(";") ? ";" : ",";
              const headers = firstLine.split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
              for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const cols = lines[i].split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
                const obj = {};
                headers.forEach((h, idx) => {
                  obj[h] = cols[idx];
                });
                parsedRows.push(obj);
              }
            }
          }

          if (parsedRows.length === 0) {
            showToast("⚠️ El archivo no contiene filas válidas", "warning");
            return;
          }

          // Convert rows to CaseRecord types with robust synonym and type mapper
          const normalized = parsedRows.map(row => {
            const cod = getRowVal(row, "cod_pre", "codpre", "codigo", "cod");
            const sem = getRowVal(row, "semana", "sem", "semana_epidem");
            const anio = getRowVal(row, "año", "ano", "year");
            const esp = getRowVal(row, "esp_ani", "espani", "especie");
            const clas = getRowVal(row, "clasificacion_exposicion", "clasificacionexposicion", "clasificacion", "exposicion");
            const resp = getRowVal(row, "responsable", "resp", "encargado");
            const repS = getRowVal(row, "rep_se_ant", "repseant", "semana_anterior", "anterior", "rep");
            const loc = getRowVal(row, "localidad_", "localidad", "municipio", "comuna");
            const bar = getRowVal(row, "bar_ver_", "barver", "barrio", "vereda");
            const sex = getRowVal(row, "sexo_", "sexo", "genero");
            const clp = getRowVal(row, "clas_post_seg", "claspostseg", "seguimiento", "post", "clas");
            const sPr = getRowVal(row, "seg_prioritario", "segprioritario", "prioritario");
            const est = getRowVal(row, "estado_ani", "estadoani", "estado");
            const fN = getRowVal(row, "fec_not", "fecnot", "fecha");

            // Smart parse species
            let espNum = parseInt(esp);
            if (isNaN(espNum) && esp) {
              const espStr = esp.toString().toLowerCase().trim();
              if (espStr.startsWith("can")) espNum = 1;
              else if (espStr.startsWith("fel")) espNum = 2;
              else espNum = 4;
            }
            if (isNaN(espNum)) espNum = 1;

            // Smart parse exposures
            let clasNum = parseInt(clas);
            if (isNaN(clasNum) && clas) {
              const clasStr = clas.toString().toLowerCase().trim();
              if (clasStr.includes("grave")) clasNum = 2;
              else if (clasStr.includes("leve")) clasNum = 1;
              else clasNum = 0;
            }
            if (isNaN(clasNum)) clasNum = 0;

            // Smart parse state
            let estNum = parseInt(est);
            if (isNaN(estNum) && est) {
              const estStr = est.toString().toLowerCase().trim();
              if (estStr.includes("muerto") || estStr.includes("fallecido")) estNum = 2;
              else estNum = 1;
            }
            if (isNaN(estNum)) estNum = 1;

            return {
              cod_pre: parseInt(cod) || Math.floor(Math.random() * 100000),
              semana: parseInt(sem) || 20,
              año: parseInt(anio) || 2026,
              esp_ani: espNum,
              clasificacion_exposicion: clasNum,
              responsable: resp ? resp.toString().trim() : "Prada",
              rep_se_ant: repS ? repS.toString().trim() : "no",
              localidad_: loc ? loc.toString().trim() : "",
              bar_ver_: bar ? bar.toString().trim() : "",
              sexo_: sex ? sex.toString().trim() : "F",
              clas_post_seg: clp ? clp.toString().trim() : "Pendiente",
              seg_prioritario: sPr ? sPr.toString().trim() : "No",
              estado_ani: estNum,
              fec_not: fN ? fN.toString().trim() : ""
            };
          });

          // Support appending and replacing without discarding duplicate cod_pre cases
          if (isAppend) {
            ALL_CASES = [...ALL_CASES, ...normalized];
          } else {
            ALL_CASES = normalized;
          }

          // Get counts
          const loadedCount = normalized.length;
          const excludedCount = normalized.filter(r => r.rep_se_ant && r.rep_se_ant.toString().toLowerCase().trim() === "si").length;

          detailPage = 0;
          populateSemanaDropdown();
          renderAll();

          showToast(\`✅ \${loadedCount} casos cargados exitosamente\`, "success");

        } catch (error) {
          console.error(error);
          showToast("❌ Hubo un error al procesar el archivo.", "error");
        }
      };

      if (ext === 'xlsx') {
        reader.readAsBinaryString(file);
      } else {
        reader.readAsText(file);
      }

      // Reset file input target
      e.target.value = "";
    }

    function showToast(message, type) {
      const toast = document.getElementById('toast');
      const icon = document.getElementById('toast-icon');
      const text = document.getElementById('toast-text');

      text.innerText = message;
      if (type === 'success') {
        icon.innerText = "✅";
        toast.className = "fixed bottom-5 right-5 z-55 max-w-sm bg-emerald-50 border border-emerald-100 rounded-xl shadow-xl p-4 flex items-center gap-3 text-emerald-800 font-bold block";
      } else if (type === 'error') {
        icon.innerText = "❌";
        toast.className = "fixed bottom-5 right-5 z-55 max-w-sm bg-rose-50 border border-rose-100 rounded-xl shadow-xl p-4 flex items-center gap-3 text-rose-800 font-bold block";
      } else {
        icon.innerText = "⚠️";
        toast.className = "fixed bottom-5 right-5 z-55 max-w-sm bg-amber-50 border border-amber-100 rounded-xl shadow-xl p-4 flex items-center gap-3 text-amber-800 font-bold block";
      }

      setTimeout(() => {
        toast.classList.add('hidden');
      }, 4000);
    }

    function downloadTableCSV(tableId, filename) {
      const table = document.getElementById(tableId);
      let csv = [];
      const rows = table.querySelectorAll('tr');
      
      rows.forEach(row => {
        const cols = row.querySelectorAll('th, td');
        const rowData = [];
        cols.forEach(col => {
          // Remove commas and spaces
          const cleanText = col.innerText.replace(/\\n/g, ' ').replace(/"/g, '""').trim();
          rowData.push(\`"\${cleanText}"\`);
        });
        csv.push(rowData.join(','));
      });

      triggerDownload(csv.join('\\n'), filename);
    }

    function triggerDownload(content, filename) {
      const blob = new Blob(["\\ufeff" + content], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }

    window.onload = init;
  </script>
</body>
</html>`;
}
