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

export * from './LegendAITypes.js';
export * from './LegendAI_LegendApplicationPlugin_Extension.js';
export {
  bridgeLegendAIServices,
  useLegendAIChatTelemetryLogger,
} from './LegendAIHostIntegration.js';
export { LegendAIChat } from './components/LegendAIChat.js';
export {
  type LegendAIPythonCodeEntry,
  LegendAIAssistantMessageView,
} from './components/LegendAIAssistantMessageView.js';
export { LegendAIChatToggle } from './components/LegendAIChatToggle.js';
export { LegendAIErrorBoundary } from './components/LegendAIErrorBoundary.js';
export {
  updateLastAssistant,
  addThinkingStep,
  completeThinkingSteps,
  finishWithThinkingError,
  classifyError,
  buildConversationHistory,
  generateAndJudgeSql,
  executeSqlAndReport,
  executeSqlForServices,
  processQuestionViaOrchestrator,
  processQuestion,
  handleMetadataQuestion,
  buildMetadataOverview,
  attachMetadataOverview,
  elapsedSeconds,
  createMessagePair,
  createAssistantMessage,
  buildOrchestratorFallbackAction,
  analyzeOrchestratorResults,
  cleanLlmSqlResponse,
  isValidSqlCorrection,
  type MessageSetter,
  type LegendAIOperationContext,
} from './stores/LegendAIChatProcessors.js';
export { parseSampleValueSet } from './stores/LegendAIJoinAnalysis.js';
export {
  accessPointName,
  sharedColumnNames,
} from './stores/LegendAISqlHelpers.js';
export {
  buildPropertyDocIndex,
  enrichColumnsFromElementDocs,
  inferServiceRelationshipsFromAssociations,
  extractServiceQuerySchema,
  extractModelContext,
  resolveEntitiesDeterministic,
} from './LegendAIDocEnrichment.js';
