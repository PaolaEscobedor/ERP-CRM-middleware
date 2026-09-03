# Development Log - Intelisis-Zoho Middleware

## Technological Stack & Dependencies
* **Runtime:** Node.js (chosen for its non-blocking I/O model, ideal for asynchronous ETL processing).
* **Express:** Selected to spin up local Health Check and Webhook endpoints.
* **mssql:** Native connector to interact directly with Intelisis' legacy relational tables (`Cte`, `Art`).
* **Axios:** HTTP client used to consume the Zoho CRM REST API v8 and manage the automatic renewal of OAuth 2.0 tokens.
* **Dotenv:** Implemented for security purposes to decouple critical credentials from the source code.

##  Connection & Network Notes
* **DNS Bypass:** Configured to force Google DNS (`8.8.8.8`, `8.8.4.4`) in `app.js` to mitigate local network bottlenecks and prevent `ECONNREFUSED` errors during the development phase.

## CRM Modeling
* **Reference Modules:** 11 reference modules (lookup catalogs) were provisioned in Zoho CRM. The custom `ERP Code` field within each module was configured as a *Unique Key* to act as a primary identifier and systematically prevent duplicate records