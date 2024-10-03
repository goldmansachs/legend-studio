/**
 * Copyright (c) 2020-present, Goldman Sachs
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/***************************************************************************************
 * [CORE]
 *
 * This and its corresponding utilitites are used to build the executable query from
 * the query snapshot. The executable query is then used to fetch data.
 ***************************************************************************************/

import {
  PRIMITIVE_TYPE,
  type V1_AppliedFunction,
  V1_deserializeValueSpecification,
} from '@finos/legend-graph';
import {
  type DataCubeQuerySnapshot,
  type DataCubeQuerySnapshotSimpleExtendedColumn,
} from './DataCubeQuerySnapshot.js';
import {
  guaranteeNonNullable,
  isNonNullable,
  UnsupportedOperationError,
} from '@finos/legend-shared';
import {
  DataCubeExtendedColumnType,
  DataCubeFunction,
  DataCubeQuerySortDirection,
  type DataCubeQueryFunctionMap,
} from './DataCubeQueryEngine.js';
import { DataCubeConfiguration } from './DataCubeConfiguration.js';
import type { DataCubeQueryFilterOperation } from './filter/DataCubeQueryFilterOperation.js';
import {
  _col,
  _collection,
  _cols,
  _colSpec,
  _deserializeToLambda,
  _elementPtr,
  _filter,
  _function,
  _groupByAggCols,
  _lambda,
  _pivotAggCols,
  _castCols,
  _primitiveValue,
  _var,
  _functionCompositionProcessor,
} from './DataCubeQueryBuilderUtils.js';
import type { DataCubeQueryAggregateOperation } from './aggregation/DataCubeQueryAggregateOperation.js';

