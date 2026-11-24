/*
  BI PKT: conciliación del portal con Power BI (fase 6). SOLO LECTURA.
  Ficha: llm-wiki/bi/pkt.md (sección 6).

  El Power BI solo tiene Firplak; el portal consolida Firplak y Viventta restando los saldos entre
  compañías que coinciden (D9). Por eso la conciliación va en dos partes:
    Parte A (debe cuadrar con el BI): saldos y tarjetas de Firplak, con las ventas calculadas con las
            reglas exactas del BI y, al lado, con Informe_ventas (lo que usa el portal).
    Parte B (lo que agrega el portal): Viventta, la eliminación entre compañías y el PKT consolidado.

  Periodos: octubre de 2026 (último mes cerrado), septiembre de 2026 (mes anterior), agosto de 2026
  (hay captura del BI) y diciembre de 2025 (cierre de año; es el "año anterior" de 2026).
  Para cambiarlos, edita #Periodos.

  Resultados, en orden:
    R1  Parte A · saldos de Firplak por concepto, subtotales y KTNO (corte y 31 de diciembre anterior)
    R2  Parte A · tarjetas de Firplak con ventas del BI y con ventas de Informe_ventas
    R3  Parte B · saldos de Viventta por concepto y lo eliminado
    R4  Parte B · detalle de la eliminación entre compañías por sentido
    R5  Parte B · PKT consolidado (lo que muestra el portal)
    R6  Ventas por mes: reglas del BI frente a Informe_ventas sin Viventta (V6), 2024 a 2026
*/

USE [Planos_Symphony];
SET NOCOUNT ON;

DROP TABLE IF EXISTS #Periodos, #VentasBI, #VentasIV, #VentasMes;

/* ───────────── Periodos ───────────── */
CREATE TABLE #Periodos (FechaCorte date NOT NULL PRIMARY KEY, Anio int NOT NULL, Mes int NOT NULL, FechaAnterior date NOT NULL);
INSERT INTO #Periodos (FechaCorte, Anio, Mes, FechaAnterior) VALUES
    ('20261031', 2026, 10, '20251231'),
    ('20260930', 2026,  9, '20251231'),
    ('20260831', 2026,  8, '20251231'),   -- Captura del BI del 2026-11-23
    ('20251231', 2025, 12, '20241231');

/* ───────────── Ventas por mes ───────────── */

