import { ChatMessage, GeneratedIniResult, LangGraphState } from './state.js';
import { GraphNodes } from './nodes/index.js';

export class LangGraphEngine {
  /**
   * Executes the LangGraph state machine flow for a user request.
   */
  public static async run(
    userRequest: string,
    uploadedExcelPath: string | null,
    uploadedExcelName: string | null,
    chatHistory: ChatMessage[]
  ): Promise<{
    assistantMessage: string;
    generatedIni?: GeneratedIniResult;
    trace: any[];
    needsExcelUpload: boolean;
  }> {
    // Initialize LangGraph State
    let state: LangGraphState = {
      chatHistory,
      uploadedExcelPath,
      uploadedExcelName,
      parsedExcelData: null,
      extractedContext: null,
      selectedTemplatePath: null,
      templateText: null,
      generatedINI: null,
      filename: null,
      validationResult: null,
      userRequest,
      currentNode: 'UploadNode',
      traceLog: [],
      needsExcelUpload: false,
      isGeneralQuestion: false
    };

    // Check if user request is just greeting or general question without asking for INI generation
    const lowerReq = userRequest.toLowerCase().trim();
    const isGreetingOnly = ['hello', 'hi', 'hey', 'help', 'what can you do', 'who are you', 'how does this work'].includes(lowerReq);
    
    if (isGreetingOnly) {
      return {
        assistantMessage: `Hello 👋\n\nI'm your INI Agent.\n\nI can:\n\n• Analyze uploaded Excel files\n• Read Modules, EDI and Document sheets\n• Search your OneDrive template repository\n• Choose the best matching INI template\n• Generate production-ready INI files\n• Preserve template formatting\n• Validate generated configuration\n\n${!uploadedExcelPath ? 'Upload an Excel file to begin.' : 'Your Excel workbook is uploaded! Tell me which Trading Partner or Document INI you want to generate.'}`,
        trace: [{
          node: 'ReceiveInput',
          status: 'completed',
          message: 'General conversational greeting detected.',
          timestamp: Date.now()
        }],
        needsExcelUpload: !uploadedExcelPath
      };
    }

    // Step 1: Upload Node
    let update = await GraphNodes.uploadNode(state);
    state = { ...state, ...update };

    if (state.needsExcelUpload) {
      return {
        assistantMessage: `⚠️ Please upload an Excel workbook (.xlsx) containing Modules, EDI, and Document worksheets before generating INI configuration files.\n\nYou can click the attachment icon below or drag and drop your Excel file into the chat window. (Or click "Load Sample Excel" at the top!)`,
        trace: state.traceLog,
        needsExcelUpload: true
      };
    }

    // Step 2: Excel Reader
    update = await GraphNodes.excelReaderNode(state);
    state = { ...state, ...update };

    if (state.currentNode === 'ResponseNode' && !state.parsedExcelData) {
      return {
        assistantMessage: `❌ Failed to parse the uploaded Excel file. Please ensure it is a valid .xlsx workbook with Modules, EDI, and Document sheets.`,
        trace: state.traceLog,
        needsExcelUpload: false
      };
    }

    // Step 3: Excel Analyzer
    update = await GraphNodes.excelAnalyzerNode(state);
    state = { ...state, ...update };

    // Step 4: Template Finder
    update = await GraphNodes.templateFinderNode(state);
    state = { ...state, ...update };

    if (!state.selectedTemplatePath) {
      return {
        assistantMessage: `❌ Could not find a matching *.ini template in the configured OneDrive repository for your request ("${userRequest}").\n\nCheck the OneDrive templates or try asking for Partner A 850, Partner A 810, Partner B 856, or Partner B 997.`,
        trace: state.traceLog,
        needsExcelUpload: false
      };
    }

    // Step 5: Template Reader
    update = await GraphNodes.templateReaderNode(state);
    state = { ...state, ...update };

    // Step 6 & 7: INI Generator
    update = await GraphNodes.iniGeneratorNode(state);
    state = { ...state, ...update };

    // Step 8: Validator
    update = await GraphNodes.validatorNode(state);
    state = { ...state, ...update };

    // Step 9: Response Node
    update = await GraphNodes.responseNode(state);
    state = { ...state, ...update };

    // Construct Assistant summary text
    const tmplName = state.selectedTemplatePath || 'Template';
    let msg = `✅ **INI Configuration Successfully Generated**\n\n`;
    msg += `• **Trading Partner**: \`${state.extractedContext?.tradingPartner}\`\n`;
    msg += `• **OneDrive Template Used**: \`${tmplName}\`\n`;
    msg += `• **Output Filename**: \`${state.filename}\`\n`;
    
    if (state.validationResult) {
      const v = state.validationResult;
      msg += `• **Validation Status**: ${v.isValid ? '🟢 Valid & Ready' : '🔴 Issues Found'}\n`;
      if (v.errors.length > 0) {
        msg += `  - **Errors (${v.errors.length})**: ${v.errors[0]}${v.errors.length > 1 ? ' ...' : ''}\n`;
      }
      if (v.warnings.length > 0) {
        msg += `  - **Notes (${v.warnings.length})**: ${v.warnings[0]}${v.warnings.length > 1 ? ' ...' : ''}\n`;
      }
    }

    msg += `\nReview the production-ready configuration in the Notepad viewer below. You can copy or download directly to your computer!`;

    const generatedIni: GeneratedIniResult | undefined = (state.filename && state.generatedINI && state.validationResult)
      ? {
          filename: state.filename,
          content: state.generatedINI,
          validationSummary: state.validationResult
        }
      : undefined;

    return {
      assistantMessage: msg,
      generatedIni,
      trace: state.traceLog,
      needsExcelUpload: false
    };
  }
}
