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

import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import {
  SparkleStarsIcon,
  TimesIcon,
  MinusIcon,
  PlusIcon,
  InfoCircleIcon,
} from '@finos/legend-art';
import { assertErrorThrown, noop } from '@finos/legend-shared';
import type {
  LegendAIPythonCodegenRequest,
  LegendAIDataCubeQueryTranslationRequest,
} from '../LegendAI_LegendApplicationPlugin_Extension.js';
import {
  type LegendAIChatProps,
  type LegendAIAssistantMessage,
  type LegendAIMessageFeedback,
  type LegendAIScopeItem,
  type LegendAIQuestionIntent,
  type LegendAIMessageFeedbackRating,
  LegendAIMessageRole,
  LegendAIPythonCodeStatus,
  TDSServiceSourceType,
  classifyQuestionIntentFast,
  LegendAIChatTelemetryEventType,
  LegendAISuggestedQuerySource,
} from '../LegendAITypes.js';
import { useLegendAIChatState } from '../stores/LegendAIChatState.js';
import { accessPointName } from '../stores/LegendAISqlHelpers.js';
import {
  type LegendAIPythonCodeEntry,
  LegendAIAssistantMessageView,
  SuggestionButton,
} from './LegendAIAssistantMessageView.js';
import { LegendAIChatInput } from './LegendAIChatInput.js';
import { buildSuggestedQueries } from './LegendAIChatHelpers.js';

export const LEGEND_AI_ANCHOR_ID = 'legend-ai-anchor';

const CONTEXT_BANNER_AUTO_DISMISS_MS = 20000;

const copyTextToClipboard = (text: string): Promise<void> =>
  navigator.clipboard.writeText(text);

