/**
 * Copyright (c) 2026-present, Goldman Sachs
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

import { describe, test, expect } from '@jest/globals';
import { unitTest } from '@finos/legend-shared/test';
import {
  type PlainObject,
  guaranteeNonNullable,
  LogService,
} from '@finos/legend-shared';
import {
  type AbstractPureGraphManager,
  type V1_ValueSpecification,
  Multiplicity,
  RawLambda,
  V1_deserializeValueSpecification,
  V1_PureGraphManager,
} from '@finos/legend-graph';
import {
  TEST__getTestGraphManagerState,
  TEST__GraphManagerPluginManager,
} from '@finos/legend-graph/test';
import {
  buildPropertyDocIndex,
  enrichColumnsFromElementDocs,
  inferServiceRelationshipsFromAssociations,
  extractLambdaPreFilters,
  extractServiceQuerySchema,
  extractModelContext,
  buildEnrichedBusinessContext,
  findBestAlternateRoot,
  resolveEntitiesDeterministic,
  buildSemanticPropertyIndex,
  buildModelContextEnrichmentText,
  buildModelCatalogText,
  buildDataQueryApproachText,
  rankEntities,
  relaxExactStringFilters,
  extractFilteredColumns,
  buildProbedValueHints,
  buildPriorSqlFailureHints,
} from '../LegendAIDocEnrichment.js';
import {
  ClassDocumentationEntry,
  PropertyDocumentationEntry,
  NormalizedDocumentationEntry,
  AssociationDocumentationEntry,
  EnumerationDocumentationEntry,
  BasicDocumentationEntry,
  ModelDocumentationEntry,
} from '../../model-documentation/index.js';
import type {
  TDSColumnSchema,
  TDSServiceSchema,
  LegendAIModelContext,
  LegendAIModelProperty,
} from '../LegendAITypes.js';

function makePropertyDoc(
  name: string,
  docs: string[],
  multiplicity?: Multiplicity,
): PropertyDocumentationEntry {
  const prop = new PropertyDocumentationEntry();
  prop.name = name;
  prop.docs = docs;
  if (multiplicity) {
    prop.multiplicity = multiplicity;
  }
  return prop;
}

function makeClassWithProps(
  className: string,
  properties: PropertyDocumentationEntry[],
): NormalizedDocumentationEntry[] {
  const cls = new ClassDocumentationEntry();
  cls.name = className;
  cls.path = `my::model::${className}`;
  cls.docs = [];
  cls.properties = properties;

  const entries: NormalizedDocumentationEntry[] = [
    new NormalizedDocumentationEntry(className, '', cls, cls),
  ];
  for (const prop of properties) {
    entries.push(new NormalizedDocumentationEntry(prop.name, '', cls, prop));
  }
  return entries;
}

function makeAssociationDocs(
  assocName: string,
  propA: PropertyDocumentationEntry,
  propB: PropertyDocumentationEntry,
): NormalizedDocumentationEntry[] {
  const assoc = new AssociationDocumentationEntry();
  assoc.name = assocName;
  assoc.path = `my::model::${assocName}`;
  assoc.docs = [];
  assoc.properties = [propA, propB];

  return [new NormalizedDocumentationEntry(assocName, '', assoc, assoc)];
}

describe(unitTest('buildPropertyDocIndex'), () => {
  test('builds index from class property docs', () => {
    const prop = makePropertyDoc('TradeId', ['Unique trade identifier']);
    const entries = makeClassWithProps('Trade', [prop]);
    const index = buildPropertyDocIndex(entries);

    expect(index.size).toBe(1);
    expect(index.get('tradeid')).toBe(prop);
  });

  test('matches case-insensitively', () => {
    const prop = makePropertyDoc('CounterParty', ['The counterparty']);
    const entries = makeClassWithProps('Trade', [prop]);
    const index = buildPropertyDocIndex(entries);

    expect(index.get('counterparty')).toBe(prop);
  });

  test('returns empty map for no class entries', () => {
    const plain = new ModelDocumentationEntry();
    plain.name = 'SomeModel';
    plain.path = 'my::SomeModel';
    plain.docs = ['Some doc'];
    const entry = new NormalizedDocumentationEntry(
      'SomeModel',
      '',
      plain,
      plain,
    );
    const index = buildPropertyDocIndex([entry]);

    expect(index.size).toBe(0);
  });

  test('skips class-level entries (entry === elementEntry)', () => {
    const cls = new ClassDocumentationEntry();
    cls.name = 'Trade';
    cls.path = 'my::Trade';
    cls.docs = ['Trade class'];
    cls.properties = [];
    const entry = new NormalizedDocumentationEntry('Trade', '', cls, cls);
    const index = buildPropertyDocIndex([entry]);

    expect(index.size).toBe(0);
  });
});

describe(unitTest('enrichColumnsFromElementDocs'), () => {
  test('enriches column documentation from property docs', () => {
    const prop = makePropertyDoc('TradeId', ['Unique trade identifier']);
    const entries = makeClassWithProps('Trade', [prop]);
    const index = buildPropertyDocIndex(entries);

    const columns: TDSColumnSchema[] = [{ name: 'TradeId' }];
    enrichColumnsFromElementDocs(columns, index);

    expect(columns[0]?.documentation).toBe('Unique trade identifier');
  });

  test('enriches nullability from multiplicity lowerBound', () => {
    const prop = makePropertyDoc(
      'optionalField',
      ['Optional field'],
      new Multiplicity(0, 1),
    );
    const entries = makeClassWithProps('Trade', [prop]);
    const index = buildPropertyDocIndex(entries);

    const columns: TDSColumnSchema[] = [{ name: 'optionalField' }];
    enrichColumnsFromElementDocs(columns, index);

    expect(columns[0]?.nullable).toBe(true);
  });

  test('does not overwrite existing documentation', () => {
    const prop = makePropertyDoc('TradeId', ['New doc from model']);
    const entries = makeClassWithProps('Trade', [prop]);
    const index = buildPropertyDocIndex(entries);

    const columns: TDSColumnSchema[] = [
      { name: 'TradeId', documentation: 'Existing doc' },
    ];
    enrichColumnsFromElementDocs(columns, index);

    expect(columns[0]?.documentation).toBe('Existing doc');
  });

  test('does not overwrite existing nullable', () => {
    const prop = makePropertyDoc('field', [], new Multiplicity(0, 1));
    const entries = makeClassWithProps('Trade', [prop]);
    const index = buildPropertyDocIndex(entries);

    const columns: TDSColumnSchema[] = [{ name: 'field', nullable: false }];
    enrichColumnsFromElementDocs(columns, index);

    expect(columns[0]?.nullable).toBe(false);
  });

  test('joins multiple docs with semicolons', () => {
    const prop = makePropertyDoc('TradeId', ['Line one', 'Line two']);
    const entries = makeClassWithProps('Trade', [prop]);
    const index = buildPropertyDocIndex(entries);

    const columns: TDSColumnSchema[] = [{ name: 'TradeId' }];
    enrichColumnsFromElementDocs(columns, index);

    expect(columns[0]?.documentation).toBe('Line one; Line two');
  });
});

describe(unitTest('inferServiceRelationshipsFromAssociations'), () => {
  test('returns empty for fewer than 2 services', () => {
    const svc: TDSServiceSchema = {
      title: 'Trades',
      pattern: '/getTrade',
      columns: [{ name: 'id' }],
      parameters: [],
    };
    const result = inferServiceRelationshipsFromAssociations([svc], []);
    expect(result).toEqual([]);
  });

  test('finds direct relationship between two services', () => {
    const propA = makePropertyDoc('trade', [], new Multiplicity(0, undefined));
    const propB = makePropertyDoc('instrument', [], new Multiplicity(1, 1));
    const assocDocs = makeAssociationDocs('TradeInstrument', propA, propB);

    const svcA: TDSServiceSchema = {
      title: 'Trades',
      pattern: '/getTrade',
      columns: [{ name: 'id' }, { name: 'instrumentId' }],
      parameters: [],
    };
    const svcB: TDSServiceSchema = {
      title: 'Instruments',
      pattern: '/getInstrument',
      columns: [{ name: 'instrumentId' }, { name: 'name' }],
      parameters: [],
    };

    const result = inferServiceRelationshipsFromAssociations(
      [svcA, svcB],
      assocDocs,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.leftService).toBe('Trades');
    expect(result[0]?.rightService).toBe('Instruments');
    expect(result[0]?.joinColumns).toContain('instrumentId');
  });

  test('returns empty when no associations match service patterns', () => {
    const propA = makePropertyDoc('foo', [], new Multiplicity(0, undefined));
    const propB = makePropertyDoc('bar', [], new Multiplicity(1, 1));
    const assocDocs = makeAssociationDocs('FooBar', propA, propB);

    const svcA: TDSServiceSchema = {
      title: 'Trades',
      pattern: '/getTrade',
      columns: [{ name: 'id' }],
      parameters: [],
    };
    const svcB: TDSServiceSchema = {
      title: 'Instruments',
      pattern: '/getInstrument',
      columns: [{ name: 'id' }],
      parameters: [],
    };

    const result = inferServiceRelationshipsFromAssociations(
      [svcA, svcB],
      assocDocs,
    );
    expect(result).toHaveLength(0);
  });

  test('caps the relationships emitted for a large service set', () => {
    const propA = makePropertyDoc('trade', [], new Multiplicity(0, undefined));
    const propB = makePropertyDoc('instrument', [], new Multiplicity(1, 1));
    const assocDocs = makeAssociationDocs('TradeInstrument', propA, propB);
    const services: TDSServiceSchema[] = Array.from(
      { length: 20 },
      (_, index) => ({
        title: index % 2 === 0 ? `Trades_${index}` : `Instruments_${index}`,
        pattern: index % 2 === 0 ? '/getTrade' : '/getInstrument',
        columns: [{ name: 'instrumentId' }],
        parameters: [],
      }),
    );

    expect(
      inferServiceRelationshipsFromAssociations(services, assocDocs),
    ).toHaveLength(25);
  });
});

/** Deserializes a raw lambda body into the V1 protocol model the extractor walks. */
function buildTestLambda(body: PlainObject[]): V1_ValueSpecification {
  return V1_deserializeValueSpecification(
    { _type: 'lambda', body, parameters: [] },
    [],
  );
}

