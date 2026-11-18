"use client";

import React, { useMemo } from "react";
import {
  Briefcase,
  AlertTriangle,
  Clock,
  Layers,
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
import { TaskRow, theme, tooltipStyle } from "./types";

interface AreasSubViewProps {
  tasks: TaskRow[];
  onSelectArea?: (area: string) => void;
}

export default function AreasSubView({ tasks, onSelectArea }: AreasSubViewProps) {
  const areasData = useMemo(() => {
    const map: Record<
      string,
      {
        area: string;
        total: number;
        atrasadas: number;
        aTiempo: number;
        colaboradores: Set<string>;
        planes: Set<string>;
        diasAbiertoTotal: number;
      }
    > = {};

    tasks.forEach((r) => {
      const areaName = r.area || "Sin área";
      if (!map[areaName]) {
        map[areaName] = {
          area: areaName,
          total: 0,
          atrasadas: 0,
          aTiempo: 0,
          colaboradores: new Set(),
          planes: new Set(),
          diasAbiertoTotal: 0,
        };
      }
      map[areaName].total += 1;
      if (r.es_atrasado) map[areaName].atrasadas += 1;
      else map[areaName].aTiempo += 1;

      if (r.assigned_user_name && r.assigned_user_name !== "Sin asignar") {
        map[areaName].colaboradores.add(r.assigned_user_name);
      }
      if (r.titulo_plan) map[areaName].planes.add(r.titulo_plan);
      map[areaName].diasAbiertoTotal += r.dias_abierto || 0;
    });

    return Object.values(map)
      .map((a) => {
        const pctCumplimiento = a.total > 0 ? Math.round((a.aTiempo / a.total) * 100) : 100;
        const pctAtraso = a.total > 0 ? Math.round((a.atrasadas / a.total) * 100) : 0;
        const diasPromedio = a.total > 0 ? Math.round(a.diasAbiertoTotal / a.total) : 0;

        return {
          area: a.area,
          total: a.total,
          atrasadas: a.atrasadas,
          aTiempo: a.aTiempo,
          pctCumplimiento,
          pctAtraso,
          colaboradoresCount: a.colaboradores.size,
          planesCount: a.planes.size,
          diasPromedio,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [tasks]);

  const kpis = useMemo(() => {
    const totalAreas = areasData.length;
    const maxCarga = areasData[0] || { area: "N/A", total: 0 };
    const sortedByAtraso = [...areasData].sort((a, b) => b.pctAtraso - a.pctAtraso);
    const maxAtraso = sortedByAtraso[0] || { area: "N/A", pctAtraso: 0 };
    const totalTareas = tasks.length;
    const totalAtrasadas = tasks.filter((t) => t.es_atrasado).length;
    const tasaAtrasoGlobal = totalTareas > 0 ? Math.round((totalAtrasadas / totalTareas) * 100) : 0;

    return { totalAreas, maxCarga, maxAtraso, tasaAtrasoGlobal };
  }, [areasData, tasks]);

  const chartPalette = [
    theme.navy,
    theme.teal,
    theme.coral,
    theme.purple,
    theme.amber,
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ec4899",
    "#6366f1",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* 1. KPIs de Áreas */}
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
              Áreas Operativas
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: "#f0fdf4", color: theme.teal }}>
              <Briefcase size={18} />
            </div>
          </div>
          <div style={{ fontSize: "30px", fontWeight: 800, color: theme.ink, marginTop: "6px" }}>
            {kpis.totalAreas}
          </div>
          <div style={{ fontSize: "12px", color: theme.inkMuted, marginTop: "4px" }}>
            Departamentos registrados con tareas activas
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
              Mayor Volumen de Carga
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: "#eff6ff", color: theme.navy }}>
              <Layers size={18} />
            </div>
          </div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: theme.ink, marginTop: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {kpis.maxCarga.area}
          </div>
          <div style={{ fontSize: "12px", color: theme.tealDark, fontWeight: 700, marginTop: "4px" }}>
            {kpis.maxCarga.total.toLocaleString()} tareas asignadas
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
              Mayor % Atraso
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: theme.redBg, color: theme.red }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: theme.ink, marginTop: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {kpis.maxAtraso.area}
          </div>
          <div style={{ fontSize: "12px", color: theme.red, fontWeight: 700, marginTop: "4px" }}>
            {kpis.maxAtraso.pctAtraso}% de tareas atrasadas
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
              Tasa Atraso Promedio
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: theme.amberBg, color: theme.amber }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: "30px", fontWeight: 800, color: theme.ink, marginTop: "6px" }}>
            {kpis.tasaAtrasoGlobal}%
          </div>
          <div style={{ fontSize: "12px", color: theme.inkMuted, marginTop: "4px" }}>
            Promedio de atraso en todas las áreas
          </div>
        </div>
      </div>

      {/* 2. Gráficos de Áreas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))",
          gap: "18px",
        }}
      >
        {/* Gráfico 1: Barras Apiladas (A tiempo vs Atrasadas) */}
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
            Carga de Tareas por Área (Cumplimiento vs Atrasos)
          </h3>
          <p style={{ fontSize: "12px", color: theme.subtle, margin: "0 0 16px 0" }}>
            Top áreas por volumen de tareas activas
          </p>
          <div style={{ height: "300px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={areasData.slice(0, 8)}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal stroke="#f1f5f9" vertical={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: theme.subtle }} />
                <YAxis
                  dataKey="area"
                  type="category"
                  width={110}
                  tick={{ fontSize: 11, fill: theme.ink }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val, name) => [
                    `${val} tareas`,
                    name === "aTiempo" ? "A Tiempo" : "Atrasadas",
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                  formatter={(val) => (val === "aTiempo" ? "A Tiempo" : "Atrasadas")}
                />
                <Bar dataKey="aTiempo" stackId="a" fill={theme.teal} radius={[0, 0, 0, 0]} />
                <Bar dataKey="atrasadas" stackId="a" fill={theme.red} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Participación de Carga por Área */}
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
            Distribución Porcentual del Backlog por Área
          </h3>
          <p style={{ fontSize: "12px", color: theme.subtle, margin: "0 0 16px 0" }}>
            Participación relativa en el total de tareas de Firplak
          </p>
          <div style={{ height: "300px", width: "100%", display: "flex", alignItems: "center" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={areasData.slice(0, 6)}
                  dataKey="total"
                  nameKey="area"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                  label={({ name, percent }) => `${name.substring(0, 10)} ${(percent * 100).toFixed(0)}%`}
                >
                  {areasData.slice(0, 6).map((entry, index) => (
                    <Cell key={`cell-${entry.area}`} fill={chartPalette[index % chartPalette.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`${val} tareas`, "Carga"]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Tabla Completa de Desglose por Área */}
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
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: theme.ink, margin: 0 }}>
              Matriz Departamental de Capacidad y Cumplimiento
            </h3>
            <span style={{ fontSize: "12px", color: theme.subtle }}>
              {areasData.length} áreas operativas analizadas
            </span>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: theme.canvas, borderBottom: `1px solid ${theme.border}` }}>
                <th style={{ padding: "12px 16px", textAlign: "left", color: theme.subtle, fontWeight: 700 }}>ÁREA</th>
                <th style={{ padding: "12px 16px", textAlign: "right", color: theme.subtle, fontWeight: 700 }}>TOTAL</th>
                <th style={{ padding: "12px 16px", textAlign: "right", color: theme.subtle, fontWeight: 700 }}>A TIEMPO</th>
                <th style={{ padding: "12px 16px", textAlign: "right", color: theme.subtle, fontWeight: 700 }}>ATRASADAS</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: theme.subtle, fontWeight: 700, minWidth: "160px" }}>% CUMPLIMIENTO</th>
                <th style={{ padding: "12px 16px", textAlign: "center", color: theme.subtle, fontWeight: 700 }}>COLABORADORES</th>
                <th style={{ padding: "12px 16px", textAlign: "center", color: theme.subtle, fontWeight: 700 }}>PLANES</th>
                <th style={{ padding: "12px 16px", textAlign: "right", color: theme.subtle, fontWeight: 700 }}>DÍAS PROM.</th>
                <th style={{ padding: "12px 16px", textAlign: "center", color: theme.subtle, fontWeight: 700 }}>ESTADO</th>
              </tr>
            </thead>
            <tbody>
              {areasData.map((row) => {
                const isCritical = row.pctAtraso > 40;
                const isWarning = row.pctAtraso > 20 && row.pctAtraso <= 40;

                return (
                  <tr
                    key={row.area}
                    style={{ borderBottom: `1px solid ${theme.borderLight}`, transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: theme.ink }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{ cursor: onSelectArea ? "pointer" : "default" }}
                          onClick={() => onSelectArea?.(row.area)}
                        >
                          {row.area}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, color: theme.ink }}>
                      {row.total.toLocaleString()}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", color: theme.tealDark, fontWeight: 600 }}>
                      {row.aTiempo.toLocaleString()}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", color: theme.red, fontWeight: 600 }}>
                      {row.atrasadas.toLocaleString()}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            flex: 1,
                            height: "8px",
                            borderRadius: "4px",
                            background: "#f1f5f9",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${row.pctCumplimiento}%`,
                              height: "100%",
                              background: row.pctCumplimiento > 75 ? theme.teal : row.pctCumplimiento > 50 ? theme.amber : theme.red,
                              borderRadius: "4px",
                            }}
                          />
                        </div>
                        <span style={{ fontSize: "11px", fontWeight: 700, minWidth: "32px", color: theme.ink }}>
                          {row.pctCumplimiento}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center", color: theme.inkMuted }}>
                      {row.colaboradoresCount}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center", color: theme.inkMuted }}>
                      {row.planesCount}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", color: theme.subtle }}>
                      {row.diasPromedio} d
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      <span
                        style={{
                          padding: "3px 9px",
                          borderRadius: "12px",
                          fontSize: "10px",
                          fontWeight: 700,
                          background: isCritical ? theme.redBg : isWarning ? theme.amberBg : theme.tealBg,
                          color: isCritical ? theme.red : isWarning ? theme.amber : theme.tealDark,
                          border: `1px solid ${isCritical ? "#fecdd3" : isWarning ? "#fde68a" : "#bbf7d0"}`,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {isCritical ? "Crítico" : isWarning ? "Atención" : "Estable"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
