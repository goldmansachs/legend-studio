---
'@finos/legend-extension-dsl-data-product': major
'@finos/legend-application-marketplace': patch
---

**BREAKING CHANGE:** Address batched access point relation types by group and id together, so two access points sharing an id in different groups no longer collide onto one entry. `selectAccessPointsMissingRelationType` now returns `GroupedAccessPoint[]` rather than `V1_AccessPoint[]`, `fetchAccessPointRelationTypes` takes that same array in place of `V1_AccessPoint[]`, and the map it returns is keyed by `buildAccessPointKey(groupId, accessPointId)` rather than by the bare access point id.
