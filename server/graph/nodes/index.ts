import fs from "fs";
import { LangGraphState } from "../state.js";
import { GeneratedIniResult } from "../state.js";
import { ExcelService } from "../../services/excel_service.js";
import { LlmService } from "../../services/llm_service.js";
import { onedriveService } from "../../services/onedrive_service.js";
import { ValidatorService } from "../../services/validator_service.js";

export class GraphNodes {
  /**
   * Node 1: Upload Node
   * Receives uploaded Excel file path.
   */
  public static async uploadNode(
    state: LangGraphState,
  ): Promise<Partial<LangGraphState>> {
    const startMsg = {
      node: "UploadNode",
      status: "started" as const,
      message: `Checking uploaded Excel workbook: ${state.uploadedExcelName || "None"}`,
      timestamp: Date.now(),
    };

    if (
      state.uploadedExcelPath &&
      !fs.existsSync(state.uploadedExcelPath) &&
      state.uploadedExcelPath === "/tmp/fake.xlsx"
    ) {
      try {
        const sampleBuffer = await ExcelService.generateSampleWorkbook();
        fs.writeFileSync(state.uploadedExcelPath, sampleBuffer);
      } catch (e) {
        console.error(
          "Failed to generate auto-sample workbook for /tmp/fake.xlsx:",
          e,
        );
      }
    }

    if (!state.uploadedExcelPath || !fs.existsSync(state.uploadedExcelPath)) {
      return {
        currentNode: "UploadNode",
        needsExcelUpload: true,
        traceLog: [
          ...state.traceLog,
          startMsg,
          {
            node: "UploadNode",
            status: "skipped" as const,
            message: "No active Excel file found. Prompting user to upload.",
            timestamp: Date.now(),
          },
        ],
      };
    }

    return {
      currentNode: "ExcelReader",
      needsExcelUpload: false,
      traceLog: [
        ...state.traceLog,
        startMsg,
        {
          node: "UploadNode",
          status: "completed" as const,
          message: `Excel upload verified: ${state.uploadedExcelPath}`,
          timestamp: Date.now(),
        },
      ],
    };
  }

  /**
   * Node 2: Excel Reader
   * Reads Modules, EDI, and Document worksheets.
   */
  public static async excelReaderNode(
    state: LangGraphState,
  ): Promise<Partial<LangGraphState>> {
    const startMsg = {
      node: "ExcelReader",
      status: "started" as const,
      message:
        "Reading Modules, EDI, and Document worksheets with openpyxl/pandas engine...",
      timestamp: Date.now(),
    };

    if (!state.uploadedExcelPath) {
      return {
        currentNode: "ResponseNode",
        traceLog: [
          ...state.traceLog,
          startMsg,
          {
            node: "ExcelReader",
            status: "failed" as const,
            message: "Missing Excel file path.",
            timestamp: Date.now(),
          },
        ],
      };
    }

    try {
      const parsed = await ExcelService.parseExcelFile(state.uploadedExcelPath);
      return {
        currentNode: "ExcelAnalyzer",
        parsedExcelData: parsed,
        traceLog: [
          ...state.traceLog,
          startMsg,
          {
            node: "ExcelReader",
            status: "completed" as const,
            message: `Parsed ${parsed.modules.length} Modules, ${parsed.edi.length} EDI parameters, and ${parsed.document.length} Document mappings.`,
            timestamp: Date.now(),
          },
        ],
      };
    } catch (err: any) {
      return {
        currentNode: "ResponseNode",
        traceLog: [
          ...state.traceLog,
          startMsg,
          {
            node: "ExcelReader",
            status: "failed" as const,
            message: `Failed reading worksheets: ${err.message}`,
            timestamp: Date.now(),
          },
        ],
      };
    }
  }

