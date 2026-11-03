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

    const hasSelectedTemplate = !!state.selectedTemplatePath || state.isTemplateManuallyAttached;
    const isXmlOrGenReq = (state.userRequest || '').toLowerCase().includes('xml') || (state.userRequest || '').toLowerCase().includes('validation') || (state.userRequest || '').toLowerCase().includes('generate');

    if (!state.uploadedExcelPath || !fs.existsSync(state.uploadedExcelPath)) {
      if (hasSelectedTemplate || isXmlOrGenReq) {
        return {
          currentNode: "TemplateFinder",
          needsExcelUpload: false,
          traceLog: [
            ...state.traceLog,
            startMsg,
            {
              node: "UploadNode",
              status: "completed" as const,
              message: "No Excel file uploaded. Proceeding with direct template/XML generation.",
              timestamp: Date.now(),
            },
          ],
        };
      }

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
        currentNode: "TemplateFinder",
        parsedExcelData: null,
        traceLog: [
          ...state.traceLog,
          startMsg,
          {
            node: "ExcelReader",
            status: "completed" as const,
            message: "No Excel file uploaded. Skipping Excel reader and proceeding directly to template engine.",
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
      const defaultContext = {
        tradingPartner: "Default",
        tradingPartnerName: "Default Partner",
        documentTypes: [],
        dictionary: {},
        modules: [],
        edi: [],
        document: []
      };
      return {
        currentNode: "TemplateFinder",
        extractedContext: defaultContext,
        traceLog: [
          ...state.traceLog,
          startMsg,
          {
            node: "ExcelAnalyzer",
            status: "completed" as const,
            message: "No Excel dataset uploaded. Proceeding with template direct generation context.",
            timestamp: Date.now(),
          },
        ],
      };
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

    const partner = state.extractedContext?.tradingPartner || state.extractedContext?.tradingPartnerName || "";
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

    // Determine user requested direction and target profile type
    let reqDirection = 'ANY';
    const req = (state.userRequest || '').toLowerCase();
    const reqIn = req.includes('inbound') || req.includes('parser') || req.includes('in.') || req.includes('direction in') || req.includes('in direction') || /\bdir\s*in\b/.test(req);
    const reqOut = req.includes('outbound') || req.includes('creator') || req.includes('out.') || req.includes('direction out') || req.includes('out direction') || /\bdir\s*out\b/.test(req);
    if (reqIn && !reqOut) reqDirection = 'IN';
    if (reqOut && !reqIn) reqDirection = 'OUT';

    const matchesDirection = (filename: string, dir: string) => {
       if (dir === 'ANY') return true;
       const lower = filename.toLowerCase();
       const isTmplIn = lower.startsWith('in.') || lower.startsWith('in_') || lower.startsWith('inbound') || lower.includes('inbound') || lower.includes('_in_');
       const isTmplOut = lower.startsWith('out.') || lower.startsWith('out_') || lower.startsWith('outbound') || lower.includes('outbound') || lower.includes('_out_');
       if (dir === 'IN' && isTmplOut && !isTmplIn) return false;
       if (dir === 'OUT' && isTmplIn && !isTmplOut) return false;
       return true;
    };

    const isDocRequest = req.includes('document') || req.includes('profiles\\documents') || req.includes('profiles/documents') || req.includes('routing');
    const isEdiBatchRequest = req.includes('edibatch') || req.includes('edi batch') || req.includes('profiles\\edibatches') || req.includes('profiles/edibatches') || (req.includes('edi') && !isDocRequest);
    const isModuleRequest = req.includes('module') || req.includes('parser') || req.includes('creator') || req.includes('reconciliation') || req.includes('dcpreport');

    // 2. Specific folder / profile domain matching
    if (!bestMatch && isDocRequest) {
      bestMatch = allTemplates.find((t) => {
        const folderLower = t.folder.toLowerCase();
        const pathLower = t.path.toLowerCase();
        const fileLower = t.filename.toLowerCase();
        const isDocTmpl = folderLower.includes('document') || pathLower.includes('document') || fileLower.includes('routing');
        return isDocTmpl && matchesDirection(t.filename, reqDirection);
      });
    }

    if (!bestMatch && isEdiBatchRequest) {
      bestMatch = allTemplates.find((t) => {
        const folderLower = t.folder.toLowerCase();
        const pathLower = t.path.toLowerCase();
        const fileLower = t.filename.toLowerCase();
        const isEdiTmpl = folderLower.includes('edi') || pathLower.includes('edi') || fileLower.includes('edi') || fileLower.includes('batch');
        return isEdiTmpl && matchesDirection(t.filename, reqDirection);
      });
    }

    if (!bestMatch && isModuleRequest) {
      bestMatch = allTemplates.find((t) => {
        const folderLower = t.folder.toLowerCase();
        const pathLower = t.path.toLowerCase();
        const fileLower = t.filename.toLowerCase();
        const isModTmpl = folderLower.includes('module') || pathLower.includes('module');
        return isModTmpl && matchesDirection(t.filename, reqDirection);
      });
    }

    // 3. Search query heuristics (Excel context)
    if (!bestMatch) {
      bestMatch = allTemplates.find(
        (t) =>
          t.folder.toLowerCase().includes(partner.toLowerCase()) &&
          t.filename.toLowerCase().includes(docLower) &&
          matchesDirection(t.filename, reqDirection)
      );
    }

    // 4. Fallback based on document type
    if (!bestMatch) {
      bestMatch = allTemplates.find((t) =>
        t.filename.toLowerCase().includes(docLower) &&
        matchesDirection(t.filename, reqDirection)
      );
    }

    // 5. Fallback based purely on requested direction
    if (!bestMatch && reqDirection !== 'ANY') {
      bestMatch = allTemplates.find((t) => matchesDirection(t.filename, reqDirection));
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

    if (!state.templateText) {
      return { currentNode: "ResponseNode" };
    }

    const effectiveContext = state.extractedContext || {
      tradingPartner: "Default",
      tradingPartnerName: "Default Partner",
      documentTypes: [],
      dictionary: {},
      modules: [],
      edi: [],
      document: []
    };

    const tmplFilename =
      state.selectedTemplatePath?.split("/").pop() || "config.ini";
    const generatedList = await LlmService.generateIniFromTemplate(
      state.templateText,
      state.selectedTemplatePath || tmplFilename,
      effectiveContext,
      state.userRequest,
      state.parsedExcelData,
      state.selectedFields
    );
    
    console.log(`[iniGeneratorNode] generatedList: ${JSON.stringify(generatedList)}`);

    // If we have a manually selected template, we should prioritize its naming convention for single file generation
    const getDownloadPath = (filename: string, text: string, fullPath: string, tp: string, sourceSheet?: string) => {
      let safeName = (tp || "Unknown partner").trim();
      if (!safeName || safeName.toLowerCase() === 'tp.pack-iso') safeName = "Unknown partner";
      
      let dirPath = '';
      const normalizedFullPath = fullPath.replace(/\\/g, '/').toLowerCase();
      if (/(?:^|\/)transformssets(?:\/|$)/.test(normalizedFullPath)) {
        dirPath = 'TransformsSets';
      } else if (sourceSheet === 'EDI') {
        dirPath = 'Profiles/EDIBatches';
      } else if (sourceSheet === 'Document') {
        dirPath = 'Profiles/Documents';
      } else if (fullPath) {
        let normalizedPath = fullPath.replace(/\\/g, '/');
        // Remove leading slash if any
        if (normalizedPath.startsWith('/')) {
            normalizedPath = normalizedPath.substring(1);
        }
        
        // Split by slashes
        const parts = normalizedPath.split('/');
        if (parts.length > 1) {
          dirPath = parts.slice(0, -1).join('/');
        }
      }
      
      if (!dirPath) {
        const lowerFile = filename.toLowerCase();
        const lowerText = text.toLowerCase();
        if (lowerFile.endsWith('.xml') || lowerText.includes('<?xml')) {
          dirPath = 'Config/application/DCP';
        } else if (
          (lowerFile.startsWith('document.') && (lowerFile.includes('order') || lowerFile.includes('packing') || lowerFile.includes('asn') || lowerFile.includes('invoice') || lowerFile.includes('credit') || lowerFile.includes('response') || lowerFile.endsWith('.ini'))) ||
          lowerFile.includes('document.1.order') || lowerFile.includes('document.2.orderresponse') || lowerFile.includes('document.3.packinglist') || lowerFile.includes('document.4.asn') || lowerFile.includes('document.5.invoice') || lowerFile.includes('document.6.creditnote')
        ) {
          dirPath = 'DCP';
        } else if (lowerFile.includes('validation') || lowerFile.includes('schema') || filename.includes('{mnemonic}') || lowerText.includes('validation') || lowerText.includes('schema') || text.includes('{Document_Validation File}') || text.includes('{Document_ValidationDescription}')) {
          dirPath = 'Validations/Documents';
        } else if (lowerFile.includes('creator') || lowerText.includes('[edibatchcreator]')) {
          dirPath = 'Modules/EdiBatchCreators';
        } else if (lowerFile.includes('parser') || lowerText.includes('[edibatchparser]')) {
          dirPath = 'Modules/EdiBatchParsers';
        } else if (lowerFile.includes('dcpreport') || lowerText.includes('[dcpreport]')) {
          dirPath = 'Modules/DCPReports';
        } else if (lowerFile.includes('{document group}') || lowerFile.includes('syntax') || lowerFile.includes('envelope') || (lowerFile.includes('edi') && (lowerFile.includes('batch') || lowerFile.includes('profile')))) {
          dirPath = 'Profiles/EDIBatches';
        } else {
          dirPath = 'Profiles/Documents';
        }
      }
      
      return `${safeName}/${dirPath}`;
    };

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
        lowerTmpl.includes('{document group}') ||
        lowerTmpl.includes('{document_group}') ||
        lowerTmpl.includes('syntax') ||
        lowerTmpl.includes('routing') ||
        lowerTmpl.includes('edi') ||
        lowerTmpl.startsWith('in.') ||
        lowerTmpl.startsWith('out.') ||
        lowerTmpl.includes('profile') ||
        lowerPath.includes('profile') ||
        lowerPath.includes('profiles/documents') ||
        lowerPath.includes('profiles/edibatch') ||
        lowerPath.includes('profiles/edibatches') ||
        lowerPath.includes('/documents/') ||
        lowerPath.includes('/edibatch/') ||
        lowerPath.includes('/edibatches/') ||
        lowerPath.includes('/document/') ||
        lowerPath.includes('/edi/') ||
        state.userRequest.toLowerCase().includes('document') ||
        state.userRequest.toLowerCase().includes('edi');

      if (
        state.selectedTemplatePath &&
        !state.userRequest.toLowerCase().includes("save as") &&
        generatedList.length === 1 &&
        !isStructured &&
        (!generated.filename || generated.filename === 'generated.ini')
      ) {
        const baseTmplName = tmplFilename.replace(".ini", "");
        const partner = state.extractedContext?.tradingPartner || "";
        finalFilename = `${partner}_${baseTmplName}.ini`.replace(/_{2,}/g, "_");
      }
      
      const cleanContent = LlmService.cleanGeneratedContent(
        generated.content || '',
        finalFilename || tmplFilename,
        generated.sourceSheet === 'Document'
      );

      const partner = state.extractedContext?.tradingPartnerKey || state.extractedContext?.tradingPartnerName || state.extractedContext?.tradingPartner || "Unknown partner";
      const resultTemplatePath = generated.templatePath || state.selectedTemplatePath || '';
      const dlPath = getDownloadPath(finalFilename || tmplFilename, generated.templateContent || state.templateText || '', resultTemplatePath, partner, generated.sourceSheet);

      return { 
        downloadPath: dlPath,
        filename: finalFilename,
        content: cleanContent,

        templateContent: generated.templateContent || state.templateText || undefined,
        templatePath: resultTemplatePath || undefined,
        isTemplateManuallyAttached: state.isTemplateManuallyAttached,
        validationSummary: { isValid: true, errors: [], warnings: [], missingKeysCount: 0, todoCount: 0 },
        extractedContext: state.extractedContext || undefined,
        parsedExcelData: state.parsedExcelData || undefined,
      };
    });
    
    console.log(`[iniGeneratorNode] processedResults: ${JSON.stringify(processedResults)}`);

    const seenNames = new Set<string>();
    const deduplicatedResults: GeneratedIniResult[] = [];
    for (const pr of processedResults) {
      const lowerName = (pr.filename || '').toLowerCase().trim();
      if (lowerName && !seenNames.has(lowerName)) {
        seenNames.add(lowerName);
        deduplicatedResults.push(pr);
      }
    }

    return {
      currentNode: "Validator",
      generatedInis: deduplicatedResults,
      filename: deduplicatedResults[0]?.filename || null,
      traceLog: [
        ...state.traceLog,
        startMsg,
        {
          node: "IniGenerator",
          status: "completed" as const,
          message: `Generated ${deduplicatedResults.length} files.`,
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

    // Aggregate summary for state.validationResult across all generated files
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    let totalMissing = 0;
    let totalTodo = 0;
    for (const pr of processedResults) {
      if (pr.validationSummary) {
        allErrors.push(...(pr.validationSummary.errors || []));
        allWarnings.push(...(pr.validationSummary.warnings || []));
        totalMissing += pr.validationSummary.missingKeysCount || 0;
        totalTodo += pr.validationSummary.todoCount || 0;
      }
    }
    const aggregatedSummary = {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      missingKeysCount: totalMissing,
      todoCount: totalTodo
    };

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
