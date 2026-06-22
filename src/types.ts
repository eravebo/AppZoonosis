export interface CaseRecord {
  semana: number;
  año: number;
  cod_pre: number;
  esp_ani: number;
  clasificacion_exposicion: number; // 0=No exposición, 1=Exposición leve, 2=Exposición grave
  responsable: string;
  rep_se_ant?: string;
  localidad_: string;
  bar_ver_: string;
  sexo_: string;
  clas_post_seg?: string;
  seg_prioritario?: string;
  estado_ani?: number;
  fec_not?: string;
  dir_res_?: string;
  nom_upgd?: string;
  pri_nom_?: string;
  seg_nom_?: string;
  pri_ape_?: string;
  seg_ape_?: string;
  tip_ide_?: string;
  num_ide_?: string | number;
  edad_?: number;
  uni_med_?: number;
  cen_pobla_?: string;
  vereda_?: string;
  fecha_nto_?: string;
  tip_agr?: number;
  agr_pro?: number;
  tip_les?: number;
  profun?: number;
  fec_con_?: string;
  ini_sin_?: string;
  telefono_?: string | number;
  fec_exp_?: string;
  ant_vac?: number;
  car_vac?: number;
  fecha_vac?: string;
  nom_pro?: string;
  dir_pro?: string;
  tel_pro?: string | number;
  est_ma?: number;
  ubicacion?: number;
  estado_ficha?: string;
  seg_telef?: string;
  seg_visita?: string;
  raza_peligrosa?: string;
  numero_errado?: string;
  direccion_errada?: string;
  comuna?: string;
  fecha_asignacion?: string;
  fech_ent_cas_cerrado?: string;
}

export const ESP_ANI: Record<number, string> = {
  1: "🐕 Perro", 2: "🐈 Gato", 3: "🐄 Bovino-Bufalino",
  4: "🐴 Equidos", 5: "🐷 Porcino (cerdo)", 7: "🦇 Murciélago",
  8: "🦊 Zorro", 9: "🐒 Mico", 10: "🧍 Humano",
  12: "🌿 Otros silvestres", 13: "🐏 Ovino-Caprino", 14: "🐀 Grandes roedores",
};

export const CLASIF_EXP: Record<number, string> = {
  0: "No exposición", 1: "Exposición leve", 2: "Exposición grave",
};

export const CLAS_POST_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  "no exposicion":    { label: "No exposición", color: "#166534", bg: "#dcfce7" },
  "exposicion leve":  { label: "Exp. leve",     color: "#92400e", bg: "#fef3c7" },
  "exposicion grave": { label: "Exp. grave",    color: "#991b1b", bg: "#fee2e2" },
  "sin establecer":   { label: "Sin establecer",color: "#374151", bg: "#f3f4f6" },
};

export const normalizarClasPost = (v: string | undefined): string => {
  if (!v) return "sin establecer";
  return v.toLowerCase().trim().replace(/\s+/g, " ").replace(/ó/g, "o").replace(/é/g, "e");
};

export const ESTADO_ANI: Record<number, string> = {
  1: "En observación", 2: "Muerto", 3: "Desaparecido",
};

export const RESPONSABLE_COLORES: Record<string, string> = {
  "Prada": "#1DABE3", "Juan": "#F16729",
};

export const CLASIF_EXP_COLORES: Record<number, string> = {
  0: "#6b7280", 1: "#d97706", 2: "#dc2626",
};