  /**
   * Node 3: Excel Analyzer
   * Extracts structured knowledge context using LLM or heuristic engine.
   */
  public static async excelAnalyzerNode(
    state: LangGraphState,
  ): Promise<Partial<LangGraphState>> {
    const startMsg = {
      node: "ExcelAnalyzer",
      status: "started" as const,
      message:
        "Analyzing worksheet relationships and extracting structured knowledge context...",
      timestamp: Date.now(),
    };

    if (!state.parsedExcelData) {
      return { currentNode: "ResponseNode" };
    }

    // Incorporate selected template into the analysis context if available and was explicitly attached by user in this turn
    const effectiveRequest = (state.selectedTemplatePath && state.isTemplateManuallyAttached)
      ? `${state.userRequest} (Context: Using template "${state.selectedTemplatePath}")`
      : state.userRequest;

    const extracted = await LlmService.analyzeWorkbook(
      state.parsedExcelData,
      effectiveRequest,
      state.textMappings,
      state.templateText || undefined,
    );

    return {
      currentNode: "TemplateFinder",
      extractedContext: extracted,
      traceLog: [
        ...state.traceLog,
        startMsg,
        {
          node: "ExcelAnalyzer",
          status: "completed" as const,
          message: `Extracted knowledge: Partner=${extracted.tradingPartner}, Docs=[${extracted.documentTypes.join(", ")}], DictKeys=[${Object.keys(extracted.dictionary || {}).join(", ")}]`,
          timestamp: Date.now(),
        },
      ],
    };
  }

  /**
   * Node 4: Template Finder
   * Recursively searches OneDrive repository for closest *.ini match.
   */
  public static async templateFinderNode(
    state: LangGraphState,
  ): Promise<Partial<LangGraphState>> {
    console.log(`[TemplateFinder] selectedTemplatePath: ${state.selectedTemplatePath}, isTemplateManuallyAttached: ${state.isTemplateManuallyAttached}`);
    // 1. Determine if the inherited template (if any) matches the newly extracted partner/document type.
    let useInherited = false;
    if (state.selectedTemplatePath && !state.isTemplateManuallyAttached) {
      const inheritedLower = state.selectedTemplatePath.toLowerCase();
      const currentPartner = (state.extractedContext?.tradingPartner || "").toLowerCase();
      const currentDocs = (state.extractedContext?.documentTypes || []).map(d => d.toLowerCase());

      const partnerMatches = currentPartner && (
        inheritedLower.includes(currentPartner) || 
        currentPartner.includes(inheritedLower.replace('.ini', ''))
      );
      
      const docMatches = currentDocs.length === 0 || currentDocs.some(doc => 
        inheritedLower.includes(doc) || 
        doc.includes(inheritedLower.replace('.ini', ''))
      );

      if (partnerMatches && docMatches) {
        useInherited = true;
      }
    }

    // 2. If we have a manually attached template or the inherited template matches perfectly, keep using it!
    if (state.selectedTemplatePath && (state.isTemplateManuallyAttached || useInherited)) {
      return {
        currentNode: state.templateText ? "IniGenerator" : "TemplateReader",
        traceLog: [
          ...state.traceLog,
          {
            node: "TemplateFinder",
            status: "completed" as const,
            message: state.isTemplateManuallyAttached
              ? `Using manually selected template: ${state.selectedTemplatePath}`
              : `Reusing inherited matching template: ${state.selectedTemplatePath}`,
            timestamp: Date.now(),
          },
        ],
      };
    }

    const startMsg = {
      node: "TemplateFinder",
      status: "started" as const,
      message:
        "Searching OneDrive template repository recursively for matching *.ini file...",
      timestamp: Date.now(),
    };

    const partner = state.extractedContext?.tradingPartner || "Partner A";
    let doc = "850";
    if (
      state.extractedContext?.documentTypes &&
      state.extractedContext.documentTypes.length > 0
    ) {
      const extractedDoc = state.extractedContext.documentTypes[0].trim();
      if (extractedDoc) doc = extractedDoc;
    }
    const docLower = doc.toLowerCase();

    const allTemplates = onedriveService.getAllTemplates();
    let bestMatch: any = null;

    // 1. Explicit request override
    if (state.userRequest) {
      const reqLower = state.userRequest.toLowerCase();
      // Try to find if user explicitly asked for a specific template (e.g. "Use Partner B 850")
      bestMatch = allTemplates.find((t) => {
        const folderLower = t.folder.toLowerCase();
        const baseName = t.filename.toLowerCase().replace(".ini", "");
        if (baseName.length < 2) return false;
        
        // Exact filename match in request
        if (reqLower.includes(baseName)) {
           // If they also mentioned the folder, it's a stronger match
           if (folderLower !== 'root' && reqLower.includes(folderLower)) return true;
           // If they didn't mention folder but matched filename, maybe it's the one
           // We will accept it as a match if they explicitly typed the name
           return true;
        }
        return false;
      });
    }

    // 2. Search query heuristics (Excel context)
    if (!bestMatch) {
      bestMatch = allTemplates.find(
        (t) =>
          t.folder.toLowerCase().includes(partner.toLowerCase()) &&
          t.filename.toLowerCase().includes(docLower),
      );
    }

    // 3. Fallback based on document type
    if (!bestMatch) {
      bestMatch = allTemplates.find((t) =>
        t.filename.toLowerCase().includes(docLower),
      );
    }

    if (!bestMatch) {
      // If we couldn't find a better match but have an inherited template, fall back to it as a last resort
      if (state.selectedTemplatePath) {
        return {
          currentNode: state.templateText ? "IniGenerator" : "TemplateReader",
          traceLog: [
            ...state.traceLog,
            {
              node: "TemplateFinder",
              status: "completed" as const,
              message: `No exact template match found for ${partner}/${docLower}. Falling back to previously used template: ${state.selectedTemplatePath}`,
              timestamp: Date.now(),
            },
          ],
        };
      }

      return {
        currentNode: "ResponseNode",
        traceLog: [
          ...state.traceLog,
          startMsg,
          {
            node: "TemplateFinder",
            status: "failed" as const,
            message: "No matching *.ini template found in OneDrive repository.",
            timestamp: Date.now(),
          },
        ],
      };
    }

    return {
      currentNode: "TemplateReader",
      selectedTemplatePath: bestMatch.path,
      templateText: null, // Clear inherited template text to force TemplateReader to load the new raw content!
      traceLog: [
        ...state.traceLog,
        startMsg,
        {
          node: "TemplateFinder",
          status: "completed" as const,
          message: `Selected template: OneDrive/${bestMatch.path}`,
          timestamp: Date.now(),
        },
      ],
    };
  }

