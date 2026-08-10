# hu-0031: Plan de cuentas declarativo y versionado

> Origen: [`docs/proposals/formance-ledger-ideas.md`](../../../docs/proposals/formance-ledger-ideas.md)
> — hallazgos **F-8** (chart of accounts) y **F-9** (modo estricto vs. permisivo).
> Épica: [EP-6](../../ledger/EP-6-formance.md), Ola 3.

## Historia de Usuario

**Como** dueño del ledger
**Quiero** declarar qué nombres de cuenta son válidos en mi plan contable
**Para** que la jerarquía no se degrade con el tiempo en variantes duplicadas
(`Expenses:Comida` junto a `Expenses:Food`) que ninguna proyección detecta porque no son un
error, solo un plan de cuentas sucio

## Criterios de Aceptación

### AC-1: El plan de cuentas se declara de forma estructurada

Existe una declaración del plan de cuentas que describe, por nivel de la jerarquía:

- **segmentos fijos**: nombres literales permitidos (`Assets`, `Bancolombia`, `Ahorros`);
- **segmentos variables**: un comodín con nombre que acepta cualquier valor que cumpla un
  patrón (p. ej. `Assets:<banco>:<producto>` donde `<banco>` acepta lo que el patrón permita);
- **qué nodos son cuentas** y cuáles son solo contenedores de otras cuentas.

### AC-2: La validación ocurre al abrir y al renombrar cuentas

El plan se valida en `OpenAccount` y `RenameAccount`, que es donde nacen y cambian los nombres.

**No** se validan postings: Formance valida postings porque sus cuentas nacen implícitas al
primer uso; aquí las cuentas se abren explícitamente (INV-3), así que validar postings sería
redundante.

### AC-3: Los errores nombran el segmento exacto que falla

Un nombre rechazado produce un error que indica qué segmento falló y por qué: que no está
declarado en el plan, o que no cumple el patrón del segmento variable en esa posición.

Un error genérico del tipo "nombre inválido" no cumple este AC.

Código de error estable: `ACCOUNT_NOT_IN_CHART` (RF-14).

### AC-4: El plan es un evento versionado del stream

La declaración del plan entra al stream como evento (principio de diseño #2), con versión.
Cada evento de cuenta registra contra qué versión del plan fue validado.

Redefinir el plan es un evento nuevo, no una edición del anterior. El historial de qué plan
regía en cada momento queda en el stream.

### AC-5: Metadata por defecto por nodo del plan

Un nodo del plan puede declarar metadata por defecto que se aplica a las cuentas que nacen bajo
él (p. ej. "toda cuenta bajo `Assets:*` es espejo bancario").

Deja de ser un flag que el cliente repite en cada apertura.

> Depende de que exista metadata de cuenta: ver `hu-0032`. Si esta historia se ejecuta antes,
> este AC se limita a los atributos que `Account` ya tiene.

### AC-6: Modo estricto y modo permisivo

La validación tiene dos modos:

- **estricto**: la violación aborta la operación;
- **permisivo**: la violación se registra (log y atributo de traza) y la operación continúa.

Es el patrón de rollout que hace segura la introducción de cualquier validación nueva sobre
datos existentes: se despliega en permisivo, se observa cuántas violaciones reales aparecen, se
limpian, y recién entonces se activa estricto.

### AC-7: El plan es opcional

Un ledger sin plan declarado sigue funcionando exactamente como hoy: `AccountName` valida los
cinco tipos raíz y la forma del nombre, y nada más.

Declarar un plan es una decisión del usuario, no un requisito para operar.

[NEEDS CLARIFICATION: cuando se declara un plan por primera vez sobre un ledger que ya tiene
cuentas abiertas que no lo cumplen, ¿qué pasa? ¿Se rechaza la declaración, se acepta y las
cuentas existentes quedan marcadas como no conformes, o se acepta en modo permisivo
obligatoriamente hasta que se limpien?]

### AC-8: Las cuentas técnicas siempre son válidas

`Equity:OpeningBalances` y `Equity:Adjustments` (INV-13) son válidas con o sin plan declarado, y
un plan no puede excluirlas. Un plan que las rechazara dejaría el ledger inoperable.

## Reglas de Negocio

- El tipo raíz de una cuenta sigue siendo inmutable (INV-14) y los cinco tipos raíz siguen
  siendo los de §2.1: el plan restringe **dentro** de esa estructura, no la reemplaza.
- El riesgo principal es de producto, no técnico: un plan demasiado rígido convierte "abrir una
  cuenta nueva" en "editar el plan primero". El modo permisivo (AC-6) y la opcionalidad (AC-7)
  son la mitigación.

## Fuera de Alcance

- Reglas de cuenta más allá del nombre (`.rules` en la fuente): en Formance el campo existe pero
  está vacío. No se adopta lo que ni la fuente usa todavía.
- Validación de postings contra el plan (AC-2 explica por qué no aplica).
- Sugerencia automática de categorías apoyada en el vocabulario cerrado del plan: es capa de
  producto (§4.2). Esta historia produce el vocabulario; usarlo es de otro componente.
