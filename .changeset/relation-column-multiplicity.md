---
'@finos/legend-graph': patch
'@finos/legend-query-builder': patch
---

Preserve `RelationColumn` multiplicity through the accessor / data-product build path and consume it in Query Builder so optional vs required columns drive `is empty` / `is not empty` availability:

- `V1_AccessorHelper` now carries multiplicity when building `RelationType` from `V1_RelationType` (access point implementation), `V1_IngestDataset`, `RelationTypeMetadata`, and `Database` `Table` columns (mapping `Column.nullable` → `[0..1]` vs `[1]`).
- `FilterRelationColumnSourceState` now tracks the source column's multiplicity; populated at every construction site (explorer DnD and lambda round-trip).
- `QueryBuilderFilterOperator_IsEmpty` / `IsNotEmpty` allow relation-column sources only when the column is optional (`lowerBound === 0`).
- `QueryBuilderPostFilterOperator_IsEmpty` / `IsNotEmpty` gate `QueryBuilderRelationColumnProjectionColumnState` on column multiplicity instead of unconditionally allowing all non-simple projection columns.
- `QueryBuilderRelationExplorerPanel` shows a `*` indicator for multi-valued columns and a Multiplicity row in the column info tooltip, matching the class explorer.