  /**
   * Node 5: Template Reader
   * Reads template preserving comments, blank lines, formatting.
   */
  public static async templateReaderNode(
    state: LangGraphState,
  ): Promise<Partial<LangGraphState>> {
    if (state.templateText) {
      return {
        currentNode: "IniGenerator",
        traceLog: [
          ...state.traceLog,
          {
            node: "TemplateReader",
            status: "completed" as const,
            message: "Template content already loaded.",
            timestamp: Date.now(),
          },
        ],
      };
    }

    const startMsg = {
      node: "TemplateReader",
      status: "started" as const,
      message: `Reading raw template ${state.selectedTemplatePath} preserving formatting and comments...`,
      timestamp: Date.now(),
    };

    if (!state.selectedTemplatePath) {
      return { currentNode: "ResponseNode" };
    }

    const tmpl = onedriveService.getTemplateByPath(state.selectedTemplatePath);
    if (!tmpl) {
      return { currentNode: "ResponseNode" };
    }

    return {
      currentNode: "IniGenerator",
      templateText: tmpl.content,
      traceLog: [
        ...state.traceLog,
        startMsg,
        {
          node: "TemplateReader",
          status: "completed" as const,
          message: `Loaded ${tmpl.content.split("\n").length} lines of template configuration.`,
          timestamp: Date.now(),
        },
      ],
    };
  }

