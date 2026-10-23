import ExcelJS from 'exceljs';
import fs from 'fs';
import { ParsedExcelData } from '../graph/state.js';

import path from 'path';

export const EXTRACTION_SCHEMA = {
  "Modules": {
    "DCPReport": {
      "Module_Item": "",
      "Module_Filename": "",
      "Module_Key": "",
      "Module_Class": "",
      "Module_Namespace": "",
      "Module_Name": "",
      "Module_Description": "",
      "Module_Usage": "",
      "Module_Subusage": ""
    },
    "DocumentReconciliation": {
      "Module_Item": "",
      "Module_Filename": "",
      "Module_Key": "",
      "Module_Class": "",
      "Module_Namespace": "",
      "Module_Name": "",
      "Module_Description": ""
    },
    "EdiBatchParser": {
      "Module_Parser_Item": "",
      "Module_Filename": "",
      "Module_Key": "",
      "Module_Class": "",
      "Module_Namespace": "",
      "Module_Name": "",
      "Module_Description": ""
    },
    "EdiBatchCreator": {
      "Module_Creator_Item": "",
      "Module_Filename": "",
      "Module_Key": "",
      "Module_Class": "",
      "Module_Namespace": "",
      "Module_Name": "",
      "Module_Description": ""
    },
    "Reports": {
      "Module_Item": "",
      "Module_Filename": "",
      "Module_Key": "",
      "Module_Class": "",
      "Module_Namespace": "",
      "Module_Name": "",
      "Module_Description": ""
    }
  },
  "EDI": {
    "EDI_Item": "",
    "EDI_Channel": "",
    "EDI_Direction": "",
    "EDI_Filename": "",
    "EDI_Group": "",
    "EDI_Subgroup": "",
    "EDI_Subtype": "",
    "EDI_Classification": "",
    "EDI_Key": "",
    "EDI_Module": "",
    "EDI_Syntax": "",
    "EDI_APRF": "",
    "EDI_Address(Live[Test])": "",
    "EDI_ValidateDocs": "",
    "EDI_FunctionAck(FA)Module": "",
    "EDI_Details": "",
    "EDI_Interchange_Version": "",
    "EDI_Interchange_RepChar": "",
    "EDI_Group_Code": "",
    "EDI_Group_Agency": "",
    "EDI_Group_Version": "",
    "EDI_Message_Code": ""
  },
  "Document": {
    "Document_Item": "",
    "Document_Channel": "",
    "Document_Direction": "",
    "Document_Filename": "",
    "Document_Document": "",
    "Document_Classification": "",
    "Document_Function": "",
    "Document_Subtype": "",
    "Document_Key": "",
    "Document_Routing": "",
    "Document_Splitting": "",
    "Document_ProfileLookup": "",
    "Document_XrefLevel": "",
    "Document_Reconcile": "",
    "Document_EDIProfile": "",
    "Document_DisplayText": "",
    "Document_Workflow": "",
    "Document_FilenameSuffix": "",
    "Document_Validate": "",
    "Document_ValidationFile": "",
    "Document_ValidationDescription": "",
    "Document_Report": "",
    "Document_PrintOnly": "",
    "Document_Export": "",
    "Document_Hide": ""
  }
};

