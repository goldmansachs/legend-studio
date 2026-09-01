---
'@finos/legend-lego': patch
---

Extract service pre-filters by walking the deserialized `V1_Lambda` from `@finos/legend-graph` instead of duck-typing the raw protocol JSON, and match functions with `matchFunctionName` so both the short name and the fully-qualified path resolve.
