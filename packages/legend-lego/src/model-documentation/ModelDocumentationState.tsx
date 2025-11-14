// /**
//  * Copyright (c) 2025-present, Goldman Sachs
//  *
//  * Licensed under the Apache License, Version 2.0 (the "License");
//  * you may not use this file except in compliance with the License.
//  * You may obtain a copy of the License at
//  *
//  *     http://www.apache.org/licenses/LICENSE-2.0
//  *
//  * Unless required by applicable law or agreed to in writing, software
//  * distributed under the License is distributed on an "AS IS" BASIS,
//  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  * See the License for the specific language governing permissions and
//  * limitations under the License.
//  */

import { type TreeData, type TreeNodeData } from '@finos/legend-art';
import { CORE_PURE_PATH, ELEMENT_PATH_DELIMITER } from '@finos/legend-graph';
import {
  ActionState,
  FuzzySearchAdvancedConfigState,
  guaranteeNonNullable,
} from '@finos/legend-shared';
import { action, computed, makeObservable, observable } from 'mobx';
import {
  type ModelDocumentationEntry,
  type NormalizedDocumentationEntry,
  AssociationDocumentationEntry,
  ClassDocumentationEntry,
  EnumerationDocumentationEntry,
} from './ModelDocumentationAnalysis.js';
import type { CommandRegistrar } from '@finos/legend-application';

export enum ModelsDocumentationFilterTreeNodeCheckType {
  CHECKED,
  UNCHECKED,
  PARTIALLY_CHECKED,
}

export abstract class ModelsDocumentationFilterTreeNodeData
  implements TreeNodeData
{
  readonly id: string;
  readonly label: string;
  readonly parentNode: ModelsDocumentationFilterTreeNodeData | undefined;
  isOpen = false;
  childrenIds: string[] = [];
  childrenNodes: ModelsDocumentationFilterTreeNodeData[] = [];
  // By default all nodes are checked
  checkType = ModelsDocumentationFilterTreeNodeCheckType.CHECKED;

  constructor(
    id: string,
    label: string,
    parentNode: ModelsDocumentationFilterTreeNodeData | undefined,
  ) {
    makeObservable(this, {
      isOpen: observable,
      checkType: observable,
      setIsOpen: action,
      setCheckType: action,
    });

    this.id = id;
    this.label = label;
    this.parentNode = parentNode;
  }

  setIsOpen(val: boolean): void {
    this.isOpen = val;
  }

  setCheckType(val: ModelsDocumentationFilterTreeNodeCheckType): void {
    this.checkType = val;
  }
}

export class ModelsDocumentationFilterTreeRootNodeData extends ModelsDocumentationFilterTreeNodeData {}

export class ModelsDocumentationFilterTreePackageNodeData extends ModelsDocumentationFilterTreeNodeData {
  declare parentNode: ModelsDocumentationFilterTreeNodeData;
  packagePath: string;

  constructor(
    id: string,
    label: string,
    parentNode: ModelsDocumentationFilterTreeNodeData,
    packagePath: string,
  ) {
    super(id, label, parentNode);
    this.packagePath = packagePath;
  }
}

export class ModelsDocumentationFilterTreeElementNodeData extends ModelsDocumentationFilterTreeNodeData {
  declare parentNode: ModelsDocumentationFilterTreeNodeData;
  elementPath: string;
  typePath: CORE_PURE_PATH | undefined;

  constructor(
    id: string,
    label: string,
    parentNode: ModelsDocumentationFilterTreeNodeData,
    elementPath: string,
    typePath: CORE_PURE_PATH | undefined,
  ) {
    super(id, label, parentNode);
    this.elementPath = elementPath;
    this.typePath = typePath;
  }
}

export class ModelsDocumentationFilterTreeTypeNodeData extends ModelsDocumentationFilterTreeNodeData {
  declare parentNode: ModelsDocumentationFilterTreeNodeData;
  typePath: CORE_PURE_PATH;

