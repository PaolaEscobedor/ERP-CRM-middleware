# ERP–CRM Middleware: Intelisis ERP ⇄ Zoho CRM

Node.js middleware that synchronises data between a legacy ERP (Intelisis, Microsoft SQL Server) and a cloud CRM (Zoho CRM API v8). It uses the Adapter Pattern and a Canonical Data Model, and the field mappings are declared in configuration files instead of adapter code.

Code for the MSc Computer Science project *Legacy System Modernization: A RESTful API Integration Between On- Premise ERP and Cloud CRM Systems* (University of London, Birkbeck), by Paola Escobedo Rojas.

> **Status:** academic prototype. It was developed and tested only against a Zoho CRM sandbox and an Intelisis test database, with small data volumes. It is not production-ready (see Limitations).

## Data flows

| Flow | Direction                                                | How it runs                                      |
|------|----------------------------------------------------------|--------------------------------------------------|
| A    | Intelisis → Zoho (master data:                           |
       |customers, products and reference catalogues; 19 modules) | One runner script per module in `sync/run/`      |
| B    | Zoho → Intelisis (sales orders)                          | Authenticated REST 
|      |                                                          | endpoint. Each order is written through the stored       
       |                                                          |  procedures `pNetActualizarPedido` and                 
       |                                                          |`pNetActualizarPedidoD` in a single transaction   |



## Project structure

```
adapters/              IntelisisAdapter.js, ZohoAdapter.js
config/                Declarative mapping for each module (*.config.js);
                       SalesOrders.config.js is the mapping for Flow B
sync/orchestrator.js   Coordinates a Flow A run
sync/salesOrderSync.js Coordinates Flow B for a single record
sync/run/              Runner script for each Flow A module
sync/test-manual/      Manual end-to-end scripts (need live credentials)
routes/, services/     Express routes, JWT authentication, Zoho token request
tests/                 Jest unit and orchestrator tests
Docs/                  ADR, defect log and test evidence
```



## Prerequisites

- Node.js (LTS) and npm
- An Intelisis test database (SQL Server) with the stored procedures listed above
- A Zoho CRM sandbox with the custom modules and API names described in the report (Appendix A)
- A Zoho OAuth client and a refresh token


## Setup

```bash
npm ci
cp .env.example .env     # PowerShell: Copy-Item .env.example .env
```

Fill in `.env`. Never commit it.

**Zoho refresh token.** Open the Zoho authorisation URL in a browser with your client ID, the scopes your configuration needs (at least CRM modules and users) and `access_type=offline`. Accept the permissions and copy the `code` parameter from the redirect URL, then run:

```bash
node getTokens.js <code>
```
Copy the printed refresh token into `ZOHO_REFRESH_TOKEN`. The code is single-use and expires within minutes; the refresh token does not expire.


**Database.** Flow B stores the Zoho record ID in a `FolioCRM` column of the `Venta` table. The database account used by the middleware only needs `EXECUTE` permission on the two stored procedures, plus read access to look up orders that were already imported.

```sql
GRANT EXECUTE ON OBJECT::dbo.pNetActualizarPedido  TO <middleware_user>;
GRANT EXECUTE ON OBJECT::dbo.pNetActualizarPedidoD TO <middleware_user>;
```

## Running

**Flow A.** Run one module at a time:

```bash
node sync/run/runCurrency.js
```

Reference catalogues must be synchronised before the modules that look them up (for example Accounts and Products); each configuration file documents its dependencies. Every run requests a new Zoho access token and Zoho limits token requests, so leave about a minute between runs.

**Flow B (REST service).**

```bash
npm start        # node app.js
npm run dev      # nodemon: restarts on file changes
```


All paths are relative to `/api/v1`:

| Method | Path            | Description                                                                                |
|--------|-----------------|--------------------------------------------------------------------------------------------|
| GET    | `/health`       | Liveness check (no authentication)                                                         |
| POST   | `/auth/token`   | Issues a JWT. Send `grant_type=client_credentials`, `client_id` and `client_secret` as an  |   
| POST   | `/sales-orders/ | Syncs one Zoho sales order. Requires `Authorization: Bearer <token>`. Returns 200 (written),| 
|        |{recordId}/sync` | 401, 404 (record not found in Zoho), 422 (rejected by a business rule) or 500              |



**Manual end-to-end script for one order:**

```bash
node sync/test-manual/testSalesOrderCanonical.js
```

## Tests

```bash
npx jest --verbose
```

30 unit tests in 5 suites. They need no network, credentials or database. The output of the manual tests is in `Docs/evidence/`.

## Notes

- **Stack:** Node.js, Express, `mssql`, Axios, `dotenv`, `jsonwebtoken` and Jest.
- **Zoho modelling:** each reference module has a custom `Codigo_ERP` field configured as a unique key, which is used as the duplicate-check field when records are upserted.

## Limitations

There is no retry or backoff, no access-token caching, synchronisation is full rather than incremental, nothing is scheduled, and the inbound endpoint has only been tested over HTTP on localhost. Details are in Sections 5.3 and 5.4 of the report.

## Documentation

- `Docs/ADR/001_Generic_sync_approach.md`: design decision for the configuration-driven approach
- `Docs/defect-log.md`: defects found during development (report Appendix D)
- `Docs/evidence/`: test outputs (report Appendices B and C)