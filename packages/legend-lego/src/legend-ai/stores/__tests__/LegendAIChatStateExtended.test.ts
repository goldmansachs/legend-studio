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
import { unitTest, createMock } from '@finos/legend-shared/test';
import {
  elapsedSeconds,
  createMessagePair,
  analyzeOrchestratorResults,
  processQuestion,
  processQuestionWithIntent,
  executeSqlAndReport,
  handleMetadataQuestion,
  generateAndJudgeSql,
  buildConversationHistory,
  isProductOverviewQuestion,
  buildAccessPointCatalog,
} from '../LegendAIChatProcessors.js';
import {
  type LegendAIMessage,
  type TDSServiceSchema,
  LegendAIMessageRole,
  LegendAIQuestionIntent,
  TDSServiceSourceType,
} from '../../LegendAITypes.js';
import type {
  LegendAIOrchestratorDataProductCoordinates,
  LegendAI_LegendApplicationPlugin_Extension,
} from '../../LegendAI_LegendApplicationPlugin_Extension.js';
import type { QueryExplicitExecutionContextInfo } from '@finos/legend-graph';
import {
  TEST__createMockSetter,
  TEST__seedAssistant,
  TEST__createMockLegendAIPlugin,
  TEST_DATA__legendAIConfig,
  TEST_DATA__legendAIMetadata,
  TEST_DATA__legendAIServices,
  TEST__getAssistantMessage,
} from '../../__test-utils__/LegendAITestUtils.js';

const TEST_DATA__coordinates: LegendAIOrchestratorDataProductCoordinates = {
  data_product: 'my::TestProduct',
  group_id: 'com.test',
  artifact_id: 'prod',
  version: '1.0.0',
};

const TEST_DATA__executionContext: QueryExplicitExecutionContextInfo = {
  mapping: 'my::Mapping',
  runtime: 'my::Runtime',
};

// ─── elapsedSeconds ──────────────────────────────────────────────────────────

describe(unitTest('elapsedSeconds'), () => {
  test('returns seconds with 1 decimal by default', () => {
    const start = Date.now() - 2500;
    const result = elapsedSeconds(start);
    expect(result).toMatch(/^\d+\.\d$/);
    expect(parseFloat(result)).toBeGreaterThanOrEqual(2.0);
  });

  test('returns seconds with 2 decimals when specified', () => {
    const start = Date.now() - 1234;
    const result = elapsedSeconds(start, 2);
    expect(result).toMatch(/^\d+\.\d{2}$/);
  });
});

// ─── createMessagePair ───────────────────────────────────────────────────────

describe(unitTest('createMessagePair'), () => {
  test('creates user + assistant message pair', () => {
    const [user, assistant] = createMessagePair('What is this?');
    expect(user.role).toBe(LegendAIMessageRole.USER);
    expect(user.text).toBe('What is this?');
    expect(user.id).toBeDefined();
    expect(assistant.role).toBe(LegendAIMessageRole.ASSISTANT);
    expect(assistant.isProcessing).toBe(true);
    expect(assistant.sql).toBeNull();
    expect(assistant.textAnswer).toBeNull();
    expect(assistant.error).toBeNull();
    expect(assistant.errorType).toBeNull();
    expect(assistant.gridData).toBeNull();
    expect(assistant.thinkingSteps).toEqual([]);
    expect(assistant.suggestedQueries).toEqual([]);
    expect(assistant.isExecuting).toBe(false);
    expect(assistant.fallbackAction).toBeNull();
  });

  test('generates unique IDs', () => {
    const [u1] = createMessagePair('a');
    const [u2] = createMessagePair('b');
    expect(u1.id).not.toBe(u2.id);
  });
});

// ─── analyzeOrchestratorResults ──────────────────────────────────────────────