  constructor(
    id: string,
    label: string,
    parentNode: ModelsDocumentationFilterTreeNodeData,
    typePath: CORE_PURE_PATH,
  ) {
    super(id, label, parentNode);
    this.typePath = typePath;
  }
}

export const trickleDownUncheckNodeChildren = (
  node: ModelsDocumentationFilterTreeNodeData,
): void => {
  node.setCheckType(ModelsDocumentationFilterTreeNodeCheckType.UNCHECKED);
  node.childrenNodes.forEach((childNode) =>
    trickleDownUncheckNodeChildren(childNode),
  );
};

export const trickleUpUncheckNode = (
  node: ModelsDocumentationFilterTreeNodeData,
): void => {
  const parentNode = node.parentNode;
  if (!parentNode) {
    return;
  }
  if (
    parentNode.childrenNodes.some(
      (childNode) =>
        childNode.checkType ===
        ModelsDocumentationFilterTreeNodeCheckType.CHECKED,
    )
  ) {
    parentNode.setCheckType(
      ModelsDocumentationFilterTreeNodeCheckType.PARTIALLY_CHECKED,
    );
  } else {
    parentNode.setCheckType(
      ModelsDocumentationFilterTreeNodeCheckType.UNCHECKED,
    );
  }

  trickleUpUncheckNode(parentNode);
};

export const uncheckFilterTreeNode = (
  node: ModelsDocumentationFilterTreeNodeData,
): void => {
  trickleDownUncheckNodeChildren(node);
  trickleUpUncheckNode(node);
};

export const trickleDownCheckNode = (
  node: ModelsDocumentationFilterTreeNodeData,
): void => {
  node.setCheckType(ModelsDocumentationFilterTreeNodeCheckType.CHECKED);
  node.childrenNodes.forEach((childNode) => trickleDownCheckNode(childNode));
};

export const trickleUpCheckNode = (
  node: ModelsDocumentationFilterTreeNodeData,
): void => {
  const parentNode = node.parentNode;
  if (!parentNode) {
    return;
  }
  if (
    parentNode.childrenNodes.every(
      (childNode) =>
        childNode.checkType ===
        ModelsDocumentationFilterTreeNodeCheckType.CHECKED,
    )
  ) {
    parentNode.setCheckType(ModelsDocumentationFilterTreeNodeCheckType.CHECKED);
  } else {
    parentNode.setCheckType(
      ModelsDocumentationFilterTreeNodeCheckType.PARTIALLY_CHECKED,
    );
  }

  trickleUpCheckNode(parentNode);
};

export const checkFilterTreeNode = (
  node: ModelsDocumentationFilterTreeNodeData,
): void => {
  trickleDownCheckNode(node);
  trickleUpCheckNode(node);
};

export const uncheckAllFilterTree = (
  treeData: TreeData<ModelsDocumentationFilterTreeNodeData>,
): void => {
  treeData.nodes.forEach((node) =>
    node.setCheckType(ModelsDocumentationFilterTreeNodeCheckType.UNCHECKED),
  );
};

export const buildTypeFilterTreeData =
  (): TreeData<ModelsDocumentationFilterTreeNodeData> => {
    const rootIds: string[] = [];
    const nodes = new Map<string, ModelsDocumentationFilterTreeNodeData>();

    // all node
    const allNode = new ModelsDocumentationFilterTreeRootNodeData(
      'all',
      'All Types',
      undefined,
    );
    rootIds.push(allNode.id);
    allNode.setIsOpen(true); // open the root node by default
    nodes.set(allNode.id, allNode);

    // type nodes
    const classNode = new ModelsDocumentationFilterTreeTypeNodeData(
      'class',
      'Class',
      allNode,
      CORE_PURE_PATH.CLASS,
    );
    allNode.childrenIds.push(classNode.id);
    nodes.set(classNode.id, classNode);

    const enumerationNode = new ModelsDocumentationFilterTreeTypeNodeData(
      'enumeration',
      'Enumeration',
      allNode,
      CORE_PURE_PATH.ENUMERATION,
    );
    allNode.childrenIds.push(enumerationNode.id);
    nodes.set(enumerationNode.id, enumerationNode);

    const associationNode = new ModelsDocumentationFilterTreeTypeNodeData(
      'association',
      'Association',
      allNode,
      CORE_PURE_PATH.ASSOCIATION,
    );
    allNode.childrenIds.push(associationNode.id);
    nodes.set(associationNode.id, associationNode);
    allNode.childrenNodes = [classNode, enumerationNode, associationNode];

    return {
      rootIds,
      nodes,
    };
  };

