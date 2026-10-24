"use client";

import React, { useMemo } from "react";
import {
  Clock,
  AlertTriangle,
  Calendar,
  Hourglass,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TaskRow, theme, tooltipStyle } from "./types";

interface AplazamientosSubViewProps {
  tasks: TaskRow[];
}

export default function AplazamientosSubView({ tasks }: AplazamientosSubViewProps) {
  const data = useMemo(() => {
    const buckets = {
      "0 a 7 días": 0,
      "8 a 15 días": 0,
      "16 a 30 días": 0,
      "31 a 60 días": 0,
      "> 60 días": 0,
    };

    let totalDias = 0;
    let maxDias = 0;
    let masDe30Dias = 0;

    tasks.forEach((r) => {
      const dias = r.dias_abierto || 0;
      totalDias += dias;
      if (dias > maxDias) maxDias = dias;
      if (dias > 30) masDe30Dias += 1;

      if (dias <= 7) buckets["0 a 7 días"] += 1;
      else if (dias <= 15) buckets["8 a 15 días"] += 1;
      else if (dias <= 30) buckets["16 a 30 días"] += 1;
      else if (dias <= 60) buckets["31 a 60 días"] += 1;
      else buckets["> 60 días"] += 1;
    });

    const promedioDias = tasks.length > 0 ? Math.round(totalDias / tasks.length) : 0;
    const pctMasDe30 = tasks.length > 0 ? Math.round((masDe30Dias / tasks.length) * 100) : 0;

    const agingChartData = Object.entries(buckets).map(([rango, cantidad]) => ({
      rango,
      cantidad,
      porcentaje: tasks.length > 0 ? Math.round((cantidad / tasks.length) * 100) : 0,
    }));

    const oldestTasks = [...tasks]
      .sort((a, b) => (b.dias_abierto || 0) - (a.dias_abierto || 0))
      .slice(0, 15);

    const atrasadasCount = tasks.filter((t) => t.es_atrasado).length;
    const aTiempoCount = tasks.length - atrasadasCount;

    return {
      promedioDias,
      maxDias,
      masDe30Dias,
      pctMasDe30,
      agingChartData,
      oldestTasks,
      atrasadasCount,
      aTiempoCount,
    };
  }, [tasks]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* 1. KPIs de Aplazamientos y Envejecimiento */}
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
              Permanencia Promedio
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: "#f0fdf4", color: theme.teal }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: "30px", fontWeight: 800, color: theme.ink, marginTop: "6px" }}>
            {data.promedioDias} días
          </div>
          <div style={{ fontSize: "12px", color: theme.inkMuted, marginTop: "4px" }}>
            Tiempo promedio de apertura de tareas
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
              Tarea Más Antigua
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: theme.redBg, color: theme.red }}>
              <Hourglass size={18} />
            </div>
          </div>
          <div style={{ fontSize: "30px", fontWeight: 800, color: theme.red, marginTop: "6px" }}>
            {data.maxDias} días
          </div>
          <div style={{ fontSize: "12px", color: theme.inkMuted, marginTop: "4px" }}>
            Mayor tiempo de ciclo registrado
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
              Envejecimiento Crítico
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: theme.amberBg, color: theme.amber }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: "30px", fontWeight: 800, color: theme.amber, marginTop: "6px" }}>
            {data.masDe30Dias.toLocaleString()}
          </div>
          <div style={{ fontSize: "12px", color: theme.inkMuted, marginTop: "4px" }}>
            Tareas con más de 30 días abiertas ({data.pctMasDe30}%)
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
              Total Atrasadas
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: theme.redBg, color: theme.red }}>
              <Calendar size={18} />
            </div>
          </div>
          <div style={{ fontSize: "30px", fontWeight: 800, color: theme.red, marginTop: "6px" }}>
            {data.atrasadasCount.toLocaleString()}
          </div>
          <div style={{ fontSize: "12px", color: theme.inkMuted, marginTop: "4px" }}>
            Con fecha compromiso vencida
          </div>
        </div>
      </div>

      {/* 2. Gráficos de Envejecimiento */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))",
          gap: "18px",
        }}
      >
        <div
          style={{
            background: theme.white,
            borderRadius: "14px",
            padding: "20px",
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadowSm,
          }}
        >
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: theme.ink, margin: "0 0 4px 0" }}>
            Histograma de Envejecimiento (Días Abierto)
          </h3>
          <p style={{ fontSize: "12px", color: theme.subtle, margin: "0 0 16px 0" }}>
            Distribución de tareas por bandas de días de permanencia
          </p>
          <div style={{ height: "280px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.agingChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="rango" tick={{ fontSize: 11, fill: theme.ink }} />
                <YAxis tick={{ fontSize: 11, fill: theme.subtle }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val) => [`${val} tareas`, "Cantidad"]}
                />
                <Bar dataKey="cantidad" fill={theme.coral} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          style={{
            background: theme.white,
            borderRadius: "14px",
            padding: "20px",
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadowSm,
          }}
        >
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: theme.ink, margin: "0 0 4px 0" }}>
            Proporción de Vencimiento de Compromisos
          </h3>
          <p style={{ fontSize: "12px", color: theme.subtle, margin: "0 0 16px 0" }}>
            Tareas vigentes vs tareas con fecha pactada superada
          </p>
          <div style={{ height: "280px", width: "100%", display: "flex", alignItems: "center" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "A Tiempo / Vigentes", value: data.aTiempoCount, fill: theme.teal },
                    { name: "Atrasadas / Vencidas", value: data.atrasadasCount, fill: theme.red },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={3}
                  label={({ name, percent }) => `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%`}
                >
                  <Cell fill={theme.teal} />
                  <Cell fill={theme.red} />
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`${val} tareas`, "Total"]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Tabla de Tareas Más Longevas */}
      <div
        style={{
          background: theme.white,
          borderRadius: "14px",
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadowSm,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${theme.border}` }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: theme.ink, margin: 0 }}>
            Top Tareas Más Longevas / En Riesgo
          </h3>
          <span style={{ fontSize: "12px", color: theme.subtle }}>
            Tareas que concentran la mayor cantidad de días abiertas
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: theme.canvas, borderBottom: `1px solid ${theme.border}` }}>
                <th style={{ padding: "12px 16px", textAlign: "left", color: theme.subtle, fontWeight: 700 }}>TAREA</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: theme.subtle, fontWeight: 700 }}>PLAN</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: theme.subtle, fontWeight: 700 }}>RESPONSABLE</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: theme.subtle, fontWeight: 700 }}>ÁREA</th>
                <th style={{ padding: "12px 16px", textAlign: "right", color: theme.subtle, fontWeight: 700 }}>DÍAS ABIERTA</th>
                <th style={{ padding: "12px 16px", textAlign: "center", color: theme.subtle, fontWeight: 700 }}>FECHA LÍMITE</th>
                <th style={{ padding: "12px 16px", textAlign: "center", color: theme.subtle, fontWeight: 700 }}>ESTADO</th>
              </tr>
            </thead>
            <tbody>
              {data.oldestTasks.map((t) => (
                <tr
                  key={t.id}
                  style={{ borderBottom: `1px solid ${theme.borderLight}`, transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: theme.ink, maxWidth: "260px" }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.titulo_tarea}>
                      {t.titulo_tarea}
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", color: theme.subtle, maxWidth: "180px" }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.titulo_plan}>
                      {t.titulo_plan}
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", color: theme.inkMuted, fontWeight: 600 }}>
                    {t.assigned_user_name || "Sin asignar"}
                  </td>
                  <td style={{ padding: "14px 16px", color: theme.subtle }}>
                    {t.area || "Sin área"}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 800, color: theme.red }}>
                    {t.dias_abierto} d
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center", color: theme.inkMuted }}>
                    {t.fecha_entrega ? new Date(t.fecha_entrega).toLocaleDateString("es-CO") : "Sin fecha"}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    <span
                      style={{
                        padding: "3px 9px",
                        borderRadius: "12px",
                        fontSize: "10px",
                        fontWeight: 700,
                        background: t.es_atrasado ? theme.redBg : theme.tealBg,
                        color: t.es_atrasado ? theme.red : theme.tealDark,
                        border: `1px solid ${t.es_atrasado ? "#fecdd3" : "#bbf7d0"}`,
                      }}
                    >
                      {t.es_atrasado ? "Atrasada" : "A tiempo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
