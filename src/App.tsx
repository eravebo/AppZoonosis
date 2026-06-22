import { useState, useEffect, useRef, useMemo, ChangeEvent } from "react";
import {
  FileSpreadsheet, Trash2, Plus, HelpCircle, Search, Download,
  AlertTriangle, CheckCircle, TrendingUp, Users, Activity, Briefcase,
  ArrowLeftRight, Cloud, FolderOpen, LogOut, Key, RefreshCw, Folder,
  ExternalLink, Check
} from "lucide-react";

import {
  CaseRecord, ESP_ANI, CLASIF_EXP, ESTADO_ANI, RESPONSABLE_COLORES,
  CLASIF_EXP_COLORES, normalizarClasPost, CLAS_POST_LABELS
} from "./types";
import { DEMO_DATA } from "./data";

// ──────────────────────────────────────────────
// Normalización de nombre de responsable
// Detecta "Prada" o "Juan" sin importar mayúsculas,
// tildes, espacios extra ni separadores (guión, coma, punto)
// Ejemplos que mapean a "Prada": "prada", "PRADA", "juan-prada", "Prada J.", "j. prada"
// Ejemplos que mapean a "Juan":  "juan", "JUAN", "Juan C", "juan c.", "j.carlos"
// Si contiene ambas palabras, gana "Prada" (es el apellido, más distintivo)
// ──────────────────────────────────────────────
const normalizarResponsable = (v: any): string => {
  if (!v) return "Sin asignar";
  const s = v.toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar tildes
    .replace(/[^a-z0-9\s]/g, " ")                     // guiones, puntos, comas → espacio
    .replace(/\s+/g, " ").trim();
  if (s.includes("prada")) return "Prada";
  if (s.includes("juan"))  return "Juan";
  // fallback: capitalizar primera letra de la primera palabra
  const primera = v.toString().trim().split(/[\s\-_,]/)[0];
  return primera.charAt(0).toUpperCase() + primera.slice(1).toLowerCase();
};

// ──────────────────────────────────────────────
// Helpers de parsing de especie SIVIGILA completa
// ──────────────────────────────────────────────
const parseEspAni = (v: any): number => {
  const n = parseInt(v);
  if (!isNaN(n) && ESP_ANI[n]) return n;
  if (v) {
    const s = v.toString().toLowerCase().trim();
    if (s.includes("perro") || s.includes("canino") || s.includes("can")) return 1;
    if (s.includes("gato") || s.includes("felino") || s.includes("fel")) return 2;
    if (s.includes("bovino") || s.includes("bufalino")) return 3;
    if (s.includes("equido") || s.includes("caballo") || s.includes("mula")) return 4;
    if (s.includes("porcino") || s.includes("cerdo")) return 5;
    if (s.includes("murci")) return 7;
    if (s.includes("zorro")) return 8;
    if (s.includes("mico") || s.includes("mono")) return 9;
    if (s.includes("humano") || s.includes("persona")) return 10;
    if (s.includes("silvestre")) return 12;
    if (s.includes("ovino") || s.includes("caprino") || s.includes("oveja") || s.includes("cabra")) return 13;
    if (s.includes("roedor") || s.includes("rata") || s.includes("raton")) return 14;
  }
  return 1;
};

const parseClasExp = (v: any): number => {
  const n = parseInt(v);
  if (!isNaN(n)) return Math.min(Math.max(n, 0), 2);
  if (v) {
    const s = v.toString().toLowerCase();
    if (s.includes("grave")) return 2;
    if (s.includes("leve")) return 1;
    if (s.includes("no exp") || s.includes("sin exp")) return 0;
  }
  return 0;
};

// ──────────────────────────────────────────────
// Colores para gráfica comparativa exposición
// ──────────────────────────────────────────────
const CLAS_POST_COLORES: Record<string, string> = {
  "no exposicion":    "#16a34a",
  "exposicion leve":  "#d97706",
  "exposicion grave": "#dc2626",
  "sin establecer":   "#6b7280",
};

const CLAS_POST_ORDER = ["no exposicion", "exposicion leve", "exposicion grave", "sin establecer"];

