# ADR 001: Generic Sync Engine with Adapter Pattern + Canonical Data Model

## Status
Accepted

## Context

The initial implementation of the Intelisis-Zoho middleware consisted
of 19 independent Node.js scripts (e.g. `syncAccounts.js`,
`syncProducts.js`, `syncSalesPaymentTerms.js`), each hardcoding the
full ETL pipeline for a single catalog: SQL Server connection, query
execution, Zoho OAuth authentication, reference catalog lookups via
`fetchMap()`, field-by-field transformation, and a direct POST to a
specific Zoho CRM module.

This design tightly coupled Intelisis-specific and Zoho-specific
logic within every module. Formal committee feedback on the initial
project proposal identified this as a low-reusability design: adding
support for a different ERP or CRM pair would require rewriting the
majority of the codebase rather than extending it, since source and
destination concerns were not separated.

An initial attempt to address this consisted of a single generic
`runSync(config)` function that mapped SQL rows directly to a Zoho
payload in one step, driven by a declarative config per module. While
this removed code duplication across the 19 modules, source and
destination schemas remained directly coupled within the same
`fieldMap`, meaning a new destination system would still require
redesigning the field mapping structure itself, not just adding a new
adapter.

## Decision

The sync pipeline was redesigned into three decoupled layers,
following the Adapter Pattern and introducing a Canonical Data Model
(CDM) as the neutral contract between source and destination:

1. **`IntelisisAdapter`** (Source Adapter) — extracts rows from SQL
   Server and maps them into a neutral, source-agnostic canonical
   object. Has no knowledge of Zoho or any destination system.
2. **`ZohoAdapter`** (Destination Adapter) — receives canonical
   records, resolves reference catalog lookups against Zoho CRM
   (including non-standard lookups, e.g. Zoho Users indexed by
   `alias`), translates them into Zoho payloads, and executes batched
   upserts. Has no knowledge of SQL Server or Intelisis.
3. **`orchestrator.js`** — coordinates the extraction and loading
   steps for a given sync configuration. Contains no source- or
   destination-specific logic; it only understands the CDM contract
   between both adapters.

Each of the 19 sync modules was migrated from a standalone script
into a declarative configuration object (`/config/*.config.js`),
describing the source query, the Intelisis-to-canonical field
mapping, the canonical-to-Zoho field mapping, and any reference
catalog dependencies. No new sync logic is written per module; only
configuration data is added.

## Alternatives Considered

- **Keep the original 19 independent scripts.** Rejected: this was
  the design that prompted the committee's reusability concern, and
  offered no path to extension without rewriting.
- **Single-step generic engine (SQL → Zoho payload directly).**
  Rejected as a final design: while it removed duplication, it kept
  source and destination schemas coupled in a single mapping
  structure, limiting the ability to add a different destination
  system without redesigning that structure.
- **Enterprise Service Bus (ESB) or full API-led/microservices
  architecture.** Rejected for this project's scope, as documented
  in the original proposal (Section 4.1): both introduce licensing
  cost, operational complexity, and architectural overhead not
  justified by a single-source, single-destination integration.

## Consequences

**Benefits:**
- Adding a new source or destination system (e.g. a different ERP or
  CRM) requires implementing a new adapter that produces or consumes
  the canonical model, without modifying the orchestrator or any
  existing configuration file.
- The Intelisis-to-Zoho field dictionary (previously static
  documentation in Appendix A) is now executable configuration,
  reducing the risk of documentation drifting from implementation.
- Reusability can be demonstrated via a lightweight mock adapter
  (consuming a static JSON file instead of a live SQL connection)
  without requiring a second real ERP/CRM integration, keeping this
  validation within the project's time constraints.

**Costs / trade-offs:**
- Slightly higher initial complexity per module: each sync now
  requires both a source-to-canonical and a canonical-to-destination
  mapping, instead of a single direct mapping.
- Non-standard lookups (e.g. Zoho Users indexed by `alias` instead of
  `Codigo_ERP`, or reference lookups keyed by a field other than
  `Codigo_ERP`) require explicit handling in the adapter
  (`specialLookups`, `keyField`), rather than being implicitly
  consistent across all modules.