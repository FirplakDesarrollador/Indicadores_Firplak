"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  RefreshCw,
  Search,
  TrendingUp,
  UserCheck,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Check,
  RotateCcw,
  Settings,
  Sparkles,
  Save,
  Briefcase,
  Clock,
  UserX,
  BarChart3,
  Download,
  Calendar,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import AreasSubView from "./carga/AreasSubView";
import AplazamientosSubView from "./carga/AplazamientosSubView";
import HuerfanasSubView from "./carga/HuerfanasSubView";
import HistorialSubView from "./carga/HistorialSubView";
import MacroSubView from "./carga/MacroSubView";

interface TaskRow {
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

interface CollaboratorConfig {
  id?: number;
  nombre_completo: string;
  wipl: number;
  area: string;
  activo: boolean;
  alias: string[];
  modo: "manual" | "dinamico";
}

interface CargaApiResponse {
  success: boolean;
  fechaCorte: string;
  fechasCorteDisponibles?: string[];
  wiplMap: Record<string, number>;
  collaboratorsConfig?: Array<{ id: number; nombre_completo: string; wipl: number; area: string; activo: boolean }>;
  throughputMap?: Record<string, { total: number; completadas: number; vencidas: number }>;
  masterCatalog: {
    areas: string[];
    planes: string[];
    users: string[];
  };
  snapshotRows: TaskRow[];
}

const theme = {
  ink: "#123552",
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
  white: "#ffffff",
  canvas: "#f8fafc",
  border: "#e2e8f0",
  borderLight: "#f1f5f9",
  shadowSm: "0 1px 3px rgba(18, 53, 82, 0.05)",
};

// Generador de alias automáticos por defecto basados en nombres
function generateDefaultAliases(name: string): string[] {
  if (!name || name === "Sin asignar" || name.includes("Usuario Desconocido")) return [];
  const parts = name.trim().split(/\s+/).map((p) => p.toLowerCase());
  const aliases = new Set<string>();

  // Primer nombre
  if (parts[0]) {
    aliases.add(parts[0]);
    if (parts[0].startsWith("ale")) {
      aliases.add("ale");
      aliases.add("alejo");
      aliases.add("alejandro");
    }
    if (parts[0].startsWith("dani")) {
      aliases.add("dani");
      aliases.add("daniel");
    }
  }

  // Primer apellido
  if (parts.length > 1 && parts[parts.length - 1]) {
    aliases.add(parts[parts.length - 1]);
  }

  return Array.from(aliases);
}

// Helper para extraer alias entre paréntesis en el título de la tarea (ej: "(Ale)", "(Alejandro)", "(Alejo+Estiven)")
function extractParenthesisAliases(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/\(([^)]+)\)/g);
  if (!matches) return [];

  const found: string[] = [];
  matches.forEach((m) => {
    const inner = m.replace(/[()]/g, "").trim().toLowerCase();
    // Manejar casos como "Alejo+Estiven" o "Alejandra- agendamiento"
    inner.split(/[+\/,&-]/).forEach((sub) => {
      const trimmed = sub.trim();
      if (trimmed && trimmed.length >= 2) found.push(trimmed);
    });
  });
  return found;
}

