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

import { observer } from 'mobx-react-lite';
import {
  PanelList,
  PanelListItem,
  clsx,
  Panel,
  ErrorIcon,
  WarningIcon,
  InfoCircleIcon,
} from '@finos/legend-art';
import { useEditorStore } from '../EditorStoreProvider.js';
import type { Problem } from '../../../stores/editor/EditorGraphState.js';
import {
  CompilationWarning,
  DEFECT_SEVERITY_LEVEL,
  EngineError,
} from '@finos/legend-graph';
import { GRAPH_EDITOR_MODE } from '../../../stores/editor/EditorConfig.js';

const ProblemItem = observer((props: { problem: Problem }) => {
  const { problem } = props;
  const editorStore = useEditorStore();
  const isStale = editorStore.graphState.areProblemsStale;
  const goToSource = (): void =>
    editorStore.graphEditorMode.goToProblem(problem);

  const renderIcon = () => {
    if (problem instanceof EngineError) {
      return (
        <ErrorIcon className="panel-group__problem__icon panel-group__problem__icon--error" />
      );
    }
    if (problem instanceof CompilationWarning) {
      const severityLevel = problem.defectSeverityLevel
        ? problem.defectSeverityLevel.toUpperCase()
        : undefined;
      if (severityLevel === DEFECT_SEVERITY_LEVEL.ERROR) {
        return (
          <ErrorIcon className="panel-group__problem__icon panel-group__problem__icon--error" />
        );
      } else if (severityLevel === DEFECT_SEVERITY_LEVEL.INFO) {
        return (
          <InfoCircleIcon className="panel-group__problem__icon panel-group__problem__icon--info" />
        );
      } else {
        // WARN or default
        return (
          <WarningIcon className="panel-group__problem__icon panel-group__problem__icon--warning" />
        );
      }
    }
    return null;
  };

  return (
    <PanelListItem>
      <button
        className={clsx([
          'panel-group__problem',
          {
            'panel-group__problem--stale': isStale,
          },
        ])}
        title={problem.message}
        onClick={goToSource}
      >
        {renderIcon()}
        <div className="panel-group__problem__content">
          <div className="panel-group__problem__message">{problem.message}</div>
          {problem.sourceInformation && (
            <div className="panel-group__problem__source">
              {editorStore.graphEditorMode.mode ===
                GRAPH_EDITOR_MODE.GRAMMAR_TEXT &&
                `[Ln ${problem.sourceInformation.startLine}, Col ${problem.sourceInformation.startColumn}]`}
            </div>
          )}
        </div>
      </button>
    </PanelListItem>
  );
});

export const ProblemsPanel = observer(() => {
  const editorStore = useEditorStore();
  const problems = editorStore.graphState.problems;
  const isStale = editorStore.graphState.areProblemsStale;

  return (
    <Panel>
      {isStale && (
        <div className="panel-group__problems__stale-warning">
          The following result might be stale - please run compilation (F9) to
          check for the latest problems
        </div>
      )}
      {problems.length === 0 && (
        <div className="panel-group__problems__placeholder">
          No problems have been detected in the workspace.
        </div>
      )}
      {problems.length !== 0 && (
        <PanelList>
          {problems.map((problem) => (
            <ProblemItem key={problem.uuid} problem={problem} />
          ))}
        </PanelList>
      )}
    </Panel>
  );
});
