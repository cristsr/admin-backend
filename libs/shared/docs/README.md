# libs/shared — Utilidades transversales del monorepo

> C4 Nivel 3 · documentación viva. Los nodos nombran la clase real; el gate de CI
> (`npm run docs:validate`) falla si alguno deja de existir.

## Propósito

Librería compartida entre `apps/finances` y `apps/ledger`. Provee tipos genéricos
(`Nullable<T>`, `ObjectLiteral`), jerarquía de excepciones de dominio
(`DomainException`, `BaseException`), filtro global de errores HTTP
(`ExceptionFilter`), funciones de hashing criptográfico (`canonicalJson`, `sha256Hex`),
el patrón `Criteria` para queries tipadas, y el módulo de autenticación OIDC
(`AuthModule`, `JwtStrategy`).

No contiene handlers, controllers ni projectors — es una librería de soporte, no un
módulo de negocio. El gate inverso (código → diagrama) no le aplica.

## Diagramas

**Componentes (C4 Nivel 3).**

```mermaid
flowchart TB
  subgraph exceptions["Exceptions"]
    BE("BaseException")
    DE("DomainException")
    DNF("DomainNotFoundException")
    DCF("DomainConflictException")
    DUP("DomainUnprocessableException")
    ICF("InvalidConfigurationException")
  end

  subgraph functions["Functions"]
    CJ("canonicalJson")
    SH("sha256Hex")
  end

  subgraph filters["Filters"]
    EF("ExceptionFilter")
  end

  subgraph criteria["Criteria"]
    CT("Criteria")
    CFQ("criteriaFromQuery")
  end

  subgraph auth["Auth"]
    JS("JwtStrategy")
    JG("JwtAuthGuard")
    AM("AuthModule")
  end

  subgraph types["Types"]
    NL("Nullable")
    OL("ObjectLiteral")
  end

  DE --> BE
  DNF --> DE
  DCF --> DE
  DUP --> DE
  ICF --> BE

  CJ --> SH
  EF --> DE
```

## Notas

- `Money` existe en dos versiones independientes: `apps/finances/src/shared/domain/money.ts`
  (basada en `number`) y `apps/ledger/src/shared/domain/money/money.ts` (basada en `Big`).
  Los diagramas de cada app referencian su propia versión.
- Esta unidad no tiene `flows/` porque no expone casos de uso propios. Los símbolos que
  otras unidades nombran (`canonicalJson`, `sha256Hex`, `DomainException`) están
  documentados en el diagrama de componentes de arriba.
