import {
  createModelSchema,
  deserialize,
  optional,
  primitive,
  serialize,
  custom,
  list,
} from 'serializr';
import {
  V1_ExtractDefinition,
  V1_SourceType,
  V1_KafkaSource,
  V1_RelationalSource,
  V1_KafkaMessageFormat,
  V1_KafkaDataFormat,
  V1_KafkaMessageEncoding,
  V1_CronSchedule,
  type V1_Schedule,
  V1_IngestKafkaDataset,
  V1_IngestRelationalDataset,
  type V1_AccessPoint,
  V1_LakehouseAccessPoint,
  type V1_Auth,
  V1_CredentialAuth,
  V1_AppDirNode,
  V1_AppDirLevel,
  type V1_Owner,
  V1_AppDir,
  type V1_Ingest,
  type V1_Source,
} from '../../../model/packageableElements/extract/V1_Extract.js';

import {
  UnsupportedOperationError,
  type PlainObject,
  usingConstantValueSchema,
  // usingModelSchema,
  // customList,
  // customListWithSchema,
  // optionalCustomUsingModelSchema,
} from '@finos/legend-shared';

// --- Enums ---

function serializeSourceType(type: V1_SourceType): string {
  return type;
}
function deserializeSourceType(val: string): V1_SourceType {
  if (val === V1_SourceType.KAFKA || val === V1_SourceType.RELATIONAL)
    return val;
  throw new UnsupportedOperationError('Unknown SourceType', val);
}
function serializeKafkaDataFormat(type: V1_KafkaDataFormat): string {
  return type;
}
function deserializeKafkaDataFormat(val: string): V1_KafkaDataFormat {
  if (val === V1_KafkaDataFormat.AVRO || val === V1_KafkaDataFormat.JSON)
    return val;
  throw new UnsupportedOperationError('Unknown KafkaDataFormat', val);
}
function serializeKafkaMessageEncoding(
  type: V1_KafkaMessageEncoding | undefined,
): string | undefined {
  return type;
}
function deserializeKafkaMessageEncoding(
  val: string | undefined,
): V1_KafkaMessageEncoding | undefined {
  if (val === undefined) return undefined;
  if (
    val === V1_KafkaMessageEncoding.BINARY ||
    val === V1_KafkaMessageEncoding.JSON
  )
    return val;
  throw new UnsupportedOperationError('Unknown KafkaMessageEncoding', val);
}
function serializeAppDirLevel(type: V1_AppDirLevel): string {
  return type;
}
function deserializeAppDirLevel(val: string): V1_AppDirLevel {
  if (
    val === V1_AppDirLevel.BUSINESS_UNIT ||
    val === V1_AppDirLevel.SUB_BUSINESS_UNIT ||
    val === V1_AppDirLevel.FAMILY ||
    val === V1_AppDirLevel.APPLICATION ||
    val === V1_AppDirLevel.DEPLOYMENT
  )
    return val;
  throw new UnsupportedOperationError('Unknown AppDirLevel', val);
}

export enum V1_IngestType {
  RELATIONAL = 'RELATIONAL',
  KAFKA = 'KAFKA',
}
export enum V1_AccessPointType {
  LAKEHOUSE = 'lakehouseAccessPoint',
}

// --- AccessPoint ---

export const V1_lakehouseAccessPointModelSchema = createModelSchema(
  V1_LakehouseAccessPoint,
  {
    _type: usingConstantValueSchema(V1_AccessPointType.LAKEHOUSE),
    func: primitive(),
    ingestPackageName: optional(primitive()),
    ingestDataset: optional(primitive()),
  },
);

const V1_serializeAccessPoint = (
  protocol: V1_AccessPoint,
): PlainObject<V1_AccessPoint> => {
  if (protocol instanceof V1_LakehouseAccessPoint) {
    return serialize(V1_lakehouseAccessPointModelSchema, protocol);
  }
  throw new UnsupportedOperationError(
    `Can't serialize access point type`,
    protocol,
  );
};

