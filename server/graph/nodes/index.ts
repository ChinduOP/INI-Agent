import fs from 'fs';
import { LangGraphState } from '../state.js';
import { ExcelService } from '../../services/excel_service.js';
import { LlmService } from '../../services/llm_service.js';
import { onedriveService } from '../../services/onedrive_service.js';
import { ValidatorService } from '../../services/validator_service.js';

export class GraphNodes {
  /**
   * Node 1: Upload Node
   * Receives uploaded Excel file path.
   */
  public static async uploadNode(state: LangGraphState): Promise<Partial<LangGraphState>> {
    const startMsg = {
      node: 'UploadNode',
      status: 'started' as const,
      message: `Checking uploaded Excel workbook: ${state.uploadedExcelName || 'None'}`,
      timestamp: Date.now()
    };

    if (!state.uploadedExcelPath || !fs.existsSync(state.uploadedExcelPath)) {
      return {
        currentNode: 'UploadNode',
        needsExcelUpload: true,
        traceLog: [...state.traceLog, startMsg, {
          node: 'UploadNode',
          status: 'skipped' as const,
          message: 'No active Excel file found. Prompting user to upload.',
          timestamp: Date.now()
        }]
      };
    }

    return {
      currentNode: 'ExcelReader',
      needsExcelUpload: false,
      traceLog: [...state.traceLog, startMsg, {
        node: 'UploadNode',
        status: 'completed' as const,
        message: `Excel upload verified: ${state.uploadedExcelPath}`,
        timestamp: Date.now()
      }]
    };
  }

  /**
   * Node 2: Excel Reader
   * Reads Modules, EDI, and Document worksheets.
   */
  public static async excelReaderNode(state: LangGraphState): Promise<Partial<LangGraphState>> {
    const startMsg = {
      node: 'ExcelReader',
      status: 'started' as const,
      message: 'Reading Modules, EDI, and Document worksheets with openpyxl/pandas engine...',
      timestamp: Date.now()
    };

    if (!state.uploadedExcelPath) {
      return {
        currentNode: 'ResponseNode',
        traceLog: [...state.traceLog, startMsg, {
          node: 'ExcelReader',
          status: 'failed' as const,
          message: 'Missing Excel file path.',
          timestamp: Date.now()
        }]
      };
    }

    try {
      const parsed = await ExcelService.parseExcelFile(state.uploadedExcelPath);
      return {
        currentNode: 'ExcelAnalyzer',
        parsedExcelData: parsed,
        traceLog: [...state.traceLog, startMsg, {
          node: 'ExcelReader',
          status: 'completed' as const,
          message: `Parsed ${parsed.modules.length} Modules, ${parsed.edi.length} EDI parameters, and ${parsed.document.length} Document mappings.`,
          timestamp: Date.now()
        }]
      };
    } catch (err: any) {
      return {
        currentNode: 'ResponseNode',
        traceLog: [...state.traceLog, startMsg, {
          node: 'ExcelReader',
          status: 'failed' as const,
          message: `Failed reading worksheets: ${err.message}`,
          timestamp: Date.now()
        }]
      };
    }
  }

  /**
   * Node 3: Excel Analyzer
   * Extracts structured knowledge context using LLM or heuristic engine.
   */
  public static async excelAnalyzerNode(state: LangGraphState): Promise<Partial<LangGraphState>> {
    const startMsg = {
      node: 'ExcelAnalyzer',
      status: 'started' as const,
      message: 'Analyzing worksheet relationships and extracting structured knowledge context...',
      timestamp: Date.now()
    };

    if (!state.parsedExcelData) {
      return { currentNode: 'ResponseNode' };
    }

    const extracted = await LlmService.analyzeWorkbook(state.parsedExcelData, state.userRequest);

    return {
      currentNode: 'TemplateFinder',
      extractedContext: extracted,
      traceLog: [...state.traceLog, startMsg, {
        node: 'ExcelAnalyzer',
        status: 'completed' as const,
        message: `Extracted knowledge: Partner=${extracted.tradingPartner}, Docs=[${extracted.documentTypes.join(', ')}], Protocol=${extracted.protocols[0]}`,
        timestamp: Date.now()
      }]
    };
  }