describe(unitTest('analyzeOrchestratorResults'), () => {
  test('sets textAnswer and suggestedQueries from analysis', async () => {
    const { setter, getMessages } = TEST__createMockSetter();
    TEST__seedAssistant(setter);
    const plugin = TEST__createMockLegendAIPlugin({
      analyzeQueryResults: createMock().mockResolvedValue({
        summary: 'Analysis summary',
        suggestedQueries: ['Follow up 1', 'Follow up 2'],
        keyMetrics: [],
        chartData: [],
      }),
    });

    await analyzeOrchestratorResults(
      'show trades',
      'SELECT * FROM trades',
      { columns: ['id'], rows: [{ id: 1 }] },
      TEST_DATA__legendAIMetadata,
      {
        config: TEST_DATA__legendAIConfig,
        plugin,
        history: [],
        setMessages: setter,
      },
      Date.now(),
    );

    const msg = TEST__getAssistantMessage(getMessages(), 1);
    expect(msg.textAnswer).toContain('Analysis summary');
    expect(msg.suggestedQueries).toEqual(['Follow up 1', 'Follow up 2']);
    expect(msg.isProcessing).toBe(false);
  });

  test('builds deterministic summary when analysis is unavailable', async () => {
    const { setter, getMessages } = TEST__createMockSetter();
    TEST__seedAssistant(setter);
    const plugin = TEST__createMockLegendAIPlugin({
      analyzeQueryResults: createMock().mockResolvedValue(undefined),
    });

    await analyzeOrchestratorResults(
      'Show me net sentiment by language',
      'SELECT "Net Sentiment Score", "Language Tag" FROM service(...)',
      {
        columns: ['Net Sentiment Score', 'Language Tag'],
        rows: [
          { 'Net Sentiment Score': 0.6, 'Language Tag': 'en' },
          { 'Net Sentiment Score': 0.4, 'Language Tag': 'fr' },
        ],
      },
      TEST_DATA__legendAIMetadata,
      {
        config: TEST_DATA__legendAIConfig,
        plugin,
        history: [],
        setMessages: setter,
      },
      Date.now(),
    );

    const msg = TEST__getAssistantMessage(getMessages(), 1);
    expect(msg.textAnswer).toContain('I retrieved 2 rows');
    expect(msg.textAnswer).toContain('Net Sentiment Score');
    expect(msg.suggestedQueries).toEqual([]);
    expect(msg.isProcessing).toBe(false);
  });

  test('caps rows passed to the analysis LLM at MAX_ANALYSIS_ROWS', async () => {
    const { setter } = TEST__createMockSetter();
    TEST__seedAssistant(setter);
    const analyzeSpy = createMock().mockResolvedValue({
      summary: 'ok',
      suggestedQueries: [],
      keyMetrics: [],
      chartData: [],
    });
    const plugin = TEST__createMockLegendAIPlugin({
      analyzeQueryResults: analyzeSpy,
    });
    const TOTAL_ROWS = 150; // exceeds MAX_ANALYSIS_ROWS (100)
    const rows = Array.from({ length: TOTAL_ROWS }, (_, i) => ({ id: i }));

    await analyzeOrchestratorResults(
      'show trades',
      'SELECT * FROM trades',
      { columns: ['id'], rows },
      TEST_DATA__legendAIMetadata,
      {
        config: TEST_DATA__legendAIConfig,
        plugin,
        history: [],
        setMessages: setter,
      },
      Date.now(),
    );
    const firstCall = analyzeSpy.mock.calls[0] ?? [];
    const passedRows = firstCall[3] as { id: number }[];
    expect(passedRows).toHaveLength(100);
    expect(passedRows[0]).toEqual({ id: 0 });
    expect(passedRows[99]).toEqual({ id: 99 });
  });
});

// ─── executeSqlAndReport — access point execution ────────────────────────────

