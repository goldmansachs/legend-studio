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

import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { flowResult } from 'mobx';
import { SparkleStarsIcon, RefreshIcon, TimesIcon } from '@finos/legend-art';
import { noop } from '@finos/legend-shared';
import {
  type LegendAIAssistantMessage,
  type LegendAIChatTelemetryEvent,
  LegendAIAssistantMessageView,
  LegendAIChatTelemetryEventType,
  LegendAIMessageRole,
  LegendAITelemetryArtifact,
  LAKEHOUSE_ENV_PROD,
  COVERAGE_NAME_PROD,
  COVERAGE_NAME_SANDBOX,
} from '@finos/legend-lego/legend-ai';
import { useAuth } from 'react-oidc-context';
import { useLegendMarketplaceAIChatStore } from '../../application/providers/LegendMarketplaceAIChatStoreProvider.js';
import { MarketplaceAIChatStage } from '../../stores/ai/LegendMarketplaceAIChatStore.js';
import { MarketplaceAIProductCards } from './MarketplaceAIProductCards.js';
import { MarketplaceAIProductAutosuggest } from './MarketplaceAIProductAutosuggest.js';
import { MarketplaceAIInputBar } from './MarketplaceAIInputBar.js';

const NETWORK_ERROR_NOTE =
  'Please check your network connection and try again.';

