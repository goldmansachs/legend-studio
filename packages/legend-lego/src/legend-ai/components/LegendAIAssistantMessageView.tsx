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

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SparkleStarsIcon,
  CodeIcon,
  TableIcon,
  CopyIcon,
  CheckIcon,
  TimesIcon,
  CaretDownIcon,
  CaretRightIcon,
  DotIcon,
  LoadingIcon,
  LikeIcon,
  DislikeIcon,
  ExternalLinkIcon,
  PythonIcon,
  JupyterIcon,
  CubeIcon,
  MarkdownTextViewer,
  clsx,
} from '@finos/legend-art';
import { noop } from '@finos/legend-shared';
import type { LegendAIPythonQueryCode } from '../LegendAI_LegendApplicationPlugin_Extension.js';
import {
  type LegendAIAssistantMessage,
  type LegendAIChatTelemetryEvent,
  type LegendAIMessageFeedback,
  type LegendAIThinkingStep,
  LegendAIChatTelemetryEventType,
  LegendAIErrorType,
  LegendAIMessageFeedbackRating,
  LegendAIPythonCodeStatus,
  LegendAISuggestedQuerySource,
  LegendAITelemetryArtifact,
  LegendAIThinkingStepStatus,
  LEGEND_AI_FEEDBACK_PROMPT,
} from '../LegendAITypes.js';
import { looksLikeAccessError } from '../stores/LegendAIChatProcessors.js';
import { LegendAIResultGrid } from './LegendAIResultGrid.js';
import { LegendAIAnalysisPanel } from './LegendAIAnalysisPanel.js';

const COPY_FEEDBACK_DURATION_MS = 2000;
const METADATA_CONTEXT_HEADING = '### Metadata context';
const QUERY_ANALYSIS_HEADING = '### Query analysis';

export type LegendAIPythonCodeEntry =
  | { status: LegendAIPythonCodeStatus.LOADING }
  | {
      status: LegendAIPythonCodeStatus.READY;
      code: LegendAIPythonQueryCode | undefined;
    }
  | { status: LegendAIPythonCodeStatus.ERROR; errorMessage: string };

function toUserFacingThinkingLabel(label: string): string {
  const normalized = label.toLowerCase();
  if (
    normalized.includes('analyzing your question') ||
    normalized.includes('intent is ambiguous')
  ) {
    return 'Understanding your request';
  }
  if (
    normalized.includes('building metadata context') ||
    normalized.includes('answering from product metadata')
  ) {
    return 'Checking product capabilities and services';
  }
  if (
    normalized.includes('found relevant services') ||
    normalized.includes('selecting best service') ||
    normalized.includes('building context from service schemas') ||
    normalized.includes('preparing data query') ||
    normalized.includes('generating sql query') ||
    normalized.includes('verifying query correctness') ||
    normalized.includes('query corrected') ||
    normalized.includes('max verification attempts reached') ||
    normalized.includes('judge approved a non-sql draft')
  ) {
    return 'Trying a data query when helpful';
  }
  if (
    normalized.includes('retrieved ') ||
    normalized.includes('executing') ||
    normalized.includes('analyzing results') ||
    normalized.includes('verifying answer coverage')
  ) {
    return 'Summarizing what matters for your question';
  }
  if (normalized.includes('error')) {
    return 'Hit an issue while preparing the answer';
  }
  return label;
}

function formatThinkingSteps(
  thinkingSteps: LegendAIThinkingStep[],
): LegendAIThinkingStep[] {
  const formatted: LegendAIThinkingStep[] = [];
  for (const step of thinkingSteps) {
    const userLabel = toUserFacingThinkingLabel(step.label);
    const last = formatted[formatted.length - 1];
    if (last?.label === userLabel) {
      formatted[formatted.length - 1] = {
        ...last,
        status: step.status,
      };
    } else {
      formatted.push({
        ...step,
        label: userLabel,
      });
    }
  }
  return formatted;
}