describe(unitTest('executeSqlAndReport — access point execution'), () => {
  test('handles execution error gracefully', async () => {
    const { setter, getMessages } = TEST__createMockSetter();
    TEST__seedAssistant(setter);
    const plugin = TEST__createMockLegendAIPlugin({
      executeSql: createMock().mockRejectedValue(
        new Error('Column "foo" does not exist in table'),
      ),
    });

    const result = await executeSqlAndReport(
      'SELECT foo FROM t',
      TEST_DATA__legendAIServices,
      TEST_DATA__legendAIConfig,
      plugin,
      setter,
      Date.now(),
    );

    expect(result).toBeUndefined();
    const msg = TEST__getAssistantMessage(getMessages(), 1);
    expect(msg.error).toContain('Column');
    expect(msg.error).toContain('Available columns');
  });
});

// ─── processQuestion — error handling ────────────────────────────────────────

describe(unitTest('processQuestion — error handling'), () => {
  test('catches unexpected errors and finishes with thinking error', async () => {
    const { setter, getMessages } = TEST__createMockSetter();
    TEST__seedAssistant(setter);
    const plugin = TEST__createMockLegendAIPlugin({
      classifyQuestionIntent: () => {
        throw new Error('Unexpected classification error');
      },
    });

    await processQuestion(
      'some query',
      TEST_DATA__legendAIServices,
      'com.test:prod:1.0.0',
      TEST_DATA__legendAIMetadata,
      {
        config: TEST_DATA__legendAIConfig,
        plugin,
        history: [],
        setMessages: setter,
      },
    );

    const msg = TEST__getAssistantMessage(getMessages(), 1);
    expect(msg.error).toContain('Unexpected classification error');
    expect(msg.isProcessing).toBe(false);
  });

  test('always classifies via LLM and respects METADATA result', async () => {
    const { setter, getMessages } = TEST__createMockSetter();
    TEST__seedAssistant(setter);
    const classifyQuestionIntent = createMock().mockResolvedValue(
      LegendAIQuestionIntent.METADATA,
    );
    const plugin = TEST__createMockLegendAIPlugin({
      classifyQuestionIntent,
      callLLM: createMock().mockResolvedValue('Metadata answer from LLM'),
    });

    await processQuestion(
      'What data does Market News offer and how can I use it?',
      TEST_DATA__legendAIServices,
      'com.test:prod:1.0.0',
      TEST_DATA__legendAIMetadata,
      {
        config: TEST_DATA__legendAIConfig,
        plugin,
        history: [],
        setMessages: setter,
      },
    );

    const msg = TEST__getAssistantMessage(getMessages(), 1);
    expect(msg.textAnswer).toBe('Metadata answer from LLM');
    // LLM-first: classifyQuestionIntent is always called
    expect(classifyQuestionIntent).toHaveBeenCalled();
  });

  test('routes to SQL-only when LLM classifier returns DATA_QUERY for ambiguous intent', async () => {
    const { setter, getMessages } = TEST__createMockSetter();
    TEST__seedAssistant(setter);
    const classifyQuestionIntent = createMock().mockResolvedValue(
      LegendAIQuestionIntent.DATA_QUERY,
    );
    const callLLM = createMock().mockResolvedValue('SQL generation answer');
    const plugin = TEST__createMockLegendAIPlugin({
      classifyQuestionIntent,
      callLLM,
      executeSql: createMock().mockResolvedValue({
        columns: ['revenue'],
        rows: [{ revenue: 100 }],
      }),
      analyzeQueryResults: createMock().mockResolvedValue({
        summary: 'Query analysis summary',
        suggestedQueries: [],
        keyMetrics: [],
        chartData: [],
      }),
    });

    await processQuestion(
      'tell me about what can I do with revenue',
      TEST_DATA__legendAIServices,
      'com.test:prod:1.0.0',
      TEST_DATA__legendAIMetadata,
      {
        config: TEST_DATA__legendAIConfig,
        plugin,
        history: [],
        setMessages: setter,
      },
    );

    expect(classifyQuestionIntent).toHaveBeenCalled();
    const msg = TEST__getAssistantMessage(getMessages(), 1);
    // LLM returns DATA_QUERY → SQL only, no metadata context prepended
    expect(msg.textAnswer).toBe('Query analysis summary');
    expect(msg.textAnswer).not.toContain('### Metadata context');
    expect(msg.gridData).toBeDefined();
  });
});

