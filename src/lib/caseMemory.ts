export const CASE_MEMORY_SCHEMA_VERSION = 1;
export const CASE_MEMORY_STORAGE_KEY = 'fracture-studio-case-memory-v1';

export type CaseMemoryId = string;
export type IsoDateString = string;

export type CaseMemoryRunState = 'idle' | 'running' | 'success' | 'error';

export type CaseMemoryLastRunStatus = {
  state: CaseMemoryRunState;
  at?: IsoDateString;
  label?: string;
  summary?: string;
  score?: number;
  error?: string;
};

export type CaseMemorySource = {
  id: CaseMemoryId;
  title?: string;
  url?: string;
  citation?: string;
  raw?: string;
  notes?: string;
  claimId?: string;
};

export type CaseMemoryFields = {
  draft: string;
  content: string;
  sources: CaseMemorySource[];
  opponent: string;
  rubric: string;
};

export type SavedCaseMetadata = {
  id: CaseMemoryId;
  title: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  tags: string[];
  lastRun: CaseMemoryLastRunStatus;
};

export type CaseVersionSnapshot = {
  id: CaseMemoryId;
  caseId: CaseMemoryId;
  title: string;
  createdAt: IsoDateString;
  label?: string;
  notes?: string;
  fields: CaseMemoryFields;
  tags: string[];
  lastRun: CaseMemoryLastRunStatus;
};

export type SavedCase = CaseMemoryFields & {
  metadata: SavedCaseMetadata;
  versions: CaseVersionSnapshot[];
};

export type SavedCaseSummary = SavedCaseMetadata & {
  preview: string;
  wordCount: number;
  sourceCount: number;
  versionCount: number;
  hasOpponent: boolean;
  hasRubric: boolean;
};

export type CaseSnapshotRestore = {
  caseId: CaseMemoryId;
  snapshotId: CaseMemoryId;
  title: string;
  fields: CaseMemoryFields;
  tags: string[];
  lastRun: CaseMemoryLastRunStatus;
  snapshot: CaseVersionSnapshot;
};

export type CaseMemoryState = {
  schemaVersion: typeof CASE_MEMORY_SCHEMA_VERSION;
  updatedAt: IsoDateString;
  cases: SavedCase[];
};

export type CaseMemoryExportBundle = {
  schemaVersion: typeof CASE_MEMORY_SCHEMA_VERSION;
  exportedAt: IsoDateString;
  cases: SavedCase[];
};

export type CreateSavedCaseInput = Partial<CaseMemoryFields> & {
  id?: CaseMemoryId;
  title?: string;
  tags?: string[];
  lastRun?: Partial<CaseMemoryLastRunStatus>;
};

export type UpdateSavedCaseInput = Partial<CaseMemoryFields> & {
  title?: string;
  tags?: string[];
  lastRun?: Partial<CaseMemoryLastRunStatus>;
};

export type CreateCaseSnapshotInput = {
  id?: CaseMemoryId;
  label?: string;
  notes?: string;
};

export type RestoreCaseSnapshotOptions = {
  createSnapshotBeforeRestore?: boolean;
  restoreTitle?: boolean;
  label?: string;
};

export type ExportCaseMemoryOptions = {
  ids?: CaseMemoryId[];
  pretty?: boolean;
};

export type ImportCaseMemoryOptions = {
  mode?: 'merge' | 'replace';
  onConflict?: 'keep' | 'replace' | 'rename';
};

export type CaseMemoryImportResult = {
  imported: number;
  replaced: number;
  skipped: number;
  renamed: number;
  errors: string[];
  cases: SavedCaseSummary[];
};

export type CaseMemoryStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type CaseMemoryStoreOptions = {
  storage?: CaseMemoryStorage;
  storageKey?: string;
  now?: () => Date;
  idFactory?: (prefix: string) => CaseMemoryId;
};

