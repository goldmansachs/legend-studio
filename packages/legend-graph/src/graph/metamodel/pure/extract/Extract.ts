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

import {
  hashArray,
  type Hashable,
  type PlainObject,
} from '@finos/legend-shared';
import {
  PackageableElement,
  type PackageableElementVisitor,
} from '../packageableElements/PackageableElement.js';
import type { RawLambda } from '../rawValueSpecification/RawLambda.js';
import {
  CORE_HASH_STRUCTURE,
  hashObjectWithoutSourceInformation,
} from '../../../Core_HashUtils.js';

// --- Enums ---

export enum SourceType {
  KAFKA = 'KAFKA',
  RELATIONAL = 'RELATIONAL',
}

export enum KafkaDataFormat {
  AVRO = 'AVRO',
  JSON = 'JSON',
}

export enum KafkaMessageEncoding {
  BINARY = 'BINARY',
  JSON = 'JSON',
}

export enum AppDirLevel {
  BUSINESS_UNIT = 'BUSINESS_UNIT',
  SUB_BUSINESS_UNIT = 'SUB_BUSINESS_UNIT',
  FAMILY = 'FAMILY',
  APPLICATION = 'APPLICATION',
  DEPLOYMENT = 'DEPLOYMENT',
}

export enum AuthType {
  CREDENTIAL = 'CREDENTIAL',
}

// --- Source ---

export abstract class Source implements Hashable {
  abstract get hashCode(): string;
}

export class KafkaMessageFormat implements Hashable {
  format!: KafkaDataFormat;
  encoding?: KafkaMessageEncoding;

  get hashCode(): string {
    return hashArray([
      'KAFKA_MESSAGE_FORMAT',
      this.format,
      this.encoding ?? '',
    ]);
  }
}

export class KafkaSource extends Source implements Hashable {
  servers: string[] = [];
  topic!: string;
  partitions: number[] = [];
  messageFormat!: KafkaMessageFormat;
  schemaRegistryUrl?: string;
  keyDeserializer?: string;
  valueDeserializer?: string;

  override get hashCode(): string {
    return hashArray([
      'KAFKA_SOURCE',
      hashArray(this.servers),
      this.topic,
      hashArray(this.partitions.map(String)),
      this.messageFormat.hashCode,
      this.schemaRegistryUrl ?? '',
      this.keyDeserializer ?? '',
      this.valueDeserializer ?? '',
    ]);
  }
}

export class RelationalSource extends Source implements Hashable {
  url!: string;
  driver!: string;
  auth!: Auth;
  override get hashCode(): string {
    return hashArray([
      'RELATIONAL_SOURCE',
      this.url,
      this.driver,
      this.auth.hashCode,
    ]);
  }
}

// --- Auth ---

export abstract class Auth implements Hashable {
  abstract get hashCode(): string;
}

export class CredentialAuth extends Auth implements Hashable {
  credRef!: string;

  constructor(credRef: string) {
    super();
    this.credRef = credRef;
  }

  override get hashCode(): string {
    return hashArray(['CREDENTIAL_AUTH', this.credRef]);
  }
}

// --- Scheduler ---

export abstract class Schedule implements Hashable {
  abstract get hashCode(): string;
}

export class CronSchedule extends Schedule implements Hashable {
  expr: string;

  constructor(expr: string) {
    super();
    this.expr = expr;
  }

  override get hashCode(): string {
    return hashArray(['CRON_SCHEDULE', this.expr]);
  }
}

// --- Organization ---

export class AppDirNode implements Hashable {
  appDirId!: number;
  level!: AppDirLevel;

  constructor(appDirId: number, level: AppDirLevel) {
    this.appDirId = appDirId;
    this.level = level;
  }

  get hashCode(): string {
    return hashArray(['APP_DIR_NODE', this.appDirId.toString(), this.level]);
  }
}

export abstract class Owner implements Hashable {
  abstract get hashCode(): string;
}

export class AppDir extends Owner implements Hashable {
  prodParallel?: AppDirNode;
  production?: AppDirNode;
  override get hashCode(): string {
    return hashArray([
      'APP_DIR',
      this.prodParallel?.hashCode ?? '',
      this.production?.hashCode ?? '',
    ]);
  }
}

// --- Ingest ---

export abstract class Ingest implements Hashable {
  ingestPoint: AccessPoint;

  constructor(ingestPoint: AccessPoint) {
    this.ingestPoint = ingestPoint;
  }

  abstract get hashCode(): string;
}

export class IngestRelationalDataset extends Ingest {
  query: string;

  constructor(ingestPoint: AccessPoint, query: string) {
    super(ingestPoint);
    this.query = query;
  }

  get hashCode(): string {
    return hashArray([
      'INGEST_RELATIONAL_DATASET',
      this.ingestPoint.hashCode,
      this.query,
    ]);
  }
}

export class IngestKafkaDataset extends Ingest implements Hashable {
  partitions: number[] = [];

  constructor(ingestPoint: AccessPoint, partitions: number[]) {
    super(ingestPoint);
    this.partitions = partitions;
  }

  override get hashCode(): string {
    return hashArray([
      'INGEST_KAFKA_DATASET',
      this.ingestPoint.hashCode,
      hashArray(this.partitions.map(String)),
    ]);
  }
}

export class GenericIngest extends Ingest implements Hashable {
  override get hashCode(): string {
    return hashArray(['GENERIC_INGEST', this.ingestPoint.hashCode]);
  }
}

// --- Access Point ---

export abstract class AccessPoint implements Hashable {
  sourceInformation?: PlainObject;

  get hashCode(): string {
    return hashArray([
      'INGEST_ACCESS_POINT',
      hashObjectWithoutSourceInformation(this.sourceInformation ?? {}),
    ]);
  }
}

export class LakehouseAccessPoint extends AccessPoint {
  func: RawLambda;
  ingestPackageName: string | undefined;
  ingestDataset?: string | undefined;

  constructor(
    func: RawLambda,
    ingestPackageName?: string,
    ingestDataset?: string,
  ) {
    super();
    this.func = func;
    this.ingestPackageName = ingestPackageName;
    this.ingestDataset = ingestDataset;
  }

  override get hashCode(): string {
    return hashArray([
      CORE_HASH_STRUCTURE.LAKEHOUSE_ACCESS_POINT,
      this.func ?? '',
      this.ingestPackageName ?? '',
      this.ingestDataset ?? '',
    ]);
  }
}

// --- ExtractDefinition ---

export class ExtractDefinition extends PackageableElement {
  sourceType!: SourceType;
  datasetGroup!: string;
  appDirDeployment!: AppDirNode;
  source!: Source;
  schedule!: Schedule;
  ingest: Ingest[] = [];

  override accept_PackageableElementVisitor<T>(
    visitor: PackageableElementVisitor<T>,
  ): T {
    // TODO
    throw new Error('Not Implemented');
  }

  protected override get _elementHashCode(): string {
    return hashArray([
      'EXTRACT_DEFINITION',
      this.sourceType,
      this.datasetGroup,
      this.appDirDeployment.hashCode,
      this.source.hashCode,
      this.schedule.hashCode,
      hashArray(this.ingest.map((i) => i.hashCode)),
    ]);
  }
}