// ─── processQuestionWithIntent ───────────────────────────────────────────────

describe(unitTest('processQuestionWithIntent — metadata intent'), () => {
  test('handles orchestrator intent with no services — metadata + fallback', async () => {
    const { setter, getMessages } = TEST__createMockSetter();
    TEST__seedAssistant(setter);
    const plugin = TEST__createMockLegendAIPlugin({
      callLLM: createMock().mockResolvedValue('Metadata answer here'),
    });

    await processQuestionWithIntent(
      'run complex query',
      LegendAIQuestionIntent.ORCHESTRATOR,
      [],
      'com.test:prod:1.0.0',
      TEST_DATA__legendAIMetadata,
      {
        config: {
          ...TEST_DATA__legendAIConfig,
          orchestratorUrl: 'http://localhost/orchestrator',
        },
        plugin,
        history: [],
        setMessages: setter,
      },
      {
        dataProductCoordinates: TEST_DATA__coordinates,
        pureExecutionContext: TEST_DATA__executionContext,
      },
    );

    const msg = TEST__getAssistantMessage(getMessages(), 1);
    expect(msg.textAnswer).toBeDefined();
    expect(msg.fallbackAction).toBeDefined();
    expect(msg.fallbackAction?.label).toBe('Try Legend AI Orchestrator');
  });
});

// ─── buildConversationHistory ────────────────────────────────────────────────

describe(unitTest('buildConversationHistory'), () => {
  test('keeps only the most recent turns so prompts stay bounded', () => {
    const messages: LegendAIMessage[] = Array.from(
      { length: 25 },
      (_, index) => index,
    ).flatMap((index) => [
      {
        id: `user-${index}`,
        role: LegendAIMessageRole.USER,
        text: `question ${index}`,
      },
      {
        ...createMessagePair('placeholder')[1],
        id: `assistant-${index}`,
        textAnswer: `answer ${index}`,
        isProcessing: false,
      },
    ]);

    const history = buildConversationHistory(messages);
    expect(history).toHaveLength(10);
    expect(history[0]?.question).toBe('question 15');
    expect(history[9]?.question).toBe('question 24');
  });
});
// ─── handleMetadataQuestion ──────────────────────────────────────────────────

describe(unitTest('handleMetadataQuestion'), () => {
  test('prompts with the access points relevant to the question, not the first few', async () => {
    const { setter } = TEST__createMockSetter();
    TEST__seedAssistant(setter);
    const services: TDSServiceSchema[] = Array.from(
      { length: 300 },
      (_, index) => ({
        title: index === 250 ? 'BOND_PRICING_SCORES' : `AP_${index}`,
        pattern: `/ap/${index}`,
        columns: [{ name: 'businessDate', type: 'Date' }],
        parameters: [],
        sourceType: TDSServiceSourceType.ACCESS_POINT,
      }),
    );
    const buildMetadataPrompt =
      createMock<
        LegendAI_LegendApplicationPlugin_Extension['buildMetadataPrompt']
      >().mockReturnValue('metadata prompt');
    const plugin = TEST__createMockLegendAIPlugin({
      buildMetadataPrompt,
      callLLM: createMock().mockResolvedValue('Answer'),
    });

    await handleMetadataQuestion(
      'what are the bond pricing scores?',
      TEST_DATA__legendAIMetadata,
      {
        config: TEST_DATA__legendAIConfig,
        plugin,
        history: [],
        setMessages: setter,
      },
      Date.now(),
      true,
      services,
    );

    const selected = buildMetadataPrompt.mock.calls[0]?.[3];
    expect(selected).toHaveLength(30);
    expect(selected?.map((service) => service.title)).toContain(
      'BOND_PRICING_SCORES',
    );
  });

  test('trims the prompt but still catalogs every access point in the answer', async () => {
    const { setter, getMessages } = TEST__createMockSetter();
    TEST__seedAssistant(setter);
    const services: TDSServiceSchema[] = Array.from(
      { length: 120 },
      (_, index) => ({
        title: `AP${String(index).padStart(3, '0')}`,
        pattern: `/ap/${index}`,
        columns: [{ name: 'businessDate', type: 'Date' }],
        parameters: [],
        sourceType: TDSServiceSourceType.ACCESS_POINT,
      }),
    );
    const buildMetadataPrompt =
      createMock<
        LegendAI_LegendApplicationPlugin_Extension['buildMetadataPrompt']
      >().mockReturnValue('metadata prompt');
    const plugin = TEST__createMockLegendAIPlugin({
      buildMetadataPrompt,
      callLLM: createMock().mockResolvedValue('Thematic overview.'),
    });

    await handleMetadataQuestion(
      'what does this product offer?',
      TEST_DATA__legendAIMetadata,
      {
        config: TEST_DATA__legendAIConfig,
        plugin,
        history: [],
        setMessages: setter,
      },
      Date.now(),
      true,
      services,
    );

    expect(buildMetadataPrompt.mock.calls[0]?.[3]).toHaveLength(30);
    const { textAnswer } = TEST__getAssistantMessage(getMessages(), 1);
    expect(textAnswer).toContain('## All 120 access points');
    expect(textAnswer).toContain('- AP000 (1 column)');
    expect(textAnswer).toContain('- AP119 (1 column)');
  });
});

