"use client";

import React, { useMemo } from "react";
import {
  UserX,
  AlertTriangle,
  FolderOpen,
  Layers,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { TaskRow, theme, tooltipStyle } from "./types";

interface HuerfanasSubViewProps {
  tasks: TaskRow[];
  onSelectPlan?: (plan: string) => void;
}

export default function HuerfanasSubView({ tasks, onSelectPlan }: HuerfanasSubViewProps) {
  const data = useMemo(() => {
    const sinAsignarRows = tasks.filter(
      (r) =>
        !r.assigned_user_name ||
        r.assigned_user_name === "Sin asignar" ||
        r.assigned_user_name === "Sin Asignar"
    );

    const planMap: Record<
      string,
      {
        plan: string;
        area: string;
        total: number;
        atrasadas: number;
        aTiempo: number;
      }
    > = {};

    sinAsignarRows.forEach((r) => {
      const planName = r.titulo_plan || "Plan sin nombre";
      if (!planMap[planName]) {
        planMap[planName] = {
          plan: planName,
          area: r.area || "General",
          total: 0,
          atrasadas: 0,
          aTiempo: 0,
        };
      }
      planMap[planName].total += 1;
      if (r.es_atrasado) planMap[planName].atrasadas += 1;
      else planMap[planName].aTiempo += 1;
    });

    const planesList = Object.values(planMap).sort((a, b) => b.total - a.total);
    const totalSinAsignar = sinAsignarRows.length;
    const atrasadasCount = sinAsignarRows.filter((t) => t.es_atrasado).length;
    const pctAtraso = totalSinAsignar > 0 ? Math.round((atrasadasCount / totalSinAsignar) * 100) : 0;
    const pctDelTotal = tasks.length > 0 ? Math.round((totalSinAsignar / tasks.length) * 100) : 0;

    return {
      sinAsignarRows,
      planesList,
      totalSinAsignar,
      atrasadasCount,
      pctAtraso,
      pctDelTotal,
    };
  }, [tasks]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* 1. KPIs de Tareas Sin Asignar */}
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
              Tareas Sin Asignar
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: theme.redBg, color: theme.red }}>
              <UserX size={18} />
            </div>
          </div>
          <div style={{ fontSize: "30px", fontWeight: 800, color: theme.ink, marginTop: "6px" }}>
            {data.totalSinAsignar.toLocaleString()}
          </div>
          <div style={{ fontSize: "12px", color: theme.inkMuted, marginTop: "4px" }}>
            Representan el {data.pctDelTotal}% del backlog total
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
              Huérfanas Atrasadas
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: theme.amberBg, color: theme.amber }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: "30px", fontWeight: 800, color: theme.red, marginTop: "6px" }}>
            {data.atrasadasCount.toLocaleString()}
          </div>
          <div style={{ fontSize: "12px", color: theme.red, fontWeight: 600, marginTop: "4px" }}>
            {data.pctAtraso}% ya tienen fecha límite vencida
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
              Planes Involucrados
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: "#eff6ff", color: theme.navy }}>
              <FolderOpen size={18} />
            </div>
          </div>
          <div style={{ fontSize: "30px", fontWeight: 800, color: theme.ink, marginTop: "6px" }}>
            {data.planesList.length}
          </div>
          <div style={{ fontSize: "12px", color: theme.inkMuted, marginTop: "4px" }}>
            Planes con tareas pendientes de responsable
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
              Mayor Concentración
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: "#f0fdf4", color: theme.teal }}>
              <Layers size={18} />
            </div>
          </div>
          <div style={{ fontSize: "18px", fontWeight: 800, color: theme.ink, marginTop: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {data.planesList[0]?.plan || "Ninguno"}
          </div>
          <div style={{ fontSize: "12px", color: theme.tealDark, fontWeight: 700, marginTop: "4px" }}>
            {data.planesList[0]?.total || 0} tareas huérfanas
          </div>
        </div>
      </div>

      {/* 2. Gráfico: Top Planes con Tareas Sin Asignar */}
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
          Top Planes con Mayor Acumulación de Tareas Sin Asignar
        </h3>
        <p style={{ fontSize: "12px", color: theme.subtle, margin: "0 0 16px 0" }}>
          Planes que requieren asignación urgente de colaboradores
        </p>
        <div style={{ height: "280px", width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.planesList.slice(0, 10)}
              layout="vertical"
              margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal stroke="#f1f5f9" vertical={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: theme.subtle }} />
              <YAxis
                dataKey="plan"
                type="category"
                width={140}
                tick={{ fontSize: 11, fill: theme.ink }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(val, name) => [
                  `${val} tareas`,
                  name === "total" ? "Sin Asignar" : "Atrasadas",
                ]}
              />
              <Bar dataKey="total" fill={theme.navy} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Tabla de Tareas Huérfanas */}
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
            Listado de Tareas Huérfanas ({data.totalSinAsignar.toLocaleString()})
          </h3>
          <span style={{ fontSize: "12px", color: theme.subtle }}>
            Auditoría de tareas no asignadas en el corte actual
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: theme.canvas, borderBottom: `1px solid ${theme.border}` }}>
                <th style={{ padding: "12px 16px", textAlign: "left", color: theme.subtle, fontWeight: 700 }}>TAREA</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: theme.subtle, fontWeight: 700 }}>PLAN</th>
                <th style={{ padding: "12px 16px", textAlign: "left", color: theme.subtle, fontWeight: 700 }}>ÁREA</th>
                <th style={{ padding: "12px 16px", textAlign: "center", color: theme.subtle, fontWeight: 700 }}>FECHA CREACIÓN</th>
                <th style={{ padding: "12px 16px", textAlign: "center", color: theme.subtle, fontWeight: 700 }}>FECHA ENTREGA</th>
                <th style={{ padding: "12px 16px", textAlign: "right", color: theme.subtle, fontWeight: 700 }}>DÍAS ABIERTA</th>
                <th style={{ padding: "12px 16px", textAlign: "center", color: theme.subtle, fontWeight: 700 }}>ESTADO</th>
              </tr>
            </thead>
            <tbody>
              {data.sinAsignarRows.slice(0, 25).map((t) => (
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
                    <span
                      style={{ cursor: onSelectPlan ? "pointer" : "default" }}
                      onClick={() => onSelectPlan?.(t.titulo_plan)}
                    >
                      {t.titulo_plan}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px", color: theme.subtle }}>
                    {t.area || "Sin área"}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center", color: theme.inkMuted }}>
                    {t.fecha_creacion_tarea ? new Date(t.fecha_creacion_tarea).toLocaleDateString("es-CO") : "-"}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center", color: theme.inkMuted }}>
                    {t.fecha_entrega ? new Date(t.fecha_entrega).toLocaleDateString("es-CO") : "Sin fecha"}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, color: theme.ink }}>
                    {t.dias_abierto} d
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