describe(unitTest('extractLambdaPreFilters'), () => {
  test('returns empty array for undefined body', () => {
    expect(extractLambdaPreFilters(undefined)).toEqual([]);
  });

  test('returns empty array for a value specification that is not a lambda', () => {
    const variable = V1_deserializeValueSpecification(
      { _type: 'var', name: 'x' },
      [],
    );
    expect(extractLambdaPreFilters(variable)).toEqual([]);
  });

  test('extracts simple equality filter', () => {
    const body = [
      {
        _type: 'func',
        function: 'filter',
        parameters: [
          { _type: 'func', function: 'getAll', parameters: [] },
          {
            _type: 'lambda',
            body: [
              {
                _type: 'func',
                function: 'equal',
                parameters: [
                  {
                    _type: 'property',
                    property: 'symbolId',
                    parameters: [{ _type: 'var', name: 'x' }],
                  },
                  { _type: 'string', value: 'AAAAAAA-S' },
                ],
              },
            ],
            parameters: [],
          },
        ],
      },
    ];
    const result = extractLambdaPreFilters(buildTestLambda(body));
    expect(result).toEqual([
      { property: 'symbolId', operator: 'equal', value: 'AAAAAAA-S' },
    ]);
  });

  test('extracts equality filter spelled with fully-qualified paths', () => {
    const body = [
      {
        _type: 'func',
        function: 'meta::pure::functions::collection::filter',
        parameters: [
          { _type: 'func', function: 'getAll', parameters: [] },
          {
            _type: 'lambda',
            body: [
              {
                _type: 'func',
                function: 'meta::pure::functions::boolean::equal',
                parameters: [
                  {
                    _type: 'property',
                    property: 'symbolId',
                    parameters: [{ _type: 'var', name: 'x' }],
                  },
                  { _type: 'string', value: 'AAAAAAA-S' },
                ],
              },
            ],
            parameters: [],
          },
        ],
      },
    ];
    const result = extractLambdaPreFilters(buildTestLambda(body));
    expect(result).toEqual([
      { property: 'symbolId', operator: 'equal', value: 'AAAAAAA-S' },
    ]);
  });

  test('extracts nested property path equality', () => {
    const body = [
      {
        _type: 'func',
        function: 'filter',
        parameters: [
          { _type: 'func', function: 'getAll', parameters: [] },
          {
            _type: 'lambda',
            body: [
              {
                _type: 'func',
                function: 'equal',
                parameters: [
                  {
                    _type: 'property',
                    property: 'symbolId',
                    parameters: [
                      {
                        _type: 'property',
                        property: 'SecurityEntity',
                        parameters: [
                          {
                            _type: 'property',
                            property: 'SecurityCoverage',
                            parameters: [{ _type: 'var', name: 'x' }],
                          },
                        ],
                      },
                    ],
                  },
                  { _type: 'string', value: 'ABC-123' },
                ],
              },
            ],
            parameters: [],
          },
        ],
      },
    ];
    const result = extractLambdaPreFilters(buildTestLambda(body));
    expect(result).toEqual([
      {
        property: 'SecurityCoverage.SecurityEntity.symbolId',
        operator: 'equal',
        value: 'ABC-123',
      },
    ]);
  });

  test('extracts isEmpty filter', () => {
    const body = [
      {
        _type: 'func',
        function: 'filter',
        parameters: [
          { _type: 'func', function: 'getAll', parameters: [] },
          {
            _type: 'lambda',
            body: [
              {
                _type: 'func',
                function: 'isEmpty',
                parameters: [
                  {
                    _type: 'property',
                    property: 'consEndDate',
                    parameters: [{ _type: 'var', name: 'x' }],
                  },
                ],
              },
            ],
            parameters: [],
          },
        ],
      },
    ];
    const result = extractLambdaPreFilters(buildTestLambda(body));
    expect(result).toEqual([{ property: 'consEndDate', operator: 'isEmpty' }]);
  });

  test('extracts combined AND filters (isEmpty + equal + equal)', () => {
    const body = [
      {
        _type: 'func',
        function: 'filter',
        parameters: [
          { _type: 'func', function: 'getAll', parameters: [] },
          {
            _type: 'lambda',
            body: [
              {
                _type: 'func',
                function: 'and',
                parameters: [
                  {
                    _type: 'func',
                    function: 'isEmpty',
                    parameters: [
                      {
                        _type: 'property',
                        property: 'consEndDate',
                        parameters: [{ _type: 'var', name: 'x' }],
                      },
                    ],
                  },
                  {
                    _type: 'func',
                    function: 'and',
                    parameters: [
                      {
                        _type: 'func',
                        function: 'equal',
                        parameters: [
                          {
                            _type: 'property',
                            property: 'vendorEntityId',
                            parameters: [{ _type: 'var', name: 'x' }],
                          },
                          { _type: 'string', value: 'BBBBBBB-E' },
                        ],
                      },
                      {
                        _type: 'func',
                        function: 'equal',
                        parameters: [
                          {
                            _type: 'property',
                            property: 'symbolId',
                            parameters: [{ _type: 'var', name: 'x' }],
                          },
                          { _type: 'string', value: 'CCCCCCC-R' },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
            parameters: [],
          },
        ],
      },
    ];
    const result = extractLambdaPreFilters(buildTestLambda(body));
    expect(result).toEqual([
      { property: 'consEndDate', operator: 'isEmpty' },
      { property: 'vendorEntityId', operator: 'equal', value: 'BBBBBBB-E' },
      { property: 'symbolId', operator: 'equal', value: 'CCCCCCC-R' },
    ]);
  });

  test('extracts isNotNull post-projection TDS row filters', () => {
    const body = [
      {
        _type: 'func',
        function: 'filter',
        parameters: [
          {
            _type: 'func',
            function: 'project',
            parameters: [{ _type: 'func', function: 'getAll', parameters: [] }],
          },
          {
            _type: 'lambda',
            body: [
              {
                _type: 'func',
                function: 'and',
                parameters: [
                  {
                    _type: 'property',
                    property: 'isNotNull',
                    parameters: [
                      { _type: 'var', name: 'row' },
                      { _type: 'string', value: 'Mean Estimate' },
                    ],
                  },
                  {
                    _type: 'property',
                    property: 'isNotNull',
                    parameters: [
                      { _type: 'var', name: 'row' },
                      { _type: 'string', value: 'Fe Median' },
                    ],
                  },
                ],
              },
            ],
            parameters: [],
          },
        ],
      },
    ];
    const result = extractLambdaPreFilters(buildTestLambda(body));
    expect(result).toContainEqual({
      property: 'Mean Estimate',
      operator: 'isNotNull',
    });
    expect(result).toContainEqual({
      property: 'Fe Median',
      operator: 'isNotNull',
    });
  });

  test('extracts post-projection TDS row filters spelled as meta::pure::tds::filter', () => {
    const body = [
      {
        _type: 'func',
        function: 'meta::pure::tds::filter',
        parameters: [
          {
            _type: 'func',
            function: 'project',
            parameters: [{ _type: 'func', function: 'getAll', parameters: [] }],
          },
          {
            _type: 'lambda',
            body: [
              {
                _type: 'property',
                property: 'isNotNull',
                parameters: [
                  { _type: 'var', name: 'row' },
                  { _type: 'string', value: 'Mean Estimate' },
                ],
              },
            ],
            parameters: [],
          },
        ],
      },
    ];
    const result = extractLambdaPreFilters(buildTestLambda(body));
    expect(result).toContainEqual({
      property: 'Mean Estimate',
      operator: 'isNotNull',
    });
  });

  test('extracts filters from nested function calls (filter inside project inside filter)', () => {
    const body = [
      {
        _type: 'func',
        function: 'filter',
        parameters: [
          {
            _type: 'func',
            function: 'project',
            parameters: [
              {
                _type: 'func',
                function: 'filter',
                parameters: [
                  { _type: 'func', function: 'getAll', parameters: [] },
                  {
                    _type: 'lambda',
                    body: [
                      {
                        _type: 'func',
                        function: 'equal',
                        parameters: [
                          {
                            _type: 'property',
                            property: 'entityId',
                            parameters: [{ _type: 'var', name: 'x' }],
                          },
                          { _type: 'string', value: 'TEST-ID' },
                        ],
                      },
                    ],
                    parameters: [],
                  },
                ],
              },
            ],
          },
          {
            _type: 'lambda',
            body: [
              {
                _type: 'property',
                property: 'isNotNull',
                parameters: [
                  { _type: 'var', name: 'row' },
                  { _type: 'string', value: 'Amount' },
                ],
              },
            ],
            parameters: [],
          },
        ],
      },
    ];
    const result = extractLambdaPreFilters(buildTestLambda(body));
    expect(result).toContainEqual({
      property: 'entityId',
      operator: 'equal',
      value: 'TEST-ID',
    });
    expect(result).toContainEqual({
      property: 'Amount',
      operator: 'isNotNull',
    });
  });

  test('handles integer literal values', () => {
    const body = [
      {
        _type: 'func',
        function: 'filter',
        parameters: [
          { _type: 'func', function: 'getAll', parameters: [] },
          {
            _type: 'lambda',
            body: [
              {
                _type: 'func',
                function: 'equal',
                parameters: [
                  {
                    _type: 'property',
                    property: 'status',
                    parameters: [{ _type: 'var', name: 'x' }],
                  },
                  { _type: 'integer', value: 42 },
                ],
              },
            ],
            parameters: [],
          },
        ],
      },
    ];
    const result = extractLambdaPreFilters(buildTestLambda(body));
    expect(result).toEqual([
      { property: 'status', operator: 'equal', value: 42 },
    ]);
  });

  test('returns empty for lambda with no filter calls', () => {
    const body = [
      {
        _type: 'func',
        function: 'project',
        parameters: [{ _type: 'func', function: 'getAll', parameters: [] }],
      },
    ];
    expect(extractLambdaPreFilters(buildTestLambda(body))).toEqual([]);
  });
});

describe(unitTest('extractServiceQuerySchema'), () => {
  // A real graph manager needs an engine; only pureCodeToLambda and the log
  // service it reports parse failures through are exercised here.
  const graphManagerWith = (
    pureCodeToLambda: AbstractPureGraphManager['pureCodeToLambda'],
  ): AbstractPureGraphManager => {
    const graphManager = new V1_PureGraphManager(
      new TEST__GraphManagerPluginManager(),
      new LogService(),
    );
    graphManager.pureCodeToLambda = pureCodeToLambda;
    return graphManager;
  };

  const graphManagerReturning = (
    body: object | undefined,
  ): AbstractPureGraphManager =>
    graphManagerWith(() => Promise.resolve(new RawLambda(undefined, body)));

  test('returns the filters baked into the query', async () => {
    const body = [
      {
        _type: 'func',
        function: 'filter',
        parameters: [
          { _type: 'func', function: 'getAll', parameters: [] },
          {
            _type: 'lambda',
            body: [
              {
                _type: 'func',
                function: 'equal',
                parameters: [
                  {
                    _type: 'property',
                    property: 'region',
                    parameters: [{ _type: 'var', name: 'x' }],
                  },
                  { _type: 'string', value: 'AMERICAS' },
                ],
              },
            ],
          },
        ],
      },
    ];

    const result = await extractServiceQuerySchema(
      '{| ok}',
      graphManagerReturning(body),
      TEST__getTestGraphManagerState(),
    );
    expect(result.preFilters).toEqual([
      { property: 'region', operator: 'equal', value: 'AMERICAS' },
    ]);
  });

  test('returns undefined when the query carries no filters', async () => {
    const result = await extractServiceQuerySchema(
      '{| ok}',
      graphManagerReturning([]),
      TEST__getTestGraphManagerState(),
    );
    expect(result.preFilters).toBeUndefined();
  });

  test('returns undefined when the query cannot be parsed', async () => {
    const graphManager = graphManagerWith(() =>
      Promise.reject(new Error('parse error')),
    );

    const result = await extractServiceQuerySchema(
      'invalid',
      graphManager,
      TEST__getTestGraphManagerState(),
    );
    expect(result.preFilters).toBeUndefined();
    expect(result.parameterExtractionFailed).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// extractModelContext
// ────────────────────────────────────────────────────────────────────────────

function makePropertyDocWithType(
  name: string,
  type: string,
  mult?: Multiplicity,
): PropertyDocumentationEntry {
  const prop = new PropertyDocumentationEntry();
  prop.name = name;
  prop.docs = [];
  prop.type = type;
  if (mult) {
    prop.multiplicity = mult;
  }
  return prop;
}

describe(unitTest('extractModelContext'), () => {
  test('extracts classes with properties', () => {
    const idProp = makePropertyDocWithType(
      'id',
      'Integer',
      new Multiplicity(1, 1),
    );
    const nameProp = makePropertyDocWithType(
      'name',
      'String',
      new Multiplicity(1, 1),
    );
    const entries = makeClassWithProps('Customer', [idProp, nameProp]);

    const ctx = extractModelContext(entries);
    expect(ctx.entities).toHaveLength(1);
    expect(ctx.entities[0]?.path).toBe('my::model::Customer');
    expect(ctx.entities[0]?.name).toBe('Customer');
    expect(ctx.entities[0]?.properties).toHaveLength(2);
    expect(ctx.entities[0]?.properties[0]).toEqual({
      name: 'id',
      type: 'Integer',
      isCollection: false,
      isOptional: false,
    });
  });

  test('extracts associations', () => {
    const customerProp = makePropertyDocWithType(
      'customer',
      'my::model::Customer',
      new Multiplicity(0, 1),
    );
    const ordersProp = makePropertyDocWithType(
      'orders',
      'my::model::Order',
      new Multiplicity(0, undefined),
    );
    const assocEntries = makeAssociationDocs(
      'Order_Customer',
      customerProp,
      ordersProp,
    );

    const ctx = extractModelContext(assocEntries);
    expect(ctx.associations).toHaveLength(1);
    expect(ctx.associations[0]).toEqual({
      name: 'Order_Customer',
      leftEntity: 'my::model::Customer',
      leftProperty: 'customer',
      rightEntity: 'my::model::Order',
      rightProperty: 'orders',
    });
  });

  test('extracts enumerations', () => {
    const enumEntry = new EnumerationDocumentationEntry();
    enumEntry.name = 'Title';
    enumEntry.path = 'my::model::Title';
    enumEntry.docs = [];
    const mr = new BasicDocumentationEntry();
    mr.name = 'Mr';
    mr.docs = [];
    const mrs = new BasicDocumentationEntry();
    mrs.name = 'Mrs';
    mrs.docs = [];
    enumEntry.enumValues = [mr, mrs];

    const normalized = new NormalizedDocumentationEntry(
      'Title',
      '',
      enumEntry,
      enumEntry,
    );

    const ctx = extractModelContext([normalized]);
    expect(ctx.enumerations).toHaveLength(1);
    expect(ctx.enumerations?.[0]).toEqual({
      path: 'my::model::Title',
      name: 'Title',
      values: ['Mr', 'Mrs'],
    });
  });

  test('deduplicates classes across multiple normalized entries', () => {
    const idProp = makePropertyDocWithType(
      'id',
      'Integer',
      new Multiplicity(1, 1),
    );
    const nameProp = makePropertyDocWithType(
      'name',
      'String',
      new Multiplicity(1, 1),
    );
    // makeClassWithProps creates one entry per property + 1 for the class
    const entries = makeClassWithProps('Customer', [idProp, nameProp]);
    // All entries have the same elementEntry class — should only produce 1 entity
    const ctx = extractModelContext(entries);
    expect(ctx.entities).toHaveLength(1);
  });

  test('marks collection and optional properties correctly', () => {
    const required = makePropertyDocWithType(
      'id',
      'Integer',
      new Multiplicity(1, 1),
    );
    const optional = makePropertyDocWithType(
      'name',
      'String',
      new Multiplicity(0, 1),
    );
    const collection = makePropertyDocWithType(
      'orders',
      'my::model::Order',
      new Multiplicity(0, undefined),
    );
    const entries = makeClassWithProps('Customer', [
      required,
      optional,
      collection,
    ]);

    const ctx = extractModelContext(entries);
    const props = ctx.entities[0]?.properties;
    expect(props).toBeDefined();
    expect(props?.[0]).toEqual({
      name: 'id',
      type: 'Integer',
      isCollection: false,
      isOptional: false,
    });
    expect(props?.[1]).toEqual({
      name: 'name',
      type: 'String',
      isCollection: false,
      isOptional: true,
    });
    expect(props?.[2]).toEqual({
      name: 'orders',
      type: 'my::model::Order',
      isCollection: true,
      isOptional: true,
    });
  });

  test('returns empty context for no class entries', () => {
    const ctx = extractModelContext([]);
    expect(ctx.entities).toHaveLength(0);
    expect(ctx.associations).toHaveLength(0);
    expect(ctx.enumerations).toBeUndefined();
  });

  test('includes class description from docs', () => {
    const cls = new ClassDocumentationEntry();
    cls.name = 'Order';
    cls.path = 'my::model::Order';
    cls.docs = ['Records details of customer orders'];
    cls.properties = [];
    const entry = new NormalizedDocumentationEntry('Order', '', cls, cls);

    const ctx = extractModelContext([entry]);
    expect(ctx.entities[0]?.description).toBe(
      'Records details of customer orders',
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// buildEnrichedBusinessContext
// ────────────────────────────────────────────────────────────────────────────

function makeModelContext(): LegendAIModelContext {
  return {
    entities: [
      {
        path: 'my::model::Customer',
        name: 'Customer',
        description: 'Stores customer information',
        properties: [
          {
            name: 'id',
            type: 'String',
            isCollection: false,
            isOptional: false,
          },
          {
            name: 'companyName',
            type: 'String',
            isCollection: false,
            isOptional: false,
          },
          {
            name: 'title',
            type: 'my::model::Title',
            isCollection: false,
            isOptional: true,
          },
          {
            name: 'orders',
            type: 'my::model::Order',
            isCollection: true,
            isOptional: true,
          },
        ],
      },
      {
        path: 'my::model::Order',
        name: 'Order',
        description: 'Records customer orders',
        properties: [
          {
            name: 'orderId',
            type: 'Integer',
            isCollection: false,
            isOptional: false,
          },
          {
            name: 'createdDate',
            type: 'StrictDate',
            isCollection: false,
            isOptional: true,
          },
        ],
      },
    ],
    associations: [
      {
        name: 'Order_Customer',
        leftEntity: 'my::model::Customer',
        leftProperty: 'customer',
        rightEntity: 'my::model::Order',
        rightProperty: 'orders',
      },
    ],
    enumerations: [
      { path: 'my::model::Title', name: 'Title', values: ['Mr', 'Mrs', 'Ms'] },
    ],
  };
}

describe(unitTest('buildEnrichedBusinessContext'), () => {
  test('includes root entity properties', () => {
    const ctx = makeModelContext();
    const result = buildEnrichedBusinessContext(
      'Show all customers',
      'my::model::Customer',
      [],
      ctx,
    );

    expect(result.naturalLanguageQuery).toBe('Show all customers');
    const props = result.businessContextMatch?.properties ?? [];
    expect(props.length).toBeGreaterThanOrEqual(3);
    expect(props.find((p) => p.propertyName === 'id')).toBeDefined();
    expect(props.find((p) => p.propertyName === 'companyName')).toBeDefined();
  });

  test('includes enum values for enum-typed properties', () => {
    const ctx = makeModelContext();
    const result = buildEnrichedBusinessContext(
      'Show customers by title',
      'my::model::Customer',
      [],
      ctx,
    );

    const titleProp = result.businessContextMatch?.properties?.find(
      (p) => p.propertyName === 'title',
    );
    expect(titleProp).toBeDefined();
    expect(titleProp?.probablePropertyValues).toEqual(['Mr', 'Mrs', 'Ms']);
    expect(titleProp?.matchType).toEqual(['enumeration']);
  });

  test('includes root entity description in additionalNlModelContext', () => {
    const ctx = makeModelContext();
    const result = buildEnrichedBusinessContext(
      'Show all customers',
      'my::model::Customer',
      ['my::model::Order'],
      ctx,
    );

    const nlContext =
      result.businessContextMatch?.additionalNlModelContext ?? [];
    const rootDesc = nlContext.find((n) => n.category === 'root_entity');
    expect(rootDesc).toBeDefined();
    expect(rootDesc?.description).toBe('Stores customer information');
  });

  test('includes related entity descriptions', () => {
    const ctx = makeModelContext();
    const result = buildEnrichedBusinessContext(
      'Show customers with orders',
      'my::model::Customer',
      ['my::model::Order'],
      ctx,
    );

    const nlContext =
      result.businessContextMatch?.additionalNlModelContext ?? [];
    const relDesc = nlContext.find((n) => n.category === 'related_entity');
    expect(relDesc).toBeDefined();
    expect(relDesc?.description).toBe('Records customer orders');
  });

  test('includes association context', () => {
    const ctx = makeModelContext();
    const result = buildEnrichedBusinessContext(
      'Show customers with orders',
      'my::model::Customer',
      ['my::model::Order'],
      ctx,
    );

    const nlContext =
      result.businessContextMatch?.additionalNlModelContext ?? [];
    const assocCtx = nlContext.find((n) => n.category === 'association');
    expect(assocCtx).toBeDefined();
    expect(assocCtx?.description).toContain('Customer');
    expect(assocCtx?.description).toContain('Order');
  });

  test('includes related entity properties', () => {
    const ctx = makeModelContext();
    const result = buildEnrichedBusinessContext(
      'Show customers with orders',
      'my::model::Customer',
      ['my::model::Order'],
      ctx,
    );

    const props = result.businessContextMatch?.properties ?? [];
    const orderProp = props.find((p) => p.propertyName === 'Order.orderId');
    expect(orderProp).toBeDefined();
    expect(orderProp?.matchType).toEqual(['Integer']);
  });

  test('returns minimal context for unknown root entity', () => {
    const ctx = makeModelContext();
    const result = buildEnrichedBusinessContext(
      'Show data',
      'my::model::Unknown',
      [],
      ctx,
    );

    expect(result.naturalLanguageQuery).toBe('Show data');
    // No properties since root entity not found
    expect(result.businessContextMatch).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// findBestAlternateRoot
// ────────────────────────────────────────────────────────────────────────────

describe(unitTest('findBestAlternateRoot'), () => {
  test('returns undefined when no related entities', () => {
    const ctx = makeModelContext();
    expect(
      findBestAlternateRoot('my::model::Customer', [], ctx),
    ).toBeUndefined();
  });

  test('returns single related entity directly', () => {
    const ctx = makeModelContext();
    expect(
      findBestAlternateRoot('my::model::Customer', ['my::model::Order'], ctx),
    ).toBe('my::model::Order');
  });

  test('prefers entity directly associated with failed root', () => {
    const ctx: LegendAIModelContext = {
      entities: [
        { path: 'a::Root', name: 'Root', properties: [] },
        { path: 'a::Direct', name: 'Direct', properties: [] },
        { path: 'a::Indirect', name: 'Indirect', properties: [] },
      ],
      associations: [
        {
          name: 'Root_Direct',
          leftEntity: 'a::Root',
          leftProperty: 'root',
          rightEntity: 'a::Direct',
          rightProperty: 'direct',
        },
        {
          name: 'Direct_Indirect',
          leftEntity: 'a::Direct',
          leftProperty: 'direct',
          rightEntity: 'a::Indirect',
          rightProperty: 'indirect',
        },
      ],
    };
    expect(
      findBestAlternateRoot('a::Root', ['a::Indirect', 'a::Direct'], ctx),
    ).toBe('a::Direct');
  });

  test('falls back to first related entity when no associations', () => {
    const ctx: LegendAIModelContext = {
      entities: [
        { path: 'a::A', name: 'A', properties: [] },
        { path: 'a::B', name: 'B', properties: [] },
        { path: 'a::C', name: 'C', properties: [] },
      ],
      associations: [],
    };
    expect(findBestAlternateRoot('a::A', ['a::B', 'a::C'], ctx)).toBe('a::B');
  });

  test('picks most-connected entity among multiple candidates', () => {
    const ctx: LegendAIModelContext = {
      entities: [
        { path: 'a::Root', name: 'Root', properties: [] },
        { path: 'a::Hub', name: 'Hub', properties: [] },
        { path: 'a::Leaf', name: 'Leaf', properties: [] },
        { path: 'a::Extra', name: 'Extra', properties: [] },
      ],
      associations: [
        {
          name: 'Root_Hub',
          leftEntity: 'a::Root',
          leftProperty: 'root',
          rightEntity: 'a::Hub',
          rightProperty: 'hub',
        },
        {
          name: 'Hub_Leaf',
          leftEntity: 'a::Hub',
          leftProperty: 'hub',
          rightEntity: 'a::Leaf',
          rightProperty: 'leaf',
        },
        {
          name: 'Hub_Extra',
          leftEntity: 'a::Hub',
          leftProperty: 'hub',
          rightEntity: 'a::Extra',
          rightProperty: 'extra',
        },
      ],
    };
    // Hub has 3 associations (Root_Hub + Hub_Leaf + Hub_Extra), Leaf has 1
    expect(findBestAlternateRoot('a::Root', ['a::Leaf', 'a::Hub'], ctx)).toBe(
      'a::Hub',
    );
  });
});

describe(unitTest('resolveEntitiesDeterministic'), () => {
  const baseCtx: LegendAIModelContext = {
    entities: [
      {
        path: 'model::Trade',
        name: 'Trade',
        properties: [
          {
            name: 'tradeId',
            type: 'String',
            isCollection: false,
            isOptional: false,
          },
          {
            name: 'quantity',
            type: 'Float',
            isCollection: false,
            isOptional: false,
          },
          {
            name: 'settlement',
            type: 'Date',
            isCollection: false,
            isOptional: false,
          },
        ],
        description: 'A financial trade record',
        isRootMapped: true,
      },
      {
        path: 'model::Account',
        name: 'Account',
        properties: [
          {
            name: 'accountId',
            type: 'String',
            isCollection: false,
            isOptional: false,
          },
          {
            name: 'accountName',
            type: 'String',
            isCollection: false,
            isOptional: false,
          },
        ],
        description: 'Client account information',
      },
      {
        path: 'model::Product',
        name: 'Product',
        properties: [
          {
            name: 'productId',
            type: 'String',
            isCollection: false,
            isOptional: false,
          },
          {
            name: 'productType',
            type: 'String',
            isCollection: false,
            isOptional: false,
          },
        ],
      },
    ],
    associations: [
      {
        name: 'Trade_Account',
        leftEntity: 'model::Trade',
        leftProperty: 'trade',
        rightEntity: 'model::Account',
        rightProperty: 'account',
      },
    ],
  };

  test('returns undefined for empty model context', () => {
    const ctx: LegendAIModelContext = { entities: [], associations: [] };
    expect(resolveEntitiesDeterministic('show trades', ctx)).toBeUndefined();
  });

  test('returns the only entity when model has exactly one', () => {
    const entity = baseCtx.entities[0];
    expect(entity).toBeDefined();
    const ctx: LegendAIModelContext = {
      entities: entity ? [entity] : [],
      associations: [],
    };
    const result = resolveEntitiesDeterministic('anything', ctx);
    expect(result).toEqual({
      rootEntity: 'model::Trade',
      relatedEntities: [],
    });
  });

  test('picks entity by name match', () => {
    const result = resolveEntitiesDeterministic(
      'show me the account data',
      baseCtx,
    );
    expect(result).toBeDefined();
    expect(result?.rootEntity).toBe('model::Account');
  });

  test('picks entity by property match', () => {
    const result = resolveEntitiesDeterministic(
      'what is the settlement date',
      baseCtx,
    );
    expect(result).toBeDefined();
    expect(result?.rootEntity).toBe('model::Trade');
  });

  test('gives root-mapped bonus when scores are close', () => {
    // Question mentions "product" — Trade is root-mapped (+3 bonus)
    // but name match (+5) beats root-mapped bonus
    const result = resolveEntitiesDeterministic('list product info', baseCtx);
    expect(result).toBeDefined();
    expect(result?.rootEntity).toBe('model::Product');
  });

  test('includes association-connected entities in relatedEntities', () => {
    const result = resolveEntitiesDeterministic('show trades', baseCtx);
    expect(result).toBeDefined();
    expect(result?.rootEntity).toBe('model::Trade');
    expect(result?.relatedEntities).toContain('model::Account');
  });

  test('picks root-mapped entity when no meaningful tokens', () => {
    const result = resolveEntitiesDeterministic('?!', baseCtx);
    expect(result).toBeDefined();
    expect(result?.rootEntity).toBe('model::Trade'); // root-mapped
  });

  test('picks root-mapped entity when all scores are zero', () => {
    const result = resolveEntitiesDeterministic('xyzzy foobar blarg', baseCtx);
    expect(result).toBeDefined();
    expect(result?.rootEntity).toBe('model::Trade'); // root-mapped
  });

  test('description keyword match contributes to score', () => {
    const result = resolveEntitiesDeterministic('financial records', baseCtx);
    expect(result).toBeDefined();
    expect(result?.rootEntity).toBe('model::Trade'); // "financial" in description
  });

  test('limits relatedEntities to at most 5', () => {
    const ctx: LegendAIModelContext = {
      entities: [
        {
          path: 'a::Root',
          name: 'Root',
          properties: [],
          isRootMapped: true,
        },
        ...Array.from({ length: 8 }, (_, i) => ({
          path: `a::E${i}`,
          name: `Entity${i}`,
          properties: [
            {
              name: 'root',
              type: 'String',
              isCollection: false,
              isOptional: false,
            },
          ],
        })),
      ],
      associations: Array.from({ length: 8 }, (_, i) => ({
        name: `Assoc${i}`,
        leftEntity: 'a::Root',
        leftProperty: 'root',
        rightEntity: `a::E${i}`,
        rightProperty: `e${i}`,
      })),
    };
    const result = resolveEntitiesDeterministic('show root data', ctx);
    expect(result).toBeDefined();
    expect(result?.relatedEntities.length).toBeLessThanOrEqual(5);
  });

  test('queryable entity wins over non-queryable with higher name score', () => {
    const ctx: LegendAIModelContext = {
      entities: [
        {
          path: 'model::OrigAggr',
          name: 'OrigAggr',
          properties: [
            {
              name: 'aggrid',
              type: 'Integer',
              isCollection: false,
              isOptional: false,
            },
            {
              name: 'loanamt',
              type: 'Float',
              isCollection: false,
              isOptional: false,
            },
          ],
          description: 'Loan aggregation data',
        },
        {
          path: 'model::OrigFhlloan',
          name: 'OrigFhlloan',
          properties: [
            {
              name: 'loanseqnum',
              type: 'String',
              isCollection: false,
              isOptional: false,
            },
            {
              name: 'cusip',
              type: 'String',
              isCollection: false,
              isOptional: false,
            },
          ],
          description: 'FHL loan level data',
          isQueryable: true,
        },
      ],
      associations: [],
      executables: [
        {
          title: 'FHL Loans For Beg Date Data',
          rootEntityPath: 'model::OrigFhlloan',
        },
      ],
    };
    // "loan" matches both entities but OrigFhlloan is queryable (+10)
    const result = resolveEntitiesDeterministic('show loan data', ctx);
    expect(result).toBeDefined();
    expect(result?.rootEntity).toBe('model::OrigFhlloan');
  });

  test('executable title match boosts score', () => {
    const ctx: LegendAIModelContext = {
      entities: [
        {
          path: 'model::OrigFhlloan',
          name: 'OrigFhlloan',
          properties: [
            {
              name: 'cusip',
              type: 'String',
              isCollection: false,
              isOptional: false,
            },
          ],
          isQueryable: true,
        },
        {
          path: 'model::OrigGnmloan',
          name: 'OrigGnmloan',
          properties: [
            {
              name: 'cusip',
              type: 'String',
              isCollection: false,
              isOptional: false,
            },
          ],
          isQueryable: true,
        },
        {
          path: 'model::OrigSec',
          name: 'OrigSec',
          properties: [
            {
              name: 'cusip',
              type: 'String',
              isCollection: false,
              isOptional: false,
            },
          ],
          isQueryable: true,
        },
      ],
      associations: [],
      executables: [
        {
          title: 'FHL Loans For Factor Date',
          rootEntityPath: 'model::OrigFhlloan',
        },
        {
          title: 'GNM Loans For Factor Date',
          rootEntityPath: 'model::OrigGnmloan',
        },
        {
          title: 'Sec For Agency Data',
          rootEntityPath: 'model::OrigSec',
        },
      ],
    };
    // "FHL" matches the executable title for OrigFhlloan
    const result = resolveEntitiesDeterministic('show FHL loan data', ctx);
    expect(result).toBeDefined();
    expect(result?.rootEntity).toBe('model::OrigFhlloan');
  });

  test('picks first queryable entity when no meaningful tokens', () => {
    const ctx: LegendAIModelContext = {
      entities: [
        {
          path: 'model::RefTable',
          name: 'RefTable',
          properties: [],
        },
        {
          path: 'model::QueryableEntity',
          name: 'QueryableEntity',
          properties: [],
          isQueryable: true,
        },
      ],
      associations: [],
    };
    const result = resolveEntitiesDeterministic('?!', ctx);
    expect(result).toBeDefined();
    expect(result?.rootEntity).toBe('model::QueryableEntity');
  });
});

describe(unitTest('buildSemanticPropertyIndex'), () => {
  test('indexes property names as tokens', () => {
    const ctx: LegendAIModelContext = {
      entities: [
        {
          path: 'model::Trade',
          name: 'Trade',
          properties: [
            {
              name: 'tradeDate',
              type: 'Date',
              isCollection: false,
              isOptional: false,
            },
            {
              name: 'settlementAmount',
              type: 'Float',
              isCollection: false,
              isOptional: false,
            },
          ],
        },
      ],
      associations: [],
    };
    const index = buildSemanticPropertyIndex(ctx);
    // camelCase is split: tradeDate → "trade", "date"
    expect(index.get('trade')?.has('model::Trade')).toBe(true);
    expect(index.get('date')?.has('model::Trade')).toBe(true);
    expect(index.get('settlement')?.has('model::Trade')).toBe(true);
    expect(index.get('amount')?.has('model::Trade')).toBe(true);
  });

  test('indexes entity descriptions', () => {
    const ctx: LegendAIModelContext = {
      entities: [
        {
          path: 'model::Security',
          name: 'Security',
          properties: [],
          description: 'Mortgage-backed security information',
        },
      ],
      associations: [],
    };
    const index = buildSemanticPropertyIndex(ctx);
    expect(index.get('mortgage')?.has('model::Security')).toBe(true);
    expect(index.get('security')?.has('model::Security')).toBe(true);
  });

  test('skips short tokens (length <= 2)', () => {
    const ctx: LegendAIModelContext = {
      entities: [
        {
          path: 'model::Item',
          name: 'Item',
          properties: [
            {
              name: 'id',
              type: 'String',
              isCollection: false,
              isOptional: false,
            },
          ],
        },
      ],
      associations: [],
    };
    const index = buildSemanticPropertyIndex(ctx);
    expect(index.has('id')).toBe(false);
  });
});

/** Builds a single-valued, required model property fixture. */
function makeProperty(name: string, type: string): LegendAIModelProperty {
  return { name, type, isCollection: false, isOptional: false };
}

/** Builds a TDS service fixture exposing the given columns as strings. */
function makeService(title: string, columnNames: string[]): TDSServiceSchema {
  return {
    title,
    pattern: `/${title}`,
    columns: columnNames.map(
      (name): TDSColumnSchema => ({ name, type: 'String' }),
    ),
    parameters: [],
  };
}

describe(unitTest('buildEnrichedBusinessContext with executables'), () => {
  const executableCtx: LegendAIModelContext = {
    entities: [
      {
        path: 'model::Holdings',
        name: 'Holdings',
        isQueryable: true,
        properties: [
          makeProperty('fundIsin', 'String'),
          makeProperty('longCompName', 'String'),
        ],
      },
      {
        path: 'model::Sales',
        name: 'Sales',
        properties: [
          makeProperty('cntryOfDomicile', 'String'),
          makeProperty('longCompName', 'String'),
        ],
      },
    ],
    associations: [],
    dataspaceDescription:
      '# Welcome\nProvides mortgage-backed securities data.',
    executables: [
      {
        title: 'Holdings Service',
        rootEntityPath: 'model::Holdings',
        queryTemplate:
          'model::Holdings.all()->filter({x|$x.fundIsin == $isin})',
        requiredParameters: [
          { name: 'processingDate', type: 'Date' },
          { name: 'fundIsins', type: 'String' },
        ],
        columnPropertyMappings: [
          { columnName: 'LONG COMP NAME', propertyPath: 'longCompName' },
        ],
      },
      { title: 'Archive Service', rootEntityPath: 'model::Archive' },
    ],
  };

  /** Collects the NL context hints emitted for a question against a root entity. */
  function hintsFor(question: string, rootEntity: string) {
    return (
      buildEnrichedBusinessContext(question, rootEntity, [], executableCtx)
        .businessContextMatch?.additionalNlModelContext ?? []
    );
  }

  test('emits a hint per executable facet of the resolved root entity', () => {
    const hints = hintsFor('show holdings', 'model::Holdings');
    const byCategory = new Map(hints.map((h) => [h.category, h.description]));

    expect([...byCategory.keys()]).toEqual(
      expect.arrayContaining([
        'queryable_hint',
        'product_context',
        'query_template',
        'required_parameters',
        'column_mappings',
        'executable_summary',
      ]),
    );
    expect(byCategory.get('queryable_hint')).toContain('Holdings Service');
    expect(byCategory.get('product_context')).toContain(
      'mortgage-backed securities',
    );
    expect(byCategory.get('query_template')).toContain('Holdings.all()');
    expect(byCategory.get('required_parameters')).toContain(
      'processingDate (Date), fundIsins (String)',
    );
    expect(byCategory.get('column_mappings')).toContain(
      '"LONG COMP NAME" → longCompName',
    );
    expect(byCategory.get('executable_summary')).toContain(
      '"Holdings Service" → Holdings (requires: processingDate, fundIsins)',
    );
    expect(byCategory.get('executable_summary')).toContain(
      '"Archive Service" → Archive',
    );
  });

  test('omits root-specific executable hints when no executable maps to the root', () => {
    const categories = hintsFor('show sales', 'model::Sales').map(
      (h) => h.category,
    );

    expect(categories).not.toContain('query_template');
    expect(categories).not.toContain('required_parameters');
    expect(categories).not.toContain('column_mappings');
    expect(categories).toContain('executable_summary');
  });

  test('warns only about question properties absent from the root entity', () => {
    const warningFor = (question: string) =>
      hintsFor(question, 'model::Holdings').find(
        (h) => h.category === 'cross_class_warning',
      );

    const warning = warningFor('show holdings domiciled in the United States');
    expect(warning?.description).toContain('cntryOfDomicile');
    expect(warning?.description).toContain('Sales');
    expect(warning?.description).toContain('NOT on Holdings');
    expect(warningFor('show the long comp name')).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// buildModelContextEnrichmentText
// ────────────────────────────────────────────────────────────────────────────

const enrichmentCtx: LegendAIModelContext = {
  entities: [
    {
      path: 'model::Plain',
      name: 'Plain',
      properties: [makeProperty('note', 'String')],
    },
    {
      path: 'model::Order',
      name: 'Order',
      description: 'Customer order',
      isQueryable: true,
      isRootMapped: true,
      properties: [
        makeProperty('orderId', 'Integer'),
        makeProperty('status', 'model::OrderStatus'),
        { ...makeProperty('lineItems', 'LineItem'), isCollection: true },
      ],
    },
    {
      path: 'model::Product',
      name: 'Product',
      properties: [
        makeProperty('productId', 'String'),
        makeProperty('productName', 'String'),
      ],
    },
  ],
  associations: [
    {
      name: 'Order_Product',
      leftEntity: 'model::Order',
      rightEntity: 'model::Product',
      leftProperty: 'product',
      rightProperty: 'orders',
    },
  ],
  enumerations: [
    {
      path: 'model::OrderStatus',
      name: 'OrderStatus',
      values: ['NEW', 'FILLED', 'CANCELLED'],
    },
  ],
  executables: [
    {
      title: 'Order History',
      rootEntityPath: 'model::Order',
      description: 'Daily order report',
      requiredParameters: [{ name: 'startDate', type: 'StrictDate' }],
    },
  ],
  dataspaceDescription: 'Order management data',
};

const orderService = makeService('OrderService', ['orderId', 'status']);
const orderServiceV2 = makeService('OrderServiceV2', ['orderId', 'status']);
const productService = makeService('ProductService', [
  'productId',
  'productName',
]);

describe(unitTest('buildModelContextEnrichmentText'), () => {
  test('emits every model section for a fully populated context', () => {
    const result =
      buildModelContextEnrichmentText(enrichmentCtx, [
        orderService,
        productService,
      ]) ?? '';

    for (const fragment of [
      '# DATA MODEL CONTEXT',
      '## Data Model Overview',
      'Order management data',
      '## Model Entities',
      '### Order [QUERYABLE, ROOT_MAPPED]',
      'Customer order',
      '- orderId: Integer',
      '- lineItems: LineItem (many)',
      '## Enumerations (valid filter values)',
      '- OrderStatus: NEW, FILLED, CANCELLED',
      '## Entity Relationships',
      '- Order.product → Product, Product.orders → Order',
      '## Available Executables',
      '- "Order History" → Order',
      'Daily order report',
      'Required parameters: startDate (StrictDate)',
      '## Column Filter Value Mappings',
      '- Column "status" accepts: NEW, FILLED, CANCELLED',
      '## Model-Aware Service JOIN Guide',
      '- **OrderService** → entity Order',
      '- **ProductService** → entity Product',
      '### Inter-Service Relationships',
      '- **OrderService** ↔ **ProductService**: Related via Order.product → Product',
    ]) {
      expect(result).toContain(fragment);
    }
    expect(result.indexOf('### Order')).toBeLessThan(
      result.indexOf('### Plain'),
    );
  });

  test('lists enum filter values once per column and skips non-enum columns', () => {
    const result =
      buildModelContextEnrichmentText(enrichmentCtx, [
        orderService,
        orderServiceV2,
      ]) ?? '';

    expect(result.match(/Column "status" accepts/gu)).toHaveLength(1);
    expect(result).not.toContain('Column "orderId"');
  });

  test('hints that two services backed by the same entity can be joined', () => {
    const result =
      buildModelContextEnrichmentText(enrichmentCtx, [
        orderService,
        orderServiceV2,
      ]) ?? '';

    expect(result).toContain(
      '- **OrderService** and **OrderServiceV2** query the SAME entity',
    );
  });

  test('omits the column mapping and JOIN sections when services are absent or too few', () => {
    const withoutServices =
      buildModelContextEnrichmentText(enrichmentCtx) ?? '';
    expect(withoutServices).toContain('## Enumerations (valid filter values)');
    expect(withoutServices).not.toContain('## Column Filter Value Mappings');
    expect(withoutServices).not.toContain('## Model-Aware Service JOIN Guide');

    const withOneService =
      buildModelContextEnrichmentText(enrichmentCtx, [orderService]) ?? '';
    expect(withOneService).not.toContain('## Model-Aware Service JOIN Guide');
  });

  test('caps the executable and JOIN service lists and notes the omissions', () => {
    const OVER_CAP_COUNT = 30;
    const withExecutables =
      buildModelContextEnrichmentText({
        ...enrichmentCtx,
        executables: Array.from({ length: OVER_CAP_COUNT }, (_, i) => ({
          title: `Service ${i}`,
          rootEntityPath: `model::Entity${i}`,
        })),
      }) ?? '';
    expect(withExecutables).toContain('"Service 24"');
    expect(withExecutables).not.toContain('"Service 25"');
    expect(withExecutables).toContain('(5 additional executables omitted)');

    const withServices =
      buildModelContextEnrichmentText(
        enrichmentCtx,
        Array.from({ length: OVER_CAP_COUNT }, (_, i) =>
          makeService(`JoinSvc ${i}`, ['orderId', 'status']),
        ),
      ) ?? '';
    expect(withServices).toContain('**JoinSvc 24**');
    expect(withServices).not.toContain('**JoinSvc 25**');
    expect(withServices).toContain('(5 additional services omitted)');
  });

  test('returns undefined for an empty model context', () => {
    expect(
      buildModelContextEnrichmentText({ entities: [], associations: [] }),
    ).toBeUndefined();
  });
});

describe(unitTest('buildModelCatalogText'), () => {
  test('emits entities, relationships, enumerations and how-to-query sections', () => {
    const result =
      buildModelCatalogText({
        ...makeModelContext(),
        executables: [
          {
            title: 'All Customers',
            description: 'Returns every customer.',
            rootEntityPath: 'my::model::Customer',
          },
          {
            title: 'Customer By Id',
            rootEntityPath: 'my::model::Customer',
            requiredParameters: [{ name: 'customerId', type: 'String' }],
          },
        ],
      }) ?? '';

    for (const fragment of [
      '# MODEL REFERENCE',
      '## Entities and Columns',
      '### Customer',
      'Stores customer information',
      '- id: String [1]',
      '- title: my::model::Title [0..1]',
      '- orders: my::model::Order [*]',
      '### Order',
      '## Relationships',
      '- my::model::Customer.customer <-> my::model::Order.orders',
      '## Enumerations (valid values)',
      '- Title: Mr, Mrs, Ms',
      '## How to query (available executables)',
      '- **All Customers** → Customer',
      'Returns every customer.',
      'Required parameters: customerId (String)',
    ]) {
      expect(result).toContain(fragment);
    }
  });

  test('marks queryable and root-mapped entities and lists them first', () => {
    const result =
      buildModelCatalogText({
        entities: [
          {
            path: 'my::model::Plain',
            name: 'Plain',
            properties: [makeProperty('a', 'String')],
          },
          {
            path: 'my::model::Root',
            name: 'Root',
            isQueryable: true,
            isRootMapped: true,
            properties: [makeProperty('b', 'String')],
          },
        ],
        associations: [],
      }) ?? '';

    expect(result).toContain('### Root [queryable, root-mapped]');
    expect(result).toContain('### Plain');
    expect(result.indexOf('### Root')).toBeLessThan(
      result.indexOf('### Plain'),
    );
  });

  test('caps the entity list and notes the omission', () => {
    const OVER_CAP_COUNT = 50;
    const result =
      buildModelCatalogText({
        entities: Array.from({ length: OVER_CAP_COUNT }, (_, i) => ({
          path: `my::model::E${i}`,
          name: `E${i}`,
          properties: [makeProperty('x', 'String')],
        })),
        associations: [],
      }) ?? '';

    expect(result).toContain('### E39');
    expect(result).not.toContain('### E40');
    expect(result).toContain('(10 additional entities omitted');
  });

  test('returns undefined for an empty model context', () => {
    expect(
      buildModelCatalogText({ entities: [], associations: [] }),
    ).toBeUndefined();
  });
});

describe(unitTest('buildDataQueryApproachText'), () => {
  test('narrates the chosen root entity, its columns and related entities', () => {
    const text =
      buildDataQueryApproachText(
        'show me customer companies',
        makeModelContext(),
      ) ?? '';
    expect(text).toContain('**Customer**');
    expect(text).toContain('Stores customer information');
    expect(text).toContain('`companyName`');
    expect(text).toContain('**Order**');
  });

  test('names the backing service when an executable maps to the root', () => {
    const ctx: LegendAIModelContext = {
      entities: [
        {
          path: 'my::model::Customer',
          name: 'Customer',
          isQueryable: true,
          isRootMapped: true,
          properties: [
            {
              name: 'id',
              type: 'String',
              isCollection: false,
              isOptional: false,
            },
          ],
        },
      ],
      associations: [],
      executables: [
        {
          title: 'All Customers',
          rootEntityPath: 'my::model::Customer',
        },
      ],
    };
    const text = buildDataQueryApproachText('list customers', ctx) ?? '';
    expect(text).toContain('**All Customers**');
    expect(text).toContain('**Customer**');
    expect(text).toContain('`id`');
  });

  test('returns undefined when there is no model to reason over', () => {
    expect(
      buildDataQueryApproachText('anything', {
        entities: [],
        associations: [],
      }),
    ).toBeUndefined();
  });
});

describe(unitTest('rankEntities'), () => {
  test('ranks the most relevant entity first (highest score)', () => {
    const ranked = rankEntities(
      'show me customer companies',
      makeModelContext(),
    );
    expect(ranked.length).toBeGreaterThan(1);
    expect(ranked[0]?.entity.name).toBe('Customer');
    expect(ranked[0]?.score ?? 0).toBeGreaterThanOrEqual(ranked[1]?.score ?? 0);
  });

  test('boosts an entity when the question mentions one of its enum values', () => {
    const ranked = rankEntities(
      'records where title is Mrs',
      makeModelContext(),
    );
    const customer = ranked.find((r) => r.entity.name === 'Customer');
    const order = ranked.find((r) => r.entity.name === 'Order');
    expect(customer).toBeDefined();
    expect(customer?.score ?? 0).toBeGreaterThan(order?.score ?? 0);
  });

  test('boosts an entity via its executable required-parameter names', () => {
    const ctx: LegendAIModelContext = {
      entities: [
        {
          path: 'my::model::Sales',
          name: 'Sales',
          properties: [
            {
              name: 'amount',
              type: 'Float',
              isCollection: false,
              isOptional: false,
            },
          ],
        },
        {
          path: 'my::model::Other',
          name: 'Other',
          properties: [
            {
              name: 'x',
              type: 'String',
              isCollection: false,
              isOptional: false,
            },
          ],
        },
      ],
      associations: [],
      executables: [
        {
          title: 'Sales By Region',
          rootEntityPath: 'my::model::Sales',
          requiredParameters: [{ name: 'region', type: 'String' }],
        },
      ],
    };
    const ranked = rankEntities('sales for a region', ctx);
    expect(ranked[0]?.entity.name).toBe('Sales');
  });
});

describe(unitTest('relaxExactStringFilters'), () => {
  test('relaxes exact string equality to case-insensitive contains', () => {
    expect(relaxExactStringFilters("$x.geography == 'India'")).toBe(
      "$x.geography->toLower()->contains('india')",
    );
  });

  test('handles nested paths and ->toOne()', () => {
    expect(relaxExactStringFilters("$m.a.geography->toOne() == 'High'")).toBe(
      "$m.a.geography->toOne()->toLower()->contains('high')",
    );
  });

  test('leaves numeric/date equality untouched', () => {
    const q = '$x.urgency == 3';
    expect(relaxExactStringFilters(q)).toBe(q);
  });

  test('returns the query unchanged when there is nothing to relax', () => {
    const q = "$x.name->toLower()->contains('abc')";
    expect(relaxExactStringFilters(q)).toBe(q);
  });
});

describe(unitTest('buildEnrichedBusinessContext valid-value grounding'), () => {
  test('surfaces enum values and filter guidance for the resolved root', () => {
    const ctx = buildEnrichedBusinessContext(
      'records where title is Mrs',
      'my::model::Customer',
      [],
      makeModelContext(),
    );
    const hints =
      ctx.businessContextMatch?.additionalNlModelContext?.map(
        (h) => h.description,
      ) ?? [];
    const joined = hints.join('\n');
    expect(joined).toContain('Valid values');
    expect(joined).toContain('Mrs');
    expect(joined.toLowerCase()).toContain('case-insensitive');
  });
});

describe(unitTest('extractFilteredColumns'), () => {
  test('extracts leaf columns from comparison and contains predicates', () => {
    const query =
      "X.all()->filter(x|($x.geography == 'India') && ($x.a.description->toLower()->contains('gdp')))->take(10)";
    const cols = extractFilteredColumns(query);
    expect(cols).toContain('geography');
    expect(cols).toContain('description');
  });

  test('returns empty when there are no string/contains filters', () => {
    expect(extractFilteredColumns('X.all()->take(10)')).toEqual([]);
  });
});

describe(unitTest('buildProbedValueHints'), () => {
  test('emits a probed_values hint listing the real values', () => {
    const hints = buildProbedValueHints(
      new Map([['geography', ['IN', 'US', 'DE']]]),
    );
    expect(hints).toHaveLength(1);
    expect(hints[0]?.category).toBe('probed_values');
    expect(hints[0]?.description).toContain("'geography'");
    expect(hints[0]?.description).toContain('IN, US, DE');
  });

  test('skips columns with no probed values', () => {
    expect(buildProbedValueHints(new Map([['x', []]]))).toEqual([]);
  });
});

describe(unitTest('buildPriorSqlFailureHints'), () => {
  test('emits reason and query hints for a failed SQL attempt', () => {
    const hints = buildPriorSqlFailureHints(
      'SELECT * FROM t',
      'Query returned 0 rows',
    );
    expect(hints).toHaveLength(2);
    expect(hints[0]?.id).toBe('prior_sql_failure_reason');
    expect(hints[0]?.description).toContain('Query returned 0 rows');
    expect(hints[1]?.id).toBe('prior_sql_failure_query');
    expect(hints[1]?.description).toContain('SELECT * FROM t');
  });

  test('emits only the reason hint when no SQL is available', () => {
    const hints = buildPriorSqlFailureHints(undefined, 'Generation failed');
    expect(hints).toHaveLength(1);
    expect(hints[0]?.id).toBe('prior_sql_failure_reason');
  });
});

describe(unitTest('rankEntities enrichment signals'), () => {
  const twoEntityCtx = (
    executables: { title: string; rootEntityPath: string }[],
  ): LegendAIModelContext => ({
    entities: [
      {
        path: 'model::Alpha',
        name: 'Alpha',
        properties: [],
        isQueryable: true,
      },
      { path: 'model::Beta', name: 'Beta', properties: [], isQueryable: true },
    ],
    associations: [],
    executables,
  });

  test('boosts the entity referenced by more executables', () => {
    const ctx = twoEntityCtx([
      { title: 'svc one', rootEntityPath: 'model::Beta' },
      { title: 'svc two', rootEntityPath: 'model::Beta' },
      { title: 'svc three', rootEntityPath: 'model::Beta' },
    ]);
    const ranked = rankEntities('show me the records', ctx);
    expect(ranked[0]?.entity.path).toBe('model::Beta');
    const alpha = ranked.find((r) => r.entity.path === 'model::Alpha');
    const beta = ranked.find((r) => r.entity.path === 'model::Beta');
    expect(beta?.score ?? 0).toBeGreaterThan(alpha?.score ?? 0);
  });

  test('is unchanged when no executables are provided', () => {
    const ranked = rankEntities('show me the records', twoEntityCtx([]));
    expect(ranked.map((r) => r.entity.path).sort()).toEqual([
      'model::Alpha',
      'model::Beta',
    ]);
    const alpha = guaranteeNonNullable(
      ranked.find((r) => r.entity.path === 'model::Alpha'),
    );
    const beta = guaranteeNonNullable(
      ranked.find((r) => r.entity.path === 'model::Beta'),
    );
    expect(alpha.score).toBe(beta.score);
  });

  test('a direct name match still outranks an executable-count prior', () => {
    const ctx = twoEntityCtx([
      { title: 'svc one', rootEntityPath: 'model::Beta' },
      { title: 'svc two', rootEntityPath: 'model::Beta' },
      { title: 'svc three', rootEntityPath: 'model::Beta' },
    ]);
    expect(rankEntities('show alpha data', ctx)[0]?.entity.path).toBe(
      'model::Alpha',
    );
  });
});

describe(unitTest('milestoning + function enrichment'), () => {
  test('extractModelContext captures class milestoning', () => {
    const cls = new ClassDocumentationEntry();
    cls.name = 'Trade';
    cls.path = 'my::model::Trade';
    cls.docs = [];
    cls.properties = [];
    cls.milestoning = 'businesstemporal';
    const ctx = extractModelContext([
      new NormalizedDocumentationEntry('Trade', '', cls, cls),
    ]);
    expect(ctx.entities[0]?.milestoning).toBe('businesstemporal');
  });

  const enrichedCtx: LegendAIModelContext = {
    entities: [
      {
        path: 'm::Trade',
        name: 'Trade',
        properties: [],
        isQueryable: true,
        milestoning: 'bitemporal',
      },
    ],
    associations: [],
    functions: [
      {
        name: 'pctChange',
        functionPath: 'm::pctChange',
        returnType: 'Float',
        parameters: [
          { name: 'from', type: 'Float' },
          { name: 'to', type: 'Float' },
        ],
      },
    ],
  };

  test('buildModelContextEnrichmentText includes temporal + function sections', () => {
    const text = buildModelContextEnrichmentText(enrichedCtx);
    expect(text).toContain('Temporal Entities');
    expect(text).toContain('bitemporal');
    expect(text).toContain('Available Functions');
    expect(text).toContain('pctChange(from: Float, to: Float): Float');
  });

  test('buildEnrichedBusinessContext emits milestoning + function hints', () => {
    const result = buildEnrichedBusinessContext(
      'show trades',
      'm::Trade',
      [],
      enrichedCtx,
    );
    const categories =
      result.businessContextMatch?.additionalNlModelContext?.map(
        (e) => e.category,
      ) ?? [];
    expect(categories).toContain('milestoning_hint');
    expect(categories).toContain('function');
  });
});