-- Reglas exactas del Power BI (consultas Facturas y NotasCredito de la ficha, solo Firplak_SA).
SELECT YEAR(x.Fecha) AS Anio, MONTH(x.Fecha) AS Mes, SUM(x.Valor) AS Ventas
INTO #VentasBI
FROM (
    SELECT T0.DOCDATE AS Fecha, T1.LINETOTAL AS Valor
    FROM Firplak_SA.dbo.OINV T0
    INNER JOIN Firplak_SA.dbo.INV1 T1 ON T0.DOCENTRY = T1.DOCENTRY
    INNER JOIN Firplak_SA.dbo.INV12 T16 ON T0.DOCENTRY = T16.DOCENTRY
    INNER JOIN Firplak_SA.dbo.OCRD T4 ON T0.CARDCODE = T4.CARDCODE
    INNER JOIN Firplak_SA.dbo.OTER T9 ON T4.TERRITORY = T9.TERRITRYID
    INNER JOIN Firplak_SA.dbo.OCRG T5 ON T4.GROUPCODE = T5.GROUPCODE
    INNER JOIN Firplak_SA.dbo.OSLP T6 ON T0.SLPCODE = T6.SLPCODE
    INNER JOIN Firplak_SA.dbo.[@FIR_SUBGRUPOCLIENTE] T8 ON T4.U_SUBGROUPCODE = T8.CODE
    INNER JOIN Firplak_SA.dbo.OTER T10 ON T9.PARENT = T10.TERRITRYID
    WHERE T0.SERIES <> '88' AND T0.CANCELED = 'N' AND T1.TAXONLY = 'N'
      AND T0.U_TipoVentas <> 'Donaciones' AND T1.LINETOTAL <> 0
      AND T1.ItemCode NOT IN ('VZNOPE-0003-000-0000','VZNOPE-0001-000-0000','VZNOPE-0004-000-0000','VZNOPE-0006-000-0000',
          'VZNOPE-0007-000-0000','VZNOPE-0008-000-0000','VZNOPE-0009-000-0000','VZNOPE-0010-000-0000','VZNOPE-0012-000-0000',
          'VZNOPE-0014-000-0000','VZNOPE-0015-000-0000','VZNOPE-0017-000-0000','VZNOPE-0018-000-0000','VZNOPE-0021-000-0000',
          'VZNOPE-0023-000-0000','VZNOPE-0024-000-0000')
      AND T0.DocNum NOT IN (96491, 96492, 96493, 96494, 96495, 96496, 96497, 96515, 96516)
      AND T0.DOCDATE >= '20240101' AND T0.DOCDATE < '20261101'
    UNION ALL
    SELECT T0.DOCDATE, T1.LINETOTAL * -1
    FROM Firplak_SA.dbo.ORIN T0
    INNER JOIN Firplak_SA.dbo.RIN1 T1 ON T0.DOCENTRY = T1.DOCENTRY
    INNER JOIN Firplak_SA.dbo.RIN12 T16 ON T0.DOCENTRY = T16.DOCENTRY
    INNER JOIN Firplak_SA.dbo.OCRD T4 ON T0.CARDCODE = T4.CARDCODE
    INNER JOIN Firplak_SA.dbo.OTER T9 ON T4.TERRITORY = T9.TERRITRYID
    INNER JOIN Firplak_SA.dbo.OCRG T5 ON T4.GROUPCODE = T5.GROUPCODE
    INNER JOIN Firplak_SA.dbo.OSLP T6 ON T0.SLPCODE = T6.SLPCODE
    WHERE T0.SERIES <> '88' AND T1.TAXONLY = 'N' AND T1.LINETOTAL <> 0 AND T0.CANCELED = 'N'
      AND T0.DocType <> 'S' AND T0.U_TipoVentas <> 'Donaciones'
      AND T1.ItemCode NOT IN ('VZNOPE-0003-000-0000','VZNOPE-0001-000-0000','VZNOPE-0004-000-0000','VZNOPE-0006-000-0000',
          'VZNOPE-0007-000-0000','VZNOPE-0008-000-0000','VZNOPE-0009-000-0000','VZNOPE-0010-000-0000','VZNOPE-0012-000-0000',
          'VZNOPE-0014-000-0000','VZNOPE-0015-000-0000','VZNOPE-0017-000-0000','VZNOPE-0018-000-0000','VZNOPE-0021-000-0000',
          'VZNOPE-0023-000-0000','VZNOPE-0024-000-0000')
      AND T0.DocNum <> 1002414
      AND T0.DOCDATE >= '20240101' AND T0.DOCDATE < '20261101'
) AS x
GROUP BY YEAR(x.Fecha), MONTH(x.Fecha);

-- Informe_ventas con la regla neta del portal (la misma de la API: notas con -ABS), por compañía.
SELECT YEAR(v.FechaContabilizacion) AS Anio, MONTH(v.FechaContabilizacion) AS Mes,
       CASE WHEN LTRIM(RTRIM(CONVERT(nvarchar(20), v.Empresa))) = N'Viventta' THEN N'Viventta' ELSE N'Firplak' END AS Empresa,
       SUM(CASE
             WHEN v.TipoDocumento LIKE N'Nota%' OR NULLIF(CONVERT(nvarchar(50), v.CodigoTipoNC), '') IS NOT NULL
                  OR NULLIF(CONVERT(nvarchar(100), v.TiposNC), '') IS NOT NULL
               THEN -ABS(CONVERT(decimal(38, 6), v.ValorTotal))
             ELSE CONVERT(decimal(38, 6), v.ValorTotal)
           END) AS Ventas
INTO #VentasIV
FROM dbo.Informe_ventas AS v
WHERE v.FechaContabilizacion >= '20240101' AND v.FechaContabilizacion < '20261101'
GROUP BY YEAR(v.FechaContabilizacion), MONTH(v.FechaContabilizacion),
         CASE WHEN LTRIM(RTRIM(CONVERT(nvarchar(20), v.Empresa))) = N'Viventta' THEN N'Viventta' ELSE N'Firplak' END;

-- Una fila por año y mes con las tres fuentes.
SELECT m.Anio, m.Mes,
       ISNULL(b.Ventas, 0) AS VentasBI,
       ISNULL(SUM(CASE WHEN i.Empresa = N'Firplak'  THEN i.Ventas END), 0) AS VentasIVFirplak,
       ISNULL(SUM(CASE WHEN i.Empresa = N'Viventta' THEN i.Ventas END), 0) AS VentasIVViventta
