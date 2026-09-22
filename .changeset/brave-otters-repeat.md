---
'@finos/legend-lego': patch
---

Classify column types through legend-graph's `getCorrespondingStandardPrimitiveType` instead of three hand-maintained sets of precise primitive names. The sets listed sixteen precise types that the graph already maps onto their standard counterpart, so they had to be extended by hand every time a precise primitive was added. The predicates now collapse a type onto its standard family first and compare against that, which leaves `isStringTypedColumn`, `isNumericColumn` and `isDateColumn` answering exactly as before. `isAPNumericColumn` was identical to `isNumericColumn` and its one caller now uses the latter.