function splitCombinedAnswer(textAnswer: string | null): {
  metadataContext: string | null;
  queryAnalysis: string | null;
} {
  if (!textAnswer) {
    return { metadataContext: null, queryAnalysis: null };
  }
  const metadataIndex = textAnswer.indexOf(METADATA_CONTEXT_HEADING);
  if (metadataIndex < 0) {
    return { metadataContext: null, queryAnalysis: textAnswer };
  }

  const metadataStart = metadataIndex + METADATA_CONTEXT_HEADING.length;
  const queryIndex = textAnswer.indexOf(QUERY_ANALYSIS_HEADING, metadataStart);

  const metadataContext =
    queryIndex >= 0
      ? textAnswer.slice(metadataStart, queryIndex).trim()
      : textAnswer.slice(metadataStart).trim();
  const queryAnalysis =
    queryIndex >= 0
      ? textAnswer.slice(queryIndex + QUERY_ANALYSIS_HEADING.length).trim() ||
        null
      : null;

  return {
    metadataContext: metadataContext.length > 0 ? metadataContext : null,
    queryAnalysis,
  };
}

const AISummaryRenderer = ({ value }: { value: string }): React.ReactNode => (
  <MarkdownTextViewer value={{ value }} className="legend-ai__text-answer-md" />
);

function renderStepStatusIcon(
  status: LegendAIThinkingStepStatus,
): React.ReactNode {
  if (status === LegendAIThinkingStepStatus.ACTIVE) {
    return <LoadingIcon isLoading={true} />;
  }
  return status === LegendAIThinkingStepStatus.DONE ? (
    <CheckIcon />
  ) : (
    <TimesIcon />
  );
}

/**
 * Delegates the clipboard write to the host and flags the button as copied
 * for a moment once the write settles.
 */
function useCopyFeedback(
  onCopyText: (text: string) => Promise<void>,
): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const copy = useCallback(
    (text: string): void => {
      onCopyText(text)
        .then(() => {
          setCopied(true);
          if (timerRef.current !== undefined) {
            clearTimeout(timerRef.current);
          }
          timerRef.current = setTimeout(() => {
            setCopied(false);
            timerRef.current = undefined;
          }, COPY_FEEDBACK_DURATION_MS);
        })
        .catch(noop());
    },
    [onCopyText],
  );

  return [copied, copy];
}

export const SuggestionButton = (props: {
  query: string;
  position: number;
  className: string;
  source: LegendAISuggestedQuerySource;
  onSelect: (query: string) => void;
  onLogTelemetryEvent?: (event: LegendAIChatTelemetryEvent) => void;
}): React.ReactNode => {
  const { query, position, className, source, onSelect, onLogTelemetryEvent } =
    props;
  return (
    <button
      type="button"
      className={className}
      onClick={(): void => {
        onLogTelemetryEvent?.({
          type: LegendAIChatTelemetryEventType.SUGGESTED_QUERY_CLICKED,
          position,
          source,
        });
        onSelect(query);
      }}
    >
      {query}
    </button>
  );
};