  /**
   * Node 4: Template Finder
   * Recursively searches OneDrive repository for closest *.ini match.
   */
  public static async templateFinderNode(state: LangGraphState): Promise<Partial<LangGraphState>> {
    const startMsg = {
      node: 'TemplateFinder',
      status: 'started' as const,
      message: 'Searching OneDrive template repository recursively for matching *.ini file...',
      timestamp: Date.now()
    };

    const partner = state.extractedContext?.tradingPartner || 'Partner A';
    const doc = state.extractedContext?.documentTypes[0] || '850';

    // Search query heuristics
    const allTemplates = onedriveService.getAllTemplates();
    let bestMatch = allTemplates.find(t => t.folder.toLowerCase().includes(partner.toLowerCase()) && t.filename.includes(doc));
    
    if (!bestMatch) {
      bestMatch = allTemplates.find(t => t.filename.includes(doc)) || allTemplates[0];
    }

    if (!bestMatch) {
      return {
        currentNode: 'ResponseNode',
        traceLog: [...state.traceLog, startMsg, {
          node: 'TemplateFinder',
          status: 'failed' as const,
          message: 'No matching *.ini template found in OneDrive repository.',
          timestamp: Date.now()
        }]
      };
    }

    return {
      currentNode: 'TemplateReader',
      selectedTemplatePath: bestMatch.path,
      traceLog: [...state.traceLog, startMsg, {
        node: 'TemplateFinder',
        status: 'completed' as const,
        message: `Selected template: OneDrive/${bestMatch.path}`,
        timestamp: Date.now()
      }]
    };
  }

  /**
   * Node 5: Template Reader
   * Reads template preserving comments, blank lines, formatting.
   */
  public static async templateReaderNode(state: LangGraphState): Promise<Partial<LangGraphState>> {
    const startMsg = {
      node: 'TemplateReader',
      status: 'started' as const,
      message: `Reading raw template ${state.selectedTemplatePath} preserving formatting and comments...`,
      timestamp: Date.now()
    };

    if (!state.selectedTemplatePath) {
      return { currentNode: 'ResponseNode' };
    }

    const tmpl = onedriveService.getTemplateByPath(state.selectedTemplatePath);
    if (!tmpl) {
      return { currentNode: 'ResponseNode' };
    }

    return {
      currentNode: 'IniGenerator',
      templateText: tmpl.content,
      traceLog: [...state.traceLog, startMsg, {
        node: 'TemplateReader',
        status: 'completed' as const,
        message: `Loaded ${tmpl.content.split('\n').length} lines of template configuration.`,
        timestamp: Date.now()
      }]
    };
  }

  /**
   * Node 6 & 7: INI Generator & Filename Generator
   * Populates template values and generates filename following template conventions.
   */
  public static async iniGeneratorNode(state: LangGraphState): Promise<Partial<LangGraphState>> {
    const startMsg = {
      node: 'IniGenerator',
      status: 'started' as const,
      message: 'Populating INI keys from knowledge context (unknowns -> TODO) & generating filename...',
      timestamp: Date.now()
    };

    if (!state.templateText || !state.extractedContext) {
      return { currentNode: 'ResponseNode' };
    }

    const tmplFilename = state.selectedTemplatePath?.split('/').pop() || 'config.ini';
    const generated = await LlmService.generateIniFromTemplate(
      state.templateText,
      tmplFilename,
      state.extractedContext,
      state.userRequest
    );

    return {
      currentNode: 'Validator',
      generatedINI: generated.content,
      filename: generated.filename,
      traceLog: [...state.traceLog, startMsg, {
        node: 'IniGenerator',
        status: 'completed' as const,
        message: `Generated "${generated.filename}" (${generated.content.length} bytes).`,
        timestamp: Date.now()
      }]
    };
  }

  /**
   * Node 8: Validator Node
   * Validates missing values, duplicate sections/keys, invalid formatting.
   */
  public static async validatorNode(state: LangGraphState): Promise<Partial<LangGraphState>> {
    const startMsg = {
      node: 'Validator',
      status: 'started' as const,
      message: 'Validating INI syntax, missing keys, duplicate headers, and mapping integrity...',
      timestamp: Date.now()
    };

    if (!state.generatedINI) {
      return { currentNode: 'ResponseNode' };
    }

    const summary = ValidatorService.validateIniContent(state.generatedINI);

    return {
      currentNode: 'ResponseNode',
      validationResult: summary,
      traceLog: [...state.traceLog, startMsg, {
        node: 'Validator',
        status: summary.isValid ? ('completed' as const) : ('completed' as const),
        message: summary.isValid 
          ? `Validation PASSED (0 fatal errors, ${summary.warnings.length} warnings/todos).`
          : `Validation COMPLETED with ${summary.errors.length} errors and ${summary.warnings.length} warnings.`,
        timestamp: Date.now()
      }]
    };
  }

  /**
   * Node 9: Response Node
   * Packages generated filename, content, validation summary.
   */
  public static async responseNode(state: LangGraphState): Promise<Partial<LangGraphState>> {
    const respMsg = {
      node: 'ResponseNode',
      status: 'completed' as const,
      message: 'Orchestration complete. Ready for Notepad preview and browser download.',
      timestamp: Date.now()
    };

    return {
      currentNode: 'END',
      traceLog: [...state.traceLog, respMsg]
    };
  }
}