const V1_deserializeAccessPoint = (
  json: PlainObject<V1_AccessPoint>,
): V1_AccessPoint => {
  // Only LakehouseAccessPoint supported for now
  return deserialize(V1_lakehouseAccessPointModelSchema, json);
};

// ---Ingest ---

export const V1_ingestRelationalDatasetModelSchema = createModelSchema(
  V1_IngestRelationalDataset,
  {
    _type: usingConstantValueSchema(V1_IngestType.RELATIONAL),
    // ingestPoint: usingModelSchema(V1_lakehouseAccessPointModelSchema),
    ingestPoint: custom(V1_serializeAccessPoint, V1_deserializeAccessPoint),
    query: primitive(),
  },
);

export const V1_ingestKafkaDatasetModelSchema = createModelSchema(
  V1_IngestKafkaDataset,
  {
    _type: usingConstantValueSchema(V1_IngestType.KAFKA),
    partitions: list(primitive()),
    ingestPoint: custom(V1_serializeAccessPoint, V1_deserializeAccessPoint),
  },
);

export const V1_serializeIngest = (
  protocol: V1_Ingest,
): PlainObject<V1_Ingest> => {
  if (protocol instanceof V1_IngestRelationalDataset) {
    return serialize(V1_ingestRelationalDatasetModelSchema, protocol);
  } else if (protocol instanceof V1_IngestKafkaDataset) {
    return serialize(V1_ingestKafkaDatasetModelSchema, protocol);
  }
  throw new UnsupportedOperationError(`Can't serialize ingest type`, protocol);
};

export const V1_deserializeIngest = (
  json: PlainObject<V1_Ingest>,
): V1_Ingest => {
  switch (json._type) {
    // if ('partitions' in json) {
    // return deserialize(V1_ingestKafkaDatasetModelSchema, json);
    // }
    case V1_IngestType.RELATIONAL:
      return deserialize(V1_ingestRelationalDatasetModelSchema, json);
    case V1_IngestType.KAFKA:
      return deserialize(V1_ingestKafkaDatasetModelSchema, json);
    default:
      throw new UnsupportedOperationError(
        `Can't deserialize ingest type '${json._type}'`,
      );
  }
};

// --- Schedule ---

export const V1_CronScheduleModelSchema = createModelSchema(V1_CronSchedule, {
  expr: primitive(),
});

const V1_serializeSchedule = (
  protocol: V1_Schedule,
): PlainObject<V1_Schedule> => {
  if (protocol instanceof V1_CronSchedule) {
    return serialize(V1_CronScheduleModelSchema, protocol);
  }
  throw new UnsupportedOperationError('Unknown Schedule type', protocol);
};

const V1_deserializeSchedule = (
  json: PlainObject<V1_Schedule>,
): V1_Schedule => {
  if ('expr' in json) {
    return deserialize(V1_CronScheduleModelSchema, json);
  }
  throw new UnsupportedOperationError('Unknown Schedule type', json);
};

// --- Auth ---

export const V1_CredentialAuthModelSchema = createModelSchema(
  V1_CredentialAuth,
  {
    credRef: primitive(),
  },
);

const V1_serializeAuth = (protocol: V1_Auth): PlainObject<V1_Auth> => {
  if (protocol instanceof V1_CredentialAuth) {
    return serialize(V1_CredentialAuthModelSchema, protocol);
  }
  throw new UnsupportedOperationError('Unknown Auth type', protocol);
};

const V1_deserializeAuth = (json: PlainObject<V1_Auth>): V1_Auth => {
  if ('credRef' in json) {
    return deserialize(V1_CredentialAuthModelSchema, json);
  }
  throw new UnsupportedOperationError('Unknown Auth type', json);
};

// --- Source ---

export const V1_KafkaMessageFormatModelSchema = createModelSchema(
  V1_KafkaMessageFormat,
  {
    format: custom(serializeKafkaDataFormat, deserializeKafkaDataFormat),
    encoding: optional(
      custom(serializeKafkaMessageEncoding, deserializeKafkaMessageEncoding),
    ),
  },
);

