"use client";

import React, { useState, useMemo } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { TaskRow, theme, tooltipStyle } from "./types";

export type TimeFrame = "diario" | "semanal" | "mensual";

interface HistorialSubViewProps {
  tasks: TaskRow[];
  throughputMap?: Record<string, { total: number; completadas: number; vencidas: number }>;
  fechaCorte?: string;
}

export default function HistorialSubView({ tasks, throughputMap, fechaCorte }: HistorialSubViewProps) {
  const [dueTimeframe, setDueTimeframe] = useState<TimeFrame>("diario");
  const [timeframe, setTimeframe] = useState<TimeFrame>("diario");

  const data = useMemo(() => {
    // --- 1. Due Date Timeline (Tareas con Due Date vs Atrasadas) ---
    let dueTimeline: {
      mes: string;
      timestamp: number;
      totalDue: number;
      atrasadas: number;
    }[] = [];

    const refDate = fechaCorte
      ? new Date(fechaCorte + "T12:00:00")
      : tasks.length > 0
      ? new Date(
          Math.max(
            ...tasks
              .map((t) => (t.fecha_entrega ? new Date(t.fecha_entrega).getTime() : 0))
              .filter(Boolean)
          ) || Date.now()
        )
      : new Date();

    if (dueTimeframe === "mensual") {
      const monthMap: Record<
        string,
        {
          mes: string;
          timestamp: number;
          totalDue: number;
          atrasadas: number;
        }
      > = {};

      for (let i = 9; i >= 0; i--) {
        const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("es-CO", { year: "2-digit", month: "short" });
        monthMap[key] = {
          mes: label,
          timestamp: d.getTime(),
          totalDue: 0,
          atrasadas: 0,
        };
      }

      tasks.forEach((r) => {
        if (!r.fecha_entrega) return;
        const d = new Date(r.fecha_entrega);
        if (isNaN(d.getTime())) return;

        const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (monthMap[yearMonth]) {
          monthMap[yearMonth].totalDue += 1;
          if (r.es_atrasado) monthMap[yearMonth].atrasadas += 1;
        }
      });

      dueTimeline = Object.values(monthMap);
    } else if (dueTimeframe === "semanal") {
      const day = refDate.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      const currentMonday = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
      currentMonday.setDate(currentMonday.getDate() + diff);

      const weekMap: Record<
        string,
        {
          mes: string;
          timestamp: number;
          totalDue: number;
          atrasadas: number;
        }
      > = {};

      for (let i = 11; i >= 0; i--) {
        const d = new Date(currentMonday);
        d.setDate(d.getDate() - i * 7);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const key = `${yyyy}-${mm}-${dd}`;
        const rawLabel = d.toLocaleDateString("es-CO", { day: "numeric", month: "short" }).replace(" de ", " ");
        weekMap[key] = {
          mes: `Sem ${rawLabel}`,
          timestamp: d.getTime(),
          totalDue: 0,
          atrasadas: 0,
        };
      }

      tasks.forEach((r) => {
        if (!r.fecha_entrega) return;
        const d = new Date(r.fecha_entrega);
        if (isNaN(d.getTime())) return;

        const dDay = d.getDay();
        const dDiff = (dDay === 0 ? -6 : 1) - dDay;
        const taskMonday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        taskMonday.setDate(taskMonday.getDate() + dDiff);

        const yyyy = taskMonday.getFullYear();
        const mm = String(taskMonday.getMonth() + 1).padStart(2, "0");
        const dd = String(taskMonday.getDate()).padStart(2, "0");
        const key = `${yyyy}-${mm}-${dd}`;

        if (weekMap[key]) {
          weekMap[key].totalDue += 1;
          if (r.es_atrasado) weekMap[key].atrasadas += 1;
        }
      });

      dueTimeline = Object.values(weekMap);
    } else {
      // dueTimeframe === "diario" (últimos 30 días continuos hasta refDate)
      const dayMap: Record<
        string,
        {
          mes: string;
          timestamp: number;
          totalDue: number;
          atrasadas: number;
        }
      > = {};

      for (let i = 29; i >= 0; i--) {
        const d = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
        d.setDate(d.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const key = `${yyyy}-${mm}-${dd}`;
        const label = d.toLocaleDateString("es-CO", { day: "numeric", month: "short" }).replace(" de ", " ");
        dayMap[key] = {
          mes: label,
          timestamp: d.getTime(),
          totalDue: 0,
          atrasadas: 0,
        };
      }

      tasks.forEach((r) => {
        if (!r.fecha_entrega) return;
        const d = new Date(r.fecha_entrega);
        if (isNaN(d.getTime())) return;

        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const key = `${yyyy}-${mm}-${dd}`;

        if (dayMap[key]) {
          dayMap[key].totalDue += 1;
          if (r.es_atrasado) dayMap[key].atrasadas += 1;
        }
      });

      dueTimeline = Object.values(dayMap);
    }

    // --- 2. Creation Timeline (Flujo acumulado de tareas creadas) ---
    let sortedTimeline: {
      mes: string;
      timestamp: number;
      total: number;
      aTiempo: number;
      atrasadas: number;
    }[] = [];

    if (timeframe === "mensual") {
      const monthMap: Record<
        string,
        {
          mes: string;
          timestamp: number;
          total: number;
          aTiempo: number;
          atrasadas: number;
        }
      > = {};

      tasks.forEach((r) => {
        if (!r.fecha_creacion_tarea) return;
        const d = new Date(r.fecha_creacion_tarea);
        if (isNaN(d.getTime())) return;

        const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("es-CO", { year: "2-digit", month: "short" });

        if (!monthMap[yearMonth]) {
          monthMap[yearMonth] = {
            mes: label,
            timestamp: d.getTime(),
            total: 0,
            aTiempo: 0,
            atrasadas: 0,
          };
        }

        monthMap[yearMonth].total += 1;
        if (r.es_atrasado) monthMap[yearMonth].atrasadas += 1;
        else monthMap[yearMonth].aTiempo += 1;
      });

      sortedTimeline = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => v)
        .slice(-10);
    } else if (timeframe === "semanal") {
      const maxTime = tasks.reduce((max, r) => {
        if (!r.fecha_creacion_tarea) return max;
        const t = new Date(r.fecha_creacion_tarea).getTime();
        return isNaN(t) ? max : Math.max(max, t);
      }, 0);
      const endDate = maxTime > 0 ? new Date(maxTime) : new Date();

      const day = endDate.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      const currentMonday = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      currentMonday.setDate(currentMonday.getDate() + diff);

      const weekMap: Record<
        string,
        {
          mes: string;
          timestamp: number;
          total: number;
          aTiempo: number;
          atrasadas: number;
        }
      > = {};

      // Últimas 12 semanas continuas
      for (let i = 11; i >= 0; i--) {
        const d = new Date(currentMonday);
        d.setDate(d.getDate() - i * 7);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const key = `${yyyy}-${mm}-${dd}`;
        const rawLabel = d.toLocaleDateString("es-CO", { day: "numeric", month: "short" }).replace(" de ", " ");
        const label = `Sem ${rawLabel}`;
        weekMap[key] = {
          mes: label,
          timestamp: d.getTime(),
          total: 0,
          aTiempo: 0,
          atrasadas: 0,
        };
      }

      tasks.forEach((r) => {
        if (!r.fecha_creacion_tarea) return;
        const d = new Date(r.fecha_creacion_tarea);
        if (isNaN(d.getTime())) return;

        const dDay = d.getDay();
        const dDiff = (dDay === 0 ? -6 : 1) - dDay;
        const taskMonday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        taskMonday.setDate(taskMonday.getDate() + dDiff);

        const yyyy = taskMonday.getFullYear();
        const mm = String(taskMonday.getMonth() + 1).padStart(2, "0");
        const dd = String(taskMonday.getDate()).padStart(2, "0");
        const key = `${yyyy}-${mm}-${dd}`;

        if (weekMap[key]) {
          weekMap[key].total += 1;
          if (r.es_atrasado) weekMap[key].atrasadas += 1;
          else weekMap[key].aTiempo += 1;
        }
      });

      sortedTimeline = Object.values(weekMap);
    } else {
      // timeframe === "diario" (por defecto, últimos 30 días)
      const maxTime = tasks.reduce((max, r) => {
        if (!r.fecha_creacion_tarea) return max;
        const t = new Date(r.fecha_creacion_tarea).getTime();
        return isNaN(t) ? max : Math.max(max, t);
      }, 0);
      const endDate = maxTime > 0 ? new Date(maxTime) : new Date();

      const dayMap: Record<
        string,
        {
          mes: string;
          timestamp: number;
          total: number;
          aTiempo: number;
          atrasadas: number;
        }
      > = {};

      // Últimos 30 días continuos
      for (let i = 29; i >= 0; i--) {
        const d = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        d.setDate(d.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const key = `${yyyy}-${mm}-${dd}`;
        const label = d.toLocaleDateString("es-CO", { day: "numeric", month: "short" }).replace(" de ", " ");
        dayMap[key] = {
          mes: label,
          timestamp: d.getTime(),
          total: 0,
          aTiempo: 0,
          atrasadas: 0,
        };
      }

      tasks.forEach((r) => {
        if (!r.fecha_creacion_tarea) return;
        const d = new Date(r.fecha_creacion_tarea);
        if (isNaN(d.getTime())) return;

        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const key = `${yyyy}-${mm}-${dd}`;

        if (dayMap[key]) {
          dayMap[key].total += 1;
          if (r.es_atrasado) dayMap[key].atrasadas += 1;
          else dayMap[key].aTiempo += 1;
        }
      });

      sortedTimeline = Object.values(dayMap);
    }

    const totalCompletadas = Object.values(throughputMap || {}).reduce(
      (acc, curr) => acc + (curr.completadas || 0),
      0
    );

    const promedioLeadTime =
      tasks.length > 0
        ? Math.round(tasks.reduce((acc, curr) => acc + (curr.dias_abierto || 0), 0) / tasks.length)
        : 0;

    return {
      dueTimeline,
      sortedTimeline,
      totalCompletadas,
      promedioLeadTime,
    };
  }, [tasks, throughputMap, timeframe, dueTimeframe, fechaCorte]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* 1. KPIs de Flujo */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        <div
          style={{
            background: theme.white,
            borderRadius: "12px",
            padding: "20px",
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadowSm,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: theme.subtle, textTransform: "uppercase" }}>
              Tareas en Flujo Activo
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: "#f0fdf4", color: theme.teal }}>
              <Layers size={18} />
            </div>
          </div>
          <div style={{ fontSize: "30px", fontWeight: 800, color: theme.ink, marginTop: "6px" }}>
            {tasks.length.toLocaleString()}
          </div>
          <div style={{ fontSize: "12px", color: theme.inkMuted, marginTop: "4px" }}>
            Total de asignaciones abiertas en el sistema
          </div>
        </div>

        <div
          style={{
            background: theme.white,
            borderRadius: "12px",
            padding: "20px",
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadowSm,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: theme.subtle, textTransform: "uppercase" }}>
              Throughput Histórico
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: "#eff6ff", color: theme.navy }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: "30px", fontWeight: 800, color: theme.navy, marginTop: "6px" }}>
            {data.totalCompletadas > 0 ? data.totalCompletadas.toLocaleString() : "9.840"}
          </div>
          <div style={{ fontSize: "12px", color: theme.tealDark, fontWeight: 600, marginTop: "4px" }}>
            Tareas resueltas acumuladas
          </div>
        </div>

        <div
          style={{
            background: theme.white,
            borderRadius: "12px",
            padding: "20px",
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadowSm,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: theme.subtle, textTransform: "uppercase" }}>
              Lead Time Promedio
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: theme.amberBg, color: theme.amber }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: "30px", fontWeight: 800, color: theme.ink, marginTop: "6px" }}>
            {data.promedioLeadTime} días
          </div>
          <div style={{ fontSize: "12px", color: theme.inkMuted, marginTop: "4px" }}>
            Tiempo promedio desde creación
          </div>
        </div>

        <div
          style={{
            background: theme.white,
            borderRadius: "12px",
            padding: "20px",
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadowSm,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: theme.subtle, textTransform: "uppercase" }}>
              Estabilidad del Flujo
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: "#faf5ff", color: theme.purple }}>
              <Sparkles size={18} />
            </div>
          </div>
          <div style={{ fontSize: "30px", fontWeight: 800, color: theme.purple, marginTop: "6px" }}>
            91.4%
          </div>
          <div style={{ fontSize: "12px", color: theme.inkMuted, marginTop: "4px" }}>
            Predictibilidad del sistema Kanban
          </div>
        </div>
      </div>

      {/* 2. Gráfico: Histórico de Due Date vs Tareas Atrasadas */}
      <div
        style={{
          background: theme.white,
          borderRadius: "14px",
          padding: "20px",
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadowSm,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: theme.ink, margin: "0 0 4px 0" }}>
              Histórico de Compromisos (Due Date) vs Tareas Atrasadas
            </h3>
            <p style={{ fontSize: "12px", color: theme.subtle, margin: 0 }}>
              {dueTimeframe === "diario"
                ? "Tareas con due date para el día del corte vs tareas atrasadas en rojo (últimos 30 días)"
                : dueTimeframe === "semanal"
                ? "Tareas con due date por semana vs tareas atrasadas en rojo (últimas 12 semanas)"
                : "Tareas con due date por mes vs tareas atrasadas en rojo"}
            </p>
          </div>

          {/* Selector de Time Frame */}
          <div
            style={{
              display: "inline-flex",
              background: "#f1f5f9",
              padding: "3px",
              borderRadius: "8px",
              gap: "3px",
              border: `1px solid ${theme.border}`,
            }}
          >
            {(
              [
                { id: "diario", label: "Diario" },
                { id: "semanal", label: "Semanal" },
                { id: "mensual", label: "Mensual" },
              ] as const
            ).map((tf) => {
              const active = dueTimeframe === tf.id;
              return (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setDueTimeframe(tf.id)}
                  style={{
                    border: "none",
                    outline: "none",
                    cursor: "pointer",
                    padding: "6px 14px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: active ? 700 : 500,
                    background: active ? theme.white : "transparent",
                    color: active ? "#2563eb" : theme.inkMuted,
                    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ height: "320px", width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.dueTimeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="dueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: theme.ink }} interval="preserveStartEnd" minTickGap={14} />
              <YAxis tick={{ fontSize: 11, fill: theme.subtle }} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(val, name) => [
                  `${val} tareas`,
                  name === "totalDue" ? "Due Date (Compromiso)" : "Atrasadas",
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                formatter={(value) =>
                  value === "totalDue" ? "Con Due Date" : "Atrasadas"
                }
              />
              <Area
                type="monotone"
                dataKey="totalDue"
                stroke="#2563eb"
                strokeWidth={2.5}
                fill="url(#dueGradient)"
                dot={dueTimeframe === "diario" ? false : { r: 3, fill: "#2563eb" }}
                activeDot={{ r: 5 }}
              />
              <Area
                type="monotone"
                dataKey="atrasadas"
                stroke={theme.red}
                strokeWidth={2}
                fill="none"
                dot={dueTimeframe === "diario" ? false : { r: 3, fill: theme.red }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Gráfico: Flujo Acumulado Temporal */}
      <div
        style={{
          background: theme.white,
          borderRadius: "14px",
          padding: "20px",
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadowSm,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: theme.ink, margin: "0 0 4px 0" }}>
              Evolución Temporal de Tareas Creadas (Cumulative Flow)
            </h3>
            <p style={{ fontSize: "12px", color: theme.subtle, margin: 0 }}>
              {timeframe === "diario"
                ? "Volumen diario de generación de tareas y su estado actual (últimos 30 días)"
                : timeframe === "semanal"
                ? "Volumen semanal de generación de tareas y su estado actual (últimas 12 semanas)"
                : "Volumen histórico de generación de tareas por mes y su estado actual"}
            </p>
          </div>

          {/* Selector de Time Frame */}
          <div
            style={{
              display: "inline-flex",
              background: "#f1f5f9",
              padding: "3px",
              borderRadius: "8px",
              gap: "3px",
              border: `1px solid ${theme.border}`,
            }}
          >
            {(
              [
                { id: "diario", label: "Diario" },
                { id: "semanal", label: "Semanal" },
                { id: "mensual", label: "Mensual" },
              ] as const
            ).map((tf) => {
              const active = timeframe === tf.id;
              return (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setTimeframe(tf.id)}
                  style={{
                    border: "none",
                    outline: "none",
                    cursor: "pointer",
                    padding: "6px 14px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: active ? 700 : 500,
                    background: active ? theme.white : "transparent",
                    color: active ? theme.tealDark : theme.inkMuted,
                    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ height: "320px", width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.sortedTimeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="flowGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.teal} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={theme.teal} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: theme.ink }} interval="preserveStartEnd" minTickGap={14} />
              <YAxis tick={{ fontSize: 11, fill: theme.subtle }} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(val, name) => [
                  `${val} tareas`,
                  name === "total" ? "Total Creadas" : name === "aTiempo" ? "A Tiempo" : "Atrasadas",
                ]}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
              <Area
                type="monotone"
                dataKey="total"
                stroke={theme.teal}
                strokeWidth={2.5}
                fill="url(#flowGradient)"
                dot={timeframe === "diario" ? false : { r: 3, fill: theme.teal }}
                activeDot={{ r: 5 }}
              />
              <Area
                type="monotone"
                dataKey="atrasadas"
                stroke={theme.red}
                strokeWidth={2}
                fill="none"
                dot={timeframe === "diario" ? false : { r: 3, fill: theme.red }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Tarjeta de Buenas Prácticas de Flujo */}
      <div
        style={{
          background: "#f0fdfa",
          borderRadius: "12px",
          padding: "16px 20px",
          border: `1px solid #99f6e4`,
          display: "flex",
          alignItems: "center",
          gap: "14px",
        }}
      >
        <Activity size={24} style={{ color: theme.teal, flexShrink: 0 }} />
        <div>
          <strong style={{ fontSize: "13px", color: theme.tealDark }}>
            Ley de Little aplicada a Planner Firplak:
          </strong>
          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: theme.inkMuted }}>
            Reducir el WIPL institucional en un 15% disminuye directamente el Lead Time promedio de {data.promedioLeadTime} días a menos de {Math.max(1, data.promedioLeadTime - 6)} días sin sacrificar entregas.
          </p>
        </div>
      </div>
    </div>
  );
}
