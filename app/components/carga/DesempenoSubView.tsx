"use client";

import React, { useState, useMemo } from "react";
import {
  Award,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  Sliders,
  Search,
  Filter,
  Info,
  ChevronDown,
  ChevronUp,
  X,
  ArrowUpDown,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TaskRow, theme, tooltipStyle } from "./types";

interface DesempenoSubViewProps {
  tasks: TaskRow[];
  fechaCorte: string;
  allAreas?: string[];
  totalSnapshotTasks?: number;
  onClearFilters?: () => void;
  onSelectPerson?: (nombre: string) => void;
}

interface ColaboradorScore {
  nombre: string;
  area: string;
  totalTareas: number;
  venceHoy: number;
  pctHoy: number;
  atrasadasCriticas: number;
  pctAtrasadas: number;
  zombies60d: number;
  pctZombies: number;
  sinFecha: number;
  penAtraso: number;
  penHoy: number;
  penZombie: number;
  penSinFecha: number;
  scoreCalidad: number;
  factorVolumen: number;
  score: number;
  nivel: "Excelente" | "Bueno" | "Regular" | "Crítico";
  cumpleMeta: boolean;
  tareas: TaskRow[];
}

export default function DesempenoSubView({
  tasks,
  fechaCorte,
  allAreas = [],
  totalSnapshotTasks,
  onClearFilters,
  onSelectPerson,
}: DesempenoSubViewProps) {
  // 1. Parámetros de medición configurables (editables en caliente)
  const [diasGraciaAtraso, setDiasGraciaAtraso] = useState<number>(2);
  const [diasUmbralZombie, setDiasUmbralZombie] = useState<number>(60);
  const [pctMaxHoyTolerado, setPctMaxHoyTolerado] = useState<number>(25); // %
  const [metaScore, setMetaScore] = useState<number>(80);
  const [umbralVolumen, setUmbralVolumen] = useState<number>(5); // Tareas mínimas para representatividad plena (100%)
  const [minTareasFilter, setMinTareasFilter] = useState<number>(1); // Filtro: 1, 3, o 5 tareas mínimas
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);

  // 2. Filtros
  const [selectedArea, setSelectedArea] = useState<string>("todas");
  const [searchUser, setSearchUser] = useState<string>("");
  const [nivelFilter, setNivelFilter] = useState<string>("todos");
  const [sortBy, setSortBy] = useState<"score_desc" | "score_asc" | "tareas_desc" | "atrasadas_desc" | "zombies_desc" | "hoy_desc">("score_desc");

  // 3. Modal de Auditoría individual
  const [activeCollaboratorModal, setActiveCollaboratorModal] = useState<ColaboradorScore | null>(null);
  const [modalTaskFilter, setModalTaskFilter] = useState<"todas" | "hoy" | "atrasadas" | "zombies" | "sinFecha">("todas");

  // Restablecer parámetros a valores sugeridos
  const resetParams = () => {
    setDiasGraciaAtraso(2);
    setDiasUmbralZombie(60);
    setPctMaxHoyTolerado(25);
    setMetaScore(80);
    setUmbralVolumen(5);
    setMinTareasFilter(1);
  };

  // Cálculo del Score de Gestión por persona
  const scoresData = useMemo(() => {
    const userMap: Record<string, { nombre: string; area: string; tareas: TaskRow[] }> = {};

    tasks.forEach((t) => {
      if (!t.assigned_user_name || t.assigned_user_name === "Sin asignar") return;
      if (t.percent_complete >= 100) return; // Solo tareas activas

      const u = t.assigned_user_name;
      if (!userMap[u]) {
        userMap[u] = {
          nombre: u,
          area: t.area || "Sin área",
          tareas: [],
        };
      }
      userMap[u].tareas.push(t);
    });

    const parsedDate = fechaCorte ? new Date(fechaCorte) : new Date();

    const list: ColaboradorScore[] = Object.values(userMap).map((item) => {
      const total = item.tareas.length;
      let venceHoy = 0;
      let atrasadasCriticas = 0;
      let zombies60d = 0;
      let sinFecha = 0;

      item.tareas.forEach((t) => {
        if (!t.fecha_entrega) {
          sinFecha++;
        } else {
          const dueDateStr = t.fecha_entrega.slice(0, 10);
          if (dueDateStr === fechaCorte) {
            venceHoy++;
          } else if (dueDateStr < fechaCorte) {
            const dueDate = new Date(dueDateStr);
            const diffDays = Math.floor((parsedDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > diasGraciaAtraso) {
              atrasadasCriticas++;
            }
          }
        }

        if ((t.dias_abierto || 0) > diasUmbralZombie) {
          zombies60d++;
        }
      });

      const pctHoy = total > 0 ? (venceHoy / total) * 100 : 0;
      const pctAtrasadas = total > 0 ? (atrasadasCriticas / total) * 100 : 0;
      const pctZombies = total > 0 ? (zombies60d / total) * 100 : 0;

      // Penalizaciones calculadas
      // 1. Atrasadas críticas (> 2d): hasta 40 pts
      const penAtraso = Math.min(40, Math.round((pctAtrasadas / 100) * 50 * 10) / 10);
      // 2. Agolpamiento hoy (> umbral tolerado): hasta 25 pts
      const penHoy =
        pctHoy > pctMaxHoyTolerado
          ? Math.min(25, Math.round(((pctHoy - pctMaxHoyTolerado) / 100) * 50 * 10) / 10)
          : 0;
      // 3. Tareas Zombies (> 60 días abiertas): 5 pts por tarea hasta 25 pts
      const penZombie = Math.min(25, zombies60d * 5);
      // 4. Tareas sin fecha asignada: 2 pts por tarea hasta 10 pts
      const penSinFecha = Math.min(10, sinFecha * 2);

      // 1. Score de Calidad (Base 100 - deducciones)
      const rawScoreCalidad = 100 - penAtraso - penHoy - penZombie - penSinFecha;
      const scoreCalidad = Math.max(0, Math.min(100, Math.round(rawScoreCalidad * 10) / 10));

      // 2. Factor de Volumen / Representatividad:
      // Modula el score si la persona tiene pocas tareas para que personas sin trabajo no lideren el ranking
      const factorVolumen = umbralVolumen > 0 ? Math.min(1, total / umbralVolumen) : 1;
      const scoreEfectivo = Math.max(0, Math.min(100, Math.round(scoreCalidad * factorVolumen * 10) / 10));

      let nivel: "Excelente" | "Bueno" | "Regular" | "Crítico" = "Crítico";
      if (scoreEfectivo >= 90) nivel = "Excelente";
      else if (scoreEfectivo >= 80) nivel = "Bueno";
      else if (scoreEfectivo >= 65) nivel = "Regular";

      return {
        nombre: item.nombre,
        area: item.area,
        totalTareas: total,
        venceHoy,
        pctHoy: Math.round(pctHoy * 10) / 10,
        atrasadasCriticas,
        pctAtrasadas: Math.round(pctAtrasadas * 10) / 10,
        zombies60d,
        pctZombies: Math.round(pctZombies * 10) / 10,
        sinFecha,
        penAtraso,
        penHoy,
        penZombie,
        penSinFecha,
        scoreCalidad,
        factorVolumen: Math.round(factorVolumen * 100),
        score: scoreEfectivo,
        nivel,
        cumpleMeta: scoreEfectivo >= metaScore,
        tareas: item.tareas,
      };
    });

    return list;
  }, [tasks, fechaCorte, diasGraciaAtraso, diasUmbralZombie, pctMaxHoyTolerado, metaScore, umbralVolumen]);

  // Lista de áreas únicas presentes
  const availableAreas = useMemo(() => {
    if (allAreas && allAreas.length > 0) return allAreas;
    const set = new Set<string>();
    scoresData.forEach((s) => {
      if (s.area && s.area !== "Sin área") set.add(s.area);
    });
    return Array.from(set).sort();
  }, [allAreas, scoresData]);

  // Datos filtrados y ordenados
  const filteredScores = useMemo(() => {
    let result = [...scoresData];

    if (selectedArea !== "todas") {
      result = result.filter((r) => r.area === selectedArea);
    }

    if (searchUser.trim()) {
      const q = searchUser.toLowerCase();
      result = result.filter((r) => r.nombre.toLowerCase().includes(q));
    }

    if (minTareasFilter > 1) {
      result = result.filter((r) => r.totalTareas >= minTareasFilter);
    }

    if (nivelFilter !== "todos") {
      if (nivelFilter === "cumple") {
        result = result.filter((r) => r.cumpleMeta);
      } else if (nivelFilter === "nocumple") {
        result = result.filter((r) => !r.cumpleMeta);
      } else {
        result = result.filter((r) => r.nivel.toLowerCase() === nivelFilter.toLowerCase());
      }
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "score_desc":
          return b.score - a.score;
        case "score_asc":
          return a.score - b.score;
        case "tareas_desc":
          return b.totalTareas - a.totalTareas;
        case "atrasadas_desc":
          return b.atrasadasCriticas - a.atrasadasCriticas;
        case "zombies_desc":
          return b.zombies60d - a.zombies60d;
        case "hoy_desc":
          return b.venceHoy - a.venceHoy;
        default:
          return b.score - a.score;
      }
    });

    return result;
  }, [scoresData, selectedArea, searchUser, nivelFilter, sortBy, minTareasFilter]);

  // Estadísticas globales de la compañía (o área seleccionada)
  const globalKpis = useMemo(() => {
    const list = selectedArea === "todas" ? scoresData : scoresData.filter((r) => r.area === selectedArea);
    if (list.length === 0) {
      return {
        totalPersonas: 0,
        promedioScore: 0,
        cumplenMetaCount: 0,
        pctCumplimiento: 0,
        totalZombies: 0,
        totalAtrasadas: 0,
        totalHoy: 0,
        distribucion: { excelente: 0, bueno: 0, regular: 0, critico: 0 },
      };
    }

    const totalPersonas = list.length;
    const sumaScore = list.reduce((acc, c) => acc + c.score, 0);
    const promedioScore = Math.round((sumaScore / totalPersonas) * 10) / 10;
    const cumplenMetaCount = list.filter((c) => c.cumpleMeta).length;
    const pctCumplimiento = Math.round((cumplenMetaCount / totalPersonas) * 100);

    const totalZombies = list.reduce((acc, c) => acc + c.zombies60d, 0);
    const totalAtrasadas = list.reduce((acc, c) => acc + c.atrasadasCriticas, 0);
    const totalHoy = list.reduce((acc, c) => acc + c.venceHoy, 0);

    const dist = { excelente: 0, bueno: 0, regular: 0, critico: 0 };
    list.forEach((c) => {
      if (c.nivel === "Excelente") dist.excelente++;
      else if (c.nivel === "Bueno") dist.bueno++;
      else if (c.nivel === "Regular") dist.regular++;
      else dist.critico++;
    });

    return {
      totalPersonas,
      promedioScore,
      cumplenMetaCount,
      pctCumplimiento,
      totalZombies,
      totalAtrasadas,
      totalHoy,
      distribucion: dist,
    };
  }, [scoresData, selectedArea]);

  // Datos para gráfico de distribución Donut
  const donutData = useMemo(() => {
    const d = globalKpis.distribucion;
    return [
      { name: "Excelente (90-100)", value: d.excelente, color: "#0c7c78" },
      { name: "Bueno (80-89)", value: d.bueno, color: "#0f9f9a" },
      { name: "Regular (65-79)", value: d.regular, color: "#f59e0b" },
      { name: "Crítico (<65)", value: d.critico, color: "#ef4444" },
    ].filter((item) => item.value > 0);
  }, [globalKpis]);

  // Datos para gráfico comparativo (Top 16 colaboradores con más carga/visibilidad)
  const barChartData = useMemo(() => {
    return filteredScores.slice(0, 16).map((c) => ({
      nombre: c.nombre.length > 18 ? c.nombre.slice(0, 16) + "..." : c.nombre,
      nombreCompleto: c.nombre,
      score: c.score,
      scoreCalidad: c.scoreCalidad,
      totalTareas: c.totalTareas,
      factorVolumen: c.factorVolumen,
      meta: metaScore,
      atrasadas: c.atrasadasCriticas,
      zombies: c.zombies60d,
      hoy: c.venceHoy,
    }));
  }, [filteredScores, metaScore]);

  // Resumen de tareas para el modal de auditoría
  const modalTasks = useMemo(() => {
    if (!activeCollaboratorModal) return [];
    const all = activeCollaboratorModal.tareas;
    const parsedDate = new Date(fechaCorte);

    return all.filter((t) => {
      if (modalTaskFilter === "todas") return true;
      if (modalTaskFilter === "sinFecha") return !t.fecha_entrega;
      if (modalTaskFilter === "zombies") return (t.dias_abierto || 0) > diasUmbralZombie;

      if (!t.fecha_entrega) return false;
      const due = t.fecha_entrega.slice(0, 10);
      if (modalTaskFilter === "hoy") return due === fechaCorte;
      if (modalTaskFilter === "atrasadas") {
        if (due >= fechaCorte) return false;
        const diffDays = Math.floor((parsedDate.getTime() - new Date(due).getTime()) / (1000 * 60 * 60 * 24));
        return diffDays > diasGraciaAtraso;
      }
      return true;
    });
  }, [activeCollaboratorModal, modalTaskFilter, fechaCorte, diasGraciaAtraso, diasUmbralZombie]);

  // Helpers de color para semáforo
  const getScoreColor = (score: number) => {
    if (score >= 90) return { text: "#0c7c78", bg: "#ecfdf5", border: "#a7f3d0" };
    if (score >= metaScore) return { text: "#0f9f9a", bg: "#f0fdfa", border: "#99f6e4" };
    if (score >= 65) return { text: "#b45309", bg: "#fffbeb", border: "#fde68a" };
    return { text: "#b91c1c", bg: "#fef2f2", border: "#fecaca" };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER Y CONTROLES DE CONFIGURACIÓN
      ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: theme.white,
          borderRadius: "14px",
          padding: "20px 24px",
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadowSm,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #0f9f9a 0%, #123552 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
            >
              <Award size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: theme.ink }}>
                Desempeño & Score de Gestión Diaria
              </h2>
              <p style={{ margin: 0, fontSize: "13px", color: theme.subtle }}>
                Evaluación diaria del comportamiento de backlog, plazos y procrastinación en Planner • Corte:{" "}
                <strong>{fechaCorte}</strong>
              </p>
              {Boolean(totalSnapshotTasks && tasks.length < totalSnapshotTasks) && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "3px 10px",
                    borderRadius: "14px",
                    background: theme.tealBg,
                    border: `1px solid ${theme.teal}`,
                    color: theme.tealDark,
                    fontSize: "12px",
                    fontWeight: 600,
                    marginTop: "6px",
                  }}
                >
                  <Filter size={12} />
                  <span>
                    Filtros superiores aplicados: evaluando <strong>{tasks.length}</strong> de{" "}
                    <strong>{totalSnapshotTasks}</strong> tareas
                  </span>
                  {onClearFilters && (
                    <button
                      onClick={onClearFilters}
                      style={{
                        marginLeft: "6px",
                        background: "transparent",
                        border: "none",
                        color: theme.tealDark,
                        fontWeight: 700,
                        cursor: "pointer",
                        textDecoration: "underline",
                        fontSize: "11px",
                      }}
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Botón Ver Fórmula */}
          <button
            onClick={() => setShowFormulaModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              border: `1px solid ${theme.border}`,
              background: "#fff",
              color: theme.ink,
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Info size={15} color={theme.teal} />
            <span>Fórmula & Reglas</span>
          </button>

          {/* Botón Configuración de Parámetros */}
          <button
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              border: `1px solid ${showConfigPanel ? theme.teal : theme.border}`,
              background: showConfigPanel ? theme.tealBg : "#fff",
              color: showConfigPanel ? theme.tealDark : theme.ink,
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Sliders size={15} />
            <span>Parámetros de Medición</span>
            {showConfigPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. PANEL DESPLEGABLE: PARÁMETROS CONFIGURABLES
      ───────────────────────────────────────────────────────────── */}
      {showConfigPanel && (
        <div
          style={{
            background: "#f0fdfa",
            borderRadius: "12px",
            padding: "18px 22px",
            border: `1px solid #99f6e4`,
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Zap size={16} color={theme.tealDark} />
              <span style={{ fontWeight: 700, fontSize: "14px", color: theme.tealDark }}>
                Simulación en Caliente de Criterios de Gestión
              </span>
              <span style={{ fontSize: "12px", color: theme.subtle }}>
                (Ajusta los umbrales para recalcular instantáneamente el score de toda la compañía)
              </span>
            </div>
            <button
              onClick={resetParams}
              style={{
                fontSize: "12px",
                color: theme.inkMuted,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Restablecer valores predeterminados
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "14px",
            }}
          >
            {/* 1. Días de Gracia */}
            <div style={{ background: "#fff", padding: "12px 14px", borderRadius: "8px", border: `1px solid ${theme.border}` }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: theme.ink, display: "block", marginBottom: "4px" }}>
                1. Días de gracia atraso (tolerados)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="range"
                  min="0"
                  max="7"
                  value={diasGraciaAtraso}
                  onChange={(e) => setDiasGraciaAtraso(Number(e.target.value))}
                  style={{ flex: 1, accentColor: theme.teal }}
                />
                <span style={{ fontWeight: 800, color: theme.tealDark, minWidth: "32px", textAlign: "right" }}>
                  +{diasGraciaAtraso}d
                </span>
              </div>
              <span style={{ fontSize: "11px", color: theme.subtle }}>
                Atrasos mayores a {diasGraciaAtraso} días se penalizan severamente.
              </span>
            </div>

            {/* 2. Umbral Tareas Zombies */}
            <div style={{ background: "#fff", padding: "12px 14px", borderRadius: "8px", border: `1px solid ${theme.border}` }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: theme.ink, display: "block", marginBottom: "4px" }}>
                2. Umbral Tareas Zombie (Procrastinación)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="range"
                  min="15"
                  max="120"
                  step="5"
                  value={diasUmbralZombie}
                  onChange={(e) => setDiasUmbralZombie(Number(e.target.value))}
                  style={{ flex: 1, accentColor: theme.coral }}
                />
                <span style={{ fontWeight: 800, color: theme.coral, minWidth: "40px", textAlign: "right" }}>
                  {diasUmbralZombie}d
                </span>
              </div>
              <span style={{ fontSize: "11px", color: theme.subtle }}>
                Tareas abiertas más de {diasUmbralZombie} días restan 5 pts cada una.
              </span>
            </div>

            {/* 3. Tolerancia Hoy */}
            <div style={{ background: "#fff", padding: "12px 14px", borderRadius: "8px", border: `1px solid ${theme.border}` }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: theme.ink, display: "block", marginBottom: "4px" }}>
                3. Tolerancia % Vencimiento Hoy
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="range"
                  min="10"
                  max="50"
                  step="5"
                  value={pctMaxHoyTolerado}
                  onChange={(e) => setPctMaxHoyTolerado(Number(e.target.value))}
                  style={{ flex: 1, accentColor: theme.purple }}
                />
                <span style={{ fontWeight: 800, color: theme.purple, minWidth: "35px", textAlign: "right" }}>
                  {pctMaxHoyTolerado}%
                </span>
              </div>
              <span style={{ fontSize: "11px", color: theme.subtle }}>
                Si más del {pctMaxHoyTolerado}% vence hoy, se penaliza por agolpamiento.
              </span>
            </div>

            {/* 4. Meta de Gestión */}
            <div style={{ background: "#fff", padding: "12px 14px", borderRadius: "8px", border: `1px solid ${theme.border}` }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: theme.ink, display: "block", marginBottom: "4px" }}>
                4. Meta Score Mínimo
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="range"
                  min="60"
                  max="95"
                  step="5"
                  value={metaScore}
                  onChange={(e) => setMetaScore(Number(e.target.value))}
                  style={{ flex: 1, accentColor: theme.ink }}
                />
                <span style={{ fontWeight: 800, color: theme.ink, minWidth: "35px", textAlign: "right" }}>
                  {metaScore} pts
                </span>
              </div>
              <span style={{ fontSize: "11px", color: theme.subtle }}>
                Calificación mínima para considerar buena gestión.
              </span>
            </div>

            {/* 5. Umbral de Volumen Representativo (Relación Carga vs Score) */}
            <div style={{ background: "#fff", padding: "12px 14px", borderRadius: "8px", border: `1px solid ${theme.border}` }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: theme.ink, display: "block", marginBottom: "4px" }}>
                5. Umbral Carga Representativa
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={umbralVolumen}
                  onChange={(e) => setUmbralVolumen(Number(e.target.value))}
                  style={{ flex: 1, accentColor: theme.teal }}
                />
                <span style={{ fontWeight: 800, color: theme.tealDark, minWidth: "40px", textAlign: "right" }}>
                  {umbralVolumen} tareas
                </span>
              </div>
              <span style={{ fontSize: "11px", color: theme.subtle }}>
                Modula el score si alguien tiene &lt; {umbralVolumen} tareas para que personas sin carga no lideren.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. TARJETAS DE KPIS GLOBALES (EMPRESA / ÁREA)
      ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "14px",
        }}
      >
        {/* Card 1: Score Promedio */}
        <div
          style={{
            background: theme.white,
            borderRadius: "12px",
            padding: "16px 20px",
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadowSm,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: "12px", fontWeight: 700, color: theme.subtle, textTransform: "uppercase" }}>
                Score Promedio {selectedArea !== "todas" ? `(${selectedArea})` : "Compañía"}
              </span>
              <div style={{ fontSize: "32px", fontWeight: 800, color: getScoreColor(globalKpis.promedioScore).text, marginTop: "4px" }}>
                {globalKpis.promedioScore}{" "}
                <span style={{ fontSize: "16px", fontWeight: 600, color: theme.inkMuted }}>/ 100</span>
              </div>
            </div>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: getScoreColor(globalKpis.promedioScore).bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${getScoreColor(globalKpis.promedioScore).border}`,
              }}
            >
              <Award size={20} color={getScoreColor(globalKpis.promedioScore).text} />
            </div>
          </div>
          <div style={{ marginTop: "10px", fontSize: "12px", color: theme.inkMuted }}>
            Meta fijada: <strong>{metaScore} pts</strong> •{" "}
            {globalKpis.promedioScore >= metaScore ? (
              <span style={{ color: "#0c7c78", fontWeight: 700 }}>✓ En meta saludable</span>
            ) : (
              <span style={{ color: "#e11d48", fontWeight: 700 }}>⚠️ Por debajo de la meta</span>
            )}
          </div>
        </div>

        {/* Card 2: % Cumplimiento de Meta */}
        <div
          style={{
            background: theme.white,
            borderRadius: "12px",
            padding: "16px 20px",
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadowSm,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: "12px", fontWeight: 700, color: theme.subtle, textTransform: "uppercase" }}>
                Cumplen la Meta (≥ {metaScore} pts)
              </span>
              <div style={{ fontSize: "32px", fontWeight: 800, color: theme.ink, marginTop: "4px" }}>
                {globalKpis.pctCumplimiento}%
              </div>
            </div>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: theme.tealBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid #a7f3d0`,
              }}
            >
              <CheckCircle2 size={20} color={theme.tealDark} />
            </div>
          </div>
          <div style={{ marginTop: "10px", fontSize: "12px", color: theme.inkMuted }}>
            <strong>{globalKpis.cumplenMetaCount}</strong> de <strong>{globalKpis.totalPersonas}</strong> personas evaluadas
          </div>
        </div>

        {/* Card 3: Tareas Atrasadas Críticas (>2d) */}
        <div
          style={{
            background: theme.white,
            borderRadius: "12px",
            padding: "16px 20px",
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadowSm,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: "12px", fontWeight: 700, color: theme.subtle, textTransform: "uppercase" }}>
                Atrasadas Críticas (&gt; {diasGraciaAtraso}d)
              </span>
              <div style={{ fontSize: "32px", fontWeight: 800, color: "#e11d48", marginTop: "4px" }}>
                {globalKpis.totalAtrasadas}
              </div>
            </div>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: "#fef2f2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid #fecaca`,
              }}
            >
              <AlertTriangle size={20} color="#e11d48" />
            </div>
          </div>
          <div style={{ marginTop: "10px", fontSize: "12px", color: theme.inkMuted }}>
            Tareas que superaron los días de gracia permitidos
          </div>
        </div>

        {/* Card 4: Tareas Zombie (>60d) */}
        <div
          style={{
            background: theme.white,
            borderRadius: "12px",
            padding: "16px 20px",
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadowSm,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: "12px", fontWeight: 700, color: theme.subtle, textTransform: "uppercase" }}>
                Tareas Zombie (&gt; {diasUmbralZombie}d)
              </span>
              <div style={{ fontSize: "32px", fontWeight: 800, color: theme.coral, marginTop: "4px" }}>
                {globalKpis.totalZombies}
              </div>
            </div>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: "#fff7ed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid #fed7aa`,
              }}
            >
              <Clock size={20} color={theme.coral} />
            </div>
          </div>
          <div style={{ marginTop: "10px", fontSize: "12px", color: theme.inkMuted }}>
            Detectan procrastinación o falta de cierre/higiene
          </div>
        </div>

        {/* Card 5: Vencen Hoy */}
        <div
          style={{
            background: theme.white,
            borderRadius: "12px",
            padding: "16px 20px",
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadowSm,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: "12px", fontWeight: 700, color: theme.subtle, textTransform: "uppercase" }}>
                Vencen el Mismo Día
              </span>
              <div style={{ fontSize: "32px", fontWeight: 800, color: theme.purple, marginTop: "4px" }}>
                {globalKpis.totalHoy}
              </div>
            </div>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: theme.purpleBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid #e9d5ff`,
              }}
            >
              <Calendar size={20} color={theme.purple} />
            </div>
          </div>
          <div style={{ marginTop: "10px", fontSize: "12px", color: theme.inkMuted }}>
            Riesgo de agolpamiento o aplazamiento en bloque
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. GRÁFICOS: COMPARATIVO TOP/BOTTOM Y DONUT DE NIVELES
      ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
          gap: "20px",
        }}
      >
        {/* Gráfico 1: Barras de Colaboradores vs Score */}
        <div
          style={{
            background: theme.white,
            borderRadius: "14px",
            padding: "20px 24px",
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadowSm,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: theme.ink }}>
                Ranking de Score de Gestión vs Meta ({metaScore} pts)
              </h3>
              <span style={{ fontSize: "12px", color: theme.subtle }}>
                Muestra los colaboradores según el ordenamiento actual
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
              <span style={{ display: "inline-block", width: "12px", height: "12px", background: theme.teal, borderRadius: "2px" }} />
              <span style={{ color: theme.inkMuted }}>Score</span>
              <span style={{ display: "inline-block", width: "12px", height: "2px", background: "#ef4444" }} />
              <span style={{ color: theme.inkMuted }}>Meta ({metaScore})</span>
            </div>
          </div>

          <div style={{ height: "300px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="nombre"
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                  tick={{ fontSize: 11, fill: theme.inkMuted }}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: theme.inkMuted }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val: unknown) => [`${String(val)} pts`, "Score de Gestión"]}
                  labelFormatter={(l) => {
                    const found = barChartData.find((b) => b.nombre === l);
                    return found?.nombreCompleto || String(l);
                  }}
                />
                <ReferenceLine y={metaScore} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={2} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {barChartData.map((entry, index) => {
                    const color = entry.score >= metaScore ? theme.teal : entry.score >= 65 ? "#f59e0b" : "#ef4444";
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Distribución Donut de Niveles de Gestión */}
        <div
          style={{
            background: theme.white,
            borderRadius: "14px",
            padding: "20px 24px",
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadowSm,
          }}
        >
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: theme.ink }}>
              Distribución de la Empresa por Nivel de Gestión
            </h3>
            <span style={{ fontSize: "12px", color: theme.subtle }}>
              Clasificación según los estándares y penalizaciones fijadas
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", height: "300px" }}>
            <div style={{ width: "220px", height: "220px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutData.map((entry, idx) => (
                      <Cell key={`donut-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {donutData.map((item, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: item.color }} />
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: theme.ink }}>
                      {item.value} personas
                    </div>
                    <div style={{ fontSize: "11px", color: theme.subtle }}>{item.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. BARRA DE FILTROS PARA AUDITORÍA
      ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: theme.white,
          borderRadius: "14px",
          padding: "16px 20px",
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadowSm,
          display: "flex",
          flexWrap: "wrap",
          gap: "14px",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
          {/* Buscador de personas */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#f8fafc",
              border: `1px solid ${theme.border}`,
              borderRadius: "8px",
              padding: "6px 12px",
              width: "240px",
            }}
          >
            <Search size={16} color={theme.subtle} />
            <input
              type="text"
              placeholder="Buscar colaborador..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: "13px",
                color: theme.ink,
                width: "100%",
              }}
            />
            {searchUser && (
              <X size={14} color={theme.subtle} style={{ cursor: "pointer" }} onClick={() => setSearchUser("")} />
            )}
          </div>

          {/* Filtro de Área */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: theme.inkMuted }}>Área:</span>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              style={{
                fontSize: "13px",
                padding: "6px 10px",
                borderRadius: "8px",
                border: `1px solid ${theme.border}`,
                background: "#fff",
                color: theme.ink,
                outline: "none",
                fontWeight: 600,
              }}
            >
              <option value="todas">Todas las áreas ({availableAreas.length})</option>
              {availableAreas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Nivel */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: theme.inkMuted }}>Estado:</span>
            <select
              value={nivelFilter}
              onChange={(e) => setNivelFilter(e.target.value)}
              style={{
                fontSize: "13px",
                padding: "6px 10px",
                borderRadius: "8px",
                border: `1px solid ${theme.border}`,
                background: "#fff",
                color: theme.ink,
                outline: "none",
                fontWeight: 600,
              }}
            >
              <option value="todos">Todos los estados</option>
              <option value="cumple">Cumplen meta (≥ {metaScore})</option>
              <option value="nocumple">No cumplen meta (&lt; {metaScore})</option>
              <option value="excelente">Excelente (90-100)</option>
              <option value="bueno">Bueno (80-89)</option>
              <option value="regular">Regular (65-79)</option>
              <option value="critico">Crítico (&lt; 65)</option>
            </select>
          </div>

          {/* Filtro de Carga Mínima (Excluir personas sin trabajo) */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: theme.inkMuted }}>Carga:</span>
            <select
              value={minTareasFilter}
              onChange={(e) => setMinTareasFilter(Number(e.target.value))}
              style={{
                fontSize: "13px",
                padding: "6px 10px",
                borderRadius: "8px",
                border: `1px solid ${theme.border}`,
                background: "#fff",
                color: theme.ink,
                outline: "none",
                fontWeight: 600,
              }}
            >
              <option value="1">Todas (≥ 1 tarea)</option>
              <option value="3">Representativa (≥ 3 tareas)</option>
              <option value="5">Carga estándar (≥ 5 tareas)</option>
              <option value="10">Alta carga (≥ 10 tareas)</option>
            </select>
          </div>
        </div>

        {/* Ordenamiento */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ArrowUpDown size={15} color={theme.subtle} />
          <span style={{ fontSize: "12px", fontWeight: 700, color: theme.inkMuted }}>Ordenar:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "score_desc" | "score_asc" | "tareas_desc" | "atrasadas_desc" | "zombies_desc" | "hoy_desc")}
            style={{
              fontSize: "13px",
              padding: "6px 10px",
              borderRadius: "8px",
              border: `1px solid ${theme.border}`,
              background: "#fff",
              color: theme.ink,
              outline: "none",
              fontWeight: 600,
            }}
          >
            <option value="score_desc">Mayor Score (Mejores)</option>
            <option value="score_asc">Menor Score (Críticos)</option>
            <option value="tareas_desc">Más Tareas Activas</option>
            <option value="atrasadas_desc">Más Atrasadas Críticas (&gt;{diasGraciaAtraso}d)</option>
            <option value="zombies_desc">Más Tareas Zombie (&gt;{diasUmbralZombie}d)</option>
            <option value="hoy_desc">Más Tareas para Hoy</option>
          </select>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          6. TABLA DETALLADA DE DESEMPEÑO POR COLABORADOR
      ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: theme.white,
          borderRadius: "14px",
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadowSm,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${theme.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: theme.ink }}>
              Evaluación Individual de Gestión ({filteredScores.length} personas)
            </h3>
            <span style={{ fontSize: "12px", color: theme.subtle }}>
              Haz clic en cualquier persona para abrir la auditoría con el desglose exacto de sus tareas
            </span>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: `1px solid ${theme.border}` }}>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: theme.ink }}>Colaborador / Área</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: theme.ink, textAlign: "center" }}>
                  Score Ranking (Ponderado)
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: theme.inkMuted, textAlign: "center" }}>
                  Calidad Base
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: theme.ink, textAlign: "center" }}>
                  Carga Activa
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: theme.ink, textAlign: "center" }}>
                  Meta ({metaScore})
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "#e11d48", textAlign: "center" }}>
                  Atraso &gt;{diasGraciaAtraso}d (Max -40)
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: theme.purple, textAlign: "center" }}>
                  Vence Hoy (Max -25)
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: theme.coral, textAlign: "center" }}>
                  Zombies &gt;{diasUmbralZombie}d (Max -25)
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: theme.subtle, textAlign: "center" }}>
                  Sin Fecha (Max -10)
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: theme.ink, textAlign: "center" }}>
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredScores.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: "40px", textAlign: "center", color: theme.subtle }}>
                    No se encontraron colaboradores con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredScores.map((c) => {
                  const colors = getScoreColor(c.score);
                  return (
                    <tr
                      key={c.nombre}
                      onClick={() => setActiveCollaboratorModal(c)}
                      style={{
                        borderBottom: `1px solid ${theme.borderLight}`,
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Nombre y Área */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "50%",
                              background: colors.bg,
                              color: colors.text,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: "12px",
                              border: `1px solid ${colors.border}`,
                            }}
                          >
                            {c.nombre.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: theme.ink }}>{c.nombre}</div>
                            <div style={{ fontSize: "11px", color: theme.subtle }}>{c.area}</div>
                          </div>
                        </div>
                      </td>

                      {/* Score Ranking Badge (Ponderado) */}
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 12px",
                            borderRadius: "12px",
                            fontSize: "13px",
                            fontWeight: 800,
                            background: colors.bg,
                            color: colors.text,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          {c.score} / 100
                        </span>
                      </td>

                      {/* Calidad Base */}
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span style={{ fontWeight: 700, color: theme.inkMuted, fontSize: "12px" }}>
                          {c.scoreCalidad} pts
                        </span>
                      </td>

                      {/* Tareas Activas / Representatividad */}
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <div style={{ fontWeight: 800, color: theme.ink, fontSize: "14px" }}>
                          {c.totalTareas}
                        </div>
                        <span
                          style={{
                            display: "inline-block",
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            background: c.factorVolumen >= 100 ? theme.tealBg : "#fffbeb",
                            color: c.factorVolumen >= 100 ? theme.tealDark : "#b45309",
                            border: `1px solid ${c.factorVolumen >= 100 ? "#a7f3d0" : "#fde68a"}`,
                            marginTop: "2px",
                          }}
                        >
                          {c.factorVolumen >= 100 ? "✓ Carga plena" : `${c.factorVolumen}% volumen`}
                        </span>
                      </td>

                      {/* Cumple Meta */}
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        {c.cumpleMeta ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: theme.tealBg,
                              color: theme.tealDark,
                              fontSize: "11px",
                              fontWeight: 700,
                            }}
                          >
                            <CheckCircle2 size={13} /> Cumple
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: "#fef2f2",
                              color: "#b91c1c",
                              fontSize: "11px",
                              fontWeight: 700,
                            }}
                          >
                            <AlertTriangle size={13} /> No cumple
                          </span>
                        )}
                      </td>

                      {/* Atraso >2d */}
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <div style={{ fontWeight: 700, color: c.atrasadasCriticas > 0 ? "#e11d48" : theme.inkMuted }}>
                          {c.atrasadasCriticas}{" "}
                          <span style={{ fontSize: "11px", fontWeight: 500, color: theme.subtle }}>
                            ({c.pctAtrasadas}%)
                          </span>
                        </div>
                        {c.penAtraso > 0 && (
                          <div style={{ fontSize: "11px", color: "#e11d48", fontWeight: 600 }}>
                            -{c.penAtraso} pts
                          </div>
                        )}
                      </td>

                      {/* Vence Hoy */}
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <div style={{ fontWeight: 700, color: c.venceHoy > 0 ? theme.purple : theme.inkMuted }}>
                          {c.venceHoy}{" "}
                          <span style={{ fontSize: "11px", fontWeight: 500, color: theme.subtle }}>
                            ({c.pctHoy}%)
                          </span>
                        </div>
                        {c.penHoy > 0 ? (
                          <div style={{ fontSize: "11px", color: theme.purple, fontWeight: 600 }}>
                            -{c.penHoy} pts
                          </div>
                        ) : (
                          <span style={{ fontSize: "10px", color: theme.tealDark }}>✓ Tolerado</span>
                        )}
                      </td>

                      {/* Zombies >60d */}
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <div style={{ fontWeight: 700, color: c.zombies60d > 0 ? theme.coral : theme.inkMuted }}>
                          {c.zombies60d}
                        </div>
                        {c.penZombie > 0 && (
                          <div style={{ fontSize: "11px", color: theme.coral, fontWeight: 600 }}>
                            -{c.penZombie} pts
                          </div>
                        )}
                      </td>

                      {/* Sin Fecha */}
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <div style={{ fontWeight: 700, color: c.sinFecha > 0 ? theme.amber : theme.inkMuted }}>
                          {c.sinFecha}
                        </div>
                        {c.penSinFecha > 0 && (
                          <div style={{ fontSize: "11px", color: theme.amber, fontWeight: 600 }}>
                            -{c.penSinFecha} pts
                          </div>
                        )}
                      </td>

                      {/* Acción */}
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveCollaboratorModal(c);
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            border: `1px solid ${theme.border}`,
                            background: "#fff",
                            color: theme.ink,
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Auditar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          7. MODAL DE AUDITORÍA DETALLADA DE TAREAS POR PERSONA
      ───────────────────────────────────────────────────────────── */}
      {activeCollaboratorModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(18, 53, 82, 0.45)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setActiveCollaboratorModal(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "850px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: `1px solid ${theme.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background: getScoreColor(activeCollaboratorModal.score).bg,
                    color: getScoreColor(activeCollaboratorModal.score).text,
                    border: `1px solid ${getScoreColor(activeCollaboratorModal.score).border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: "16px",
                  }}
                >
                  {activeCollaboratorModal.score}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: theme.ink }}>
                    {activeCollaboratorModal.nombre}
                  </h3>
                  <span style={{ fontSize: "12px", color: theme.subtle }}>
                    Área: <strong>{activeCollaboratorModal.area}</strong> • Carga:{" "}
                    <strong>{activeCollaboratorModal.totalTareas} tareas</strong> • Calidad base:{" "}
                    <strong>{activeCollaboratorModal.scoreCalidad} pts</strong> • Representatividad:{" "}
                    <strong>{activeCollaboratorModal.factorVolumen}%</strong>
                  </span>
                </div>
              </div>

              <button
                onClick={() => setActiveCollaboratorModal(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: theme.subtle,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Desglose de Deducciones */}
            <div
              style={{
                padding: "14px 24px",
                background: "#f0fdfa",
                borderBottom: "1px solid #ccfbf1",
                display: "flex",
                flexWrap: "wrap",
                gap: "16px",
                fontSize: "12px",
              }}
            >
              <div>
                <strong>Score Ranking:</strong>{" "}
                <span style={{ color: theme.tealDark, fontWeight: 800 }}>
                  {activeCollaboratorModal.score} pts
                </span>{" "}
                ({activeCollaboratorModal.scoreCalidad} calidad × {activeCollaboratorModal.factorVolumen}% volumen)
              </div>
              <div>
                <strong>Atraso &gt;{diasGraciaAtraso}d:</strong>{" "}
                <span style={{ color: "#e11d48", fontWeight: 700 }}>
                  -{activeCollaboratorModal.penAtraso} pts
                </span>{" "}
                ({activeCollaboratorModal.atrasadasCriticas} tareas)
              </div>
              <div>
                <strong>Agolpamiento Hoy:</strong>{" "}
                <span style={{ color: theme.purple, fontWeight: 700 }}>
                  -{activeCollaboratorModal.penHoy} pts
                </span>{" "}
                ({activeCollaboratorModal.venceHoy} tareas)
              </div>
              <div>
                <strong>Zombies &gt;{diasUmbralZombie}d:</strong>{" "}
                <span style={{ color: theme.coral, fontWeight: 700 }}>
                  -{activeCollaboratorModal.penZombie} pts
                </span>{" "}
                ({activeCollaboratorModal.zombies60d} tareas)
              </div>
              <div>
                <strong>Sin Fecha:</strong>{" "}
                <span style={{ color: theme.amber, fontWeight: 700 }}>
                  -{activeCollaboratorModal.penSinFecha} pts
                </span>{" "}
                ({activeCollaboratorModal.sinFecha} tareas)
              </div>
            </div>

            {/* Tabs de Filtro de Tareas */}
            <div
              style={{
                display: "flex",
                borderBottom: `1px solid ${theme.border}`,
                padding: "0 24px",
                background: "#fff",
                gap: "16px",
              }}
            >
              {[
                { id: "todas" as const, label: `Todas (${activeCollaboratorModal.totalTareas})` },
                { id: "atrasadas" as const, label: `Atrasadas >${diasGraciaAtraso}d (${activeCollaboratorModal.atrasadasCriticas})` },
                { id: "hoy" as const, label: `Vence Hoy (${activeCollaboratorModal.venceHoy})` },
                { id: "zombies" as const, label: `Zombies >${diasUmbralZombie}d (${activeCollaboratorModal.zombies60d})` },
                { id: "sinFecha" as const, label: `Sin Fecha (${activeCollaboratorModal.sinFecha})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setModalTaskFilter(tab.id)}
                  style={{
                    padding: "12px 0",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: modalTaskFilter === tab.id ? 700 : 500,
                    color: modalTaskFilter === tab.id ? theme.tealDark : theme.subtle,
                    borderBottom: `2px solid ${modalTaskFilter === tab.id ? theme.teal : "transparent"}`,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Lista de Tareas */}
            <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
              {modalTasks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: theme.subtle }}>
                  No hay tareas en esta categoría.
                </div>
              ) : (
                modalTasks.map((t) => (
                  <div
                    key={t.id || t.task_id}
                    style={{
                      padding: "12px 16px",
                      borderRadius: "8px",
                      border: `1px solid ${theme.borderLight}`,
                      background: "#f8fafc",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: theme.ink, fontSize: "13px", marginBottom: "4px" }}>
                        {t.titulo_tarea}
                      </div>
                      <div style={{ fontSize: "11px", color: theme.subtle, display: "flex", gap: "12px" }}>
                        <span>Plan: <strong>{t.titulo_plan || "Sin plan"}</strong></span>
                        <span>Bucket: <strong>{t.titulo_bucket || "General"}</strong></span>
                        <span>Abierta hace: <strong>{t.dias_abierto || 0} días</strong></span>
                      </div>
                    </div>

                    <div style={{ textAlign: "right", minWidth: "140px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: theme.ink }}>
                        {t.fecha_entrega ? t.fecha_entrega.slice(0, 10) : "Sin fecha"}
                      </div>
                      <div style={{ fontSize: "11px" }}>
                        {t.fecha_entrega && t.fecha_entrega.slice(0, 10) === fechaCorte && (
                          <span style={{ color: theme.purple, fontWeight: 700 }}>Vence Hoy</span>
                        )}
                        {t.fecha_entrega && t.fecha_entrega.slice(0, 10) < fechaCorte && (
                          <span style={{ color: "#e11d48", fontWeight: 700 }}>Atrasada</span>
                        )}
                        {(t.dias_abierto || 0) > diasUmbralZombie && (
                          <span style={{ color: theme.coral, fontWeight: 700, marginLeft: "4px" }}>🧟 Zombie</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Modal */}
            <div
              style={{
                padding: "14px 24px",
                borderTop: `1px solid ${theme.border}`,
                background: "#f8fafc",
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              {onSelectPerson && (
                <button
                  onClick={() => {
                    onSelectPerson(activeCollaboratorModal.nombre);
                    setActiveCollaboratorModal(null);
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    background: theme.tealBg,
                    color: theme.tealDark,
                    border: `1px solid ${theme.teal}`,
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Ver en Tablero Kanban
                </button>
              )}
              <button
                onClick={() => setActiveCollaboratorModal(null)}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  background: theme.ink,
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Cerrar Auditoría
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          8. MODAL DE EXPLICACIÓN DE LA FÓRMULA DE MEDICIÒN
      ───────────────────────────────────────────────────────────── */}
      {showFormulaModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(18, 53, 82, 0.45)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setShowFormulaModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "680px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              padding: "24px 28px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Info size={20} color={theme.tealDark} />
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: theme.ink }}>
                  Metodología del Score Diario de Gestión Firplak
                </h3>
              </div>
              <button
                onClick={() => setShowFormulaModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: theme.subtle }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: "13px", color: theme.inkMuted, lineHeight: 1.5 }}>
              El Score evalúa si cada persona mantiene una planificación proactiva y un backlog sano. Parte de una base de <strong>100 puntos</strong> y resta según las siguientes desviaciones:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
              <div style={{ padding: "10px 14px", background: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca" }}>
                <strong style={{ color: "#b91c1c" }}>1. Tareas Atrasadas Críticas (&gt; {diasGraciaAtraso} días de atraso) — Hasta -40 pts:</strong>
                <p style={{ margin: "4px 0 0 0", color: theme.inkMuted }}>
                  Se permite 1 a {diasGraciaAtraso} días de atraso como margen operacional normal. Retrasos mayores se penalizan en proporción al % de su carga activa atrasada.
                </p>
              </div>

              <div style={{ padding: "10px 14px", background: "#f3e8ff", borderRadius: "8px", border: "1px solid #e9d5ff" }}>
                <strong style={{ color: "#7e22ce" }}>2. Agolpamiento para Hoy (&gt; {pctMaxHoyTolerado}% de su carga) — Hasta -25 pts:</strong>
                <p style={{ margin: "4px 0 0 0", color: theme.inkMuted }}>
                  Tener la mayoría de tareas programadas para el mismo día evidencia falta de anticipación o aplazamiento masivo para salir del paso.
                </p>
              </div>

              <div style={{ padding: "10px 14px", background: "#fff7ed", borderRadius: "8px", border: "1px solid #fed7aa" }}>
                <strong style={{ color: "#c2410c" }}>3. Tareas Zombie / Procrastinación (&gt; {diasUmbralZombie} días abiertas) — Hasta -25 pts:</strong>
                <p style={{ margin: "4px 0 0 0", color: theme.inkMuted }}>
                  Cada tarea abierta más de {diasUmbralZombie} días resta 5 puntos directos. Mide desidia en cerrar o archivar actividades obsoletas.
                </p>
              </div>

              <div style={{ padding: "10px 14px", background: "#fffbeb", borderRadius: "8px", border: "1px solid #fef3c7" }}>
                <strong style={{ color: "#b45309" }}>4. Tareas Sin Fecha Asignada — Hasta -10 pts:</strong>
                <p style={{ margin: "4px 0 0 0", color: theme.inkMuted }}>
                  Resta 2 puntos por tarea sin fecha para evitar evasión de plazos.
                </p>
              </div>

              <div style={{ padding: "10px 14px", background: "#f0fdfa", borderRadius: "8px", border: "1px solid #99f6e4" }}>
                <strong style={{ color: theme.tealDark }}>5. Relación Carga vs Score (Representatividad por Volumen):</strong>
                <p style={{ margin: "4px 0 0 0", color: theme.inkMuted }}>
                  Evita que personas con 1 o 2 tareas lideren el ranking de la compañía con 100 pts ficticios.
                  El Score de Ranking pondera la calidad según el volumen activo:
                  <br />
                  <code>Score Ranking = Score Calidad × min(1.0, Tareas / {umbralVolumen})</code>. Quienes gestionan {umbralVolumen} o más tareas tienen representatividad plena (100%).
                </p>
              </div>
            </div>

            <div style={{ padding: "12px 16px", background: theme.tealBg, borderRadius: "8px", border: "1px solid #a7f3d0", fontSize: "13px" }}>
              <strong style={{ color: theme.tealDark }}>Meta de la Organización: ≥ {metaScore} puntos</strong> (Semáforo Verde).
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowFormulaModal(false)}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  background: theme.ink,
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
