import { UnsupportedOperationError } from '@finos/legend-shared';
import {
  type ExtractDefinition,
  type AppDirNode,
  AppDir,
  AppDirLevel,
  type Source,
  KafkaSource,
  RelationalSource,
  type Schedule,
  CronSchedule,
  type Ingest,
  IngestKafkaDataset,
  IngestRelationalDataset,
  type Auth,
  CredentialAuth,
  type AccessPoint,
  LakehouseAccessPoint,
  type Owner,
  type KafkaMessageFormat,
  KafkaDataFormat,
  KafkaMessageEncoding,
  SourceType,
} from '../../../../../../../graph/metamodel/pure/extract/Extract.js';

import {
  type V1_Source,
  type V1_Auth,
  type V1_Schedule,
  type V1_Ingest,
  type V1_AccessPoint,
  type V1_Owner,
  V1_SourceType,
  V1_ExtractDefinition,
  V1_AppDirLevel,
  V1_AppDir,
  V1_AppDirNode,
  V1_KafkaSource,
  V1_KafkaMessageFormat,
  V1_KafkaDataFormat,
  V1_KafkaMessageEncoding,
  V1_RelationalSource,
  V1_CredentialAuth,
  V1_CronSchedule,
  V1_IngestKafkaDataset,
  V1_IngestRelationalDataset,
  V1_LakehouseAccessPoint,
} from '../../../model/packageableElements/extract/V1_Extract.js';
import { V1_initPackageableElement } from './V1_CoreTransformerHelper.js';
// import { V1_transformRawLambda } from './V1_RawValueSpecificationTransformer.js';
// import type { V1_GraphTransformerContext } from './V1_GraphTransformerContext.js';

// --- AccessPoint ---
const V1_transformAccessPoint = (ap: AccessPoint): V1_AccessPoint => {
  if (ap instanceof LakehouseAccessPoint) {
    const v1Lake = new V1_LakehouseAccessPoint();
    // v1Lake.func = V1_transformRawLambda(ap.func, context);
    v1Lake.ingestPackageName = ap.ingestPackageName ?? '';
    v1Lake.ingestDataset = ap.ingestDataset ?? '';
    return v1Lake;
  }
  throw new UnsupportedOperationError(
    `Unable to transform extract access point`,
  );
  // TODO Fallback for base AccessPoint in future
};

// --- Ingest ---
const V1_transformIngest = (ingest: Ingest): V1_Ingest => {
  if (ingest instanceof IngestKafkaDataset) {
    const v1KafkaIngest = new V1_IngestKafkaDataset();
    v1KafkaIngest.ingestPoint = V1_transformAccessPoint(ingest.ingestPoint);
    v1KafkaIngest.partitions = ingest.partitions ? [...ingest.partitions] : [];
    return v1KafkaIngest;
  } else if (ingest instanceof IngestRelationalDataset) {
    const v1RelIngest = new V1_IngestRelationalDataset();
    v1RelIngest.ingestPoint = V1_transformAccessPoint(ingest.ingestPoint);
    v1RelIngest.query = ingest.query;
    return v1RelIngest;
  }
  throw new UnsupportedOperationError('Unknown ingest type', ingest);
};

// --- Schedule ---
const V1_transformSchedule = (schedule: Schedule): V1_Schedule => {
  if (schedule instanceof CronSchedule) {
    const v1Cron = new V1_CronSchedule();
    v1Cron.expr = schedule.expr;
    return v1Cron;
  }
  throw new UnsupportedOperationError('Unknown schedule type', schedule);
};

// --- Auth ---
const V1_transformAuth = (auth: Auth): V1_Auth => {
  if (auth instanceof CredentialAuth) {
    const v1Cred = new V1_CredentialAuth();
    v1Cred.credRef = auth.credRef;
    return v1Cred;
  }
  throw new UnsupportedOperationError('Unknown auth type', auth);
};

// --- Source ---

function mapKafkaDataFormat(format: KafkaDataFormat): V1_KafkaDataFormat {
  switch (format) {
    case KafkaDataFormat.AVRO:
      return V1_KafkaDataFormat.AVRO;
    case KafkaDataFormat.JSON:
      return V1_KafkaDataFormat.JSON;
    default:
      throw new Error(`Unknown KafkaDataFormat: ${format}`);
  }
}

