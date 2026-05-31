# The Cab - Informe De Avance, Features Pendientes Y Gaps Contra Product Spec

**Fecha:** 2026-05-31  
**Referencia principal:** `docs/spec/the-cab-product-technical-spec.md` v1.4.3  
**Referencias de soporte:** `docs/spec/the-cab-feature-feasibility-implementation-architecture.md`, `docs/spec/the-cab-brand-spec.md`, planes activos en `specs/`

## 1. Objetivo

Este documento resume el estado actual de implementación de The Cab contra el product spec, lo aprendido durante la revisión del código fuente y los gaps que todavía quedan antes de considerar completo el alcance v1.

No reemplaza el product spec. Funciona como documento de avance para ordenar el cierre de roadmap antes de avanzar con nuevas pantallas y para evitar más drift entre especificación, arquitectura, design system y engine.

Responde:

- Qué está implementado o sustancialmente presente.
- Qué features de primer nivel siguen pendientes.
- Qué gaps quedan en pantallas existentes.
- Qué riesgos quedan en engine, datos, diseño, i18n, chain-awareness y arquitectura.
- Qué secuencia de implementación conviene seguir.

## 2. Alcance Revisado

La revisión se hizo contra:

- Product spec, especialmente secciones de wallet, análisis histórico, navegación, Overview, Pools, Deposits, Strategies, Rewards, Governance, Activity y Settings.
- Documento de arquitectura y factibilidad.
- Brand spec y lineamientos de interfaz premium, técnica, densa y de alto impacto visual.
- Constitución del proyecto y reglas de `AGENTS.md`, especialmente:
  - Design system primero.
  - i18next para copy y formateo.
  - Identidades con `chainId`.
  - No inventar heurísticas.
  - Incertidumbre visible antes que datos fabricados.
  - Request paths leyendo read models o tablas normalizadas.
- Código bajo:
  - `apps/web/src/app`
  - `apps/web/src/features`
  - `apps/web/src/server`
  - `apps/web/src/queries`
  - `apps/web/src/i18n`
  - `apps/web/src/design-system`
- Specs activas hasta `specs/014-activity-dataview`.
- Siguiente spec creado para cerrar Governance: `specs/015-governance-engine-dataview`.

Esta es una revisión estática y de estado de implementación. No certifica que la calidad de datos sea correcta para todas las wallets. El engine todavía necesita regresiones más profundas contra transacciones reales de Base y filas reales de la base analizada.

## 3. Estado General

El producto tiene una base fuerte hasta Activity y una primera implementacion de Governance lista para testing:

- Landing existente.
- Conexión de wallet existente.
- Shell conectado con navegación principal.
- Overview funcional antes y después del análisis.
- Infraestructura de análisis histórico.
- Pools list/detail.
- Deposits list/detail.
- Strategies list/detail.
- Rewards DataView.
- Activity DataView en primera versión funcional.
- Governance DataView en primera version funcional, DB-only y analysis-gated.
- Settings básico.
- Design system interno activo.
- i18next con inglés y español.
- Entidades y query keys ampliamente chain-aware.
- Pipeline de análisis con Trigger.dev.
- Providers Moralis y Alchemy encapsulados.

El producto todavía no cumple todo el product spec porque falta estabilizar el engine con mas evidencia real:

- Governance: implementada como DataView, pero la corrida final de la wallet analizada materializo `0` eventos governance; falta estabilizar clasificacion/materializacion real.
- Activity: implementada en una primera versión funcional, todavía con gaps de engine, fixtures y explainability profunda.

Además, varias pantallas existentes necesitan cerrar gaps de explicabilidad, consistencia visual y semántica de datos.

## 4. Matriz De Estado

