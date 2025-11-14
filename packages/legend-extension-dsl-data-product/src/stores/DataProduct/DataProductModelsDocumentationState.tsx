/**
 * Copyright (c) 2025-present, Goldman Sachs
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

import { action, computed, makeObservable, observable } from 'mobx';
import { type DataProductViewerState } from './DataProductViewerState.js';
import { type TreeData } from '@finos/legend-art';
import { filterByType, FuzzySearchEngine } from '@finos/legend-shared';
import type { CommandRegistrar } from '@finos/legend-application';
import {
  type ModelsDocumentationFilterTreeNodeData,
  type NormalizedDocumentationEntry,
  ModelDocumentationEntry,
  ModelsDocumentationFilterTreeNodeCheckType,
  ModelsDocumentationFilterTreeElementNodeData,
  trickleDownCheckNode,
  trickleUpCheckNode,
  uncheckAllFilterTree,
  buildPackageFilterTreeData,
  ViewerModelsDocumentationState,
} from '@finos/legend-lego/model-documentation';

export class DataProductViewerModelsDocumentationState
  extends ViewerModelsDocumentationState
  implements CommandRegistrar
{
  readonly dataProductViewerState: DataProductViewerState;
  packageFilterTreeData: TreeData<ModelsDocumentationFilterTreeNodeData>;
  private readonly searchEngine: FuzzySearchEngine<NormalizedDocumentationEntry>;

  constructor(dataProductViewerState: DataProductViewerState) {
    super();
    makeObservable(this, {
      packageFilterTreeData: observable.ref,
      isPackageFilterCustomized: computed,
      resetPackageFilterTreeData: action,
      updatePackageFilter: action,
      resetPackageFilter: action,
    });

    this.dataProductViewerState = dataProductViewerState;
    this.searchEngine = new FuzzySearchEngine(
      this.dataProductViewerState.elementDocs,
      {
        includeScore: true,
        // NOTE: we must not sort/change the order in the grid since
        // we want to ensure the element row is on top
        shouldSort: false,
        // Ignore location when computing the search score
        // See https://fusejs.io/concepts/scoring-theory.html
        ignoreLocation: true,
        // This specifies the point the search gives up
        // `0.0` means exact match where `1.0` would match anything
        // We set a relatively low threshold to filter out irrelevant results
        threshold: 0.2,
        keys: [
          {
            name: 'text',
            weight: 3,
          },
          {
            name: 'humanizedText',
            weight: 3,
          },
          {
            name: 'elementEntry.name',
            weight: 3,
          },
          {
            name: 'elementEntry.humanizedName',
            weight: 3,
          },
          {
            name: 'entry.name',
            weight: 2,
          },
          {
            name: 'entry.humanizedName',
            weight: 2,
          },
          {
            name: 'documentation',
            weight: 4,
          },
        ],
        // extended search allows for exact word match through single quote
        // See https://fusejs.io/examples.html#extended-search
        useExtendedSearch: true,
      },
    );

    this.packageFilterTreeData = buildPackageFilterTreeData(
      this.dataProductViewerState.elementDocs
        .map((entry) => entry.entry)
        .filter(filterByType(ModelDocumentationEntry)),
    );
    this.updatePackageFilter();

    this.searchResults = this.dataProductViewerState.elementDocs;
  }

  protected performSearch(searchText: string): NormalizedDocumentationEntry[] {
    return Array.from(this.searchEngine.search(searchText).values()).map(
      (result) => result.item,
    );
  }

  protected getElementDocs(): NormalizedDocumentationEntry[] {
    return this.dataProductViewerState.elementDocs;
  }

  get isPackageFilterCustomized(): boolean {
    return Array.from(this.packageFilterTreeData.nodes.values()).some(
      (node) =>
        node.checkType === ModelsDocumentationFilterTreeNodeCheckType.UNCHECKED,
    );
  }

  resetPackageFilter(): void {
    this.packageFilterTreeData.nodes.forEach((node) =>
      node.setCheckType(ModelsDocumentationFilterTreeNodeCheckType.CHECKED),
    );
    this.updatePackageFilter();
    this.resetPackageFilterTreeData();
  }

  updatePackageFilter(): void {
    const elementPaths: string[] = [];
    this.packageFilterTreeData.nodes.forEach((node) => {
      if (
        node instanceof ModelsDocumentationFilterTreeElementNodeData &&
        node.checkType === ModelsDocumentationFilterTreeNodeCheckType.CHECKED
      ) {
        elementPaths.push(node.elementPath);
      }
    });
    // NOTE: sort to avoid unnecessary re-computation of filtered search results
    this.filterPaths = elementPaths.toSorted((a, b) => a.localeCompare(b));
  }

  resetPackageFilterTreeData(): void {
    this.packageFilterTreeData = { ...this.packageFilterTreeData };
  }

  hasClassDocumentation(classPath: string): boolean {
    return this.dataProductViewerState.elementDocs.some(
      (entry) => entry.elementEntry.path === classPath,
    );
  }

  viewClassDocumentation(classPath: string): void {
    if (this.hasClassDocumentation(classPath)) {
      const classNode = this.packageFilterTreeData.nodes.get(classPath);
      if (classNode) {
        uncheckAllFilterTree(this.packageFilterTreeData);
        trickleDownCheckNode(classNode);
        trickleUpCheckNode(classNode);
        classNode.setCheckType(
          ModelsDocumentationFilterTreeNodeCheckType.CHECKED,
        );
        this.resetSearch();
        this.updatePackageFilter();
      }
    }
  }

  override registerCommands(): void {
    //To be implemented
  }

  override deregisterCommands(): void {
    //To be implemented
  }
}