export const V1_KafkaSourceModelSchema = createModelSchema(V1_KafkaSource, {
  servers: list(primitive()),
  topic: primitive(),
  partitions: list(primitive()),
  messageFormat: custom(
    (val) => serialize(V1_KafkaMessageFormatModelSchema, val),
    (val) => deserialize(V1_KafkaMessageFormatModelSchema, val),
  ),
  schemaRegistryUrl: optional(primitive()),
  keyDeserializer: optional(primitive()),
  valueDeserializer: optional(primitive()),
});

export const V1_RelationalSourceModelSchema = createModelSchema(
  V1_RelationalSource,
  {
    url: primitive(),
    driver: primitive(),
    auth: custom(V1_serializeAuth, V1_deserializeAuth),
  },
);

const V1_serializeSource = (protocol: V1_Source): PlainObject<V1_Source> => {
  if (protocol instanceof V1_KafkaSource) {
    return serialize(V1_KafkaSourceModelSchema, protocol);
  } else if (protocol instanceof V1_RelationalSource) {
    return serialize(V1_RelationalSourceModelSchema, protocol);
  }
  throw new UnsupportedOperationError('Unknown Source type', protocol);
};

const V1_deserializeSource = (json: PlainObject<V1_Source>): V1_Source => {
  if ('servers' in json && 'topic' in json) {
    return deserialize(V1_KafkaSourceModelSchema, json);
  } else if ('url' in json && 'driver' in json) {
    return deserialize(V1_RelationalSourceModelSchema, json);
  }
  throw new UnsupportedOperationError('Unknown Source type', json);
};

// --- Owner ---

export const V1_AppDirNodeModelSchema = createModelSchema(V1_AppDirNode, {
  appDirId: primitive(),
  level: custom(serializeAppDirLevel, deserializeAppDirLevel),
});

export const V1_AppDirModelSchema = createModelSchema(V1_AppDir, {
  prodParallel: optional(
    custom(
      (val) => serialize(V1_AppDirNodeModelSchema, val),
      (val) => deserialize(V1_AppDirNodeModelSchema, val),
    ),
  ),
  production: optional(
    custom(
      (val) => serialize(V1_AppDirNodeModelSchema, val),
      (val) => deserialize(V1_AppDirNodeModelSchema, val),
    ),
  ),
});

const V1_serializeOwner = (protocol: V1_Owner): PlainObject<V1_Owner> => {
  if (protocol instanceof V1_AppDir) {
    return serialize(V1_AppDirModelSchema, protocol);
  }
  throw new UnsupportedOperationError('Unknown Owner type', protocol);
};

const V1_deserializeOwner = (json: PlainObject<V1_Owner>): V1_Owner => {
  if ('prodParallel' in json || 'production' in json) {
    return deserialize(V1_AppDirModelSchema, json);
  }
  throw new UnsupportedOperationError('Unknown Owner type', json);
};

// --- Main ExtractDefinition ---

export const V1_ExtractDefinitionModelSchema = createModelSchema(
  V1_ExtractDefinition,
  {
    sourceType: custom(serializeSourceType, deserializeSourceType),
    datasetGroup: optional(primitive()),
    owner: custom(V1_serializeOwner, V1_deserializeOwner),
    source: custom(V1_serializeSource, V1_deserializeSource),
    schedule: custom(V1_serializeSchedule, V1_deserializeSchedule),
    ingest: list(custom(V1_serializeIngest, V1_deserializeIngest)),
    // batchAttributesTaxonomyType: optional(primitive()),
  },
);

// --- Exported helpers ---

export const V1_serializeExtractDefinition = (
  protocol: V1_ExtractDefinition,
): PlainObject<V1_ExtractDefinition> =>
  serialize(V1_ExtractDefinitionModelSchema, protocol);

export const V1_deserializeExtractDefinition = (
  json: PlainObject<V1_ExtractDefinition>,
): V1_ExtractDefinition => deserialize(V1_ExtractDefinitionModelSchema, json);
