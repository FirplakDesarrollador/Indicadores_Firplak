export interface TaskRow {
  id: number;
  task_id: string;
  titulo_tarea: string;
  plan_id: string;
  titulo_plan: string;
  bucket_id: string;
  titulo_bucket: string;
  assigned_user_name: string;
  area: string;
  fecha_creacion_tarea: string;
  fecha_entrega: string;
  percent_complete: number;
  es_atrasado: boolean;
  dias_abierto: number;
}

export const theme = {
  ink: "#123552",
  navy: "#123552",
  inkMuted: "#475569",
  subtle: "#64748b",
  lightText: "#94a3b8",
  teal: "#0f9f9a",
  tealDark: "#0c7c78",
  tealBg: "#ecfdf5",
  coral: "#ef8354",
  red: "#e11d48",
  redBg: "#fff1f2",
  amber: "#d97706",
  amberBg: "#fffbeb",
  purple: "#8c72ca",
  purpleBg: "#f3e8ff",
  white: "#ffffff",
  canvas: "#f8fafc",
  border: "#e2e8f0",
  borderLight: "#f1f5f9",
  shadowSm: "0 1px 3px rgba(18, 53, 82, 0.05)",
};

export const tooltipStyle = {
  background: "#123552",
  border: "none",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "12px",
  padding: "8px 12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
};