function mapKafkaMessageEncoding(
  encoding: KafkaMessageEncoding,
): V1_KafkaMessageEncoding {
  switch (encoding) {
    case KafkaMessageEncoding.BINARY:
      return V1_KafkaMessageEncoding.BINARY;
    case KafkaMessageEncoding.JSON:
      return V1_KafkaMessageEncoding.JSON;
    default:
      throw new Error(`Unknown KafkaMessageEncoding: ${encoding}`);
  }
}

const V1_transformKafkaMessageFormat = (
  mf: KafkaMessageFormat,
): V1_KafkaMessageFormat => {
  const v1mf = new V1_KafkaMessageFormat();
  v1mf.format = mapKafkaDataFormat(mf.format);
  if (mf.encoding !== undefined) {
    v1mf.encoding = mapKafkaMessageEncoding(mf.encoding);
  }
  return v1mf;
};

const V1_transformSource = (source: Source): V1_Source => {
  if (source instanceof KafkaSource) {
    const v1Kafka = new V1_KafkaSource();
    v1Kafka.servers = [...source.servers];
    v1Kafka.topic = source.topic;
    v1Kafka.partitions = [...source.partitions];
    v1Kafka.messageFormat = V1_transformKafkaMessageFormat(
      source.messageFormat,
    );
    v1Kafka.schemaRegistryUrl = source.schemaRegistryUrl ?? '';
    v1Kafka.keyDeserializer = source.keyDeserializer ?? '';
    v1Kafka.valueDeserializer = source.valueDeserializer ?? '';
    return v1Kafka;
  } else if (source instanceof RelationalSource) {
    const v1Rel = new V1_RelationalSource();
    v1Rel.url = source.url;
    v1Rel.driver = source.driver;
    v1Rel.auth = V1_transformAuth(source.auth);
    return v1Rel;
  }
  throw new UnsupportedOperationError('Unknown source type', source);
};

// --- Owner ---

function mapAppDirLevel(level: AppDirLevel): V1_AppDirLevel {
  switch (level) {
    case AppDirLevel.BUSINESS_UNIT:
      return V1_AppDirLevel.BUSINESS_UNIT;
    case AppDirLevel.SUB_BUSINESS_UNIT:
      return V1_AppDirLevel.SUB_BUSINESS_UNIT;
    case AppDirLevel.FAMILY:
      return V1_AppDirLevel.FAMILY;
    case AppDirLevel.APPLICATION:
      return V1_AppDirLevel.APPLICATION;
    case AppDirLevel.DEPLOYMENT:
      return V1_AppDirLevel.DEPLOYMENT;
    default:
      throw new Error(`Unknown AppDirLevel: ${level}`);
  }
}

const V1_transformAppDirNode = (node: AppDirNode): V1_AppDirNode => {
  const v1Node = new V1_AppDirNode();
  v1Node.appDirId = node.appDirId;
  v1Node.level = mapAppDirLevel(node.level);
  return v1Node;
};

const V1_transformOwner = (owner: Owner): V1_Owner => {
  if (owner instanceof AppDir) {
    const v1 = new V1_AppDir();
    if (owner.prodParallel) {
      v1.prodParallel = V1_transformAppDirNode(owner.prodParallel);
    }
    if (owner.production) {
      v1.production = V1_transformAppDirNode(owner.production);
    }
    return v1;
  }
  throw new UnsupportedOperationError(`Unable to transform extract owner`);
};

// --- Main Extract Transformer ---

function mapSourceType(type: SourceType): V1_SourceType {
  switch (type) {
    case SourceType.KAFKA:
      return V1_SourceType.KAFKA;
    case SourceType.RELATIONAL:
      return V1_SourceType.RELATIONAL;
    default:
      throw new Error(`Unknown SourceType: ${type}`);
  }
}
export const V1_transformExtract = (
  element: ExtractDefinition,
): V1_ExtractDefinition => {
  const extract = new V1_ExtractDefinition();
  V1_initPackageableElement(extract, element);
  extract.sourceType = mapSourceType(element.sourceType);
  extract.datasetGroup = element.datasetGroup;
  extract.owner = V1_transformOwner(element.appDirDeployment);
  extract.source = V1_transformSource(element.source);
  extract.schedule = V1_transformSchedule(element.schedule);
  extract.ingest = element.ingest.map(V1_transformIngest);
  // Optionally map batchAttributesTaxonomyType if needed
  return extract;
};