export type CaseMemoryStore = {
  listCases(): SavedCaseSummary[];
  listCaseMetadata(): SavedCaseMetadata[];
  getCase(id: CaseMemoryId): SavedCase | undefined;
  createCase(input?: CreateSavedCaseInput): SavedCase;
  updateCase(id: CaseMemoryId, input: UpdateSavedCaseInput): SavedCase | undefined;
  deleteCase(id: CaseMemoryId): boolean;
  createSnapshot(caseId: CaseMemoryId, input?: CreateCaseSnapshotInput): CaseVersionSnapshot | undefined;
  lookupSnapshot(caseId: CaseMemoryId, snapshotId: CaseMemoryId): CaseSnapshotRestore | undefined;
  restoreSnapshot(caseId: CaseMemoryId, snapshotId: CaseMemoryId, options?: RestoreCaseSnapshotOptions): SavedCase | undefined;
  exportJson(options?: ExportCaseMemoryOptions): string;
  importJson(json: string, options?: ImportCaseMemoryOptions): CaseMemoryImportResult;
};

type UnknownRecord = Record<string, unknown>;

function emptyRunStatus(): CaseMemoryLastRunStatus {
  return { state: 'idle' };
}

function emptyFields(): CaseMemoryFields {
  return {
    draft: '',
    content: '',
    sources: [],
    opponent: '',
    rubric: '',
  };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeDate(value: unknown, fallback: IsoDateString): IsoDateString {
  const raw = asString(value);
  if (!raw) {
    return fallback;
  }

  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? fallback : new Date(timestamp).toISOString();
}

function nowIso(now: () => Date): IsoDateString {
  return now().toISOString();
}

function uniqueStrings(values: unknown): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of asArray(values)) {
    const trimmed = asString(value)?.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function normalizeRunStatus(value: unknown, fallback: CaseMemoryLastRunStatus = emptyRunStatus()): CaseMemoryLastRunStatus {
  if (!isRecord(value)) {
    return { ...fallback };
  }

  const rawState = asString(value.state);
  const state: CaseMemoryRunState =
    rawState === 'running' || rawState === 'success' || rawState === 'error' || rawState === 'idle' ? rawState : fallback.state;

  return {
    state,
    at: asString(value.at) ?? fallback.at,
    label: asString(value.label) ?? fallback.label,
    summary: asString(value.summary) ?? fallback.summary,
    score: asNumber(value.score) ?? fallback.score,
    error: asString(value.error) ?? fallback.error,
  };
}

function normalizeSource(value: unknown, index: number, idFactory: (prefix: string) => CaseMemoryId): CaseMemorySource | undefined {
  if (typeof value === 'string') {
    const raw = value.trim();
    return raw ? { id: idFactory('source'), raw } : undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const id = asString(value.id)?.trim() || idFactory('source');
  const source: CaseMemorySource = {
    id,
    title: asString(value.title)?.trim() || undefined,
    url: asString(value.url)?.trim() || undefined,
    citation: asString(value.citation)?.trim() || undefined,
    raw: asString(value.raw)?.trim() || undefined,
    notes: asString(value.notes)?.trim() || undefined,
    claimId: asString(value.claimId)?.trim() || undefined,
  };

  if (!source.title && !source.url && !source.citation && !source.raw && !source.notes && !source.claimId) {
    return { id: source.id || `source-${index + 1}`, raw: '' };
  }

  return source;
}

function normalizeSources(values: unknown, idFactory: (prefix: string) => CaseMemoryId): CaseMemorySource[] {
  return asArray(values)
    .map((value, index) => normalizeSource(value, index, idFactory))
    .filter((source): source is CaseMemorySource => Boolean(source));
}

function normalizeFields(value: unknown, idFactory: (prefix: string) => CaseMemoryId): CaseMemoryFields {
  if (!isRecord(value)) {
    return emptyFields();
  }

  return {
    draft: asString(value.draft) ?? '',
    content: asString(value.content) ?? '',
    sources: normalizeSources(value.sources, idFactory),
    opponent: asString(value.opponent) ?? asString(value.opponentText) ?? '',
    rubric: asString(value.rubric) ?? '',
  };
}

function words(text: string): string[] {
  return text.match(/[A-Za-z0-9']+/g) ?? [];
}

function previewFor(fields: Pick<CaseMemoryFields, 'draft' | 'content'>): string {
  const source = fields.content.trim() || fields.draft.trim();
  const clean = source.replace(/\s+/g, ' ').trim();
  return clean.length <= 180 ? clean : `${clean.slice(0, 177).trim()}...`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createId(prefix: string): CaseMemoryId {
  const cryptoLike = globalThis.crypto;
  if (cryptoLike && typeof cryptoLike.randomUUID === 'function') {
    return `${prefix}-${cryptoLike.randomUUID()}`;
  }

  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function uniqueId(
  preferred: string | undefined,
  usedIds: Set<string>,
  idFactory: (prefix: string) => CaseMemoryId,
  prefix: string,
): CaseMemoryId {
  let candidate = preferred?.trim() || idFactory(prefix);
  while (usedIds.has(candidate)) {
    candidate = idFactory(prefix);
  }

  usedIds.add(candidate);
  return candidate;
}

function summarizeCase(savedCase: SavedCase): SavedCaseSummary {
  return {
    ...clone(savedCase.metadata),
    preview: previewFor(savedCase),
    wordCount: words(savedCase.content || savedCase.draft).length,
    sourceCount: savedCase.sources.length,
    versionCount: savedCase.versions.length,
    hasOpponent: savedCase.opponent.trim().length > 0,
    hasRubric: savedCase.rubric.trim().length > 0,
  };
}

function sortByUpdatedAt(a: SavedCaseSummary, b: SavedCaseSummary): number {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

function createState(cases: SavedCase[], updatedAt: IsoDateString): CaseMemoryState {
  return {
    schemaVersion: CASE_MEMORY_SCHEMA_VERSION,
    updatedAt,
    cases,
  };
}

function normalizeSnapshot(
  value: unknown,
  caseId: CaseMemoryId,
  fallbackTitle: string,
  fallback: IsoDateString,
  idFactory: (prefix: string) => CaseMemoryId,
  usedIds: Set<string>,
): CaseVersionSnapshot | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const fieldsSource = isRecord(value.fields) ? value.fields : value;
  const id = uniqueId(asString(value.id), usedIds, idFactory, 'snapshot');

  return {
    id,
    caseId: asString(value.caseId) || caseId,
    title: asString(value.title)?.trim() || fallbackTitle,
    createdAt: normalizeDate(value.createdAt, fallback),
    label: asString(value.label)?.trim() || undefined,
    notes: asString(value.notes)?.trim() || undefined,
    fields: normalizeFields(fieldsSource, idFactory),
    tags: uniqueStrings(value.tags),
    lastRun: normalizeRunStatus(value.lastRun),
  };
}

function normalizeCase(
  value: unknown,
  fallback: IsoDateString,
  idFactory: (prefix: string) => CaseMemoryId,
  usedIds: Set<string>,
): SavedCase | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const metadataValue = isRecord(value.metadata) ? value.metadata : value;
  const id = uniqueId(asString(metadataValue.id) || asString(value.id), usedIds, idFactory, 'case');
  const title = asString(metadataValue.title)?.trim() || asString(value.title)?.trim() || 'Untitled case';
  const createdAt = normalizeDate(metadataValue.createdAt ?? value.createdAt, fallback);
  const updatedAt = normalizeDate(metadataValue.updatedAt ?? value.updatedAt, createdAt);
  const tags = uniqueStrings(metadataValue.tags ?? value.tags);
  const lastRun = normalizeRunStatus(metadataValue.lastRun ?? value.lastRun);
  const fieldsSource = isRecord(value.fields) ? value.fields : value;
  const fields = normalizeFields(fieldsSource, idFactory);
  const usedSnapshotIds = new Set<string>();
  const versions = asArray(value.versions)
    .map((snapshot) => normalizeSnapshot(snapshot, id, title, createdAt, idFactory, usedSnapshotIds))
    .filter((snapshot): snapshot is CaseVersionSnapshot => Boolean(snapshot));

  return {
    metadata: {
      id,
      title,
      createdAt,
      updatedAt,
      tags,
      lastRun,
    },
    ...fields,
    versions,
  };
}

function normalizeState(
  value: unknown,
  fallback: IsoDateString,
  idFactory: (prefix: string) => CaseMemoryId,
): CaseMemoryState {
  const rawCases = Array.isArray(value) ? value : isRecord(value) ? asArray(value.cases) : [];
  const usedIds = new Set<string>();
  const cases = rawCases
    .map((candidate) => normalizeCase(candidate, fallback, idFactory, usedIds))
    .filter((candidate): candidate is SavedCase => Boolean(candidate));

  return createState(cases, fallback);
}

function loadState(
  storage: CaseMemoryStorage,
  storageKey: string,
  now: () => Date,
  idFactory: (prefix: string) => CaseMemoryId,
): CaseMemoryState {
  const fallback = nowIso(now);

  try {
    const raw = storage.getItem(storageKey);
    if (!raw) {
      return createState([], fallback);
    }

    return normalizeState(JSON.parse(raw) as unknown, fallback, idFactory);
  } catch {
    return createState([], fallback);
  }
}

function saveState(storage: CaseMemoryStorage, storageKey: string, state: CaseMemoryState): void {
  storage.setItem(storageKey, JSON.stringify(state));
}

function makeCaseFromInput(
  input: CreateSavedCaseInput,
  timestamp: IsoDateString,
  idFactory: (prefix: string) => CaseMemoryId,
  usedIds: Set<string>,
): SavedCase {
  const id = uniqueId(input.id, usedIds, idFactory, 'case');
  const fields = {
    ...emptyFields(),
    ...normalizeFields(input, idFactory),
  };

  return {
    metadata: {
      id,
      title: input.title?.trim() || 'Untitled case',
      createdAt: timestamp,
      updatedAt: timestamp,
      tags: uniqueStrings(input.tags),
      lastRun: normalizeRunStatus(input.lastRun),
    },
    ...fields,
    versions: [],
  };
}

function makeSnapshotFromCase(
  savedCase: SavedCase,
  input: CreateCaseSnapshotInput,
  timestamp: IsoDateString,
  idFactory: (prefix: string) => CaseMemoryId,
): CaseVersionSnapshot {
  return {
    id: input.id?.trim() || idFactory('snapshot'),
    caseId: savedCase.metadata.id,
    title: savedCase.metadata.title,
    createdAt: timestamp,
    label: input.label?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    fields: {
      draft: savedCase.draft,
      content: savedCase.content,
      sources: clone(savedCase.sources),
      opponent: savedCase.opponent,
      rubric: savedCase.rubric,
    },
    tags: [...savedCase.metadata.tags],
    lastRun: clone(savedCase.metadata.lastRun),
  };
}

function applyUpdate(
  savedCase: SavedCase,
  input: UpdateSavedCaseInput,
  timestamp: IsoDateString,
  idFactory: (prefix: string) => CaseMemoryId,
): SavedCase {
  const next = clone(savedCase);

  if (typeof input.title === 'string') {
    next.metadata.title = input.title.trim() || 'Untitled case';
  }
  if (typeof input.draft === 'string') {
    next.draft = input.draft;
  }
  if (typeof input.content === 'string') {
    next.content = input.content;
  }
  if (Array.isArray(input.sources)) {
    next.sources = normalizeSources(input.sources, idFactory);
  }
  if (typeof input.opponent === 'string') {
    next.opponent = input.opponent;
  }
  if (typeof input.rubric === 'string') {
    next.rubric = input.rubric;
  }
  if (Array.isArray(input.tags)) {
    next.metadata.tags = uniqueStrings(input.tags);
  }
  if (input.lastRun) {
    next.metadata.lastRun = normalizeRunStatus(input.lastRun, next.metadata.lastRun);
  }

  next.metadata.updatedAt = timestamp;
  return next;
}

function safeBrowserStorage(fallback: CaseMemoryStorage): CaseMemoryStorage {
  let fallbackOnly = false;

  function browserStorage(): Storage | undefined {
    try {
      return globalThis.localStorage;
    } catch {
      fallbackOnly = true;
      return undefined;
    }
  }

  return {
    getItem(key: string): string | null {
      if (fallbackOnly) {
        return fallback.getItem(key);
      }

      try {
        return browserStorage()?.getItem(key) ?? fallback.getItem(key);
      } catch {
        fallbackOnly = true;
        return fallback.getItem(key);
      }
    },
    setItem(key: string, value: string): void {
      if (fallbackOnly) {
        fallback.setItem(key, value);
        return;
      }

      try {
        const storage = browserStorage();
        if (storage) {
          storage.setItem(key, value);
          return;
        }
      } catch {
        fallbackOnly = true;
      }

      fallback.setItem(key, value);
    },
    removeItem(key: string): void {
      if (fallbackOnly) {
        fallback.removeItem(key);
        return;
      }

      try {
        const storage = browserStorage();
        if (storage) {
          storage.removeItem(key);
          return;
        }
      } catch {
        fallbackOnly = true;
      }

      fallback.removeItem(key);
    },
  };
}

function mergeImportedCases(
  current: SavedCase[],
  incoming: SavedCase[],
  options: ImportCaseMemoryOptions,
  idFactory: (prefix: string) => CaseMemoryId,
): { cases: SavedCase[]; imported: number; replaced: number; skipped: number; renamed: number } {
  if (options.mode === 'replace') {
    return {
      cases: clone(incoming),
      imported: incoming.length,
      replaced: current.length,
      skipped: 0,
      renamed: 0,
    };
  }

  const onConflict = options.onConflict ?? 'rename';
  const cases = clone(current);
  let imported = 0;
  let replaced = 0;
  let skipped = 0;
  let renamed = 0;

  for (const incomingCase of incoming) {
    const existingIndex = cases.findIndex((candidate) => candidate.metadata.id === incomingCase.metadata.id);

    if (existingIndex === -1) {
      cases.push(clone(incomingCase));
      imported += 1;
      continue;
    }

    if (onConflict === 'keep') {
      skipped += 1;
      continue;
    }

    if (onConflict === 'replace') {
      cases[existingIndex] = clone(incomingCase);
      imported += 1;
      replaced += 1;
      continue;
    }

    const next = clone(incomingCase);
    const usedIds = new Set(cases.map((candidate) => candidate.metadata.id));
    next.metadata.id = uniqueId(undefined, usedIds, idFactory, 'case');
    next.versions = next.versions.map((snapshot) => ({
      ...snapshot,
      caseId: next.metadata.id,
    }));
    cases.push(next);
    imported += 1;
    renamed += 1;
  }

  return { cases, imported, replaced, skipped, renamed };
}

export function createMemoryCaseMemoryStorage(initial: Record<string, string> = {}): CaseMemoryStorage {
  const values = new Map(Object.entries(initial));

  return {
    getItem(key: string): string | null {
      return values.has(key) ? values.get(key) ?? null : null;
    },
    setItem(key: string, value: string): void {
      values.set(key, value);
    },
    removeItem(key: string): void {
      values.delete(key);
    },
  };
}

export function createSafeCaseMemoryStorage(): CaseMemoryStorage {
  return safeBrowserStorage(createMemoryCaseMemoryStorage());
}

export function exportCaseMemoryJson(
  cases: SavedCase[] | CaseMemoryState,
  options: ExportCaseMemoryOptions = {},
  now: () => Date = () => new Date(),
): string {
  const sourceCases = Array.isArray(cases) ? cases : cases.cases;
  const wanted = options.ids ? new Set(options.ids) : undefined;
  const bundle: CaseMemoryExportBundle = {
    schemaVersion: CASE_MEMORY_SCHEMA_VERSION,
    exportedAt: nowIso(now),
    cases: clone(wanted ? sourceCases.filter((savedCase) => wanted.has(savedCase.metadata.id)) : sourceCases),
  };

  return JSON.stringify(bundle, null, options.pretty === false ? 0 : 2);
}

export function parseCaseMemoryJson(
  json: string,
  now: () => Date = () => new Date(),
  idFactory: (prefix: string) => CaseMemoryId = createId,
): CaseMemoryState {
  const parsed = JSON.parse(json) as unknown;
  return normalizeState(parsed, nowIso(now), idFactory);
}

export function createCaseMemoryStore(options: CaseMemoryStoreOptions = {}): CaseMemoryStore {
  const storage = options.storage ?? createSafeCaseMemoryStorage();
  const storageKey = options.storageKey ?? CASE_MEMORY_STORAGE_KEY;
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? createId;

  function read(): CaseMemoryState {
    return loadState(storage, storageKey, now, idFactory);
  }

  function write(cases: SavedCase[]): CaseMemoryState {
    const state = createState(cases, nowIso(now));
    saveState(storage, storageKey, state);
    return state;
  }

  return {
    listCases(): SavedCaseSummary[] {
      return read().cases.map(summarizeCase).sort(sortByUpdatedAt);
    },
    listCaseMetadata(): SavedCaseMetadata[] {
      return this.listCases().map((summary) => ({
        id: summary.id,
        title: summary.title,
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt,
        tags: [...summary.tags],
        lastRun: clone(summary.lastRun),
      }));
    },
    getCase(id: CaseMemoryId): SavedCase | undefined {
      const savedCase = read().cases.find((candidate) => candidate.metadata.id === id);
      return savedCase ? clone(savedCase) : undefined;
    },
    createCase(input: CreateSavedCaseInput = {}): SavedCase {
      const state = read();
      const timestamp = nowIso(now);
      const usedIds = new Set(state.cases.map((candidate) => candidate.metadata.id));
      const savedCase = makeCaseFromInput(input, timestamp, idFactory, usedIds);
      write([savedCase, ...state.cases]);
      return clone(savedCase);
    },
    updateCase(id: CaseMemoryId, input: UpdateSavedCaseInput): SavedCase | undefined {
      const state = read();
      const timestamp = nowIso(now);
      const index = state.cases.findIndex((candidate) => candidate.metadata.id === id);
      if (index === -1) {
        return undefined;
      }

      const nextCase = applyUpdate(state.cases[index], input, timestamp, idFactory);
      const nextCases = [...state.cases];
      nextCases[index] = nextCase;
      write(nextCases);
      return clone(nextCase);
    },
    deleteCase(id: CaseMemoryId): boolean {
      const state = read();
      const nextCases = state.cases.filter((candidate) => candidate.metadata.id !== id);
      if (nextCases.length === state.cases.length) {
        return false;
      }

      write(nextCases);
      return true;
    },
    createSnapshot(caseId: CaseMemoryId, input: CreateCaseSnapshotInput = {}): CaseVersionSnapshot | undefined {
      const state = read();
      const index = state.cases.findIndex((candidate) => candidate.metadata.id === caseId);
      if (index === -1) {
        return undefined;
      }

      const timestamp = nowIso(now);
      const snapshot = makeSnapshotFromCase(state.cases[index], input, timestamp, idFactory);
      const nextCase = clone(state.cases[index]);
      nextCase.versions = [snapshot, ...nextCase.versions];
      nextCase.metadata.updatedAt = timestamp;

      const nextCases = [...state.cases];
      nextCases[index] = nextCase;
      write(nextCases);
      return clone(snapshot);
    },
    lookupSnapshot(caseId: CaseMemoryId, snapshotId: CaseMemoryId): CaseSnapshotRestore | undefined {
      const savedCase = read().cases.find((candidate) => candidate.metadata.id === caseId);
      const snapshot = savedCase?.versions.find((candidate) => candidate.id === snapshotId);
      if (!savedCase || !snapshot) {
        return undefined;
      }

      return {
        caseId,
        snapshotId,
        title: snapshot.title,
        fields: clone(snapshot.fields),
        tags: [...snapshot.tags],
        lastRun: clone(snapshot.lastRun),
        snapshot: clone(snapshot),
      };
    },
    restoreSnapshot(caseId: CaseMemoryId, snapshotId: CaseMemoryId, options: RestoreCaseSnapshotOptions = {}): SavedCase | undefined {
      const state = read();
      const index = state.cases.findIndex((candidate) => candidate.metadata.id === caseId);
      const savedCase = state.cases[index];
      const snapshot = savedCase?.versions.find((candidate) => candidate.id === snapshotId);
      if (!savedCase || !snapshot) {
        return undefined;
      }

      const timestamp = nowIso(now);
      const beforeRestore =
        options.createSnapshotBeforeRestore === false
          ? undefined
          : makeSnapshotFromCase(savedCase, { label: options.label ?? 'Before restore' }, timestamp, idFactory);
      const nextCase = clone(savedCase);
      nextCase.draft = snapshot.fields.draft;
      nextCase.content = snapshot.fields.content;
      nextCase.sources = clone(snapshot.fields.sources);
      nextCase.opponent = snapshot.fields.opponent;
      nextCase.rubric = snapshot.fields.rubric;
      nextCase.metadata.tags = [...snapshot.tags];
      nextCase.metadata.lastRun = clone(snapshot.lastRun);
      nextCase.metadata.updatedAt = timestamp;
      if (options.restoreTitle) {
        nextCase.metadata.title = snapshot.title;
      }
      if (beforeRestore) {
        nextCase.versions = [beforeRestore, ...nextCase.versions];
      }

      const nextCases = [...state.cases];
      nextCases[index] = nextCase;
      write(nextCases);
      return clone(nextCase);
    },
    exportJson(options: ExportCaseMemoryOptions = {}): string {
      return exportCaseMemoryJson(read(), options, now);
    },
    importJson(json: string, options: ImportCaseMemoryOptions = {}): CaseMemoryImportResult {
      try {
        const current = read();
        const incoming = parseCaseMemoryJson(json, now, idFactory);
        const result = mergeImportedCases(current.cases, incoming.cases, options, idFactory);
        const nextState = write(result.cases);

        return {
          imported: result.imported,
          replaced: result.replaced,
          skipped: result.skipped,
          renamed: result.renamed,
          errors: [],
          cases: nextState.cases.map(summarizeCase).sort(sortByUpdatedAt),
        };
      } catch (error) {
        return {
          imported: 0,
          replaced: 0,
          skipped: 0,
          renamed: 0,
          errors: [error instanceof Error ? error.message : 'Import failed.'],
          cases: read().cases.map(summarizeCase).sort(sortByUpdatedAt),
        };
      }
    },
  };
}

export const caseMemory = createCaseMemoryStore();

export function listSavedCases(): SavedCaseSummary[] {
  return caseMemory.listCases();
}

export function getSavedCase(id: CaseMemoryId): SavedCase | undefined {
  return caseMemory.getCase(id);
}

export function createSavedCase(input: CreateSavedCaseInput = {}): SavedCase {
  return caseMemory.createCase(input);
}

export function updateSavedCase(id: CaseMemoryId, input: UpdateSavedCaseInput): SavedCase | undefined {
  return caseMemory.updateCase(id, input);
}

export function deleteSavedCase(id: CaseMemoryId): boolean {
  return caseMemory.deleteCase(id);
}

export function createCaseSnapshot(caseId: CaseMemoryId, input: CreateCaseSnapshotInput = {}): CaseVersionSnapshot | undefined {
  return caseMemory.createSnapshot(caseId, input);
}

export function lookupCaseSnapshot(caseId: CaseMemoryId, snapshotId: CaseMemoryId): CaseSnapshotRestore | undefined {
  return caseMemory.lookupSnapshot(caseId, snapshotId);
}

export function restoreCaseSnapshot(
  caseId: CaseMemoryId,
  snapshotId: CaseMemoryId,
  options: RestoreCaseSnapshotOptions = {},
): SavedCase | undefined {
  return caseMemory.restoreSnapshot(caseId, snapshotId, options);
}

export function exportSavedCasesJson(options: ExportCaseMemoryOptions = {}): string {
  return caseMemory.exportJson(options);
}

export function importSavedCasesJson(json: string, options: ImportCaseMemoryOptions = {}): CaseMemoryImportResult {
  return caseMemory.importJson(json, options);
}
