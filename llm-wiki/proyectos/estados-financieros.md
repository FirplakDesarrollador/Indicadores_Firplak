---
status: draft
updated: 2026-11-19
sources:
  - ../../sql/estados-financieros/01_informe_cuentas_14_74.sql
  - ../../sql/estados-financieros/02_informe_balance.sql
  - ../../sql/estados-financieros/03_job_estados_financieros.sql
---

# Proyecto: Estados Financieros (balance y cuentas 14 y 74)

Proyecto nuevo; **no es una migración de BI**. Rama `bi/estados-financieros` en este repositorio y en `reporting-api`.

- **Consumidor:** la app de Estados Financieros (repositorio `FirplakDesarrollador/Estados_financieros`, Next.js), páginas de balance general, estado de resultados y estado de costos.
- **Desarrollador responsable:** Milton Rendón.
- **Estado (2026-11-19):** scripts SQL escritos (el desarrollador los está ejecutando); contratos aprobados y endpoints implementados en `reporting-api`. `pendiente`: primera carga, validación, prueba de los endpoints contra SQL Server y despliegue.

## Por qué

Hasta el 2026-11-19 la app leía dos tablas de Supabase (`estados financieros.balance` y `estados financieros.cuentas_14_y_74`) que se llenaban a mano con el resultado de dos queries de Contabilidad. El query del balance, corrido en SAP de una vez, tardaba demasiado y bloqueaba SAP. Como paso intermedio se armó una sincronización por el Service Layer de SAP hacia Supabase, programada en un PC de la red (repositorio de Estados Financieros, `scripts/sap-sync.mjs`). Se reemplaza por el patrón estándar del portal: tabla + SP en `Planos_Symphony`, job del SQL Server Agent y endpoint en `reporting-api`.

## Objetos en `Planos_Symphony`

| Objeto | Grano | Carga |
|---|---|---|
| `dbo.Informe_cuentas_14_74` | Asiento + cuenta + tercero + tipo de transacción + fecha | Incremental: últimos 60 días. Completa: desde 2021-01-01 |
| `dbo.Informe_mov_contable_diario` | Cuenta + día (toda la historia, todas las cuentas) | Incremental: últimos 7 días y días tocados por asientos con `TransId` mayor al último leído. Completa: mes por mes |
| `dbo.Informe_mov_contable_control` | Una fila: último `TransId` leído | La actualiza el SP del balance |
| `dbo.Informe_balance` | Año + mes + código de cuenta (niveles 1 a 5) | Se calcula desde `Informe_mov_contable_diario`, sin leer SAP; la incremental recalcula desde el mes anterior o desde el mes más antiguo tocado |

SP: `sp_Actualizar_Informe_cuentas_14_74` y `sp_Actualizar_Informe_balance`. Bitácora: `dbo.Cargas_Log` (procesos `Informe_cuentas_14_74`, `Informe_mov_contable_diario` e `Informe_balance`). Jobs: `BI - Estados financieros carga incremental` (diario 5:00) y `BI - Estados financieros carga completa` (domingo 3:00).

## Reglas

### Cuentas 14 y 74 (query de Contabilidad, 2026-11-19)

- `OJDT.U_HBT_AreVal IN ('Comun', 'IFRS')` (sin `''` ni `NULL`, a diferencia del balance).
- Cuentas 14050505, 14050510, 14050520, 14050555, 14050560, 14350505 y 14350510 con `TransType` 18, 19, 20 y 21, más `TransType` 69 solo de terceros `PE%`.
- Cuentas 74010505, 74010510, 74010515, 74010520 y 74010525 con `TransType` 18, 19, 20 y 21.
- Débito y crédito redondeados a pesos (`numeric(12,0)`) por fila; saldo = débito − crédito redondeados.
- `CodigoTercero` vacío se guarda como `''` porque es parte de la clave.

### Balance (query de Contabilidad, 2026-11-11)

- `U_HBT_AreVal IN ('Comun', '', 'IFRS')` o `NULL`; cuentas de nivel 5, imputables, de 8 dígitos.
- Niveles: `Lvl1` = primer dígito + 14 ceros; `Lvl2`, `Lvl3`, `Lvl4` = primeros 2, 4 y 6 dígitos. Nombre de cada nivel por `INNER JOIN` con `OACT`.
- Fecha = fin de mes; en el mes en curso, hoy.
- Cambios sin efecto en las cifras: el día sale de `OJDT.RefDate` (se comprobó que coincide con `JDT1.RefDate` en todas las líneas de 2025-2026) y el saldo acumulado se calcula mes por mes porque `SUM() OVER (... ROWS ...)` no funciona en nivel de compatibilidad 100.

## Validación previa (Supabase, 2026-11-13)

Con los movimientos diarios traídos de SAP por el Service Layer y el mismo cálculo:

- Enero a noviembre de 2025 cuadraron exacto (diferencia 0,00) con la tabla `balance` existente.
- Diciembre 2025 a septiembre 2026 diferían: el asiento 2334829 (31/12/2025, "CIERRE 1355", reclasificación de retención en la fuente por 1.475.019.000 a `13552005`) se registró después de cargar la tabla, y septiembre 2026 estaba cargado a mitad de mes (15.939 M de débitos contra 69.326 M en SAP). Se recalcularon desde SAP.

Las cifras de referencia para validar las tablas de SQL Server están en la sección 4 de cada script.

## Endpoints (contrato aprobado el 2026-11-19)

Implementados en `reporting-api`, rama `bi/estados-financieros` (desde `main`), en el módulo `src/estados-financieros.ts`, aparte de `db.ts`, para no cruzarse con las ramas de NS Plantas y consolidado comercial. Compilan; probados sin base de datos (400, 401, 404 y 502). Prueba contra SQL Server y despliegue `pendientes`.

- `GET /api/v1/balance`: `anio` y `mes` obligatorios (400 si faltan), `nivel` y `cuenta` (prefijo) opcionales. Devuelve `rows` del mes, `previousYear` (mismo mes del año anterior), `periods` y `loadedAt`. Los estados acumulados de la app piden el mes y enero.
- `GET /api/v1/cuentas-14-74`: `fechaDesde`, `fechaHasta`, `anio`, `mes`, `cuenta`, `origen`, `tercero`, `search` y paginación. Devuelve el detalle, `summary` con `byAccount` y `byOrigin` sobre todo el filtro (la app suma enero a mes por cuenta), `filterOptions` y `loadedAt`.
- Variables nuevas: `REPORT_BALANCE_TABLE_SCHEMA`, `REPORT_BALANCE_TABLE`, `REPORT_CUENTAS_14_74_TABLE_SCHEMA` y `REPORT_CUENTAS_14_74_TABLE`.

## Pendientes

1. El desarrollador ejecuta `01` y `02`, la primera carga completa de cada SP y la validación.
2. Aprobar el contrato e implementar los endpoints.
3. Cambiar la capa de datos de la app de Estados Financieros a la API y retirar la sincronización por Service Layer y las tablas `sap_*` de Supabase.