export const buildPackageFilterTreeData = (
  modelDocEntries: ModelDocumentationEntry[],
): TreeData<ModelsDocumentationFilterTreeNodeData> => {
  const rootIds: string[] = [];
  const nodes = new Map<string, ModelsDocumentationFilterTreeNodeData>();

  // all node
  const allNode = new ModelsDocumentationFilterTreeRootNodeData(
    'all',
    'All Packages',
    undefined,
  );
  rootIds.push(allNode.id);
  allNode.setIsOpen(true); // open the root node by default
  nodes.set(allNode.id, allNode);

  modelDocEntries.forEach((entry) => {
    const path = entry.path;
    const chunks = path.split(ELEMENT_PATH_DELIMITER);
    let currentParentNode = allNode;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = guaranteeNonNullable(chunks[i]);
      const elementPath = `${
        currentParentNode === allNode
          ? ''
          : `${currentParentNode.id}${ELEMENT_PATH_DELIMITER}`
      }${chunk}`;
      const nodeId = elementPath;
      let node = nodes.get(nodeId);
      if (!node) {
        if (i === chunks.length - 1) {
          node = new ModelsDocumentationFilterTreeElementNodeData(
            nodeId,
            chunk,
            currentParentNode,
            elementPath,
            entry instanceof ClassDocumentationEntry
              ? CORE_PURE_PATH.CLASS
              : entry instanceof EnumerationDocumentationEntry
                ? CORE_PURE_PATH.ENUMERATION
                : entry instanceof AssociationDocumentationEntry
                  ? CORE_PURE_PATH.ASSOCIATION
                  : undefined,
          );
        } else {
          node = new ModelsDocumentationFilterTreePackageNodeData(
            nodeId,
            chunk,
            currentParentNode,
            elementPath,
          );
        }
        nodes.set(nodeId, node);
        currentParentNode.childrenIds.push(nodeId);
        currentParentNode.childrenNodes.push(node);
      }
      currentParentNode = node;
    }
  });

  return {
    rootIds,
    nodes,
  };
};