export const LegendAIAssistantMessageView = memo(
  function LegendAIAssistantMessageView(props: {
    msg: LegendAIAssistantMessage;
    msgIndex: number;
    isThinkingVisible: boolean;
    onToggleThinking: (msgIndex: number) => void;
    onCopyText: (text: string) => Promise<void>;
    splitAnswerSections?: boolean;
    permissionErrorNote?: React.ReactNode;
    networkErrorNote?: React.ReactNode;
    questionText?: string;
    onMessageFeedback?: (
      feedback: LegendAIMessageFeedback,
    ) => Promise<void> | void;
    selectedFeedbackRating?: LegendAIMessageFeedbackRating | undefined;
    feedbackSubmitting?: boolean;
    onSuggestedQueryClick?: (query: string) => void;
    onFallbackAction?: (messageId: string) => void;
    enghubDocUrl?: string;
    enthubRequestAccessUrl?: string;
    onRequestAccess?: (accessPointGroupTitle: string) => void;
    pythonEntry?: LegendAIPythonCodeEntry;
    onRequestPython?: (msg: LegendAIAssistantMessage) => void;
    onOpenInDataCube?: (msg: LegendAIAssistantMessage) => void;
    isOpeningInDataCube?: boolean;
    onLogTelemetryEvent?: (event: LegendAIChatTelemetryEvent) => void;
  }): React.ReactNode {
    const {
      msg,
      msgIndex,
      isThinkingVisible,
      onToggleThinking,
      onCopyText,
      splitAnswerSections,
      permissionErrorNote,
      networkErrorNote,
      questionText,
      onMessageFeedback,
      selectedFeedbackRating,
      feedbackSubmitting,
      onSuggestedQueryClick,
      onFallbackAction,
      enghubDocUrl,
      enthubRequestAccessUrl,
      onRequestAccess,
      pythonEntry,
      onRequestPython,
      onOpenInDataCube,
      isOpeningInDataCube,
      onLogTelemetryEvent,
    } = props;

    const hasPermissionAccessLinks =
      enghubDocUrl !== undefined || enthubRequestAccessUrl !== undefined;

    const [sqlCopied, copySql] = useCopyFeedback(onCopyText);
    const [pythonCopied, copyPython] = useCopyFeedback(onCopyText);
    const [showPython, setShowPython] = useState(false);

    const handleCopySql = useCallback(() => {
      if (msg.sql) {
        copySql(msg.sql);
        onLogTelemetryEvent?.({
          type: LegendAIChatTelemetryEventType.ARTIFACT_COPIED,
          artifact: LegendAITelemetryArtifact.SQL,
        });
      }
    }, [msg.sql, copySql, onLogTelemetryEvent]);

    const handleCopyPython = useCallback(() => {
      if (
        pythonEntry?.status === LegendAIPythonCodeStatus.READY &&
        pythonEntry.code
      ) {
        copyPython(pythonEntry.code.code);
        onLogTelemetryEvent?.({
          type: LegendAIChatTelemetryEventType.ARTIFACT_COPIED,
          artifact: LegendAITelemetryArtifact.PYTHON,
        });
      }
    }, [pythonEntry, copyPython, onLogTelemetryEvent]);

    const handleTogglePython = useCallback((): void => {
      const opening = !showPython;
      setShowPython(opening);
      onLogTelemetryEvent?.({
        type: LegendAIChatTelemetryEventType.PYTHON_CODE_TOGGLED,
        shown: opening,
      });
      if (opening && !pythonEntry && onRequestPython) {
        onLogTelemetryEvent?.({
          type: LegendAIChatTelemetryEventType.PYTHON_CODE_REQUESTED,
        });
        onRequestPython(msg);
      }
    }, [showPython, pythonEntry, onRequestPython, msg, onLogTelemetryEvent]);

    const canShowFeedback =
      onMessageFeedback !== undefined &&
      !msg.isProcessing &&
      (msg.textAnswer !== null || msg.gridData !== null || msg.error !== null);
    const visibleThinkingSteps = useMemo(
      () => formatThinkingSteps(msg.thinkingSteps),
      [msg.thinkingSteps],
    );
    const { metadataContext, analysisSummary, plainAnswer } = useMemo(() => {
      const split = splitAnswerSections
        ? splitCombinedAnswer(msg.textAnswer)
        : { metadataContext: null, queryAnalysis: msg.textAnswer };
      const gridAnalysisFallback =
        split.metadataContext === null ? msg.textAnswer : null;
      return {
        metadataContext: split.metadataContext,
        analysisSummary:
          msg.gridData === null
            ? null
            : (split.queryAnalysis ?? gridAnalysisFallback),
        plainAnswer:
          msg.gridData === null
            ? (split.metadataContext ?? msg.textAnswer)
            : null,
      };
    }, [msg.textAnswer, msg.gridData, splitAnswerSections]);

    const submitFeedback = useCallback(
      (rating: LegendAIMessageFeedbackRating): void => {
        const result = onMessageFeedback?.({
          messageId: msg.id,
          rating,
          question: questionText ?? '',
          ...(msg.textAnswer === null ? {} : { answer: msg.textAnswer }),
          ...(msg.sql === null ? {} : { sql: msg.sql }),
          ...(msg.gridData === null
            ? {}
            : { rowCount: msg.gridData.rowData.length }),
        });
        if (result instanceof Promise) {
          result.catch(noop());
        }
      },
      [msg, onMessageFeedback, questionText],
    );

    return (
      <div className="legend-ai__msg legend-ai__msg--assistant">
        <div className="legend-ai__msg-avatar">
          <SparkleStarsIcon />
        </div>
        <div className="legend-ai__msg-content">
          {visibleThinkingSteps.length > 0 && (
            <div className="legend-ai__thinking">
              {!msg.isProcessing && (
                <button
                  type="button"
                  className="legend-ai__thinking-toggle"
                  onClick={(): void => onToggleThinking(msgIndex)}
                >
                  <span className="legend-ai__thinking-toggle-icon">
                    {isThinkingVisible ? <CaretDownIcon /> : <CaretRightIcon />}
                  </span>
                  Thought for {msg.thinkingDuration ?? '...'}s
                </button>
              )}
              {isThinkingVisible && (
                <div className="legend-ai__thinking-steps">
                  {visibleThinkingSteps.map((step) => (
                    <div
                      key={step.id}
                      className={clsx(
                        'legend-ai__thinking-step',
                        `legend-ai__thinking-step--${step.status}`,
                      )}
                    >
                      <span className="legend-ai__thinking-step-icon">
                        {renderStepStatusIcon(step.status)}
                      </span>
                      <span>{step.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {msg.dataContext && (
            <div className="legend-ai__data-context">
              <MarkdownTextViewer
                value={{ value: msg.dataContext }}
                className="legend-ai__text-answer-md"
              />
            </div>
          )}

          {metadataContext && msg.gridData && (
            <div className="legend-ai__inline-answer">
              <MarkdownTextViewer
                value={{ value: metadataContext }}
                className="legend-ai__text-answer-md"
              />
            </div>
          )}

          {msg.sql && (
            <details
              className="legend-ai__sql-details"
              open={msg.gridData !== null}
              onToggle={(event): void =>
                onLogTelemetryEvent?.({
                  type: LegendAIChatTelemetryEventType.SQL_DETAILS_TOGGLED,
                  shown: event.currentTarget.open,
                })
              }
            >
              <summary className="legend-ai__sql-details-summary">
                {msg.gridData === null ? 'Show the query I tried' : 'Query'}
              </summary>
              <div className="legend-ai__sql-block">
                <div className="legend-ai__sql-block-header">
                  <span className="legend-ai__sql-block-header-icon">
                    <CodeIcon />
                  </span>
                  <span>Generated SQL</span>
                  {msg.sqlGenTime && (
                    <span className="legend-ai__sql-block-time">
                      {msg.sqlGenTime}s
                    </span>
                  )}
                  <button
                    type="button"
                    className="legend-ai__sql-copy-btn"
                    title="Copy SQL"
                    aria-label="Copy SQL"
                    onClick={handleCopySql}
                  >
                    {sqlCopied ? (
                      <span className="legend-ai__sql-copy-btn--copied">
                        <CheckIcon />
                      </span>
                    ) : (
                      <CopyIcon />
                    )}
                  </button>
                </div>
                <div className="legend-ai__sql-scroll">
                  <pre className="legend-ai__sql-display">{msg.sql}</pre>
                </div>
              </div>
            </details>
          )}

          {msg.isExecuting && (
            <div className="legend-ai__executing">
              <LoadingIcon isLoading={true} />
              <span>Executing query...</span>
            </div>
          )}

          {msg.error && (
            <div className="legend-ai__exec-error">
              {msg.error}
              {msg.errorType === LegendAIErrorType.PERMISSION &&
                hasPermissionAccessLinks && (
                  <div className="legend-ai__permission-error-action">
                    <span className="legend-ai__permission-error-note">
                      {permissionErrorNote ?? 'Need access?'}
                    </span>
                    <div className="legend-ai__permission-error-btns">
                      {enghubDocUrl && (
                        <a
                          className="legend-ai__permission-error-btn"
                          href={enghubDocUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLinkIcon />
                          <span>View Documentation</span>
                        </a>
                      )}
                      {enthubRequestAccessUrl && (
                        <a
                          className="legend-ai__permission-error-btn legend-ai__permission-error-btn--primary"
                          href={enthubRequestAccessUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLinkIcon />
                          <span>Request Access</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              {msg.errorType === LegendAIErrorType.NETWORK &&
                networkErrorNote && (
                  <div className="legend-ai__permission-error-action">
                    <span className="legend-ai__permission-error-note">
                      {networkErrorNote}
                    </span>
                  </div>
                )}
              {msg.errorType === LegendAIErrorType.EXECUTION &&
                onRequestAccess &&
                msg.queriedAccessPointGroups.length > 0 &&
                looksLikeAccessError(msg.error) && (
                  <div className="legend-ai__permission-error-action">
                    <span className="legend-ai__permission-error-note">
                      {msg.queriedAccessPointGroups.length === 1
                        ? 'You may not have access to this data. You can request access below.'
                        : `This query uses ${msg.queriedAccessPointGroups.length} access point groups. You can request access to each one below.`}
                    </span>
                    <div className="legend-ai__permission-error-btns">
                      {msg.queriedAccessPointGroups.map((apgTitle) => (
                        <button
                          key={apgTitle}
                          type="button"
                          className="legend-ai__permission-error-btn legend-ai__permission-error-btn--primary"
                          onClick={(): void => onRequestAccess(apgTitle)}
                        >
                          <ExternalLinkIcon />
                          <span>Request Access — {apgTitle}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {msg.gridData && (
            <div className="legend-ai__results-block">
              <div className="legend-ai__results-header">
                <span className="legend-ai__results-header-icon">
                  <TableIcon />
                </span>
                <span>Results</span>
                <span className="legend-ai__results-meta">
                  {msg.gridData.rowData.length} row
                  {msg.gridData.rowData.length === 1 ? '' : 's'}
                  {msg.execTime ? (
                    <>
                      {' '}
                      <DotIcon className="legend-ai__results-meta-dot" />{' '}
                      {msg.execTime}s
                    </>
                  ) : (
                    ''
                  )}
                </span>
              </div>
              <LegendAIResultGrid data={msg.gridData} />
            </div>
          )}

          {plainAnswer && (
            <div className="legend-ai__inline-answer">
              <MarkdownTextViewer
                value={{ value: plainAnswer }}
                className="legend-ai__text-answer-md"
              />
            </div>
          )}

          {analysisSummary && msg.gridData && (
            <LegendAIAnalysisPanel
              gridData={msg.gridData}
              summary={analysisSummary}
              SummaryRenderer={AISummaryRenderer}
            />
          )}

          {msg.isProcessing && !msg.isExecuting && msg.gridData && (
            <div className="legend-ai__analyzing">
              <LoadingIcon isLoading={true} />
              <span>Analyzing results...</span>
            </div>
          )}

          {!msg.isProcessing &&
            msg.suggestedQueries.length > 0 &&
            onSuggestedQueryClick && (
              <div className="legend-ai__follow-up-suggestions">
                <span className="legend-ai__follow-up-label">
                  Try a data query:
                </span>
                {msg.suggestedQueries.map((q, position) => (
                  <SuggestionButton
                    key={q}
                    query={q}
                    position={position}
                    className="legend-ai__follow-up-btn"
                    source={LegendAISuggestedQuerySource.FOLLOW_UP}
                    onSelect={onSuggestedQueryClick}
                    {...(onLogTelemetryEvent ? { onLogTelemetryEvent } : {})}
                  />
                ))}
              </div>
            )}

          {msg.fallbackAction && !msg.isProcessing && onFallbackAction && (
            <button
              type="button"
              className="legend-ai__fallback-action-btn"
              onClick={(): void => {
                if (msg.fallbackAction?.actionId) {
                  onFallbackAction(msg.id);
                }
              }}
            >
              <SparkleStarsIcon />
              <span>{msg.fallbackAction.label}</span>
            </button>
          )}

          {(onRequestPython || onOpenInDataCube) &&
            !msg.isProcessing &&
            (msg.sql !== null || msg.gridData !== null) && (
              <div className="legend-ai__python-block">
                <div className="legend-ai__cta-row">
                  {onRequestPython && (
                    <button
                      type="button"
                      className="legend-ai__python-cta"
                      onClick={handleTogglePython}
                    >
                      <PythonIcon />
                      <span>
                        {showPython
                          ? 'Hide Python code'
                          : 'Want the Python code for this query?'}
                      </span>
                      <span className="legend-ai__python-cta-caret">
                        {showPython ? <CaretDownIcon /> : <CaretRightIcon />}
                      </span>
                    </button>
                  )}
                  {onOpenInDataCube && msg.sql !== null && (
                    <button
                      type="button"
                      className="legend-ai__datacube-cta"
                      onClick={(): void => {
                        onLogTelemetryEvent?.({
                          type: LegendAIChatTelemetryEventType.OPEN_IN_DATACUBE_CLICKED,
                        });
                        onOpenInDataCube(msg);
                      }}
                      disabled={isOpeningInDataCube}
                      title="Open this query in DataCube"
                      aria-label="Open this query in DataCube"
                    >
                      {isOpeningInDataCube ? (
                        <LoadingIcon isLoading={true} />
                      ) : (
                        <CubeIcon />
                      )}
                      <span>
                        {isOpeningInDataCube
                          ? 'Opening in DataCube...'
                          : 'Open in DataCube'}
                      </span>
                      <span className="legend-ai__datacube-cta-launch">
                        <ExternalLinkIcon />
                      </span>
                    </button>
                  )}
                </div>
                {showPython && onRequestPython && (
                  <div className="legend-ai__python-panel">
                    <div className="legend-ai__python-panel-header">
                      <span className="legend-ai__python-panel-header-icon">
                        <CodeIcon />
                      </span>
                      <span>Python</span>
                      {pythonEntry?.status === LegendAIPythonCodeStatus.READY &&
                        pythonEntry.code && (
                          <button
                            type="button"
                            className="legend-ai__sql-copy-btn"
                            title="Copy Python code"
                            aria-label="Copy Python code"
                            onClick={handleCopyPython}
                          >
                            {pythonCopied ? (
                              <span className="legend-ai__sql-copy-btn--copied">
                                <CheckIcon />
                              </span>
                            ) : (
                              <CopyIcon />
                            )}
                          </button>
                        )}
                    </div>
                    {pythonEntry?.status ===
                      LegendAIPythonCodeStatus.LOADING && (
                      <div className="legend-ai__python-panel-loading">
                        <LoadingIcon isLoading={true} />
                        <span>Generating Python…</span>
                      </div>
                    )}
                    {pythonEntry?.status === LegendAIPythonCodeStatus.ERROR && (
                      <div className="legend-ai__python-panel-error">
                        <span>
                          Could not generate Python code. Try again in a moment.
                        </span>
                        <button
                          type="button"
                          className="legend-ai__permission-error-btn"
                          onClick={(): void => {
                            onLogTelemetryEvent?.({
                              type: LegendAIChatTelemetryEventType.PYTHON_CODE_REQUESTED,
                            });
                            onRequestPython(msg);
                          }}
                        >
                          Retry
                        </button>
                      </div>
                    )}
                    {pythonEntry?.status === LegendAIPythonCodeStatus.READY &&
                      pythonEntry.code === undefined && (
                        <div className="legend-ai__python-panel-loading">
                          <span>
                            Python code is not available for this data source.
                          </span>
                        </div>
                      )}
                    {pythonEntry?.status === LegendAIPythonCodeStatus.READY &&
                      pythonEntry.code && (
                        <>
                          <div className="legend-ai__sql-scroll">
                            <pre className="legend-ai__sql-display">
                              {pythonEntry.code.code}
                            </pre>
                          </div>
                          {pythonEntry.code.notebookUrl && (
                            <div className="legend-ai__python-panel-actions">
                              <a
                                className="legend-ai__permission-error-btn"
                                href={pythonEntry.code.notebookUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <JupyterIcon />
                                <span>Launch Notebook</span>
                              </a>
                            </div>
                          )}
                        </>
                      )}
                  </div>
                )}
              </div>
            )}

          {canShowFeedback && (
            <div className="legend-ai__message-feedback">
              <span className="legend-ai__message-feedback-label">
                {LEGEND_AI_FEEDBACK_PROMPT}
              </span>
              <div className="legend-ai__message-feedback-actions">
                <button
                  type="button"
                  className={clsx('legend-ai__message-feedback-btn', {
                    'legend-ai__message-feedback-btn--selected':
                      selectedFeedbackRating ===
                      LegendAIMessageFeedbackRating.THUMBS_UP,
                  })}
                  title="Thumbs up"
                  aria-label="Thumbs up"
                  onClick={(): void =>
                    submitFeedback(LegendAIMessageFeedbackRating.THUMBS_UP)
                  }
                  disabled={feedbackSubmitting}
                >
                  <LikeIcon />
                </button>
                <button
                  type="button"
                  className={clsx('legend-ai__message-feedback-btn', {
                    'legend-ai__message-feedback-btn--selected':
                      selectedFeedbackRating ===
                      LegendAIMessageFeedbackRating.THUMBS_DOWN,
                  })}
                  title="Thumbs down"
                  aria-label="Thumbs down"
                  onClick={(): void =>
                    submitFeedback(LegendAIMessageFeedbackRating.THUMBS_DOWN)
                  }
                  disabled={feedbackSubmitting}
                >
                  <DislikeIcon />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);