// ─── generateAndJudgeSql ────────────────────────────────────────────────────

describe(unitTest('generateAndJudgeSql'), () => {
  test('returns SQL when judge passes on first attempt', async () => {
    const { setter } = TEST__createMockSetter();
    TEST__seedAssistant(setter);
    const plugin = TEST__createMockLegendAIPlugin({
      callLLM: createMock().mockResolvedValue('sql answer'),
    });

    const sql = await generateAndJudgeSql(
      'show trades',
      TEST_DATA__legendAIServices,
      'com.test:prod:1.0.0',
      {
        config: TEST_DATA__legendAIConfig,
        plugin,
        history: [],
        setMessages: setter,
      },
      Date.now(),
    );

    expect(sql).toBe('SELECT * FROM t');
  });
});

// ─── executeSqlAndReport — successful execution ──────────────────────────────

describe(unitTest('executeSqlAndReport — success'), () => {
  test('returns execution result with deduplicated columns', async () => {
    const { setter, getMessages } = TEST__createMockSetter();
    TEST__seedAssistant(setter);
    const plugin = TEST__createMockLegendAIPlugin({
      executeSql: createMock().mockResolvedValue({
        columns: ['id', 'name', 'id'],
        rows: [{ id: 1, name: 'A', id_2: 1 }],
      }),
    });

    const result = await executeSqlAndReport(
      'SELECT * FROM t',
      TEST_DATA__legendAIServices,
      TEST_DATA__legendAIConfig,
      plugin,
      setter,
      Date.now(),
    );

    expect(result).toBeDefined();
    expect(result?.columns).toEqual(['id', 'name', 'id_2']);
    const msg = TEST__getAssistantMessage(getMessages(), 1);
    expect(msg.gridData?.rowData).toHaveLength(1);
    expect(msg.isProcessing).toBe(false);
  });
});

describe(unitTest('isProductOverviewQuestion'), () => {
  test('true for overview / listing questions', () => {
    expect(isProductOverviewQuestion('what does this product offer?')).toBe(
      true,
    );
    expect(isProductOverviewQuestion('list the access points')).toBe(true);
    expect(isProductOverviewQuestion('list all access points')).toBe(true);
    expect(isProductOverviewQuestion('show me the available services')).toBe(
      true,
    );
    expect(isProductOverviewQuestion('give me an overview')).toBe(true);
    expect(isProductOverviewQuestion('what data is available?')).toBe(true);
  });

  test('false for targeted or data questions', () => {
    expect(isProductOverviewQuestion('get the top 10 orders')).toBe(false);
    expect(isProductOverviewQuestion('what columns does Address have')).toBe(
      false,
    );
    expect(
      isProductOverviewQuestion('show people in Building A on floor 2'),
    ).toBe(false);
  });
});