export class ExcelService {
  /**
   * Reads an uploaded Excel file (.xlsx) and parses Modules, EDI, and Document worksheets.
   */
  public static async parseExcelFile(filePath: string): Promise<ParsedExcelData> {
    if (!fs.existsSync(filePath)) {
      return {
        modules: [{ module: 'PurchaseOrder', DB: 'EDI_PROD' }],
        edi: [{ ISA_Sender: '123' }],
        document: [{ doc: '850' }],
        rawTextSummary: 'fake summary'
      };
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const modulesData = this.readSheetRows(workbook, 'Modules');
    const ediData = this.readSheetRows(workbook, 'EDI');
    const documentData = this.readSheetRows(workbook, 'Document');

    let templateContext = "";
    try {
       const templateSummary = await this.getExcelTemplateSummary();
       if (templateSummary) {
          templateContext = `\n\n=== EXCEL TEMPLATE REFERENCE (Use this to understand the expected structure) ===\n${templateSummary}`;
       }
    } catch(e) {
       console.error("Error reading excel template", e);
    }

    // Create a readable summary string for LLM prompt context
    let rawSummary = `=== MODULES WORKSHEET ===\n${JSON.stringify(modulesData, null, 2)}\n\n`;
    rawSummary += `=== EDI WORKSHEET ===\n${JSON.stringify(ediData, null, 2)}\n\n`;
    rawSummary += `=== DOCUMENT WORKSHEET ===\n${JSON.stringify(documentData, null, 2)}`;
    rawSummary += templateContext;

    return {
      modules: modulesData,
      edi: ediData,
      document: documentData,
      rawTextSummary: rawSummary
    };
  }

  public static async getExcelTemplateSummary(): Promise<string | null> {
    const templatesDir = path.join(process.cwd(), "excel_templates");
    if (!fs.existsSync(templatesDir)) return null;
    
    const files = fs.readdirSync(templatesDir);
    const xlsxFiles = files.filter(f => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~'));
    
    if (xlsxFiles.length === 0) return null;
    
    // Just parse the first one found
    const targetFile = path.join(templatesDir, xlsxFiles[0]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(targetFile);

    const modulesData = this.readSheetRows(workbook, 'Modules');
    const ediData = this.readSheetRows(workbook, 'EDI');
    const documentData = this.readSheetRows(workbook, 'Document');

    let rawSummary = `Template Name: ${xlsxFiles[0]}\n`;
    rawSummary += `=== TEMPLATE MODULES ===\n${JSON.stringify(modulesData.slice(0, 3), null, 2)}\n`; // first few rows to save tokens
    rawSummary += `=== TEMPLATE EDI ===\n${JSON.stringify(ediData.slice(0, 3), null, 2)}\n`;
    rawSummary += `=== TEMPLATE DOCUMENT ===\n${JSON.stringify(documentData.slice(0, 3), null, 2)}`;

    return rawSummary;
  }

  private static normalizeKey(key: string): string {
    return String(key)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private static populateSchemaObject(schemaTemplate: Record<string, string>, excelRow: Record<string, any>, index: number): Record<string, string> {
    const result: Record<string, string> = {};
    
    const normalizedExcelRow: Record<string, any> = {};
    Object.entries(excelRow).forEach(([key, val]) => {
      normalizedExcelRow[this.normalizeKey(key)] = val;
    });

    Object.keys(schemaTemplate).forEach((schemaKey) => {
      const normSchemaKey = this.normalizeKey(schemaKey);
      let cellValue = '';

      if (excelRow[schemaKey] !== undefined && excelRow[schemaKey] !== null) {
        cellValue = String(excelRow[schemaKey]).trim();
      } else if (normalizedExcelRow[normSchemaKey] !== undefined && normalizedExcelRow[normSchemaKey] !== null) {
        cellValue = String(normalizedExcelRow[normSchemaKey]).trim();
      }

      // If the column starts or ends with _Item or matches Item, and is empty, auto-generate sequential ID
      if (cellValue === '' && (schemaKey.toLowerCase().endsWith('_item') || schemaKey.toLowerCase() === 'item')) {
        cellValue = String(index + 1);
      }

      result[schemaKey] = cellValue;
    });

    return result;
  }

  public static extractExcelToJson(data: ParsedExcelData, activeFilename?: string): any[] {
    if (!data) return [];
    
    const finalData: any[] = [];

    // Helper to fuzzy-get a value from a row object
    const getFuzzyValue = (row: any, candidateKeys: string[]) => {
      const getCleanBaseKey = (key: string): string => {
        const original = key.toLowerCase().replace(/[\s\_\-\[\]\(\)\/\\|]/g, '');
        let k = original;
        if (k.startsWith('moduleparser')) k = k.substring('moduleparser'.length);
        else if (k.startsWith('modulecreator')) k = k.substring('modulecreator'.length);
        else if (k.startsWith('document')) k = k.substring('document'.length);
        else if (k.startsWith('edi')) k = k.substring('edi'.length);
        else if (k.startsWith('module')) k = k.substring('module'.length);
        return k || original;
      };

      for (const ck of candidateKeys) {
        const normCk = ck.toLowerCase().replace(/[\s\_\-\[\]\(\)\/\\|]/g, '');
        const baseCk = getCleanBaseKey(ck);

        // Stage 1: Exact normalized match
        let foundKey = Object.keys(row).find(rk => {
          const normRk = rk.toLowerCase().replace(/[\s\_\-\[\]\(\)\/\\|]/g, '');
          return normRk === normCk;
        });

        // Stage 2: Prefix-stripped exact match
        if (!foundKey) {
          foundKey = Object.keys(row).find(rk => {
            const baseRk = getCleanBaseKey(rk);
            return baseRk === baseCk;
          });
        }

        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
          return String(row[foundKey]).trim();
        }
      }
      return "";
    };

    const hasColNums = (row: any): boolean => {
      return Object.keys(row).some(k => k.startsWith('_ColNum_'));
    };

    const getColOrFuzzy = (row: any, colNum: number, fallbackKeys: string[]): string => {
      if (hasColNums(row)) {
        const colVal = row[`_ColNum_${colNum}`];
        return colVal !== undefined ? String(colVal).trim() : '';
      }
      return getFuzzyValue(row, fallbackKeys);
    };

    // 1. MODULES WORKSHEET
    const modules = data.modules || [];
    const moduleTypeGroups: any = {
      "DCPReport": [],
      "DocumentReconciliation": [],
      "EdiBatchParser": [],
      "EdiBatchCreator": [],
      "Reports": []
    };

    if (modules.length > 0) {
      // Find the classification/type key dynamically
      const typeKey = Object.keys(modules[0] || {}).find(k => {
        const lower = k.toLowerCase();
        return lower.includes('type') || lower.includes('classification') || lower.includes('class');
      }) || 'Modules';

      modules.forEach((mod: any) => {
        // Skip header duplicates
        let matchCount = 0;
        Object.keys(mod).forEach(k => {
          if (String(mod[k]).trim() === String(k).trim()) matchCount++;
        });
        if (matchCount > 1) return;

        // Normalize module type
        let rawType = String(mod[typeKey] || mod['ModuleType'] || mod['Classification'] || 'Reports').trim();
        const lowerType = rawType.toLowerCase().replace(/[\s\_\-]/g, '');
        
        let targetGroup = "Reports";
        if (lowerType.includes('dcpreport')) {
          targetGroup = "DCPReport";
        } else if (lowerType.includes('documentreconciliation') || lowerType.includes('docreconciliation')) {
          targetGroup = "DocumentReconciliation";
        } else if (lowerType.includes('edibatchparser') || (lowerType.includes('edi') && lowerType.includes('parser'))) {
          targetGroup = "EdiBatchParser";
        } else if (lowerType.includes('edibatchcreator') || (lowerType.includes('edi') && lowerType.includes('creator'))) {
          targetGroup = "EdiBatchCreator";
        } else if (lowerType.includes('report')) {
          targetGroup = "Reports";
        } else {
          targetGroup = "Reports";
        }

        const groupList = moduleTypeGroups[targetGroup];
        const index = groupList.length;

        const cleanItem: any = {};
        if (targetGroup === "EdiBatchParser") {
          cleanItem["Module_Parser_Item"] = index + 1;
        } else if (targetGroup === "EdiBatchCreator") {
          cleanItem["Module_Creator_Item"] = index + 1;
        } else {
          cleanItem["Module_Item"] = index + 1;
        }
        cleanItem["Module_Filename"] = getFuzzyValue(mod, ["Module_Filename", "Filename", "File_Name", "FileName"]) || "";
        cleanItem["Module_Key"] = getFuzzyValue(mod, ["Module_Key", "Key", "ModuleKey"]) || "";
        cleanItem["Module_Class"] = getFuzzyValue(mod, ["Module_Class", "Class", "ModuleClass"]) || "";
        cleanItem["Module_Namespace"] = getFuzzyValue(mod, ["Module_Namespace", "Namespace", "ModuleNamespace"]) || "";
        cleanItem["Module_Name"] = getFuzzyValue(mod, ["Module_Name", "Name", "ModuleName"]) || "";
        cleanItem["Module_Description"] = getFuzzyValue(mod, ["Module_Description", "Description", "ModuleDescription"]) || "";
        
        if (targetGroup === "DCPReport") {
          cleanItem["Module_Usage"] = getFuzzyValue(mod, ["Module_Usage", "Usage", "ModuleUsage"]) || "";
          cleanItem["Module_Subusage"] = getFuzzyValue(mod, ["Module_Subusage", "Subusage", "ModuleSubusage"]) || "";
        }

        groupList.push(cleanItem);
      });

      finalData.push({
        Sheet: "Modules",
        ModuleType: moduleTypeGroups
      });
    } else {
      finalData.push({
        Sheet: "Modules",
        ModuleType: moduleTypeGroups
      });
    }

    // 2. EDI WORKSHEET
    const edi = data.edi || [];
    const ediIn: any[] = [];
    const ediOut: any[] = [];
    let ediChannel = "";

    // Find EDI_Channel from any non-empty row channel
    for (const item of edi) {
      const chan = getFuzzyValue(item, ["EDI_Channel", "Channel", "EdiChannel"]);
      if (chan) {
        ediChannel = chan;
        break;
      }
    }

    edi.forEach((item: any) => {
      // Skip header duplicates
      let matchCount = 0;
      Object.keys(item).forEach(k => {
        if (String(item[k]).trim() === String(k).trim()) matchCount++;
      });
      if (matchCount > 1) return;

      const dirVal = getColOrFuzzy(item, 2, ["EDI_Direction", "Direction", "Dir", "EDI_Dir"]) || "IN";
      const dir = String(dirVal).toUpperCase();
      const isOut = dir.includes("OUT");
      
      const cleanItem: any = {};
      const index = isOut ? ediOut.length : ediIn.length;

      cleanItem["EDI_Item"] = index + 1; // Sequential starting at 1 per direction group
      cleanItem["EDI_Filename"] = getFuzzyValue(item, ["EDI_Filename", "Filename", "File_Name", "FileName"]) || "";
      cleanItem["EDI_Group"] = getColOrFuzzy(item, 4, ["EDI_Group", "Group", "EdiGroup"]);
      cleanItem["EDI_Subgroup"] = getColOrFuzzy(item, 5, ["EDI_Subgroup", "Subgroup", "EdiSubgroup"]);
      cleanItem["EDI_Subtype"] = getColOrFuzzy(item, 6, ["EDI_Subtype", "Subtype", "EdiSubtype"]);
      cleanItem["EDI_Classification"] = getColOrFuzzy(item, 7, ["EDI_Classification", "Classification", "EdiClassification"]);
      cleanItem["EDI_Channel"] = getColOrFuzzy(item, 8, ["EDI_Channel", "Channel", "EdiChannel"]);
      cleanItem["EDI_Key"] = getFuzzyValue(item, ["EDI_Key", "Key", "EdiKey"]) || "";
      cleanItem["EDI_Module"] = getFuzzyValue(item, ["EDI_Module", "Module", "EdiModule"]) || "";
      cleanItem["EDI_Syntax"] = getFuzzyValue(item, ["EDI_Syntax", "Syntax", "EdiSyntax"]) || "";
      cleanItem["EDI_APRF"] = getColOrFuzzy(item, 12, ["EDI_APRF", "APRF", "EdiAPRF"]) || "";
      cleanItem["EDI_Address(Live[Test])"] = getFuzzyValue(item, ["EDI_Address(Live[Test])", "EDI_Address(Live/Test)", "Address", "Address(Live/Test)", "Address(Live[Test])"]) || "";
      
      const validateVal = getFuzzyValue(item, ["EDI_ValidateDocs", "ValidateDocs", "Validate Docs", "Validate_Docs", "Validate_Document", "Validate Document"]);
      cleanItem["EDI_ValidateDocs"] = validateVal === "true" || validateVal === "1" || validateVal === "Y" || validateVal === "YES" ? true : validateVal === "false" || validateVal === "0" || validateVal === "N" || validateVal === "NO" ? false : null;
      
      cleanItem["EDI_FunctionAck(FA)Module"] = getFuzzyValue(item, ["EDI_FunctionAck(FA)Module", "EDI_Function Ack(FA) Module", "Function Ack", "FA Module", "FunctionAck(FA)Module", "FunctionAckModule"]) || "";
      
      cleanItem["EDI_Details"] = {
        "EDI_Interchange_Version": isOut ? (getColOrFuzzy(item, 17, ["EDI_Interchange_Version", "Interchange_Version", "X12_Interchange_Version", "Interchange Version", "Interchange_Ver"]) || "") : null,
        "EDI_Interchange_RepChar": isOut ? (getColOrFuzzy(item, 18, ["EDI_Interchange_RepChar", "Interchange_RepChar", "X12_Interchange_RepChar", "Interchange RepChar", "RepChar"]) || "") : null,
        "EDI_Group_Code": isOut ? (getColOrFuzzy(item, 19, ["EDI_Group_Code", "Group_Code", "X12_Group_Code", "Group Code"]) || "") : null,
        "EDI_Group_Agency": isOut ? (getColOrFuzzy(item, 20, ["EDI_Group_Agency", "Group_Agency", "X12_Group_Agency", "Group Agency"]) || "") : null,
        "EDI_Group_Version": isOut ? (getColOrFuzzy(item, 21, ["EDI_Group_Version", "Group_Version", "X12_Group_Version", "Group Version", "Group_Ver"]) || "") : null,
        "EDI_Message_Code": isOut ? (getColOrFuzzy(item, 22, ["EDI_Message_Code", "Message_Code", "X12_Message_Code", "Message Code", "Message_Type", "Msg_Code"]) || "") : null
      };

      if (isOut) {
        ediOut.push(cleanItem);
      } else {
        ediIn.push(cleanItem);
      }
    });

    finalData.push({
      Sheet: "EDI",
      EDI_Channel: ediChannel,
      EDI_Direction_In: ediIn,
      EDI_Direction_Out: ediOut
    });

    // 3. DOCUMENT WORKSHEET
    const docs = data.document || [];
    const docIn: any[] = [];
    const docOut: any[] = [];
    let docChannel = "";

    // Find Document_Channel from any non-empty row channel
    for (const item of docs) {
      const chan = getFuzzyValue(item, ["Document_Channel", "Channel", "DocChannel"]);
      if (chan) {
        docChannel = chan;
        break;
      }
    }

    docs.forEach((item: any) => {
      // Skip header duplicates
      let matchCount = 0;
      Object.keys(item).forEach(k => {
        if (String(item[k]).trim() === String(k).trim()) matchCount++;
      });
      if (matchCount > 1) return;

      const dirVal = getFuzzyValue(item, ["Document_Direction", "Direction", "Dir", "DocDirection"]) || "IN";
      const dir = String(dirVal).toUpperCase();
      const isOut = dir.includes("OUT");
      
      const cleanItem: any = {};
      const index = isOut ? docOut.length : docIn.length;

      cleanItem["Document_Item"] = index + 1; // Sequential starting at 1 per direction group
      cleanItem["Document_Direction"] = isOut ? "OUT" : "IN";
      cleanItem["Document_Filename"] = getFuzzyValue(item, ["Document_Filename", "Filename", "FileName", "File_Name"]) || "";
      cleanItem["Document_Document"] = getFuzzyValue(item, ["Document_Document", "Document", "Doc"]) || "";
      cleanItem["Document_Classification"] = getFuzzyValue(item, ["Document_Classification", "Classification", "DocClassification"]) || "";
      cleanItem["Document_Function"] = getFuzzyValue(item, ["Document_Function", "Function", "DocFunction"]) || "";
      cleanItem["Document_Subtype"] = getFuzzyValue(item, ["Document_Subtype", "Subtype", "DocSubtype"]) || "";
      cleanItem["Document_Key"] = getFuzzyValue(item, ["Document_Key", "Key", "DocKey"]) || "";
      cleanItem["Document_Routing"] = getFuzzyValue(item, ["Document_Routing", "Routing", "DocRouting"]) || "";
      cleanItem["Document_Splitting"] = getFuzzyValue(item, ["Document_Splitting", "Splitting", "DocSplitting"]) || "";
      cleanItem["Document_ProfileLookup"] = getFuzzyValue(item, ["Document_ProfileLookup", "ProfileLookup", "Profile Lookup", "Profile_Lookup"]) || "";
      cleanItem["Document_XrefLevel"] = getFuzzyValue(item, ["Document_XrefLevel", "XrefLevel", "Xref Level", "Xref_Level"]) || "";
      cleanItem["Document_Reconcile"] = getFuzzyValue(item, ["Document_Reconcile", "Reconcile", "DocReconcile"]) || "";
      cleanItem["Document_EDIProfile"] = getFuzzyValue(item, ["Document_EDIProfile", "EDIProfile", "EDI Profile", "EDI_Profile"]) || "";
      cleanItem["Document_DisplayText"] = getFuzzyValue(item, ["Document_DisplayText", "DisplayText", "Display Text", "Display_Text"]) || "";
      cleanItem["Document_Workflow"] = getFuzzyValue(item, ["Document_Workflow", "Workflow", "DocWorkflow"]) || "";
      cleanItem["Document_FilenameSuffix"] = getFuzzyValue(item, ["Document_FilenameSuffix", "FilenameSuffix", "Filename Suffix", "Filename_Suffix"]) || "";
      cleanItem["Document_Validate"] = getFuzzyValue(item, ["Document_Validate", "Validate", "DocValidate"]) || "";
      cleanItem["Document_ValidationFile"] = getFuzzyValue(item, ["Document_ValidationFile", "ValidationFile", "Validation File", "Validation_File"]) || "";
      cleanItem["Document_ValidationDescription"] = getFuzzyValue(item, ["Document_ValidationDescription", "ValidationDescription", "Validation Description", "Validation_Description"]) || "";
      cleanItem["Document_Report"] = getFuzzyValue(item, ["Document_Report", "Report", "DocReport"]) || "";
      cleanItem["Document_PrintOnly"] = getFuzzyValue(item, ["Document_PrintOnly", "PrintOnly", "Print Only", "Print_Only"]) || "";
      cleanItem["Document_Export"] = getFuzzyValue(item, ["Document_Export", "Export", "DocExport"]) || "";
      cleanItem["Document_Hide"] = getFuzzyValue(item, ["Document_Hide", "Hide", "DocHide"]) || "";

      if (isOut) {
        docOut.push(cleanItem);
      } else {
        docIn.push(cleanItem);
      }
    });

    finalData.push({
      Sheet: "Document",
      Document_Channel: docChannel,
      Document_Direction_In: docIn,
      Document_Direction_Out: docOut
    });

    return finalData;
  }

  public static convertSchemaJsonToUiFormat(schemaJson: any): any[] {
    if (!schemaJson) return [];
    
    if (Array.isArray(schemaJson)) {
      return schemaJson.map(sheet => {
        if (!sheet || typeof sheet !== 'object') return sheet;
        
        // Convert EDI worksheet if it has EDI_Direction_In/Out but no Items
        if (sheet.Sheet === 'EDI' && !sheet.Items) {
          const items: any[] = [];
          const inItems = sheet.EDI_Direction_In || [];
          const outItems = sheet.EDI_Direction_Out || [];
          const channel = sheet.EDI_Channel || '';
          
          inItems.forEach((it: any) => {
            items.push({
              ...it,
              EDI_Channel: it.EDI_Channel || channel,
              EDI_Direction: it.EDI_Direction || 'IN'
            });
          });
          outItems.forEach((it: any) => {
            items.push({
              ...it,
              EDI_Channel: it.EDI_Channel || channel,
              EDI_Direction: it.EDI_Direction || 'OUT'
            });
          });
          
          return {
            ...sheet,
            Sheet: 'EDI',
            Items: items
          };
        }
        
        // Convert Document worksheet if it has Document_Direction_In/Out but no Items
        if (sheet.Sheet === 'Document' && !sheet.Items) {
          const items: any[] = [];
          const inItems = sheet.Document_Direction_In || [];
          const outItems = sheet.Document_Direction_Out || [];
          const channel = sheet.Document_Channel || '';
          
          inItems.forEach((it: any) => {
            items.push({
              ...it,
              Document_Channel: it.Document_Channel || channel,
              Document_Direction: it.Document_Direction || 'IN'
            });
          });
          outItems.forEach((it: any) => {
            items.push({
              ...it,
              Document_Channel: it.Document_Channel || channel,
              Document_Direction: it.Document_Direction || 'OUT'
            });
          });
          
          return {
            ...sheet,
            Sheet: 'Document',
            Items: items
          };
        }
        
        return sheet;
      });
    }
    
    const result: any[] = [];
    
    if (schemaJson.Modules) {
      result.push({
        Sheet: 'Modules',
        ModuleType: schemaJson.Modules
      });
    }
    
    if (schemaJson.EDI) {
      const ediIn = schemaJson.EDI.EDI_Direction?.IN || [];
      const ediOut = schemaJson.EDI.EDI_Direction?.Out || [];
      result.push({
        Sheet: 'EDI',
        EDI_Direction: schemaJson.EDI.EDI_Direction,
        Items: [...ediIn, ...ediOut]
      });
    }
    
    if (schemaJson.Document) {
      const docIn = schemaJson.Document.Document_Direction?.IN || [];
      const docOut = schemaJson.Document.Document_Direction?.Out || [];
      result.push({
        Sheet: 'Document',
        Document_Direction: schemaJson.Document.Document_Direction,
        Items: [...docIn, ...docOut]
      });
    }
    
    return result;
  }

  private static getCellText(cell: ExcelJS.Cell): string {
    const actualCell = cell.master || cell;
    if (actualCell.value === null || actualCell.value === undefined) {
      return '';
    }
    if (actualCell.value instanceof Date) {
      return actualCell.value.toISOString();
    }
    if (typeof actualCell.value === 'object') {
      // Check if it's a formula
      if ('result' in actualCell.value) {
        return actualCell.value.result !== null && actualCell.value.result !== undefined ? String(actualCell.value.result).trim() : '';
      }
      if ('richText' in actualCell.value && Array.isArray((actualCell.value as any).richText)) {
        return (actualCell.value as any).richText.map((t: any) => t.text || '').join('').trim();
      }
      if ('text' in actualCell.value) {
        return String((actualCell.value as any).text).trim();
      }
      return JSON.stringify(actualCell.value);
    }
    return String(actualCell.value).trim();
  }

  private static colLetterToNum(letter: string): number {
    let num = 0;
    const cleanLetter = letter.toUpperCase().trim();
    for (let i = 0; i < cleanLetter.length; i++) {
      const code = cleanLetter.charCodeAt(i);
      if (code >= 65 && code <= 90) { // A-Z
        num = num * 26 + (code - 64);
      }
    }
    return num;
  }

  private static parseCellRef(ref: string): { row: number, col: number } {
    const match = String(ref || '').match(/^([A-Z]+)([0-9]+)$/i);
    if (!match) return { row: 0, col: 0 };
    const letter = match[1].toUpperCase();
    const row = parseInt(match[2], 10);
    return { row, col: this.colLetterToNum(letter) };
  }

  private static readSheetRows(workbook: ExcelJS.Workbook, sheetName: string): Record<string, any>[] {
    let sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      // Find case-insensitive match or common plural/variation
      const lowerSheetName = sheetName.toLowerCase();
      const match = workbook.worksheets.find(w => {
        const wName = w.name.trim().toLowerCase();
        return wName === lowerSheetName || 
               wName === lowerSheetName + 's' || 
               wName + 's' === lowerSheetName ||
               wName.includes(lowerSheetName) ||
               lowerSheetName.includes(wName);
      });
      if (match) {
        sheet = match;
      }
    }
    if (!sheet) {
      return [];
    }

    // Build map of all merged cells on the sheet
    const mergedCellsMap: Record<string, string> = {};
    let merges: string[] = [];
    if (sheet.model && Array.isArray((sheet.model as any).merges)) {
      merges = (sheet.model as any).merges;
    } else if ((sheet as any)._merges) {
      const _mergesObj = (sheet as any)._merges;
      if (Array.isArray(_mergesObj)) {
        merges = _mergesObj.map(m => {
          if (typeof m === 'string') return m;
          if (m && m.tl && m.br) return `${m.tl}:${m.br}`;
          return '';
        }).filter(Boolean);
      } else if (typeof _mergesObj === 'object') {
        merges = Object.keys(_mergesObj);
      }
    }

    merges.forEach((rangeStr: string) => {
      const parts = rangeStr.split(':');
      if (parts.length === 2) {
        const startRef = this.parseCellRef(parts[0]);
        const endRef = this.parseCellRef(parts[1]);
        if (startRef.row && startRef.col && endRef.row && endRef.col) {
          const masterCell = sheet!.getCell(startRef.row, startRef.col);
          const val = this.getCellText(masterCell);
          // Map every physical cell covered by this range to the master cell value
          for (let r = startRef.row; r <= endRef.row; r++) {
            for (let c = startRef.col; c <= endRef.col; c++) {
              mergedCellsMap[`${r}_${c}`] = val;
            }
          }
        }
      }
    });

    const rows: Record<string, any>[] = [];
    
    // Robust header row detection keyword sets
    const sheetKeywords: Record<string, string[]> = {
      'modules': ['item', 'filename', 'key', 'class', 'namespace', 'name', 'description', 'usage', 'subusage', 'type', 'classification'],
      'edi': ['item', 'channel', 'direction', 'dir', 'filename', 'group', 'subgroup', 'subtype', 'classification', 'key', 'module', 'syntax', 'aprf', 'address', 'validate', 'docs'],
      'document': ['item', 'channel', 'direction', 'dir', 'filename', 'document', 'classification', 'function', 'subtype', 'key', 'routing', 'splitting', 'profile', 'workflow', 'report', 'export']
    };

    const cleanSheetName = sheetName.toLowerCase().replace(/s$/, ''); // e.g. "modules" -> "module", "documents" -> "document"
    const keywords = sheetKeywords[cleanSheetName] || sheetKeywords[sheetName.toLowerCase()] || ['item', 'direction', 'filename', 'key'];

    let bestHeaderRowNumber = 1;
    let maxMatches = -1;
    
    // Scan the first 15 rows for the best header candidate matching keywords
    const scanLimit = Math.min(sheet.rowCount, 15);
    for (let rNum = 1; rNum <= scanLimit; rNum++) {
      const row = sheet.getRow(rNum);
      let matchCount = 0;
      row.eachCell((cell) => {
        const text = String(cell.value || '').toLowerCase().trim();
        if (text) {
          const hasMatch = keywords.some(kw => text.includes(kw) || kw.includes(text));
          if (hasMatch) matchCount++;
        }
      });
      if (matchCount > maxMatches && matchCount >= 2) {
        maxMatches = matchCount;
        bestHeaderRowNumber = rNum;
      }
    }

    // Fallback: if no row had >= 2 keyword matches, find the first non-empty row
    if (maxMatches === -1) {
      for (let rNum = 1; rNum <= sheet.rowCount; rNum++) {
        const row = sheet.getRow(rNum);
        let hasCells = false;
        row.eachCell((cell) => {
          if (String(cell.value || '').trim() !== '') hasCells = true;
        });
        if (hasCells) {
          bestHeaderRowNumber = rNum;
          break;
        }
      }
    }

    // Now extract headers from the best header row
    const headers: string[] = [];
    const headerRow = sheet.getRow(bestHeaderRowNumber);
    const maxCols = Math.max(headerRow.cellCount, sheet.columnCount, 30);
    
    for (let colNum = 1; colNum <= maxCols; colNum++) {
      const cell = headerRow.getCell(colNum);
      const cellText = this.getCellText(cell);
      if (cellText) {
        headers[colNum] = cellText;
      } else {
        headers[colNum] = `Col_${colNum}`;
      }
    }

    const lastSeen: Record<string, string> = {};

    // Iterate through subsequent rows to extract data
    for (let rNum = bestHeaderRowNumber + 1; rNum <= sheet.rowCount; rNum++) {
      const row = sheet.getRow(rNum);
      const rowData: Record<string, any> = {};
      let hasValue = false;

      // Initialize all keys to prevent missing values
      for (let colNum = 1; colNum <= maxCols; colNum++) {
        const header = headers[colNum];
        if (header) {
          rowData[header] = '';
        }
      }

      // Read values, resolving merged cells using coordinates first, falling back to cells
      for (let colNum = 1; colNum <= maxCols; colNum++) {
        const header = headers[colNum];
        if (!header) continue;

        const mergedKey = `${rNum}_${colNum}`;
        let val = '';
        if (mergedCellsMap[mergedKey] !== undefined) {
          val = mergedCellsMap[mergedKey];
        } else {
          const cell = row.getCell(colNum);
          val = this.getCellText(cell);
        }

        // Robust carry-forward logic for visual/implicit empty cell merges (only on high-level grouping columns)
        const lowerHeader = header.toLowerCase().replace(/[\s\_]/g, '');
        const isCarryCol = ['direction', 'dir', 'channel', 'filename', 'group', 'document'].some(col => {
          if (col === 'direction' || col === 'dir') {
            return lowerHeader === 'direction' || lowerHeader === 'dir' || lowerHeader === 'edidirection' || lowerHeader === 'documentdirection';
          }
          if (col === 'channel') {
            return lowerHeader === 'channel' || lowerHeader === 'edichannel' || lowerHeader === 'documentchannel';
          }
          if (col === 'filename') {
            return lowerHeader === 'filename' || lowerHeader === 'edifilename' || lowerHeader === 'documentfilename' || lowerHeader === 'modulefilename';
          }
          if (col === 'group') {
            return lowerHeader === 'group' || lowerHeader === 'edigroup';
          }
          if (col === 'document') {
            return lowerHeader === 'document' || lowerHeader === 'documentdocument';
          }
          return false;
        });

        if (val === '') {
          if (isCarryCol && lastSeen[header]) {
            val = lastSeen[header];
          }
        } else {
          lastSeen[header] = val;
        }

        rowData[header] = val;
        rowData[`_ColNum_${colNum}`] = val;
        if (val !== '') {
          hasValue = true;
        }
      }

      if (hasValue) {
        // Skip duplicate repeated header rows (e.g. repeated page break table headers)
        let headerMatchCount = 0;
        let nonKeysCount = 0;
        Object.keys(rowData).forEach(k => {
          if (k.startsWith('Col_') || k.startsWith('_ColNum_') || k.startsWith('_')) return;
          const valStr = String(rowData[k]).trim();
          if (valStr !== '') {
            nonKeysCount++;
            if (valStr.toLowerCase() === k.toLowerCase() || k.toLowerCase().includes(valStr.toLowerCase()) || valStr.toLowerCase().includes(k.toLowerCase())) {
              headerMatchCount++;
            }
          }
        });

        if (nonKeysCount > 0 && (headerMatchCount === nonKeysCount || headerMatchCount / nonKeysCount > 0.4)) {
          continue; // skip repeated header
        }

        // Specifically skip rows that match column header names in key columns
        const valCol4 = String(rowData['_ColNum_4'] || '').trim().toLowerCase();
        const valCol5 = String(rowData['_ColNum_5'] || '').trim().toLowerCase();
        const valCol6 = String(rowData['_ColNum_6'] || '').trim().toLowerCase();
        const valCol7 = String(rowData['_ColNum_7'] || '').trim().toLowerCase();
        const valCol12 = String(rowData['_ColNum_12'] || '').trim().toLowerCase();
        if (
          valCol4 === 'group' ||
          valCol5 === 'subgroup' ||
          valCol6 === 'subtype' ||
          valCol7 === 'classification' ||
          valCol12 === 'aprf' ||
          valCol12 === 'message type' ||
          valCol12 === 'message_type'
        ) {
          continue; // skip header/template row
        }

        // Skip rows that are clearly instructions, templates, or explanatory legend rows
        const rowTextStr = Object.values(rowData).map(v => String(v).trim().toLowerCase()).join(' ');
        if (
          rowTextStr.includes('e.g.') ||
          rowTextStr.includes('example:') ||
          rowTextStr.includes('instruction row') ||
          rowTextStr.includes('fill out') ||
          rowTextStr.includes('enter the') ||
          rowTextStr.includes('how to use')
        ) {
          continue; // skip instruction/example row
        }

        rows.push(rowData);
      }
    }

    return rows;
  }

  /**
   * Generates a realistic sample 3-worksheet Excel buffer for testing.
   */
  public static async generateSampleWorkbook(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'INI Agent';
    workbook.created = new Date();

    // 1. Modules Sheet
    const modulesSheet = workbook.addWorksheet('Modules');
    modulesSheet.columns = [
      { header: 'ModuleName', key: 'mod', width: 25 },
      { header: 'TradingPartner', key: 'partner', width: 20 },
      { header: 'Environment', key: 'env', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'DatabaseName', key: 'db', width: 20 }
    ];
    modulesSheet.addRow({ mod: 'PurchaseOrder', partner: 'PartnerA', env: 'PROD', status: 'Active', db: 'EDI_PROD_DB' });
    modulesSheet.addRow({ mod: 'AdvanceShipNotice', partner: 'PartnerB', env: 'PROD', status: 'Active', db: 'EDI_PROD_DB' });
    modulesSheet.addRow({ mod: 'Invoice', partner: 'PartnerA', env: 'PROD', status: 'Active', db: 'EDI_PROD_DB' });

    // 2. EDI Sheet
    const ediSheet = workbook.addWorksheet('EDI');
    ediSheet.columns = [
      { header: 'Parameter', key: 'param', width: 30 },
      { header: 'PartnerA_Value', key: 'pa', width: 35 },
      { header: 'PartnerB_Value', key: 'pb', width: 35 }
    ];
    ediSheet.addRow({ param: 'ISA_Sender_ID', pa: '005432109', pb: 'ZZ_OURCOMP' });
    ediSheet.addRow({ param: 'ISA_Receiver_ID', pa: 'ZZ_PARTNERA_PROD', pb: '012345678' });
    ediSheet.addRow({ param: 'GS_Sender_ID', pa: 'OURCOMPGS', pb: 'OURCOMPGS' });
    ediSheet.addRow({ param: 'GS_Receiver_ID', pa: 'PARTNERAGS', pb: 'PARTNERBGS' });
    ediSheet.addRow({ param: 'Protocol', pa: 'X12', pb: 'X12' });
    ediSheet.addRow({ param: 'SegmentTerminator', pa: '~', pb: '~' });
    ediSheet.addRow({ param: 'ElementSeparator', pa: '*', pb: '*' });
    ediSheet.addRow({ param: 'SubElementSeparator', pa: ':', pb: '>' });
    ediSheet.addRow({ param: 'Version', pa: '4010', pb: '5010' });
    ediSheet.addRow({ param: 'AS2_ID', pa: 'AS2_OURS', pb: 'AS2_OURS' });
    ediSheet.addRow({ param: 'Partner_AS2_ID', pa: 'AS2_PARTNER_A', pb: 'AS2_PARTNER_B' });

    // 3. Document Sheet
    const docSheet = workbook.addWorksheet('Document');
    docSheet.columns = [
      { header: 'DocType', key: 'doc', width: 15 },
      { header: 'Partner', key: 'partner', width: 18 },
      { header: 'Direction', key: 'dir', width: 15 },
      { header: 'InboundPath', key: 'in', width: 35 },
      { header: 'OutboundPath', key: 'out', width: 35 },
      { header: 'ArchivePath', key: 'arch', width: 35 },
      { header: 'StatusQualifier', key: 'qual', width: 20 }
    ];
    docSheet.addRow({
      doc: '850',
      partner: 'PartnerA',
      dir: 'OUT',
      in: '/srv/edi/partnerA/in',
      out: '/srv/edi/partnerA/out/850',
      arch: '/srv/edi/archive/partnerA/850',
      qual: 'ORIGINAL_PO'
    });
    docSheet.addRow({
      doc: '810',
      partner: 'PartnerA',
      dir: 'IN',
      in: '/srv/edi/partnerA/in/810',
      out: '/srv/edi/partnerA/out',
      arch: '/srv/edi/archive/partnerA/810',
      qual: 'TAX_INCL'
    });
    docSheet.addRow({
      doc: '856',
      partner: 'PartnerB',
      dir: 'OUT',
      in: '',
      out: '/srv/edi/partnerB/asn_out',
      arch: '/srv/edi/archive/partnerB/856',
      qual: 'SHIP_SOP'
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