export default function App() {
  const [cases, setCases] = useState<CaseRecord[]>(() => {
    try {
      const saved = localStorage.getItem("sivigila_cases");
      return saved ? JSON.parse(saved) : DEMO_DATA;
    } catch {
      return DEMO_DATA;
    }
  });
  const [vistaMode, setVistaMode] = useState<"sivigila" | "postseg">("postseg");

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);
  const [modalLimpiar, setModalLimpiar] = useState(false);
  const [sheetWarning, setSheetWarning] = useState<{ sheets: string[]; onConfirm: (sheet: string) => void } | null>(null);
  const showToast = (message: string, type: "success" | "error" | "warning") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Guardar los casos en localStorage cada vez que cambien para evitar que se borren al recargar
  useEffect(() => {
    try {
      localStorage.setItem("sivigila_cases", JSON.stringify(cases));
    } catch (err) {
      console.error("Error al guardar casos en localStorage:", err);
    }
  }, [cases]);

  // ── Estados de Google Drive
  const [activeLoadTab, setActiveLoadTab] = useState<"local" | "gdrive">("local");
  const [gdriveToken, setGdriveToken] = useState<string | null>(null);
  const [gdriveClientId, setGdriveClientId] = useState<string>(() => {
    return (import.meta as any).env.VITE_GOOGLE_CLIENT_ID || localStorage.getItem("gdrive_client_id") || "863610981797-p7ktoiqe2sssd1dj7jilvrjginug3q9h.apps.googleusercontent.com";
  });
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [driveFolders, setDriveFolders] = useState<any[]>([]);
  const [pinnedFolderId, setPinnedFolderId] = useState<string>(() => {
    return localStorage.getItem("gdrive_pinned_folder_id") || "all";
  });
  const [pinnedFolderName, setPinnedFolderName] = useState<string>(() => {
    return localStorage.getItem("gdrive_pinned_folder_name") || "";
  });
  const [selectedFolderId, setSelectedFolderId] = useState<string>(() => {
    return localStorage.getItem("gdrive_pinned_folder_id") || "all";
  });
  const [driveSearchQuery, setDriveSearchQuery] = useState<string>("");
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [isDownloadingFile, setIsDownloadingFile] = useState<string | null>(null);
  const [showConfigIdInput, setShowConfigIdInput] = useState<boolean>(false);
  const [driveFetchError, setDriveFetchError] = useState<string | null>(null);

  // ── Funciones de Consulta a Google Drive API
  const fetchFolders = async (token: string) => {
    try {
      const q = "mimeType='application/vnd.google-apps.folder' and trashed = false";
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=100&orderBy=name`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDriveFolders(data.files || []);
      }
    } catch (err) {
      console.error("Error al obtener carpetas de Google Drive:", err);
    }
  };

  const fetchFiles = async (token: string, folderId: string, search: string) => {
    setIsLoadingFiles(true);
    setDriveFetchError(null);
    try {
      let q = "(mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='text/csv' or name contains '.xlsx' or name contains '.csv') and trashed = false";
      if (folderId && folderId !== "all") {
        q += ` and '${folderId}' in parents`;
      }
      if (search) {
        q += ` and name contains '${search.replace(/'/g, "\\'")}'`;
      }
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime)&orderBy=modifiedTime desc&pageSize=50`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) {
          handleDisconnectDrive();
          return;
        }
        const errText = await res.text();
        let parsedMessage = "";
        try {
          const parsed = JSON.parse(errText);
          parsedMessage = parsed?.error?.message || errText;
        } catch {
          parsedMessage = errText || `Error HTTP ${res.status}`;
        }
        throw new Error(parsedMessage);
      }
      const data = await res.json();
      setDriveFiles(data.files || []);
    } catch (err: any) {
      console.error("Error al obtener archivos:", err);
      const msg = err?.message || String(err);
      setDriveFetchError(msg);
      showToast("❌ No se pudieron listar los archivos de Google Drive", "error");
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleConnectDrive = () => {
    if (!gdriveClientId) {
      showToast("⚠️ Por favor, ingresa un ID de Cliente de Google válido.", "warning");
      setShowConfigIdInput(true);
      return;
    }
    localStorage.setItem("gdrive_client_id", gdriveClientId);
    
    const redirectUri = window.location.origin + window.location.pathname;
    const scopes = "https://www.googleapis.com/auth/drive.readonly";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(gdriveClientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scopes)}&state=google_drive_auth`;
    
    showToast("Abriendo ventana de conexión de Google...", "warning");
    
    // Abrir ventana emergente (Popup) para evitar restricciones del iframe
    const width = 600;
    const height = 650;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(authUrl, "google_drive_auth_popup", `width=${width},height=${height},top=${top},left=${left}`);
  };

  const handleDisconnectDrive = () => {
    setGdriveToken(null);
    localStorage.removeItem("gdrive_access_token");
    localStorage.removeItem("gdrive_token_expires");
    setDriveFiles([]);
    setDriveFolders([]);
    showToast("Conexión de Google Drive interrumpida.", "warning");
  };

  // Escuchar mensajes entrantes desde el popup de login
  useEffect(() => {
    const handlePostMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "google_drive_token") {
        const { token, expires } = event.data;
        setGdriveToken(token);
        localStorage.setItem("gdrive_access_token", token);
        if (expires) {
          localStorage.setItem("gdrive_token_expires", expires);
        }
        showToast("¡Google Drive conectado correctamente! ☁️", "success");
        setActiveLoadTab("gdrive");
      }
    };
    window.addEventListener("message", handlePostMessage);
    return () => window.removeEventListener("message", handlePostMessage);
  }, []);

  // Sincronizar hash de token de autenticación (tanto para ventanas principales como para popups)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("access_token=")) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get("access_token");
      const state = params.get("state");
      if (token && state === "google_drive_auth") {
        const expires = params.get("expires_in");
        const expireTime = expires ? (Date.now() + parseInt(expires) * 1000).toString() : "";
        
        if (window.opener) {
          // Si estamos dentro del popup, mandamos el token al "window.opener" y nos autocerramos
          window.opener.postMessage({
            type: "google_drive_token",
            token: token,
            expires: expireTime
          }, window.location.origin);
          window.close();
          return;
        } else {
          // Fallback para recarga normal
          setGdriveToken(token);
          localStorage.setItem("gdrive_access_token", token);
          if (expireTime) {
            localStorage.setItem("gdrive_token_expires", expireTime);
          }
          showToast("¡Google Drive conectado correctamente! ☁️", "success");
          setActiveLoadTab("gdrive");
        }
      }
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } else {
      const savedToken = localStorage.getItem("gdrive_access_token");
      const expires = localStorage.getItem("gdrive_token_expires");
      if (savedToken && expires && parseInt(expires) > Date.now()) {
        setGdriveToken(savedToken);
        setActiveLoadTab("gdrive");
      }
    }
  }, []);

  // Recargar archivos al cambiar filtros o token
  useEffect(() => {
    if (gdriveToken) {
      fetchFiles(gdriveToken, selectedFolderId, driveSearchQuery);
      fetchFolders(gdriveToken);
    }
  }, [gdriveToken, selectedFolderId]);

  const handleLoadDriveFile = async (fileId: string, fileName: string, isAppend: boolean) => {
    if (!gdriveToken) return;
    setIsDownloadingFile(fileId);
    showToast(`☁️ Descargando "${fileName}"...`, "warning");
    try {
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${gdriveToken}` }
      });
      if (!res.ok) {
        if (res.status === 401) {
          handleDisconnectDrive();
          return;
        }
        throw new Error("No se pudo descargar");
      }

      const arrayBuffer = await res.arrayBuffer();
      const ext = fileName.split(".").pop()?.toLowerCase();
      let parsedRows: any[] = [];

      if (ext === "xlsx") {
        const XLSX = (window as any).XLSX;
        if (!XLSX) {
          showToast("SheetJS CDN está cargando. Reintenta en un momento.", "warning");
          setIsDownloadingFile(null);
          return;
        }
        const data = new Uint8Array(arrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });

        if (wb.SheetNames.length > 1) {
          setSheetWarning({
            sheets: wb.SheetNames,
            onConfirm: (selectedSheet: string) => {
              setSheetWarning(null);
              procesarWorkbook(wb, selectedSheet, isAppend);
            }
          });
          setIsDownloadingFile(null);
          return;
        }

        const sheetName = wb.SheetNames[0];
        parsedRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
      } else {
        const textDecoder = new TextDecoder("utf-8");
        const text = textDecoder.decode(arrayBuffer);
        const lines = text.split(/\r?\n/);
        if (lines.length > 1) {
          const sep = lines[0].includes(";") ? ";" : ",";
          const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ""));
          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
            const obj: any = {};
            headers.forEach((h, idx) => { obj[h] = cols[idx]; });
            parsedRows.push(obj);
          }
        }
      }

      if (parsedRows.length === 0) {
        showToast("⚠️ El archivo no contiene filas válidas.", "warning");
        setIsDownloadingFile(null);
        return;
      }

      procesarRows(parsedRows, isAppend);
      showToast(`✅ Datos de "${fileName}" cargados con éxito`, "success");
    } catch (err) {
      console.error(err);
      showToast("❌ Error al descargar o leer el archivo de Google Drive", "error");
    } finally {
      setIsDownloadingFile(null);
    }
  };

  // ── Todos los casos (SIVIGILA incluye repetidos)
  const allCases = cases;
  // ── Post seguimiento excluye rep_se_ant === "si" (con normalización robusta de tildes y espacios)
  const casesPostSeg = useMemo(
    () => cases.filter(r => {
      if (!r.rep_se_ant) return true;
      const val = r.rep_se_ant.toString().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar tildes
        .trim();
      return val !== "si";
    }),
    [cases]
  );

  const activeCases = vistaMode === "sivigila" ? allCases : casesPostSeg;
  const excludedCount = allCases.length - casesPostSeg.length;

  const availableWeeks = useMemo(() => {
    const weeks = Array.from(new Set(activeCases.map(c => Number(c.semana)))) as number[];
    return weeks.sort((a, b) => a - b);
  }, [activeCases]);

  // ── Filtros
  const [selectedSemana, setSelectedSemana] = useState("Todas");
  const [selectedResponsable, setSelectedResponsable] = useState("Todos");
  const [selectedEspecie, setSelectedEspecie] = useState("Todas");
  const [selectedExposicion, setSelectedExposicion] = useState("Todas");
  const [onlyPrioritarios, setOnlyPrioritarios] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailPage, setDetailPage] = useState(0);
  const detailPageSize = 20;

  useEffect(() => { setDetailPage(0); }, [selectedSemana, selectedResponsable, selectedEspecie, selectedExposicion, onlyPrioritarios, searchQuery, vistaMode]);

  const filteredCases = useMemo(() => {
    return activeCases.filter(r => {
      if (selectedSemana !== "Todas" && r.semana.toString() !== selectedSemana) return false;
      if (selectedResponsable !== "Todos" && r.responsable !== selectedResponsable) return false;
      if (selectedEspecie !== "Todas" && r.esp_ani.toString() !== selectedEspecie) return false;
      if (selectedExposicion !== "Todas" && r.clasificacion_exposicion.toString() !== selectedExposicion) return false;
      if (onlyPrioritarios && r.seg_prioritario?.toLowerCase() !== "si") return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        if (
          !r.cod_pre?.toString().includes(q) &&
          !r.localidad_?.toLowerCase().includes(q) &&
          !r.bar_ver_?.toLowerCase().includes(q) &&
          !r.responsable?.toLowerCase().includes(q) &&
          !r.dir_res_?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [activeCases, selectedSemana, selectedResponsable, selectedEspecie, selectedExposicion, onlyPrioritarios, searchQuery]);

  // ── KPIs
  const kpis = useMemo(() => {
    const total = activeCases.length;
    const active = filteredCases.length;
    const pradaCount = filteredCases.filter(r => r.responsable === "Prada").length;
    const juanCount  = filteredCases.filter(r => r.responsable === "Juan").length;
    const graveCount = filteredCases.filter(r => r.clasificacion_exposicion === 2).length;
    const denom = active || 1;
    return {
      total, active, excludedCount,
      pradaCount, pradaPct: Math.round(pradaCount / denom * 100),
      juanCount,  juanPct:  Math.round(juanCount  / denom * 100),
      graveCount, gravePct: Math.round(graveCount / denom * 100),
    };
  }, [activeCases, filteredCases, excludedCount]);

  // ── Responsables únicos dinámicos
  const responsablesUnicos = useMemo(() => {
    return Array.from(new Set(activeCases.map(r => r.responsable))).sort();
  }, [activeCases]);

  // ── Chart refs
  const chartRef1 = useRef<HTMLCanvasElement>(null);
  const chartRef2 = useRef<HTMLCanvasElement>(null);
  const chartRef3 = useRef<HTMLCanvasElement>(null);
  const chartRef4 = useRef<HTMLCanvasElement>(null);
  const chartRef5 = useRef<HTMLCanvasElement>(null); // comparativo exp vs post
  const chartRef6 = useRef<HTMLCanvasElement>(null); // comparativo donuts
  const chartRef7 = useRef<HTMLCanvasElement>(null); // barras semanal × clasificación (nuevo)
  const chartInstances = useRef<any[]>([]);

  useEffect(() => {
    const Chart = (window as any).Chart;
    const ChartDataLabels = (window as any).ChartDataLabels;
    if (!Chart) return;
    chartInstances.current.forEach(i => { try { i.destroy(); } catch {} });
    chartInstances.current = [];

    const weeks = [...availableWeeks];
    if (weeks.length === 0) return;

    const activePlugins = ChartDataLabels ? [ChartDataLabels] : [];

    // ── Opciones comunes de datalabels para barras apiladas (centro)
    const datalabelStackedBar = {
      display: (ctx: any) => {
        const v = ctx.dataset.data[ctx.dataIndex];
        if (!v || v <= 0) return false;
        const total = ctx.chart.data.datasets.reduce((sum: number, ds: any) => sum + (ds.data[ctx.dataIndex] || 0), 0);
        const percent = total > 0 ? Math.round((v / total) * 100) : 0;
        return percent >= 6; // Ocultar si es menor al 6% para evitar amontonar y empalmar
      },
      color: "#fff",
      font: { weight: "600" as const, size: 8.5 },
      textShadowColor: "rgba(0,0,0,0.5)",
      textShadowBlur: 2,
      formatter: (v: number, ctx: any) => {
        const dataIndex = ctx.dataIndex;
        const datasets = ctx.chart.data.datasets;
        const total = datasets.reduce((sum: number, ds: any) => sum + (ds.data[dataIndex] || 0), 0);
        const percent = total > 0 ? Math.round((v / total) * 100) : 0;
        return `${percent}%`;
      },
      anchor: "center" as const,
      align: "center" as const,
    };

    // Datalabels para línea (encima del punto)
    const datalabelLine = {
      display: (ctx: any) => {
        const v = ctx.dataset.data[ctx.dataIndex];
        return v && v > 0;
      },
      color: "#475569", // slate-600 para un look elegante y moderno
      font: { weight: "600" as const, size: 8 },
      formatter: (v: number, ctx: any) => {
        const dataIndex = ctx.dataIndex;
        const datasets = ctx.chart.data.datasets;
        const total = datasets.reduce((sum: number, ds: any) => sum + (ds.data[dataIndex] || 0), 0);
        const percent = total > 0 ? Math.round((v / total) * 100) : 0;
        return `${percent}%`;
      },
      anchor: "end" as const,
      align: "top" as const,
      offset: 4,
    };

    // Datalabels para dona (categorías)
    const datalabelDonut = {
      display: (ctx: any) => {
        const v = ctx.dataset.data[ctx.dataIndex];
        if (!v || v <= 0) return false;
        const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
        const percent = total > 0 ? Math.round((v / total) * 100) : 0;
        return percent >= 4; // Ocultar mini-rebanadas para evitar saturación de texto
      },
      color: "#fff",
      font: { weight: "bold" as const, size: 9.5 },
      textShadowColor: "rgba(0,0,0,0.5)",
      textShadowBlur: 3,
      formatter: (v: number, ctx: any) => {
        const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
        const percent = Math.round((v / total) * 100);
        return `${percent}%`;
      },
    };

    // Datalabels para barras horizontales agrupadas (por fuera al final)
    const datalabelHorizontalBar = {
      display: (ctx: any) => {
        const v = ctx.dataset.data[ctx.dataIndex];
        return v && v > 0;
      },
      color: "#334155", // slate-700
      font: { weight: "600" as const, size: 8 },
      formatter: (v: number, ctx: any) => {
        const dataIndex = ctx.dataIndex;
        const datasets = ctx.chart.data.datasets;
        const total = datasets.reduce((sum: number, ds: any) => sum + (ds.data[dataIndex] || 0), 0);
        const percent = total > 0 ? Math.round((v / total) * 100) : 0;
        return `${percent}%`;
      },
      anchor: "end" as const,
      align: "right" as const,
      offset: 3,
    };

    // Datalabels para barras agrupadas verticales (por fuera al final arriba)
    const datalabelGroupedBar = {
      display: (ctx: any) => {
        const v = ctx.dataset.data[ctx.dataIndex];
        return v && v > 0;
      },
      color: "#334155", // slate-700
      font: { weight: "600" as const, size: 8 },
      formatter: (v: number, ctx: any) => {
        const dataIndex = ctx.dataIndex;
        const datasets = ctx.chart.data.datasets;
        const total = datasets.reduce((sum: number, ds: any) => sum + (ds.data[dataIndex] || 0), 0);
        const percent = total > 0 ? Math.round((v / total) * 100) : 0;
        return `${percent}%`;
      },
      anchor: "end" as const,
      align: "top" as const,
      offset: 3,
    };

    // Datalabels específicos para gráfico comparativo (SIVIGILA vs Post)
    const datalabelGroupedBarChart5 = {
      display: (ctx: any) => {
        const v = ctx.dataset.data[ctx.dataIndex];
        return v && v > 0;
      },
      color: "#334155", // slate-700
      font: { weight: "600" as const, size: 8 },
      formatter: (v: number, ctx: any) => {
        const total = ctx.dataset.data.reduce((sum: number, val: number) => sum + (val || 0), 0);
        const percent = total > 0 ? Math.round((v / total) * 100) : 0;
        return `${percent}%`;
      },
      anchor: "end" as const,
      align: "top" as const,
      offset: 3,
    };

    // Chart 1 ── Evolución semanal por responsable
    if (chartRef1.current) {
      const datasets = responsablesUnicos.map((resp, i) => ({
        label: resp,
        data: weeks.map(w => filteredCases.filter(r => r.semana === w && r.responsable === resp).length),
        borderColor: RESPONSABLE_COLORES[resp] || `hsl(${i * 60}, 60%, 50%)`,
        backgroundColor: `${RESPONSABLE_COLORES[resp] || "#999"}18`,
        tension: 0.25, borderWidth: 3, fill: true,
        datalabels: datalabelLine,
      }));
      chartInstances.current.push(new Chart(chartRef1.current, {
        type: "line",
        data: { labels: weeks.map(w => `Sem. ${w}`), datasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } }, scales: { y: { beginAtZero: true, grace: "15%", ticks: { stepSize: 1 } } } },
        plugins: activePlugins
      }));
    }

    // Chart 2 ── Especie donut (14 tipos)
    if (chartRef2.current) {
      const especiesPresentes = Object.keys(ESP_ANI).map(Number).filter(k => filteredCases.some(r => r.esp_ani === k));
      const PALETTE = ["#0A4057","#1DABE3","#F16729","#16a34a","#9333ea","#dc2626","#d97706","#0891b2","#be185d","#65a30d","#7c3aed","#0f766e"];
      chartInstances.current.push(new Chart(chartRef2.current, {
        type: "doughnut",
        data: {
          labels: especiesPresentes.map(k => ESP_ANI[k]),
          datasets: [{ data: especiesPresentes.map(k => filteredCases.filter(r => r.esp_ani === k).length), backgroundColor: PALETTE, borderWidth: 2, hoverOffset: 8, datalabels: datalabelDonut }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { font: { size: 10 }, boxWidth: 12 } } } },
        plugins: activePlugins
      }));
    }

    // Chart 3 ── Clasificación SIVIGILA por semana (apilada)
    if (chartRef3.current) {
      chartInstances.current.push(new Chart(chartRef3.current, {
        type: "bar",
        data: {
          labels: weeks.map(w => `Sem. ${w}`),
          datasets: [
            { label: "No exposición", data: weeks.map(w => filteredCases.filter(r => r.semana === w && r.clasificacion_exposicion === 0).length), backgroundColor: "#6b7280", datalabels: datalabelStackedBar },
            { label: "Exp. leve",     data: weeks.map(w => filteredCases.filter(r => r.semana === w && r.clasificacion_exposicion === 1).length), backgroundColor: "#d97706", datalabels: datalabelStackedBar },
            { label: "Exp. grave",    data: weeks.map(w => filteredCases.filter(r => r.semana === w && r.clasificacion_exposicion === 2).length), backgroundColor: "#dc2626", datalabels: datalabelStackedBar },
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, grace: "15%" } }, plugins: { legend: { position: "top" } } },
        plugins: activePlugins
      }));
    }

    // Chart 4 ── Distribución por responsable y clasificación
    if (chartRef4.current) {
      chartInstances.current.push(new Chart(chartRef4.current, {
        type: "bar",
        data: {
          labels: responsablesUnicos,
          datasets: [
            { label: "No exposición", data: responsablesUnicos.map(r => filteredCases.filter(c => c.responsable === r && c.clasificacion_exposicion === 0).length), backgroundColor: "#6b7280", datalabels: datalabelHorizontalBar },
            { label: "Exp. leve",     data: responsablesUnicos.map(r => filteredCases.filter(c => c.responsable === r && c.clasificacion_exposicion === 1).length), backgroundColor: "#d97706", datalabels: datalabelHorizontalBar },
            { label: "Exp. grave",    data: responsablesUnicos.map(r => filteredCases.filter(c => c.responsable === r && c.clasificacion_exposicion === 2).length), backgroundColor: "#dc2626", datalabels: datalabelHorizontalBar },
          ]
        },
        options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, scales: { x: { beginAtZero: true, grace: "15%" } }, plugins: { legend: { position: "top" } } },
        plugins: activePlugins
      }));
    }

    // ── Charts comparativos SIVIGILA vs POST SEGUIMIENTO (solo en vista postseg o siempre)
    const postCases = casesPostSeg.filter(r => {
      if (selectedSemana !== "Todas" && r.semana.toString() !== selectedSemana) return false;
      if (selectedResponsable !== "Todos" && r.responsable !== selectedResponsable) return false;
      if (selectedEspecie !== "Todas" && r.esp_ani.toString() !== selectedEspecie) return false;
      return true;
    });

    // Chart 5 ── Barras comparativas: clasificación SIVIGILA vs POST
    if (chartRef5.current) {
      const sivigilaData = [0, 1, 2].map(k => postCases.filter(r => r.clasificacion_exposicion === k).length);
      const postData = CLAS_POST_ORDER.map(k => postCases.filter(r => normalizarClasPost(r.clas_post_seg) === k).length);
      chartInstances.current.push(new Chart(chartRef5.current, {
        type: "bar",
        data: {
          labels: ["No exposición", "Exp. leve", "Exp. grave", "Sin establecer"],
          datasets: [
            { label: "SIVIGILA (inicial)", data: [...sivigilaData, 0], backgroundColor: "rgba(29,171,227,0.75)", borderColor: "#1DABE3", borderWidth: 1.5, datalabels: datalabelGroupedBarChart5 },
            { label: "Post seguimiento",   data: postData,             backgroundColor: "rgba(241,103,41,0.75)",  borderColor: "#F16729", borderWidth: 1.5, datalabels: datalabelGroupedBarChart5 },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: "top" }, title: { display: true, text: "Clasificación inicial (SIVIGILA) vs. Post seguimiento", font: { size: 11 } } },
          scales: { y: { beginAtZero: true, grace: "15%", ticks: { stepSize: 1 } } }
        },
        plugins: activePlugins
      }));
    }

    // Chart 6 ── Dona: distribución post seguimiento
    if (chartRef6.current) {
      const postCounts = CLAS_POST_ORDER.map(k => postCases.filter(r => normalizarClasPost(r.clas_post_seg) === k).length);
      const postColors = CLAS_POST_ORDER.map(k => CLAS_POST_COLORES[k]);
      chartInstances.current.push(new Chart(chartRef6.current, {
        type: "doughnut",
        data: {
          labels: ["No exposición", "Exp. leve", "Exp. grave", "Sin establecer"],
          datasets: [{ data: postCounts, backgroundColor: postColors, borderWidth: 2, hoverOffset: 8, datalabels: datalabelDonut }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: "bottom", labels: { font: { size: 10 }, boxWidth: 12 } }, title: { display: true, text: "Distribución post seguimiento", font: { size: 11 } } }
        },
        plugins: activePlugins
      }));
    }

    // Chart 7 ── Barras agrupadas por semana × clasificación (SIVIGILA o Post según vista)
    if (chartRef7.current) {
      const casesParaChart7 = vistaMode === "sivigila" ? filteredCases : casesPostSeg.filter(r => {
        if (selectedSemana !== "Todas" && r.semana.toString() !== selectedSemana) return false;
        if (selectedResponsable !== "Todos" && r.responsable !== selectedResponsable) return false;
        if (selectedEspecie !== "Todas" && r.esp_ani.toString() !== selectedEspecie) return false;
        if (selectedExposicion !== "Todas" && r.clasificacion_exposicion.toString() !== selectedExposicion) return false;
        return true;
      });

      if (vistaMode === "sivigila") {
        // Barras agrupadas: No exp / Leve / Grave por semana — clasificación SIVIGILA
        chartInstances.current.push(new Chart(chartRef7.current, {
          type: "bar",
          data: {
            labels: weeks.map(w => `Sem. ${w}`),
            datasets: [
              { label: "No exposición", data: weeks.map(w => casesParaChart7.filter(r => r.semana === w && r.clasificacion_exposicion === 0).length), backgroundColor: "#6b7280", datalabels: datalabelGroupedBar },
              { label: "Exp. leve",     data: weeks.map(w => casesParaChart7.filter(r => r.semana === w && r.clasificacion_exposicion === 1).length), backgroundColor: "#d97706", datalabels: datalabelGroupedBar },
              { label: "Exp. grave",    data: weeks.map(w => casesParaChart7.filter(r => r.semana === w && r.clasificacion_exposicion === 2).length), backgroundColor: "#dc2626", datalabels: datalabelGroupedBar },
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            scales: { x: { grouped: true }, y: { beginAtZero: true, grace: "15%", ticks: { stepSize: 1 } } },
            plugins: {
              legend: { position: "top" },
              title: { display: true, text: "Clasificación SIVIGILA por semana (agrupado)", font: { size: 11 } }
            }
          },
          plugins: activePlugins
        }));
      } else {
        // Barras agrupadas: clasificación POST seguimiento por semana
        chartInstances.current.push(new Chart(chartRef7.current, {
          type: "bar",
          data: {
            labels: weeks.map(w => `Sem. ${w}`),
            datasets: CLAS_POST_ORDER.map(k => ({
              label: k === "no exposicion" ? "No exposición" : k === "exposicion leve" ? "Exp. leve" : k === "exposicion grave" ? "Exp. grave" : "Sin establecer",
              data: weeks.map(w => casesParaChart7.filter(r => r.semana === w && normalizarClasPost(r.clas_post_seg) === k).length),
              backgroundColor: CLAS_POST_COLORES[k],
              datalabels: datalabelGroupedBar,
            }))
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            scales: { x: { grouped: true }, y: { beginAtZero: true, grace: "15%", ticks: { stepSize: 1 } } },
            plugins: {
              legend: { position: "top" },
              title: { display: true, text: "Clasificación Post Seguimiento por semana (agrupado)", font: { size: 11 } }
            }
          },
          plugins: activePlugins
        }));
      }
    }

    return () => { chartInstances.current.forEach(i => { try { i.destroy(); } catch {} }); };
  }, [availableWeeks, filteredCases, casesPostSeg, responsablesUnicos, selectedSemana, selectedResponsable, selectedEspecie, vistaMode, selectedExposicion]);

  // ── Helper lookup flexible de columnas Excel
  const getRowVal = (row: any, ...keys: string[]): any => {
    if (!row) return undefined;
    const normKeys = keys.map(k => k.toLowerCase().replace(/[\s_\-áéíóúñ]/g, "").replace(/a/g,"a").replace(/e/g,"e").replace(/i/g,"i").replace(/o/g,"o").replace(/u/g,"u"));
    for (const rk of Object.keys(row)) {
      const normRowKey = rk.toLowerCase().replace(/[\s_\-áéíóúñ]/g, "");
      if (normKeys.includes(normRowKey)) return row[rk];
    }
    return undefined;
  };

  // ── Procesamiento de filas de un workbook dado nombre de hoja
  const procesarWorkbook = (wb: any, sheetName: string, isAppend: boolean) => {
    const XLSX = (window as any).XLSX;
    const parsedRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
    if (parsedRows.length === 0) { showToast("⚠️ La hoja seleccionada no contiene filas válidas.", "warning"); return; }
    procesarRows(parsedRows, isAppend);
  };

  // ── Carga de archivo Excel/CSV
  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>, isAppend: boolean) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        if (!result) return;
        let parsedRows: any[] = [];

        if (ext === "xlsx") {
          const XLSX = (window as any).XLSX;
          if (!XLSX) { showToast("SheetJS CDN aún cargando. Intenta en 3 segundos.", "warning"); return; }
          const wb = XLSX.read(result, { type: "binary", cellDates: true });

          // ── Advertencia: múltiples hojas
          if (wb.SheetNames.length > 1) {
            setSheetWarning({
              sheets: wb.SheetNames,
              onConfirm: (selectedSheet: string) => {
                setSheetWarning(null);
                procesarWorkbook(wb, selectedSheet, isAppend);
              }
            });
            return;
          }

          const sheetName = wb.SheetNames[0];
          parsedRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
        } else {
          const text = result as string;
          const lines = text.split(/\r?\n/);
          if (lines.length > 1) {
            const sep = lines[0].includes(";") ? ";" : ",";
            const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ""));
            for (let i = 1; i < lines.length; i++) {
              if (!lines[i].trim()) continue;
              const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
              const obj: any = {};
              headers.forEach((h, idx) => { obj[h] = cols[idx]; });
              parsedRows.push(obj);
            }
          }
        }

        if (parsedRows.length === 0) { showToast("⚠️ El archivo no contiene filas válidas.", "warning"); return; }
        procesarRows(parsedRows, isAppend);
      } catch (err) {
        console.error(err);
        showToast("❌ No se pudo procesar el archivo. Revisa el formato.", "error");
      }
    };

    ext === "xlsx" ? reader.readAsBinaryString(file) : reader.readAsText(file);
    event.target.value = "";
  };

  // ── Procesamiento central de rows ya parseados
  const procesarRows = (parsedRows: any[], isAppend: boolean) => {
    const normalized: CaseRecord[] = parsedRows.map(row => {
          const espRaw  = getRowVal(row, "esp_ani", "espani", "especie");
          const clasRaw = getRowVal(row, "clasificacion_exposicion", "clasificacionexposicion", "clasificacion");
          const estRaw  = getRowVal(row, "estado_ani", "estadoani", "estado");
          const repRaw  = getRowVal(row, "rep_se_ant", "repseant");
          const clpRaw  = getRowVal(row, "clas_post_seg", "claspostseg", "clas_post");
          const spRaw   = getRowVal(row, "seg_prioritario", "segprioritario", "prioritario");
          
          let estNum = parseInt(estRaw);
          if (isNaN(estNum)) { const s = estRaw?.toString().toLowerCase() || ""; estNum = s.includes("muerto") ? 2 : s.includes("desap") ? 3 : 1; }

          const fec_not_raw = getRowVal(row, "fec_not", "fecnot", "fecha_notificacion");
          const fec_con_raw = getRowVal(row, "fec_con_", "feccon", "fecha_consulta");
          const ini_sin_raw = getRowVal(row, "ini_sin_", "inisin", "inicio_sintomas");
          const fec_exp_raw = getRowVal(row, "fec_exp_", "fecexp", "fecha_exposicion");
          const fecha_nto_raw = getRowVal(row, "fecha_nto_", "fechanto", "fecha_nacimiento");
          const fecha_vac_raw = getRowVal(row, "fecha_vac", "fechavac");
          const fecha_asig_raw = getRowVal(row, "fecha_asignacion", "fecha_asignación", "fechaasignacion");
          const fech_cierre_raw = getRowVal(row, "fech_ent_cas_cerrado", "fechaentcascerrado");

          const fmtDate = (v: any) => { if (!v) return undefined; if (v instanceof Date) return v.toISOString().split("T")[0]; return v.toString().split("T")[0]; };

          return {
            cod_pre:  parseInt(getRowVal(row, "cod_pre", "codpre", "codigo")) || Math.floor(Math.random() * 90000 + 10000),
            semana:   parseInt(getRowVal(row, "semana", "sem")) || 1,
            año:      parseInt(getRowVal(row, "año", "ano", "year")) || 2026,
            esp_ani:  parseEspAni(espRaw),
            clasificacion_exposicion: parseClasExp(clasRaw),
            responsable:   normalizarResponsable(getRowVal(row, "responsable", "resp")),
            rep_se_ant:    repRaw ? repRaw.toString().trim() : "no",
            localidad_:    (getRowVal(row, "localidad_", "localidad") || "").toString().trim(),
            bar_ver_:      (getRowVal(row, "bar_ver_", "barver", "barrio") || "").toString().trim(),
            sexo_:         (getRowVal(row, "sexo_", "sexo") || "").toString().trim(),
            clas_post_seg: clpRaw ? clpRaw.toString().trim() : undefined,
            seg_prioritario: spRaw ? spRaw.toString().trim() : "No",
            estado_ani:    estNum,
            fec_not:       fmtDate(fec_not_raw),
            dir_res_:      (getRowVal(row, "dir_res_", "dirres", "direccion") || "").toString().trim(),
            nom_upgd:      (getRowVal(row, "nom_upgd", "nomupgd") || "").toString().trim(),
            pri_nom_:      (getRowVal(row, "pri_nom_", "prinom") || "").toString().trim(),
            seg_nom_:      (getRowVal(row, "seg_nom_", "segnom") || "").toString().trim(),
            pri_ape_:      (getRowVal(row, "pri_ape_", "priape") || "").toString().trim(),
            seg_ape_:      (getRowVal(row, "seg_ape_", "segape") || "").toString().trim(),
            tip_ide_:      (getRowVal(row, "tip_ide_", "tipide") || "").toString().trim(),
            num_ide_:      getRowVal(row, "num_ide_", "numide"),
            edad_:         parseInt(getRowVal(row, "edad_", "edad")) || undefined,
            uni_med_:      parseInt(getRowVal(row, "uni_med_", "unimed")) || undefined,
            cen_pobla_:    (getRowVal(row, "cen_pobla_", "cenpobla") || "").toString().trim(),
            vereda_:       (getRowVal(row, "vereda_", "vereda") || "").toString().trim(),
            fecha_nto_:    fmtDate(fecha_nto_raw),
            tip_agr:       parseInt(getRowVal(row, "tip_agr", "tipagr")) || undefined,
            agr_pro:       parseInt(getRowVal(row, "agr_pro", "agrpro")) || undefined,
            tip_les:       parseInt(getRowVal(row, "tip_les", "tiples")) || undefined,
            profun:        parseInt(getRowVal(row, "profun")) || undefined,
            fec_con_:      fmtDate(fec_con_raw),
            ini_sin_:      fmtDate(ini_sin_raw),
            telefono_:     getRowVal(row, "telefono_", "telefono"),
            fec_exp_:      fmtDate(fec_exp_raw),
            ant_vac:       parseInt(getRowVal(row, "ant_vac", "antvac")) || undefined,
            car_vac:       parseInt(getRowVal(row, "car_vac", "carvac")) || undefined,
            fecha_vac:     fmtDate(fecha_vac_raw),
            nom_pro:       (getRowVal(row, "nom_pro", "nompro") || "").toString().trim(),
            dir_pro:       (getRowVal(row, "dir_pro", "dirpro") || "").toString().trim(),
            tel_pro:       getRowVal(row, "tel_pro", "telpro"),
            est_ma:        parseInt(getRowVal(row, "est_ma", "estma")) || undefined,
            ubicacion:     parseInt(getRowVal(row, "ubicacion")) || undefined,
            estado_ficha:  (getRowVal(row, "estado ficha", "estadoficha") || "").toString().trim(),
            seg_telef:     (getRowVal(row, "seg_telef", "segtelef", "SEG_TELEF") || "").toString().trim(),
            seg_visita:    (getRowVal(row, "seg_visita", "segvisita", "SEG_VISITA") || "").toString().trim(),
            raza_peligrosa:(getRowVal(row, "raza_peligrosa", "RAZA_PELIGROSA") || "").toString().trim(),
            numero_errado: (getRowVal(row, "numero_errado", "NUMERO_ERRADO") || "").toString().trim(),
            direccion_errada:(getRowVal(row,"direccion_errada","DIRECCION_ERRADA")||"").toString().trim(),
            comuna:        (getRowVal(row, "COMUNA", "comuna") || "").toString().trim(),
            fecha_asignacion: fmtDate(fecha_asig_raw),
            fech_ent_cas_cerrado: fmtDate(fech_cierre_raw),
          };
        });

        if (isAppend) {
          setCases(prev => [...prev, ...normalized]);
        } else {
          setCases(normalized);
          setSelectedSemana("Todas");
          setSelectedResponsable("Todos");
          setSelectedEspecie("Todas");
          setSelectedExposicion("Todas");
          setOnlyPrioritarios(false);
          setSearchQuery("");
          setDetailPage(0);
        }
        showToast(`✅ ${normalized.length} registros cargados correctamente.`, "success");
  };

  // ── Descarga CSV
  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadDetailedCSV = () => {
    const header = "cod_pre,semana,año,responsable,especie,clasificacion_sivigila,clasificacion_post,localidad,barrio,dir_res,sexo,seg_prioritario,estado_animal,fec_not,rep_se_ant,seg_telef,seg_visita,raza_peligrosa,numero_errado,direccion_errada,comuna\n";
    const rows = filteredCases.map(r =>
      `"${r.cod_pre}","${r.semana}","${r.año}","${r.responsable}","${ESP_ANI[r.esp_ani] || r.esp_ani}","${CLASIF_EXP[r.clasificacion_exposicion]}","${r.clas_post_seg || ""}","${r.localidad_ || ""}","${r.bar_ver_ || ""}","${r.dir_res_ || ""}","${r.sexo_ || ""}","${r.seg_prioritario || ""}","${ESTADO_ANI[r.estado_ani || 1] || ""}","${r.fec_not || ""}","${r.rep_se_ant || ""}","${r.seg_telef || ""}","${r.seg_visita || ""}","${r.raza_peligrosa || ""}","${r.numero_errado || ""}","${r.direccion_errada || ""}","${r.comuna || ""}"`
    ).join("\n");
    downloadCSV(header + rows, "Zoonosis_Detalle_Casos.csv");
  };

  // ── Paginación
  const totalPaginatedPages = Math.ceil(filteredCases.length / detailPageSize);
  const startIdx = detailPage * detailPageSize;
  const endIdx   = Math.min(startIdx + detailPageSize, filteredCases.length);
  const pageRecords = filteredCases.slice(startIdx, endIdx);

  // ── Resumen comparativo (tabla)
  const resumenComparativo = useMemo(() => {
    const postFiltered = casesPostSeg.filter(r => {
      if (selectedSemana !== "Todas" && r.semana.toString() !== selectedSemana) return false;
      if (selectedResponsable !== "Todos" && r.responsable !== selectedResponsable) return false;
      if (selectedEspecie !== "Todas" && r.esp_ani.toString() !== selectedEspecie) return false;
      return true;
    });
    return {
      sivigila: {
        noExp: postFiltered.filter(r => r.clasificacion_exposicion === 0).length,
        leve:  postFiltered.filter(r => r.clasificacion_exposicion === 1).length,
        grave: postFiltered.filter(r => r.clasificacion_exposicion === 2).length,
        total: postFiltered.length,
      },
      post: {
        noExp: postFiltered.filter(r => normalizarClasPost(r.clas_post_seg) === "no exposicion").length,
        leve:  postFiltered.filter(r => normalizarClasPost(r.clas_post_seg) === "exposicion leve").length,
        grave: postFiltered.filter(r => normalizarClasPost(r.clas_post_seg) === "exposicion grave").length,
        sinEst:postFiltered.filter(r => normalizarClasPost(r.clas_post_seg) === "sin establecer").length,
        total: postFiltered.length,
      }
    };
  }, [casesPostSeg, selectedSemana, selectedResponsable, selectedEspecie]);

  // ── Badge helper para clas_post_seg
  const getPostBadge = (v: string | undefined) => {
    const norm = normalizarClasPost(v);
    const meta = CLAS_POST_LABELS[norm] || CLAS_POST_LABELS["sin establecer"];
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ color: meta.color, backgroundColor: meta.bg }}>{meta.label}</span>;
  };

  const getExpBadge = (n: number) => {
    const colors: Record<number, { bg: string; color: string; label: string }> = {
      0: { bg: "#f3f4f6", color: "#374151", label: "No exp." },
      1: { bg: "#fef3c7", color: "#92400e", label: "Leve" },
      2: { bg: "#fee2e2", color: "#991b1b", label: "Grave" },
    };
    const c = colors[n] || colors[0];
    return <span className="px-2 py-0.5 rounded border text-[10px] font-bold" style={{ backgroundColor: c.bg, color: c.color }}>{c.label}</span>;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F4F8FB] text-[#141414] font-sans antialiased">

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] max-w-sm rounded p-4 shadow-md flex items-center gap-3 border animate-fade-in
          ${toast.type === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-800" : ""}
          ${toast.type === "error"   ? "bg-rose-50 border-rose-100 text-rose-800" : ""}
          ${toast.type === "warning" ? "bg-amber-50 border-amber-100 text-amber-800" : ""}
        `}>
          {toast.type === "success" && <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />}
          {toast.type === "error"   && <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
          {toast.type === "warning" && <HelpCircle className="w-5 h-5 text-amber-500 shrink-0" />}
          <p className="text-xs font-semibold">{toast.message}</p>
        </div>
      )}

      {/* HEADER */}
      <header className="h-14 bg-[#0A4057] flex items-center justify-between px-6 shrink-0 shadow-sm relative z-10">
        <div className="flex items-center gap-3">
          <div className="bg-white p-1.5 rounded-lg"><span className="text-xl">🐾</span></div>
          <h1 className="text-white font-bold text-base md:text-lg tracking-tight" style={{ fontFamily: "Impact, 'Arial Black', sans-serif" }}>
            SEGUIMIENTO ZOONOSIS <span className="font-normal opacity-70 ml-2 hidden sm:inline text-xs">Secretaría de Salud de Medellín</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-[#1DABE3] text-white px-3 py-1 rounded-full text-xs font-bold">
            {availableWeeks.length > 0 ? <>Sem. {availableWeeks[0]}{availableWeeks.length > 1 ? ` – ${availableWeeks[availableWeeks.length - 1]}` : ""}</> : "Sin datos"}
          </div>
          <div className="text-white/50 text-xs hidden lg:block">
            {kpis.total} reg. · {excludedCount} excl.
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 space-y-6 w-full">

        {/* CONTROLES */}
        <div className="bg-white border border-gray-200 rounded shadow-sm p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-xs font-bold uppercase text-gray-500 tracking-wider flex items-center gap-2">
                <Cloud className="w-4 h-4 text-[#0A4057]" /> CONTROLES Y ADQUISICIÓN DE DATOS · SIVIGILA
              </h2>
              <p className="text-[11px] text-gray-400">Selecciona el método de carga (Local o Google Drive) para sincronizar tu reporte de Zoonosis.</p>
            </div>
            
            {/* Selector de Pestañas */}
            <div className="flex bg-gray-100 p-1 rounded-lg self-start md:self-auto">
              <button
                onClick={() => setActiveLoadTab("local")}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${activeLoadTab === "local" ? "bg-[#0A4057] text-white shadow" : "text-gray-500 hover:text-gray-800"}`}
              >
                💻 Carga Local
              </button>
              <button
                onClick={() => setActiveLoadTab("gdrive")}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-all flex items-center gap-1.5 ${activeLoadTab === "gdrive" ? "bg-[#0A4057] text-white shadow" : "text-gray-500 hover:text-gray-800"}`}
              >
                ☁️ Google Drive
                {gdriveToken && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
              </button>
            </div>
          </div>

          {/* TAB CONTENT: LOCAL */}
          {activeLoadTab === "local" && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-50/50 p-3 rounded border border-gray-100 transition-all duration-300">
              <div className="text-[11px] text-gray-500 max-w-md leading-relaxed">
                Carga un archivo Excel (.xlsx) o reporte CSV de SIVIGILA directamente desde tu computadora. Los datos se procesarán de inmediato en tu navegador.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Cargar archivo → reemplaza todo */}
                <label className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded cursor-pointer flex items-center gap-1.5"
                  title="Reemplaza todos los datos con el archivo seleccionado">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-gray-500" />
                  <span>Cargar Archivo</span>
                  <input type="file" accept=".xlsx,.csv" onChange={e => handleFileUpload(e, false)} className="hidden" />
                </label>
                {/* Agregar semana → suma registros al acumulado */}
                <label className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-3 py-1.5 rounded cursor-pointer flex items-center gap-1.5"
                  title="Agrega los registros del archivo a los ya cargados (acumula semanas)">
                  <Plus className="w-3.5 h-3.5" /><span>Agregar Semana</span>
                  <input type="file" accept=".xlsx,.csv" onChange={e => handleFileUpload(e, true)} className="hidden" />
                </label>
                {/* Limpiar → modal */}
                <button onClick={() => cases.length > 0 && setModalLimpiar(true)}
                  disabled={cases.length === 0}
                  className="border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /><span>Limpiar Datos</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB CONTENT: GDRIVE */}
          {activeLoadTab === "gdrive" && (
            <div className="bg-gray-50/50 p-4 rounded border border-gray-100 transition-all duration-300 space-y-4">
              {!gdriveToken ? (
                <div className="space-y-4 max-w-2xl bg-white p-4 sm:p-5 rounded-lg border border-gray-200">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-gray-800">Conectar Carpeta de Google Drive</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Sincroniza y lee directamente las planillas de Zoonosis guardadas en tu cuenta de Google Drive (.xlsx o .csv) sin necesidad de descargarlas de manera local.
                    </p>
                  </div>

                  {/* Connect Trigger */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                    <button
                      onClick={handleConnectDrive}
                      className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-lg shadow-sm font-bold text-xs active:bg-gray-100 transition-all cursor-pointer"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      </svg>
                      Conectar con Google Drive
                    </button>
                    
                    <span className="text-[11px] text-gray-400">
                      ← Presionando aquí ingresarás de manera segura en un popup de Google.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Auth Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1dadb4] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1dadb3]"></span>
                      </span>
                      <span className="text-[11px] font-bold text-gray-700">Google Drive Conectado Correctamente</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fetchFiles(gdriveToken, selectedFolderId, driveSearchQuery)}
                        className="text-[10px] text-gray-500 hover:text-gray-800 bg-gray-50 flex items-center gap-1 border px-2 py-1 rounded"
                        title="Refrescar lista"
                      >
                        <RefreshCw className="w-3 h-3 animate-pulse" /> Sincronizar Drive
                      </button>
                      <button
                        onClick={handleDisconnectDrive}
                        className="text-[10px] text-[#A04040] hover:text-red-700 bg-amber-50/50 hover:bg-red-50 flex items-center gap-1 px-2.5 py-1 rounded font-semibold border border-amber-100 transition-colors"
                      >
                        <LogOut className="w-3 h-3" /> Cerrar Sesión
                      </button>
                    </div>
                  </div>

                  {/* Carpeta Exclusiva Activa Banner */}
                  {pinnedFolderId !== "all" && (
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 rounded-lg text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-3xs">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📌</span>
                        <div>
                          <span className="font-bold block text-emerald-900">Filtro de Carpeta Única Activo</span>
                          <span className="text-[11px] text-emerald-700">Solo estás viendo las planillas dentro de la carpeta: <strong className="underline">{pinnedFolderName || "Configurada"}</strong>.</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          localStorage.removeItem("gdrive_pinned_folder_id");
                          localStorage.removeItem("gdrive_pinned_folder_name");
                          setPinnedFolderId("all");
                          setPinnedFolderName("");
                          setSelectedFolderId("all");
                          showToast("🔓 Se ha quitado el filtro exclusivo. Ahora puedes ver todas las carpetas.", "warning");
                        }}
                        className="bg-white hover:bg-emerald-100 text-emerald-950 px-3 py-1.5 text-[10px] font-bold rounded border border-emerald-200 transition-colors cursor-pointer shrink-0"
                      >
                        🔓 Mostrar todas las carpetas
                      </button>
                    </div>
                  )}

                  {/* Filters / Search Bar y Pinning */}
                  <div className="bg-white p-3 rounded border border-gray-100 shadow-3xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-50 pb-2">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                        📂 Carpeta de acceso rápido SIVIGILA
                      </span>
                      <button
                        onClick={() => {
                          const manualId = prompt("Pega el ID de tu carpeta de Google Drive (es el texto con letras y números al final del enlace de internet al abrir la carpeta en Drive, Ej: 1A2b3C...):");
                          if (manualId !== null && manualId.trim() !== "") {
                            const trimmed = manualId.trim();
                            localStorage.setItem("gdrive_pinned_folder_id", trimmed);
                            localStorage.setItem("gdrive_pinned_folder_name", "Carpeta cargada por ID manual");
                            setPinnedFolderId(trimmed);
                            setPinnedFolderName("Carpeta cargada por ID manual");
                            setSelectedFolderId(trimmed);
                            showToast("🎯 Sincronizando carpeta configurada por ID manualmente.", "success");
                          }
                        }}
                        className="text-[10px] text-blue-600 hover:underline font-bold text-left"
                      >
                        ➕ Pegar ID de carpeta directamente (Escribir ID)
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Selector de Carpeta */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Seleccionar Carpeta</label>
                        <div className="flex gap-1.5">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded px-2">
                            <FolderOpen className="w-3.5 h-3.5 text-[#0A4057] shrink-0" />
                            <select
                              value={selectedFolderId}
                              onChange={e => setSelectedFolderId(e.target.value)}
                              className="bg-transparent py-1.5 text-xs font-semibold w-full focus:outline-none"
                            >
                              <option value="all">📂 Todas las carpetas (Filtrar)</option>
                              {driveFolders.map(f => (
                                <option key={f.id} value={f.id}>
                                  📁 {f.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Botón para fijar seleccionada */}
                          {selectedFolderId !== "all" && selectedFolderId !== pinnedFolderId && (
                            <button
                              onClick={() => {
                                const fObj = driveFolders.find(f => f.id === selectedFolderId);
                                const name = fObj ? fObj.name : "Carpeta seleccionada";
                                localStorage.setItem("gdrive_pinned_folder_id", selectedFolderId);
                                localStorage.setItem("gdrive_pinned_folder_name", name);
                                setPinnedFolderId(selectedFolderId);
                                setPinnedFolderName(name);
                                showToast(`📌 Carpeta "${name}" configurada como exclusiva.`, "success");
                              }}
                              className="bg-[#0A4057] hover:bg-[#0A4057]/90 text-white font-bold text-[10.5px] px-3 py-1.5 rounded transition-all shrink-0 flex items-center gap-1 cursor-pointer"
                              title="Al fijar esta carpeta, solo se verán sus archivos por defecto"
                            >
                              📌 Solo esta carpeta
                            </button>
                          )}
                        </div>
                      </div>

                      {/* File search text */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Buscar Reporte por Nombre</label>
                        <div className="flex items-stretch gap-1.5">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded px-2">
                            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <input
                              type="text"
                              value={driveSearchQuery}
                              onChange={e => setDriveSearchQuery(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') fetchFiles(gdriveToken, selectedFolderId, driveSearchQuery); }}
                              placeholder="Buscar archivo por palabra clave..."
                              className="bg-transparent py-1.5 text-xs font-semibold w-full focus:outline-none"
                            />
                          </div>
                          <button
                            onClick={() => fetchFiles(gdriveToken, selectedFolderId, driveSearchQuery)}
                            className="bg-gray-800 hover:bg-gray-900 text-white px-3.5 py-1.5 text-xs font-bold rounded shrink-0"
                          >
                            Buscar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Error de Listado con soluciones explícitas */}
                  {driveFetchError && (
                    <div className="bg-red-50 border border-red-100 text-red-800 p-3.5 rounded-lg text-xs space-y-2 leading-relaxed">
                      <div className="flex items-center gap-2 font-bold text-red-900">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>No se pudieron listar los archivos de Google Drive</span>
                      </div>
                      <div className="text-[11px] text-gray-700 bg-white/85 p-2 rounded border border-red-50 font-mono overflow-auto max-h-24 select-all">
                        <strong>Error devuelto por Google:</strong> {driveFetchError}
                      </div>
                      
                      <div className="space-y-1 text-[11px] pt-1">
                        <p className="font-bold text-red-950">💡 Cómo solucionar este error de inmediato:</p>
                        <ul className="list-disc list-inside space-y-1 text-gray-600 text-[10.5px]">
                          <li>
                            <strong>¿Activaste la API de Google Drive?</strong> Los proyectos nuevos de Google Cloud no vienen con Google Drive habilitado de serie. Abre este enlace: <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-semibold underline">Habilitar Google Drive API</a> y clica en el botón azul de <strong>Habilitar (Enable)</strong>. Luego regresa aquí y presiona "Sincronizar Drive".
                          </li>
                          <li>
                            <strong>¿Tildaste la casilla de permisos de lectura al loguearte?</strong> Al conectar, Google muestra una pequeña casilla de verificación blanca para conceder acceso a los archivos. Si no se marca, Google bloquea la solicitud de listado. Por favor <button onClick={handleDisconnectDrive} className="text-red-700 font-bold hover:underline underline cursor-pointer">Cierra la sesión aquí</button> y vuelve a conectar tu cuenta, teniendo especial cuidado en <strong>marcar la casilla de consentimiento</strong> de Google Drive.
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* File List */}
                  <div className="bg-white border border-gray-100 rounded overflow-hidden shadow-xs max-h-60 overflow-y-auto">
                    {isLoadingFiles ? (
                      <div className="p-12 text-center text-xs text-gray-550 flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 text-[#0A4057] animate-spin" />
                        <span>Recuperando listado de reportes epidemiológicos...</span>
                      </div>
                    ) : driveFiles.length === 0 ? (
                      <div className="p-8 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-1">
                        <Folder className="w-8 h-8 text-gray-300" />
                        <span className="font-semibold text-gray-550">No se encontraron archivos de planilla SIVIGILA</span>
                        <p className="text-[10px] text-gray-400">Prueba filtrando por otra carpeta o asegúrate de que el formato sea Excel o CSV.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {driveFiles.map(file => {
                          const isExcel = file.mimeType.includes("spreadsheetml") || file.name.endsWith(".xlsx");
                          return (
                            <div key={file.id} className="p-3 flex items-center justify-between gap-3 hover:bg-gray-50/70 transition-colors">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`p-1.5 rounded ${isExcel ? "bg-emerald-50 text-emerald-600" : "bg-sky-50 text-sky-600"}`}>
                                  <FileSpreadsheet className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-gray-700 truncate" title={file.name}>{file.name}</p>
                                  <p className="text-[10px] text-gray-400">
                                    Modificado: {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : 'N/A'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {isDownloadingFile === file.id ? (
                                  <span className="text-[10px] font-semibold text-blue-600 animate-pulse bg-blue-50 border border-blue-100 px-2 py-1 rounded flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3 animate-spin text-blue-500" /> Cargando...
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleLoadDriveFile(file.id, file.name, false)}
                                      className="bg-gray-50 hover:bg-[#0A4057]/10 hover:text-[#0A4057] border border-gray-200 text-gray-700 font-bold text-[10px] px-2.5 py-1 rounded-sm transition-colors flex items-center gap-1"
                                      title="Reemplaza todos los datos actuales con este archivo"
                                    >
                                      🔄 Reemplazar todo
                                    </button>
                                    <button
                                      onClick={() => handleLoadDriveFile(file.id, file.name, true)}
                                      className="bg-gray-800 hover:bg-gray-900 text-white font-bold text-[10px] px-2.5 py-1 rounded-sm transition-colors flex items-center gap-1"
                                      title="Une las semanas contenidas en este archivo al acumulado activo"
                                    >
                                      ➕ Acumular
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Vista toggle SIVIGILA / POST SEGUIMIENTO */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase font-bold text-gray-500">Vista</label>
              <div className="flex bg-gray-100 p-0.5 rounded">
                {([["sivigila","📋 SIVIGILA"],["postseg","🔍 Post Seguimiento"]] as [string,string][]).map(([id,label]) => (
                  <button key={id} onClick={() => setVistaMode(id as any)}
                    className={`px-3 py-1 text-xs rounded transition-all ${vistaMode === id ? "bg-white text-gray-900 shadow-sm font-bold" : "text-gray-500 hover:text-gray-800"}`}>
                    {label}
                  </button>
                ))}
              </div>
              {vistaMode === "sivigila"
                ? <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">Incluye {excludedCount} repetidos</span>
                : <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded">{excludedCount} casos excluidos (repetidos)</span>
              }
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase font-bold text-gray-500">Semana</label>
              <select value={selectedSemana} onChange={e => setSelectedSemana(e.target.value)}
                className="bg-white border border-gray-200 rounded px-2.5 py-1 text-xs font-semibold">
                <option value="Todas">Todas</option>
                {availableWeeks.map(w => <option key={w} value={w.toString()}>Sem. {w}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase font-bold text-gray-500">Responsable</label>
              <div className="flex bg-gray-100 p-0.5 rounded">
                {["Todos", ...responsablesUnicos].map(r => (
                  <button key={r} onClick={() => setSelectedResponsable(r)}
                    className={`px-3 py-1 text-xs rounded transition-all ${selectedResponsable === r ? "bg-white text-gray-900 shadow-sm font-bold" : "text-gray-500 hover:text-gray-800"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase font-bold text-gray-500">Especie</label>
              <select value={selectedEspecie} onChange={e => setSelectedEspecie(e.target.value)}
                className="bg-white border border-gray-200 rounded px-2.5 py-1 text-xs font-semibold">
                <option value="Todas">Todas las especies</option>
                {Object.entries(ESP_ANI).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase font-bold text-gray-500">Exposición SIVIGILA</label>
              <select value={selectedExposicion} onChange={e => setSelectedExposicion(e.target.value)}
                className="bg-white border border-gray-200 rounded px-2.5 py-1 text-xs font-semibold">
                <option value="Todas">Todas</option>
                <option value="0">No exposición</option>
                <option value="1">Exposición leve</option>
                <option value="2">Exposición grave</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={onlyPrioritarios} onChange={e => setOnlyPrioritarios(e.target.checked)}
                  className="rounded text-[#1DABE3] focus:ring-[#1DABE3] border-gray-300 w-3.5 h-3.5 cursor-pointer" />
                <span className="text-[10px] uppercase font-bold text-gray-500">⭐ Solo Prioritarios</span>
              </label>
            </div>

            <div className="ml-auto inline-flex items-center gap-2 text-xs font-mono flex-wrap">
              {(selectedSemana !== "Todas" || selectedResponsable !== "Todos" || selectedEspecie !== "Todas" || selectedExposicion !== "Todas" || onlyPrioritarios || searchQuery) && (
                <button
                  onClick={() => { setSelectedSemana("Todas"); setSelectedResponsable("Todos"); setSelectedEspecie("Todas"); setSelectedExposicion("Todas"); setOnlyPrioritarios(false); setSearchQuery(""); }}
                  className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-amber-200 transition-all"
                >
                  ⚠️ Filtros activos · Limpiar todo
                </button>
              )}
              <span className="text-gray-400">Mostrando:</span>
              <span className={`px-2 py-0.5 rounded font-bold ${filteredCases.length < activeCases.length ? "bg-amber-500 text-white" : "bg-[#1DABE3] text-white"}`}>
                {filteredCases.length}
              </span>
              {filteredCases.length < activeCases.length && (
                <span className="text-gray-400">de {activeCases.length}</span>
              )}
            </div>
          </div>

          {/* Barra de búsqueda */}
          <div className="relative max-w-sm">
            <input type="text" placeholder="Buscar por código, localidad, barrio, responsable, dirección…"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-gray-50 border border-gray-200 pl-8 pr-4 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-[#1DABE3]" />
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border-l-4 border-[#0A4057] p-4 shadow-sm rounded-r flex flex-col justify-between min-h-[100px]">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Casos</span>
            <span className="text-4xl font-black text-[#0A4057] tracking-tighter mt-1">{kpis.active}</span>
            <span className="text-[10px] text-gray-400">{vistaMode === "sivigila" ? "Incluye repetidos" : `Excluye ${excludedCount} rep.`}</span>
          </div>
          <div className="bg-white border-l-4 border-[#1DABE3] p-4 shadow-sm rounded-r flex flex-col justify-between min-h-[100px]">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Prada</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-[#1DABE3] tracking-tighter">{kpis.pradaCount}</span>
              <span className="text-xs font-semibold text-gray-400">({kpis.pradaPct}%)</span>
            </div>
            <span className="text-[10px] text-gray-400">Carga asignada</span>
          </div>
          <div className="bg-white border-l-4 border-[#F16729] p-4 shadow-sm rounded-r flex flex-col justify-between min-h-[100px]">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Juan</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-[#F16729] tracking-tighter">{kpis.juanCount}</span>
              <span className="text-xs font-semibold text-gray-400">({kpis.juanPct}%)</span>
            </div>
            <span className="text-[10px] text-gray-400">Carga asignada</span>
          </div>
          <div className="bg-white border-l-4 border-[#C0392B] p-4 shadow-sm rounded-r flex flex-col justify-between min-h-[100px]">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Exp. Grave (SIVIGILA)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-[#C0392B] tracking-tighter">{kpis.graveCount}</span>
              <span className="text-xs font-semibold text-red-600">({kpis.gravePct}%)</span>
            </div>
            <span className="text-[10px] text-red-500 font-medium">Prioridad inmediata</span>
          </div>
        </div>

        {/* GRÁFICAS PRINCIPALES (2x2) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 shadow-sm rounded border border-gray-150 flex flex-col">
            <h3 className="text-xs font-bold uppercase text-gray-500 mb-4 tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#1DABE3]" />Evolución semanal por responsable
            </h3>
            <div className="h-64 relative w-full"><canvas ref={chartRef1}></canvas></div>
          </div>
          <div className="bg-white p-4 shadow-sm rounded border border-gray-150 flex flex-col">
            <h3 className="text-xs font-bold uppercase text-gray-500 mb-4 tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-[#1DABE3]" />Casos por especie animal (SIVIGILA completo)
            </h3>
            <div className="h-64 relative w-full flex justify-center">
              <div className="w-80"><canvas ref={chartRef2}></canvas></div>
            </div>
          </div>
          <div className="bg-white p-4 shadow-sm rounded border border-gray-150 flex flex-col">
            <h3 className="text-xs font-bold uppercase text-gray-500 mb-4 tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#1DABE3]" />Clasificación SIVIGILA por semana
            </h3>
            <div className="h-64 relative w-full"><canvas ref={chartRef3}></canvas></div>
          </div>
          <div className="bg-white p-4 shadow-sm rounded border border-gray-150 flex flex-col">
            <h3 className="text-xs font-bold uppercase text-gray-500 mb-4 tracking-wider flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#1DABE3]" />Distribución por responsable y clasificación
            </h3>
            <div className="h-64 relative w-full"><canvas ref={chartRef4}></canvas></div>
          </div>
        </div>

        {/* SECCIÓN COMPARATIVA SIVIGILA vs POST SEGUIMIENTO */}
        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-[#0A4057] to-[#1DABE3] px-6 py-3 flex items-center gap-3">
            <ArrowLeftRight className="w-5 h-5 text-white/80" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Comparativo de Clasificación: SIVIGILA vs. Post Seguimiento</h3>
              <p className="text-[11px] text-white/70">Análisis de cambios en clasificación de exposición tras el seguimiento del médico veterinario · Excluye repetidos</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
            {/* Gráfica de barras comparativa */}
            <div className="flex flex-col">
              <h4 className="text-xs font-bold uppercase text-gray-500 mb-3 tracking-wider">Distribución comparada (barras)</h4>
              <div className="h-64 relative w-full"><canvas ref={chartRef5}></canvas></div>
            </div>
            {/* Dona post seguimiento */}
            <div className="flex flex-col">
              <h4 className="text-xs font-bold uppercase text-gray-500 mb-3 tracking-wider">Distribución post seguimiento (dona)</h4>
              <div className="h-64 relative w-full flex justify-center">
                <div className="w-72"><canvas ref={chartRef6}></canvas></div>
              </div>
            </div>
          </div>

          {/* Tabla resumen comparativo */}
          <div className="px-6 pb-6">
            <h4 className="text-xs font-bold uppercase text-gray-500 mb-3 tracking-wider">Tabla resumen comparativo</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-bold text-[10px] uppercase">
                    <th className="p-3 text-left">Clasificación</th>
                    <th className="p-3 text-right border-l border-gray-200">
                      <span className="text-[#1DABE3]">📋 SIVIGILA</span><br/><span className="font-normal text-gray-400">Inicial</span>
                    </th>
                    <th className="p-3 text-right border-l border-gray-200">
                      <span className="text-[#F16729]">🔍 Post Seg.</span><br/><span className="font-normal text-gray-400">Veterinario</span>
                    </th>
                    <th className="p-3 text-right border-l border-gray-200">
                      <span className="text-gray-600">Δ Diferencia</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { label: "No exposición", siv: resumenComparativo.sivigila.noExp,  post: resumenComparativo.post.noExp,  color: "#16a34a" },
                    { label: "Exp. leve",     siv: resumenComparativo.sivigila.leve,   post: resumenComparativo.post.leve,   color: "#d97706" },
                    { label: "Exp. grave",    siv: resumenComparativo.sivigila.grave,  post: resumenComparativo.post.grave,  color: "#dc2626" },
                    { label: "Sin establecer",siv: 0,                                   post: resumenComparativo.post.sinEst, color: "#6b7280" },
                  ].map(row => {
                    const diff = row.post - row.siv;
                    return (
                      <tr key={row.label} className="hover:bg-gray-50">
                        <td className="p-3 font-semibold" style={{ color: row.color }}>{row.label}</td>
                        <td className="p-3 text-right font-bold text-gray-700 border-l border-gray-100">{row.siv > 0 ? row.siv : "—"}</td>
                        <td className="p-3 text-right font-bold text-gray-700 border-l border-gray-100">{row.post > 0 ? row.post : "—"}</td>
                        <td className="p-3 text-right border-l border-gray-100">
                          {row.siv > 0 || row.post > 0 ? (
                            <span className={`font-bold text-xs ${diff > 0 ? "text-red-600" : diff < 0 ? "text-green-600" : "text-gray-400"}`}>
                              {diff > 0 ? `+${diff}` : diff === 0 ? "=" : diff}
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-100 font-bold text-[#0A4057]">
                    <td className="p-3 uppercase text-[10px]">Total</td>
                    <td className="p-3 text-right border-l border-gray-200">{resumenComparativo.sivigila.total}</td>
                    <td className="p-3 text-right border-l border-gray-200">{resumenComparativo.post.total}</td>
                    <td className="p-3 text-right border-l border-gray-200 text-gray-400">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* TABLAS RESUMEN CRUZADO */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase text-gray-500 tracking-wider">Tablas de Resumen Cruzado · {vistaMode === "sivigila" ? "Vista SIVIGILA (con repetidos)" : "Vista Post Seguimiento (sin repetidos)"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Tabla 1: Semana × Casos */}
            <div className="bg-white border border-gray-150 shadow-sm rounded overflow-hidden">
              <div className="bg-[#0A4057] text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold">
                <span>SEMANA × TOTAL</span>
                <button onClick={() => { let csv="Semana,Casos\n"; availableWeeks.forEach(w=>{ csv+=`Semana ${w},${filteredCases.filter(r=>r.semana===w).length}\n`; }); downloadCSV(csv,"sem_casos.csv"); }}
                  className="bg-white/10 hover:bg-white/20 text-[10px] px-2 py-0.5 rounded border border-white/10 flex items-center gap-1">
                  <Download className="w-3 h-3"/>CSV
                </button>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-gray-50 text-gray-500 font-bold text-[10px] uppercase border-b">
                  <th className="p-2.5">Semana</th><th className="p-2.5 text-right">Casos</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {availableWeeks.map((w,i) => (
                    <tr key={w} className={i%2===0?"bg-white":"bg-gray-50/20"}>
                      <td className="p-2.5 font-semibold text-gray-700">Semana {w}</td>
                      <td className="p-2.5 text-right font-bold">{filteredCases.filter(r=>r.semana===w).length}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-bold text-[#0A4057]">
                    <td className="p-2.5 text-[10px] uppercase">Total</td>
                    <td className="p-2.5 text-right">{filteredCases.length}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Tabla 2: Semana × Especie (agrupada) */}
            <div className="bg-white border border-gray-150 shadow-sm rounded overflow-hidden">
              <div className="bg-[#0A4057] text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold">
                <span>SEMANA × ESPECIE</span>
                <button onClick={() => { let csv="Semana,Perro,Gato,Equidos,Murciélago,Otros,Total\n"; availableWeeks.forEach(w=>{ const p=filteredCases.filter(r=>r.semana===w&&r.esp_ani===1).length; const g=filteredCases.filter(r=>r.semana===w&&r.esp_ani===2).length; const e=filteredCases.filter(r=>r.semana===w&&r.esp_ani===4).length; const m=filteredCases.filter(r=>r.semana===w&&r.esp_ani===7).length; const o=filteredCases.filter(r=>r.semana===w&&![1,2,4,7].includes(r.esp_ani)).length; csv+=`Semana ${w},${p},${g},${e},${m},${o},${p+g+e+m+o}\n`; }); downloadCSV(csv,"sem_especie.csv"); }}
                  className="bg-white/10 hover:bg-white/20 text-[10px] px-2 py-0.5 rounded border border-white/10 flex items-center gap-1">
                  <Download className="w-3 h-3"/>CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead><tr className="bg-gray-50 text-gray-500 font-bold text-[10px] uppercase border-b">
                    <th className="p-2.5">Sem.</th><th className="p-2.5 text-right">🐕</th><th className="p-2.5 text-right">🐈</th><th className="p-2.5 text-right">🐴</th><th className="p-2.5 text-right">🦇</th><th className="p-2.5 text-right">Otros</th><th className="p-2.5 text-right bg-gray-100/50 font-bold">Tot</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {availableWeeks.map((w,i) => {
                      const p=filteredCases.filter(r=>r.semana===w&&r.esp_ani===1).length;
                      const g=filteredCases.filter(r=>r.semana===w&&r.esp_ani===2).length;
                      const e=filteredCases.filter(r=>r.semana===w&&r.esp_ani===4).length;
                      const m=filteredCases.filter(r=>r.semana===w&&r.esp_ani===7).length;
                      const o=filteredCases.filter(r=>r.semana===w&&![1,2,4,7].includes(r.esp_ani)).length;
                      return <tr key={w} className={i%2===0?"bg-white":"bg-gray-50/20"}>
                        <td className="p-2.5 font-bold text-gray-700">{w}</td>
                        <td className="p-2.5 text-right">{p}</td><td className="p-2.5 text-right">{g}</td>
                        <td className="p-2.5 text-right">{e}</td><td className="p-2.5 text-right">{m}</td>
                        <td className="p-2.5 text-right">{o}</td>
                        <td className="p-2.5 text-right font-black bg-gray-50/50 text-[#0A4057]">{p+g+e+m+o}</td>
                      </tr>;
                    })}
                    <tr className="bg-gray-100 font-bold text-[#0A4057] text-[10px]">
                      <td className="p-2.5 uppercase">Total</td>
                      {[1,2,4,7].map(k=><td key={k} className="p-2.5 text-right">{filteredCases.filter(r=>r.esp_ani===k).length}</td>)}
                      <td className="p-2.5 text-right">{filteredCases.filter(r=>![1,2,4,7].includes(r.esp_ani)).length}</td>
                      <td className="p-2.5 text-right bg-gray-200">{filteredCases.length}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabla 3: Semana × Exposición SIVIGILA */}
            <div className="bg-white border border-gray-150 shadow-sm rounded overflow-hidden">
              <div className="bg-[#0A4057] text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold">
                <span>SEMANA × EXPOSICIÓN</span>
                <button onClick={() => { let csv="Semana,No exp,Leve,Grave,Total\n"; availableWeeks.forEach(w=>{ const a=filteredCases.filter(r=>r.semana===w&&r.clasificacion_exposicion===0).length; const b=filteredCases.filter(r=>r.semana===w&&r.clasificacion_exposicion===1).length; const c=filteredCases.filter(r=>r.semana===w&&r.clasificacion_exposicion===2).length; csv+=`Semana ${w},${a},${b},${c},${a+b+c}\n`; }); downloadCSV(csv,"sem_exposicion.csv"); }}
                  className="bg-white/10 hover:bg-white/20 text-[10px] px-2 py-0.5 rounded border border-white/10 flex items-center gap-1">
                  <Download className="w-3 h-3"/>CSV
                </button>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-gray-50 text-gray-500 font-bold text-[10px] uppercase border-b">
                  <th className="p-2.5">Sem.</th><th className="p-2.5 text-right">NoExp</th><th className="p-2.5 text-right">Leve</th><th className="p-2.5 text-right">Grave</th><th className="p-2.5 text-right bg-gray-100/50">Tot</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {availableWeeks.map((w,i) => {
                    const a=filteredCases.filter(r=>r.semana===w&&r.clasificacion_exposicion===0).length;
                    const b=filteredCases.filter(r=>r.semana===w&&r.clasificacion_exposicion===1).length;
                    const c=filteredCases.filter(r=>r.semana===w&&r.clasificacion_exposicion===2).length;
                    return <tr key={w} className={i%2===0?"bg-white":"bg-gray-50/20"}>
                      <td className="p-2.5 font-bold text-gray-700">{w}</td>
                      <td className="p-2.5 text-right text-gray-500">{a}</td>
                      <td className="p-2.5 text-right text-amber-700">{b}</td>
                      <td className="p-2.5 text-right text-red-700">{c}</td>
                      <td className="p-2.5 text-right font-black bg-gray-50/50 text-[#0A4057]">{a+b+c}</td>
                    </tr>;
                  })}
                  <tr className="bg-gray-100 font-bold text-[#0A4057]">
                    <td className="p-2.5 text-[10px] uppercase">Total</td>
                    <td className="p-2.5 text-right">{filteredCases.filter(r=>r.clasificacion_exposicion===0).length}</td>
                    <td className="p-2.5 text-right">{filteredCases.filter(r=>r.clasificacion_exposicion===1).length}</td>
                    <td className="p-2.5 text-right">{filteredCases.filter(r=>r.clasificacion_exposicion===2).length}</td>
                    <td className="p-2.5 text-right bg-gray-200">{filteredCases.length}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* GRÁFICO 7 — Barras agrupadas por semana × clasificación */}
        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
          <div className="bg-[#0A4057] px-6 py-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                📊 Clasificación por Semana — Vista {vistaMode === "sivigila" ? "SIVIGILA" : "Post Seguimiento"}
              </h3>
              <p className="text-[11px] text-white/70">
                {vistaMode === "sivigila"
                  ? "Clasificación inicial SIVIGILA · Incluye repetidos"
                  : "Clasificación post seguimiento del médico veterinario · Excluye repetidos"}
              </p>
            </div>
            <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${vistaMode === "sivigila" ? "bg-[#1DABE3] text-white" : "bg-[#F16729] text-white"}`}>
              {vistaMode === "sivigila" ? "📋 SIVIGILA" : "🔍 Post Seg."}
            </span>
          </div>
          <div className="p-6">
            <div className="h-72 relative w-full"><canvas ref={chartRef7}></canvas></div>
          </div>
        </div>

      </main>

      <footer className="bg-white border-t border-gray-200 py-6 text-center text-xs text-gray-400 font-mono">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p>© 2026 Programa de Zoonosis · Secretaría de Salud de Medellín</p>
          <p className="text-[10px]">Alcaldía de Medellín · Distrito de Ciencia, Tecnología e Innovación</p>
        </div>
      </footer>

      {/* ── MODAL LIMPIAR */}
      {modalLimpiar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setModalLimpiar(false)}>
          <div className="bg-white rounded-lg shadow-xl w-80 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0A4057] px-5 py-3 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-white/80" />
              <h3 className="text-sm font-bold text-white">Limpiar datos</h3>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-500">¿Qué deseas eliminar?</p>
              {/* Opción: eliminar semana específica */}
              {availableWeeks.length > 1 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Eliminar una semana</p>
                  <div className="flex flex-wrap gap-2">
                    {availableWeeks.map(w => (
                      <button key={w} onClick={() => {
                        setCases(prev => prev.filter(r => r.semana !== w));
                        setModalLimpiar(false);
                        showToast(`🗑️ Semana ${w} eliminada.`, "warning");
                      }} className="px-3 py-1.5 text-xs font-bold border border-gray-200 rounded hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all">
                        Sem. {w} <span className="text-gray-400 font-normal">({cases.filter(r => r.semana === w).length} reg.)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Divisor */}
              {availableWeeks.length > 1 && <div className="border-t border-gray-100" />}
              {/* Opción: Restaurar demo */}
              <button onClick={() => {
                setCases(DEMO_DATA);
                setModalLimpiar(false);
                showToast("🔄 Datos de demostración restaurados.", "success");
              }} className="w-full border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-850 text-xs font-bold px-4 py-2.5 rounded flex items-center justify-center gap-2 transition-all cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5 text-orange-600" />
                Restaurar datos de prueba original
              </button>
              {/* Opción: borrar todo */}
              <button onClick={() => {
                setCases([]);
                setModalLimpiar(false);
                showToast("🧹 Todos los datos eliminados.", "warning");
              }} className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded flex items-center justify-center gap-2 transition-all cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar todo ({cases.length} registros)
              </button>
              <button onClick={() => setModalLimpiar(false)}
                className="w-full border border-gray-200 text-gray-600 text-xs font-semibold px-4 py-2 rounded hover:bg-gray-50 transition-all">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ADVERTENCIA MÚLTIPLES HOJAS */}
      {sheetWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-96 overflow-hidden">
            <div className="bg-amber-500 px-5 py-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-white" />
              <h3 className="text-sm font-bold text-white">⚠️ El archivo contiene varias hojas</h3>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-600">
                El archivo Excel contiene <span className="font-bold text-gray-800">{sheetWarning.sheets.length} hojas</span>. Selecciona cuál deseas cargar:
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {sheetWarning.sheets.map((sheet, i) => (
                  <button key={sheet} onClick={() => sheetWarning.onConfirm(sheet)}
                    className="w-full text-left px-3 py-2.5 text-xs font-semibold border border-gray-200 rounded hover:bg-[#1DABE3]/10 hover:border-[#1DABE3] transition-all flex items-center gap-2">
                    <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[10px] font-mono">{i + 1}</span>
                    {sheet}
                  </button>
                ))}
              </div>
              <button onClick={() => setSheetWarning(null)}
                className="w-full border border-gray-200 text-gray-600 text-xs font-semibold px-4 py-2 rounded hover:bg-gray-50 transition-all">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}