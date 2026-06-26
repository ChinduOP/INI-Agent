import { GoogleGenAI } from '@google/genai';
import { ExtractedKnowledgeContext, ParsedExcelData } from '../graph/state.js';
import { SYSTEM_PROMPT } from '../prompts/system_prompt.js';
import { INSTRUCTIONS } from '../prompts/instructions.js';

export class LlmService {
  private static getAiClient(): GoogleGenAI | null {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    return new GoogleGenAI({ apiKey: key });
  }

  private static async callLLMWithRetry(ai: GoogleGenAI, config: any, retries = 3, delayMs = 2000): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        return await ai.models.generateContent(config);
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        const isRetryable = errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE') || errorMsg.includes('429') || errorMsg.includes('high demand') || errorMsg.includes('TOO_MANY_REQUESTS');
        
        if (i === retries - 1 || !isRetryable) {
          throw err;
        }
        console.warn(`LLM call failed (retry ${i + 1}/${retries}). Waiting ${delayMs}ms... Error: ${errorMsg}`);
        await new Promise(r => setTimeout(r, delayMs));
        delayMs *= 2; // exponential backoff
      }
    }
  }

  /**
   * Node 3: Excel Analyzer
   * Uses Gemini LLM (or robust deterministic fallback if API key not present)
   * to analyze workbook worksheets and synthesize ExtractedKnowledgeContext.
   */
  public static async analyzeWorkbook(data: ParsedExcelData, userRequest: string): Promise<ExtractedKnowledgeContext> {
    const ai = this.getAiClient();

    // Default heuristic extraction (ensures 100% reliability even if API key is rate limited or missing)
    const baseContext = this.heuristicAnalyze(data, userRequest);

    if (!ai) {
      console.warn('GEMINI_API_KEY not found. Using structured heuristic analysis for workbook.');
      return baseContext;
    }

    try {
      const prompt = `You are the INI Agent Excel Analyzer.
Review the uploaded Excel sheets (Modules, EDI, Document) and extract structured configuration parameters relevant to the user request: "${userRequest}".

Excel Summary:
${data.rawTextSummary}

Respond strictly in valid JSON format matching this schema:
{
  "modules": ["PurchaseOrder", ...],
  "tradingPartner": "PartnerA",
  "documentTypes": ["850"],
  "ediSettings": { "ISA_Sender_ID": "...", "ISA_Receiver_ID": "...", ... },
  "ids": { ... },
  "qualifiers": { ... },
  "paths": { "OutboundFolder": "...", ... },
  "protocols": ["X12"],
  "delimiters": { "SegmentTerminator": "~", "ElementSeparator": "*", "SubElementSeparator": ":" },
  "version": "4010",
  "additionalBusinessRules": ["Rule 1", ...]
}`;

      const response = await this.callLLMWithRetry(ai, {
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json'
        }
      });

      const text = response.text || '';
      const json = JSON.parse(text);
      return {
        ...baseContext,
        ...json,
        ediSettings: { ...baseContext.ediSettings, ...(json.ediSettings || {}) },
        paths: { ...baseContext.paths, ...(json.paths || {}) },
        delimiters: { ...baseContext.delimiters, ...(json.delimiters || {}) }
      };
    } catch (err) {
      console.error('Error in LLM workbook analysis, falling back to heuristic:', err);
      return baseContext;
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
    userRequest: string
  ): Promise<{ filename: string; content: string }> {
    const ai = this.getAiClient();

    // Deterministic population engine (guarantees formatting preservation rules)
    const fallbackResult = this.heuristicPopulate(templateText, templateFilename, context);

    if (!ai) {
      return fallbackResult;
    }

    try {
      const prompt = `You are the INI Agent Configuration Generator.
Task: Populate the provided raw INI template with data extracted from the user's Excel sheets.

=== SYSTEM RULES ===
${INSTRUCTIONS}

=== EXTRACTED KNOWLEDGE CONTEXT ===
${JSON.stringify(context, null, 2)}

=== USER REQUEST ===
${userRequest}

=== RAW INI TEMPLATE (${templateFilename}) ===
${templateText}

CRITICAL MANDATES:
1. Preserve every comment (; ...) exactly as written. Do not remove or reorder comments.
2. Preserve every [SECTION] exactly. Do not reorder sections or keys.
3. For every key=value line: if the value is known from the knowledge context, fill it. If unknown or empty in context, output key=TODO.
4. Do NOT invent fake IDs, paths, or qualifiers.
5. Return JSON with exact generated filename and exact populated INI text.

Return strictly JSON format:
{
  "filename": "PartnerA_850_OUT.ini",
  "content": "; Exact text..."
}`;

      const response = await this.callLLMWithRetry(ai, {
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json'
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed.filename && parsed.content) {
        return {
          filename: parsed.filename.trim(),
          content: parsed.content
        };
      }
      return fallbackResult;
    } catch (err) {
      console.error('Error generating INI via LLM, using deterministic formatting engine:', err);
      return fallbackResult;
    }
  }

  private static heuristicAnalyze(data: ParsedExcelData, req: string): ExtractedKnowledgeContext {
    const reqLower = req.toLowerCase();
    
    // Find trading partner
    let partner = 'PartnerA';
    if (reqLower.includes('partner b') || reqLower.includes('partnerb')) partner = 'PartnerB';
    else if (reqLower.includes('abc')) partner = 'ABCRetail';
    else if (data.modules.length > 0) partner = data.modules[0].TradingPartner || 'PartnerA';

    // Find doc type
    let docType = '850';
    if (reqLower.includes('810')) docType = '810';
    else if (reqLower.includes('856')) docType = '856';
    else if (reqLower.includes('997')) docType = '997';

    // Extract EDI parameters for this partner
    const ediSettings: Record<string, any> = {};
    const partnerColKey = Object.keys(data.edi[0] || {}).find(k => k.toLowerCase().includes(partner.toLowerCase())) || 'PartnerA_Value';
    
    data.edi.forEach(row => {
      if (row.Parameter) {
        ediSettings[row.Parameter] = row[partnerColKey] || row.Value || '';
      }
    });

    // Extract paths from Document sheet
    const paths: Record<string, any> = {};
    const docRow = data.document.find(d => String(d.DocType) === docType && (String(d.Partner).toLowerCase().includes(partner.toLowerCase()) || !d.Partner)) || data.document[0] || {};
    if (docRow) {
      if (docRow.InboundPath) paths['InboundFolder'] = docRow.InboundPath;
      if (docRow.OutboundPath) paths['OutboundFolder'] = docRow.OutboundPath;
      if (docRow.ArchivePath) paths['ArchiveFolder'] = docRow.ArchivePath;
      if (docRow.BackupPath) paths['BackupFolder'] = docRow.BackupPath;
    }

    // Extract database info
    const modRow = data.modules.find(m => (String(m.TradingPartner).toLowerCase().includes(partner.toLowerCase()))) || data.modules[0] || {};
    const dbName = modRow.DatabaseName || 'EDI_PROD_DB';

    return {
      modules: data.modules.map(m => m.ModuleName).filter(Boolean),
      tradingPartner: partner,
      documentTypes: [docType],
      ediSettings: {
        ...ediSettings,
        DatabaseName: dbName,
        Module: modRow.ModuleName || 'PurchaseOrder'
      },
      ids: {
        ISA_Sender_ID: ediSettings['ISA_Sender_ID'] || '',
        ISA_Receiver_ID: ediSettings['ISA_Receiver_ID'] || '',
        GS_Sender_ID: ediSettings['GS_Sender_ID'] || '',
        GS_Receiver_ID: ediSettings['GS_Receiver_ID'] || '',
        AS2_ID: ediSettings['AS2_ID'] || ''
      },
      qualifiers: {
        StatusQualifier: docRow.StatusQualifier || ''
      },
      paths,
      protocols: [ediSettings['Protocol'] || 'X12'],
      delimiters: {
        SegmentTerminator: ediSettings['SegmentTerminator'] || '~',
        ElementSeparator: ediSettings['ElementSeparator'] || '*',
        SubElementSeparator: ediSettings['SubElementSeparator'] || ':'
      },
      version: ediSettings['Version'] || '4010',
      additionalBusinessRules: [
        `Trading partner ${partner} active in ${modRow.Environment || 'PROD'}`,
        `Direction: ${docRow.Direction || 'OUT'}`
      ]
    };
  }

  private static heuristicPopulate(
    templateText: string,
    templateFilename: string,
    context: ExtractedKnowledgeContext
  ): { filename: string; content: string } {
    const lines = templateText.split(/\r?\n/);
    const outputLines: string[] = [];

    // Combine lookup pool
    const lookupPool: Record<string, any> = {
      Partner: context.tradingPartner,
      Version: context.version,
      Protocol: context.protocols[0] || 'X12',
      ...context.ediSettings,
      ...context.ids,
      ...context.qualifiers,
      ...context.paths,
      ...context.delimiters
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
        
        let val = lookupPool[key];
        if (key.toLowerCase() === 'document') val = docType;
        if (key.toLowerCase() === 'direction') val = lookupPool['Direction'] || dir;

        if (val !== undefined && val !== null && String(val).trim() !== '') {
          outputLines.push(`${leadingSpace}${key}=${val}`);
        } else {
          outputLines.push(`${leadingSpace}${key}=TODO`);
        }
      } else {
        outputLines.push(line);
      }
    });

    // Determine filename
    let filename = `${context.tradingPartner}_${docType}_${dir}.ini`;
    if (templateFilename.toLowerCase().includes('997')) {
      filename = `${context.tradingPartner}_997_ACK.ini`;
    }

    return {
      filename,
      content: outputLines.join('\n')
    };
  }
}
