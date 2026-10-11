# Defect Log

This is a record of the defects I ran into while building the middleware, in the same order and with the same IDs as Appendix D of the report. Most were found by running the code against the live systems. Two were exposed by the automated unit tests, and they are marked as such. Where a unit test now guards against a defect, I name it.

## Schema mismatches

**D-01: empty line items.** The canonical record came out with no line items even though the Zoho order had two. The subform is called `Ordered_Items`, and the configuration was looking for `Product_Details`. Fixed by correcting the field name.

**D-02: discount percentage always `null`.** The numeric field of the discounts module is spelled `Porcentage` in Zoho, and the configuration used `Percentage`. Zoho's API names cannot be renamed afterwards, so the configuration follows the real spelling.

**D-03: branch of the sales representatives never filled in, with no error.** In the configuration, the lookup was declared under one field name and used under another, so the dictionary was stored under a key nobody read, and every value silently resolved to `null`. Both names are now identical.

**D-04: the whole sales representatives batch was rejected with HTTP 400.** The branch is a lookup field in Zoho, but I was sending the plain numeric code instead of the identifier of the Zoho record. Declaring it as a lookup fixed it.

## Data types and boundary values

**D-05: lookups failing for padded codes such as `'A007 '`.** Fixed-width `CHAR` columns in Intelisis pad values with trailing spaces, so a padded code never matched its reference. Keys are now trimmed when the lookup dictionaries are queried.

**D-06: records with code `0` ignored.** A truthiness check on the key threw away the value `0`, which in JavaScript counts as "empty", so the main branch of the company never made it into the lookups. The check now looks explicitly for undefined, null and empty string. Covered by the tests `fetchMap ... falsy key value (0)` and `fetchReverseMap ... keeps 0 values`.

**D-07: a discount record rejected by Zoho as "invalid data".** The value had more than four decimal places, which is Zoho's maximum for that field. The field transform now rounds it to four decimals.

**D-08: stored procedure parameters rejected or receiving text.** One parameter received a raw object instead of a string, and the values that come out of reverse lookups are always strings, even when the procedure expects a number. The ERP user now has a fixed default, and every value is coerced to the declared SQL type before the procedure runs. Covered by `_bindParameters coerces string values ...`.

## Silent data-quality failures

**D-09: lookups resolving to `null` without any error.** This happened when a module ran before the reference catalogue it depends on had been populated, and a response without a `data` field was not handled either. The run reported success while the data was incomplete, which made it the most dangerous kind of defect. Empty responses are now tolerated, and the dependency order is documented in each configuration. No warning is raised for an empty dictionary.

**D-10: the sales agent arriving as the raw `{ name, id, email }` object.** Two causes: the reverse lookup of users did not exist yet, and the loop that was supposed to read `specialReverseLookups` read `reverseLookups` instead, so it never ran and nothing complained. I added `fetchUsersReverseMap()` and fixed the property. Covered by `resolves agent from the record Owner ...`.

## Integrity

**D-11: delivery addresses without a usable duplicate-check field.** The `CteEnviarA` table has no single unique key, because its identifier repeats across customers. A composite key, `Cliente_ID`, is built in the configuration transform. Covered by `fetchCanonical should support composite keys ...`.

**D-12: stored procedure executed with no parameters** ("expects parameter '@Usuario', which was not supplied"). `_bindParameters()` read and converted every value but never called `request.input()`, so nothing reached the procedure. Covered by `_bindParameters calls request.input once per parameter`.

**D-13: order header rejected with code 73610 ("missing detail").** `totalItems` was not mapped, so `@TotalDet` arrived as `NULL` and the procedure treated the order as having no lines. It is now mapped as the number of line items.

**D-14: repeated submissions creating duplicate orders.** Nothing recorded that an order had already been imported. On top of that, the Zoho identifier was not reaching the database because the idempotency settings were placed inside `sourceMap` instead of at the top level of the configuration. The Zoho identifier is now stored in `Venta.FolioCRM` and looked up under an update lock. An order that exists and is still editable is updated, and one that has progressed in the ERP is rejected. Covered by `updates the existing order ...`, `rejects re-syncing an order ...` and `maps the Zoho record ID to externalId ...`.

**D-15: order headers saved without their lines.** Header and lines were written without a transaction, so when a line failed, the header stayed in the database. Everything now runs in a single transaction with an explicit rollback. This is needed because the procedures report business errors through a status code instead of raising exceptions. Covered by three `rolls back ...` tests.

**D-16: missing fields reaching the driver as "not supplied".** An `undefined` value was passed to `request.input()`, and the driver treats that differently from `NULL`. Missing fields are now sent as an explicit `NULL`, so the procedure's own validations can report them. *Found by a unit test*, not by a manual run. Covered by `_bindParameters sends null instead of undefined ...`.

**D-17: no indication of whether an order was inserted or updated.** The result object had no `action` field. *Found by a unit test*. Covered by `inserts a new order ...` and `updates the existing order ...`.

## Environment and configuration

**D-18: access tokens expiring after one hour.** A new token is now obtained from the refresh token at the start of each run.

**D-19: access denied when executing the stored procedures.** The `db_datareader` and `db_datawriter` roles do not include `EXECUTE`, which is why everything that only read or inserted data worked and the procedures did not. `EXECUTE` was granted on the two procedures used.

**D-20: Zoho refusing token requests** (HTTP 400, "too many requests") when many runs were started in quick succession. Every run requests a new token, and Zoho limits how many it hands out. *This one is still open.* During the performance measurements I worked around it by spacing the runs 65 seconds apart. Caching the token is listed as future work.

## Notes

Typographical errors in names, for example a parameter spelled differently where it is declared and where it is used, showed up the first time the code ran and are not listed one by one. Two more defects were caught in code review before they ever ran: an order status copied from Zoho that the line procedure would have rejected, and a misspelled canonical field name that would have left the line tax empty.


