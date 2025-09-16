/*

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

import { makeObservable, observable, override } from 'mobx';
import {
  ExtractDefinition,
  type Owner,
  type Source,
  type Schedule,
  type Ingest,
  type AccessPoint,
} from '../../../graph/metamodel/pure/extract/Extract.js';
import {
  observe_Abstract_PackageableElement,
  skipObserved,
} from './CoreObserverHelper.js';

// Observe AccessPoint (extend as needed for subclasses)
export const observe_ExtractAccessPoint = skipObserved(
  (metamodel: AccessPoint): AccessPoint => {
    makeObservable(metamodel, {
      //TODO
      // Add observable properties for AccessPoint and its subclasses
      // Example:
      // id: observable,
      // func: observable.ref,
    });
    return metamodel;
  },
);

// Observe Ingest
export const observe_Ingest = skipObserved((metamodel: Ingest): Ingest => {
  makeObservable(metamodel, {
    ingestPoint: observable,
    //TODO
    // Add other observable properties for Ingest subclasses
  });
  observe_ExtractAccessPoint(metamodel.ingestPoint);
  return metamodel;
});

// Observe Owner (extend as needed for subclasses)
export const observe_Owner = skipObserved((metamodel: Owner): Owner => {
  makeObservable(metamodel, {
    //TODO
    // Add observable properties for Owner and its subclasses
  });
  return metamodel;
});

// Observe Source (extend as needed for subclasses)
export const observe_Source = skipObserved((metamodel: Source): Source => {
  makeObservable(metamodel, {
    //TODO
    // Add observable properties for Source and its subclasses
  });
  return metamodel;
});

// Observe Schedule (extend as needed for subclasses)
export const observe_Schedule = skipObserved(
  (metamodel: Schedule): Schedule => {
    makeObservable(metamodel, {
      //TODO
      // Add observable properties for Schedule and its subclasses
    });
    return metamodel;
  },
);

// Main observer for ExtractDefinition
export const observe_ExtractDefinition = skipObserved(
  (metamodel: ExtractDefinition): ExtractDefinition => {
    observe_Abstract_PackageableElement(metamodel);

    makeObservable<ExtractDefinition, '_elementHashCode'>(metamodel, {
      sourceType: observable,
      datasetGroup: observable,
      owner: observable,
      source: observable,
      schedule: observable,
      ingest: observable,
      _elementHashCode: override,
    });

    observe_Owner(metamodel.owner);
    observe_Source(metamodel.source);
    observe_Schedule(metamodel.schedule);
    metamodel.ingest.forEach(observe_Ingest);

    return metamodel;
  },
);

*/
