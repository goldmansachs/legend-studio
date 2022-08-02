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

import { AsteriskIcon } from '@finos/legend-art';
import { MULTIPLICITY_INFINITE, type Multiplicity } from '@finos/legend-graph';

export const MultiplicityBadge: React.FC<{
  multiplicity: Multiplicity;
}> = (props) => {
  const { multiplicity } = props;
  const isRequired = multiplicity.lowerBound && multiplicity.lowerBound > 0;
  const tooltipText = `${isRequired ? '[required]' : '[optional]'}${
    isRequired ? ` minimum: ${multiplicity.lowerBound}` : ''
  } maximum: ${multiplicity.upperBound ?? MULTIPLICITY_INFINITE}`;

  return (
    <div
      className={`multiplicity-badge ${
        isRequired ? 'multiplicity-badge--required' : ''
      }`}
      title={tooltipText}
    >
      {multiplicity.upperBound ? null : <AsteriskIcon />}
    </div>
  );
};