| Área | Estado | Nota |
|---|---:|---|
| Landing | Mayormente implementada | Requiere auditoría visual final contra brand spec vigente. |
| Wallet connection | Implementada | Patrón de adapter/wagmi presente, con enforcement de Base. |
| Connected shell | Implementado | Sidebar contiene Overview, Pools, Deposits, Strategies, Rewards, Governance, Activity y Settings. |
| Overview | Implementado con gaps | Existe fast overview, chart, activity preview, allocation y CTA de análisis. El rango default y all-history tienen drift. |
| Analysis jobs | Implementado, requiere hardening | Hay orchestration, slices, provider records, fases y read models. El riesgo principal es clasificación. |
| Pools | Implementado con gaps | Lista/detalle existen. Falta mejor exposición de residual, rebalance y atribución parcial. |
| Deposits | Implementado con gaps | Lista/detalle, lifecycle, chart, movements y decomposition existen. Falta pulir DS y validar semántica. |
| Strategies | Implementado con gaps | Lista/detalle existen. Falta actividad interna dedicada y relación explícita con pools subyacentes. |
| Rewards | Implementado con gaps | DataView existe. Faltan breakdowns completos, custom date range y vista completa de excluidos/no resueltos. |
| Governance | Ready for testing con gap de engine | DataView, API DB-only, filtros, links, selected detail, read models y regression existen. La DB lista de la wallet actual produjo `0` eventos governance, asi que falta hardening de clasificacion/materializacion real. |
| Activity | En implementación avanzada | DataView/API/detail rail ya existen. Checks de typecheck, unit, i18n, DS y regression pasaron. Se desactivo evidencia explorer live por default en `phase-activity`; quedan gaps de explainability profunda y estabilización con mas fixtures reales. |
| Settings | Básico implementado | Faltan limpiar cache local, preferencias de formato numérico y separación más clara de diagnostics. |
| CSV/export | Correctamente ausente | El product spec lo excluye de v1. |

## 5. Fundaciones Ya Implementadas

### 5.1 Shell Y Navegación

El shell conectado ya expresa la arquitectura de producto:

- Overview.
- Pools.
- Deposits.
- Strategies.
- Rewards.
- Governance.
- Activity.
- Settings.

La navegación está acoplada al estado de análisis: las secciones históricas profundas se bloquean hasta que el análisis está listo o stale. Activity y Governance ya tienen primeras versiones funcionales como DataViews DB-only; el riesgo principal se movió al engine y a la calidad de materialización.

### 5.2 Design System

Existe un DS interno y se usa en las pantallas principales. Componentes relevantes:

- `DataTable`.
- `DataTablePagination`.
- `CabImpactMetricCard`.
- `CabKpiStrip`.
- `CabKeyValueList`.
- `CabTokenIcon`.
- `CabTxHash`.
- `CabAnalysisCta`.
- `CabAnalysisStatusBadge`.
- Primitivas de layout como `CabStack`, `CabInline`, `CabCard`, etc.

Aprendizaje importante: el problema ya no es que falte DS, sino que algunas features todavía recrean versiones locales de layout, tablas, barras, métricas o paneles densos. Para mantener consistencia, cualquier componente nuevo debe ser compartido y justificado.

### 5.3 Tablas Y Paginación

Se confirmó que la tabla principal de Pools no había regresado: seguía usando `DataTable`. El drift estaba en subtablas o composiciones embebidas que todavía usaban HTML manual.

Cambios recientes alineados al plan:

- `DataTable` soporta superficies `card` y `embedded`.
- `DataTablePagination` queda como componente compartido del DS.
- Rewards, Strategies, Deposits y Pools usan paginación compartida.
- La paginación debe sentirse técnica, estable y sin reload visual de página.

Gap remanente: seguir revisando futuras tablas para evitar paginadores o `<table>` feature-locales.

### 5.4 i18n Y Formateo

i18next es la librería de i18n del proyecto. La regla vigente es no inventar formateo local con `new Intl`, `toFixed` o strings manuales dentro de features cuando existe un formatter central.

Estado actual:

- Hay namespaces en inglés y español.
- Hay checks de paridad.
- Hay helpers en `apps/web/src/i18n/formatters.ts`.
- Se avanzó en reemplazar formateo local.

Gaps:

- Continuar removiendo formateo ad hoc.
- Evitar copy hardcodeado en Governance y Activity desde el inicio.
- Traducir labels de enums con i18next, no mostrar códigos crudos.

### 5.5 Chain Awareness

Product v1 es Base-only, pero la arquitectura debe expresarlo como config y no como magic constants dispersas.

Estado actual:

- Existen helpers chain-aware en `apps/web/src/chains/chains.ts`.
- Existe capa server en `apps/web/src/server/chains/index.ts`.
- Varias tablas, queries y keys ya incluyen `chainId`.
- Los explorer links migran hacia helpers centralizados.

Gaps:

