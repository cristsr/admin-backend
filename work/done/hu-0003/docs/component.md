# Componentes: accounts + transactions (apps/ledger)

> C4 Nivel 3 — building blocks internos de los módulos `accounts/` y `transactions/`.
> Documento acumulativo: incluye componentes de `hu-0003` (EP-1.6 + EP-1.7).

## accounts

```mermaid
graph TD
  subgraph domain["Domain Layer — accounts"]
    AA("Account
    aggregate
    open / rename / close
    ensureOpenOn / ensureAcceptsCurrency")
    A_OPEN("AccountOpened
    event")
    A_REN("AccountRenamed
    event")
    A_CLOSE("AccountClosed
    event")
    A_EXC("AccountException
    7 exception classes")
  end

  subgraph application["Application Layer — accounts"]
    AR("AccountRepository
    extends EventSourcedRepository&lt;Account&gt;")
    AVS("AccountValidationService
    INV-3 / INV-4 cross-validation")
    OAH("OpenAccountHandler
    command handler")
    RAH("RenameAccountHandler
    command handler")
    CAH("CloseAccountHandler
    command handler")
  end

  subgraph infrastructure["Infrastructure Layer — accounts"]
    AC("AccountsController
    POST /accounts · GET /accounts
    GET /accounts/{id} · GET /accounts/{id}/balance
    POST /accounts/{id}/rename · POST /accounts/{id}/close")
    AHM("AccountsHttpModule")
    ATP("AccountTreeProjector
    proj_accounts")
  end

  AA --> A_OPEN
  AA --> A_REN
  AA --> A_CLOSE
  AA --> A_EXC
  AR --> AA
  OAH --> AR
  OAH --> AA
  RAH --> AR
  RAH --> AA
  CAH --> AR
  CAH --> AA
  AVS --> AA
  AC --> OAH
  AC --> RAH
  AC --> CAH
  AC --> AHM
  ATP --> AA
```

## transactions

```mermaid
graph TD
  subgraph domain_tx["Domain Layer — transactions"]
    TA("LedgerTransaction
    aggregate
    record / amend / annotate
    confirm / void / reverse")
    TS("TransactionStatus
    PENDING / CONFIRMED / VOIDED")
    TA_ANN("TransactionAnnotations
    type")
    BR("BalanceRule
    abstract class
    INV-11")
    ZBR("ZeroSumBalanceRule
    INV-1 implementation")
    PL("PostingLine
    value object")
    PS("PostingSerializer")
    DK("DerivedKind
    enum")
    TKD("TransactionKindDeriver
    RF-4 classification")
    TEV("TransactionEvent
    6 event classes")
    T_EXC("TransactionException
    exception classes")
    ALP("AccountLookupPort
    abstract port for INV-3/INV-4")
    TCS("TransferCandidateStore
    port")
  end

  subgraph application_tx["Application Layer — transactions"]
    TR("LedgerTransactionRepository
    extends EventSourcedRepository&lt;LedgerTransaction&gt;")
    PIT("PostingInput
    type")
    PF("PostingFactory
    PostingInput[] → PostingLine[]")
    RTH("RecordTransactionHandler")
    ATH("AmendPendingTransactionHandler")
    ANH("AnnotateTransactionHandler")
    CTH("ConfirmTransactionHandler")
    VTH("VoidPendingTransactionHandler")
    RTH2("ReverseConfirmedTransactionHandler")
  end

  subgraph infrastructure_tx["Infrastructure Layer — transactions"]
    TC("TransactionsController
    POST /transactions · GET /transactions · GET /transactions/{id}
    POST /transactions/{id}/amend
    POST /transactions/{id}/annotate
    POST /transactions/{id}/confirm
    POST /transactions/{id}/void
    POST /transactions/{id}/reverse")
    THM("TransactionsHttpModule")
    TLP("TransactionListProjector
    proj_transactions · proj_postings")
    ABP("AccountBalancesProjector
    proj_balances")
  end

  TA --> TS
  TA --> TA_ANN
  TA --> TEV
  TA --> T_EXC
  TA --> BR
  TA --> PL
  BR --> ZBR
  TR --> TA
  RTH --> TR
  RTH --> BR
  RTH --> ALP
  RTH --> PF
  ATH --> TR
  ATH --> BR
  ANH --> TR
  CTH --> TR
  CTH --> BR
  VTH --> TR
  RTH2 --> TR
  RTH2 --> BR
  TC --> RTH
  TC --> ATH
  TC --> ANH
  TC --> CTH
  TC --> VTH
  TC --> RTH2
  TC --> THM
  TLP --> TA
  ABP --> TA
  TCS --> ALP
  TKD --> DK
```

## Componentes nuevos en hu-0003

| Módulo | Componente | Capa | Descripción |
|---|---|---|---|
| accounts | `Account` | Domain | Agregado event-sourced con open/rename/close |
| accounts | `AccountOpened`, `AccountRenamed`, `AccountClosed` | Domain | Eventos del ciclo de vida |
| accounts | `AccountException` (7 clases) | Domain | Excepciones de dominio |
| accounts | `AccountRepository` | Application | Persistencia vía EventStore |
| accounts | `AccountValidationService` | Application | Validación cruzada (INV-3/INV-4) |
| accounts | `OpenAccountHandler`, `RenameAccountHandler`, `CloseAccountHandler` | Application | Command handlers |
| accounts | `AccountsController` | Infrastructure | Endpoints HTTP |
| accounts | `AccountsHttpModule` | Infrastructure | Módulo NestJS |
| accounts | `AccountTreeProjector` | Infrastructure | Proyección account_tree |
| transactions | `LedgerTransaction` | Domain | Agregado event-sourced con record/amend/annotate/confirm/void/reverse |
| transactions | `BalanceRule` / `ZeroSumBalanceRule` | Domain | Balanceo a cero por moneda (INV-1/INV-11) |
| transactions | `PostingLine`, `PostingSerializer` | Domain | Value object de posting |
| transactions | `TransactionStatus`, `TransactionAnnotations` | Domain | Tipos de estado y anotaciones |
| transactions | `DerivedKind`, `TransactionKindDeriver` | Domain | Clasificación RF-4 |
| transactions | `LedgerTransactionRepository` | Application | Persistencia vía EventStore |
| transactions | 6 command handlers | Application | Record, Amend, Annotate, Confirm, Void, Reverse |
| transactions | `TransactionsController` | Infrastructure | Endpoints HTTP |
| transactions | `TransactionsHttpModule` | Infrastructure | Módulo NestJS |
| transactions | `TransactionListProjector`, `AccountBalancesProjector` | Infrastructure | Proyecciones |

## Componentes existentes (sin cambios)

- `AggregateRoot<TId>` (`shared-kernel/domain/`) — base de los dos agregados
- `EventSourcedRepository<TAggregate>` (`shared-kernel/application/`) — repositorio genérico
- `EventStore` (`shared-kernel/domain/ports/`) — puerto de almacenamiento de eventos
- `InMemoryEventStore` / `PostgresEventStore` (`shared-kernel/infrastructure/`) — implementaciones
- `EnvelopeFactory`, `EventRegistry` (`shared-kernel/application/`) — serialización de eventos
- `AccountName`, `AccountType`, `CurrencyCode`, `LedgerDate`, `Payee` — value objects (`shared-kernel/domain/value-objects/`)
- `Clock`, `IdGenerator` (`shared/domain/ports/`) — puertos de sistema
- Jerarquía `DomainException` (`libs/shared/`) — excepciones base
