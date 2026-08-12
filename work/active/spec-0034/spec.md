---
tipo: debt
origen: manual (residuo declarado de spec-0033)
---

# spec-0034: Cerrar las validaciones pendientes de la documentación

## Deuda Técnica

**Situación actual:** `spec-0033` migró la documentación de LikeC4 a Mermaid y dejó un
gate de CI (`tools/validate-diagrams.ts`) que verifica que **todo identificador de un
bloque Mermaid nombre un símbolo real del código**. Ese gate cubre una sola dirección y un
solo tipo de error. Quedan cuatro huecos, declarados explícitamente como fuera de alcance
en su momento:

1. **Las 47 traducciones nunca se verificaron semánticamente.** Cada `dynamic view` se
   tradujo a `sequenceDiagram` **a mano**. El gate detecta un participante que nombra una
   clase inexistente, pero **no** detecta un mensaje perdido, dos pasos invertidos, o una
   flecha que apunta al componente equivocado. Un diagrama puede estar en verde y mentir.

2. **El gate es unidireccional.** Verifica diagrama → código, no código → diagrama. Hoy hay
   29 handlers, 6 controllers y 8 projectors, contra 44 flujos documentados: nada garantiza
   que la diferencia sea intencional. Los dos casos de uso implementados y sin doc que
   `spec-0033` encontró (`record-opening-balance`, `merge-transfers`) aparecieron **de
   casualidad**, al revisar vistas huérfanas — no porque un mecanismo los detectara.

3. **Tres carpetas de código no tienen unidad de documentación propia.** Se resolvieron
   mapeando varias raíces a una misma unidad, lo que funciona pero difumina la frontera:

   | Carpeta de código | Documentada bajo | Por qué |
   |---|---|---|
   | `apps/ledger/src/ledger` | `docs/accounts` | decisión previa: el ciclo de vida del ledger vive ahí «por cercanía» |
   | `apps/ledger/src/config` | `docs/shared` | el bootstrap de Swagger |
   | `apps/ledger/src/tooling` | `docs/shared` | los verificadores CLI (`ChainVerifier`, `ConsistencyVerifier`) |

4. **`libs/shared` no tiene unidad de documentación.** Tiene `README.md`, pero no
   `docs/flows/` ni diagrama de componentes, y aporta símbolos que los diagramas de otras
   unidades nombran (`canonicalJson`, `sha256Hex`, `Money`). Hoy entra al gate solo como
   raíz compartida, lo que la vuelve un comodín: cualquier unidad puede nombrar cualquier
   símbolo suyo sin que nada lo cuestione.

**Riesgo o costo:** el gate actual da una **confianza asimétrica** — atrapa la referencia
rota, que es el error barato de encontrar, y deja pasar el diagrama que describe mal el
sistema, que es el caro. Es el modo de fallo más incómodo de una herramienta de
verificación: el verde no significa lo que el lector cree que significa. La deuda 2 además
garantiza que el código nuevo pueda quedar sin documentar indefinidamente sin que nadie se
entere, que es exactamente cómo nacieron los dos flujos faltantes de `spec-0033`.

**Estado deseado:** la correspondencia entre documentación y código se verifica en **ambas
direcciones** y con **fidelidad de contenido**, no solo de nombres. Cada carpeta de código
tiene una unidad de documentación identificable, y ninguna se documenta desde otra por
conveniencia.

## Criterios de Aceptación

### AC-1: La fidelidad de las traducciones queda verificada contra el original

Los 47 `sequenceDiagram` migrados en `spec-0033` se comparan contra las `dynamic view` de
las que salieron. **Los `.c4` originales siguen recuperables desde git** — se borraron en
los commits `8c550bc`, `ebb2b1e`, `9e7fd3a` y `7172c28` de la rama
`docs/SPEC-0033-mermaid-diagrams`, así que la comparación no depende de la memoria de
nadie.

Por cada vista original y su traducción se verifica que coincidan: el **número de
mensajes**, el **orden**, el **origen y destino** de cada uno, y el **texto** del mensaje.

Las discrepancias se reportan con archivo, vista y la diferencia concreta. Toda
discrepancia hallada se corrige en el diagrama, nunca en el código.

[NEEDS CLARIFICATION: ¿la verificación es un script reutilizable o un chequeo puntual que
se descarta al terminar? Un script exige parsear LikeC4, que es trabajo real para algo que
solo sirve una vez — pero un chequeo manual sobre 47 diagramas es propenso al mismo error
que busca detectar.]

### AC-2: El gate detecta código sin documentar