- Seguir buscando hardcodes de Base/BaseScan fuera de config.
- Governance y Activity deben nacer chain-aware.
- El futuro soporte multi-chain no debe requerir reescribir todas las features.

### 5.6 Pipeline De Análisis

El pipeline tiene estructura durable:

- API para start/status/cancel.
- Trigger.dev orchestration.
- Slices históricos.
- Provider records.
- Fases para depósitos, rewards, activity, pools y finalize.
- Read models.
- Scripts de regresión para estrategias y rewards.

El riesgo principal ya no es infraestructura sino calidad semántica:

- Clasificación incorrecta.
- Atribución dudosa.
- Rewards fabricados desde spam/airdrops.
- Cobertura no-full mostrada como si fuera total.
- Relaciones depósito/estrategia/pool resueltas sin identidad explícita.

Ejemplo corregido y a mantener como regresión:

```txt
0xca23a1618b416be4f082ae26e59dd9bfcea5e028f00a2cd9f1b8dd95fbff77ea
```

Esa transacción es un airdrop de phishing y no debe sumar como reward. Los casos clasificados como `airdrop` o con `economicExclusionReason: "airdrop_spam"` deben persistir como excluidos, no como rewards resueltos.

## 6. Features Pendientes De Primer Nivel

### 6.1 Governance Engine Y DataView

**Estado:** ready for testing con gap de engine. Implementado bajo `specs/015-governance-engine-dataview`.

El product spec requiere una sección Governance de primer nivel. Debe cubrir:

- veAERO locks.
- Creación, incremento, extensión y relock.
- Votos por epoch.
- Resets de voto.
- Relay participation.
- Voting fees.
- Bribes.
- Rebases.
- Retornos governance.
- Rewards governance asociados a pools cuando haya evidencia.

Existe hoy:

- Ruta `/governance`.
- API `/api/governance` DB-only.
- Módulo `features/governance` con container/component split.
- Repositorio, service y route layer.
- Read models governance para events, lock exposure, epoch summaries, reward rows y metric snapshots.
- KPI strip, lock panel persistente, timeline compacta por epoch, rewards table, breakdown y selected-detail rail.
- Filtros, search, paginación compartida, URL state, chips activos y estados empty/locked/partial.
- Links explícitos hacia Activity, Rewards y Pools cuando existe identidad/evidencia.
- Namespace i18n inglés/español y copy visible sin `n/a` feature-local.
- Regresión governance que preserva el airdrop phishing conocido como excluded.

Falta o queda parcial:

- La DB lista de la wallet actual produjo `0` eventos governance, por lo que no hay evidencia de materialización poblada para esa wallet.
- El engine todavía necesita más fixtures reales para veAERO/VotingEscrow, Voter, relays, bribe/fee/reward distributors y AERO transfers relacionados.
- La validación visual con estado poblado requiere una wallet/fixture con actividad governance materializada.

Recomendación:

1. Mantener Governance como DataView analysis-gated y DB-only.
2. Usar Activity para encontrar por qué las tx governance reales no se materializan en esta wallet.
3. Expandir fixtures/regresiones con transacciones governance reales.
4. Mostrar cobertura limitada cuando falte decode, epoch, pool o reward association.
5. Reutilizar rewards compartidos sin duplicar totals.

### 6.2 Activity DataView

**Estado:** implementación avanzada, lista para testing funcional con limitaciones conocidas.

Activity debe ser el audit trail transaccional detrás de cada métrica del producto.

Existe hoy:

- Ruta `/activity`.
- API `/api/activity` DB-only.
- Módulo `features/activity` con container/component split.
- KPI strip con componentes de impacto del DS.
- Filtros, chips activos, paginación compartida y selección sin reload visual.
- Ledger con `DataTable`.
- Panel derecho de detalle con movimientos, entidades vinculadas, evidencia y notas de cobertura.
- Charts DS de actividad/cobertura.
- Read-model helper puro para filas/summary.
- Cliente explorer suplementario background-only para BaseScan.
- Persistencia de evidencia explorer como `raw_provider_records`.
- Metadatos de evidencia suplementaria en clasificación.
- Regresión determinística para el airdrop phishing conocido.

Falta o queda parcial:

- Rebalance/source allocation explanation profunda desde `canonicalInference`.
- Links explícitos desde todas las superficies existentes hacia Activity.
- Más fixtures determinísticas para explorer-enriched, ambiguous, unsupported y Mellow strategy rows.
- Governance processing sigue limitado por materialización real en la wallet actual, por lo que Activity todavía es clave para auditar por qué no aparecen eventos governance.
- Más clasificación engine contra transacciones reales; no agregar heurísticas de ownership sin evidencia explícita.

Recomendación:

1. Usar Activity para auditar el engine antes de cerrar Governance.
2. Expandir regresiones con casos reales por tipo de superficie.
3. Completar links cross-surface donde exista entidad explícita.
4. Completar rebalance/source allocation sólo con datos persistidos por `canonicalInference`.
5. Mantener request paths DB-only y explorer evidence sólo en background.

### 6.2.1 Activity - Snapshot De Validación 2026-05-30

Checks ejecutados:

```bash
pnpm --dir apps/web typecheck
pnpm --dir apps/web test:unit
pnpm --dir apps/web i18n:check
pnpm --dir apps/web ds:check
pnpm --dir apps/web analysis:activity-regression
```

Resultado relevante:

- `test:unit` pasa con 280 tests.
- La regresión del tx `0xca23a1618b416be4f082ae26e59dd9bfcea5e028f00a2cd9f1b8dd95fbff77ea` pasa.
- La DB local tenía una reward pre-fix en estado `unresolved`; se reparó con `analysis:activity-regression -- --repair` y luego la regresión normal quedó verde.
- El engine ahora actualiza reward rows asociadas a ledger rows clasificadas como `airdrop` para dejarlas `excluded`, sin pool, sin USD contribution y con `airdrop_spam`.

## 7. Gaps Remanentes Por Feature

### 7.1 Overview

Gaps detectados:

- El product spec pide default range de 7 días en connected dashboard; hay señales de default 30d en algunas superficies.
- Debe quedar claro cuándo se muestra fast overview vs historical analysis.
- La experiencia all-history debe ser consistente con el estado del análisis.
- El auto-refresh/stale state necesita revisión para no comunicar frescura falsa.
- Hay que seguir limpiando formatters locales.
- La activity preview depende de Activity DataView para trazabilidad completa.

### 7.2 Pools

Implementado:

- Lista principal.
- Detail route.
- Métricas.
- Composición.
- Rewards vinculadas.
- Paginación DS.
- Tabla principal con `DataTable`.

Gaps:

- El panel de residual attribution del product spec todavía no está completo como explicación de primer nivel.
- La atribución parcial debe mostrar mejor causa, alcance y efecto en totales.
- El rebalance timeline necesita más detalle y narrativa técnica.
- La composición expandida ya se movió hacia embedded table, pero hay que mantener esa regla en futuras expansiones.
- Falta revisar que todo link externo sea chain-aware.

### 7.3 Deposits

Implementado:

- Lista.
- Detail.
- Lifecycle.
- Movements.
- Decomposition.
- Métricas.
- Relación con pools.

Gaps:

- Algunos KPI visuales venían de componentes menos impactantes que `CabImpactMetricCard`; hay que terminar de alinear todas las métricas hero.
- Debe mantenerse la separación estricta entre rewards de depósito manual y rewards de estrategia.
- Casos Mellow/no-Aerodrome deben quedar explícitamente excluidos o partial según spec, no mezclados.
- La estimación de return debe explicar cobertura y denominador.
- Revisar copy y formatters locales restantes.

### 7.4 Strategies

Implementado:

- Lista.
- Detail.
- Métricas.
- Relaciones básicas.
- Mejoras recientes con `CabImpactMetricCard` y `CabKeyValueList`.

Gaps:

- Falta una sección de actividad interna de estrategia más completa.
- Falta explicar mejor la relación estrategia -> pool subyacente -> rewards.
- El detail debe dejar clara la evidencia usada para `strategy_exposure_id`.
- Deben evitarse inferencias por pool/time-window cuando falta identidad explícita.
- Falta revisar que todos los paneles densos usen DS en vez de layout feature-local.

### 7.5 Rewards

Implementado:

- DataView principal.
- KPI.
- Chart histórico.
- Tabla.
- Detail rail.
- Filtros.
- Excluidos/no resueltos.
- Links de explorer.
- Selección sin navegación full reload visible.
- Loading inline en selected reward.

Gaps:

