---
'@finos/legend-lego': major
'@finos/legend-application-marketplace': patch
---

Remove three pieces of state that were produced and never consumed.

`LegendAISelfHealKind` and the `selfHealed` member of the zero-row recovery result: the kind was initialised, assigned on two recovery branches and returned, but the only caller destructures `sql` and `result`. It never reached a thinking step, a rendered query or the model, so nothing observable changes.

`TDSServiceSourceType.SERVICE`: documented as marking a DataSpace service executable but never assigned outside a test fixture. Every reader tests against `ACCESS_POINT`, and `undefined` already took the service branch, so the member only offered a second way to spell the default. The invariant it carried now lives in the `sourceType` doc comment.

`ScoredProductCandidate.productSimilarity` and `.fieldIntersection`: both written on every candidate and read by nothing. `compositeScore` is derived from the normalised similarity and the field coverage, so ranking is unchanged, and the product cards already read `product.similarity` directly.