export const MarketplaceAIChatView = observer(
  (props: { initialQuery?: string }): React.ReactNode => {
    const { initialQuery } = props;
    const store = useLegendMarketplaceAIChatStore();
    const auth = useAuth();
    const tokenRef = useRef(auth.user?.access_token);
    tokenRef.current = auth.user?.access_token;
    const conversationRef = useRef<HTMLDivElement>(null);
    const hasMessages = store.messages.length > 0;
    const initialQuerySubmitted = useRef(false);
    const lastMessage = store.messages.at(-1);
    const lastMessageStepCount =
      lastMessage?.role === LegendAIMessageRole.ASSISTANT
        ? lastMessage.thinkingSteps.length
        : 0;
    const isLastMessageProcessing =
      lastMessage?.role === LegendAIMessageRole.ASSISTANT &&
      lastMessage.isProcessing;

    useEffect(() => {
      store.setTokenProvider(() => tokenRef.current);
      return (): void => store.setTokenProvider(() => undefined);
    }, [store]);

    useEffect(() => {
      const el = conversationRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, [store.messages.length, lastMessageStepCount, isLastMessageProcessing]);

    const dispatchQuery = useCallback(
      (text: string): void => {
        if (store.selectedProduct) {
          flowResult(store.askFollowUp(text)).catch(noop());
        } else {
          flowResult(store.submitQuery(text)).catch(noop());
        }
      },
      [store],
    );

    useEffect(() => {
      if (
        initialQuery &&
        initialQuery.trim().length > 0 &&
        !initialQuerySubmitted.current &&
        store.isEnabled
      ) {
        initialQuerySubmitted.current = true;
        store.setQuestionText(initialQuery);
        flowResult(store.submitQuery(initialQuery)).catch(noop());
      }
    }, [initialQuery, store, store.isEnabled]);

    const handleSubmit = useCallback((): void => {
      if (!store.questionText.trim() || store.isSending) {
        return;
      }
      dispatchQuery(store.questionText);
    }, [store, dispatchQuery]);

    const handleFallbackAction = useCallback(
      (messageId: string): void => {
        flowResult(store.runOrchestratorFallback(messageId)).catch(noop());
      },
      [store],
    );

    const handleSuggestedQueryClick = useCallback(
      (query: string): void => {
        store.logSuggestedQueryClicked();
        store.setQuestionText(query);
        dispatchQuery(query);
      },
      [store, dispatchQuery],
    );

    const [expandedThinking, setExpandedThinking] = useState<Set<number>>(
      new Set(),
    );
    const toggleThinking = useCallback((msgIndex: number): void => {
      setExpandedThinking((prev) => {
        const next = new Set(prev);
        if (next.has(msgIndex)) {
          next.delete(msgIndex);
        } else {
          next.add(msgIndex);
        }
        return next;
      });
    }, []);

    const copyText = useCallback(
      (text: string): Promise<void> =>
        store.baseStore.applicationStore.clipboardService.copyTextToClipboard(
          text,
        ),
      [store],
    );

    const handleRequestPython = useCallback(
      (msg: LegendAIAssistantMessage): void => {
        flowResult(store.generatePythonCode(msg.id)).catch(noop());
      },
      [store],
    );

    const [openingDataCubeMessageIds, setOpeningDataCubeMessageIds] = useState<
      Set<string>
    >(new Set());
    const handleOpenInDataCube = useCallback(
      (msg: LegendAIAssistantMessage): void => {
        setOpeningDataCubeMessageIds((prev) => new Set(prev).add(msg.id));
        flowResult(store.openInDataCube(msg.id))
          .catch(noop())
          .finally(() =>
            setOpeningDataCubeMessageIds((prev) => {
              const next = new Set(prev);
              next.delete(msg.id);
              return next;
            }),
          );
      },
      [store],
    );

    const permissionErrorNote = useMemo(
      () => (
        <>
          Select coverage:{' '}
          <strong>
            {store.config.lakehouseEnvironment === LAKEHOUSE_ENV_PROD
              ? COVERAGE_NAME_PROD
              : COVERAGE_NAME_SANDBOX}
          </strong>
        </>
      ),
      [store.config.lakehouseEnvironment],
    );

    const handleLogTelemetryEvent = useCallback(
      (event: LegendAIChatTelemetryEvent): void => {
        if (event.type === LegendAIChatTelemetryEventType.ARTIFACT_COPIED) {
          if (event.artifact === LegendAITelemetryArtifact.SQL) {
            store.logCopySql();
          } else {
            store.logCopyPython();
          }
        }
      },
      [store],
    );

    if (!store.isEnabled) {
      return (
        <div className="marketplace-ai-chat marketplace-ai-chat--disabled">
          <div className="marketplace-ai-chat__empty">
            <div className="marketplace-ai-chat__empty-text">
              Legend AI is not configured. Please contact your administrator.
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="marketplace-ai-chat">
        {hasMessages ? (
          <>
            <div className="marketplace-ai-chat__header">
              {store.selectedProduct && (
                <div className="marketplace-ai-chat__product-pill">
                  <SparkleStarsIcon />
                  <span className="marketplace-ai-chat__product-pill-text">
                    Scoped to:{' '}
                    <strong>
                      {store.selectedProduct.dataProductTitle ?? 'Data Product'}
                    </strong>
                  </span>
                  <button
                    type="button"
                    className="marketplace-ai-chat__product-pill-dismiss"
                    title="Remove product scope"
                    aria-label="Remove product scope"
                    onClick={(): void => {
                      store.deselectProduct();
                    }}
                  >
                    <TimesIcon />
                  </button>
                </div>
              )}
              <button
                type="button"
                className="marketplace-ai-chat__clear-btn"
                title="Clear chat"
                aria-label="Clear chat"
                onClick={(): void => {
                  store.clearChat();
                  setExpandedThinking(new Set());
                }}
              >
                <RefreshIcon />
                <span>Clear chat</span>
              </button>
            </div>
            <div
              className="marketplace-ai-chat__messages"
              ref={conversationRef}
            >
              {store.messages.map((msg, msgIndex) => {
                if (msg.role === LegendAIMessageRole.USER) {
                  return (
                    <div
                      key={msg.id}
                      className="marketplace-ai-chat__msg marketplace-ai-chat__msg--user"
                    >
                      <div className="marketplace-ai-chat__msg-bubble">
                        {msg.text}
                      </div>
                    </div>
                  );
                }

                const pythonEntry = store.pythonCodeByMessageId.get(msg.id);
                return (
                  <LegendAIAssistantMessageView
                    key={msg.id}
                    msg={msg}
                    msgIndex={msgIndex}
                    isThinkingVisible={
                      msg.isProcessing || expandedThinking.has(msgIndex)
                    }
                    onToggleThinking={toggleThinking}
                    onCopyText={copyText}
                    showDataContext={true}
                    permissionErrorNote={permissionErrorNote}
                    networkErrorNote={NETWORK_ERROR_NOTE}
                    onSuggestedQueryClick={handleSuggestedQueryClick}
                    onFallbackAction={handleFallbackAction}
                    {...(store.config.enghubDocUrl === undefined
                      ? {}
                      : { enghubDocUrl: store.config.enghubDocUrl })}
                    {...(store.config.enthubRequestAccessUrl === undefined
                      ? {}
                      : {
                          enthubRequestAccessUrl:
                            store.config.enthubRequestAccessUrl,
                        })}
                    {...(pythonEntry ? { pythonEntry } : {})}
                    {...(store.supportsPython
                      ? { onRequestPython: handleRequestPython }
                      : {})}
                    {...(store.supportsDataCube
                      ? {
                          onOpenInDataCube: handleOpenInDataCube,
                          isOpeningInDataCube: openingDataCubeMessageIds.has(
                            msg.id,
                          ),
                        }
                      : {})}
                    onLogTelemetryEvent={handleLogTelemetryEvent}
                  />
                );
              })}

              {store.stage === MarketplaceAIChatStage.PRODUCT_SELECTION &&
                store.suggestedProducts.length > 0 && (
                  <MarketplaceAIProductCards
                    products={store.suggestedProducts}
                    {...(store.scoredCandidates.length > 0
                      ? {
                          scoredCandidates: store.scoredCandidates,
                        }
                      : {})}
                    onSelect={(product): void => {
                      store.selectDataProduct(product);
                      dispatchQuery(store.lastUserMessageText);
                    }}
                  />
                )}

              {store.stage === MarketplaceAIChatStage.PRODUCT_SELECTION && (
                <div className="marketplace-ai-chat__product-search">
                  <div className="marketplace-ai-chat__product-search-label">
                    Don&apos;t see the right product? Search for it:
                  </div>
                  <MarketplaceAIProductAutosuggest
                    onSelect={(result): void => {
                      store.selectAutosuggestProduct(result);
                      dispatchQuery(store.lastUserMessageText);
                    }}
                    className="marketplace-ai-chat__product-search-autosuggest"
                  />
                </div>
              )}
            </div>

            <div className="marketplace-ai-chat__input-bar">
              <MarketplaceAIInputBar
                placeholder={
                  store.selectedProduct || store.scopeProducts.length > 0
                    ? `Ask about ${store.selectedProduct?.dataProductTitle ?? store.scopeProducts[0]?.name ?? 'this data product'}...`
                    : 'Ask a follow-up...'
                }
                onSubmit={handleSubmit}
              />
            </div>
          </>
        ) : (
          <div className="marketplace-ai-chat__welcome">
            <div className="marketplace-ai-chat__welcome-spacer" />
            <div className="marketplace-ai-chat__welcome-icon">
              <SparkleStarsIcon />
            </div>
            <h1 className="marketplace-ai-chat__welcome-title">
              Legend Marketplace AI
            </h1>
            <p className="marketplace-ai-chat__welcome-subtitle">
              Ask anything about your data. I&apos;ll find the right data
              product and query it for you.
            </p>
            <div className="marketplace-ai-chat__welcome-input">
              <MarketplaceAIInputBar
                placeholder="Ask anything about your data..."
                onSubmit={handleSubmit}
              />
            </div>
            {store.welcomeSuggestedQueries.length > 0 && (
              <div className="marketplace-ai-chat__suggestions">
                {store.welcomeSuggestedQueries.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="marketplace-ai-chat__suggestion"
                    onClick={(): void => {
                      store.setQuestionText(q);
                      dispatchQuery(q);
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div className="marketplace-ai-chat__welcome-spacer-bottom" />
          </div>
        )}
      </div>
    );
  },
);