export abstract class ViewerModelsDocumentationState
  implements CommandRegistrar
{
  showHumanizedForm = true;

  private searchInput?: HTMLInputElement | undefined;
  readonly searchConfigurationState: FuzzySearchAdvancedConfigState;
  readonly searchState = ActionState.create();
  searchText: string;
  searchResults: NormalizedDocumentationEntry[] = [];
  showSearchConfigurationMenu = false;

  abstract packageFilterTreeData: TreeData<ModelsDocumentationFilterTreeNodeData>;
  abstract resetPackageFilterTreeData(): void;
  abstract updatePackageFilter(): void;
  abstract resetPackageFilter(): void;
  abstract get isPackageFilterCustomized(): boolean;
  abstract registerCommands(): void;
  abstract deregisterCommands(): void;

  protected abstract getElementDocs(): NormalizedDocumentationEntry[];
  protected abstract performSearch(
    searchText: string,
  ): NormalizedDocumentationEntry[];

  resetAllFilters(): void {
    this.resetTypeFilter();
    this.resetPackageFilter();
  }

  get isFilterCustomized(): boolean {
    return this.isTypeFilterCustomized || this.isPackageFilterCustomized;
  }

  resetSearch(): void {
    this.searchText = '';
    this.searchResults = this.getElementDocs();
    this.searchState.complete();
  }

  search(): void {
    if (!this.searchText) {
      this.searchResults = this.getElementDocs();
      return;
    }
    this.searchState.inProgress();
    this.searchResults = this.performSearch(
      this.searchConfigurationState.generateSearchText(this.searchText),
    );
    this.searchState.complete();
  }

  showFilterPanel = true;
  typeFilterTreeData: TreeData<ModelsDocumentationFilterTreeNodeData>;
  filterTypes: string[] = [];
  filterPaths: string[] = [];

  constructor() {
    makeObservable(this, {
      showHumanizedForm: observable,
      searchText: observable,
      // NOTE: we use `observable.struct` for these to avoid unnecessary re-rendering of the grid
      searchResults: observable.struct,
      filterTypes: observable.struct,
      filterPaths: observable.struct,
      showSearchConfigurationMenu: observable,
      showFilterPanel: observable,
      typeFilterTreeData: observable.ref,
      filteredSearchResults: computed,
      isTypeFilterCustomized: computed,
      isFilterCustomized: computed,
      setShowHumanizedForm: action,
      setSearchText: action,
      resetSearch: action,
      search: action,
      setShowSearchConfigurationMenu: action,
      setShowFilterPanel: action,
      resetTypeFilterTreeData: action,
      updateTypeFilter: action,
      resetTypeFilter: action,
    });
    this.searchConfigurationState = new FuzzySearchAdvancedConfigState(
      (): void => this.search(),
    );
    this.searchText = '';
    this.typeFilterTreeData = buildTypeFilterTreeData();
    this.updateTypeFilter();
  }

  get filteredSearchResults(): NormalizedDocumentationEntry[] {
    return this.searchResults
      .filter(
        (result) =>
          (this.filterTypes.includes(CORE_PURE_PATH.CLASS) &&
            result.elementEntry instanceof ClassDocumentationEntry) ||
          (this.filterTypes.includes(CORE_PURE_PATH.ENUMERATION) &&
            result.elementEntry instanceof EnumerationDocumentationEntry) ||
          (this.filterTypes.includes(CORE_PURE_PATH.ASSOCIATION) &&
            result.elementEntry instanceof AssociationDocumentationEntry),
      )
      .filter((result) => this.filterPaths.includes(result.elementEntry.path));
  }

  get isTypeFilterCustomized(): boolean {
    return Array.from(this.typeFilterTreeData.nodes.values()).some(
      (node) =>
        node.checkType === ModelsDocumentationFilterTreeNodeCheckType.UNCHECKED,
    );
  }

  setShowHumanizedForm(val: boolean): void {
    this.showHumanizedForm = val;
  }

  setSearchText(val: string): void {
    this.searchText = val;
  }

  setShowSearchConfigurationMenu(val: boolean): void {
    this.showSearchConfigurationMenu = val;
  }

  setShowFilterPanel(val: boolean): void {
    this.showFilterPanel = val;
  }

  resetTypeFilterTreeData(): void {
    this.typeFilterTreeData = { ...this.typeFilterTreeData };
  }

  updateTypeFilter(): void {
    const types: string[] = [];
    this.typeFilterTreeData.nodes.forEach((node) => {
      if (
        node instanceof ModelsDocumentationFilterTreeTypeNodeData &&
        node.checkType === ModelsDocumentationFilterTreeNodeCheckType.CHECKED
      ) {
        types.push(node.typePath);
      }
    });
    // NOTE: sort to avoid unnecessary re-computation of filtered search results
    this.filterTypes = types.toSorted((a, b) => a.localeCompare(b));
  }

  resetTypeFilter(): void {
    this.typeFilterTreeData.nodes.forEach((node) =>
      node.setCheckType(ModelsDocumentationFilterTreeNodeCheckType.CHECKED),
    );
    this.updateTypeFilter();
    this.resetTypeFilterTreeData();
  }

  setSearchInput(el: HTMLInputElement | undefined): void {
    this.searchInput = el;
  }

  focusSearchInput(): void {
    this.searchInput?.focus();
  }

  selectSearchInput(): void {
    this.searchInput?.select();
  }
}
