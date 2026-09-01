---
'@finos/legend-lego': major
---

**BREAKING CHANGE:** Narrow the `legend-ai` public barrel to the symbols that are actually consumed. 60 named exports with no consumer in this repository or in downstream Legend AI plugins have been removed, which stops internal SQL sanitizers, retrieval scoring helpers and chart primitives from being frozen as public API. All type exports are unaffected.