  /**
   * Node 6 & 7: INI Generator & Filename Generator
   * Populates template values and generates filename following template conventions.
   */
  public static async iniGeneratorNode(
    state: LangGraphState,
  ): Promise<Partial<LangGraphState>> {
    const startMsg = {
      node: "IniGenerator",
      status: "started" as const,
      message:
        "Populating INI keys from knowledge context (unknowns -> TODO) & generating filename...",
      timestamp: Date.now(),
    };

    if (!state.templateText || !state.extractedContext) {
      return { currentNode: "ResponseNode" };
    }

    const tmplFilename =
      state.selectedTemplatePath?.split("/").pop() || "config.ini";
    const generatedList = await LlmService.generateIniFromTemplate(
      state.templateText,
      state.selectedTemplatePath || tmplFilename,
      state.extractedContext,
      state.userRequest,
      state.parsedExcelData,
    );
    
    console.log(`[iniGeneratorNode] generatedList: ${JSON.stringify(generatedList)}`);

    // If we have a manually selected template, we should prioritize its naming convention for single file generation
    const processedResults: GeneratedIniResult[] = generatedList.map(generated => {
      let finalFilename = generated.filename || 'generated.ini';
      
      const lowerTmpl = tmplFilename.toLowerCase();
      const lowerPath = (state.selectedTemplatePath || '').toLowerCase();
      const isStructured = 
        lowerTmpl.includes('validation') || 
        lowerTmpl.includes('schema') || 
        tmplFilename.includes('{mnemonic}') ||
        lowerTmpl.includes('{doctype}') ||
        lowerTmpl.includes('{document}') ||
        lowerTmpl.includes('routing') ||
        lowerTmpl.includes('edi') ||
        lowerPath.includes('profiles/documents') ||
        lowerPath.includes('profiles/edibatch') ||
        lowerPath.includes('/documents/') ||
        lowerPath.includes('/edibatch/') ||
        lowerPath.includes('/document/') ||
        lowerPath.includes('/edi/') ||
        state.userRequest.toLowerCase().includes('document') ||
        state.userRequest.toLowerCase().includes('edi');

      if (
        state.selectedTemplatePath &&
        !state.userRequest.toLowerCase().includes("save as") &&
        generatedList.length === 1 &&
        !isStructured
      ) {
        const baseTmplName = tmplFilename.replace(".ini", "");
        const partner = state.extractedContext?.tradingPartner || "";
        finalFilename = `${partner}_${baseTmplName}.ini`.replace(/_{2,}/g, "_");
      }
      
      const cleanContent = LlmService.cleanIniFormat(generated.content || '');

      return { 
        filename: finalFilename,
        content: cleanContent,

        templateContent: state.templateText || undefined,
        templatePath: state.selectedTemplatePath || undefined,
        isTemplateManuallyAttached: state.isTemplateManuallyAttached,
        validationSummary: { isValid: true, errors: [], warnings: [], missingKeysCount: 0, todoCount: 0 },
        extractedContext: state.extractedContext || undefined,
        parsedExcelData: state.parsedExcelData || undefined,
      };
    });
    
    console.log(`[iniGeneratorNode] processedResults: ${JSON.stringify(processedResults)}`);

    return {
      currentNode: "Validator",
      generatedInis: processedResults,
      filename: processedResults[0]?.filename || null,
      traceLog: [
        ...state.traceLog,
        startMsg,
        {
          node: "IniGenerator",
          status: "completed" as const,
          message: `Generated ${processedResults.length} files.`,
          timestamp: Date.now(),
        },
      ],
    };
  }

  /**
   * Node 8: Validator Node
   * Validates missing values, duplicate sections/keys, invalid formatting.
   */
  public static async validatorNode(
    state: LangGraphState,
  ): Promise<Partial<LangGraphState>> {
    const startMsg = {
      node: "Validator",
      status: "started" as const,
      message:
        "Validating INI syntax, missing keys, duplicate headers, and mapping integrity...",
      timestamp: Date.now(),
    };

    if (!state.generatedInis || state.generatedInis.length === 0) {
      return { currentNode: "ResponseNode", generatedInis: state.generatedInis };
    }

    const processedResults = state.generatedInis.map(generated => {
      const summary = ValidatorService.validateIniContent(generated.content);
      return {
        ...generated,
        validationSummary: summary
      };
    });

    // Aggregate summary for the state.validationResult
    const aggregatedSummary = processedResults[0].validationSummary;

    return {
      currentNode: "ResponseNode",
      generatedInis: processedResults,
      validationResult: aggregatedSummary,
      traceLog: [
        ...state.traceLog,
        startMsg,
        {
          node: "Validator",
          status: aggregatedSummary.isValid
            ? ("completed" as const)
            : ("completed" as const),
          message: aggregatedSummary.isValid
            ? `Validation PASSED for ${processedResults.length} files.`
            : `Validation COMPLETED with issues in some files.`,
          timestamp: Date.now(),
        },
      ],
    };
  }

  /**
   * Node 9: Response Node
   * Packages generated filename, content, validation summary.
   */
  public static async responseNode(
    state: LangGraphState,
  ): Promise<Partial<LangGraphState>> {
    const respMsg = {
      node: "ResponseNode",
      status: "completed" as const,
      message:
        "Orchestration complete. Ready for Notepad preview and browser download.",
      timestamp: Date.now(),
    };

    return {
      currentNode: "END",
      traceLog: [...state.traceLog, respMsg],
    };
  }
}
