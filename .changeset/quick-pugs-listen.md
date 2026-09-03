---
'@finos/legend-extension-dsl-data-product': patch
---

Build a metamodel `RelationType` through `@finos/legend-graph` when deriving AI column schemas for access points, taking column name, type, precision and nullability from it. Column documentation is still read from the protocol columns, which carry it without a fully initialized graph, and DataProduct sample query services now declare their source type.
