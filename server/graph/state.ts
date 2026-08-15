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
  templateContent?: string;
  templatePath?: string;
  validationSummary: ValidationSummary;
  extractedContext?: ExtractedKnowledgeContext;
  parsedExcelData?: ParsedExcelData;
  isTemplateManuallyAttached?: boolean;
}

export interface GraphTraceEvent {
  node: string;
  status: "started" | "completed" | "failed" | "skipped";
  message: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  generatedIni?: GeneratedIniResult;
  generatedInis?: GeneratedIniResult[];
  trace?: GraphTraceEvent[];
}

export interface ParsedExcelData {
  modules: Record<string, any>[];
  edi: Record<string, any>[];
  document: Record<string, any>[];
  rawTextSummary: string;
}

export interface ExtractedKnowledgeContext {
  filename?: string;
  modules: string[];
  tradingPartner: string;
  tradingPartnerKey?: string;
  tradingPartnerName?: string;
  ediParsers?: string;
  ediCreators?: string;
  classifications?: string;
  subtypes?: string;
  validationFilenames?: string;
  documentTypes: string[];
  customMappings?: Record<string, string>;
  dictionary?: Record<string, string>;
  transactionMappings?: Record<string, Record<string, string>>;
  extractedJson?: any;
  validationRows?: { docType: string; valFilename: string; valDescription: string; originalRow?: any }[];
}

export interface MappingField {
  id: string;
  iniName: string;
  excelName: string;
  prompt: string;
  examples: string;
}

export interface TextMappings {
  globalMappings: MappingField[];
  tabularMappings: MappingField[];
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
  generatedInis?: GeneratedIniResult[];
  filename: string | null;
  validationResult: ValidationSummary | null;
  userRequest: string;
  currentNode: string;
  traceLog: GraphTraceEvent[];
  needsExcelUpload: boolean;
  isGeneralQuestion: boolean;
  generalAnswer?: string;
  textMappings?: TextMappings;
  isTemplateManuallyAttached?: boolean;
}