// Componente Popover de Selección Múltiple con Buscador
function MultiSelectDropdown({
  label,
  options,
  selectedValues,
  onChange,
  countsMap,
  placeholder = "Buscar...",
}: {
  label: string;
  options: string[];
  selectedValues: Set<string>;
  onChange: (newSet: Set<string>) => void;
  countsMap?: Record<string, number>;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!filterText.trim()) return options;
    const term = filterText.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(term));
  }, [options, filterText]);

  const toggleOption = (opt: string) => {
    const next = new Set(selectedValues);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    onChange(next);
  };

  const selectAll = () => onChange(new Set(options));
  const clearAll = () => onChange(new Set());

  return (
    <div ref={dropdownRef} style={{ position: "relative", minWidth: "180px", flex: "1 1 180px" }}>
      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: theme.inkMuted, marginBottom: "5px" }}>
        {label}
        {selectedValues.size > 0 && (
          <span
            style={{
              marginLeft: "6px",
              background: theme.teal,
              color: "#fff",
              padding: "1px 6px",
              borderRadius: "10px",
              fontSize: "10px",
            }}
          >
            {selectedValues.size}
          </span>
        )}
      </label>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "8px 12px",
          background: theme.white,
          border: `1px solid ${selectedValues.size > 0 ? theme.teal : theme.border}`,
          borderRadius: "8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "12px",
          color: selectedValues.size > 0 ? theme.ink : theme.subtle,
          cursor: "pointer",
          boxShadow: theme.shadowSm,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedValues.size === 0
            ? `Todos (${options.length})`
            : `${selectedValues.size} seleccionado${selectedValues.size > 1 ? "s" : ""}`}
        </span>
        <ChevronDown size={14} style={{ color: theme.subtle, flexShrink: 0 }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: theme.white,
            border: `1px solid ${theme.border}`,
            borderRadius: "10px",
            boxShadow: "0 10px 25px -5px rgba(18, 53, 82, 0.15)",
            zIndex: 100,
            padding: "10px",
            maxHeight: "340px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "8px", top: "9px", color: theme.subtle }} />
            <input
              type="text"
              placeholder={placeholder}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 8px 6px 28px",
                border: `1px solid ${theme.border}`,
                borderRadius: "6px",
                fontSize: "11px",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", padding: "0 2px" }}>
            <button
              type="button"
              onClick={selectAll}
              style={{ background: "none", color: theme.tealDark, fontWeight: 600, cursor: "pointer", padding: 0 }}
            >
              Seleccionar todos
            </button>
            <button
              type="button"
              onClick={clearAll}
              style={{ background: "none", color: theme.subtle, fontWeight: 500, cursor: "pointer", padding: 0 }}
            >
              Limpiar
            </button>
          </div>

          <div style={{ overflowY: "auto", maxHeight: "220px", display: "flex", flexDirection: "column", gap: "2px" }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: "12px", textAlign: "center", color: theme.subtle, fontSize: "11px" }}>
                Sin resultados
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selectedValues.has(opt);
                const count = countsMap ? countsMap[opt] : undefined;
                return (
                  <div
                    key={opt}
                    onClick={() => toggleOption(opt)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      color: isChecked ? theme.ink : theme.inkMuted,
                      background: isChecked ? theme.tealBg : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: "14px",
                          height: "14px",
                          borderRadius: "4px",
                          border: `1.5px solid ${isChecked ? theme.teal : theme.subtle}`,
                          background: isChecked ? theme.teal : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {isChecked && <Check size={11} color="#fff" strokeWidth={3} />}
                      </div>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt}</span>
                    </div>
                    {count !== undefined && (
                      <span style={{ fontSize: "10px", color: theme.subtle, marginLeft: "6px" }}>{count}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CargaView() {
  const [apiData, setApiData] = useState<CargaApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSubView, setActiveSubView] = useState<
    "tablero" | "areas" | "historial" | "aplazamientos" | "huerfanas" | "macro" | "configuracion"
  >("tablero");

  // Configuración de Colaboradores WIPL
  const [userConfigs, setUserConfigs] = useState<Record<string, CollaboratorConfig>>({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [configSearchTerm, setConfigSearchTerm] = useState("");
  const [newAliasInputs, setNewAliasInputs] = useState<Record<string, string>>({});

  // Estados de Selección Múltiple y Filtros
  const [selectedFechaCorte, setSelectedFechaCorte] = useState<string>("");
  const [vencimientoMode, setVencimientoMode] = useState<
    "todos" | "coincidir_corte" | "atrasadas" | "atiempo" | "fecha_especifica"
  >("todos");
  const [selectedFechaEntrega, setSelectedFechaEntrega] = useState<string>("");

  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set());
  const [selectedPlanes, setSelectedPlanes] = useState<Set<string>>(new Set());
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<"all" | "atrasadas" | "atiempo">("all");
  const [onlyOverloaded, setOnlyOverloaded] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Carga de datos de capacidad (soporta targetCorte opcional)
  const loadData = async (targetCorte?: string) => {
    try {
      setRefreshing(true);
      const query = targetCorte ? `?fecha_corte=${encodeURIComponent(targetCorte)}` : "";
      const res = await fetch(`/api/carga${query}`);
      const json: CargaApiResponse = await res.json();
      if (json.success) {
        setApiData(json);
        setSelectedFechaCorte(json.fechaCorte);

        // Inicializar configuraciones individuales combinando API, localStorage y maestros
        const storedLocal = typeof window !== "undefined" ? localStorage.getItem("firplak_wipl_configs") : null;
        const parsedLocal: Record<string, Partial<CollaboratorConfig>> = storedLocal ? JSON.parse(storedLocal) : {};

        const initialMap: Record<string, CollaboratorConfig> = {};

        // Agregar usuarios maestros
        (json.masterCatalog.users || []).forEach((u) => {
          const apiItem = (json.collaboratorsConfig || []).find((c) => c.nombre_completo === u);
          const localItem = parsedLocal[u];

          const defaultAliases = generateDefaultAliases(u);
          const aliases = localItem?.alias || defaultAliases;
          const wipl = localItem?.wipl || apiItem?.wipl || json.wiplMap[u] || 5;
          const modo = localItem?.modo || "manual";
          const area = apiItem?.area || "Operaciones";

          initialMap[u] = {
            nombre_completo: u,
            wipl,
            area,
            activo: apiItem?.activo !== false,
            alias: aliases,
            modo,
          };
        });

        setUserConfigs(initialMap);
      }
    } catch (err) {
      console.error("Error al cargar datos de capacidad y WIPL:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Guardar configuración WIPL en Supabase y localStorage
  const handleSaveConfigs = async () => {
    try {
      setSavingConfig(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("firplak_wipl_configs", JSON.stringify(userConfigs));
      }

      const payload = Object.values(userConfigs).map((c) => ({
        nombre_completo: c.nombre_completo,
        wipl: c.wipl,
        area: c.area,
        activo: c.activo,
      }));

      const res = await fetch("/api/carga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs: payload }),
      });

      const resJson = await res.json();
      if (resJson.success) {
        showToast("¡Configuración WIPL guardada y sincronizada exitosamente!");
        // Actualizar wiplMap en apiData local
        if (apiData && resJson.wiplMap) {
          setApiData({ ...apiData, wiplMap: resJson.wiplMap });
        }
      } else {
        showToast("Se guardó localmente. Nota: Error en base de datos: " + resJson.error);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Error al guardar WIPL:", message);
      showToast("Configuración guardada localmente en el navegador.");
    } finally {
      setSavingConfig(false);
    }
  };

  // Actualizar WIPL de un colaborador individual
  const updateCollaboratorWipl = (nombre: string, deltaOrValue: number | ((prev: number) => number)) => {
    setUserConfigs((prev) => {
      const current = prev[nombre] || {
        nombre_completo: nombre,
        wipl: 5,
        area: "Operaciones",
        activo: true,
        alias: generateDefaultAliases(nombre),
        modo: "manual",
      };
      const newWipl = typeof deltaOrValue === "function" ? deltaOrValue(current.wipl) : deltaOrValue;
      const clamped = Math.max(1, Math.min(30, newWipl));

      return {
        ...prev,
        [nombre]: { ...current, wipl: clamped },
      };
    });
  };

  // Agregar alias a colaborador
  const addAlias = (nombre: string) => {
    const text = (newAliasInputs[nombre] || "").trim().toLowerCase();
    if (!text) return;

    setUserConfigs((prev) => {
      const curr = prev[nombre];
      if (!curr) return prev;
      if (curr.alias.includes(text)) return prev;
      return {
        ...prev,
        [nombre]: { ...curr, alias: [...curr.alias, text] },
      };
    });

    setNewAliasInputs((prev) => ({ ...prev, [nombre]: "" }));
  };

  // Eliminar alias
  const removeAlias = (nombre: string, aliasToRemove: string) => {
    setUserConfigs((prev) => {
      const curr = prev[nombre];
      if (!curr) return prev;
      return {
        ...prev,
        [nombre]: { ...curr, alias: curr.alias.filter((a) => a !== aliasToRemove) },
      };
    });
  };

  // FILTRADO DINÁMICO CRUZADO
  const filteredRows = useMemo(() => {
    if (!apiData?.snapshotRows) return [];
    const corteDate = apiData.fechaCorte;

    return apiData.snapshotRows.filter((r) => {
      // 1. Filtro de Coincidencia con Día del Registro o Fecha de Vencimiento
      if (vencimientoMode === "coincidir_corte") {
        if (!r.fecha_entrega || !r.fecha_entrega.startsWith(corteDate)) {
          return false;
        }
      } else if (vencimientoMode === "fecha_especifica" && selectedFechaEntrega) {
        if (!r.fecha_entrega || !r.fecha_entrega.startsWith(selectedFechaEntrega)) {
          return false;
        }
      } else if (vencimientoMode === "atrasadas") {
        if (!r.es_atrasado) return false;
      } else if (vencimientoMode === "atiempo") {
        if (r.es_atrasado) return false;
      }

      // 2. Filtro múltiple de Áreas
      if (selectedAreas.size > 0 && !selectedAreas.has(r.area)) {
        return false;
      }

      // 3. Filtro múltiple de Planes
      if (selectedPlanes.size > 0 && !selectedPlanes.has(r.titulo_plan)) {
        return false;
      }

      // 4. Filtro múltiple de Colaboradores
      if (selectedUsers.size > 0 && !selectedUsers.has(r.assigned_user_name)) {
        return false;
      }

      // 5. Filtro de Estado (select tradicional)
      if (statusFilter === "atrasadas" && !r.es_atrasado) return false;
      if (statusFilter === "atiempo" && r.es_atrasado) return false;

      // 6. Búsqueda por texto
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchTitle = r.titulo_tarea?.toLowerCase().includes(term);
        const matchPlan = r.titulo_plan?.toLowerCase().includes(term);
        const matchUser = r.assigned_user_name?.toLowerCase().includes(term);
        const matchArea = r.area?.toLowerCase().includes(term);
        if (!matchTitle && !matchPlan && !matchUser && !matchArea) return false;
      }

      return true;
    });
  }, [
    apiData,
    vencimientoMode,
    selectedFechaEntrega,
    selectedAreas,
    selectedPlanes,
    selectedUsers,
    statusFilter,
    searchTerm,
  ]);

  // Recalcular Colaboradores aplicando FORMULACIÓN WIPL (Opción A: Actividad próxima en checklist/alias)
  const colaboradoresCalculated = useMemo(() => {
    const map: Record<
      string,
      {
        nombre: string;
        area: string;
        total: number;
        atrasadas: number;
        aTiempo: number;
        wipl: number;
        modo: "manual" | "dinamico";
        throughputDiario: number;
      }
    > = {};

    // Inicializar mapa de colaboradores activos
    Object.keys(userConfigs).forEach((u) => {
      const cfg = userConfigs[u];
      const throughputInfo = apiData?.throughputMap?.[u];
      const completadasTotal = throughputInfo?.completadas || 0;
      // Estimación de throughput diario (ej. en últimos días de actividad observada)
      const throughputDiario = Math.max(1, Math.round(completadasTotal > 0 ? Math.min(10, completadasTotal / 12) : 3));

      // Si el modo es dinámico, el WIPL se ajusta por throughput
      const effectiveWipl = cfg.modo === "dinamico" ? throughputDiario : cfg.wipl || 5;

      map[u] = {
        nombre: u,
        area: cfg.area || "Sin área",
        total: 0,
        atrasadas: 0,
        aTiempo: 0,
        wipl: effectiveWipl,
        modo: cfg.modo,
        throughputDiario,
      };
    });

    // Asignar tareas evaluando Opción A (Actividad próxima por alias / checklist)
    filteredRows.forEach((r) => {
      const assignedName = r.assigned_user_name || "Sin asignar";
      const taskAliases = extractParenthesisAliases(r.titulo_tarea);

      // Si la tarea tiene alias explícitos entre paréntesis (ej: "(Ale)", "(Alejandro)")
      if (taskAliases.length > 0) {
        let matchedUser: string | null = null;

        // Comprobar qué colaborador tiene configurado este alias en su lista
        for (const [uname, ucfg] of Object.entries(userConfigs)) {
          const userAliasSet = new Set(ucfg.alias.map((a) => a.toLowerCase()));
          const hasMatch = taskAliases.some((ta) => userAliasSet.has(ta));
          if (hasMatch) {
            matchedUser = uname;
            break; // Opción A estricta: el primer alias de la actividad próxima toma la tarea
          }
        }

        if (matchedUser) {
          if (!map[matchedUser]) {
            map[matchedUser] = {
              nombre: matchedUser,
              area: r.area || "Sin área",
              total: 0,
              atrasadas: 0,
              aTiempo: 0,
              wipl: userConfigs[matchedUser]?.wipl || 5,
              modo: "manual",
              throughputDiario: 3,
            };
          }
          map[matchedUser].total += 1;
          if (r.es_atrasado) map[matchedUser].atrasadas += 1;
          else map[matchedUser].aTiempo += 1;
          return;
        }
      }

      // Si no tiene alias explícito de otra persona, se atribuye a su assigned_user_name directo
      if (!map[assignedName]) {
        map[assignedName] = {
          nombre: assignedName,
          area: r.area || "Sin área",
          total: 0,
          atrasadas: 0,
          aTiempo: 0,
          wipl: userConfigs[assignedName]?.wipl || apiData?.wiplMap[assignedName] || 5,
          modo: "manual",
          throughputDiario: 3,
        };
      }
      map[assignedName].total += 1;
      if (r.es_atrasado) map[assignedName].atrasadas += 1;
      else map[assignedName].aTiempo += 1;
    });

    let list = Object.values(map).sort((a, b) => b.total - a.total);
    if (onlyOverloaded) {
      list = list.filter((c) => c.nombre !== "Sin asignar" && c.total > c.wipl);
    }
    return list;
  }, [filteredRows, userConfigs, apiData, onlyOverloaded]);

  // Recalcular KPIs bajo la selección cruzada actual (idéntico al Power BI)
  const kpis = useMemo(() => {
    const totalAsignaciones = filteredRows.length;
    const uniqueTasks = new Set(filteredRows.map((r) => r.task_id)).size;
    const atrasadas = filteredRows.filter((r) => r.es_atrasado).length;
    const aTiempo = totalAsignaciones - atrasadas;
    const pctAtraso = totalAsignaciones > 0 ? Math.round((atrasadas / totalAsignaciones) * 100) : 0;

    // Medidas idénticas al Power BI:
    // 1. Desempeño Día: evalúa las tareas que vencen exactamente en la fecha del registro (fecha_corte)
    const corteDate = apiData?.fechaCorte || "";
    const tareasQueVencenElDia = (apiData?.snapshotRows || []).filter(
      (r) => r.fecha_entrega && r.fecha_entrega.startsWith(corteDate)
    );
    const totalDia = tareasQueVencenElDia.length;
    const atrasadasDia = tareasQueVencenElDia.filter((r) => r.es_atrasado).length;
    const aTiempoDia = totalDia - atrasadasDia;
    const desempenoDia = totalDia > 0 ? Math.round((aTiempoDia / totalDia) * 100) : 100;

    // 2. Desempeño Total: evalúa el cumplimiento sobre el backlog abierto
    const desempenoTotal = totalAsignaciones > 0 ? 100 - pctAtraso : 100;

    const personasCount = colaboradoresCalculated.filter((c) => c.nombre !== "Sin asignar" && c.total > 0).length;
    const sobrecargaCount = colaboradoresCalculated.filter((c) => c.nombre !== "Sin asignar" && c.total > c.wipl).length;
    const optimosCount = colaboradoresCalculated.filter(
      (c) => c.nombre !== "Sin asignar" && c.total > 0 && c.total <= c.wipl
    ).length;

    return {
      totalAsignaciones,
      uniqueTasks,
      atrasadas,
      aTiempo,
      pctAtraso,
      desempenoDia,
      desempenoTotal,
      totalDia,
      atrasadasDia,
      aTiempoDia,
      personasCount,
      sobrecargaCount,
      optimosCount,
    };
  }, [filteredRows, colaboradoresCalculated, apiData]);

  // Áreas calculadas
  const areasList = useMemo(() => {
    const map: Record<string, { area: string; total: number; atrasadas: number; aTiempo: number; personas: Set<string> }> = {};
    filteredRows.forEach((r) => {
      const a = r.area || "Sin área";
      if (!map[a]) map[a] = { area: a, total: 0, atrasadas: 0, aTiempo: 0, personas: new Set() };
      map[a].total += 1;
      map[a].personas.add(r.assigned_user_name);
      if (r.es_atrasado) map[a].atrasadas += 1;
      else map[a].aTiempo += 1;
    });
    return Object.values(map)
      .map((a) => ({ ...a, personasCount: a.personas.size }))
      .sort((a, b) => b.total - a.total);
  }, [filteredRows]);

  // Planes calculados
  const planesList = useMemo(() => {
    const map: Record<string, { plan: string; total: number; atrasadas: number }> = {};
    filteredRows.forEach((r) => {
      const p = r.titulo_plan || "Sin plan";
      if (!map[p]) map[p] = { plan: p, total: 0, atrasadas: 0 };
      map[p].total += 1;
      if (r.es_atrasado) map[p].atrasadas += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredRows]);

  // Paginación del detalle de tareas
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Toggle de selección interactiva rápida
  const toggleUser = (nombre: string) => {
    if (nombre === "Sin asignar") return;
    const next = new Set(selectedUsers);
    if (next.has(nombre)) next.delete(nombre);
    else next.add(nombre);
    setSelectedUsers(next);
  };

  const toggleArea = (area: string) => {
    const next = new Set(selectedAreas);
    if (next.has(area)) next.delete(area);
    else next.add(area);
    setSelectedAreas(next);
  };

  const togglePlan = (plan: string) => {
    const next = new Set(selectedPlanes);
    if (next.has(plan)) next.delete(plan);
    else next.add(plan);
    setSelectedPlanes(next);
  };

  const clearAllFilters = () => {
    setSelectedAreas(new Set());
    setSelectedPlanes(new Set());
    setSelectedUsers(new Set());
    setStatusFilter("all");
    setVencimientoMode("todos");
    setSelectedFechaEntrega("");
    setOnlyOverloaded(false);
    setSearchTerm("");
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    if (!filteredRows || filteredRows.length === 0) return;
    const headers = [
      "ID",
      "Tarea",
      "Plan",
      "Bucket",
      "Responsable",
      "Area",
      "Fecha Creacion",
      "Fecha Entrega",
      "Dias Abierta",
      "Estado",
    ];
    const rows = filteredRows.map((r) => [
      r.task_id || r.id,
      `"${(r.titulo_tarea || "").replace(/"/g, '""')}"`,
      `"${(r.titulo_plan || "").replace(/"/g, '""')}"`,
      `"${(r.titulo_bucket || "").replace(/"/g, '""')}"`,
      `"${(r.assigned_user_name || "Sin asignar").replace(/"/g, '""')}"`,
      `"${(r.area || "Sin área").replace(/"/g, '""')}"`,
      r.fecha_creacion_tarea ? r.fecha_creacion_tarea.split("T")[0] : "",
      r.fecha_entrega ? r.fecha_entrega.split("T")[0] : "",
      r.dias_abierto || 0,
      r.es_atrasado ? "Atrasada" : "A tiempo",
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(";"), ...rows.map((row) => row.join(";"))].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Planner_Firplak_${apiData?.fechaCorte || "corte"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Datos para Gráfico de Barras: Colaboradores vs WIPL (Top 18 con carga)
  const chartColaboradores = useMemo(() => {
    return colaboradoresCalculated
      .filter((c) => c.nombre !== "Sin asignar" && c.total > 0)
      .slice(0, 18)
      .map((c) => {
        const parts = c.nombre.split(" ");
        const shortName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
        return {
          nombre: c.nombre,
          nombreCorto: shortName,
          wip: c.total,
          wipl: c.wipl,
          atrasadas: c.atrasadas,
          aTiempo: c.aTiempo,
          esSobrecarga: c.total > c.wipl,
        };
      });
  }, [colaboradoresCalculated]);

  // Datos para Donut de Cumplimiento / Sobrecarga
  const donutData = useMemo(() => {
    return [
      { name: "A tiempo", value: kpis.aTiempo, color: theme.teal },
      { name: "Atrasadas", value: kpis.atrasadas, color: theme.red },
    ];
  }, [kpis]);

  // Lista de colaboradores filtrada para la pestaña de Configuración
  const filteredConfigCollaborators = useMemo(() => {
    const list = Object.values(userConfigs);
    if (!configSearchTerm.trim()) return list.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
    const term = configSearchTerm.toLowerCase();
    return list
      .filter((c) => c.nombre_completo.toLowerCase().includes(term) || c.area.toLowerCase().includes(term))
      .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
  }, [userConfigs, configSearchTerm]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "450px",
          gap: "14px",
          color: theme.subtle,
        }}
      >
        <RefreshCw size={28} className="animate-spin" style={{ color: theme.teal }} />
        <span style={{ fontWeight: 600, fontSize: "14px" }}>Cargando analítica de Capacidad Operativa y WIPL...</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px", fontFamily: "inherit" }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: theme.ink,
            color: "#fff",
            padding: "12px 20px",
            borderRadius: "10px",
            boxShadow: "0 10px 25px rgba(18, 53, 82, 0.3)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          <Sparkles size={16} style={{ color: theme.teal }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header y Sub-navegación Principal */}
      <div
        style={{
          background: theme.white,
          borderRadius: "14px",
          padding: "20px 24px",
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadowSm,
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  color: theme.tealDark,
                  background: theme.tealBg,
                  padding: "3px 9px",
                  borderRadius: "6px",
                  border: `1px solid #bbf7d0`,
                }}
              >
                Corte Diario Activo • 03:00 AM
              </span>
              <span style={{ fontSize: "12px", color: theme.subtle }}>
                Snapshot: <strong>{apiData?.fechaCorte}</strong>
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800, color: theme.ink, letterSpacing: "-0.5px" }}>
              Capacidad Operativa & Límite WIPL
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: theme.inkMuted }}>
              Monitoreo de Trabajo en Proceso (WIP) vs Límite Saludable (WIPL) por Colaborador y Áreas (Opción A: Checklist).
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={handleExportCSV}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: theme.white,
                color: theme.ink,
                border: `1px solid ${theme.border}`,
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
              }}
              title="Descargar listado actual de tareas en formato CSV"
            >
              <Download size={14} style={{ color: theme.teal }} />
              <span>Exportar</span>
            </button>

            <button
              onClick={() => loadData()}
              disabled={refreshing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: theme.white,
                color: theme.ink,
                border: `1px solid ${theme.border}`,
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
              }}
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} style={{ color: theme.teal }} />
              <span>Sincronizar</span>
            </button>
          </div>
        </div>

        {/* Sub-Tabs de Navegación interna (Vistas de BI Kanban) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            borderBottom: `1px solid ${theme.border}`,
            paddingBottom: "4px",
            marginTop: "4px",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          <button
            onClick={() => setActiveSubView("tablero")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "8px 8px 0 0",
              borderBottom: `2px solid ${activeSubView === "tablero" ? theme.teal : "transparent"}`,
              color: activeSubView === "tablero" ? theme.tealDark : theme.inkMuted,
              fontWeight: activeSubView === "tablero" ? 700 : 600,
              fontSize: "12px",
              background: "transparent",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <Layers size={15} />
            <span>Capacidad & WIPL</span>
          </button>

          <button
            onClick={() => setActiveSubView("areas")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "8px 8px 0 0",
              borderBottom: `2px solid ${activeSubView === "areas" ? theme.teal : "transparent"}`,
              color: activeSubView === "areas" ? theme.tealDark : theme.inkMuted,
              fontWeight: activeSubView === "areas" ? 700 : 600,
              fontSize: "12px",
              background: "transparent",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <Briefcase size={15} />
            <span>Por Áreas</span>
          </button>

          <button
            onClick={() => setActiveSubView("historial")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "8px 8px 0 0",
              borderBottom: `2px solid ${activeSubView === "historial" ? theme.teal : "transparent"}`,
              color: activeSubView === "historial" ? theme.tealDark : theme.inkMuted,
              fontWeight: activeSubView === "historial" ? 700 : 600,
              fontSize: "12px",
              background: "transparent",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <TrendingUp size={15} />
            <span>Historial & Flujo</span>
          </button>

          <button
            onClick={() => setActiveSubView("aplazamientos")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "8px 8px 0 0",
              borderBottom: `2px solid ${activeSubView === "aplazamientos" ? theme.teal : "transparent"}`,
              color: activeSubView === "aplazamientos" ? theme.tealDark : theme.inkMuted,
              fontWeight: activeSubView === "aplazamientos" ? 700 : 600,
              fontSize: "12px",
              background: "transparent",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <Clock size={15} />
            <span>Aplazamientos</span>
          </button>

          <button
            onClick={() => setActiveSubView("huerfanas")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "8px 8px 0 0",
              borderBottom: `2px solid ${activeSubView === "huerfanas" ? theme.teal : "transparent"}`,
              color: activeSubView === "huerfanas" ? theme.tealDark : theme.inkMuted,
              fontWeight: activeSubView === "huerfanas" ? 700 : 600,
              fontSize: "12px",
              background: "transparent",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <UserX size={15} />
            <span>Sin Asignar</span>
          </button>

          <button
            onClick={() => setActiveSubView("macro")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "8px 8px 0 0",
              borderBottom: `2px solid ${activeSubView === "macro" ? theme.teal : "transparent"}`,
              color: activeSubView === "macro" ? theme.tealDark : theme.inkMuted,
              fontWeight: activeSubView === "macro" ? 700 : 600,
              fontSize: "12px",
              background: "transparent",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <BarChart3 size={15} />
            <span>Macro Firplak</span>
          </button>

          <button
            onClick={() => setActiveSubView("configuracion")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "8px 8px 0 0",
              borderBottom: `2px solid ${activeSubView === "configuracion" ? theme.teal : "transparent"}`,
              color: activeSubView === "configuracion" ? theme.tealDark : theme.inkMuted,
              fontWeight: activeSubView === "configuracion" ? 700 : 600,
              fontSize: "12px",
              background: "transparent",
              cursor: "pointer",
              whiteSpace: "nowrap",
              marginLeft: "auto",
            }}
          >
            <Settings size={15} />
            <span>Configuración WIPL</span>
            <span
              style={{
                fontSize: "10px",
                padding: "2px 6px",
                borderRadius: "10px",
                background: "#f1f5f9",
                color: theme.subtle,
                fontWeight: 700,
              }}
            >
              {Object.keys(userConfigs).length}
            </span>
          </button>
        </div>

        {/* Toolbar de Multi-Selección (visible en todas las vistas de análisis) */}
        {activeSubView !== "configuracion" && (
          <div
            style={{
              background: theme.canvas,
              borderRadius: "10px",
              padding: "14px 16px",
              border: `1px solid ${theme.border}`,
              display: "flex",
              alignItems: "flex-end",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            {/* 1. Selector de Día del Registro (Corte Diario - Power BI Slicer) */}
            <div style={{ minWidth: "160px", flex: "1 1 160px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: theme.inkMuted,
                  marginBottom: "5px",
                }}
              >
                <Calendar size={13} style={{ color: theme.teal }} />
                <span>Día del Registro</span>
              </label>
              <select
                value={selectedFechaCorte || apiData?.fechaCorte || ""}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setSelectedFechaCorte(newDate);
                  loadData(newDate);
                  setCurrentPage(1);
                }}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  background: theme.white,
                  border: `1.5px solid ${theme.teal}`,
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: theme.ink,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {(apiData?.fechasCorteDisponibles && apiData.fechasCorteDisponibles.length > 0
                  ? apiData.fechasCorteDisponibles
                  : [apiData?.fechaCorte || ""]
                ).map((f) => (
                  <option key={f} value={f}>
                    {f} {f === apiData?.fechaCorte ? "• Activo" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Selector de Alineación con Fecha de Vencimiento (Power BI Desempeño Día) */}
            <div style={{ minWidth: "250px", flex: "2 1 250px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: vencimientoMode === "coincidir_corte" ? theme.tealDark : theme.inkMuted,
                  marginBottom: "5px",
                }}
              >
                <Clock size={13} style={{ color: theme.coral }} />
                <span>Fecha Vencimiento de Tareas</span>
              </label>
              <div style={{ display: "flex", gap: "6px" }}>
                <select
                  value={vencimientoMode}
                  onChange={(e) => {
                    setVencimientoMode(
                      e.target.value as "todos" | "coincidir_corte" | "atrasadas" | "atiempo" | "fecha_especifica"
                    );
                    setCurrentPage(1);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    background: vencimientoMode === "coincidir_corte" ? theme.tealBg : theme.white,
                    border: `1.5px solid ${vencimientoMode === "coincidir_corte" ? theme.teal : theme.border}`,
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: vencimientoMode === "coincidir_corte" ? 700 : 500,
                    color: vencimientoMode === "coincidir_corte" ? theme.tealDark : theme.ink,
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="todos">📋 Todo el Backlog Abierto ({apiData?.snapshotRows.length || 0})</option>
                  <option value="coincidir_corte">
                    🎯 Coincidir con Día del Registro ({kpis.totalDia} vencen el {apiData?.fechaCorte})
                  </option>
                  <option value="atrasadas">⚠️ Solo Atrasadas al corte</option>
                  <option value="atiempo">✅ Solo A Tiempo al corte</option>
                  <option value="fecha_especifica">📅 Fecha de vencimiento específica...</option>
                </select>
                {vencimientoMode === "fecha_especifica" && (
                  <input
                    type="date"
                    value={selectedFechaEntrega}
                    onChange={(e) => {
                      setSelectedFechaEntrega(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: "6px 8px",
                      fontSize: "11px",
                      border: `1px solid ${theme.border}`,
                      borderRadius: "8px",
                      outline: "none",
                    }}
                  />
                )}
              </div>
            </div>

            {/* Multi-Select Áreas */}
            <MultiSelectDropdown
              label="Áreas"
              options={apiData?.masterCatalog.areas || []}
              selectedValues={selectedAreas}
              onChange={(next) => {
                setSelectedAreas(next);
                setCurrentPage(1);
              }}
              placeholder="Filtrar áreas..."
            />

            {/* Multi-Select Planes */}
            <MultiSelectDropdown
              label="Planes de Planner"
              options={apiData?.masterCatalog.planes || []}
              selectedValues={selectedPlanes}
              onChange={(next) => {
                setSelectedPlanes(next);
                setCurrentPage(1);
              }}
              placeholder="Filtrar planes..."
            />

            {/* Multi-Select Colaboradores */}
            <MultiSelectDropdown
              label="Colaboradores"
              options={apiData?.masterCatalog.users || []}
              selectedValues={selectedUsers}
              onChange={(next) => {
                setSelectedUsers(next);
                setCurrentPage(1);
              }}
              placeholder="Filtrar colaborador..."
            />

            {/* Filtro de Cumplimiento Tradicional */}
            <div style={{ minWidth: "130px", flex: "1 1 130px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: theme.inkMuted, marginBottom: "5px" }}>
                Cumplimiento
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as "all" | "atrasadas" | "atiempo");
                  setCurrentPage(1);
                }}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: theme.white,
                  border: `1px solid ${statusFilter !== "all" ? theme.teal : theme.border}`,
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: theme.ink,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="all">Todas</option>
                <option value="atrasadas">Solo Atrasadas</option>
                <option value="atiempo">Solo A Tiempo</option>
              </select>
            </div>

            {/* Toggle Sobrecarga */}
            <div style={{ display: "flex", alignItems: "center", paddingBottom: "2px" }}>
              <button
                type="button"
                onClick={() => {
                  setOnlyOverloaded(!onlyOverloaded);
                  setCurrentPage(1);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: `1px solid ${onlyOverloaded ? theme.amber : theme.border}`,
                  background: onlyOverloaded ? theme.amberBg : theme.white,
                  color: onlyOverloaded ? theme.amber : theme.inkMuted,
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <ShieldAlert size={14} />
                <span>&gt; WIPL ({kpis.sobrecargaCount})</span>
              </button>
            </div>

            {/* Buscador de Tareas */}
            <div style={{ flex: "2 1 180px", position: "relative" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: theme.inkMuted, marginBottom: "5px" }}>
                Búsqueda Rápida
              </label>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: "10px", top: "10px", color: theme.subtle }} />
                <input
                  type="text"
                  placeholder="Buscar tarea, persona, plan..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 30px",
                    background: theme.white,
                    border: `1px solid ${theme.border}`,
                    borderRadius: "8px",
                    fontSize: "12px",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Botón Limpiar Filtros */}
            {(selectedAreas.size > 0 ||
              selectedPlanes.size > 0 ||
              selectedUsers.size > 0 ||
              statusFilter !== "all" ||
              vencimientoMode !== "todos" ||
              selectedFechaEntrega !== "" ||
              onlyOverloaded ||
              searchTerm.trim() !== "") && (
              <button
                type="button"
                onClick={clearAllFilters}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: "transparent",
                  color: theme.red,
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  marginBottom: "2px",
                }}
              >
                <RotateCcw size={13} />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODO 2: SUBSECCIÓN DE CONFIGURACIÓN WIPL & ALIAS          */}
      {/* ========================================================= */}
      {activeSubView === "configuracion" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Card explicativa y métricas de configuración */}
          <div
            style={{
              background: theme.white,
              borderRadius: "14px",
              padding: "22px",
              border: `1px solid ${theme.border}`,
              boxShadow: theme.shadowSm,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: theme.ink }}>
                Ajuste Individual de Capacidad WIPL y Reconocimiento de Checklist
              </h2>
              <p style={{ margin: "5px 0 0", fontSize: "13px", color: theme.inkMuted, maxWidth: "700px" }}>
                <strong>Regla Opción A:</strong> El WIPL se evalúa contra las tareas donde la persona tiene la próxima actividad
                según su nombre o alias en el checklist (ej. <code>(Ale)</code>, <code>(Alejandro)</code>).
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                onClick={handleSaveConfigs}
                disabled={savingConfig}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  background: theme.teal,
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(15, 159, 154, 0.3)",
                }}
              >
                <Save size={16} />
                <span>{savingConfig ? "Guardando..." : "Guardar Cambios WIPL"}</span>
              </button>
            </div>
          </div>

          {/* Buscador de Colaborador en Configuración */}
          <div
            style={{
              background: theme.white,
              borderRadius: "12px",
              padding: "14px 18px",
              border: `1px solid ${theme.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
            }}
          >
            <div style={{ position: "relative", flex: 1, maxWidth: "400px" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "10px", color: theme.subtle }} />
              <input
                type="text"
                placeholder="Buscar por colaborador o área..."
                value={configSearchTerm}
                onChange={(e) => setConfigSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 10px 7px 30px",
                  border: `1px solid ${theme.border}`,
                  borderRadius: "6px",
                  fontSize: "12px",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ fontSize: "12px", color: theme.subtle }}>
              Mostrando <strong>{filteredConfigCollaborators.length}</strong> colaboradores
            </div>
          </div>

          {/* Tabla de Configuración de Colaboradores */}
          <div
            style={{
              background: theme.white,
              borderRadius: "14px",
              border: `1px solid ${theme.border}`,
              boxShadow: theme.shadowSm,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: theme.canvas, borderBottom: `1px solid ${theme.border}` }}>
                  <th style={{ padding: "14px 16px", color: theme.ink, fontWeight: 700 }}>Colaborador</th>
                  <th style={{ padding: "14px 16px", color: theme.ink, fontWeight: 700 }}>Área</th>
                  <th style={{ padding: "14px 16px", color: theme.ink, fontWeight: 700, width: "160px" }}>Límite WIPL</th>
                  <th style={{ padding: "14px 16px", color: theme.ink, fontWeight: 700, width: "160px" }}>Modo de Límite</th>
                  <th style={{ padding: "14px 16px", color: theme.ink, fontWeight: 700 }}>Alias Checklist / Tareas</th>
                  <th style={{ padding: "14px 16px", color: theme.ink, fontWeight: 700 }}>Estado Actual</th>
                </tr>
              </thead>
              <tbody>
                {filteredConfigCollaborators.map((c) => {
                  const currentWip = colaboradoresCalculated.find((col) => col.nombre === c.nombre_completo)?.total || 0;
                  const isOverloaded = currentWip > c.wipl;
                  const isOptimal = currentWip > 0 && currentWip <= c.wipl;

                  return (
                    <tr
                      key={c.nombre_completo}
                      style={{
                        borderBottom: `1px solid ${theme.borderLight}`,
                        transition: "background 0.15s ease",
                      }}
                    >
                      {/* Nombre */}
                      <td style={{ padding: "14px 16px", fontWeight: 700, color: theme.ink }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "50%",
                              background: theme.canvas,
                              border: `1px solid ${theme.border}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "11px",
                              fontWeight: 700,
                              color: theme.ink,
                            }}
                          >
                            {c.nombre_completo.charAt(0)}
                          </div>
                          <span>{c.nombre_completo}</span>
                        </div>
                      </td>

                      {/* Área */}
                      <td style={{ padding: "14px 16px", color: theme.inkMuted }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: "#f1f5f9",
                            fontSize: "11px",
                            fontWeight: 600,
                          }}
                        >
                          {c.area || "General"}
                        </span>
                      </td>

                      {/* Control WIPL */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => updateCollaboratorWipl(c.nombre_completo, (prev) => prev - 1)}
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "6px",
                              border: `1px solid ${theme.border}`,
                              background: theme.white,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              color: theme.ink,
                            }}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={c.wipl}
                            onChange={(e) => updateCollaboratorWipl(c.nombre_completo, parseInt(e.target.value) || 1)}
                            style={{
                              width: "50px",
                              textAlign: "center",
                              padding: "4px 6px",
                              border: `1px solid ${theme.border}`,
                              borderRadius: "6px",
                              fontWeight: 700,
                              fontSize: "13px",
                              color: theme.ink,
                              outline: "none",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => updateCollaboratorWipl(c.nombre_completo, (prev) => prev + 1)}
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "6px",
                              border: `1px solid ${theme.border}`,
                              background: theme.white,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              color: theme.ink,
                            }}
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Modo (Manual vs Dinámico) */}
                      <td style={{ padding: "14px 16px" }}>
                        <select
                          value={c.modo}
                          onChange={(e) => {
                            const newModo = e.target.value as "manual" | "dinamico";
                            setUserConfigs((prev) => ({
                              ...prev,
                              [c.nombre_completo]: { ...c, modo: newModo },
                            }));
                          }}
                          style={{
                            padding: "5px 8px",
                            border: `1px solid ${theme.border}`,
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 600,
                            color: theme.ink,
                            background: theme.white,
                            cursor: "pointer",
                          }}
                        >
                          <option value="manual">Manual ({c.wipl})</option>
                          <option value="dinamico">Dinámico (Throughput)</option>
                        </select>
                      </td>

                      {/* Alias de Checklist */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                          {c.alias.map((al) => (
                            <span
                              key={al}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                background: "#f8fafc",
                                border: `1px solid #cbd5e1`,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                color: theme.ink,
                              }}
                            >
                              <code>({al})</code>
                              <X
                                size={11}
                                style={{ cursor: "pointer", color: theme.subtle }}
                                onClick={() => removeAlias(c.nombre_completo, al)}
                              />
                            </span>
                          ))}

                          <div style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                            <input
                              type="text"
                              placeholder="+ alias..."
                              value={newAliasInputs[c.nombre_completo] || ""}
                              onChange={(e) =>
                                setNewAliasInputs((prev) => ({ ...prev, [c.nombre_completo]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") addAlias(c.nombre_completo);
                              }}
                              style={{
                                width: "65px",
                                padding: "2px 5px",
                                fontSize: "10px",
                                border: `1px solid ${theme.border}`,
                                borderRadius: "4px",
                                outline: "none",
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => addAlias(c.nombre_completo)}
                              style={{
                                background: theme.canvas,
                                border: `1px solid ${theme.border}`,
                                borderRadius: "4px",
                                padding: "2px 5px",
                                cursor: "pointer",
                                fontSize: "10px",
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Estado Actual */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 700, color: theme.ink }}>
                            {currentWip} / {c.wipl}
                          </span>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "10px",
                              fontSize: "10px",
                              fontWeight: 700,
                              background: isOverloaded ? theme.amberBg : isOptimal ? theme.tealBg : "#f1f5f9",
                              color: isOverloaded ? theme.amber : isOptimal ? theme.tealDark : theme.subtle,
                              border: `1px solid ${isOverloaded ? "#fde68a" : isOptimal ? "#bbf7d0" : "#e2e8f0"}`,
                            }}
                          >
                            {isOverloaded ? "Sobrecarga" : isOptimal ? "Óptimo" : "Disponible"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeSubView === "areas" ? (
        <AreasSubView
          tasks={filteredRows}
          onSelectArea={(area) => {
            setSelectedAreas(new Set([area]));
            setCurrentPage(1);
          }}
        />
      ) : activeSubView === "aplazamientos" ? (
        <AplazamientosSubView tasks={filteredRows} />
      ) : activeSubView === "huerfanas" ? (
        <HuerfanasSubView
          tasks={filteredRows}
          onSelectPlan={(plan) => {
            setSelectedPlanes(new Set([plan]));
            setCurrentPage(1);
          }}
        />
      ) : activeSubView === "historial" ? (
        <HistorialSubView tasks={filteredRows} throughputMap={apiData?.throughputMap} />
      ) : activeSubView === "macro" ? (
        <MacroSubView
          tasks={filteredRows}
          totalPlanes={apiData?.masterCatalog.planes.length || 0}
          totalColaboradores={apiData?.masterCatalog.users.length || 0}
        />
      ) : (
        /* ========================================================= */
        /* MODO 1: TABLERO DE CAPACIDAD & WIPL ANALÍTICO             */
        /* ========================================================= */
        <>
          {/* 2. Tarjetas KPI Principales */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "16px",
            }}
          >
            {/* Card 1: Trabajo en Proceso (WIP / Carga) */}
            <div
              style={{
                background: theme.white,
                borderRadius: "12px",
                padding: "20px",
                border: `1px solid ${theme.border}`,
                boxShadow: theme.shadowSm,
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: theme.subtle, textTransform: "uppercase" }}>
                  Trabajo en Proceso (WIP)
                </span>
                <div style={{ padding: "6px", borderRadius: "8px", background: "#f0fdf4", color: theme.teal }}>
                  <Layers size={18} />
                </div>
              </div>
              <div style={{ fontSize: "32px", fontWeight: 800, color: theme.ink, lineHeight: 1.1 }}>
                {kpis.totalAsignaciones.toLocaleString()}
              </div>
              <div style={{ fontSize: "12px", color: theme.inkMuted }}>
                {kpis.uniqueTasks.toLocaleString()} tareas únicas evaluadas
              </div>
            </div>

            {/* Card 2: Desempeño Día (Power BI 726abab735379dbd274a) */}
            <div
              style={{
                background: vencimientoMode === "coincidir_corte" ? theme.tealBg : theme.white,
                borderRadius: "12px",
                padding: "20px",
                border: `1px solid ${vencimientoMode === "coincidir_corte" ? theme.teal : theme.border}`,
                boxShadow: theme.shadowSm,
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onClick={() => {
                setVencimientoMode((prev) => (prev === "coincidir_corte" ? "todos" : "coincidir_corte"));
                setCurrentPage(1);
              }}
              title="Haz clic para filtrar solo las tareas que vencen el día del registro"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: theme.tealDark, textTransform: "uppercase" }}>
                    Desempeño Día
                  </span>
                  <span
                    style={{
                      fontSize: "9px",
                      padding: "1px 5px",
                      borderRadius: "6px",
                      background: vencimientoMode === "coincidir_corte" ? theme.teal : "#f1f5f9",
                      color: vencimientoMode === "coincidir_corte" ? "#fff" : theme.subtle,
                      fontWeight: 700,
                    }}
                  >
                    {vencimientoMode === "coincidir_corte" ? "FILTRADO" : "HOY"}
                  </span>
                </div>
                <div style={{ padding: "6px", borderRadius: "8px", background: "#fff7ed", color: theme.coral }}>
                  <TrendingUp size={18} />
                </div>
              </div>
              <div style={{ fontSize: "32px", fontWeight: 800, color: theme.ink, lineHeight: 1.1 }}>
                {kpis.desempenoDia}%
              </div>
              <div style={{ fontSize: "12px", color: theme.tealDark, fontWeight: 600 }}>
                {kpis.aTiempoDia} a tiempo / {kpis.totalDia} vencen el {apiData?.fechaCorte}
              </div>
            </div>

            {/* Card 3: Desempeño Total (Power BI 22151e8386508ef9d01f) */}
            <div
              style={{
                background: theme.white,
                borderRadius: "12px",
                padding: "20px",
                border: `1px solid ${theme.border}`,
                boxShadow: theme.shadowSm,
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: theme.subtle, textTransform: "uppercase" }}>
                  Desempeño Total
                </span>
                <div style={{ padding: "6px", borderRadius: "8px", background: "#f0fdf4", color: theme.teal }}>
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <div style={{ fontSize: "32px", fontWeight: 800, color: theme.ink, lineHeight: 1.1 }}>
                {kpis.desempenoTotal}%
              </div>
              <div style={{ fontSize: "12px", color: theme.tealDark, fontWeight: 600 }}>
                {kpis.aTiempo.toLocaleString()} a tiempo de {kpis.totalAsignaciones.toLocaleString()}
              </div>
            </div>

            {/* Card 4: Tareas Atrasadas */}
            <div
              style={{
                background: theme.white,
                borderRadius: "12px",
                padding: "20px",
                border: `1px solid ${kpis.pctAtraso > 40 ? "#fecdd3" : theme.border}`,
                boxShadow: theme.shadowSm,
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: theme.subtle, textTransform: "uppercase" }}>
                  Tareas Atrasadas
                </span>
                <div style={{ padding: "6px", borderRadius: "8px", background: theme.redBg, color: theme.red }}>
                  <AlertTriangle size={18} />
                </div>
              </div>
              <div style={{ fontSize: "32px", fontWeight: 800, color: theme.red, lineHeight: 1.1 }}>
                {kpis.atrasadas.toLocaleString()}
              </div>
              <div style={{ fontSize: "12px", color: theme.red, fontWeight: 600 }}>
                {kpis.pctAtraso}% de atraso en selección
              </div>
            </div>

            {/* Card 5: En Sobrecarga (> WIPL) */}
            <div
              style={{
                background: theme.white,
                borderRadius: "12px",
                padding: "20px",
                border: `1px solid ${kpis.sobrecargaCount > 0 ? "#fde68a" : theme.border}`,
                boxShadow: theme.shadowSm,
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: theme.subtle, textTransform: "uppercase" }}>
                  En Sobrecarga (&gt; WIPL)
                </span>
                <div style={{ padding: "6px", borderRadius: "8px", background: theme.amberBg, color: theme.amber }}>
                  <UserCheck size={18} />
                </div>
              </div>
              <div style={{ fontSize: "32px", fontWeight: 800, color: theme.amber, lineHeight: 1.1 }}>
                {kpis.sobrecargaCount}
              </div>
              <div style={{ fontSize: "12px", color: theme.inkMuted }}>
                De {kpis.personasCount} personas con tareas activas
              </div>
            </div>
          </div>

          {/* 3. Gráficos Principales: Demanda (WIP) vs Capacidad (WIPL) & Donut */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: "20px",
            }}
          >
            {/* Gráfico de Barras: WIP vs WIPL */}
            <div
              style={{
                background: theme.white,
                borderRadius: "14px",
                padding: "22px",
                border: `1px solid ${theme.border}`,
                boxShadow: theme.shadowSm,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: theme.ink }}>
                    Demanda (WIP) vs. Capacidad (WIPL) por Colaborador
                  </h3>
                  <p style={{ margin: "3px 0 0", fontSize: "12px", color: theme.subtle }}>
                    Haz clic en una barra para agregar/quitar al colaborador del filtro cruzado.
                  </p>
                </div>
              </div>

              <div style={{ height: "330px", width: "100%", marginTop: "6px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartColaboradores}
                    margin={{ top: 15, right: 20, left: -10, bottom: 45 }}
                    onClick={(state) => {
                      if (state && state.activePayload && state.activePayload.length > 0) {
                        const person = state.activePayload[0].payload.nombre;
                        toggleUser(person);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.borderLight} />
                    <XAxis
                      dataKey="nombreCorto"
                      stroke={theme.subtle}
                      fontSize={11}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      tick={{ fill: theme.inkMuted }}
                    />
                    <YAxis stroke={theme.subtle} fontSize={11} tick={{ fill: theme.inkMuted }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div
                              style={{
                                background: theme.ink,
                                color: theme.white,
                                padding: "10px 14px",
                                borderRadius: "8px",
                                fontSize: "12px",
                                boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
                              }}
                            >
                              <div style={{ fontWeight: 700, marginBottom: "4px" }}>{item.nombre}</div>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: "14px" }}>
                                <span>WIP Activo:</span>
                                <strong>{item.wip}</strong>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: "14px" }}>
                                <span>Límite WIPL:</span>
                                <strong>{item.wipl}</strong>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: "14px" }}>
                                <span>Atrasadas:</span>
                                <strong style={{ color: theme.coral }}>{item.atrasadas}</strong>
                              </div>
                              <div
                                style={{
                                  marginTop: "6px",
                                  paddingTop: "6px",
                                  borderTop: "1px solid rgba(255,255,255,0.15)",
                                  fontSize: "11px",
                                  color: item.esSobrecarga ? "#fcd34d" : "#6ee7b7",
                                  fontWeight: 600,
                                }}
                              >
                                {item.esSobrecarga ? "⚠️ Sobrecarga (> WIPL)" : "✓ En capacidad saludable"}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                    <Bar dataKey="wip" name="WIP Activo" fill={theme.teal} radius={[4, 4, 0, 0]}>
                      {chartColaboradores.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            selectedUsers.has(entry.nombre)
                              ? theme.coral
                              : entry.esSobrecarga
                              ? theme.amber
                              : theme.teal
                          }
                        />
                      ))}
                    </Bar>
                    <Bar dataKey="wipl" name="Límite WIPL" fill="#94a3b8" radius={[4, 4, 0, 0]} opacity={0.5} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Donut Chart: Cumplimiento General */}
            <div
              style={{
                background: theme.white,
                borderRadius: "14px",
                padding: "22px",
                border: `1px solid ${theme.border}`,
                boxShadow: theme.shadowSm,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: theme.ink }}>
                  Cumplimiento de Tareas
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: "12px", color: theme.subtle }}>
                  Proporción de tareas al día vs atrasadas.
                </p>
              </div>

              <div style={{ height: "260px", width: "100%", position: "relative" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`donut-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0];
                          return (
                            <div
                              style={{
                                background: theme.ink,
                                color: "#fff",
                                padding: "8px 12px",
                                borderRadius: "6px",
                                fontSize: "12px",
                              }}
                            >
                              <strong>{item.name}:</strong> {item.value?.toLocaleString()}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    textAlign: "center",
                    pointerEvents: "none",
                  }}
                >
                  <div style={{ fontSize: "28px", fontWeight: 800, color: theme.ink }}>
                    {kpis.desempenoDia}%
                  </div>
                  <div style={{ fontSize: "11px", color: theme.subtle, fontWeight: 600 }}>Al Día</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: theme.teal }} />
                  <span style={{ color: theme.inkMuted }}>A tiempo ({kpis.aTiempo})</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: theme.red }} />
                  <span style={{ color: theme.inkMuted }}>Atrasadas ({kpis.atrasadas})</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Tablas Cruzadas: Áreas y Planes */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
            }}
          >
            {/* Desglose por Área */}
            <div
              style={{
                background: theme.white,
                borderRadius: "14px",
                padding: "20px",
                border: `1px solid ${theme.border}`,
                boxShadow: theme.shadowSm,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: theme.ink }}>
                  Carga por Área ({areasList.length})
                </h3>
                <span style={{ fontSize: "11px", color: theme.subtle }}>Clic para filtrar</span>
              </div>

              <div style={{ maxHeight: "280px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                {areasList.map((a) => {
                  const isSelected = selectedAreas.has(a.area);
                  const pct = kpis.totalAsignaciones > 0 ? Math.round((a.total / kpis.totalAsignaciones) * 100) : 0;
                  return (
                    <div
                      key={a.area}
                      onClick={() => toggleArea(a.area)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        background: isSelected ? theme.tealBg : "#fbfcfd",
                        border: `1px solid ${isSelected ? theme.teal : theme.borderLight}`,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: isSelected ? theme.tealDark : theme.ink }}>
                          {a.area}
                        </span>
                        <span style={{ fontSize: "10px", color: theme.subtle }}>
                          {a.personasCount} colaboradores • {a.atrasadas} atrasadas
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: theme.ink }}>{a.total}</span>
                        <span style={{ fontSize: "11px", color: theme.subtle, width: "32px", textAlign: "right" }}>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Planes de Planner */}
            <div
              style={{
                background: theme.white,
                borderRadius: "14px",
                padding: "20px",
                border: `1px solid ${theme.border}`,
                boxShadow: theme.shadowSm,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: theme.ink }}>
                  Top Planes de Planner ({planesList.length})
                </h3>
                <span style={{ fontSize: "11px", color: theme.subtle }}>Clic para filtrar</span>
              </div>

              <div style={{ maxHeight: "280px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                {planesList.slice(0, 30).map((p) => {
                  const isSelected = selectedPlanes.has(p.plan);
                  return (
                    <div
                      key={p.plan}
                      onClick={() => togglePlan(p.plan)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        background: isSelected ? theme.tealBg : "#fbfcfd",
                        border: `1px solid ${isSelected ? theme.teal : theme.borderLight}`,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: isSelected ? theme.tealDark : theme.ink,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "280px",
                        }}
                      >
                        {p.plan}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        {p.atrasadas > 0 && (
                          <span style={{ fontSize: "10px", color: theme.red, fontWeight: 600 }}>
                            {p.atrasadas} atr.
                          </span>
                        )}
                        <span style={{ fontSize: "12px", fontWeight: 700, color: theme.ink }}>{p.total}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 5. Tabla Granular de Tareas con Paginación */}
          <div
            style={{
              background: theme.white,
              borderRadius: "14px",
              padding: "22px",
              border: `1px solid ${theme.border}`,
              boxShadow: theme.shadowSm,
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: theme.ink }}>
                  Detalle Granular de Tareas ({filteredRows.length.toLocaleString()})
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: theme.subtle }}>
                  Mostrando tareas activas bajo los filtros seleccionados.
                </p>
              </div>

              {/* Controles de Paginación */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                <span style={{ color: theme.inkMuted }}>
                  Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                </span>
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: `1px solid ${theme.border}`,
                    background: theme.white,
                    color: currentPage <= 1 ? theme.lightText : theme.ink,
                    cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: `1px solid ${theme.border}`,
                    background: theme.white,
                    color: currentPage >= totalPages ? theme.lightText : theme.ink,
                    cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}`, background: theme.canvas }}>
                    <th style={{ padding: "12px 14px", color: theme.subtle, fontWeight: 700, textTransform: "uppercase", fontSize: "10px" }}>Tarea</th>
                    <th style={{ padding: "12px 14px", color: theme.subtle, fontWeight: 700, textTransform: "uppercase", fontSize: "10px" }}>Colaborador</th>
                    <th style={{ padding: "12px 14px", color: theme.subtle, fontWeight: 700, textTransform: "uppercase", fontSize: "10px" }}>Área</th>
                    <th style={{ padding: "12px 14px", color: theme.subtle, fontWeight: 700, textTransform: "uppercase", fontSize: "10px" }}>Plan</th>
                    <th style={{ padding: "12px 14px", color: theme.subtle, fontWeight: 700, textTransform: "uppercase", fontSize: "10px" }}>Entrega</th>
                    <th style={{ padding: "12px 14px", color: theme.subtle, fontWeight: 700, textTransform: "uppercase", fontSize: "10px" }}>Días</th>
                    <th style={{ padding: "12px 14px", color: theme.subtle, fontWeight: 700, textTransform: "uppercase", fontSize: "10px" }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTasks.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "30px", textAlign: "center", color: theme.subtle }}>
                        No hay tareas que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    paginatedTasks.map((t) => (
                      <tr
                        key={`${t.id}-${t.task_id}`}
                        style={{
                          borderBottom: `1px solid ${theme.borderLight}`,
                          transition: "background 0.15s ease",
                        }}
                      >
                        <td style={{ padding: "12px 14px", fontWeight: 600, color: theme.ink, maxWidth: "340px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>{t.titulo_tarea}</span>
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px", color: theme.inkMuted, fontWeight: 500 }}>
                          <span
                            style={{ cursor: "pointer", textDecoration: "underline", textDecorationColor: "#cbd5e1" }}
                            onClick={() => toggleUser(t.assigned_user_name)}
                          >
                            {t.assigned_user_name}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span
                            onClick={() => toggleArea(t.area)}
                            style={{
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: selectedAreas.has(t.area) ? theme.coral : "#f1f5f9",
                              color: selectedAreas.has(t.area) ? "#fff" : theme.inkMuted,
                              fontSize: "11px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {t.area}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", color: theme.subtle, maxWidth: "180px" }}>
                          <span style={{ cursor: "pointer" }} onClick={() => togglePlan(t.titulo_plan)}>
                            {t.titulo_plan}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", color: theme.inkMuted, fontWeight: 500 }}>
                          {t.fecha_entrega ? new Date(t.fecha_entrega).toLocaleDateString("es-CO") : "Sin fecha"}
                        </td>
                        <td style={{ padding: "12px 14px", color: theme.subtle }}>
                          {t.dias_abierto} días
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span
                            style={{
                              padding: "3px 9px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: 700,
                              background: t.es_atrasado ? theme.redBg : theme.tealBg,
                              color: t.es_atrasado ? theme.red : theme.tealDark,
                              border: `1px solid ${t.es_atrasado ? "#fecdd3" : "#bbf7d0"}`,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            {t.es_atrasado ? (
                              <>
                                <AlertTriangle size={11} />
                                <span>Atrasada</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={11} />
                                <span>A tiempo</span>
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