`tools/validate-diagrams.ts` gana la dirección inversa: por cada unidad de documentación,
todo símbolo **documentable** de su raíz de código debe aparecer en algún bloque Mermaid de
esa unidad.

[NEEDS CLARIFICATION: ¿qué cuenta como «documentable»? Exigirlo de toda clase exportada
llenaría el reporte de DTOs, VOs y excepciones. La frontera natural parece ser
`*.handler.ts`, `*.controller.ts` y `*.projector.ts` — 43 símbolos hoy —, pero eso deja
fuera puertos y agregados, que sí aparecen en los diagramas de componentes.]

[NEEDS CLARIFICATION: ¿esta dirección bloquea el merge o solo reporta? `spec-0033` la dejó
fuera precisamente porque hoy dejaría el CI en rojo hasta cerrar todos los gaps. Si
bloquea, hay que documentar lo que falte **dentro de este ítem**; si solo reporta, el gate
se puede ignorar indefinidamente.]

### AC-3: Cada carpeta de código tiene una unidad de documentación identificable

Se resuelve el mapeo N:1 de las tres carpetas listadas en el encuadre: o cada una recibe su
propia unidad (`docs/` con su README y sus flows), o se documenta por escrito **en el
README de la unidad que la aloja** por qué vive ahí, de modo que el mapa del validador deje
de ser la única fuente de esa decisión.

Tras el cambio, el mapa `UNITS` de `tools/validate-diagrams.ts` refleja fronteras
declaradas en la documentación, no acomodos para que el gate pase.

[NEEDS CLARIFICATION: ¿`src/ledger` merece unidad propia? Tiene agregado
(`LedgerSettings`), 3 casos de uso y su propio controller — estructuralmente es un módulo
como los otros 5, y solo está bajo `accounts` por una decisión de cercanía tomada cuando el
código todavía vivía junto.]

### AC-4: `libs/shared` deja de ser un comodín del gate

`libs/shared` recibe unidad de documentación propia (`libs/shared/docs/`) con su diagrama
de componentes, o se declara explícitamente que no la necesita y se acota su rol como raíz
compartida a un conjunto nombrado de símbolos, en vez de admitir cualquiera.

### AC-5: El gate sigue probado, no solo en verde

La verificación negativa que `spec-0033` dejó como paso manual del plan se automatiza: el
`spec` de `tools/validate-diagrams.ts` cubre que el gate **falle** ante cada clase de error
que dice detectar — referencia rota en `sequenceDiagram`, referencia rota en `flowchart`,
y (nuevo) símbolo sin documentar.

Un gate que solo se prueba en verde es indistinguible de uno que no verifica nada; es
precisamente el fallo que `spec-0033` encontró en `validate-skills.sh`, que reportaba «sin
issues» mientras no revisaba ningún archivo.

## Reglas de Negocio

- **Ningún cambio en el código de aplicación.** Este ítem toca documentación, el validador
  y su configuración. Si una verificación revela que un diagrama miente, se corrige el
  diagrama; si revela que falta documentación, se escribe. El código de `apps/ledger/src/`
  y `libs/*/src/` no se modifica.
- **Los `.c4` archivados en `work/done/` no se tocan.** Siguen congelados como registro de
  las historias cerradas, igual que estableció `spec-0033`.
- **La corrección de un diagrama conserva la traducción 1:1.** Si AC-1 encuentra una
  discrepancia, se corrige hacia lo que decía la vista original — no se aprovecha para
  reescribir o enriquecer el flujo. Eso sería otra historia.

## Fuera de Alcance

- **Rehacer el contenido de los flujos.** Igual que en `spec-0033`: si un `flows/*.md`
  documenta mal su caso de uso, eso se corrige en su propia historia. Acá solo se verifica
  que el diagrama coincida con lo que la vista original decía.
- **Extender el gate a `docs/architecture/`.** Los diagramas L1/L2 nombran actores y
  containers, no clases; siguen deliberadamente fuera del validador.
- **Documentar `apps/finances`.** El monolito está congelado y no tiene unidades de
  documentación; incorporarlo al gate es otra decisión.

## Notas de secuenciación

**AC-1 tiene ventana.** Depende de recuperar los `.c4` desde git, y aunque el historial es
permanente, la comparación es tanto más barata cuanto menos hayan evolucionado los flujos
desde la migración. Cada historia que pase por `/design` y toque un `flows/*.md` agrega una
diferencia legítima que hay que distinguir de un error de traducción.

AC-2 y AC-3 no tienen esa urgencia, pero **AC-2 conviene resolverlo antes de que entren
casos de uso nuevos**: es el mecanismo que evita que se repita lo que ya pasó dos veces.
