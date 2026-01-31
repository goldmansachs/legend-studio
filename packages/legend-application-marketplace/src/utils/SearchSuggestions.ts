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

import type { AutosuggestResult } from '@finos/legend-server-marketplace';

export interface SearchSuggestion {
  type: 'default' | 'autosuggest';
  query: string;
  autosuggestResult?: AutosuggestResult | undefined;
}

export function createDefaultSuggestions(
  configSuggestions: string[] | undefined,
): SearchSuggestion[] {
  if (!configSuggestions || configSuggestions.length === 0) {
    return [];
  }
  return configSuggestions.map((query) => ({
    type: 'default',
    query,
  }));
}

export function createAutosuggestSuggestions(
  results: AutosuggestResult[],
): SearchSuggestion[] {
  return results.map((result) => ({
    type: 'autosuggest',
    query: result.dataProductName,
    autosuggestResult: result,
  }));
}