describe(unitTest('buildAccessPointCatalog'), () => {
  const accessPoints: TDSServiceSchema[] = [
    {
      title: 'Address',
      pattern: '/Address',
      columns: [{ name: 'a' }, { name: 'b' }],
      parameters: [],
      sourceType: TDSServiceSourceType.ACCESS_POINT,
      accessPointGroupTitle: 'Core',
    },
    {
      title: 'PHONE_NUMBER',
      pattern: '/PHONE_NUMBER',
      columns: [{ name: 'p' }],
      parameters: [],
      sourceType: TDSServiceSourceType.ACCESS_POINT,
      accessPointGroupTitle: 'Contact',
    },
  ];

  test('lists every access point grouped and sorted, with counts and the right noun', () => {
    expect(buildAccessPointCatalog(accessPoints)).toBe(
      [
        '## All 2 access points',
        '',
        '### Contact',
        '- PHONE_NUMBER (1 column)',
        '',
        '### Core',
        '- Address (2 columns)',
      ].join('\n'),
    );
  });

  test('caps the listing and reports how many were omitted', () => {
    const many: TDSServiceSchema[] = Array.from({ length: 205 }, (_, i) => ({
      title: `AP${String(i).padStart(3, '0')}`,
      pattern: `/AP${i}`,
      columns: [{ name: 'c' }],
      parameters: [],
      sourceType: TDSServiceSourceType.ACCESS_POINT,
    }));
    const catalog = buildAccessPointCatalog(many);
    expect(catalog).toContain('## 200 of 205 access points');
    expect(catalog).toContain(
      '- ...and 5 more (ask about a specific group to see them).',
    );
    expect(catalog).not.toContain('- AP200 (1 column)');
  });
});

describe(
  unitTest('handleMetadataQuestion — deterministic catalog append'),
  () => {
    const manyAccessPoints: TDSServiceSchema[] = Array.from(
      { length: 12 },
      (_, i) => ({
        title: `AP${String(i).padStart(2, '0')}`,
        pattern: `/AP${i}`,
        columns: [{ name: 'c' }],
        parameters: [],
        sourceType: TDSServiceSourceType.ACCESS_POINT,
      }),
    );

    test('appends the complete catalog for an overview question on a large product', async () => {
      const { setter, getMessages } = TEST__createMockSetter();
      TEST__seedAssistant(setter);
      const plugin = TEST__createMockLegendAIPlugin({
        callLLM: createMock().mockResolvedValue('Short thematic overview.'),
      });
      await handleMetadataQuestion(
        'what does this product offer?',
        TEST_DATA__legendAIMetadata,
        {
          config: TEST_DATA__legendAIConfig,
          plugin,
          history: [],
          setMessages: setter,
        },
        0,
        true,
        manyAccessPoints,
      );
      const msg = TEST__getAssistantMessage(getMessages(), 1);
      expect(msg.textAnswer).toContain('Short thematic overview.');
      expect(msg.textAnswer).toContain('## All 12 access points');
      expect(msg.textAnswer).toContain('- AP00 (1 column)');
      expect(msg.textAnswer).toContain('- AP11 (1 column)');
    });

    test('does not append the catalog for a targeted question', async () => {
      const { setter, getMessages } = TEST__createMockSetter();
      TEST__seedAssistant(setter);
      const plugin = TEST__createMockLegendAIPlugin({
        callLLM: createMock().mockResolvedValue('Address has columns a, b.'),
      });
      await handleMetadataQuestion(
        'what columns does Address have',
        TEST_DATA__legendAIMetadata,
        {
          config: TEST_DATA__legendAIConfig,
          plugin,
          history: [],
          setMessages: setter,
        },
        0,
        true,
        manyAccessPoints,
      );
      const msg = TEST__getAssistantMessage(getMessages(), 1);
      expect(msg.textAnswer).toBe('Address has columns a, b.');
    });
  },
);
