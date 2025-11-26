export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  pathPrefix: string; // e.g., "novels/"
}

export interface Chapter {
  id: number;
  title: string;
  status: 'pending' | 'crawling' | 'success' | 'error';
  content?: string; // Markdown content
}

export interface NovelMetadata {
  title: string;
  author: string;
  description: string;
  totalChaptersEstimate: number;
  chapters: string[]; // List of chapter titles found initially
  sources?: string[]; // Source URLs from search grounding
}

export enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
}

export type AppState = 'setup' | 'search' | 'preview' | 'crawling' | 'finished';