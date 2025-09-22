import {
  hashArray,
  type Hashable,
  type PlainObject,
} from '@finos/legend-shared';
import type { V1_RawLambda } from '../../rawValueSpecification/V1_RawLambda.js';
import {
  V1_PackageableElement,
  type V1_PackageableElementVisitor,
} from '../V1_PackageableElement.js';
import {
  CORE_HASH_STRUCTURE,
  hashObjectWithoutSourceInformation,
} from '../../../../../../../graph/Core_HashUtils.js';

export const V1_EXTRACT_DEFINITION_ELEMENT_PROTOCOL_TYPE = 'extractDefinition';

// --- Enums ---

export enum V1_SourceType {
  KAFKA = 'KAFKA',
  RELATIONAL = 'RELATIONAL',
}

export enum V1_KafkaDataFormat {
  AVRO = 'Avro',
  JSON = 'JSON',
}

export enum V1_KafkaMessageEncoding {
  BINARY = 'BINARY',
  JSON = 'JSON',
}

export enum V1_AuthType {
  CREDENTIAL = 'CREDENTIAL',
}

export enum V1_AppDirLevel {
  BUSINESS_UNIT = 'BUSINESS_UNIT',
  SUB_BUSINESS_UNIT = 'SUB_BUSINESS_UNIT',
  FAMILY = 'FAMILY',
  APPLICATION = 'APPLICATION',
  DEPLOYMENT = 'DEPLOYMENT',
}

// --- Source Config ---

export abstract class V1_Source implements Hashable {
  abstract get hashCode(): string;
}

export class V1_KafkaMessageFormat implements Hashable {
  format!: V1_KafkaDataFormat;
  encoding?: V1_KafkaMessageEncoding;

  get hashCode(): string {
    return hashArray([
      'KAFKA_MESSAGE_FORMAT',
      this.format,
      this.encoding ?? '',
    ]);
  }
}

export class V1_KafkaSource extends V1_Source implements Hashable {
  servers!: string[];
  topic!: string;
  partitions!: number[];
  messageFormat!: V1_KafkaMessageFormat;
  schemaRegistryUrl?: string;
  keyDeserializer?: string;
  valueDeserializer?: string;

  override get hashCode(): string {
    return hashArray([
      'KAFKA_SOURCE',
      hashArray(this.servers),
      this.topic,
      hashArray(this.partitions),
      this.messageFormat.hashCode,
      this.schemaRegistryUrl ?? '',
      this.keyDeserializer ?? '',
      this.valueDeserializer ?? '',
    ]);
  }
}

export class V1_RelationalSource extends V1_Source implements Hashable {
  url!: string;
  driver!: string;
  auth!: V1_Auth;

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

export abstract class V1_Auth implements Hashable {
  abstract get hashCode(): string;
}

export class V1_CredentialAuth extends V1_Auth implements Hashable {
  credRef!: string;

  override get hashCode(): string {
    return hashArray(['CREDENTIAL_AUTH', this.credRef]);
  }
}

// --- Schedule ---

export abstract class V1_Schedule implements Hashable {
  abstract get hashCode(): string;
}

export class V1_CronSchedule extends V1_Schedule implements Hashable {
  expr!: string;

  override get hashCode(): string {
    return hashArray(['CRON_SCHEDULE', this.expr]);
  }
}

// --- Organization ---

export abstract class V1_Owner implements Hashable {
  abstract get hashCode(): string;
}

export class V1_AppDir extends V1_Owner implements Hashable {
  prodParallel?: V1_AppDirNode;
  production?: V1_AppDirNode;

  override get hashCode(): string {
    return hashArray([
      'APP_DIR',
      this.prodParallel?.hashCode ?? '',
      this.production?.hashCode ?? '',
    ]);
  }
}

export class V1_AppDirNode implements Hashable {
  appDirId!: number;
  level!: V1_AppDirLevel;

  get hashCode(): string {
    return hashArray(['APP_DIR_NODE', this.appDirId.toString(), this.level]);
  }
}

// --- Ingest ---

export abstract class V1_Ingest implements Hashable {
  ingestPoint!: V1_AccessPoint;
  abstract get hashCode(): string;
}

export class V1_IngestRelationalDataset extends V1_Ingest implements Hashable {
  query!: string;

  override get hashCode(): string {
    return hashArray([
      'INGEST_RELATIONAL_DATASET',
      this.ingestPoint.hashCode,
      this.query,
    ]);
  }
}

export class V1_IngestKafkaDataset extends V1_Ingest {
  partitions: number[] = [];

  override get hashCode(): string {
    return hashArray([
      'INGEST_KAFKA_DATASET',
      this.ingestPoint.hashCode,
      hashArray(this.partitions.map(String)),
    ]);
  }
}

export class V1_GenericIngest extends V1_Ingest implements Hashable {
  override get hashCode(): string {
    return hashArray(['GENERIC_INGEST', this.ingestPoint.hashCode]);
  }
}

// --- Access Point ---

export abstract class V1_AccessPoint implements Hashable {
  sourceInformation?: PlainObject;
  get hashCode(): string {
    return hashArray([
      'INGEST_ACCESS_POINT',
      hashObjectWithoutSourceInformation(this.sourceInformation ?? {}),
    ]);
  }
}

export class V1_LakehouseAccessPoint extends V1_AccessPoint {
  func!: V1_RawLambda;
  ingestPackageName?: string;
  ingestDataset?: string;

  override get hashCode(): string {
    return hashArray([
      super.hashCode,
      CORE_HASH_STRUCTURE.LAKEHOUSE_ACCESS_POINT,
      this.func,
      this.ingestPackageName ?? '',
      this.ingestDataset ?? '',
    ]);
  }
}

// --- ExtractDefinition ---

export class V1_ExtractDefinition
  extends V1_PackageableElement
  implements Hashable
{
  sourceType!: V1_SourceType;
  datasetGroup!: string;
  owner!: V1_Owner;
  source!: V1_Source;
  schedule!: V1_Schedule;
  ingest: V1_Ingest[] = [];

  override get hashCode(): string {
    return hashArray([
      'EXTRACT_DEFINITION',
      this.sourceType,
      this.datasetGroup,
      this.owner.hashCode,
      this.source.hashCode,
      this.schedule.hashCode,
      hashArray(this.ingest.map((i) => i.hashCode)),
    ]);
  }
  //TODO
  override accept_PackageableElementVisitor<T>(
    visitor: V1_PackageableElementVisitor<T>,
  ): T {
    throw new Error('Undefined');
  }
}