const LegendAIContextBanner = (props: {
  message: string;
  onDismiss: () => void;
}): React.ReactNode => {
  const { message, onDismiss } = props;

  useEffect(() => {
    const timer = setTimeout(onDismiss, CONTEXT_BANNER_AUTO_DISMISS_MS);
    return (): void => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="legend-ai__context-banner">
      <div className="legend-ai__context-banner-icon">
        <InfoCircleIcon />
      </div>
      <div className="legend-ai__context-banner-text">{message}</div>
      <button
        type="button"
        className="legend-ai__context-banner-close"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        <TimesIcon />
      </button>
    </div>
  );
};
const DEFAULT_SCOPES: LegendAIScopeItem[] = [
  {
    id: 'legend-ai-mcp',
    label: 'Legend AI MCP',
    description: 'Model Context Protocol via Marketplace /mcp proxy',
  },
];

export const LegendAIChat = (props: LegendAIChatProps): React.ReactNode => {
  const {
    services,
    coordinates,
    config,
    metadata,
    title,
    plugin,
    dataProductCoordinates,
    pureExecutionContext,
    modelContext,
    availableScopes,
    onMessageFeedback,
    onClose,
    onMinimize,
    onRequestAccess,
    onOpenInDataCube,
    contextBannerMessage,
    onLogTelemetryEvent,
  } = props;
  const state = useLegendAIChatState(
    services,
    coordinates,
    config,
    metadata,
    plugin,
    dataProductCoordinates,
    pureExecutionContext,
    modelContext,
    onLogTelemetryEvent,
  );
  const suggestedQueries = useMemo(
    () => buildSuggestedQueries(services, metadata),
    [services, metadata],
  );
  const overview = useMemo(() => {
    const raw =
      modelContext?.dataspaceDescription ?? metadata.description ?? '';
    const summary = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(
        (line) =>
          line.length > 0 && !line.startsWith('#') && !line.startsWith('|'),
      )
      .slice(0, 3)
      .join(' ')
      .slice(0, 300);
    const entityCount = modelContext?.entities.length ?? 0;
    const serviceCount =
      metadata.serviceSummaries.length > 0
        ? metadata.serviceSummaries.length
        : services.length;
    return { summary, entityCount, serviceCount };
  }, [modelContext, metadata, services]);
  const hasServices = services.length > 0;

  const inferSuggestedQueryIntent = useCallback(
    (query: string): LegendAIQuestionIntent =>
      classifyQuestionIntentFast(query, hasServices).intent,
    [hasServices],
  );
  const { isDataProduct, supportsPython, supportsDataCube } = useMemo(
    () => ({
      isDataProduct: services.some(
        (s) => s.sourceType === TDSServiceSourceType.ACCESS_POINT,
      ),
      supportsPython: services.some((s) => plugin.supportsPythonCodegen(s)),
      supportsDataCube: services.some((s) => plugin.supportsOpenInDataCube(s)),
    }),
    [services, plugin],
  );
  const [pythonCodeByMessageId, setPythonCodeByMessageId] = useState<
    Map<string, LegendAIPythonCodeEntry>
  >(new Map());
  const pythonCodeByMessageIdRef = useRef(pythonCodeByMessageId);
  pythonCodeByMessageIdRef.current = pythonCodeByMessageId;
  /**
   * Generates Python for the access point the answer actually queried. When the
   * message names one that is not loaded, no code is offered rather than a guess.
   */
  const requestPythonCode = useCallback(
    async (msg: LegendAIAssistantMessage): Promise<void> => {
      const existing = pythonCodeByMessageIdRef.current.get(msg.id);
      if (
        existing?.status === LegendAIPythonCodeStatus.LOADING ||
        existing?.status === LegendAIPythonCodeStatus.READY
      ) {
        return;
      }
      setPythonCodeByMessageId((prev) => {
        const next = new Map(prev);
        next.set(msg.id, { status: LegendAIPythonCodeStatus.LOADING });
        return next;
      });
      const resolvedSet = new Set(
        msg.queriedAccessPoints.map((name) => name.toLowerCase()),
      );
      const service =
        resolvedSet.size > 0
          ? services.find((s) =>
              resolvedSet.has(accessPointName(s).toLowerCase()),
            )
          : services[0];
      if (!service) {
        setPythonCodeByMessageId((prev) => {
          const next = new Map(prev);
          next.set(msg.id, {
            status: LegendAIPythonCodeStatus.READY,
            code: undefined,
          });
          return next;
        });
        return;
      }
      const msgIndex = state.messages.findIndex((m) => m.id === msg.id);
      const previousUser =
        msgIndex > 0 ? state.messages[msgIndex - 1] : undefined;
      const question =
        previousUser?.role === LegendAIMessageRole.USER
          ? previousUser.text
          : undefined;
      const request: LegendAIPythonCodegenRequest = {
        service,
        config,
        ...(dataProductCoordinates ? { dataProductCoordinates } : {}),
        ...(question === undefined ? {} : { question }),
        ...(msg.sql === null ? {} : { sql: msg.sql }),
      };
      try {
        const code = await plugin.generatePythonQueryCodeAsync(request);
        setPythonCodeByMessageId((prev) => {
          const next = new Map(prev);
          next.set(msg.id, { status: LegendAIPythonCodeStatus.READY, code });
          return next;
        });
      } catch (error) {
        assertErrorThrown(error);
        setPythonCodeByMessageId((prev) => {
          const next = new Map(prev);
          next.set(msg.id, {
            status: LegendAIPythonCodeStatus.ERROR,
          });
          return next;
        });
      }
    },
    [plugin, services, dataProductCoordinates, config, state.messages],
  );
  const [openingDataCubeMessageIds, setOpeningDataCubeMessageIds] = useState<
    Set<string>
  >(new Set());

  // Resolves the AP, best-effort translates its SQL to a DataCube Pure query, and
  // launches DataCube; on translation failure it opens on the bare access point.
  const handleOpenInDataCubeMsg = useCallback(
    async (msg: LegendAIAssistantMessage): Promise<void> => {
      if (!onOpenInDataCube || msg.sql === null) {
        return;
      }
      const apName = msg.queriedAccessPoints[0];
      if (apName === undefined) {
        return;
      }
      const service =
        services.find(
          (s) => accessPointName(s).toLowerCase() === apName.toLowerCase(),
        ) ?? services[0];
      if (!service) {
        return;
      }
      const dataProductPath = dataProductCoordinates?.data_product ?? '';
      setOpeningDataCubeMessageIds((prev) => {
        const next = new Set(prev);
        next.add(msg.id);
        return next;
      });
      const msgIndex = state.messages.findIndex((m) => m.id === msg.id);
      const previousUser =
        msgIndex > 0 ? state.messages[msgIndex - 1] : undefined;
      const question =
        previousUser?.role === LegendAIMessageRole.USER
          ? previousUser.text
          : undefined;
      const request: LegendAIDataCubeQueryTranslationRequest = {
        sql: msg.sql,
        service,
        dataProductPath,
        config,
        ...(question === undefined ? {} : { question }),
      };
      let pureQuery: string | undefined;
      try {
        pureQuery =
          await plugin.translateAccessPointSqlToDataCubeQuery(request);
      } catch (error) {
        assertErrorThrown(error);
      }
      try {
        onOpenInDataCube(apName, pureQuery);
      } finally {
        setOpeningDataCubeMessageIds((prev) => {
          if (!prev.has(msg.id)) {
            return prev;
          }
          const next = new Set(prev);
          next.delete(msg.id);
          return next;
        });
      }
    },
    [
      onOpenInDataCube,
      plugin,
      services,
      dataProductCoordinates,
      config,
      state.messages,
    ],
  );
  const [showContextBanner, setShowContextBanner] = useState(true);
  const dismissBanner = useCallback(() => setShowContextBanner(false), []);
  const hasMessages = state.messages.length > 0;
  const scopes = useMemo(
    () => (isDataProduct ? [] : (availableScopes ?? DEFAULT_SCOPES)),
    [isDataProduct, availableScopes],
  );
  const [feedbackByMessageId, setFeedbackByMessageId] = useState<
    Map<string, LegendAIMessageFeedbackRating>
  >(new Map());
  const [pendingFeedbackByMessageId, setPendingFeedbackByMessageId] = useState<
    Set<string>
  >(new Set());

  const handleMessageFeedback = useCallback(
    async (feedback: LegendAIMessageFeedback): Promise<void> => {
      setFeedbackByMessageId((prev) => {
        const next = new Map(prev);
        next.set(feedback.messageId, feedback.rating);
        return next;
      });

      if (!onMessageFeedback) {
        return;
      }

      setPendingFeedbackByMessageId((prev) => {
        const next = new Set(prev);
        next.add(feedback.messageId);
        return next;
      });

      try {
        await onMessageFeedback(feedback);
      } catch (error) {
        assertErrorThrown(error);
        setFeedbackByMessageId((prev) => {
          const next = new Map(prev);
          next.delete(feedback.messageId);
          return next;
        });
      } finally {
        setPendingFeedbackByMessageId((prev) => {
          const next = new Set(prev);
          next.delete(feedback.messageId);
          return next;
        });
      }
    },
    [onMessageFeedback],
  );

  const { toggleThinking, runFallbackAction, askQuestionWithIntent } = state;
  const handleSuggestedQueryClick = useCallback(
    (query: string): void =>
      askQuestionWithIntent(query, inferSuggestedQueryIntent(query)),
    [askQuestionWithIntent, inferSuggestedQueryIntent],
  );
  const handleRequestPython = useCallback(
    (message: LegendAIAssistantMessage): void => {
      requestPythonCode(message).catch(noop());
    },
    [requestPythonCode],
  );
  const handleOpenInDataCube = useCallback(
    (message: LegendAIAssistantMessage): void => {
      handleOpenInDataCubeMsg(message).catch(noop());
    },
    [handleOpenInDataCubeMsg],
  );

  return (
    <div className="legend-ai" id={LEGEND_AI_ANCHOR_ID}>
      <div className="legend-ai__header">
        <div className="legend-ai__header-icon">
          <SparkleStarsIcon />
        </div>
        <div className="legend-ai__title">{title ?? 'Legend AI'}</div>
        <div className="legend-ai__header-actions">
          <button
            type="button"
            className="legend-ai__header-action"
            title="New chat"
            aria-label="New chat"
            onClick={(): void => state.clearChat()}
          >
            <PlusIcon />
          </button>
          {onMinimize && (
            <button
              type="button"
              className="legend-ai__header-action"
              title="Minimize"
              aria-label="Minimize"
              onClick={onMinimize}
            >
              <MinusIcon />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className="legend-ai__header-action"
              title="Close"
              aria-label="Close"
              onClick={(): void => {
                onLogTelemetryEvent?.({
                  type: LegendAIChatTelemetryEventType.ASSISTANT_CLOSED,
                });
                onClose();
              }}
            >
              <TimesIcon />
            </button>
          )}
        </div>
      </div>

      {showContextBanner && contextBannerMessage && (
        <LegendAIContextBanner
          message={contextBannerMessage}
          onDismiss={dismissBanner}
        />
      )}

      <div className="legend-ai__conversation" ref={state.conversationRef}>
        {!hasMessages && (
          <div className="legend-ai__empty-state">
            <div className="legend-ai__empty-icon">
              <SparkleStarsIcon />
            </div>
            <div className="legend-ai__empty-text">
              Ask a question about your data
            </div>
            {overview.summary.length > 0 && (
              <div className="legend-ai__empty-overview">
                {overview.summary}
              </div>
            )}
            {(overview.entityCount > 0 || overview.serviceCount > 0) && (
              <div className="legend-ai__empty-meta">
                {overview.entityCount > 0 &&
                  `${overview.entityCount} entit${
                    overview.entityCount === 1 ? 'y' : 'ies'
                  }`}
                {overview.entityCount > 0 && overview.serviceCount > 0 && ' · '}
                {overview.serviceCount > 0 &&
                  `${overview.serviceCount} service${
                    overview.serviceCount === 1 ? '' : 's'
                  }`}
              </div>
            )}
            <div className="legend-ai__suggestions">
              {suggestedQueries.map((q, position) => (
                <SuggestionButton
                  key={q}
                  query={q}
                  position={position}
                  className="legend-ai__suggestion-chip"
                  source={LegendAISuggestedQuerySource.STARTER}
                  onSelect={(query): void =>
                    state.askQuestionWithIntent(
                      query,
                      inferSuggestedQueryIntent(query),
                    )
                  }
                  {...(onLogTelemetryEvent ? { onLogTelemetryEvent } : {})}
                />
              ))}
            </div>
          </div>
        )}

        {state.messages.map((msg, msgIndex) => {
          if (msg.role === LegendAIMessageRole.USER) {
            return (
              <div key={msg.id} className="legend-ai__msg legend-ai__msg--user">
                <div className="legend-ai__msg-bubble">{msg.text}</div>
              </div>
            );
          }

          const isThinkingVisible =
            msg.isProcessing || state.expandedThinking.has(msgIndex);
          const previousMessage =
            msgIndex > 0 ? state.messages[msgIndex - 1] : null;
          const questionText =
            previousMessage?.role === LegendAIMessageRole.USER
              ? previousMessage.text
              : '';
          const messagePython = pythonCodeByMessageId.get(msg.id);
          return (
            <LegendAIAssistantMessageView
              key={msg.id}
              msg={msg}
              msgIndex={msgIndex}
              questionText={questionText}
              isThinkingVisible={isThinkingVisible}
              onToggleThinking={toggleThinking}
              onCopyText={copyTextToClipboard}
              onMessageFeedback={handleMessageFeedback}
              selectedFeedbackRating={feedbackByMessageId.get(msg.id)}
              feedbackSubmitting={pendingFeedbackByMessageId.has(msg.id)}
              {...(config.enghubDocUrl === undefined
                ? {}
                : { enghubDocUrl: config.enghubDocUrl })}
              {...(config.enthubRequestAccessUrl === undefined
                ? {}
                : { enthubRequestAccessUrl: config.enthubRequestAccessUrl })}
              {...(onRequestAccess ? { onRequestAccess } : {})}
              {...(messagePython ? { pythonEntry: messagePython } : {})}
              {...(supportsPython
                ? { onRequestPython: handleRequestPython }
                : {})}
              {...(supportsDataCube && onOpenInDataCube
                ? {
                    onOpenInDataCube: handleOpenInDataCube,
                    isOpeningInDataCube: openingDataCubeMessageIds.has(msg.id),
                  }
                : {})}
              onFallbackAction={runFallbackAction}
              onSuggestedQueryClick={handleSuggestedQueryClick}
              {...(onLogTelemetryEvent ? { onLogTelemetryEvent } : {})}
            />
          );
        })}
      </div>

      <LegendAIChatInput state={state} scopes={scopes} />
    </div>
  );
};
