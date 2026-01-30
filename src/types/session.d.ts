export interface QiniuConfig {
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
  prefix?: string;
  downloadDomain?: string;
}

export interface SessionMeta {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  device: string;
  projectPath?: string;
  messageCount: number;
  version: number;
  hash?: string;
}

export type SessionRole = 'user' | 'assistant' | 'system';

export interface SessionMessage {
  id: string;
  role: SessionRole;
  content: string;
  createdAt: string;
}

export interface SessionFileRef {
  path: string;
  sha256?: string;
  sizeBytes?: number;
}

export interface SessionContext {
  projectPath?: string;
  files?: SessionFileRef[];
  activeFiles?: string[];
  notes?: string;
}

export interface SessionPayload {
  meta: SessionMeta;
  messages: SessionMessage[];
  context: SessionContext;
}
