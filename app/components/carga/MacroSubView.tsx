"use client";

import React, { useMemo } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Layers,
  Users,
} from "lucide-react";
import { TaskRow, theme } from "./types";

interface MacroSubViewProps {
  tasks: TaskRow[];
  totalPlanes: number;
  totalColaboradores: number;
}

export default function MacroSubView({ tasks, totalPlanes, totalColaboradores }: MacroSubViewProps) {
  const data = useMemo(() => {
    const total = tasks.length;
    const atrasadas = tasks.filter((t) => t.es_atrasado).length;
    const aTiempo = total - atrasadas;
    const pctCumplimiento = total > 0 ? Math.round((aTiempo / total) * 100) : 100;
    const pctAtraso = total > 0 ? Math.round((atrasadas / total) * 100) : 0;

    // Conteo por área
    const areaMap: Record<string, number> = {};
    tasks.forEach((t) => {
      const a = t.area || "Sin área";
      areaMap[a] = (areaMap[a] || 0) + 1;
    });
    const topAreas = Object.entries(areaMap)
      .map(([area, count]) => ({ area, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Conteo por plan
    const planMap: Record<string, { total: number; atrasadas: number }> = {};
    tasks.forEach((t) => {
      const p = t.titulo_plan || "Sin plan";
      if (!planMap[p]) planMap[p] = { total: 0, atrasadas: 0 };
      planMap[p].total += 1;
      if (t.es_atrasado) planMap[p].atrasadas += 1;
    });
    const topPlanes = Object.entries(planMap)
      .map(([plan, stats]) => ({ plan, ...stats }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    return {
      total,
      atrasadas,
      aTiempo,
      pctCumplimiento,
      pctAtraso,
      topAreas,
      topPlanes,
    };
  }, [tasks]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* 1. Header Hero Ejecutivo */}
      <div
        style={{
          background: `linear-gradient(135deg, ${theme.ink} 0%, #1a4562 100%)`,
          borderRadius: "14px",
          padding: "24px 28px",
          color: theme.white,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#65bbb7", letterSpacing: "1px", textTransform: "uppercase" }}>
            RESUMEN EJECUTIVO MACRO
          </span>
          <h2 style={{ fontSize: "22px", fontWeight: 800, margin: "4px 0 6px 0", color: "#fff" }}>
            Salud Institucional de Flujo Kanban Firplak
          </h2>
          <p style={{ margin: 0, fontSize: "12px", color: "#a9bbc7", maxWidth: "600px" }}>
            Consolidado global de compromisos, carga de trabajo y rendimiento en todos los planes activos de Microsoft Planner.
          </p>
        </div>
        <div style={{ display: "flex", gap: "20px" }}>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "10px", color: "#a9bbc7", textTransform: "uppercase", fontWeight: 700 }}>Índice Cumplimiento</span>
            <div style={{ fontSize: "32px", fontWeight: 800, color: theme.teal }}>{data.pctCumplimiento}%</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "10px", color: "#a9bbc7", textTransform: "uppercase", fontWeight: 700 }}>Total Tareas Activas</span>
            <div style={{ fontSize: "32px", fontWeight: 800, color: "#fff" }}>{data.total.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* 2. KPIs Macro */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
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
              A Tiempo / En Plazo
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: "#f0fdf4", color: theme.teal }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: theme.tealDark, marginTop: "6px" }}>
            {data.aTiempo.toLocaleString()}
          </div>
          <div style={{ fontSize: "12px", color: theme.inkMuted, marginTop: "4px" }}>
            {data.pctCumplimiento}% dentro de los plazos comprometidos
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
              Tareas Atrasadas
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: theme.redBg, color: theme.red }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: theme.red, marginTop: "6px" }}>
            {data.atrasadas.toLocaleString()}
          </div>
          <div style={{ fontSize: "12px", color: theme.red, fontWeight: 600, marginTop: "4px" }}>
            {data.pctAtraso}% de desviación sobre fecha límite
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
              Planes Operativos
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: "#eff6ff", color: theme.navy }}>
              <Layers size={18} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: theme.ink, marginTop: "6px" }}>
            {totalPlanes}
          </div>
          <div style={{ fontSize: "12px", color: theme.inkMuted, marginTop: "4px" }}>
            Planes de Planner sincronizados
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
              Colaboradores
            </span>
            <div style={{ padding: "6px", borderRadius: "8px", background: theme.amberBg, color: theme.amber }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: theme.ink, marginTop: "6px" }}>
            {totalColaboradores}
          </div>
          <div style={{ fontSize: "12px", color: theme.inkMuted, marginTop: "4px" }}>
            Usuarios con tareas asignadas activas
          </div>
        </div>
      </div>

      {/* 3. Desglose en dos columnas: Top Áreas y Top Planes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))",
          gap: "18px",
        }}
      >
        {/* Top Áreas */}
        <div
          style={{
            background: theme.white,
            borderRadius: "14px",
            padding: "20px",
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadowSm,
          }}
        >
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: theme.ink, margin: "0 0 12px 0" }}>
            Concentración de Carga por Área
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {data.topAreas.map((a) => (
              <div key={a.area}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 600, color: theme.ink }}>{a.area}</span>
                  <span style={{ color: theme.subtle }}>
                    <strong>{a.count.toLocaleString()}</strong> ({a.pct}%)
                  </span>
                </div>
                <div style={{ height: "6px", borderRadius: "3px", background: "#f1f5f9", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${a.pct}%`,
                      background: theme.teal,
                      borderRadius: "3px",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Planes Críticos */}
        <div
          style={{
            background: theme.white,
            borderRadius: "14px",
            padding: "20px",
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadowSm,
          }}
        >
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: theme.ink, margin: "0 0 12px 0" }}>
            Planes de Mayor Impacto
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {data.topPlanes.map((p) => {
              const pctAtr = p.total > 0 ? Math.round((p.atrasadas / p.total) * 100) : 0;
              return (
                <div
                  key={p.plan}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    background: "#f8fafc",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "240px" }}>
                    <strong style={{ color: theme.ink }}>{p.plan}</strong>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ color: theme.subtle }}>{p.total} tareas</span>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: "10px",
                        fontSize: "10px",
                        fontWeight: 700,
                        background: pctAtr > 30 ? theme.redBg : theme.tealBg,
                        color: pctAtr > 30 ? theme.red : theme.tealDark,
                      }}
                    >
                      {pctAtr}% atr.
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
