import { UnsupportedOperationError } from '@finos/legend-shared';
import {
  ExtractDefinition,
  SourceType,
  type Owner,
  AppDir,
  AppDirNode,
  AppDirLevel,
  type Source,
  KafkaSource,
  KafkaMessageFormat,
  KafkaDataFormat,
  KafkaMessageEncoding,
  RelationalSource,
  type Auth,
  CredentialAuth,
  type Schedule,
  CronSchedule,
  type Ingest,
  IngestRelationalDataset,
  IngestKafkaDataset,
  type AccessPoint,
  LakehouseAccessPoint,
  // RawLambda,
} from '../../../../../../../../graph/metamodel/pure/extract/Extract.js';
import {
  type V1_ExtractDefinition,
  V1_SourceType,
  type V1_Owner,
  V1_AppDir,
  type V1_AppDirNode,
  V1_AppDirLevel,
  type V1_Source,
  V1_KafkaSource,
  type V1_KafkaMessageFormat,
  V1_KafkaDataFormat,
  V1_KafkaMessageEncoding,
  V1_RelationalSource,
  type V1_Auth,
  V1_CredentialAuth,
  type V1_Schedule,
  V1_CronSchedule,
  type V1_Ingest,
  V1_IngestRelationalDataset,
  V1_IngestKafkaDataset,
  type V1_AccessPoint,
  V1_LakehouseAccessPoint,
} from '../../../../model/packageableElements/extract/V1_Extract.js';
import { RawLambda } from '../../../../../../../../graph/metamodel/pure/rawValueSpecification/RawLambda.js';
import type { V1_GraphBuilderContext } from '../V1_GraphBuilderContext.js';

// --- Enum Mappers ---

function mapV1SourceType(type: V1_SourceType): SourceType {
  switch (type) {
    case V1_SourceType.KAFKA:
      return SourceType.KAFKA;
    case V1_SourceType.RELATIONAL:
      return SourceType.RELATIONAL;
    default:
      throw new Error(`Unknown V1_SourceType: ${type}`);
  }
}

function mapV1KafkaDataFormat(format: V1_KafkaDataFormat): KafkaDataFormat {
  switch (format) {
    case V1_KafkaDataFormat.AVRO:
      return KafkaDataFormat.AVRO;
    case V1_KafkaDataFormat.JSON:
      return KafkaDataFormat.JSON;
    default:
      throw new Error(`Unknown V1_KafkaDataFormat: ${format}`);
  }
}

function mapV1KafkaMessageEncoding(
  encoding: V1_KafkaMessageEncoding,
): KafkaMessageEncoding {
  switch (encoding) {
    case V1_KafkaMessageEncoding.BINARY:
      return KafkaMessageEncoding.BINARY;
    case V1_KafkaMessageEncoding.JSON:
      return KafkaMessageEncoding.JSON;
    default:
      throw new Error(`Unknown V1_KafkaMessageEncoding: ${encoding}`);
  }
}

function mapV1AppDirLevel(level: V1_AppDirLevel): AppDirLevel {
  switch (level) {
    case V1_AppDirLevel.BUSINESS_UNIT:
      return AppDirLevel.BUSINESS_UNIT;
    case V1_AppDirLevel.SUB_BUSINESS_UNIT:
      return AppDirLevel.SUB_BUSINESS_UNIT;
    case V1_AppDirLevel.FAMILY:
      return AppDirLevel.FAMILY;
    case V1_AppDirLevel.APPLICATION:
      return AppDirLevel.APPLICATION;
    case V1_AppDirLevel.DEPLOYMENT:
      return AppDirLevel.DEPLOYMENT;
    default:
      throw new Error(`Unknown V1_AppDirLevel: ${level}`);
  }
}

// --- AccessPoint ---

const dummy = new RawLambda([], []);
export const V1_buildAccessPoint = (
  v1ap: V1_AccessPoint,
  context: V1_GraphBuilderContext,
): AccessPoint => {
  if (v1ap instanceof V1_LakehouseAccessPoint) {
    const ap = new LakehouseAccessPoint(
      dummy,
      v1ap.ingestPackageName ?? undefined,
      v1ap.ingestDataset ?? undefined,
    );
    // ap.func = v1ap.func;
    ap.ingestPackageName = v1ap.ingestPackageName || undefined;
    ap.ingestDataset = v1ap.ingestDataset || undefined;
    return ap;
  }
  throw new UnsupportedOperationError('Unknown V1_AccessPoint type');
};

// --- Ingest ---

