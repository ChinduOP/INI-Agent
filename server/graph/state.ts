export interface Attachment {
  name: string;
  size: number;
  path: string;
}

export interface ValidationSummary {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingKeysCount: number;
  todoCount: number;
}

export interface GeneratedIniResult {
  filename: string;
  content: string;
  validationSummary: ValidationSummary;
}

export interface GraphTraceEvent {
  node: string;
  status: 'started' | 'completed' | 'failed' | 'skipped';
  message: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  generatedIni?: GeneratedIniResult;
  trace?: GraphTraceEvent[];
}

export interface ParsedExcelData {
  modules: Record<string, any>[];
  edi: Record<string, any>[];
  document: Record<string, any>[];
  rawTextSummary: string;
}

export interface ExtractedKnowledgeContext {
  modules: string[];
  tradingPartner: string;
  documentTypes: string[];
  ediSettings: Record<string, any>;
  ids: Record<string, any>;
  qualifiers: Record<string, any>;
  paths: Record<string, any>;
  protocols: string[];
  delimiters: Record<string, string>;
  version: string;
  additionalBusinessRules: string[];
}

export interface LangGraphState {
  chatHistory: ChatMessage[];
  uploadedExcelPath: string | null;
  uploadedExcelName: string | null;
  parsedExcelData: ParsedExcelData | null;
  extractedContext: ExtractedKnowledgeContext | null;
  selectedTemplatePath: string | null;
  templateText: string | null;
  generatedINI: string | null;
  filename: string | null;
  validationResult: ValidationSummary | null;
  userRequest: string;
  currentNode: string;
  traceLog: GraphTraceEvent[];
  needsExcelUpload: boolean;
  isGeneralQuestion: boolean;
  generalAnswer?: string;
}
