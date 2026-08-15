import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { ChatMessage, ExtractedKnowledgeContext, ParsedExcelData, TextMappings } from '../graph/state.js';
import { SYSTEM_PROMPT } from '../prompts/system_prompt.js';
import { INSTRUCTIONS } from '../prompts/instructions.js';
import { CHAT_PROMPT } from '../prompts/chat_prompt.js';
import { ANALYZER_PROMPT } from '../prompts/analyzer_prompt.js';
import { GENERATOR_PROMPT } from '../prompts/generator_prompt.js';
import { ExcelService } from './excel_service.js';

export class LlmService {
  public static robustParseJson(text: string): any {
    let clean = text.trim();

    // 1. Direct parse attempt
    try {
      return JSON.parse(clean);
    } catch (e) {
      // Continue to extraction strategies
    }

    // 2. Remove markdown code blocks if present (e.g. ```json ... ``` or ``` ... ```)
    const codeBlockMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) {
      const innerContent = codeBlockMatch[1].trim();
      try {
        return JSON.parse(innerContent);
      } catch (e) {
        clean = innerContent; // use inner content for further extraction
      }
    }

    // 3. Scan for any valid JSON object {...} or array [...] in the text from left to right
    for (let i = 0; i < clean.length; i++) {
      const char = clean[i];
      if (char === '{' || char === '[') {
        const closingChar = char === '{' ? '}' : ']';
        const lastIdx = clean.lastIndexOf(closingChar);
        if (lastIdx > i) {
          const candidate = clean.substring(i, lastIdx + 1);
          try {
            return JSON.parse(candidate);
          } catch (e) {
            // Try relaxed cleanup on candidate
            try {
              const relaxed = candidate
                .replace(/,\s*([}\]])/g, '$1') // remove trailing commas
                .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":') // ensure double quotes on keys
                .replace(/:\s*'([^']*)'/g, ':"$1"'); // convert single quotes to double quotes
              return JSON.parse(relaxed);
            } catch (e2) {
              // Try next opening brace
            }
          }
        }
      }
    }

    throw new Error(`Failed to parse JSON response from LLM. Raw response was: ${text}`);
  }

  private static cleanEnvVar(val: string | undefined): string | undefined {
    if (!val) return undefined;
    let s = val.trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.substring(1, s.length - 1).trim();
    }
    return s;
  }

  private static getAiClient(): OpenAI | null {
    const rawKey = process.env.OPENAI_API_KEY;
    const rawBaseURL = process.env.OPENAI_BASE_URL;
    
    const key = this.cleanEnvVar(rawKey) || (this.cleanEnvVar(rawBaseURL) ? 'sk-dummy-key' : '');
    if (!key) return null;
    
    let baseURL = this.cleanEnvVar(rawBaseURL) || undefined;
    if (baseURL) {
      // Normalize if user provided the full completion endpoint instead of the base URL
      if (baseURL.endsWith('/chat/completions')) {
        baseURL = baseURL.substring(0, baseURL.length - '/chat/completions'.length);
      } else if (baseURL.endsWith('/chat/completions/')) {
        baseURL = baseURL.substring(0, baseURL.length - '/chat/completions/'.length);
      }
    }
    
    // Log safe config details to assist user local debugging
    const maskedKey = key === 'sk-dummy-key' ? 'sk-dummy-key' : (key.length > 8 ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : '***');
    console.log(`[LlmService] Initializing OpenAI Client - Base URL: "${baseURL || 'https://api.openai.com/v1'}", API Key: "${maskedKey}"`);
    
    return new OpenAI({ 
      apiKey: key,
      baseURL
    });
  }

  private static getModelName(): string {
    const model = this.cleanEnvVar(process.env.OPENAI_MODEL);
    return model || 'llama-3.3-70b';
  }

  private static getKnowledgeBase(): string {
    try {
      const kbPath = path.join(process.cwd(), 'knowledge-base.md');
      if (fs.existsSync(kbPath)) {
        return fs.readFileSync(kbPath, 'utf-8');
      }
    } catch (e) {
      console.error('Error reading knowledge base:', e);
    }
    return '';
  }

  public static async testConnection(): Promise<{ success: boolean; message: string }> {
    const ai = this.getAiClient();
    const key = this.cleanEnvVar(process.env.OPENAI_API_KEY);
    const baseURL = this.cleanEnvVar(process.env.OPENAI_BASE_URL);
    
    if (!ai || (!key && !baseURL)) {
      return { success: false, message: "Missing OpenAI API Key (OPENAI_API_KEY)" };
    }
    
    const model = this.getModelName();
    try {
      console.log(`[LlmService] Testing connection to ${baseURL || 'https://api.openai.com/v1'} using model "${model}"...`);
      // Small test request to verify config
      await ai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1
      });
      console.log(`[LlmService] Connection test successful!`);
      return { success: true, message: "AI connection successful" };
    } catch (e: any) {
      console.error(`[LlmService] Connection test failed for model "${model}":`, e);
      return { success: false, message: e.message || "Failed to connect to OpenAI service" };
    }
  }

  private static async callLLMWithRetry(ai: OpenAI, config: any, retries = 3, delayMs = 2000): Promise<any> {
    let currentConfig = { ...config };
    
    for (let i = 0; i < retries; i++) {
      try {
        return await ai.chat.completions.create(currentConfig);
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        
        // Custom models often fail when "response_format" is used (400 Bad Request / Not Supported).
        // If that happens, strip "response_format" and try again immediately.
        if (currentConfig.response_format && (
          errorMsg.toLowerCase().includes('response_format') ||
          errorMsg.toLowerCase().includes('json_object') ||
          errorMsg.toLowerCase().includes('format') ||
          err?.status === 400
        )) {
          console.warn(`LLM failed with response_format error. Retrying without response_format... Error: ${errorMsg}`);
          delete currentConfig.response_format;
          try {
            return await ai.chat.completions.create(currentConfig);
          } catch (retryErr: any) {
            err = retryErr;
          }
        }

        const isRetryable = errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE') || errorMsg.includes('429') || errorMsg.includes('high demand') || errorMsg.includes('TOO_MANY_REQUESTS') || errorMsg.includes('rate_limit');
        
        if (i === retries - 1 || !isRetryable) {
          throw err;
        }
        console.warn(`LLM call failed (retry ${i + 1}/${retries}). Waiting ${delayMs}ms... Error: ${errorMsg}`);
        await new Promise(r => setTimeout(r, delayMs));
        delayMs *= 2; // exponential backoff
      }
    }
  }

  public static async classifyIntentAndChat(
    userRequest: string,
    hasExcel: boolean,
    chatHistory: ChatMessage[]
  ): Promise<{ intent: 'generate_ini' | 'general_chat', response?: string }> {
    const ai = this.getAiClient();
    if (!ai) {
      return { intent: 'generate_ini' };
    }

    const chatHistoryStr = chatHistory.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n');
    const prompt = CHAT_PROMPT
      .replace('{{CHAT_HISTORY}}', chatHistoryStr)
      .replace('{{USER_REQUEST}}', userRequest)
      .replace('{{HAS_EXCEL}}', String(hasExcel));

    try {
      const response = await this.callLLMWithRetry(ai, {
        model: this.getModelName(),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      let content = response.choices[0].message.content || '{}';
      const parsed = LlmService.robustParseJson(content);
      if (parsed && (parsed.intent === 'general_chat' || parsed.intent === 'generate_ini')) {
        return { intent: parsed.intent, response: parsed.response };
      }
    } catch (e: any) {
      console.warn('Failed LLM intent classification, defaulting to generate_ini:', e);
      return { intent: 'generate_ini' };
    }
    return { intent: 'generate_ini' };
  }

  private static processDictionaryLine(content: string, terms: Record<string, string>) {
    let stripped = content.replace(/^[-*•]\s*/, '').trim();
    if (stripped.toLowerCase().startsWith('map ') || stripped.toLowerCase().startsWith('set ')) {
      stripped = stripped.replace(/^(?:map|set)\s+/i, '').replace(/\s+(?:to|as)\s+/i, '=');
    }

    let sep = '=';
    let parts: string[] = [];
    if (stripped.includes('=')) {
      parts = stripped.split('=');
      sep = '=';
    } else if (stripped.includes(':') && !stripped.startsWith('http')) {
      parts = stripped.split(':');
      sep = ':';
    }

    if (parts.length >= 2) {
      let key = parts[0].trim();
      let val = parts.slice(1).join(sep).trim();
      key = key.replace(/^["']|["']$/g, '').trim();
      val = val.replace(/^["']|["']$/g, '').trim();
      if (key && val && !key.startsWith('(') && !val.startsWith('(') && key.length > 1) {
        terms[key] = val;
      }
    }
  }

  public static extractDictionaryTermsFromString(text: string, isUserRequest: boolean = false): Record<string, string> {
    const terms: Record<string, string> = {};
    if (!text) return terms;

    // 1. Extract JSON fragments (e.g. {"Vendor ID": "Column B"})
    try {
      const jsonMatches = text.match(/\{[^{}]+\}/g);
      if (jsonMatches) {
        for (const j of jsonMatches) {
          try {
            const parsed = JSON.parse(j);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
              for (const [k, v] of Object.entries(parsed)) {
                if (typeof v === 'string' || typeof v === 'number') {
                  terms[k.trim()] = String(v).trim();
                }
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {}

    const lines = text.split(/\r?\n/);
    let inDict = isUserRequest;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const upper = trimmed.toUpperCase();

      // Look for dictionary headers - more permissive
      if (
        upper.includes('TERMINOLOGY') ||
        upper.includes('DICTIONARY') ||
        upper.includes('TEXT MAPPING') ||
        upper.includes('DYNAMIC MAPPING') ||
        upper.includes('CUSTOM KEYS') ||
        upper.includes('MAPPING RULES') ||
        upper.includes('CUSTOM MAPPING') ||
        upper.includes('MAPPINGS')
      ) {
        inDict = true;
        // Check if there's a mapping on the same line after a colon
        if (trimmed.includes(':')) {
          const afterColon = trimmed.split(':').slice(1).join(':').trim();
          if (afterColon && (afterColon.includes('=') || (afterColon.includes(':') && !afterColon.startsWith('http')))) {
            this.processDictionaryLine(afterColon, terms);
          }
        }
        continue;
      }

      // If we are in a dictionary block, look for patterns or stop if we hit a very clear new major section
      // We'll be more conservative with "stop" triggers to avoid missing terms
      if (!isUserRequest && inDict) {
        const isStopHeader = /^(RULES|INSTRUCTIONS|ALWAYS|NEVER|EXAMPLES):$/i.test(trimmed);
        if (isStopHeader && !upper.includes('DICTIONARY') && !upper.includes('MAPPING')) {
          inDict = false;
          continue;
        }
      }

      if (inDict) {
        this.processDictionaryLine(trimmed, terms);
      }
    }
    return terms;
  }

  public static getDictionaryTerms(userRequest?: string, textMappings?: TextMappings, templateText?: string): Record<string, string> {
    const terms: Record<string, string> = {};
    
    // 0. Extract all bracketed placeholders from the template text to ensure they are parsed as dictionary terms (High Priority)
    if (templateText) {
      const bracketRegex = /\{([^}]+)\}/g;
      let match;
      while ((match = bracketRegex.exec(templateText)) !== null) {
        const term = match[1].trim();
        const lowerTerm = term.toLowerCase();
        if (term && lowerTerm !== 'todo' && !lowerTerm.includes('tp activation key') && !lowerTerm.includes('tp display name') && !lowerTerm.includes('class name')) {
          terms[term] = `Extract the exact data value for template placeholder "${term}" from the Excel worksheets (e.g. from validation file or validation description columns).`;
        }
      }
    }
    
    // 0.5 Add custom mappings from the Text Mapping UI first (Highest Priority)
    if (textMappings) {
      const allFields = [
        ...(textMappings.globalMappings || []),
        ...(textMappings.tabularMappings || [])
      ];
      
      allFields.forEach(f => {
        // Strip braces and handle comma-separated aliases
        const rawNames = f.iniName.split(',').map(n => n.trim());
        const cleanNames = rawNames.map(n => n.replace(/[{}]/g, '').trim());
        const primaryKey = cleanNames[0];
        
        if (primaryKey && (f.excelName || f.prompt)) {
          let instruction = f.prompt || `Extract value for ${primaryKey}`;
          if (f.excelName) instruction += ` (Search columns like: "${f.excelName}")`;
          if (f.examples) instruction += `. Expected format/examples: ${f.examples}`;
          
          // If there are aliases, tell the AI that they refer to the same thing
          if (cleanNames.length > 1) {
            instruction = `[ALSO KNOWN AS: ${cleanNames.slice(1).join(', ')}] ` + instruction;
          }
          
          terms[primaryKey] = instruction;
        }
      });
    }

    const sysTerms = this.extractDictionaryTermsFromString(SYSTEM_PROMPT, false);
    Object.assign(terms, sysTerms);
    
    const anaTerms = this.extractDictionaryTermsFromString(ANALYZER_PROMPT, false);
    Object.assign(terms, anaTerms);
    
    if (userRequest) {
      const reqTerms = this.extractDictionaryTermsFromString(userRequest, true);
      Object.assign(terms, reqTerms);
    }
    
    console.log("[LlmService] getDictionaryTerms extracted:", terms);
    return terms;
  }

  /**
   * Node 3: Excel Analyzer
   * Uses OpenAI LLM (or robust deterministic fallback if API key not present)
   * to analyze workbook worksheets and synthesize ExtractedKnowledgeContext.
   */
  public static async analyzeWorkbook(data: ParsedExcelData, userRequest: string, textMappings?: TextMappings, templateText?: string): Promise<ExtractedKnowledgeContext> {
    const baseContext = this.heuristicAnalyze(data, userRequest, templateText);
    const ai = this.getAiClient();

    if (!ai) {
      return {
        ...baseContext,
        extractedJson: ExcelService.extractExcelToJson(data)
      };
    }

    try {
      const dict = LlmService.getDictionaryTerms(userRequest, textMappings, templateText);
      const dictKeysList = Object.keys(dict);
      let customSchemaStr = "";
      let dictInstructionStr = "";

      if (dictKeysList.length > 0) {
        dictInstructionStr = `\nCRITICAL TERMINOLOGY DICTIONARY MAPPINGS TO EXTRACT:\n` +
          Object.entries(dict).map(([k, v]) => `- "${k}": ${v}`).join('\n') +
          `\nFor each dictionary mapping above, analyze the Excel sheets and extract the matching value. 
IMPORTANT: 
1. DO NOT return the column name or header as the value.
2. DO NOT return the instruction itself as the value.
3. Extract the ACTUAL DATA value found in the rows/cells.
4. If the instruction says "split value" or "text to the left", perform that logic mentally and return the result.
5. If you find a generic "Trading Partner Name" or "Partner", use it as a fallback for "tp description" or "tp display name" if no more specific description exists.
6. Put the final extracted values in the "customMappings" JSON object in your response. 
7. Ensure all keys from the dictionary are present in "customMappings". 
8. Use "N/A" only as a last resort if the data is truly missing.`;
        
        customSchemaStr = `,\n  "customMappings": {\n` +
          dictKeysList.map(k => `    "${k}": "extracted REAL value or 'N/A'"`).join(',\n') +
          `\n  }`;
      }

      const prompt = ANALYZER_PROMPT
        .replace('{{USER_REQUEST}}', userRequest)
        .replace('{{DICT_INSTRUCTIONS}}', dictInstructionStr)
        .replace('{{EXCEL_SUMMARY}}', data.rawTextSummary)
        .replace('{{CUSTOM_SCHEMA}}', customSchemaStr);

      const response = await this.callLLMWithRetry(ai, {
        model: this.getModelName(),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const text = response.choices[0].message.content || '';
      const json = LlmService.robustParseJson(text);
      
      // Sync standard fields if they are present in customMappings with similar names
      if (json.customMappings) {
        const custom = json.customMappings;
        Object.keys(custom).forEach(k => {
          const nk = k.toLowerCase().replace(/[\s_\-\.]/g, '');
          const val = String(custom[k]);
          if (val && val !== 'N/A') {
            if (nk === 'tpkey' || nk === 'tradingpartnerkey') json.tradingPartnerKey = val;
            if (nk === 'tpname' || nk === 'tradingpartnername' || nk === 'partnername') json.tradingPartnerName = val;
          }
        });
      }

      console.log("[LlmService] analyzeWorkbook - raw text:", text);
      console.log("[LlmService] analyzeWorkbook - parsed json:", JSON.stringify(json));

      // Sanitize JSON response to only allowed keys
      const allowedKeys = [
        "filename", "tradingPartnerKey", "tradingPartnerName", "ediParsers", 
        "ediCreators", "classifications", "subtypes", "validationFilenames", 
        "modules", "tradingPartner", "documentTypes", "customMappings",
        "transactionMappings", "extractedJson"
      ];
      const sanitizedJson: any = {};
      allowedKeys.forEach(k => {
        if (json[k] !== undefined) sanitizedJson[k] = json[k];
      });

      const finalContext: ExtractedKnowledgeContext = {
        ...baseContext,
        ...sanitizedJson,
        documentTypes: sanitizedJson.documentTypes && sanitizedJson.documentTypes.length > 0 ? sanitizedJson.documentTypes : baseContext.documentTypes,
        customMappings: { ...baseContext.customMappings, ...(sanitizedJson.customMappings || {}) },
        filename: sanitizedJson.filename || baseContext.filename,
        dictionary: dict,
        extractedJson: ExcelService.extractExcelToJson(data)
      };

      // Final strict removal of unwanted keys to ensure they never leak
      const unwantedKeys = ["ediSettings", "ids", "qualifiers", "paths", "protocols", "delimiters", "version", "additionalBusinessRules"];
      unwantedKeys.forEach(k => {
        delete (finalContext as any)[k];
      });

      return finalContext;
    } catch (err: any) {
      console.warn('Error in LLM workbook analysis, falling back to heuristic:', err);
      return {
        ...baseContext,
        extractedJson: ExcelService.extractExcelToJson(data)
      };
    }
  }

  /**
   * Node 6 & 7: INI Generator & Filename Generator
   * Populates the INI template preserving exact formatting, blank lines, and comments.
   * Unknown values become TODO.
   */
  public static async generateIniFromTemplate(
    templateText: string,
    templateFilename: string,
    context: ExtractedKnowledgeContext,
    userRequest: string,
    parsedExcelData: ParsedExcelData | null
  ): Promise<{ filename: string; content: string }[]> {
    const templateFullPath = templateFilename;
    const filenamePart = templateFilename.split('/').pop() || templateFilename;
    templateFilename = filenamePart;

    const lowerFullPath = templateFullPath.toLowerCase();
    const lowerFilename = templateFilename.toLowerCase();
    const lowerText = templateText.toLowerCase();

    // 1. First, detect if it is a Validation/Schema template
    const isValidationTemplate = 
      lowerFilename.includes('validation') || 
      lowerFilename.includes('schema') || 
      templateFilename.includes('{mnemonic}') ||
      lowerText.includes('validation') || 
      lowerText.includes('schema') || 
      templateText.includes('{Document_Validation File}') ||
      templateText.includes('{Document_ValidationDescription}');

    // Helper placeholder-based detection
    const hasEdiPlaceholders = 
      templateText.includes('{EDI_') || 
      templateText.includes('{Var_Edi') || 
      templateText.includes('{Var_EDI') || 
      lowerText.includes('{edi_') || 
      lowerText.includes('[edi_envelope]');

    const hasDocumentPlaceholders = 
      templateText.includes('{Document_') || 
      lowerText.includes('{document_') || 
      lowerText.includes('[document_routing]');

    // 2. Detect if it is an EDI Batch Profile template (associated with EDI sheet)
    const isEdiBatchProfileTemplate = !isValidationTemplate && (
      (hasEdiPlaceholders && !hasDocumentPlaceholders) ||
      (
        !hasDocumentPlaceholders && (
          lowerFullPath.includes('/edibatch/') ||
          lowerFullPath.includes('profiles/edibatch') ||
          lowerFullPath.includes('/edi/') ||
          (lowerFilename.includes('edi') && (lowerFilename.includes('batch') || lowerFilename.includes('profile'))) ||
          lowerFilename.includes('envelope') ||
          ((lowerFilename.startsWith('in.') || lowerFilename.startsWith('out.')) && !lowerFilename.includes('routing') && !lowerFilename.includes('document'))
        )
      )
    );

    // 3. Detect if it is a Document INI template (associated with Document sheet)
    const isDocumentIniTemplate = !isValidationTemplate && !isEdiBatchProfileTemplate && (
      hasDocumentPlaceholders ||
      lowerFullPath.includes('/documents/') || 
      lowerFullPath.includes('profiles/documents') ||
      lowerFullPath.includes('/document/') ||
      lowerFilename.includes('routing') ||
      lowerFilename.includes('document')
    );

    if (isDocumentIniTemplate) {
      const documentRows: any[] = [];
      
      // 1. Extract Document rows from context.extractedJson
      if (context.extractedJson && Array.isArray(context.extractedJson)) {
        const docSheet = context.extractedJson.find((s: any) => s && s.Sheet === 'Document');
        if (docSheet) {
          const inRows = docSheet.Document_Direction_In || [];
          const outRows = docSheet.Document_Direction_Out || [];
          inRows.forEach((r: any) => {
            documentRows.push({ ...r, Document_Direction: 'IN' });
          });
          outRows.forEach((r: any) => {
            documentRows.push({ ...r, Document_Direction: 'OUT' });
          });
        }
      }
      
      // Fallback: extract from parsedExcelData.document
      if (documentRows.length === 0 && parsedExcelData && parsedExcelData.document && Array.isArray(parsedExcelData.document)) {
        parsedExcelData.document.forEach(row => {
          const getVal = (r: any, candidateKeys: string[]): string => {
            for (const ck of candidateKeys) {
              const normCk = ck.toLowerCase().replace(/[\s\_\-\[\]\(\)\/\\|]/g, '');
              const foundKey = Object.keys(r).find(rk => rk.toLowerCase().replace(/[\s\_\-\[\]\(\)\/\\|]/g, '') === normCk);
              if (foundKey && r[foundKey] !== undefined && r[foundKey] !== null) {
                return String(r[foundKey]).trim();
              }
            }
            return '';
          };
          
          const filenameVal = getVal(row, ["Document_Filename", "Filename", "File_Name", "FileName"]) || "";
          const dirVal = getVal(row, ["Document_Direction", "Direction", "Dir", "Document_Dir"]).trim().toUpperCase();
          const docVal = getVal(row, ["Document_Document", "Document", "Doc"]) || "";
          const classificationVal = getVal(row, ["Document_Classification", "Classification"]) || "";
          const functionVal = getVal(row, ["Document_Function", "Function"]) || "";
          const subtypeVal = getVal(row, ["Document_Subtype", "Subtype"]) || "";
          const keyVal = getVal(row, ["Document_Key", "Key"]) || "";
          const profileLookupVal = getVal(row, ["Document_ProfileLookup", "ProfileLookup"]) || "";
          const channelVal = getVal(row, ["Document_Channel", "Channel"]) || "";
          
          if (filenameVal && filenameVal !== 'N/A') {
            documentRows.push({
              Document_Filename: filenameVal,
              Document_Direction: dirVal.includes('OUT') ? 'OUT' : 'IN',
              Document_Document: docVal,
              Document_Classification: classificationVal,
              Document_Function: functionVal,
              Document_Subtype: subtypeVal,
              Document_Key: keyVal,
              Document_ProfileLookup: profileLookupVal,
              Document_Channel: channelVal,
              originalRow: row
            });
          }
        });
      }

      // Filter rows based on template file name or user request direction
      const isTemplateInbound = templateFilename.toLowerCase().startsWith('in.') || 
                                templateFilename.toLowerCase().includes('inbound') || 
                                templateFilename.toLowerCase().includes('in_') ||
                                userRequest.toLowerCase().includes('inbound');
                                
      const isTemplateOutbound = templateFilename.toLowerCase().startsWith('out.') || 
                                 templateFilename.toLowerCase().includes('outbound') || 
                                 templateFilename.toLowerCase().includes('out_') ||
                                 userRequest.toLowerCase().includes('outbound');
                                 
      let targetRows = documentRows;
      if (isTemplateInbound && !isTemplateOutbound) {
        targetRows = documentRows.filter(r => r.Document_Direction === 'IN');
      } else if (isTemplateOutbound && !isTemplateInbound) {
        targetRows = documentRows.filter(r => r.Document_Direction === 'OUT');
      }

      // If still empty, fall back to all document rows
      if (targetRows.length === 0) {
        targetRows = documentRows;
      }

      // Generate an INI file for each target row
      const generatedFiles = targetRows.map(row => {
        let genFilename = row.Document_Filename || 'generated_routing.ini';
        if (!genFilename.toLowerCase().endsWith('.ini')) {
          genFilename += '.ini';
        }

        const rowContext: ExtractedKnowledgeContext = {
          ...context,
          dictionary: undefined,
          validationRows: undefined,
          documentTypes: [row.Document_Document],
          customMappings: {
            ...context.customMappings,
            ...row,
            'Document_Direction_In': row.Document_Document,
            'Document_Direction_Out': row.Document_Document,
            'document_direction_in': row.Document_Document,
            'document_direction_out': row.Document_Document,
            'TP.PACK-ISO': context.tradingPartnerKey || 'TRADER.JOES-US',
            'tp.pack-iso': context.tradingPartnerKey || 'TRADER.JOES-US',
            'tppackiso': context.tradingPartnerKey || 'TRADER.JOES-US'
          }
        };

        const result = LlmService.heuristicPopulate(templateText, templateFilename, rowContext, parsedExcelData, false, true);
        result.filename = genFilename;
        return result;
      });

      return generatedFiles;
    }

    if (isValidationTemplate) {
      interface TargetRow {
        docType: string;
        valFilename: string;
        valDescription: string;
        originalRow?: any;
      }

      // 1. Gather all validation rows
      const validationRows = context.validationRows || [];
      const hasAnyValFilename = validationRows.some(r => r.valFilename && r.valFilename.trim() !== '');
      
      const seen = new Set<string>();
      const uniqueValidationRows: TargetRow[] = [];
      
      validationRows.forEach(r => {
        if (hasAnyValFilename) {
          if (!r.valFilename || r.valFilename.trim() === '') return;
          const key = r.valFilename.toLowerCase().trim();
          if (!seen.has(key)) {
            seen.add(key);
            uniqueValidationRows.push({
              docType: r.docType,
              valFilename: r.valFilename.trim(),
              valDescription: r.valDescription ? r.valDescription.trim() : '',
              originalRow: r.originalRow
            });
          }
        } else {
          const key = r.docType.toLowerCase().trim();
          if (!seen.has(key)) {
            seen.add(key);
            uniqueValidationRows.push({
              docType: r.docType,
              valFilename: r.valFilename ? r.valFilename.trim() : '',
              valDescription: r.valDescription ? r.valDescription.trim() : '',
              originalRow: r.originalRow
            });
          }
        }
      });

      // 2. Check if a specific document type or all document types are requested
      let targetRows: TargetRow[] = uniqueValidationRows;
      const lowerReq = userRequest.toLowerCase();
      const isAllRequested = lowerReq.includes('all') || lowerReq.includes('every');

      if (!isAllRequested) {
        // Try to match specific docType number
        const userDocMatch = userRequest.match(/\b(810|812|820|824|830|832|846|850|852|855|856|860|864|867|870|940|945|997)\b/i);
        let targetDoc = userDocMatch ? userDocMatch[1] : '';

        if (!targetDoc) {
          // Check common phrase mappings
          if (lowerReq.includes('order response') || lowerReq.includes('po ack') || lowerReq.includes('acknowledgement') || lowerReq.includes('acknowledgment')) targetDoc = '855';
          else if (lowerReq.includes('purchase order') || lowerReq.includes('po')) targetDoc = '850';
          else if (lowerReq.includes('invoice')) targetDoc = '810';
          else if (lowerReq.includes('ship notice') || lowerReq.includes('asn')) targetDoc = '856';
          else if (lowerReq.includes('functional ack')) targetDoc = '997';
          else if (lowerReq.includes('warehouse order') || lowerReq.includes('shipping order')) targetDoc = '940';
          else if (lowerReq.includes('shipping advice')) targetDoc = '945';
          else if (lowerReq.includes('inventory')) targetDoc = '846';
        }

        if (targetDoc) {
          const filtered = uniqueValidationRows.filter(r => 
            r.docType === targetDoc || 
            r.docType.toLowerCase().includes(targetDoc) ||
            r.valFilename.toLowerCase().includes(targetDoc) ||
            r.valDescription.toLowerCase().includes(targetDoc)
          );
          if (filtered.length > 0) {
            targetRows = filtered;
          } else {
            targetRows = [{
              docType: targetDoc,
              valFilename: `${context.tradingPartner}_${targetDoc}`,
              valDescription: `${context.tradingPartner} ${targetDoc} Validation`
            }];
          }
        } else {
          // Check if user request matches any docType name, valDescription, or valFilename in uniqueValidationRows
          const matchingRows = uniqueValidationRows.filter(r => {
            const dt = r.docType ? r.docType.toLowerCase() : '';
            const desc = r.valDescription ? r.valDescription.toLowerCase() : '';
            const fn = r.valFilename ? r.valFilename.toLowerCase() : '';
            return (dt && lowerReq.includes(dt)) || (desc && lowerReq.includes(desc)) || (fn && lowerReq.includes(fn));
          });
          if (matchingRows.length > 0) {
            targetRows = matchingRows;
          }
        }
      }

      // If still empty, fall back to the context's document types
      if (targetRows.length === 0) {
        const docTypes = context.documentTypes && context.documentTypes.length > 0 ? context.documentTypes : ['850'];
        docTypes.forEach(dt => {
          targetRows.push({
            docType: dt,
            valFilename: `${context.tradingPartner}_${dt}`,
            valDescription: `${context.tradingPartner} ${dt} Validation`
          });
        });
      }

      // 3. Generate INI files for each target row
      const ai = this.getAiClient();

      // Cache of promises to reuse LLM-generated template structure for each unique docType
      const mergedContentPromiseCache = new Map<string, Promise<string>>();

      const getMergedContent = (docType: string, rowContext: ExtractedKnowledgeContext): Promise<string> => {
        let p = mergedContentPromiseCache.get(docType);
        if (!p) {
          p = (async () => {
            if (!ai) throw new Error('No AI client');
            const knowledgeBase = this.getKnowledgeBase();
            const prompt = GENERATOR_PROMPT
              .replace('{{SYSTEM_RULES}}', INSTRUCTIONS)
              .replace('{{KNOWLEDGE_BASE}}', knowledgeBase)
              .replace('{{EXTRACTED_KNOWLEDGE_CONTEXT}}', JSON.stringify(rowContext, null, 2))
              .replace('{{EXCEL_SUMMARY}}', parsedExcelData ? JSON.stringify(LlmService.buildLookupPool(rowContext, parsedExcelData, 'validation'), null, 2) : 'No Excel data provided.')
              .replace('{{USER_REQUEST}}', `Generate validation INI for document type ${docType}`)
              .replace('{{TEMPLATE_FILENAME}}', templateFilename)
              .replace('{{TEMPLATE_TEXT}}', templateText);

            const response = await this.callLLMWithRetry(ai, {
              model: this.getModelName(),
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt }
              ],
              response_format: { type: 'json_object' }
            });

            const parsedResponse = LlmService.robustParseJson(response.choices[0].message.content || '[]');
            const parsed = Array.isArray(parsedResponse) ? parsedResponse[0] : parsedResponse;
            const content = parsed?.content || templateText;
            return LlmService.mergeGeneratedWithTemplate(templateText, content);
          })();
          mergedContentPromiseCache.set(docType, p);
        }
        return p;
      };

      const generatedFiles = await Promise.all(targetRows.map(async (vRow) => {
        const additionalMappings: any = {};
        if (vRow.originalRow) {
          Object.entries(vRow.originalRow).forEach(([k, v]) => {
            additionalMappings[k] = v;
          });
        }

        const rowContext: ExtractedKnowledgeContext = {
          ...context,
          dictionary: undefined, // Remove dictionary instructions so LLM doesn't confuse them as values
          validationRows: undefined, // Remove the entire array so it doesn't pick the first one
          documentTypes: [vRow.docType],
          customMappings: {
            ...context.customMappings,
            ...additionalMappings,
            'Document_Validation File': vRow.valFilename,
            'Document_ValidationFile': vRow.valFilename,
            'Document Validation File': vRow.valFilename,
            'Document_Validation_File': vRow.valFilename,
            'document_validationfile': vRow.valFilename,
            'Validation Description': vRow.valDescription,
            'ValidationDescription': vRow.valDescription,
            'validationdescription': vRow.valDescription,
            'Document_Validation Description': vRow.valDescription,
            'Document Validation Description': vRow.valDescription,
            'Document_Validation_Description': vRow.valDescription,
          }
        };

        // Determine filename
        let genFilename = '';
        if (vRow.valFilename && vRow.valFilename.trim() !== '') {
          genFilename = vRow.valFilename.trim();
        } else if (templateFilename.includes('{') && templateFilename.includes('}')) {
          // Resolve placeholder filename
          let f = templateFilename;
          const tpKey = context.tradingPartnerKey || 'TRADER.JOES-US';
          const partner = context.tradingPartner || '';
          let mnemonic = 'DOC';
          if (vRow.docType === '850') mnemonic = 'ORD';
          else if (vRow.docType === '855') mnemonic = 'ACK';
          else if (vRow.docType === '856') mnemonic = 'ASN';
          else if (vRow.docType === '810') {
            const valFile = (vRow.valFilename || '').toLowerCase();
            if (valFile.includes('crn') || valFile.includes('credit')) {
              mnemonic = 'CRN';
            } else {
              mnemonic = 'INV';
            }
          } else if (vRow.docType === '820') mnemonic = 'PAY';
          else if (vRow.docType === '824') mnemonic = 'APP';
          else if (vRow.docType === '830') mnemonic = 'SCH';
          else if (vRow.docType === '832') mnemonic = 'CAT';
          else if (vRow.docType === '846') mnemonic = 'INV';
          else if (vRow.docType === '852') mnemonic = 'ACT';
          else if (vRow.docType === '860') mnemonic = 'CHG';
          else if (vRow.docType === '864') mnemonic = 'TXT';
          else if (vRow.docType === '997') mnemonic = 'FA';

          f = f.replace(/\{mnemonic\}/gi, mnemonic);
          f = f.replace(/\{activation[\s\_]?key\}/gi, tpKey);
          f = f.replace(/\{trading[\s\_]?partner\}/gi, partner);
          f = f.replace(/\{doctype\}/gi, vRow.docType);
          f = f.replace(/\{doc[\s\_]?type\}/gi, vRow.docType);

          const brackets = f.match(/\{([^}]+)\}/g);
          if (brackets) {
            brackets.forEach(b => {
              const key = b.slice(1, -1);
              const val = rowContext.customMappings?.[key] || (rowContext as any)[key];
              if (val) {
                f = f.replace(b, val);
              }
            });
          }

          if (f.includes('{') || f.includes('}')) {
            const docFile = rowContext.customMappings?.['Document_Filename'] || rowContext.customMappings?.['Document_ValidationFile'] || '';
            f = docFile || `${partner}_${vRow.docType}`;
          }
          genFilename = f;
        } else {
          genFilename = `${context.tradingPartner}_validation_${vRow.docType}`;
        }

        if (!genFilename.toLowerCase().endsWith('.ini')) {
          genFilename += '.ini';
        }

        if (!ai) {
          const fallback = this.heuristicPopulate(templateText, templateFilename, rowContext, parsedExcelData);
          fallback.filename = genFilename;
          return fallback;
        }

        try {
          const mergedContent = await getMergedContent(vRow.docType, rowContext);
          const resolvedContent = this.resolveBracketedPlaceholders(mergedContent, rowContext, parsedExcelData);
          
          return {
            filename: genFilename,
            content: resolvedContent
          };
        } catch (err) {
          console.error(`LLM generation failed for ${genFilename} (docType: ${vRow.docType}), falling back to heuristic:`, err);
          const fallback = this.heuristicPopulate(templateText, templateFilename, rowContext, parsedExcelData);
          fallback.filename = genFilename;
          return fallback;
        }
      }));

      return generatedFiles;
    }

    if (isEdiBatchProfileTemplate) {
      const ediBatchRows: { docType: string; ediFilename: string }[] = [];
      const seen = new Set<string>();

      const filenamesMatch = (f1: string, f2: string): boolean => {
        if (!f1 || !f2) return false;
        let clean1 = f1.toLowerCase().trim();
        let clean2 = f2.toLowerCase().trim();
        if (clean1.endsWith('.ini')) clean1 = clean1.slice(0, -4);
        if (clean2.endsWith('.ini')) clean2 = clean2.slice(0, -4);
        if (clean1 === clean2) return true;
        const parts1 = clean1.split('.');
        const parts2 = clean2.split('.');
        if (parts1.length !== parts2.length) {
          const isStandard1 = clean1.startsWith('in.') || clean1.startsWith('out.');
          const isStandard2 = clean2.startsWith('in.') || clean2.startsWith('out.');
          if (isStandard1 && isStandard2) {
            return false;
          }
        }
        return clean1.includes(clean2) || clean2.includes(clean1);
      };

      const allEdiRows: { ediFilename: string; direction: 'IN' | 'OUT'; docType: string; rawRow: any }[] = [];

      if (parsedExcelData && parsedExcelData.edi && Array.isArray(parsedExcelData.edi)) {
        parsedExcelData.edi.forEach(row => {
          const hasColNums = (r: any): boolean => {
            return Object.keys(r).some(k => k.startsWith('_ColNum_'));
          };
          const getVal = (r: any, colNum: number, fallbackKeys: string[]): string => {
            // 1. Prioritize name-based matching first (highly accurate)
            for (const ck of fallbackKeys) {
              const normCk = ck.toLowerCase().replace(/[\s\_\-\[\]\(\)\/\\|]/g, '');
              const foundKey = Object.keys(r).find(rk => rk.toLowerCase().replace(/[\s\_\-\[\]\(\)\/\\|]/g, '') === normCk);
              if (foundKey && r[foundKey] !== undefined && r[foundKey] !== null && String(r[foundKey]).trim() !== '') {
                return String(r[foundKey]).trim();
              }
            }
            // 2. Fall back to column number matching only if name-based lookup was empty
            if (hasColNums(r)) {
              const colVal = r[`_ColNum_${colNum}`];
              if (colVal !== undefined && colVal !== null && colVal !== '') return String(colVal).trim();
            }
            return '';
          };

          const ediFileVal = getVal(row, 1, ["EDI_Filename", "Filename", "File_Name", "FileName"]) || "";
          let dirVal = getVal(row, 2, ["EDI_Direction", "Direction", "Dir", "EDI_Dir"]).trim().toLowerCase();
          
          if (!dirVal) {
             const lowerEdiFile = ediFileVal.toLowerCase();
             if (lowerEdiFile.includes('in.') || lowerEdiFile.includes('inbound') || lowerEdiFile.includes('_in_')) {
                dirVal = 'in';
             } else if (lowerEdiFile.includes('out.') || lowerEdiFile.includes('outbound') || lowerEdiFile.includes('_out_')) {
                dirVal = 'out';
             } else {
                dirVal = 'in'; // default
             }
          }

          let docTypeVal = getVal(row, 12, ["EDI_APRF", "APRF", "EdiAPRF", "doctype", "transaction"]) || "";
          if (docTypeVal) {
            const match = docTypeVal.match(/\b(810|812|820|824|830|832|846|850|852|855|856|860|864|867|870|940|945|997)\b/);
            if (match) docTypeVal = match[1];
          }

          if (ediFileVal && ediFileVal !== 'I am not sure the value with the available data' && ediFileVal !== 'N/A') {
            allEdiRows.push({
              ediFilename: ediFileVal,
              direction: dirVal.includes('out') ? 'OUT' : 'IN',
              docType: docTypeVal || '850',
              rawRow: row
            });
          }
        });
      }

      // Check if templateFilename corresponds to a specific row's filename
      const specificRow = allEdiRows.find(r => filenamesMatch(r.ediFilename, templateFilename));
      let targetRows: typeof allEdiRows = [];

      if (specificRow) {
        targetRows = [specificRow];
      } else {
        const isUserInbound = templateFilename.toLowerCase().startsWith('in.') || 
                              templateFilename.toLowerCase().includes('inbound') || 
                              templateFilename.toLowerCase().includes('in.') ||
                              userRequest.toLowerCase().includes('inbound');
                                  
        const isUserOutbound = templateFilename.toLowerCase().startsWith('out.') || 
                               templateFilename.toLowerCase().includes('outbound') || 
                               templateFilename.toLowerCase().includes('out.') ||
                               userRequest.toLowerCase().includes('outbound');

        if (isUserInbound && !isUserOutbound) {
          targetRows = allEdiRows.filter(r => r.direction === 'IN');
        } else if (isUserOutbound && !isUserInbound) {
          targetRows = allEdiRows.filter(r => r.direction === 'OUT');
        } else {
          // Both or entire folder selected
          targetRows = allEdiRows;
        }
      }

      targetRows.forEach(row => {
        const key = row.ediFilename.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          ediBatchRows.push({
            docType: row.docType,
            ediFilename: row.ediFilename
          });
        }
      });

      if (ediBatchRows.length === 0) {
        const docTypes = context.documentTypes && context.documentTypes.length > 0 ? context.documentTypes : ['850'];
        docTypes.forEach(dt => {
           ediBatchRows.push({
              docType: dt,
              ediFilename: `${context.tradingPartner}_EDI_${dt}.ini`
           });
        });
      }

      const generatedFiles = await Promise.all(ediBatchRows.map(async (eRow) => {
        const rowContext: ExtractedKnowledgeContext = {
          ...context,
          dictionary: undefined,
          validationRows: undefined,
          documentTypes: [eRow.docType],
          customMappings: {
            ...context.customMappings,
            'EDI_Filename': eRow.ediFilename,
            'EDI Filename': eRow.ediFilename,
            'EDIFilename': eRow.ediFilename
          }
        };

        let genFilename = eRow.ediFilename;
        if (!genFilename.toLowerCase().endsWith('.ini')) genFilename += '.ini';

        // Always use deterministic generation for EDI Batch Profile templates to perfectly preserve hardcoded values, comments, and structure.
        const fallback = LlmService.heuristicPopulate(templateText, templateFilename, rowContext, parsedExcelData, true);
        fallback.filename = genFilename;
        return fallback;
      }));

      return generatedFiles;
    }

    // Default flow for non-validation templates
    const defaultContext = { ...context, dictionary: undefined };
    
    // Filter to a specific document type if the user requested one
    const userDocMatch = userRequest.match(/\b(810|812|820|824|830|832|846|850|852|855|856|860|864|867|870|940|945|997)\b/);
    if (userDocMatch) {
       defaultContext.documentTypes = [userDocMatch[1]];
    }

    const fallbackResult = this.heuristicPopulate(templateText, templateFilename, defaultContext, parsedExcelData);
    const ai = this.getAiClient();

    let docType = defaultContext.documentTypes[0] || templateFilename.replace('.ini', '');
    let dir = 'OUT';
    if (templateText.includes('Direction=IN') || templateText.toLowerCase().includes('inbound') || userRequest.toLowerCase().includes('inbound')) dir = 'IN';
    let expectedFilename = `${defaultContext.tradingPartner}_${docType}_${dir}.ini`;
    if (templateFilename.toLowerCase().includes('997') || docType === '997') {
      expectedFilename = `${defaultContext.tradingPartner}_997_ACK.ini`;
    }

    if (!ai) {
      return [fallbackResult];
    }

    try {
      const knowledgeBase = this.getKnowledgeBase();
      const defaultTargetType = isValidationTemplate ? 'validation' : (isEdiBatchProfileTemplate ? 'edi' : (isDocumentIniTemplate ? 'document' : undefined));
      const prompt = GENERATOR_PROMPT
        .replace('{{SYSTEM_RULES}}', INSTRUCTIONS)
        .replace('{{KNOWLEDGE_BASE}}', knowledgeBase)
        .replace('{{EXTRACTED_KNOWLEDGE_CONTEXT}}', JSON.stringify(defaultContext, null, 2))
        .replace('{{EXCEL_SUMMARY}}', parsedExcelData ? JSON.stringify(LlmService.buildLookupPool(context, parsedExcelData, defaultTargetType), null, 2) : 'No Excel data provided.')
        .replace('{{USER_REQUEST}}', userRequest)
        .replace('{{TEMPLATE_FILENAME}}', templateFilename)
        .replace('{{TEMPLATE_TEXT}}', templateText);

      const response = await this.callLLMWithRetry(ai, {
        model: this.getModelName(),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const parsedResponse = LlmService.robustParseJson(response.choices[0].message.content || '[]');
      
      // Ensure we have an array
      const results = Array.isArray(parsedResponse) ? parsedResponse : [parsedResponse];
      
      return results.map((parsed: any) => {
        let finalFilename = expectedFilename;
        if (parsed.filename) {
          finalFilename = parsed.filename.trim();
        }

        const mergedContent = LlmService.mergeGeneratedWithTemplate(templateText, parsed.content || '');
        const resolvedContent = this.resolveBracketedPlaceholders(mergedContent, context, parsedExcelData);
        return {
          filename: finalFilename,
          content: resolvedContent
        };
      });
    } catch (err: any) {
      console.error('Error generating INI via LLM, falling back to heuristic:', err);
      return [fallbackResult];
    }
  }

  public static buildLookupPool(
    context: ExtractedKnowledgeContext,
    data: ParsedExcelData | null,
    targetType?: 'edi' | 'document' | 'validation'
  ): Record<string, string> {
    const pool: Record<string, string> = {};
    if (!data && !context.extractedJson) return pool;

    const isEdiTarget = targetType === 'edi';
    const isDocTarget = targetType === 'document';

    const targetDoc = context.documentTypes && context.documentTypes.length > 0 ? context.documentTypes[0] : '';
    const expectedFilename = context.customMappings && context.customMappings['EDI_Filename'] ? context.customMappings['EDI_Filename'] : '';

    const rowSpecificKeys = new Set<string>();

    const addFuzzyAliases = (k: string, val: string, trackKeys?: boolean) => {
      const normKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      const safeAlias = (aliasKey: string) => {
        if (!pool[aliasKey] || (trackKeys && !rowSpecificKeys.has(aliasKey))) {
          pool[aliasKey] = val;
          if (trackKeys) rowSpecificKeys.add(aliasKey);
        }
      };

      safeAlias(normKey);

      const isEdi = normKey.startsWith('edi');
      const isDoc = normKey.startsWith('doc');
      const isMod = normKey.startsWith('mod');

      if (normKey.includes('address') && !isDoc && !isMod) {
        safeAlias('ediaddress'); safeAlias('address');
      }
      if (normKey.includes('classification') && !isMod) {
        safeAlias('ediclassification'); safeAlias('classification');
      }
      if (normKey.includes('channel')) {
        if (!isDoc && !isMod) safeAlias('edichannel');
        safeAlias('channel');
      }
      if (normKey.includes('filename')) {
        if (!isDoc && !isMod) safeAlias('edifilename');
        safeAlias('filename');
      }
      if (normKey.includes('subgroup')) {
        safeAlias('edisubgroup');
        safeAlias('documentsubgroup');
        safeAlias('subgroup');
      } else if (normKey.includes('group')) {
        safeAlias('edigroup');
        safeAlias('documentgroup');
        safeAlias('group');
      }
      
      if (normKey.includes('module')) {
        safeAlias('edimodule');
        safeAlias('documentmodule');
        safeAlias('module');
        safeAlias('modules');
      }
      
      if (normKey.includes('aprf') || normKey.includes('doctype') || normKey.includes('transaction')) {
        safeAlias('ediaprf');
        safeAlias('aprf');
        safeAlias('doctype');
        safeAlias('transaction');
      }

      if (normKey.includes('syntax')) {
        safeAlias('edisyntax'); safeAlias('syntax');
      }
    };

    // Step 1: Initialize pool with dictionary and custom mappings as low priority fallbacks
    if (context.dictionary) {
      for (const [k, v] of Object.entries(context.dictionary)) {
        const normKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (v && v !== 'N/A') {
          pool[normKey] = String(v).trim();
        }
      }
    }

    if (context.customMappings) {
      for (const [k, v] of Object.entries(context.customMappings)) {
        if (v !== undefined && v !== null && v !== 'N/A' && String(v).trim() !== '') {
          addFuzzyAliases(k, String(v).trim(), false);
        }
      }
    }

    // Step 2: Extract rows from context.extractedJson if available
    const extJson = context.extractedJson;
    let extEdiRows: any[] = [];
    let extDocRows: any[] = [];
    let extModRows: any[] = [];
    let extEdiChannel: string | undefined = undefined;
    let extDocChannel: string | undefined = undefined;

    if (Array.isArray(extJson)) {
      const ediSheet = extJson.find(s => s.Sheet === "EDI");
      if (ediSheet) {
        extEdiRows = [
          ...(ediSheet.EDI_Direction_In || []),
          ...(ediSheet.EDI_Direction_Out || [])
        ];
        if (ediSheet.EDI_Channel !== undefined) {
          extEdiChannel = ediSheet.EDI_Channel;
        }
      }
      const docSheet = extJson.find(s => s.Sheet === "Document");
      if (docSheet) {
        extDocRows = [
          ...(docSheet.Document_Direction_In || []),
          ...(docSheet.Document_Direction_Out || [])
        ];
        if (docSheet.Document_Channel !== undefined) {
          extDocChannel = docSheet.Document_Channel;
        }
      }
      const modSheet = extJson.find(s => s.Sheet === "Modules");
      if (modSheet && modSheet.ModuleType) {
        extModRows = [
          ...(modSheet.ModuleType.DCPReport || []),
          ...(modSheet.ModuleType.DocumentReconciliation || []),
          ...(modSheet.ModuleType.EdiBatchParser || []),
          ...(modSheet.ModuleType.EdiBatchCreator || []),
          ...(modSheet.ModuleType.Reports || [])
        ];
      }
    }

    const filenamesMatch = (f1: string, f2: string): boolean => {
      if (!f1 || !f2) return false;
      let clean1 = f1.toLowerCase().trim();
      let clean2 = f2.toLowerCase().trim();
      if (clean1.endsWith('.ini')) clean1 = clean1.slice(0, -4);
      if (clean2.endsWith('.ini')) clean2 = clean2.slice(0, -4);
      if (clean1 === clean2) return true;
      const parts1 = clean1.split('.');
      const parts2 = clean2.split('.');
      if (parts1.length !== parts2.length) {
        const isStandard1 = clean1.startsWith('in.') || clean1.startsWith('out.');
        const isStandard2 = clean2.startsWith('in.') || clean2.startsWith('out.');
        if (isStandard1 && isStandard2) {
          return false;
        }
      }
      return clean1.includes(clean2) || clean2.includes(clean1);
    };

    let matchedEdiRow: any = null;
    let matchedDocRow: any = null;
    let matchedModRow: any = null;

    if (extEdiChannel !== undefined) {
      addFuzzyAliases('EDI_Channel', String(extEdiChannel).trim(), false);
    }
    if (extDocChannel !== undefined) {
      addFuzzyAliases('Document_Channel', String(extDocChannel).trim(), false);
    }

    if (extEdiRows.length > 0) {
      // 2a. Match EDI Row from extractedJson (Only if not Document Target)
      if (!isDocTarget) {
        if (expectedFilename || targetDoc) {
          matchedEdiRow = extEdiRows.find(row => {
            const rowFilename = row.EDI_Filename || "";
            if (expectedFilename && rowFilename) {
              return filenamesMatch(rowFilename, expectedFilename);
            }
            if (targetDoc) {
              const aprf = row.EDI_APRF || "";
              return aprf === targetDoc;
            }
            return false;
          });
        }
        if (!matchedEdiRow) {
          matchedEdiRow = extEdiRows[0];
        }
      }

      // 2b. Match Doc Row from extractedJson (Only if not EDI Target)
      if (!isEdiTarget && extDocRows.length > 0) {
        const ediKey = matchedEdiRow ? (matchedEdiRow.EDI_Key || matchedEdiRow.Key || "") : "";
        const ediFilename = matchedEdiRow ? (matchedEdiRow.EDI_Filename || "") : "";
        if (ediKey || expectedFilename || ediFilename) {
          matchedDocRow = extDocRows.find(row => {
            if (ediKey && row.Document_EDIProfile === ediKey) return true;
            const rFilename = row.Document_Filename || '';
            if (expectedFilename && filenamesMatch(rFilename, expectedFilename)) return true;
            if (ediFilename && filenamesMatch(rFilename, ediFilename)) return true;
            return false;
          });
        }
        if (!matchedDocRow && targetDoc) {
          matchedDocRow = extDocRows.find(row => {
            const docTypeVal = row.Document_Document || row.Document || '';
            return docTypeVal.toLowerCase() === targetDoc.toLowerCase();
          });
        }
        if (!matchedDocRow) {
          matchedDocRow = extDocRows[0];
        }
      }

      // 2c. Match Mod Row from extractedJson
      if (extModRows.length > 0) {
        const ediModule = matchedEdiRow ? (matchedEdiRow.EDI_Module || matchedEdiRow.Module || "") : "";
        const docReconcile = matchedDocRow ? (matchedDocRow.Document_Reconcile || "") : "";
        if (ediModule) {
          matchedModRow = extModRows.find(row => {
            return row.Module_Key === ediModule || row.Module_Filename === ediModule;
          });
        }
        if (!matchedModRow && docReconcile) {
          matchedModRow = extModRows.find(row => {
            return row.Module_Key === docReconcile || row.Module_Filename === docReconcile;
          });
        }
        if (!matchedModRow) {
          matchedModRow = extModRows[0];
        }
      }
    } else if (data) {
      // Fallback: match using raw ParsedExcelData (if extractedJson is not present or empty)
      if (!isDocTarget && data.edi && data.edi.length > 0) {
        if (expectedFilename || targetDoc) {
          matchedEdiRow = data.edi.find(row => {
            const getRowVal = (r: any, candidateKeys: string[], colNum?: number): string => {
              for (const ck of candidateKeys) {
                const normCk = ck.toLowerCase().replace(/[\s\_\-\[\]\(\)\/\\|]/g, '');
                const foundKey = Object.keys(r).find(rk => rk.toLowerCase().replace(/[\s\_\-\[\]\(\)\/\\|]/g, '') === normCk);
                if (foundKey && r[foundKey] !== undefined && r[foundKey] !== null) {
                  return String(r[foundKey]).trim();
                }
              }
              if (colNum !== undefined) {
                const col = r[`_ColNum_${colNum}`];
                if (col !== undefined && col !== null) return String(col).trim();
              }
              return '';
            };
            
            let rowFilename = getRowVal(row, ["EDI_Filename", "Filename", "File_Name", "FileName"], 1);
            if (expectedFilename && rowFilename) {
              return filenamesMatch(rowFilename, expectedFilename);
            }
            if (targetDoc) {
              let docTypeVal = getRowVal(row, ["EDI_APRF", "APRF", "EdiAPRF", "doctype", "transaction"], 12);
              const match = docTypeVal.match(/\b(810|812|820|824|830|832|846|850|852|855|856|860|864|867|870|940|945|997)\b/);
              const extractedType = match ? match[1] : docTypeVal;
              return extractedType.toLowerCase() === targetDoc.toLowerCase();
            }
            return false;
          });
        }

        if (!matchedEdiRow && data.edi.length > 0) {
          matchedEdiRow = data.edi[0];
        }
      }

      if (!isEdiTarget && data.document && data.document.length > 0) {
        const ediKey = matchedEdiRow ? (matchedEdiRow.EDI_Key || matchedEdiRow.Key || matchedEdiRow.EDI_Profile || '') : '';
        const ediFilename = matchedEdiRow ? (matchedEdiRow.EDI_Filename || matchedEdiRow.Filename || '') : '';
        
        if (ediKey || expectedFilename || ediFilename) {
          matchedDocRow = data.document.find(row => {
            if (ediKey && row.Document_EDIProfile === ediKey) return true;
            const rFilename = row.Document_Filename || '';
            if (expectedFilename && filenamesMatch(rFilename, expectedFilename)) return true;
            if (ediFilename && filenamesMatch(rFilename, ediFilename)) return true;
            return false;
          });
        }

        if (!matchedDocRow && targetDoc) {
          matchedDocRow = data.document.find(row => {
            let docTypeVal = row.Document_Document || row.Document || row.DocType || row.Transaction || '';
            const match = docTypeVal.match(/\b(810|812|820|824|830|832|846|850|852|855|856|860|864|867|870|940|945|997)\b/);
            const extractedType = match ? match[1] : docTypeVal;
            return extractedType.toLowerCase() === targetDoc.toLowerCase();
          });
        }

        if (!matchedDocRow && data.document.length > 0) {
          matchedDocRow = data.document[0];
        }
      }

      if (data.modules && data.modules.length > 0) {
        const ediModule = matchedEdiRow ? (matchedEdiRow.EDI_Module || matchedEdiRow.Module || matchedEdiRow.EDI_Key || '') : '';
        if (ediModule) {
          matchedModRow = data.modules.find(row => {
            return row.Module_Key === ediModule || row.Module_Filename === ediModule;
          });
        }
        if (!matchedModRow) matchedModRow = data.modules[0];
      }
    }

    // Step 3: Overwrite pool with matched fine-grained row values (highest priority)
    if (matchedEdiRow) {
      for (const [k, v] of Object.entries(matchedEdiRow)) {
        const strVal = String(v === null || v === undefined ? '' : v).trim();
        addFuzzyAliases(k, strVal, true);
        
        const normKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!normKey.startsWith('edi')) {
          const k2 = `edi${normKey}`;
          pool[k2] = strVal;
          rowSpecificKeys.add(k2);
        }
        if (normKey.startsWith('edi')) {
          const k3 = normKey.substring(3);
          pool[k3] = strVal;
          rowSpecificKeys.add(k3);
        }
      }

      // Setup clean EDI_Direction and EDI_Direction_In helper variables
      let isOut = false;
      const filename = (matchedEdiRow.EDI_Filename || "").toLowerCase();
      if (filename.startsWith("out.") || filename.includes("outbound") || filename.includes("_out_")) {
        isOut = true;
      }
      const dir = isOut ? "Out" : "In";
      pool['direction'] = dir;
      pool['edidirection'] = dir;
      pool['edidirectionin'] = dir;
      pool['directionin'] = dir;
      rowSpecificKeys.add('direction');
      rowSpecificKeys.add('edidirection');
      rowSpecificKeys.add('edidirectionin');
      rowSpecificKeys.add('directionin');
    }

    if (matchedDocRow) {
      for (const [k, v] of Object.entries(matchedDocRow)) {
        const normKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        const strVal = String(v === null || v === undefined ? '' : v).trim();
        pool[normKey] = strVal;
        rowSpecificKeys.add(normKey);
        
        if (!normKey.startsWith('document')) {
          const k2 = `document${normKey}`;
          pool[k2] = strVal;
          rowSpecificKeys.add(k2);
        }
        if (!normKey.startsWith('doc')) {
          const k3 = `doc${normKey}`;
          pool[k3] = strVal;
          rowSpecificKeys.add(k3);
        }
        if (normKey.startsWith('document')) {
          const k4 = normKey.substring(8);
          pool[k4] = strVal;
          rowSpecificKeys.add(k4);
        } else if (normKey.startsWith('doc')) {
          const k4 = normKey.substring(3);
          pool[k4] = strVal;
          rowSpecificKeys.add(k4);
        }
      }
    }

    if (matchedModRow) {
      for (const [k, v] of Object.entries(matchedModRow)) {
        const normKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        const strVal = String(v === null || v === undefined ? '' : v).trim();
        pool[normKey] = strVal;
        rowSpecificKeys.add(normKey);
        
        if (!normKey.startsWith('module')) {
          const k2 = `module${normKey}`;
          pool[k2] = strVal;
          rowSpecificKeys.add(k2);
        }
        if (normKey.startsWith('module')) {
          const k3 = normKey.substring(6);
          pool[k3] = strVal;
          rowSpecificKeys.add(k3);
        }
      }
    }

    // Step 4: Overwrite with custom mappings (highest priority ONLY if row-specific value is empty)
    if (context.customMappings) {
      for (const [k, v] of Object.entries(context.customMappings)) {
        if (v !== undefined && v !== null && v !== 'N/A' && String(v).trim() !== '') {
          const normKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          const strVal = String(v).trim();
          
          const applyIfEmptyOrMissing = (keyToApply: string) => {
             if (!rowSpecificKeys.has(keyToApply)) {
                 pool[keyToApply] = strVal;
             }
          };

          const isExplicitValidationInjection = normKey === 'documentvalidationfile' || normKey === 'documentvalidationdescription' || normKey === 'validationdescription' || normKey === 'validationfile';
          
          if (isExplicitValidationInjection) {
             pool[normKey] = strVal;
             if (normKey === 'documentvalidationfile') { pool['validationfile'] = strVal; }
             if (normKey === 'documentvalidationdescription') { pool['validationdescription'] = strVal; }
          } else {
             applyIfEmptyOrMissing(normKey);
             if (!normKey.startsWith('edi') && !normKey.startsWith('document') && !normKey.startsWith('module')) {
                applyIfEmptyOrMissing(`edi${normKey}`);
                applyIfEmptyOrMissing(`document${normKey}`);
                applyIfEmptyOrMissing(`doc${normKey}`);
                applyIfEmptyOrMissing(`module${normKey}`);
             }
          }
        }
      }
    }

    return pool;
  }

  public static findValueInExcel(data: ParsedExcelData | null, term: string, partnerColKey: string = 'Value'): string {
    if (!data) return '';
    const normTerm = term.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!normTerm) return '';

    // Determine partnerColKey dynamically if not specified or is default
    let activePartnerColKey = partnerColKey;
    if (data.edi && data.edi.length > 0 && activePartnerColKey === 'Value') {
      const keys = Object.keys(data.edi[0] || {});
      const foundKey = keys.find(k => k.toLowerCase().includes('value') || k.toLowerCase().includes('val'));
      if (foundKey) activePartnerColKey = foundKey;
    }

    // 1. Search in EDI worksheet
    if (data.edi && data.edi.length > 0) {
      for (const row of data.edi) {
        const keys = Object.keys(row);
        const matchKey = keys.find(k => {
          const normKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          return normKey === normTerm || (normTerm.length > 5 && normKey.includes(normTerm));
        });
        if (matchKey) {
          return String(row[matchKey] || '').trim();
        }
        for (const [k, v] of Object.entries(row)) {
          const normVal = String(v).toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normVal === normTerm) {
            return String(v).trim();
          }
        }
      }
    }
    // 2. Search in Modules worksheet
    if (data.modules && data.modules.length > 0) {
      for (const row of data.modules) {
        const keys = Object.keys(row);
        const matchKey = keys.find(k => {
          const normKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          return normKey === normTerm || (normTerm.length > 5 && normKey.includes(normTerm));
        });
        if (matchKey) {
          return String(row[matchKey]).trim();
        }
        for (const [k, v] of Object.entries(row)) {
          const normVal = String(v).toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normVal === normTerm) {
            return String(v).trim();
          }
        }
      }
    }
    // 3. Search in Document worksheet
    if (data.document && data.document.length > 0) {
      for (const row of data.document) {
        const keys = Object.keys(row);
        const matchKey = keys.find(k => {
          const normKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          return normKey === normTerm || (normTerm.length > 5 && normKey.includes(normTerm));
        });
        if (matchKey) {
          return String(row[matchKey]).trim();
        }
        for (const [k, v] of Object.entries(row)) {
          const normVal = String(v).toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normVal === normTerm) {
            return String(v).trim();
          }
        }
      }
    }
    return '';
  }

  public static mergeGeneratedWithTemplate(templateText: string, generatedText: string): string {
    const templateLines = templateText.split(/\r?\n/);
    const generatedLines = generatedText.split(/\r?\n/);

    // Map to store generated values: sectionKey -> value
    // sectionKey format: "section_name:key_name" in lowercase
    const genMap: Record<string, string> = {};
    let currentGenSection = "";

    generatedLines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentGenSection = trimmed.substring(1, trimmed.length - 1).trim().toLowerCase();
        return;
      }
      const eqIndex = line.indexOf('=');
      if (eqIndex !== -1) {
        const key = line.substring(0, eqIndex).trim().toLowerCase();
        const val = line.substring(eqIndex + 1).trim();
        const mapKey = `${currentGenSection}:${key}`;
        genMap[mapKey] = val;
      }
    });

    const outputLines: string[] = [];
    let currentTmplSection = "";

    templateLines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith(';') || trimmed.startsWith('#')) {
        outputLines.push(line);
        return;
      }
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentTmplSection = trimmed.substring(1, trimmed.length - 1).trim().toLowerCase();
        outputLines.push(line);
        return;
      }

      const eqIndex = line.indexOf('=');
      if (eqIndex !== -1) {
        const key = line.substring(0, eqIndex).trim();
        const leadingSpace = line.substring(0, line.indexOf(key));
        const originalRhs = line.substring(eqIndex + 1);

        const mapKey = `${currentTmplSection}:${key.toLowerCase()}`;
        const genVal = genMap[mapKey];

        // Check if the generated value is invalid or indicates missing data
        const isMissingOrUnsure = !genVal || 
          genVal.includes('I am not sure the value with the available data') || 
          genVal.includes('Extract the exact data value') ||
          genVal.toLowerCase() === 'todo' || 
          genVal.trim() === '';

        const hasBrackets = /\{([^}]+)\}/.test(originalRhs);

        const hasInstructionComment = (originalRhs.includes("//") || originalRhs.includes("/*"));
        if (isMissingOrUnsure || hasBrackets || hasInstructionComment) {
          // Keep the original template RHS (retaining placeholders and formatting)
          outputLines.push(`${leadingSpace}${key}=${originalRhs}`);
        } else {
          // Keep the LLM generated RHS (which has the resolved value)
          outputLines.push(`${leadingSpace}${key}= ${genVal}`);
        }
      } else {
        outputLines.push(line);
      }
    });

    return outputLines.join('\n');
  }

  public static filenamesMatch(f1: string, f2: string): boolean {
    if (!f1 || !f2) return false;
    let clean1 = f1.toLowerCase().trim();
    let clean2 = f2.toLowerCase().trim();
    if (clean1.endsWith('.ini')) clean1 = clean1.slice(0, -4);
    if (clean2.endsWith('.ini')) clean2 = clean2.slice(0, -4);
    if (clean1 === clean2) return true;
    const parts1 = clean1.split('.');
    const parts2 = clean2.split('.');
    if (parts1.length !== parts2.length) {
      const isStandard1 = clean1.startsWith('in.') || clean1.startsWith('out.');
      const isStandard2 = clean2.startsWith('in.') || clean2.startsWith('out.');
      if (isStandard1 && isStandard2) {
        return false;
      }
    }
    return clean1.includes(clean2) || clean2.includes(clean1);
  }

  public static resolveBracketedPlaceholders(
    text: string,
    context: ExtractedKnowledgeContext,
    data: ParsedExcelData | null,
    preserveComments: boolean = false,
    isEdiBatchProfile: boolean = false,
    isDocument: boolean = false
  ): string {
    const targetType = isEdiBatchProfile ? 'edi' : (isDocument ? 'document' : undefined);
    const pool = this.buildLookupPool(context, data, targetType);

    const getEdiBatchProfileOverride = (normTerm: string): string | null => {
      if (!isEdiBatchProfile) return null;
      if (normTerm === 'edichannel' || normTerm === 'channel') {
        let channelVal = '';
        if (context.extractedJson && Array.isArray(context.extractedJson)) {
          const ediSheet = context.extractedJson.find((s: any) => s && s.Sheet === 'EDI');
          if (ediSheet && ediSheet.EDI_Channel !== undefined && ediSheet.EDI_Channel !== null) {
            channelVal = String(ediSheet.EDI_Channel).trim();
          }
        }
        return channelVal;
      }
      if (normTerm === 'edisubgroup' || normTerm === 'subgroup' || normTerm === 'documentsubgroup') {
        let subgroupVal = '';
        let extEdiRows: any[] = [];
        if (context.extractedJson && Array.isArray(context.extractedJson)) {
          const ediSheet = context.extractedJson.find((s: any) => s && s.Sheet === 'EDI');
          if (ediSheet) {
            extEdiRows = [
              ...(ediSheet.EDI_Direction_In || []),
              ...(ediSheet.EDI_Direction_Out || [])
            ];
          }
        }
        const targetDoc = context.documentTypes && context.documentTypes.length > 0 ? context.documentTypes[0] : '';
        const expectedFilename = context.customMappings && context.customMappings['EDI_Filename'] ? context.customMappings['EDI_Filename'] : '';
        
        let matchedRow: any = null;
        if (extEdiRows.length > 0) {
          if (expectedFilename || targetDoc) {
            matchedRow = extEdiRows.find(row => {
              const rowFilename = row.EDI_Filename || "";
              if (expectedFilename && rowFilename) {
                return LlmService.filenamesMatch(rowFilename, expectedFilename);
              }
              if (targetDoc) {
                const aprf = row.EDI_APRF || "";
                return aprf === targetDoc;
              }
              return false;
            });
          }
          if (!matchedRow) {
            matchedRow = extEdiRows[0];
          }
        }
        if (matchedRow && matchedRow.EDI_Subgroup !== undefined && matchedRow.EDI_Subgroup !== null) {
          subgroupVal = String(matchedRow.EDI_Subgroup).trim();
        }
        return subgroupVal;
      }
      return null;
    };
    
    // Process section-level multi-line conditional block comments FIRST
    let processedText = text;
    const blockRegex = /\/\*\s*(?:\/\/)?\s*([^\n]+)\n([\s\S]*?)\*\//g;
    processedText = processedText.replace(blockRegex, (match, condition, body) => {
      const keep = LlmService.evaluateBlockCondition(condition, pool);
      if (keep) {
        return body; // Keep the body (it will be split and resolved normally)
      } else {
        return ''; // Delete the entire section block
      }
    });

    const lines = processedText.split('\n');
    const resolvedLines = lines.map(line => {
      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) {
        // Resolve brackets even in lines without = (e.g. section headers)
        if (line.includes('{') && line.includes('}')) {
           let cleanLine = line;
           const bracketRegex = /\{([^}]+)\}/g;
           cleanLine = cleanLine.replace(bracketRegex, (match, p1) => {
             const term = p1.trim();
             const normTerm = term.toLowerCase().replace(/[^a-z0-9]/g, '');
             const override = getEdiBatchProfileOverride(normTerm);
             if (override !== null) return override;
             let val = pool[normTerm];
             if (val === undefined && data && (!context.extractedJson || context.extractedJson.length === 0)) {
               const excelVal = LlmService.findValueInExcel(data, term);
               if (excelVal !== null) val = excelVal;
             }
             return (val !== undefined && val !== 'N/A') ? val : match;
           });
           return cleanLine;
        }
        return line;
      }
      const key = line.substring(0, eqIndex).trim();
      let rhsAndComment = line.substring(eqIndex + 1);
      
      let rhs = rhsAndComment;
      let comment = '';
      
      let blockCommentIdx = rhsAndComment.indexOf('/*');
      if (blockCommentIdx !== -1) {
        const endBlockIdx = rhsAndComment.indexOf('*/', blockCommentIdx);
        if (endBlockIdx !== -1) {
          const formula = rhsAndComment.substring(blockCommentIdx + 2, endBlockIdx).trim();
          comment += " " + formula; 
          rhs = rhsAndComment.substring(0, blockCommentIdx) + rhsAndComment.substring(endBlockIdx + 2);
        }
      }
      
      let doubleSlashIdx = rhs.indexOf('//');
      if (doubleSlashIdx !== -1) {
        comment += " " + rhs.substring(doubleSlashIdx + 2).trim();
        rhs = rhs.substring(0, doubleSlashIdx);
      }
      
      // Check for print-in-place custom variable logic in the comment before resolving brackets
      if (comment) {
        const printInPlaceRegex = /extract\s+capital\s+word\s+from\s+["']?\{([^}]+)\}(?:["']?)\s+and\s+print\s+in\s+place\s+of\s+["']?\{([^}]+)\}(?:["']?)/i;
        const matchPrintInPlace = comment.match(printInPlaceRegex);
        if (matchPrintInPlace) {
          const [ , srcField, targetVar ] = matchPrintInPlace;
          const normSrc = srcField.toLowerCase().replace(/[^a-z0-9]/g, '');
          let srcVal = pool[normSrc];
          if (srcVal === undefined && data) {
            srcVal = LlmService.findValueInExcel(data, srcField) || '';
          }
          if (srcVal) {
            let extractedVal = '';
            // Look for any word that starts with a capital letter or is fully uppercase
            const words = String(srcVal).match(/\b[A-Z][a-zA-Z]*\b/g);
            if (words && words.length > 0) {
              // Prefer words that are likely environments: Live, Test, Prod, Production, QA, UAT
              const envWord = words.find(w => /^(Live|Test|Prod|Production|QA|UAT)$/i.test(w));
              if (envWord) {
                extractedVal = envWord;
              } else {
                // Otherwise just take the first capitalized word found
                extractedVal = words[0];
              }
            }
            if (extractedVal) {
              const normTarget = targetVar.toLowerCase().replace(/[^a-z0-9]/g, '');
              pool[normTarget] = extractedVal;
            }
          }
        }
      }

      let cleanRhs = rhs.trim();
      
      if (cleanRhs.startsWith('"') && cleanRhs.endsWith('"') && !cleanRhs.includes('{')) {
        cleanRhs = cleanRhs.replace(/"/g, '');
        if (preserveComments && comment) {
          return `${key} = ${cleanRhs} //${comment}`;
        }
        return `${key} = ${cleanRhs}`;
      }
      
      const docLookupRegex = /DocLookup\(([^)]+)\)/gi;
      cleanRhs = cleanRhs.replace(docLookupRegex, (match, p1) => {
        const term = p1.trim();
        const normTerm = term.toLowerCase().replace(/[^a-z0-9]/g, '');
        let val = pool[normTerm];
        if (val === undefined && data && (!context.extractedJson || context.extractedJson.length === 0)) {
           val = LlmService.findValueInExcel(data, term);
        }
        return val !== undefined ? val : '';
      });
      
      const bracketRegex = /\{([^}]+)\}/g;
      cleanRhs = cleanRhs.replace(bracketRegex, (match, p1) => {
        const term = p1.trim();
        const normTerm = term.toLowerCase().replace(/[^a-z0-9]/g, '');
        const override = getEdiBatchProfileOverride(normTerm);
        if (override !== null) return override;
        let val = pool[normTerm];
        if (val === undefined && data && (!context.extractedJson || context.extractedJson.length === 0)) {
           const excelVal = LlmService.findValueInExcel(data, term);
           if (excelVal !== null) val = excelVal;
        }
        
        // Extract capital word if requested in the comment
        if (val !== undefined && val !== null && comment) {
          const lowerComment = comment.toLowerCase();
          if (lowerComment.includes('extract capital word') || lowerComment.includes('capital word')) {
            const words = String(val).match(/\b[A-Z][a-zA-Z]*\b/g);
            if (words && words.length > 0) {
              const envWord = words.find(w => /^(Live|Test|Prod|Production|QA|UAT)$/i.test(w));
              if (envWord) {
                val = envWord;
              } else {
                val = words[0];
              }
            }
          }
        }
        return (val !== undefined && val !== 'N/A') ? val : match;
      });
      
      let finalRhs = cleanRhs;
      if (comment) {
        if (isEdiBatchProfile) {
          const actionResult = LlmService.evaluateCommentAction(comment, finalRhs, pool);
          if (actionResult === 'DELETE_LINE') {
             return '__DELETE_LINE__'; // Signal to remove line
          } else if (actionResult !== 'KEEP_LINE') {
             finalRhs = actionResult;
          }
        }
      }
      
      finalRhs = finalRhs.replace(/"/g, ''); // Remove all double quotes as per user request

      if (preserveComments && comment) {
        return `${key} = ${finalRhs} //${comment}`;
      }
      return `${key} = ${finalRhs}`;
    });
    return resolvedLines.filter(line => line !== '__DELETE_LINE__').join('\n');
  }


  public static evaluateBlockCondition(comment: string, pool: Record<string, string>): boolean {
    const lowerComment = comment.toLowerCase();
    
    // Find field inside {Field}
    const fieldMatch = comment.match(/\{([^}]+)\}/);
    if (!fieldMatch) return true; // Keep by default
    
    const fieldName = fieldMatch[1];
    const normField = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const actualValue = (pool[normField] || '').trim();
    
    // Try to find comparison operator and value in the condition part (the part before 'then')
    const parts = comment.split(/\bthen\b/i);
    const conditionPart = parts[0].toLowerCase();
    const thenElsePart = parts.slice(1).join('then');
    
    const thenElseSplit = thenElsePart.split(/\belse\b/i);
    const thenAction = (thenElseSplit[0] || '').toLowerCase();
    const elseAction = (thenElseSplit[1] || '').toLowerCase();
    
    let conditionMet = false;
    
    // 1. Is blank / empty / null
    if (conditionPart.includes('is blank') || conditionPart.includes('is empty') || conditionPart.includes('is null') || conditionPart.includes('= ""') || conditionPart.includes("= ''")) {
      conditionMet = (actualValue === '');
    }
    // 2. Is not blank / not empty / not null
    else if (conditionPart.includes('is not blank') || conditionPart.includes('is not empty') || conditionPart.includes('is not null') || conditionPart.includes('!= ""') || conditionPart.includes("!= ''")) {
      conditionMet = (actualValue !== '');
    }
    // 3. Comparison with a quoted string
    else {
      const quoteMatch = parts[0].match(/["']([^"']*)["']/);
      if (quoteMatch) {
        const compareVal = quoteMatch[1];
        const hasNot = conditionPart.includes('!=') || conditionPart.includes('is not') || conditionPart.includes('not equal');
        const isEquals = actualValue.toLowerCase() === compareVal.toLowerCase();
        conditionMet = hasNot ? !isEquals : isEquals;
      } else {
        // No quote match, maybe check raw equality with words after 'is' or '='
        const eqMatch = parts[0].match(/(?:is|=)\s*([a-zA-Z0-9_-]+)/);
        if (eqMatch) {
          const compareVal = eqMatch[1];
          const hasNot = conditionPart.includes('!=') || conditionPart.includes('is not') || conditionPart.includes('not equal');
          const isEquals = actualValue.toLowerCase() === compareVal.toLowerCase();
          conditionMet = hasNot ? !isEquals : isEquals;
        }
      }
    }
    
    // Resolve actions: determine whether to keep (true) or delete (false)
    const isThenPrint = thenAction.includes('print') || thenAction.includes('keep');
    const isThenDelete = thenAction.includes('delete') || thenAction.includes('remove');
    const isElsePrint = elseAction.includes('print') || elseAction.includes('keep');
    const isElseDelete = elseAction.includes('delete') || elseAction.includes('remove');
    
    if (conditionMet) {
      if (isThenDelete) return false;
      if (isThenPrint) return true;
      return true; // default keep
    } else {
      if (isElseDelete) return false;
      if (isElsePrint) return true;
      // If "then print ... else delete" and condition is false, delete by default
      if (isThenPrint && !elseAction) return false;
      if (isThenPrint && isElseDelete) return false;
      return true; // default keep
    }
  }


  public static evaluateCommentAction(comment: string, rhsVal: string | null, pool: Record<string, string>): string {
    const lowerComment = comment.toLowerCase();
    
    let cleanRhs = (rhsVal || '').trim();
    if (cleanRhs.startsWith('"') && cleanRhs.endsWith('"')) {
      cleanRhs = cleanRhs.slice(1, -1).trim();
    } else if (cleanRhs.startsWith("'") && cleanRhs.endsWith("'")) {
      cleanRhs = cleanRhs.slice(1, -1).trim();
    }
    
    // 1. Delete if blank / null / remove if blank / null logic
    if ((lowerComment.includes('delete') || lowerComment.includes('remove')) && 
        (lowerComment.includes('blank') || lowerComment.includes('null'))) {
      if (cleanRhs === '' || cleanRhs.toLowerCase() === 'null' || cleanRhs.toLowerCase() === 'n/a') {
        return 'DELETE_LINE';
      }
    }
    
    // 3. IF statement with Then Else (e.g., if {EDI_Direction_In} = "IN" then print "Yes" else "No")
    const ifThenElseRegex = /if\s+\{([^}]+)\}\s*(=|!=)\s*["']?([^"']*)["']?\s+then\s+(?:print\s+)?["']?([^"']*)["']?\s+else\s+["']?([^"']*)["']?/i;
    const matchThenElse = comment.match(ifThenElseRegex);
    if (matchThenElse) {
      const [ , field, operator, compareVal, trueVal, falseVal ] = matchThenElse;
      const normField = field.toLowerCase().replace(/[^a-z0-9]/g, '');
      const actualVal = (pool[normField] || '').toLowerCase().trim();
      
      let conditionMet = false;
      if (operator === '=') {
        conditionMet = (actualVal === compareVal.toLowerCase().trim());
      } else if (operator === '!=') {
        conditionMet = (actualVal !== compareVal.toLowerCase().trim());
      }
      
      return conditionMet ? trueVal.trim() : falseVal.trim();
    }
    
    // 4. Standard functional IF statement parsing
    // Format: /*IF({EDI_Direction_In} = "In", "Yes", "No")*/
    const ifRegex = /if\s*\(\s*\{([^}]+)\}\s*(=|!=)\s*"([^"]*)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*\)/i;
    const match = comment.match(ifRegex);
    if (match) {
      const [ , field, operator, compareVal, trueVal, falseVal ] = match;
      const normField = field.toLowerCase().replace(/[^a-z0-9]/g, '');
      const actualVal = (pool[normField] || '').toLowerCase();
      
      let conditionMet = false;
      if (operator === '=') {
        conditionMet = (actualVal === compareVal.toLowerCase());
      } else if (operator === '!=') {
        conditionMet = (actualVal !== compareVal.toLowerCase());
      }
      
      if (conditionMet) return trueVal;
      return falseVal;
    }
    
    // 3. Simple replace logic
    // Format: /*If {EDI_Group} is blank then XYZ*/
    const simpleIfRegex = /if\s+\{([^}]+)\}\s+is\s+blank\s+then\s+(.+)/i;
    const matchSimple = comment.match(simpleIfRegex);
    if (matchSimple) {
       const [ , field, thenVal ] = matchSimple;
       const normField = field.toLowerCase().replace(/[^a-z0-9]/g, '');
       const actualVal = (pool[normField] || '').trim();
       if (!actualVal) {
          return thenVal.trim();
       }
    }

    return 'KEEP_LINE';
  }

  private static heuristicAnalyze(data: ParsedExcelData, req: string, templateText?: string): ExtractedKnowledgeContext {
    const reqLower = req.toLowerCase();
    
    // Find trading partner
    let partner = 'PartnerA';
    if (reqLower.includes('partner b') || reqLower.includes('partnerb')) {
      partner = 'PartnerB';
    } else if (reqLower.includes('abc')) {
      partner = 'ABCRetail';
    } else if (data.modules && data.modules.length > 0) {
      const firstRow = data.modules[0];
      const partnerKey = Object.keys(firstRow).find(k => {
        const l = k.toLowerCase();
        return l.includes('partner') || l.includes('client') || l.includes('customer');
      });
      partner = partnerKey ? String(firstRow[partnerKey]).trim() : 'PartnerA';
    }

    // Find all doc types from all worksheets to be safe
    const docTypesSet = new Set<string>();
    
    const scanSheetForDocs = (rows: Record<string, any>[]) => {
      rows.forEach(d => {
        Object.values(d).forEach(val => {
          const sVal = String(val).trim();
          // Look for 3-digit numbers like 850, 810, 856, etc.
          const matches = sVal.match(/\b(810|812|820|824|830|832|846|850|852|855|856|860|864|867|870|940|945|997)\b/g);
          if (matches) {
            matches.forEach(m => docTypesSet.add(m));
          }
        });
      });
    };

    scanSheetForDocs(data.document);
    scanSheetForDocs(data.modules);
    scanSheetForDocs(data.edi);
    
    // Fallback if none found in sheets, check the request
    if (docTypesSet.size === 0) {
      const matches = reqLower.match(/\b(810|812|820|824|830|832|846|850|852|855|856|860|864|867|870|940|945|997)\b/g);
      if (matches) {
        matches.forEach(m => docTypesSet.add(m));
      }
    }
    
    const documentTypes = docTypesSet.size > 0 ? Array.from(docTypesSet).sort() : ['850'];
    const docType = documentTypes[0]; // Primary for single-view logic

    // Extract EDI parameters for this partner
    const ediSettings: Record<string, any> = {};
    let partnerColKey = 'Value';

    if (data.edi && data.edi.length > 0) {
      const keys = Object.keys(data.edi[0] || {});
      // 1. Try to find key matching partner name
      let foundKey = keys.find(k => k.toLowerCase().replace(/[\s_\-]/g, '').includes(partner.toLowerCase().replace(/[\s_\-]/g, '')));
      // 2. If not found, look for any column containing 'value' or 'val'
      if (!foundKey) {
        foundKey = keys.find(k => k.toLowerCase().includes('value') || k.toLowerCase().includes('val'));
      }
      // 3. If still not found, find first column that is NOT 'parameter' or 'param' or 'description' or 'desc' or 'col_'
      if (!foundKey) {
        foundKey = keys.find(k => {
          const lowerK = k.toLowerCase();
          return !lowerK.includes('param') && !lowerK.includes('desc') && !lowerK.includes('col_');
        });
      }
      // 4. Default to first non-parameter key
      partnerColKey = foundKey || keys[1] || keys[0] || 'Value';

      data.edi.forEach(row => {
        const paramKey = Object.keys(row).find(k => k.toLowerCase().includes('parameter') || k.toLowerCase().includes('param'));
        if (paramKey) {
          const paramName = String(row[paramKey]).trim();
          if (paramName) {
            ediSettings[paramName] = row[partnerColKey] || row.Value || '';
          }
        }
      });
    }

    // Smart helper to search the sheets for a key/val matching a term (case-insensitive)
    const findValueInExcel = (term: string, defaultVal: string = ''): string => {
      return LlmService.findValueInExcel(data, term, partnerColKey) || defaultVal;
    };

    // Extract paths from Document sheet
    const paths: Record<string, any> = {};
    const docRow = data.document ? (data.document.find(d => {
      const docTypeKey = Object.keys(d).find(k => k.toLowerCase().includes('doctype') || k.toLowerCase().includes('doc') || k.toLowerCase().includes('type'));
      const partnerKey = Object.keys(d).find(k => k.toLowerCase().includes('partner') || k.toLowerCase().includes('client'));
      
      const rowDoc = docTypeKey ? String(d[docTypeKey]) : '';
      const rowPartner = partnerKey ? String(d[partnerKey]) : '';
      
      const docMatches = rowDoc.includes(docType);
      const partnerMatches = !partner || rowPartner.toLowerCase().includes(partner.toLowerCase());
      
      return docMatches && partnerMatches;
    }) || data.document[0] || {}) : {};

    if (docRow) {
      const findValue = (keys: string[], ...subTerms: string[]) => {
        const key = keys.find(k => {
          const l = k.toLowerCase();
          return subTerms.every(term => l.includes(term));
        });
        return key ? String(docRow[key]).trim() : '';
      };
      
      const docRowKeys = Object.keys(docRow);
      paths['InboundFolder'] = findValue(docRowKeys, 'inbound', 'path') || findValue(docRowKeys, 'inbound', 'folder') || findValue(docRowKeys, 'in') || '';
      paths['OutboundFolder'] = findValue(docRowKeys, 'outbound', 'path') || findValue(docRowKeys, 'outbound', 'folder') || findValue(docRowKeys, 'out') || '';
      paths['ArchiveFolder'] = findValue(docRowKeys, 'archive', 'path') || findValue(docRowKeys, 'archive', 'folder') || findValue(docRowKeys, 'arch') || '';
      paths['BackupFolder'] = findValue(docRowKeys, 'backup', 'path') || findValue(docRowKeys, 'backup', 'folder') || findValue(docRowKeys, 'back') || '';
    }

    // Extract database info
    const modRow = data.modules ? (data.modules.find(m => {
      const partnerKey = Object.keys(m).find(k => k.toLowerCase().includes('partner') || k.toLowerCase().includes('client'));
      const rowPartner = partnerKey ? String(m[partnerKey]) : '';
      return rowPartner.toLowerCase().includes(partner.toLowerCase());
    }) || data.modules[0] || {}) : {};

    const modRowKeys = Object.keys(modRow);
    const dbKey = modRowKeys.find(k => k.toLowerCase().includes('db') || k.toLowerCase().includes('database'));
    const dbName = dbKey ? String(modRow[dbKey]).trim() : 'EDI_PROD_DB';
    
    const envKey = modRowKeys.find(k => k.toLowerCase().includes('env') || k.toLowerCase().includes('environment'));
    const envName = envKey ? String(modRow[envKey]).trim() : 'PROD';
    
    const modNameKey = modRowKeys.find(k => k.toLowerCase().includes('module') || k.toLowerCase().includes('mod'));
    const modName = modNameKey ? String(modRow[modNameKey]).trim() : 'PurchaseOrder';

    // Smart extraction for Tp Key and Tp name as defined in prompt
    let tradingPartnerKey = partner;
    let tradingPartnerName = partner;

    if (data.modules && data.modules.length > 0) {
      const firstRow = data.modules[0];
      const keyCol = Object.keys(firstRow).find(k => k.toLowerCase() === 'key' || k.toLowerCase().includes('key'));
      const partnerCol = Object.keys(firstRow).find(k => k.toLowerCase().includes('partner') || k.toLowerCase().includes('client') || k.toLowerCase().includes('name'));
      
      if (partnerCol) {
        tradingPartnerName = String(firstRow[partnerCol]).trim();
      }
      
      if (keyCol) {
        const rawKeyValue = String(firstRow[keyCol]).trim();
        if (rawKeyValue) {
          // split by [ or .Label or .Channel etc to extract TP KEY as defined in prompt
          // e.g. "TP.PACK-ISO[.Channel].Label.Carton.4x6.1up" -> "TP.PACK-ISO"
          tradingPartnerKey = rawKeyValue.split('[')[0].split('.Label')[0].split('.Channel')[0].split('.Inbound')[0].split('.Outbound')[0].trim();
          
          if (tradingPartnerKey.endsWith('.')) {
            tradingPartnerKey = tradingPartnerKey.slice(0, -1);
          }
          
          if (!partnerCol) {
            tradingPartnerName = tradingPartnerKey;
          }
        }
      }
    }

    const ediParsers = findValueInExcel('parser') || findValueInExcel('parse') || '';
    const ediCreators = findValueInExcel('creator') || findValueInExcel('create') || '';

    // If the request or template name contains specific keywords, try to find a better match
    let refinedParsers = ediParsers;
    let refinedCreators = ediCreators;
    
    const searchTerms = [reqLower];
    if (req.includes('template "')) {
       const tmplMatch = req.match(/template "([^"]+)"/);
       if (tmplMatch) searchTerms.push(tmplMatch[1].toLowerCase());
    }

    if (data.modules && data.modules.length > 0) {
      for (const term of searchTerms) {
        const bestRow = data.modules.find(m => {
          const vals = Object.values(m).map(v => String(v).toLowerCase());
          return vals.some(v => v.includes(term.replace('.ini', '').toLowerCase()));
        });
        
        if (bestRow) {
          const pKey = Object.keys(bestRow).find(k => k.toLowerCase().includes('parser'));
          const cKey = Object.keys(bestRow).find(k => k.toLowerCase().includes('creator'));
          if (pKey) refinedParsers = String(bestRow[pKey]).trim();
          if (cKey) refinedCreators = String(bestRow[cKey]).trim();
          break;
        }
      }
    }

    const classifications = findValueInExcel('classific') || findValueInExcel('class') || docType;
    const subtypes = findValueInExcel('subtype') || findValueInExcel('sub_type') || '';
    const validationFilenames = findValueInExcel('validation') || findValueInExcel('schema') || '';

    const dict = LlmService.getDictionaryTerms(req, undefined, templateText);
    const customMappings: Record<string, string> = {};
    for (const [k, v] of Object.entries(dict)) {
      let val = '';
      if (docRow) {
        const docRowKeys = Object.keys(docRow);
        const termLower = k.toLowerCase().replace(/[\s_\-\.]/g, '');
        const foundKey = docRowKeys.find(key => {
          const keyLower = key.toLowerCase().replace(/[\s_\-\.]/g, '');
          return keyLower.includes(termLower) || termLower.includes(keyLower);
        });
        if (foundKey) {
          val = String(docRow[foundKey]).trim();
        }
      }
      if (!val) {
        val = findValueInExcel(k) || findValueInExcel(v);
      }
      customMappings[k] = val && val !== 'I am not sure the value with the available data' ? val : 'N/A';
    }

    let expectedDir = 'OUT';
    if (docRow && (docRow.Direction === 'IN' || String(docRow.Direction).toLowerCase().includes('in') || reqLower.includes('inbound') || reqLower.includes('receive') || reqLower.includes('incoming'))) {
      expectedDir = 'IN';
    }
    let expectedFilename = `${partner}_${docType}_${expectedDir}.ini`;
    if (docType === '997') {
      expectedFilename = `${partner}_997_ACK.ini`;
    }

    const transactionMappings: Record<string, Record<string, string>> = {};
    documentTypes.forEach(dt => {
      transactionMappings[dt] = {};
      
      const findAndMergeRows = (rows: Record<string, any>[]) => {
        rows.forEach(row => {
          let rowMatch = false;
          // Check if any cell contains the transaction code as a whole word
          for (const val of Object.values(row)) {
            const sVal = String(val).trim();
            if (sVal === dt || new RegExp(`\\b${dt}\\b`).test(sVal)) {
              rowMatch = true;
              break;
            }
          }
          if (rowMatch) {
            Object.entries(row).forEach(([k, v]) => {
              // Ignore internal keys and very long cell values that might be noise (e.g. huge blobs)
              if (k && !k.toLowerCase().includes('col_') && String(v).length < 1000) {
                transactionMappings[dt][k] = String(v).trim();
              }
            });
          }
        });
      };

      findAndMergeRows(data.document);
      findAndMergeRows(data.modules);
      findAndMergeRows(data.edi);
    });

    const validationRows: { docType: string; valFilename: string; valDescription: string; originalRow?: any }[] = [];
    if (data.document && Array.isArray(data.document)) {
      data.document.forEach(row => {
        const getRowVal = (r: any, candidateKeys: string[]): string => {
          for (const ck of candidateKeys) {
            const normCk = ck.toLowerCase().replace(/[\s\_\-\[\]\(\)\/\\|]/g, '');
            const foundKey = Object.keys(r).find(rk => rk.toLowerCase().replace(/[\s\_\-\[\]\(\)\/\\|]/g, '') === normCk);
            if (foundKey && r[foundKey] !== undefined && r[foundKey] !== null) {
              return String(r[foundKey]).trim();
            }
          }
          return '';
        };

        const rawDocType = getRowVal(row, ["Document_Document", "Document", "Doc", "DocType", "Transaction", "Transaction Type", "Document Type"]);
        // Extract 3-digit transaction code from rawDocType (e.g. "810 Invoice" -> "810", "850" -> "850")
        const match = rawDocType.match(/\b(810|812|820|824|830|832|846|850|852|855|856|860|864|867|870|940|945|997)\b/);
        const docTypeVal = match ? match[1] : (rawDocType || '850');

        const valFileVal = getRowVal(row, ["Document_ValidationFile", "ValidationFile", "Validation File", "Validation_File", "ValidationFilename", "Validation Filename", "Document_Validation_File"]);
        const valDescVal = getRowVal(row, ["Document_ValidationDescription", "ValidationDescription", "Validation Description", "Validation_Description"]);

        if (docTypeVal || valFileVal) {
          validationRows.push({
            docType: docTypeVal || '850',
            valFilename: valFileVal && valFileVal !== 'I am not sure the value with the available data' ? valFileVal : '',
            valDescription: valDescVal && valDescVal !== 'I am not sure the value with the available data' ? valDescVal : '',
            originalRow: row
          });
        }
      });
    }

    return {
      filename: expectedFilename,
      tradingPartnerKey,
      tradingPartnerName,
      ediParsers: refinedParsers || ediParsers,
      ediCreators: refinedCreators || ediCreators,
      classifications,
      subtypes,
      validationFilenames,
      customMappings,
      dictionary: dict,
      transactionMappings,
      modules: data.modules ? data.modules.map(m => {
        const k = Object.keys(m).find(key => key.toLowerCase().includes('module') || key.toLowerCase().includes('mod'));
        return k ? String(m[k]).trim() : '';
      }).filter(Boolean) : [],
      tradingPartner: partner,
      documentTypes,
      validationRows,
      extractedJson: ExcelService.extractExcelToJson(data)
    };
  }

  private static heuristicPopulate(
    templateText: string,
    templateFilename: string,
    context: ExtractedKnowledgeContext,
    data: ParsedExcelData | null,
    isEdiBatchProfile: boolean = false,
    isDocument: boolean = false
  ): { filename: string; content: string } {
    const lines = templateText.split(/\r?\n/);
    const outputLines: string[] = [];

    // Combine lookup pool
    const lookupPool: Record<string, any> = {
      Partner: context.tradingPartner,
      TradingPartner: context.tradingPartner,
      Version: '4010',
      Protocol: 'X12',
      ...context.customMappings
    };

    let docType = context.documentTypes[0] || templateFilename.replace('.ini', '');
    let dir = 'OUT';
    if (templateText.includes('Direction=IN') || templateText.toLowerCase().includes('inbound')) dir = 'IN';

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith(';') || trimmed.startsWith('#') || trimmed.startsWith('[')) {
        outputLines.push(line); // Preserve exact comments, blanks, sections
        return;
      }

      const eqIndex = line.indexOf('=');
      if (eqIndex !== -1) {
        const key = line.substring(0, eqIndex).trim();
        const leadingSpace = line.substring(0, line.indexOf(key));
        const originalRhs = line.substring(eqIndex + 1);

        let val = originalRhs;

        // If the RHS contains bracketed placeholders, we will keep it and let resolveBracketedPlaceholders resolve them!
        const hasBrackets = /\{([^}]+)\}/.test(originalRhs);

        if (!hasBrackets) {
          // No brackets. Check if it's a standard key that we should dynamically populate
          const keyLower = key.toLowerCase();
          if (keyLower === 'document' || keyLower === 'doctype' || keyLower === 'doc') {
            val = ` ${docType}`;
          } else if (keyLower === 'direction' || keyLower === 'dir') {
            val = ` ${lookupPool['Direction'] || dir}`;
          } else if (keyLower === 'tradingpartner' || keyLower === 'partner' || keyLower === 'partnername') {
            val = ` ${context.tradingPartner}`;
          } else {
            // Keep the original template value! NEVER overwrite with 'I am not sure...'
            val = originalRhs;
          }
        }

        outputLines.push(`${leadingSpace}${key}=${val}`);
      } else {
        outputLines.push(line);
      }
    });

    let content = outputLines.join('\n');
    content = this.resolveBracketedPlaceholders(content, context, data, false, isEdiBatchProfile, isDocument);

    // Determine filename
    let filename = `${context.tradingPartner}_${docType}_${dir}.ini`;
    if (templateFilename.toLowerCase().includes('997')) {
      filename = `${context.tradingPartner}_997_ACK.ini`;
    }

    return {
      filename,
      content
    };
  }
}
