---
'@finos/legend-lego': patch
---

Extract service pre-filters by walking the deserialized `V1_Lambda` from `@finos/legend-graph` instead of duck-typing the raw protocol JSON, and match functions with `matchFunctionName` so both the short name and the fully-qualified path resolve. This introduces the first `V1_*` protocol import into `legend-lego`, confined to the enrichment module and absent from the public barrel, matching how `legend-data-cube` and `legend-query-builder` already consume `V1_deserializeValueSpecification`. `meta::pure::tds::filter` joins the recognised filter paths, so a post-projection TDS filter spelled with its full path is no longer skipped.
