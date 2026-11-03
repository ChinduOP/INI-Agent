import fs from "fs";
import {
  ChatMessage,
  GeneratedIniResult,
  LangGraphState,
  TextMappings,
} from "./state.js";
import { GraphNodes } from "./nodes/index.js";
import { LlmService } from "../services/llm_service.js";

export class LangGraphEngine {
  /**
   * Executes the LangGraph state machine flow for a user request.
   */
  public static async run(
    userRequest: string,
    uploadedExcelPath: string | null,
    uploadedExcelName: string | null,
    chatHistory: ChatMessage[],
    selectedTemplateAttachment?: {
      filename: string;
      path: string;
      content: string;
      selectedFields?: string[];
    } | null,
    textMappings?: TextMappings,
  ): Promise<{
    assistantMessage: string;
    generatedInis?: GeneratedIniResult[];
    trace: any[];
    needsExcelUpload: boolean;
  }> {
    // Initialize LangGraph State
    console.log(`[LangGraphEngine] selectedTemplateAttachment: ${selectedTemplateAttachment ? selectedTemplateAttachment.path : 'None'}`);
    let state: LangGraphState = {
      chatHistory,
      uploadedExcelPath,
      uploadedExcelName,
      parsedExcelData: null,
      extractedContext: null,
      selectedTemplatePath: selectedTemplateAttachment
        ? selectedTemplateAttachment.path
        : null,
      templateText: selectedTemplateAttachment
        ? selectedTemplateAttachment.content
        : null,
      selectedFields: selectedTemplateAttachment?.selectedFields,
      generatedINI: null,
      filename: null,
      validationResult: null,
      userRequest,
      currentNode: "UploadNode",
      traceLog: [],
      needsExcelUpload: false,
      isGeneralQuestion: false,
      textMappings,
      isTemplateManuallyAttached: !!selectedTemplateAttachment,
    };

    // If no template was attached to this specific message, inherit from the most recent Assistant message that generated an INI (or a user attachment)
    if (!state.selectedTemplatePath && chatHistory && chatHistory.length > 0) {
      for (let i = chatHistory.length - 1; i >= 0; i--) {
        const msg = chatHistory[i];

        // Priority 1: Assistant generated INIs (fully preserves manually/automatically selected template content & path)
        if (msg.role === "assistant" && (msg.generatedIni || (msg.generatedInis && msg.generatedInis.length > 0))) {
          const genIni = msg.generatedIni || (msg.generatedInis ? msg.generatedInis[0] : null);
          if (
            genIni && (genIni.templatePath ||
            genIni.templateContent)
          ) {
            state.selectedTemplatePath =
              genIni.templatePath || "previous_template.ini";
            state.templateText = genIni.templateContent || null;
            state.isTemplateManuallyAttached = !!genIni.isTemplateManuallyAttached;
            break;
          }
        }

        // Priority 2: User attachments
        if (
          msg.role === "user" &&
          msg.attachments &&
          msg.attachments.length > 0
        ) {
          const pastIni = msg.attachments.find(
            (a) =>
              a.name.toLowerCase().endsWith(".ini") ||
              a.path?.toLowerCase().endsWith(".ini"),
          );
          if (pastIni && pastIni.path) {
            state.selectedTemplatePath = pastIni.path;
            state.templateText = null;
            state.isTemplateManuallyAttached = true;
            break;
          }
        }
      }
    }

    // Check if user request is just greeting or general question without asking for INI generation
    // Force INI generation if we have an explicit template attached during this turn
    const hasExcel = !!(
      state.uploadedExcelPath &&
      fs.existsSync(state.uploadedExcelPath) &&
      state.uploadedExcelPath !== "/tmp/fake.xlsx"
    );

    let intentResult: { intent: "generate_ini" | "general_chat"; response?: string } = { intent: "generate_ini", response: undefined };
    const reqLower = (userRequest || '').toLowerCase().trim();
    const isSimpleGreeting = /^(hi|hello|hey|greetings|help|who are you|what can you do)[\s!\.]*$/i.test(reqLower);

    if (!selectedTemplateAttachment) {
      if (hasExcel || !isSimpleGreeting) {
        intentResult = { intent: "generate_ini" };
      } else {
        intentResult = await LlmService.classifyIntentAndChat(
          userRequest,
          hasExcel,
          chatHistory,
        );
      }
    }

    if (intentResult.intent === "general_chat") {
      const fallbackMsg = `Hello 👋\n\nI'm your INI Agent.\n\nI can:\n\n• Analyze uploaded Excel files\n• Read Modules, EDI and Document sheets\n• Search your OneDrive template repository\n• Choose the best matching INI template\n• Generate production-ready INI files\n• Preserve template formatting\n• Validate generated configuration\n\n${!hasExcel ? "Upload an Excel file to begin." : "Your Excel workbook is uploaded! Tell me which Trading Partner or Document INI you want to generate."}`;
      return {
        assistantMessage: intentResult.response || fallbackMsg,
        trace: [
          {
            node: "ReceiveInput",
            status: "completed",
            message: "General conversational response provided.",
            timestamp: Date.now(),
          },
        ],
        needsExcelUpload: false,
      };
    }

    // Step 1: Upload Node
    let update = await GraphNodes.uploadNode(state);
    state = { ...state, ...update };

    if (state.needsExcelUpload) {
      if (process.env.TEST_MODE !== "true") {
        return {
          assistantMessage: `I need an Excel workbook first! Could you please upload one (.xlsx) containing Modules, EDI, and Document worksheets?\n\nYou can click the attachment icon below to upload your file.`,
          trace: state.traceLog,
          needsExcelUpload: true,
        };
      }
    }

    // Step 2: Excel Reader
    update = await GraphNodes.excelReaderNode(state);
    state = { ...state, ...update };

    if (state.currentNode === "ResponseNode" && !state.parsedExcelData && !state.selectedTemplatePath && !selectedTemplateAttachment) {
      return {
        assistantMessage: `❌ Failed to parse the uploaded Excel file. Please ensure it is a valid .xlsx workbook with Modules, EDI, and Document sheets.`,
        trace: state.traceLog,
        needsExcelUpload: false,
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
        needsExcelUpload: false,
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
    const tmplName = state.selectedTemplatePath || "Template";
    
    let msg = "";
    if ((state.generatedInis && state.generatedInis.length > 0) || state.filename) {
      msg = `✅ **INI Configuration Successfully Generated**\n\n`;
      msg += `• **Trading Partner**: \`${state.extractedContext?.tradingPartner || 'Unknown'}\`\n`;
      msg += `• **OneDrive Template Used**: \`${tmplName}\`\n`;
      
      if (state.generatedInis && state.generatedInis.length > 0) {
        msg += `• **Output Files**: ${state.generatedInis.map(g => `\`${g.filename}\``).join(", ")}\n`;
      } else if (state.filename) {
        msg += `• **Output Filename**: \`${state.filename}\`\n`;
      }
    } else {
      msg = `❌ **INI Generation Failed**\n\nNo files were generated. Please check your inputs and try again.`;
    }

    if (state.validationResult) {
      const v = state.validationResult;
      msg += `• **Validation Status**: ${v.isValid ? "🟢 Valid & Ready" : "🔴 Issues Found"}\n`;
      if (v.errors.length > 0) {
        msg += `  - **Errors (${v.errors.length})**: ${v.errors[0]}${v.errors.length > 1 ? " ..." : ""}\n`;
      }
      if (v.warnings.length > 0) {
        msg += `  - **Notes (${v.warnings.length})**: ${v.warnings[0]}${v.warnings.length > 1 ? " ..." : ""}\n`;
      }
    }

    msg += `\n\nReview the production-ready configuration in the Notepad viewer below. You can copy or download directly to your computer!`;

    console.log(`[LangGraphEngine] generatedInis: ${JSON.stringify(state.generatedInis)}`);
    console.log(`[LangGraphEngine] state.filename: ${state.filename}`);

    console.log(`[LangGraphEngine] Final state: ${JSON.stringify(state, (key, value) => key === 'templateText' ? '[TEMPLATE]' : value)}`);

    const generatedInis: GeneratedIniResult[] | undefined =
      state.generatedInis && state.generatedInis.length > 0
        ? state.generatedInis.map(g => ({
            ...g,
            templateContent: g.templateContent || state.templateText || undefined,
            templatePath: g.templatePath || state.selectedTemplatePath || undefined,
            isTemplateManuallyAttached: state.isTemplateManuallyAttached,
            validationSummary: state.validationResult || { isValid: true, errors: [], warnings: [], missingKeysCount: 0, todoCount: 0 },
            extractedContext: state.extractedContext || undefined,
            parsedExcelData: state.parsedExcelData || undefined,
          }))
        : undefined;

    console.log(`[LangGraphEngine] generatedInis mapped: ${JSON.stringify(generatedInis)}`);

    return {
      assistantMessage: msg,
      generatedInis,
      trace: state.traceLog,
      needsExcelUpload: false,
    };
  }
}