- Custom date range todavía no está completo como control de producto.
- Falta completar breakdown por reward type/category.
- Falta completar breakdown strategy/governance con el mismo nivel que source/pool/token.
- La vista completa de unresolved/excluded activity debe estar navegable y no quedar sólo como panel lateral parcial.
- La línea de return/APR debe explicar claramente si es estimated, realized, historical capital-based o cobertura parcial.
- Falta seguir validando datos reales porque la UI ya está aceptable, pero el engine todavía clasifica mal algunos casos.

### 7.6 Settings

Implementado:

- Wallet/status.
- Analysis controls.
- Display básico.
- Diagnostics básico.

Gaps:

- Falta clear local UI cache.
- Falta preferencia de number formatting.
- Falta separar mejor diagnostics operativos de configuración de usuario.
- Falta asegurar que Settings no dispare invalidaciones con query keys literales.
- Falta revisar stale/reanalyze UX contra product spec.

## 8. Gaps De Engine Y Datos

Este es el mayor riesgo del producto.

Reglas que deben preservarse:

- Rewards de estrategia resuelven por `strategy_exposure_id`.
- Rewards de depósito manual resuelven por identidad de depósito.
- Rewards de depósito manual no deben incluir rewards de estrategias.
- Pools pueden agregar depósito manual + estrategia resuelta, sin doble conteo.
- Si falta evidencia, el evento queda unresolved, partial, unavailable o excluded.
- No se debe inferir ownership por pool y ventana temporal cuando la spec exige identidad explícita.

Gaps principales:

- Clasificación spam/airdrop debe seguir endureciéndose.
- Eventos governance parcialmente reconocidos necesitan read model y DataView.
- Activity debe permitir auditar por qué una transacción terminó clasificada como reward, deposit, strategy event, governance event, excluded o unresolved.
- Los totals deben excluir eventos excluidos y no resueltos salvo que el copy indique claramente lo contrario.
- Coverage y confidence deben estar presentes en todos los niveles agregados.
- Historical-capital reward return necesita validación contra datos reales y documentación de fórmula.
- Debe existir regresión determinística para transacciones conocidas buenas, ambiguas y malas.

## 9. Drift Arquitectónico A Vigilar

### 9.1 Design System

Drift observado:

- Features creando cards, barras, paginadores, key-values o tablas propias.
- `div`/HTML manual donde ya hay primitives DS.
- KPI locales en vez de `CabImpactMetricCard`.

Regla:

- Nuevos componentes DS sólo si son compartidos.
- Si una feature necesita algo custom, primero revisar Overview/Pools/Deposits/Strategies para patrón existente.
- Si se agrega DS nuevo, documentar qué pantallas deberían adoptarlo.

### 9.2 Container/Component

Debe mantenerse:

- Container: data fetching, URL/query state, mappers.
- Component: presentación, estados visuales, callbacks.
- Server route/service/repository separados.

Riesgo:

- Activity y Governance son grandes y pueden mezclar rápido data + UI si no arrancan con este patrón.

### 9.3 i18n

Drift observado:

- Formateo local.
- Labels derivados de enum raw.
- Copy hardcodeado en componentes.

Regla:

- i18next para copy.
- `@/i18n/formatters` para números, moneda, porcentajes, fechas y compact values.

### 9.4 Query Keys

Drift observado:

- Invalidaciones con arrays literales.

Regla:

- Usar `queryKeys`.
- Toda key relevante debe llevar `walletAddress` y `chainId` cuando corresponda.
- Interacciones de tabla/filtro/selección no deben producir full page reload visual.

### 9.5 Chain/Explorer

Drift observado:

- BaseScan o chain IDs hardcodeados en algunos caminos históricos.

Regla:

- Usar chain config/capabilities.
- Product v1 puede ser Base-only, pero expresado como configuración.

## 10. Secuencia Recomendada

### Paso 1 - Activity DataView

Motivo:

- Es la auditoría que falta para entender el engine.
- Ayuda a depurar clasificación antes de seguir agregando capas.
- Sirve como base para Governance y para cerrar gaps en Rewards/Strategies/Deposits.

Alcance:

- `/activity`.
- API y repository/service.
- Timeline paginado.
- Filtros.
- Detail rail.
- Links a entidades.
- Estados unresolved/partial/excluded.
- DS `DataTable` + `DataTablePagination`.

### Paso 2 - Hardening Del Engine

Motivo:

- La UI ya muestra suficiente superficie como para exponer errores.
- El problema principal actual es calidad de clasificación.

Alcance:

- Regresiones con transacciones reales.
- Spam/airdrop exclusions.
- Governance detection.
- Strategy exposure correctness.
- Deposit identity correctness.
- Aggregates sin doble conteo.
- Coverage/confidence propagation.

### Paso 3 - Governance DataView

Motivo:

- Ya está implementada como primera versión DataView.
- Depende de tener eventos governance reales materializados para validar estados poblados.

Alcance:

- Locks.
- Votes.
- Rewards governance.
- Rebases.
- Relay.
- Detail rail.
- Pool/reward links.
- Coverage states.

### Paso 4 - Cierre De Gaps En Pantallas Existentes

Orden sugerido:

1. Rewards breakdowns y custom date range.
2. Pools residual/rebalance explanation.
3. Strategies internal activity.
4. Deposits semantic/visual polish.
5. Overview default range/all-history/stale UX.
6. Settings cache/number preferences/diagnostics.

### Paso 5 - Pase De Consistencia Product-Wide

Checklist:

- No tablas manuales cuando aplica `DataTable`.
- No paginadores custom.
- No KPI hero fuera de `CabImpactMetricCard`.
- No `new Intl`/`toFixed` feature-local.
- No BaseScan hardcodeado.
- No query invalidation literal.
- No copy hardcodeado.
- No divs custom cuando DS primitives resuelven el layout.

## 11. Roadmap Spec Kit Sugerido

### `014-activity-dataview`

Objetivo: crear la pantalla Activity como audit trail transaccional.

Debe incluir:

- Spec.
- Plan.
- Data model/read model.
- API contract.
- Tasks.
- Regression cases.
- UI con DS.

### `015-governance-engine-dataview`

Objetivo: crear la pantalla Governance como sección first-class y agregar procesamiento/materialización governance al engine.

Estado:

- Tasks completas.
- Typecheck, unit, i18n, DS y regression pasan.
- Request path DB-only verificado.
- Gap remanente: la wallet actual no materializa eventos governance poblados.

### `016-product-spec-gap-closure`

Objetivo: cerrar gaps restantes de pantallas existentes.

Debe incluir:

- Overview range/stale UX.
- Pools residual/rebalance.
- Rewards custom range y breakdowns.
- Strategies internal activity.
- Deposits visual/semantic polish.
- Settings preferences/cache.
- DS/i18n/query/chain consistency pass.

## 12. Checklist Para Considerar v1 Completo

- Governance tiene DataView funcional.
- Activity tiene DataView funcional.
- Overview comunica correctamente fast vs historical data.
- Pools explica residual, partial attribution y rebalance.
- Deposits separa manual deposits de strategy-owned rewards.
- Strategies muestra actividad interna y evidencia de ownership.
- Rewards excluye spam/airdrops de aggregates.
- Rewards muestra unresolved/excluded sin romper layout.
- Settings incluye preferencias faltantes.
- Todas las pantallas usan DS compartido.
- Todas las tablas usan `DataTable`.
- Toda paginación usa `DataTablePagination`.
- Todo copy visible usa i18next.
- Todo formateo usa formatters centralizados.
- Todos los explorer links usan chain config.
- Todas las query keys relevantes incluyen wallet/chain scope.
- No hay request-time provider/RPC calls en APIs históricas.
- Regression suite cubre transacciones buenas, ambiguas y maliciosas.

## 13. Conclusión

The Cab está en una etapa avanzada de construcción de vistas históricas, pero todavía no está cerrado contra el product spec. La UI principal ya permite ver suficiente producto como para avanzar, pero también expone que el engine necesita un pase fuerte de clasificación, coverage y regresión.

La recomendación es no seguir puliendo Rewards visualmente por ahora. Activity y Governance ya existen como DataViews first-class; conviene usarlas para auditar el engine, estabilizar clasificación/materialización con transacciones reales, y después volver a cerrar los gaps de Overview, Pools, Deposits, Strategies, Rewards y Settings con una pasada de consistencia DS/i18n/chain/query.

La regla más importante para los próximos pasos es mantener visible la incertidumbre. Cuando falte evidencia, el producto debe mostrar unresolved, partial, excluded o unavailable. No debe fabricar ownership, rewards, lifecycle events ni aggregates para que una pantalla parezca más completa.