INTO #VentasMes
FROM (SELECT Anio, Mes FROM #VentasBI UNION SELECT Anio, Mes FROM #VentasIV) AS m
LEFT JOIN #VentasBI AS b ON b.Anio = m.Anio AND b.Mes = m.Mes
LEFT JOIN #VentasIV AS i ON i.Anio = m.Anio AND i.Mes = m.Mes
GROUP BY m.Anio, m.Mes, b.Ventas;

/* ───────────── R1 · Parte A: saldos de Firplak ─────────────
   Comparar con la matriz del BI (año y mes del periodo): "Año Actual" = SaldoCorte, "Año Anterior" = SaldoAnterior. */
SELECT p.FechaCorte,
       CASE WHEN GROUPING(s.Concepto) = 0 THEN MIN(s.Grupo) WHEN GROUPING(s.Grupo) = 0 THEN s.Grupo ELSE N'KTNO' END AS Grupo,
       CASE WHEN GROUPING(s.Concepto) = 0 THEN s.Concepto WHEN GROUPING(s.Grupo) = 0 THEN N'(subtotal)' ELSE N'(total)' END AS Concepto,
       SUM(CASE WHEN s.FechaCorte = p.FechaCorte THEN s.SaldoContable END) AS SaldoCorte,
       SUM(CASE WHEN s.FechaCorte = p.FechaAnterior THEN s.SaldoContable END) AS SaldoAnterior,
       SUM(CASE WHEN s.FechaCorte = p.FechaCorte THEN s.SaldoContable END)
         - SUM(CASE WHEN s.FechaCorte = p.FechaAnterior THEN s.SaldoContable END) AS Variacion
FROM #Periodos AS p
INNER JOIN dbo.Informe_pkt_saldos AS s ON s.FechaCorte IN (p.FechaCorte, p.FechaAnterior) AND s.Empresa = N'Firplak'
GROUP BY GROUPING SETS ((p.FechaCorte, s.Grupo, s.Concepto), (p.FechaCorte, s.Grupo), (p.FechaCorte))
ORDER BY p.FechaCorte DESC, GROUPING(s.Grupo), MIN(s.Orden), GROUPING(s.Concepto) DESC;

/* ───────────── R2 · Parte A: tarjetas de Firplak ─────────────
   Columnas "BI" = reglas del Power BI (deben cuadrar con las tarjetas del BI).
   Columnas "IV" = Informe_ventas sin Viventta (lo que usa el portal para la parte de Firplak). */
WITH K AS (
    SELECT p.FechaCorte, p.Anio, p.Mes,
           SUM(CASE WHEN s.FechaCorte = p.FechaCorte THEN s.SaldoContable END) AS KTNO,
           SUM(CASE WHEN s.FechaCorte = p.FechaAnterior THEN s.SaldoContable END) AS KTNOAnterior
    FROM #Periodos AS p
    INNER JOIN dbo.Informe_pkt_saldos AS s ON s.FechaCorte IN (p.FechaCorte, p.FechaAnterior) AND s.Empresa = N'Firplak'
    GROUP BY p.FechaCorte, p.Anio, p.Mes
),
V AS (
    SELECT p.FechaCorte,
           SUM(CASE WHEN m.Anio = p.Anio AND m.Mes <= p.Mes THEN m.VentasBI END) AS AcumBI,
           SUM(CASE WHEN m.Anio = p.Anio - 1 THEN m.VentasBI END) AS AnioAnteriorBI,
           SUM(CASE WHEN m.Anio = p.Anio AND m.Mes <= p.Mes THEN m.VentasIVFirplak END) AS AcumIV,
           SUM(CASE WHEN m.Anio = p.Anio - 1 THEN m.VentasIVFirplak END) AS AnioAnteriorIV
    FROM #Periodos AS p
    CROSS JOIN #VentasMes AS m
    GROUP BY p.FechaCorte
)
SELECT k.FechaCorte, k.KTNO, k.KTNOAnterior,
       v.AnioAnteriorBI                                   AS VentasAAnteriorBI,
       v.AcumBI / k.Mes * 12                              AS VentasProyectadasBI,
       v.AcumBI / k.Mes * 12 - v.AnioAnteriorBI           AS VariacionBI,
       (v.AcumBI / k.Mes * 12 - v.AnioAnteriorBI) / NULLIF(v.AnioAnteriorBI, 0) AS VariacionPctBI,
       k.KTNO / NULLIF(v.AcumBI / k.Mes * 12, 0)          AS PKT_BI,
       k.KTNOAnterior / NULLIF(v.AnioAnteriorBI, 0)       AS PKTAnterior_BI,
       v.AnioAnteriorIV                                   AS VentasAAnteriorIV,
       v.AcumIV / k.Mes * 12                              AS VentasProyectadasIV,
       k.KTNO / NULLIF(v.AcumIV / k.Mes * 12, 0)          AS PKT_IV,
       k.KTNOAnterior / NULLIF(v.AnioAnteriorIV, 0)       AS PKTAnterior_IV
FROM K AS k
INNER JOIN V AS v ON v.FechaCorte = k.FechaCorte
ORDER BY k.FechaCorte DESC;

/* ───────────── R3 · Parte B: Viventta por concepto ───────────── */
SELECT s.FechaCorte, s.Orden, s.Concepto, s.SaldoContable, s.SaldoIntercompania, s.Saldo
FROM dbo.Informe_pkt_saldos AS s
INNER JOIN #Periodos AS p ON p.FechaCorte = s.FechaCorte
WHERE s.Empresa = N'Viventta'
ORDER BY s.FechaCorte DESC, s.Orden;

/* ───────────── R4 · Parte B: eliminación entre compañías ─────────────
   Por sentido: total de cada compañía, diferencia y si se eliminó (Coincide = 1). */
SELECT i.FechaCorte, i.Sentido,
       SUM(CASE WHEN i.Empresa = N'Firplak'  THEN i.Saldo ELSE 0 END) AS SaldoFirplak,
       SUM(CASE WHEN i.Empresa = N'Viventta' THEN i.Saldo ELSE 0 END) AS SaldoViventta,
       MAX(i.DiferenciaSentido) AS Diferencia,
       MAX(CONVERT(int, i.Coincide)) AS Coincide,
       SUM(CASE WHEN i.Concepto IS NOT NULL AND i.Coincide = 1 THEN i.Saldo ELSE 0 END) AS EliminadoDelPKT
FROM dbo.Informe_pkt_intercompania AS i
INNER JOIN #Periodos AS p ON p.FechaCorte = i.FechaCorte
GROUP BY i.FechaCorte, i.Sentido
ORDER BY i.FechaCorte DESC, i.Sentido;

/* ───────────── R5 · Parte B: PKT consolidado (lo que muestra el portal) ─────────────
   Debe ser igual a lo que devuelve GET /api/v1/pkt?anio=…&mes=… y a las tarjetas del portal. */
WITH K AS (
    SELECT p.FechaCorte, p.Anio, p.Mes,
           SUM(CASE WHEN s.FechaCorte = p.FechaCorte AND s.Empresa = N'Firplak' THEN s.Saldo END) AS KTNOFirplak,
           SUM(CASE WHEN s.FechaCorte = p.FechaCorte AND s.Empresa = N'Viventta' THEN s.Saldo END) AS KTNOViventta,
           SUM(CASE WHEN s.FechaCorte = p.FechaCorte THEN s.Saldo END) AS KTNO,
           SUM(CASE WHEN s.FechaCorte = p.FechaAnterior THEN s.Saldo END) AS KTNOAnterior
    FROM #Periodos AS p
    INNER JOIN dbo.Informe_pkt_saldos AS s ON s.FechaCorte IN (p.FechaCorte, p.FechaAnterior)
    GROUP BY p.FechaCorte, p.Anio, p.Mes
),
V AS (
    SELECT p.FechaCorte,
           SUM(CASE WHEN m.Anio = p.Anio AND m.Mes <= p.Mes THEN m.VentasIVFirplak + m.VentasIVViventta END) AS Acum,
           SUM(CASE WHEN m.Anio = p.Anio AND m.Mes <= p.Mes THEN m.VentasIVViventta END) AS AcumViventta,
           SUM(CASE WHEN m.Anio = p.Anio - 1 THEN m.VentasIVFirplak + m.VentasIVViventta END) AS AnioAnterior
    FROM #Periodos AS p
    CROSS JOIN #VentasMes AS m
    GROUP BY p.FechaCorte
)
SELECT k.FechaCorte, k.KTNOFirplak, k.KTNOViventta, k.KTNO, k.KTNOAnterior,
       v.Acum AS VentasAcumuladas, v.AcumViventta AS VentasAcumuladasViventta,
       v.Acum / k.Mes * 12 AS VentasProyectadas,
       v.AnioAnterior AS VentasAnioAnterior,
       k.KTNO / NULLIF(v.Acum / k.Mes * 12, 0) AS PKT,
       k.KTNOAnterior / NULLIF(v.AnioAnterior, 0) AS PKTAnterior
FROM K AS k
INNER JOIN V AS v ON v.FechaCorte = k.FechaCorte
ORDER BY k.FechaCorte DESC;

/* ───────────── R6 · Ventas por mes: BI frente a Informe_ventas (V6) ───────────── */
SELECT Anio, Mes, VentasBI, VentasIVFirplak, VentasBI - VentasIVFirplak AS Diferencia, VentasIVViventta
FROM #VentasMes
ORDER BY Anio, Mes;

DROP TABLE IF EXISTS #Periodos, #VentasBI, #VentasIV, #VentasMes;