const ingestPoint = new LakehouseAccessPoint(dummy);
const partitions = [0, 1];
export const V1_buildIngest = (
  v1Ingest: V1_Ingest,
  context: V1_GraphBuilderContext,
): Ingest => {
  if (v1Ingest instanceof V1_IngestKafkaDataset) {
    const ingest = new IngestKafkaDataset(ingestPoint, partitions);
    ingest.ingestPoint = V1_buildAccessPoint(v1Ingest.ingestPoint, context);
    ingest.partitions = v1Ingest.partitions ? [...v1Ingest.partitions] : [];
    return ingest;
  } else if (v1Ingest instanceof V1_IngestRelationalDataset) {
    const ingest = new IngestRelationalDataset(ingestPoint, 'dummyQueryString');
    ingest.ingestPoint = V1_buildAccessPoint(v1Ingest.ingestPoint, context);
    ingest.query = v1Ingest.query;
    return ingest;
  }
  throw new Error('Unknown V1_Ingest type');
};

// --- Schedule ---

export const V1_buildSchedule = (v1Schedule: V1_Schedule): Schedule => {
  if (v1Schedule instanceof V1_CronSchedule) {
    const cron = new CronSchedule(v1Schedule.expr);
    cron.expr = v1Schedule.expr;
    return cron;
  }
  throw new UnsupportedOperationError('Unknown V1_Schedule type');
};

// --- Auth ---

export const V1_buildAuth = (v1Auth: V1_Auth): Auth => {
  if (v1Auth instanceof V1_CredentialAuth) {
    const cred = new CredentialAuth(v1Auth.credRef);
    cred.credRef = v1Auth.credRef;
    return cred;
  }
  throw new Error('Unknown V1_Auth type');
};

// --- Source ---

const V1_buildKafkaMessageFormat = (
  v1mf: V1_KafkaMessageFormat,
): KafkaMessageFormat => {
  const mf = new KafkaMessageFormat();
  mf.format = mapV1KafkaDataFormat(v1mf.format);
  if (v1mf.encoding !== undefined) {
    mf.encoding = mapV1KafkaMessageEncoding(v1mf.encoding);
  }
  return mf;
};

export const V1_buildSource = (v1Source: V1_Source): Source => {
  if (v1Source instanceof V1_KafkaSource) {
    const kafka = new KafkaSource();
    kafka.servers = v1Source.servers;
    kafka.topic = v1Source.topic;
    kafka.partitions = v1Source.partitions;
    kafka.messageFormat = V1_buildKafkaMessageFormat(v1Source.messageFormat);
    kafka.schemaRegistryUrl = v1Source.schemaRegistryUrl ?? '';
    kafka.keyDeserializer = v1Source.keyDeserializer ?? '';
    kafka.valueDeserializer = v1Source.valueDeserializer ?? '';
    return kafka;
  } else if (v1Source instanceof V1_RelationalSource) {
    const rel = new RelationalSource();
    rel.url = v1Source.url;
    rel.driver = v1Source.driver;
    rel.auth = V1_buildAuth(v1Source.auth);
    return rel;
  }
  throw new Error('Unknown V1_Source type');
};

// --- Owner ---

const V1_buildAppDirNode = (v1Node: V1_AppDirNode): AppDirNode => {
  const node = new AppDirNode(12345, AppDirLevel.DEPLOYMENT);
  node.appDirId = v1Node.appDirId;
  node.level = mapV1AppDirLevel(v1Node.level);
  return node;
};

export const V1_buildOwner = (v1Owner: V1_Owner): Owner => {
  if (v1Owner instanceof V1_AppDir) {
    const appDir = new AppDir();
    if (v1Owner.prodParallel) {
      appDir.prodParallel = V1_buildAppDirNode(v1Owner.prodParallel);
    }
    if (v1Owner.production) {
      appDir.production = V1_buildAppDirNode(v1Owner.production);
    }
    return appDir;
  }
  throw new UnsupportedOperationError('Unknown V1_Owner type');
};

// --- Main ExtractDefinition builder ---

export const V1_buildExtractDefinition = (
  v1: V1_ExtractDefinition,
  context: V1_GraphBuilderContext,
): ExtractDefinition => {
  const extract = new ExtractDefinition('DummyName');
  extract.sourceType = mapV1SourceType(v1.sourceType);
  extract.datasetGroup = v1.datasetGroup;
  // TODO extract.appDirDeployment = V1_buildOwner(v1.owner);
  extract.source = V1_buildSource(v1.source);
  extract.schedule = V1_buildSchedule(v1.schedule);
  extract.ingest = v1.ingest.map((i) => V1_buildIngest(i, context));
  // Optionally handle batchAttributesTaxonomyType if needed
  return extract;
};