export function buildExecutableQuery(
  snapshot: DataCubeQuerySnapshot,
  filterOperations: DataCubeQueryFilterOperation[],
  aggregateOperations: DataCubeQueryAggregateOperation[],
  options?: {
    postProcessor?: (
      snapshot: DataCubeQuerySnapshot,
      sequence: V1_AppliedFunction[],
      funcMap: DataCubeQueryFunctionMap,
      configuration: DataCubeConfiguration,
      filterOperations: DataCubeQueryFilterOperation[],
      aggregateOperations: DataCubeQueryAggregateOperation[],
    ) => void;
    pagination?:
      | {
          start: number;
          end: number;
        }
      | undefined;
  },
) {
  const data = snapshot.data;
  const sourceQuery = V1_deserializeValueSpecification(data.sourceQuery, []);
  const configuration = DataCubeConfiguration.serialization.fromJson(
    data.configuration,
  );
  const sequence: V1_AppliedFunction[] = [];
  const funcMap: DataCubeQueryFunctionMap = {};
  const _process = _functionCompositionProcessor(sequence, funcMap);

  // --------------------------------- LEAF-LEVEL EXTEND ---------------------------------

  if (data.leafExtendedColumns.length) {
    _process(
      'leafExtend',
      _function(DataCubeFunction.EXTEND, [
        _cols(
          data.leafExtendedColumns.map((col) => {
            if (col._type === DataCubeExtendedColumnType.SIMPLE) {
              const column = col as DataCubeQuerySnapshotSimpleExtendedColumn;
              return _colSpec(column.name, _deserializeToLambda(column.lambda));
            }
            throw new UnsupportedOperationError(
              `Can't build extended column of type '${col._type}'`,
            );
          }),
        ),
      ]),
    );
  }

  // --------------------------------- FILTER ---------------------------------

  if (data.filter) {
    _process(
      'filter',
      _function(DataCubeFunction.FILTER, [
        _lambda([_var()], [_filter(data.filter, filterOperations)]),
      ]),
    );
  }

  // --------------------------------- SELECT ---------------------------------

  if (data.selectColumns.length) {
    _process(
      'select',
      _function(DataCubeFunction.SELECT, [
        _cols(data.selectColumns.map((col) => _colSpec(col.name))),
      ]),
    );
  }

  // --------------------------------- PIVOT ---------------------------------

  if (data.pivot) {
    const pivot = data.pivot;

    // pre-sort to maintain stable order for pivot result columns
    _process(
      'sort',
      _function(DataCubeFunction.SORT, [
        _collection(
          data.pivot.columns.map((col) =>
            _function(DataCubeFunction.ASC, [_col(col.name)]),
          ),
        ),
      ]),
    );

    _process(
      'pivot',
      _function(DataCubeFunction.PIVOT, [
        _cols(pivot.columns.map((col) => _colSpec(col.name))),
        _cols(
          _pivotAggCols(
            pivot.columns,
            snapshot,
            configuration,
            aggregateOperations,
          ),
        ),
      ]),
    );

    if (pivot.castColumns.length) {
      _process(
        'pivotCast',
        _function(DataCubeFunction.CAST, [_castCols(pivot.castColumns)]),
      );
    }
  }

  // --------------------------------- GROUP BY ---------------------------------

  if (data.groupBy) {
    const groupBy = data.groupBy;
    _process(
      'groupBy',
      _function(DataCubeFunction.GROUP_BY, [
        _cols(groupBy.columns.map((col) => _colSpec(col.name))),
        _cols(
          _groupByAggCols(
            groupBy.columns,
            snapshot,
            configuration,
            aggregateOperations,
          ),
        ),
      ]),
    );
    _process(
      'groupBySort',
      _function(DataCubeFunction.SORT, [
        _collection(
          groupBy.columns.map((col) =>
            _function(
              configuration.treeColumnSortDirection ===
                DataCubeQuerySortDirection.ASCENDING
                ? DataCubeFunction.ASC
                : DataCubeFunction.DESC,
              [_col(col.name)],
            ),
          ),
        ),
      ]),
    );
  }

  // --------------------------------- GROUP-LEVEL EXTEND ---------------------------------

  if (data.groupExtendedColumns.length) {
    _process(
      'groupExtend',
      _function(DataCubeFunction.EXTEND, [
        _cols(
          data.groupExtendedColumns.map((col) => {
            if (col._type === DataCubeExtendedColumnType.SIMPLE) {
              const column = col as DataCubeQuerySnapshotSimpleExtendedColumn;
              return _colSpec(column.name, _deserializeToLambda(column.lambda));
            }
            throw new UnsupportedOperationError(
              `Can't build extended column of type '${col._type}'`,
            );
          }),
        ),
      ]),
    );
  }

  // --------------------------------- SORT ---------------------------------

  if (data.sortColumns.length) {
    _process(
      'sort',
      _function(DataCubeFunction.SORT, [
        _collection(
          data.sortColumns.map((col) =>
            _function(
              col.direction === DataCubeQuerySortDirection.ASCENDING
                ? DataCubeFunction.ASC
                : DataCubeFunction.DESC,
              [_col(col.name)],
            ),
          ),
        ),
      ]),
    );
  }

  // --------------------------------- LIMIT ---------------------------------

  if (data.limit !== undefined) {
    _process(
      'limit',
      _function(DataCubeFunction.LIMIT, [
        _primitiveValue(PRIMITIVE_TYPE.INTEGER, data.limit),
      ]),
    );
  }

  // --------------------------------- SLICE ---------------------------------

  if (options?.pagination) {
    sequence.push(
      _function(DataCubeFunction.SLICE, [
        _primitiveValue(PRIMITIVE_TYPE.INTEGER, options.pagination.start),
        _primitiveValue(PRIMITIVE_TYPE.INTEGER, options.pagination.end),
      ]),
    );
  }

  // --------------------------------- FROM ---------------------------------

  sequence.push(
    _function(
      DataCubeFunction.FROM,
      [
        data.mapping ? _elementPtr(data.mapping) : undefined,
        _elementPtr(data.runtime),
      ].filter(isNonNullable),
    ),
  );

  // --------------------------------- FINALIZE ---------------------------------

  options?.postProcessor?.(
    snapshot,
    sequence,
    funcMap,
    configuration,
    filterOperations,
    aggregateOperations,
  );

  if (!sequence.length) {
    return sourceQuery;
  }
  for (let i = 0; i < sequence.length; i++) {
    guaranteeNonNullable(sequence[i]).parameters.unshift(
      i === 0 ? sourceQuery : guaranteeNonNullable(sequence[i - 1]),
    );
  }
  return guaranteeNonNullable(sequence[sequence.length - 1]);
}