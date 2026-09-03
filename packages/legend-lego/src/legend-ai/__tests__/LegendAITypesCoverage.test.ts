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

import { test, describe, expect } from '@jest/globals';
import { unitTest } from '@finos/legend-shared/test';
import {
  findLegendAIPlugin,
  classifyQuestionIntentFast,
  LegendAIQuestionIntent,
  DEFAULT_LEGEND_AI_CONFIG,
  buildColumnDefsFromNames,
  parseTDSColumnDoc,
  buildParameterSchemas,
} from '../LegendAITypes.js';
import type { LegendApplicationPlugin } from '@finos/legend-application';
import {
  Multiplicity,
  VariableExpression,
  RawLambda,
} from '@finos/legend-graph';

// ─── findLegendAIPlugin ──────────────────────────────────────────────────────

describe(unitTest('findLegendAIPlugin'), () => {
  test('returns undefined when no plugins match', () => {
    const fakePlugin = { getName: () => 'other' } as LegendApplicationPlugin;
    expect(findLegendAIPlugin([fakePlugin])).toBeUndefined();
  });

  test('returns undefined for empty array', () => {
    expect(findLegendAIPlugin([])).toBeUndefined();
  });
});

// ─── DEFAULT_LEGEND_AI_CONFIG ────────────────────────────────────────────────

describe(unitTest('DEFAULT_LEGEND_AI_CONFIG'), () => {
  test('has expected defaults', () => {
    expect(DEFAULT_LEGEND_AI_CONFIG.enabled).toBe(false);
    expect(DEFAULT_LEGEND_AI_CONFIG.llmServiceUrl).toBeUndefined();
    expect(DEFAULT_LEGEND_AI_CONFIG.orchestratorUrl).toBeUndefined();
    expect(DEFAULT_LEGEND_AI_CONFIG.marketplaceSearchUrl).toBeUndefined();
    expect(DEFAULT_LEGEND_AI_CONFIG.engineUrl).toBeUndefined();
  });

  test('is frozen', () => {
    expect(Object.isFrozen(DEFAULT_LEGEND_AI_CONFIG)).toBe(true);
  });
});

// ─── buildColumnDefsFromNames ────────────────────────────────────────────────

describe(unitTest('buildColumnDefsFromNames'), () => {
  test('builds column defs from name array', () => {
    const defs = buildColumnDefsFromNames(['a', 'b']);
    expect(defs).toEqual([
      { colId: 'a', headerName: 'a', field: 'a' },
      { colId: 'b', headerName: 'b', field: 'b' },
    ]);
  });

  test('returns empty array for empty input', () => {
    expect(buildColumnDefsFromNames([])).toEqual([]);
  });
});

// ─── classifyQuestionIntentFast — signal phrases ─────────────────────────────

describe(unitTest('classifyQuestionIntentFast — signal phrases'), () => {
  test.each([
    'summarize what you provide',
    'what do you have',
    'how many fields does this product have',
    'what type of data is this',
    'describe the data',
    'summary of this product',
    'what is this product',
    'tell me more',
    'what this product provides',
    'how does this system work',
    'what can i do with this',
    'used for analytics',
    'help me understand this',
    'what information does this provide',
    'what does myservice do',
  ])('classifies %p as metadata on a matched signal', (question) => {
    const result = classifyQuestionIntentFast(question, true);
    expect(result.intent).toBe(LegendAIQuestionIntent.METADATA);
    expect(result.metaScore).toBeGreaterThan(0);
  });

  test.each([
    'get distinct values for region',
    'select data from service',
    'compare vendor a versus vendor b',
    'what percentage of total revenue',
    'which accounts generate the most revenue',
    'how much revenue',
    'trades on 2024-01-15',
    'last quarter results',
    'show fiscal year data q1 2024',
    'lookup sedol XXXXXXX',
    'volume per country',
    'show data grouped by region',
    'revenue broken down by category',
    'positions as of today',
  ])('classifies %p as a data query on a matched signal', (question) => {
    const result = classifyQuestionIntentFast(question, true);
    expect(result.intent).toBe(LegendAIQuestionIntent.DATA_QUERY);
    expect(result.dataScore).toBeGreaterThan(0);
  });
});

// ─── classifyQuestionIntentFast — ambiguous / tie branches ───────────────────

describe(
  unitTest('classifyQuestionIntentFast — ambiguous / tie branches'),
  () => {
    test('data dominance when data >= 2x meta triggers non-ambiguous data', () => {
      // "select top 5 rows from service where amount > 100 group by region"
      const result = classifyQuestionIntentFast(
        'select top 5 rows from service where amount > 100 group by region for last year',
        true,
      );
      expect(result.dataScore).toBeGreaterThanOrEqual(result.metaScore * 2);
      expect(result.intent).toBe(LegendAIQuestionIntent.DATA_QUERY);
      expect(result.ambiguous).toBe(false);
    });
  },
);

// ─── buildParameterSchemas ───────────────────────────────────────────────────

describe(unitTest('buildParameterSchemas'), () => {
  const graphManagerState = {
    graphManager: {
      buildValueSpecification: (param: { name?: string }) =>
        new VariableExpression(param.name ?? '', new Multiplicity(1, 1)),
    },
    graph: {},
  } as never;

  test('reports each parameter the lambda declares', () => {
    const result = buildParameterSchemas(
      new RawLambda([{ name: 'orderId' }, { name: 'asOfDate' }], undefined),
      graphManagerState,
    );
    expect(result.parameterExtractionFailed).toBe(false);
    expect(result.parameters).toEqual(['orderId', 'asOfDate']);
    expect(result.parameterSchemas.map((s) => s.name)).toEqual([
      'orderId',
      'asOfDate',
    ]);
  });

  test('marks a parameter required when its multiplicity excludes zero', () => {
    const result = buildParameterSchemas(
      new RawLambda([{ name: 'orderId' }], undefined),
      graphManagerState,
    );
    expect(result.parameterSchemas[0]?.required).toBe(true);
  });

  test('returns no parameters when the lambda declares none', () => {
    const result = buildParameterSchemas(
      new RawLambda(undefined, undefined),
      graphManagerState,
    );
    expect(result.parameterExtractionFailed).toBe(false);
    expect(result.parameters).toEqual([]);
    expect(result.parameterSchemas).toEqual([]);
  });
});

describe(unitTest('parseTDSColumnDoc'), () => {
  test('splits documentation from sample values', () => {
    expect(parseTDSColumnDoc('Ticker symbol -- e.g. AAA, BBB')).toEqual({
      documentation: 'Ticker symbol',
      sampleValues: 'AAA, BBB',
    });
  });

  test('treats a doc without the delimiter as documentation only', () => {
    expect(parseTDSColumnDoc('  Ticker symbol  ')).toEqual({
      documentation: 'Ticker symbol',
    });
  });

  test('omits a blank half on either side of the delimiter', () => {
    expect(parseTDSColumnDoc('   -- e.g. AAA')).toEqual({
      sampleValues: 'AAA',
    });
    expect(parseTDSColumnDoc('Ticker symbol -- e.g.   ')).toEqual({
      documentation: 'Ticker symbol',
    });
    expect(parseTDSColumnDoc('   ')).toEqual({});
  });
});
