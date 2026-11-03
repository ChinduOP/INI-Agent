import React, { useState, useMemo, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Copy, Check, FileText, AlertTriangle, AlertCircle, Database, Folder, ChevronDown } from 'lucide-react';
import { DownloadButton } from './DownloadButton';
import { GeneratedIniResult } from '../../server/graph/state.js';
import { useMappingStore } from '../store/mappingStore';
import { useChatStore } from '../store/chatStore';
import { buildFolderHierarchy } from '../utils/folderParser';

interface NotepadViewerProps {
  results: GeneratedIniResult[];
}

export const NotepadViewer: React.FC<NotepadViewerProps> = ({ results }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState<string>('All');
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const folderMenuRef = useRef<HTMLDivElement>(null);
  const theme = useChatStore(s => s.theme);
  
  if (!results || results.length === 0) {
    return <div className="p-4 theme-muted">No content to display.</div>;
  }

  // Close folder menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) {
        setIsFolderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { hierarchy, folderMap, uniqueKeys } = useMemo(() => {
    return buildFolderHierarchy(results);
  }, [results]);

  // Keep selectedFolder valid if results change
  useEffect(() => {
    if (selectedFolder !== 'All' && !uniqueKeys.includes(selectedFolder)) {
      setSelectedFolder('All');
    }
  }, [uniqueKeys, selectedFolder]);

  // Filter results by selected folder key (e.g. 'Profile/Documents' or 'Validations/Documents')
  const filteredResults = useMemo(() => {
    if (selectedFolder === 'All') return results;
    return results.filter(r => folderMap.get(r)?.fullKey === selectedFolder);
  }, [results, selectedFolder, folderMap]);

  // If selectedIndex is out of bounds for the filtered results, reset it to 0
  useEffect(() => {
    setSelectedIndex(0);
  }, [selectedFolder]);

  // Determine active display label for folder
  const activeFolderDisplay = useMemo(() => {
    if (selectedFolder === 'All') {
      if (uniqueKeys.length === 1) {
        for (const group of Object.values(hierarchy)) {
          const match = group.subfolders.find(s => s.fullKey === uniqueKeys[0]);
          if (match) return match.displayLabel;
        }
        return uniqueKeys[0] || 'All Folders';
      }
      return `All Folders (${results.length})`;
    }
    for (const group of Object.values(hierarchy)) {
      const match = group.subfolders.find(s => s.fullKey === selectedFolder);
      if (match) return match.displayLabel;
    }
    return selectedFolder;
  }, [selectedFolder, hierarchy, results.length, uniqueKeys]);
  
  const result = filteredResults[selectedIndex] || filteredResults[0] || results[0];
  if (!result) {
    return <div className="p-4 theme-muted">No content to display.</div>;
  }

  const validationSummary = result.validationSummary || { isValid: true, errors: [], warnings: [], missingKeysCount: 0, todoCount: 0 };
  const safeFilename = result.filename || 'generated.ini';
  const sanitizedFilename = safeFilename.replace(/[^a-z0-9]/gi, '_');
  const [copied, setCopied] = useState(false);
  const [showValidationDetails, setShowValidationDetails] = useState(false);
  const [showRawData, setShowRawData] = useState(false);
  const [leftWidth, setLeftWidth] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const [schemaData, setSchemaData] = useState<any>(null);

  const { globalMappings, tabularMappings } = useMappingStore();

  // Reset selectedIndex if results change
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  React.useEffect(() => {
    fetch('/api/upload/data')
      .then(res => res.json())
      .then(data => {
        if (data && data.schemaData) {
          setSchemaData(data.schemaData);
        } else if (data && data.data) {
          setSchemaData(data.data);
        }
      })
      .catch(console.error);
  }, [results]);

  const sanitizedContext = result.extractedContext ? { ...result.extractedContext } : null;
  if (sanitizedContext) {
    const unwantedKeys = ["ediSettings", "ids", "qualifiers", "paths", "protocols", "delimiters", "version", "additionalBusinessRules"];
    unwantedKeys.forEach(k => delete (sanitizedContext as any)[k]);
  }

  const editorLanguage = useMemo(() => {
    const fn = (result.filename || '').toLowerCase();
    if (fn.endsWith('.xml') || (result.content && (result.content.trim().startsWith('<?xml') || result.content.trim().startsWith('<')))) {
      return 'xml';
    }
    if (fn.endsWith('.json') || (result.content && result.content.trim().startsWith('{'))) {
      return 'json';
    }
    if (fn.endsWith('.sql')) {
      return 'sql';
    }
    return 'ini';
  }, [result.filename, result.content]);

  // Shared helpers for fuzzy lookup of Excel columns
  const getFuzzyValue = (row: any, candidateKeys: string[]): string => {
    if (!row) return "";
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
    return Object.keys(row || {}).some(k => k.startsWith('_ColNum_'));
  };

  const getColOrFuzzy = (row: any, colNum: number, fallbackKeys: string[]): string => {
    const namedValue = getFuzzyValue(row, fallbackKeys);
    if (namedValue !== '') {
      return namedValue;
    }

    const hasNamedHeaders = Object.keys(row || {}).some(k => !k.startsWith('_ColNum_') && !k.startsWith('Col_') && !k.startsWith('_'));
    if (hasColNums(row) && !hasNamedHeaders) {
      const colVal = row[`_ColNum_${colNum}`];
      return colVal !== undefined ? String(colVal).trim() : '';
    }
    return '';
  };

  let displayData: any = null;
  
  const formatExcelToUserSchema = (parsed: any): any[] => {
    if (!parsed) return [];

    // 1. MODULES
    const mods = parsed.modules || [];
    const moduleTypeGroups: any = {
      "DCPReport": [],
      "DocumentReconciliation": [],
      "EdiBatchParser": [],
      "EdiBatchCreator": [],
      "Reports": []
    };

    const modulesTypeKey = Object.keys(mods[0] || {}).find(k => {
      const lower = k.toLowerCase();
      return lower.includes('type') || lower.includes('classification') || lower.includes('class');
    }) || 'ModuleType';

    mods.forEach((mod: any, idx: number) => {
      let rawType = String(mod[modulesTypeKey] || mod['ModuleType'] || mod['Classification'] || 'Reports').trim();
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

    // 2. EDI
    const edi = parsed.edi || [];
    const ediIn: any[] = [];
    const ediOut: any[] = [];
    let ediChannel = "";

    for (const item of edi) {
      const chan = getFuzzyValue(item, ["EDI_Channel", "Channel", "EdiChannel"]);
      if (chan) {
        ediChannel = chan;
        break;
      }
    }

    edi.forEach((item: any) => {
      const dirVal = getColOrFuzzy(item, 2, ["EDI_Direction", "Direction", "Dir", "EDI_Dir"]) || "IN";
      const dir = String(dirVal).toUpperCase();
      const isOut = dir.includes("OUT");
      
      const cleanItem: any = {};
      const index = isOut ? ediOut.length : ediIn.length;

      cleanItem["EDI_Item"] = index + 1;
      cleanItem["EDI_Filename"] = getFuzzyValue(item, ["EDI_Filename", "Filename", "File_Name", "FileName"]) || "";
      cleanItem["EDI_Group"] = getColOrFuzzy(item, 4, ["EDI_Group", "Group", "EdiGroup"]);
      cleanItem["EDI_Subgroup"] = getColOrFuzzy(item, 5, ["EDI_Subgroup", "Subgroup", "EdiSubgroup"]);
      cleanItem["EDI_Subtype"] = getColOrFuzzy(item, 6, ["EDI_Subtype", "Subtype", "EdiSubtype"]);
      cleanItem["EDI_Classification"] = getColOrFuzzy(item, 7, ["EDI_Classification", "Classification", "EdiClassification"]);
      cleanItem["EDI_Key"] = getFuzzyValue(item, ["EDI_Key", "Key", "EdiKey"]) || "";
      cleanItem["EDI_Module"] = getFuzzyValue(item, ["EDI_Module", "Module", "EdiModule"]) || "";
      cleanItem["EDI_Module/Transform Sets"] = getFuzzyValue(item, ["EDI_Module/Transform Sets", "EDI_Module_Transform_Sets", "Module/Transform Sets", "Module/Transform Set", "Transform Sets", "Transform Set"]) || "";
      cleanItem["EDI_Syntax"] = getFuzzyValue(item, ["EDI_Syntax", "Syntax", "EdiSyntax"]) || "";
      cleanItem["EDI_APRF"] = getColOrFuzzy(item, 12, ["EDI_APRF", "APRF", "EdiAPRF"]) || "";
      cleanItem["EDI_Address(Live[Test])"] = getFuzzyValue(item, ["EDI_Address(Live[Test])", "EDI_Address(Live/Test)", "Address", "Address(Live/Test)", "Address(Live[Test])"]) || "";
      
      const validateVal = getFuzzyValue(item, ["EDI_ValidateDocs", "ValidateDocs", "Validate Docs", "Validate_Docs", "Validate_Document", "Validate Document"]);
      cleanItem["EDI_ValidateDocs"] = validateVal === "true" || validateVal === "1" || validateVal === "Y" || validateVal === "YES" ? true : validateVal === "false" || validateVal === "0" || validateVal === "N" || validateVal === "NO" ? false : null;
      
      cleanItem["EDI_FunctionAck(FA)Module"] = getFuzzyValue(item, ["EDI_FunctionAck(FA)Module", "EDI_Function Ack(FA) Module", "Function Ack", "FA Module", "FunctionAck(FA)Module", "FunctionAckModule"]) || "";
      
      const syntaxStr = String(cleanItem["EDI_Syntax"] || "").toUpperCase();
      const isEdifact = syntaxStr.includes("EDIFACT") || syntaxStr.includes("EANCOM") || syntaxStr.includes("UN");

      if (isEdifact) {
        cleanItem["EDI_X12Details"] = {
          "EDI_X12Interchange_Version": "",
          "EDI_X12Interchange_RepChar": "",
          "EDI_X12Group_Code": "",
          "EDI_X12Group_Agency": "",
          "EDI_X12Group_Version": "",
          "EDI_X12Message_Code": ""
        };

        cleanItem["EDI_EANCOMDetails"] = {
          "EDI_EANCOMInterchange_Identifier": getColOrFuzzy(item, 16, ["EDI_EANCOMInterchange_Identifier", "EANCOMInterchangeIdentifier", "EDI_Interchange_Identifier", "Interchange_Identifier"]) || "",
          "EDI_EANCOMInterchange_Version": getColOrFuzzy(item, 17, ["EDI_EANCOMInterchange_Version", "EANCOMInterchangeVersion", "EDI_Interchange_Version", "Interchange_Version"]) || "",
          "EDI_EANCOMMessage_Agency": getColOrFuzzy(item, 19, ["EDI_EANCOMMessage_Agency", "EANCOMMessageAgency", "EDI_Group_Code", "Group_Code"]) || "",
          "EDI_EANCOMMessage_Version": getColOrFuzzy(item, 20, ["EDI_EANCOMMessage_Version", "EANCOMMessageVersion", "EDI_Group_Agency", "Group_Agency"]) || "",
          "EDI_EANCOMMessage_Release": getColOrFuzzy(item, 21, ["EDI_EANCOMMessage_Release", "EANCOMMessageRelease", "EDI_Group_Version", "Group_Version"]) || "",
          "EDI_EANCOMMessage_Association": getColOrFuzzy(item, 22, ["EDI_EANCOMMessage_Association", "EANCOMMessageAssociation"]) || "",
          "EDI_EANCOMMessage_Code": getColOrFuzzy(item, 23, ["EDI_EANCOMMessage_Code", "EANCOMMessageCode", "EDI_Message_Code", "Message_Code"]) || getColOrFuzzy(item, 22, ["EDI_EANCOMMessage_Code", "EDI_Message_Code", "Message_Code"]) || ""
        };
      } else {
        cleanItem["EDI_X12Details"] = {
          "EDI_X12Interchange_Version": getColOrFuzzy(item, 17, ["EDI_X12Interchange_Version", "EDI_Interchange_Version", "Interchange_Version", "X12_Interchange_Version", "Interchange Version", "Interchange_Ver"]) || "",
          "EDI_X12Interchange_RepChar": getColOrFuzzy(item, 18, ["EDI_X12Interchange_RepChar", "EDI_Interchange_RepChar", "Interchange_RepChar", "X12_Interchange_RepChar", "Interchange RepChar", "RepChar"]) || "",
          "EDI_X12Group_Code": getColOrFuzzy(item, 19, ["EDI_X12Group_Code", "EDI_Group_Code", "Group_Code", "X12_Group_Code", "Group Code"]) || "",
          "EDI_X12Group_Agency": getColOrFuzzy(item, 20, ["EDI_X12Group_Agency", "EDI_Group_Agency", "Group_Agency", "X12_Group_Agency", "Group Agency"]) || "",
          "EDI_X12Group_Version": getColOrFuzzy(item, 21, ["EDI_X12Group_Version", "EDI_Group_Version", "Group_Version", "X12_Group_Version", "Group Version", "Group_Ver"]) || "",
          "EDI_X12Message_Code": getColOrFuzzy(item, 22, ["EDI_X12Message_Code", "EDI_Message_Code", "Message_Code", "X12_Message_Code", "Message Code", "Message_Type", "Msg_Code"]) || ""
        };

        cleanItem["EDI_EANCOMDetails"] = {
          "EDI_EANCOMInterchange_Identifier": "",
          "EDI_EANCOMInterchange_Version": "",
          "EDI_EANCOMMessage_Agency": "",
          "EDI_EANCOMMessage_Version": "",
          "EDI_EANCOMMessage_Release": "",
          "EDI_EANCOMMessage_Association": "",
          "EDI_EANCOMMessage_Code": ""
        };
      }

      if (isOut) {
        ediOut.push(cleanItem);
      } else {
        ediIn.push(cleanItem);
      }
    });

    // 3. DOCUMENT
    const docs = parsed.document || [];
    const docIn: any[] = [];
    const docOut: any[] = [];
    let docChannel = "";

    for (const item of docs) {
      const chan = getFuzzyValue(item, ["Document_Channel", "Channel", "DocChannel"]);
      if (chan) {
        docChannel = chan;
        break;
      }
    }

    docs.forEach((item: any) => {
      const dirVal = getFuzzyValue(item, ["Document_Direction", "Direction", "Dir", "DocDirection"]) || "IN";
      const dir = String(dirVal).toUpperCase();
      const isOut = dir.includes("OUT");
      
      const cleanItem: any = {};
      const index = isOut ? docOut.length : docIn.length;

      cleanItem["Document_Item"] = index + 1;
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
      cleanItem["Document_Manual"] = getFuzzyValue(item, ["Document_Manual", "Manual", "DocManual"]) || "";
      cleanItem["Document_FilenameSuffix"] = getFuzzyValue(item, ["Document_FilenameSuffix", "FilenameSuffix", "Filename Suffix", "Filename_Suffix"]) || "";
      cleanItem["Document_Validate"] = getFuzzyValue(item, ["Document_Validate", "Validate", "DocValidate"]) || "";
      cleanItem["Document_Syntax"] = getFuzzyValue(item, ["Document_Syntax", "Syntax", "DocSyntax"]) || "";
      cleanItem["Document_ValidationFile"] = getFuzzyValue(item, ["Document_ValidationFile", "ValidationFile", "Validation File", "Validation_File"]) || "";
      cleanItem["Document_ValidationDescription"] = getFuzzyValue(item, ["Document_ValidationDescription", "ValidationDescription", "Validation Description", "Validation_Description"]) || "";
      cleanItem["Document_Report"] = getFuzzyValue(item, ["Document_Report", "Report", "DocReport"]) || "";
      cleanItem["Document_PrintOnly"] = getFuzzyValue(item, ["Document_PrintOnly", "PrintOnly", "Print Only", "Print_Only"]) || "";
      cleanItem["Document_Export"] = getFuzzyValue(item, ["Document_Export", "Export", "DocExport"]) || "";
      cleanItem["Document_Hide"] = getFuzzyValue(item, ["Document_Hide", "Hide", "DocHide"]) || "";
      cleanItem["Document_Labels"] = getFuzzyValue(item, ["Document_Labels", "Labels", "DocLabels"]) || "";
      cleanItem["Document_Duplicates"] = getFuzzyValue(item, ["Document_Duplicates", "Duplicates", "DocDuplicates"]) || "";

      if (isOut) {
        docOut.push(cleanItem);
      } else {
        docIn.push(cleanItem);
      }
    });

    return [
      {
        Sheet: "Modules",
        ModuleType: moduleTypeGroups
      },
      {
        Sheet: "EDI",
        EDI_Channel: ediChannel,
        EDI_Direction_In: ediIn,
        EDI_Direction_Out: ediOut
      },
      {
        Sheet: "Document",
        Document_Channel: docChannel,
        Document_Direction_In: docIn,
        Document_Direction_Out: docOut
      }
    ];
  };

  if (result.parsedExcelData) {
    displayData = formatExcelToUserSchema(result.parsedExcelData);
  } else if (result.extractedContext?.extractedJson) {
    displayData = result.extractedContext.extractedJson;
  } else if (schemaData) {
    displayData = schemaData;
  } else if (sanitizedContext) {
    displayData = sanitizedContext;
  }

  const rawDataLeft = displayData ? JSON.stringify(displayData, null, 2) : 'No extracted context available.';
  
  // Build dynamic Mapped Key/Values panel
  let tempRawDataRight = '';
  const context: any = result.extractedContext || {};
  
  // Find global trading partner keys / activation keys
  const tpKey = context.globalKeys?.['G_TP.PACK-ISO'] || context.tradingPartnerKey || getFuzzyValue(context.customMappings, ["G_TP.PACK-ISO", "TP KEY", "TPKEY", "tpkey", "TP_KEY", "tradingpartnerkey"]) || 'TRADER.JOES-US';
  
  const parsedExcel: any = result.parsedExcelData || {};
  const rawEdiRows = parsedExcel.edi || [];
  const rawDocumentRows = parsedExcel.document || [];
  const rawModuleRows = parsedExcel.modules || [];

  // Extract TP Display Name strictly from module descriptions or context
  let tpDisplayName = context.globalKeys?.['G_TPDisplayName'] || context.tradingPartnerDisplayName || "";
  
  // Guard against invalid display names like "Label.Carton.4x6.1up" or generic terms
  const isInvalidTpDisplayName = (val: string) => {
    if (!val || val.length < 2) return true;
    const u = val.toUpperCase();
    if (u.startsWith('LABEL.') || u.includes('.4X6') || u.includes('1UP') || u.includes('CARTON') || ['TRADING PARTNER', 'TRADING.PARTNER', 'EDI', 'MODULE', 'DOCUMENT', 'N/A', 'PARSER', 'CREATOR'].includes(u)) {
      return true;
    }
    return false;
  };

  if (isInvalidTpDisplayName(tpDisplayName)) {
    tpDisplayName = "";
    if (rawModuleRows && rawModuleRows.length > 0) {
      for (const mod of rawModuleRows) {
        // ONLY search Module_Description / Modules_Description / Description / Desc (do NOT match Module_Name or Name!)
        const desc = getFuzzyValue(mod, ["Module_Description", "Modules_Description", "Description", "Desc"]);
        if (desc) {
          let cleaned = String(desc).trim();
          cleaned = cleaned.replace(/^(parses?|processes?|creates?|generates?|handles?|reads?|writes?|module\s+for|parser\s+for|creator\s+for|processor\s+for|inbound|outbound)\s+/i, '');
          cleaned = cleaned.replace(/\s+(planning\s+schedules?|purchase\s+order\s+parser|purchase\s+orders?|order\s+creator|order\s+parser|invoice\s+parser|invoice\s+creator|invoices?|credit\s+note|asn\s+parser|asn|schedule|orders?|parser|creator|batch|report|inbound|outbound|schedule|810|812|820|824|830|832|846|850|852|855|856|860|864|867|870|940|945|997)\b.*$/i, '').trim();
          cleaned = cleaned.replace(/\b(810|812|820|824|830|832|846|850|852|855|856|860|864|867|870|940|945|997)\b/gi, '').trim();
          cleaned = cleaned.replace(/[\:\_\-\/\\|]+/g, ' ').trim();

          const words = cleaned.split(/\s+/).filter(Boolean);
          const titleWords = words.map((w: string) => {
            if (w.toUpperCase() === 'JOES') return "Joe's";
            return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
          });
          const res = titleWords.join(' ').trim();

          if (!isInvalidTpDisplayName(res)) {
            tpDisplayName = res;
            break;
          }
        }
      }
    }
  }

  // Fallback: format tpKey into Title Case with spaces
  if (isInvalidTpDisplayName(tpDisplayName)) {
    if (tpKey && !isInvalidTpDisplayName(tpKey)) {
      let clean = tpKey.trim();
      if (clean.toUpperCase().includes('TRADER.JOES') || clean.toUpperCase().includes('TRADER_JOES') || clean.toUpperCase().includes('TRADERJOES')) {
        tpDisplayName = "Trader Joe's";
      } else {
        clean = clean.replace(/-[A-Z]{2,3}$/i, '').replace(/[\._\-]/g, ' ').trim();
        tpDisplayName = clean.split(/\s+/).map((w: string) => {
          if (w.toUpperCase() === 'JOES') return "Joe's";
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        }).join(' ');
      }
    }
  }

  if (!tpDisplayName || isInvalidTpDisplayName(tpDisplayName)) {
    tpDisplayName = "Trader Joe's";
  }

  const tpNameWS = context.globalKeys?.['G_TPNameWS'] || context.tradingPartnerNameWS || tpDisplayName.replace(/[^a-zA-Z0-9]/g, '');

  tempRawDataRight += `[Global]\nG_TP.PACK-ISO =${tpKey}\nG_TPDisplayName =${tpDisplayName}\nG_TPNameWS =${tpNameWS}\n`;
  if (context.globalKeys) {
    Object.entries(context.globalKeys).forEach(([gK, gV]) => {
      if (!['G_TP.PACK-ISO', 'G_TPDisplayName', 'G_TPNameWS'].includes(gK)) {
        tempRawDataRight += `${gK} =${gV}\n`;
      }
    });
  }
  tempRawDataRight += `\n`;

  // Gather unique blocks to print under Mapped Key/Values.
  // We want to support separate sections for each distinct generated document type / filename,
  // such as 810 Invoice and 810 Credit Note, which have separate filenames.
  interface MappingBlock {
    aprf: string;
    ediRow: any;
    matchedDocRows: any[];
    docDocName: string;
  }
  const mappingBlocks: MappingBlock[] = [];

  // Filter rawEdiRows to match the document types actually present in the generated results' filenames
  const resultFilenames = results.map(r => r.filename.replace(/\.ini$/i, '').toLowerCase());

  // Try to build mapping blocks based on actual generated results' filenames first
  rawEdiRows.forEach((ediRow: any) => {
    const filename = getFuzzyValue(ediRow, ["EDI_Filename", "Filename", "File_Name", "FileName"]).trim();
    if (!filename) return;
    const normFile = filename.toLowerCase();

    const isGenerated = resultFilenames.some(rf => rf === normFile || rf.includes(normFile) || normFile.includes(rf));
    if (isGenerated) {
      const aprf = getColOrFuzzy(ediRow, 12, ["EDI_APRF", "APRF", "EdiAPRF", "aprf", "message type", "message_type"]).trim() || "850";
      
      // Match Document rows specifically by Document_Filename matching this EDI filename
      let matchedDocRows = rawDocumentRows.filter((docRow: any) => {
        const docFile = getFuzzyValue(docRow, ["Document_Filename", "Filename", "FileName", "File_Name"]).trim();
        return docFile.toLowerCase() === normFile;
      });

      // Fallback: match by APRF if filename match is empty
      if (matchedDocRows.length === 0) {
        matchedDocRows = rawDocumentRows.filter((docRow: any) => {
          const docDoc = getFuzzyValue(docRow, ["Document_Document", "Document", "Doc"]).trim();
          return docDoc.toLowerCase().includes(aprf.toLowerCase());
        });
      }

      const firstDoc = matchedDocRows[0] || {};
      const docDocName = getFuzzyValue(firstDoc, ["Document_Document", "Document", "Doc"]) || "Document_Document";

      // To prevent exact duplicate blocks, check if we already added a block for this filename
      const exists = mappingBlocks.some(b => {
        const bFile = getFuzzyValue(b.ediRow, ["EDI_Filename", "Filename", "File_Name", "FileName"]).trim().toLowerCase();
        return bFile === normFile;
      });

      if (!exists) {
        mappingBlocks.push({
          aprf,
          ediRow,
          matchedDocRows,
          docDocName
        });
      }
    }
  });

  // Fallback: if no generated files matched EDI row filenames (or results list is empty), fall back to unique APRFs
  if (mappingBlocks.length === 0) {
    let uniqueAprfs: string[] = [];
    if (rawEdiRows.length > 0) {
      const rawList = rawEdiRows.map((row: any) => {
        return getColOrFuzzy(row, 12, ["EDI_APRF", "APRF", "EdiAPRF", "aprf", "message type", "message_type"]);
      }).map((s: string) => s.trim()).filter((s: string) => s && s.toLowerCase() !== 'aprf' && s.toLowerCase() !== 'message type' && s.toLowerCase() !== 'message_type');
      
      uniqueAprfs = Array.from(new Set(rawList));
    }

    if (uniqueAprfs.length === 0 && context.documentTypes) {
      uniqueAprfs = context.documentTypes;
    }
    if (uniqueAprfs.length === 0) {
      uniqueAprfs = ['850'];
    }

    uniqueAprfs.forEach((aprf) => {
      const matchedEdiRows = rawEdiRows.filter((row: any) => {
        const rowAprf = getColOrFuzzy(row, 12, ["EDI_APRF", "APRF", "EdiAPRF", "aprf", "message type", "message_type"]).trim();
        return rowAprf.toLowerCase() === aprf.toLowerCase();
      });

      const ediRow = matchedEdiRows[0] || {};
      
      const matchedDocRows = rawDocumentRows.filter((row: any) => {
        const docDoc = getFuzzyValue(row, ["Document_Document", "Document", "Doc"]).trim();
        const docFile = getFuzzyValue(row, ["Document_Filename", "Filename", "FileName", "File_Name"]).trim();
        return docDoc.toLowerCase().includes(aprf.toLowerCase()) || docFile.toLowerCase().includes(aprf.toLowerCase());
      });

      const firstDoc = matchedDocRows[0] || {};
      const docDocName = getFuzzyValue(firstDoc, ["Document_Document", "Document", "Doc"]) || "Document_Document";

      mappingBlocks.push({
        aprf,
        ediRow,
        matchedDocRows,
        docDocName
      });
    });
  }

  // Generate output string for mapping blocks
  mappingBlocks.forEach(({ aprf, ediRow, matchedDocRows, docDocName }) => {
    const firstEdi = ediRow || {};
    const firstDoc = matchedDocRows[0] || {};
    const dirVal = getColOrFuzzy(firstEdi, 2, ["EDI_Direction", "Direction", "Dir", "EDI_Dir"]) || "IN";
    const isOut = dirVal.trim().toUpperCase() === "OUT";

    const ediModuleKey = getFuzzyValue(firstEdi, ["EDI_Module", "Module", "EdiModule"]) || "";
    const matchedModule = rawModuleRows.find((row: any) => {
      const mKey = getFuzzyValue(row, ["Module_Key", "Key", "ModuleKey"]).trim();
      return mKey && ediModuleKey && mKey.toLowerCase() === ediModuleKey.toLowerCase();
    }) || {};

    const getCommaSeparated = (fieldKeys: string[]): string => {
      const list = matchedDocRows
        .map((doc: any) => getFuzzyValue(doc, fieldKeys))
        .filter((s: string) => s && s !== 'I am not sure' && s !== 'N/A' && s.trim() !== '');
      const uniqueList = Array.from(new Set(list));
      return uniqueList.length > 0 ? uniqueList.join(', ') : 'N/A';
    };

    const documentFilenames = getCommaSeparated(["Document_Filename", "Filename", "FileName", "File_Name"]);
    const documentClassification = getCommaSeparated(["Document_Classification", "Classification", "DocClassification"]);
    const documentFunction = getCommaSeparated(["Document_Function", "Function", "DocFunction"]);
    const documentSubtypes = getCommaSeparated(["Document_Subtype", "Subtype", "DocSubtype"]);
    const documentKeys = getCommaSeparated(["Document_Key", "Key", "DocKey"]);
    const documentReconcile = getCommaSeparated(["Document_Reconcile", "Reconcile", "DocReconcile"]);
    const ediProfile = getCommaSeparated(["Document_EDIProfile", "EDIProfile", "EDI Profile", "EDI_Profile"]);
    const displayText = getCommaSeparated(["Document_DisplayText", "DisplayText", "Display Text", "Display_Text"]);
    const workflow = getCommaSeparated(["Document_Workflow", "Workflow", "DocWorkflow"]);
    const filenameSuffix = getCommaSeparated(["Document_FilenameSuffix", "FilenameSuffix", "Filename Suffix", "Filename_Suffix"]);
    const validationFilename = getCommaSeparated(["Document_ValidationFile", "ValidationFile", "Validation File", "Validation_File"]);
    const validationDescription = getCommaSeparated(["Document_ValidationDescription", "ValidationDescription", "Validation Description", "Validation_Description"]);
    const report = getCommaSeparated(["Document_Report", "Report", "DocReport"]);
    const printOnly = getCommaSeparated(["Document_PrintOnly", "PrintOnly", "Print Only", "Print_Only"]);
    const exportField = getCommaSeparated(["Document_Export", "Export", "DocExport"]);
    const hide = getCommaSeparated(["Document_Hide", "Hide", "DocHide"]);

    tempRawDataRight += `[Transaction ${aprf} (from APRF) - Document (${docDocName}) ]\n`;
    tempRawDataRight += `Module_Filename=${getFuzzyValue(matchedModule, ["Module_Filename", "Filename", "File_Name", "FileName"]) || "N/A"}\n`;
    tempRawDataRight += `Module_Key=${getFuzzyValue(matchedModule, ["Module_Key", "Key", "ModuleKey"]) || "N/A"}\n`;
    tempRawDataRight += `Module_Namespace=${getFuzzyValue(matchedModule, ["Module_Namespace", "Namespace", "ModuleNamespace"]) || "N/A"}\n`;
    tempRawDataRight += `Module_Class=${getFuzzyValue(matchedModule, ["Module_Class", "Class", "ModuleClass"]) || "N/A"}\n`;
    tempRawDataRight += `Module_Name=${getFuzzyValue(matchedModule, ["Module_Name", "Name", "ModuleName"]) || "N/A"}\n`;
    tempRawDataRight += `Module_Description=${getFuzzyValue(matchedModule, ["Module_Description", "Description", "ModuleDescription", "Module_Desc", "Desc"]) || "N/A"}\n`;
    tempRawDataRight += `EDI_Filename=${getFuzzyValue(firstEdi, ["EDI_Filename", "Filename", "File_Name", "FileName"]) || "N/A"}\n`;
    tempRawDataRight += `Document_Document=${getFuzzyValue(firstDoc, ["Document_Document", "Document", "Doc"]) || "N/A"}\n`;
    tempRawDataRight += `EDI_Group=${getColOrFuzzy(firstEdi, 4, ["EDI_Group", "Group", "EdiGroup"]) || "N/A"}\n`;
    tempRawDataRight += `EDI_Subgroup=${getColOrFuzzy(firstEdi, 5, ["EDI_Subgroup", "Subgroup", "EdiSubgroup"]) || "N/A"}\n`;
    tempRawDataRight += `EDI_Subtype=${getColOrFuzzy(firstEdi, 6, ["EDI_Subtype", "Subtype", "EdiSubtype"]) || "N/A"}\n`;
    tempRawDataRight += `EDI_Classification=${getColOrFuzzy(firstEdi, 7, ["EDI_Classification", "Classification", "EdiClassification"]) || "N/A"}\n`;
    tempRawDataRight += `EDI_Key=${getFuzzyValue(firstEdi, ["EDI_Key", "Key", "EdiKey"]) || "N/A"}\n`;
    tempRawDataRight += `EDI_Module=${getFuzzyValue(firstEdi, ["EDI_Module", "Module", "EdiModule"]) || "N/A"}\n`;
    tempRawDataRight += `EDI_Syntax=${getFuzzyValue(firstEdi, ["EDI_Syntax", "Syntax", "EdiSyntax"]) || "N/A"}\n`;
    tempRawDataRight += `EDI_APRF=${getColOrFuzzy(firstEdi, 12, ["EDI_APRF", "APRF", "EdiAPRF", "aprf", "message type"]) || aprf}\n`;
    tempRawDataRight += `EDI_Direction=${dirVal}\n`;
    tempRawDataRight += `EDI_FunctionAck(FA)Module=${getFuzzyValue(firstEdi, ["EDI_FunctionAck(FA)Module", "EDI_Function Ack(FA) Module", "Function Ack", "FA Module", "FunctionAck(FA)Module", "FunctionAckModule"]) || "N/A"}\n`;
    tempRawDataRight += `EDI_Interchange_Version=${isOut ? (getColOrFuzzy(firstEdi, 17, ["EDI_Interchange_Version", "Interchange_Version", "X12_Interchange_Version", "Interchange Version", "Interchange_Ver"]) || "N/A") : "null"}\n`;
    tempRawDataRight += `EDI_Interchange_RepChar=${isOut ? (getColOrFuzzy(firstEdi, 18, ["EDI_Interchange_RepChar", "Interchange_RepChar", "X12_Interchange_RepChar", "Interchange RepChar", "RepChar"]) || "N/A") : "null"}\n`;
    tempRawDataRight += `EDI_Group_Code=${isOut ? (getColOrFuzzy(firstEdi, 19, ["EDI_Group_Code", "Group_Code", "X12_Group_Code", "Group Code"]) || "N/A") : "null"}\n`;
    tempRawDataRight += `EDI_Group_Agency=${isOut ? (getColOrFuzzy(firstEdi, 20, ["EDI_Group_Agency", "Group_Agency", "X12_Group_Agency", "Group Agency"]) || "N/A") : "null"}\n`;
    tempRawDataRight += `EDI_Group_Version=${isOut ? (getColOrFuzzy(firstEdi, 21, ["EDI_Group_Version", "Group_Version", "X12_Group_Version", "Group Version", "Group_Ver"]) || "N/A") : "null"}\n`;
    tempRawDataRight += `EDI_Message_Code=${isOut ? (getColOrFuzzy(firstEdi, 22, ["EDI_Message_Code", "Message_Code", "X12_Message_Code", "Message Code", "Message_Type", "Msg_Code"]) || "N/A") : "null"}\n`;
    tempRawDataRight += `Document_Filename=${documentFilenames}\n`;
    tempRawDataRight += `Document_Classification=${documentClassification}\n`;
    tempRawDataRight += `Document_Function=${documentFunction}\n`;
    tempRawDataRight += `Document_Subtype=${documentSubtypes}\n`;
    tempRawDataRight += `Document_Key=${documentKeys}\n`;
    tempRawDataRight += `Document_Reconcile=${documentReconcile}\n`;
    tempRawDataRight += `Document_EDIProfile=${ediProfile}\n`;
    tempRawDataRight += `Document_DisplayText=${displayText}\n`;
    tempRawDataRight += `Document_Workflow=${workflow}\n`;
    tempRawDataRight += `Document_FilenameSuffix=${filenameSuffix}\n`;
    tempRawDataRight += `Document_ValidationFile=${validationFilename}\n`;
    tempRawDataRight += `Document_ValidationDescription=${validationDescription}\n`;
    tempRawDataRight += `Document_Report=${report}\n`;
    tempRawDataRight += `Document_PrintOnly=${printOnly}\n`;
    tempRawDataRight += `Document_Export=${exportField}\n`;
    tempRawDataRight += `Document_Hide=${hide}\n\n`;
  });

  const rawDataRight = tempRawDataRight.trim();

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const container = document.getElementById(`editor-container-${sanitizedFilename}`);
      if (container) {
        const rect = container.getBoundingClientRect();
        const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
        setLeftWidth(Math.min(Math.max(10, newWidth), 90));
      }
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, sanitizedFilename]);


  const handleCopy = () => {
    navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  
  return (
    <div id={`ini-viewer-${sanitizedFilename}-${selectedIndex}`} className="my-4 border theme-border rounded-lg overflow-hidden theme-surface shadow-lg max-w-full">
      {/* Top Banner with exact requested notepad header styling */}
      <div className="theme-surface-elevated px-4 py-2.5 border-b theme-border flex items-center justify-between flex-wrap gap-2 theme-secondary">
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-blue-400" />
          
          {uniqueKeys.length >= 1 ? (
            <div className="relative" ref={folderMenuRef}>
              <button
                type="button"
                onClick={() => setIsFolderMenuOpen(prev => !prev)}
                className="flex items-center gap-2 theme-surface-muted hover:bg-gray-200 dark:hover:bg-neutral-800 text-xs font-mono font-medium theme-primary tracking-wide px-2.5 py-1.5 rounded border theme-border-strong focus:outline-none transition-all shadow-sm cursor-pointer"
                title="Filter by Folder Hierarchy"
              >
                <Folder className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                <span className="font-semibold theme-primary">{activeFolderDisplay}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-neutral-800 theme-muted font-mono">
                  {filteredResults.length}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 theme-muted transition-transform duration-200 ${isFolderMenuOpen ? 'rotate-180 theme-primary' : ''}`} />
              </button>

              {/* Hierarchical Submenu Dropdown */}
              {isFolderMenuOpen && (
                <div className="absolute top-full left-0 mt-1.5 theme-surface-elevated border theme-border rounded-lg shadow-2xl z-50 min-w-[280px] max-h-[380px] overflow-y-auto py-1 text-left backdrop-blur-md">
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider theme-muted border-b theme-border flex items-center justify-between">
                    <span>Folder Hierarchy</span>
                    <span className="theme-muted font-normal">{results.length} total files</span>
                  </div>

                  {/* Option: All Folders */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFolder('All');
                      setIsFolderMenuOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      selectedFolder === 'All'
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'theme-secondary hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-indigo-600 dark:hover:text-indigo-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Folder className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                      <span>All Folders</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-neutral-800 theme-muted font-mono">
                      {results.length}
                    </span>
                  </button>

                  <div className="border-t theme-border/80 my-1" />

                  {/* Grouped by Parent Category (e.g. Profile, Validations) */}
                  {Object.entries(hierarchy).map(([parent, parentGroup]) => (
                    <div key={parent} className="mb-1">
                      {/* Parent Category Header */}
                      <div className="px-3 py-1.5 text-[11px] font-bold tracking-wide text-amber-600 dark:text-amber-400 flex items-center justify-between bg-gray-100/70 dark:bg-neutral-900/70 border-y theme-border/60">
                        <div className="flex items-center gap-1.5">
                          <Folder className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                          <span>{parent}</span>
                        </div>
                        <span className="text-[10px] font-mono theme-muted font-normal">
                          {parentGroup.totalCount} {parentGroup.totalCount === 1 ? 'file' : 'files'}
                        </span>
                      </div>

                      {/* Subfolders under this Parent */}
                      <div className="py-0.5">
                        {parentGroup.subfolders.map(sub => {
                          const isSelected = selectedFolder === sub.fullKey;
                          return (
                            <button
                              key={sub.fullKey}
                              type="button"
                              onClick={() => {
                                setSelectedFolder(sub.fullKey);
                                setIsFolderMenuOpen(false);
                              }}
                              className={`w-full text-left pl-6 pr-3.5 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                                  : 'theme-secondary hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-indigo-600 dark:hover:text-indigo-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="theme-muted font-mono text-xs">↳</span>
                                <FileText className={`w-3 h-3 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-blue-500 dark:text-blue-400'}`} />
                                <span>{sub.subfolder}</span>
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                isSelected 
                                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/50' 
                                  : 'bg-gray-200 dark:bg-neutral-800 theme-muted'
                              }`}>
                                {sub.count} {sub.count === 1 ? 'file' : 'files'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          
          {filteredResults.length > 1 ? (
             <select 
               value={selectedIndex} 
               onChange={(e) => setSelectedIndex(Number(e.target.value))}
               className="theme-surface-muted text-xs font-mono font-semibold theme-primary tracking-wide px-2.5 py-1.5 rounded border theme-border-strong focus:outline-none cursor-pointer"
               title="Select INI File"
             >
               {filteredResults.map((r, i) => <option key={i} value={i} className="theme-surface theme-primary">{r.filename}</option>)}
             </select>
          ) : (
             <span className="font-mono text-sm font-semibold theme-primary tracking-wide">{result.filename}</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs font-medium theme-secondary">Raw Data</span>
            <div className="relative inline-block w-8 h-4">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={showRawData}
                onChange={() => setShowRawData(!showRawData)}
              />
              <div className="block w-8 h-4 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
            </div>
          </label>
          
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors border border-gray-200 dark:border-gray-600 cursor-pointer"
            title="Copy INI text to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          <DownloadButton 
            filename={results.length === 1 && /\.sql$/i.test(result.filename)
              ? result.filename
              : results.length > 1
                ? 'configurations.zip'
                : (result.filename.endsWith('.zip') ? result.filename : result.filename + '.zip')}
            content={results.length === 1 && /\.sql$/i.test(result.filename)
              ? result.content
              : results.length > 1 ? JSON.stringify(results) : JSON.stringify([result])}
            isZip={!(results.length === 1 && /\.sql$/i.test(result.filename))}
          />
        </div>
      </div>

      {/* Validation Summary Bar */}
      <div className={`px-4 py-2 text-xs flex items-center justify-between border-b theme-border ${
        validationSummary.isValid 
          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300' 
          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
      }`}>
        <div className="flex items-center gap-2">
          {validationSummary.isValid ? (
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          <span>
            {validationSummary.isValid 
              ? `LangGraph Validator: Configuration passed integrity checks.`
              : `LangGraph Validator: Found ${validationSummary.errors.length} syntax errors.`}
            {validationSummary.todoCount > 0 && ` (${validationSummary.todoCount} TODO fields requiring manual assignment)`}
          </span>
        </div>

        {(validationSummary.errors.length > 0 || validationSummary.warnings.length > 0) && (
          <button
            onClick={() => setShowValidationDetails(!showValidationDetails)}
            className="underline hover:text-blue-700 dark:hover:text-blue-300 font-medium cursor-pointer"
          >
            {showValidationDetails ? 'Hide Audit Log' : 'View Audit Log'}
          </button>
        )}
      </div>

      {/* Audit Log Dropdown */}
      {showValidationDetails && (
        <div className="bg-gray-50 dark:bg-black/60 px-4 py-3 text-xs border-b theme-border max-h-40 overflow-y-auto space-y-1.5 font-mono">
          {validationSummary.errors.map((err: string, i: number) => (
            <div key={`err-${i}`} className="text-red-600 dark:text-red-400 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          ))}
          {validationSummary.warnings.map((warn: string, i: number) => (
            <div key={`warn-${i}`} className="text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      {/* Monaco Code Editor (Notepad style) */}
      <div id={`editor-container-${sanitizedFilename}`} className="h-[400px] w-full flex relative select-none">
        {showRawData ? (
          <>
            <div style={{ width: `${leftWidth}%` }} className="h-full relative border-r theme-border">
              <div className="absolute top-0 right-4 z-10 px-2 py-1 bg-gray-200/90 dark:bg-gray-800/80 text-xs text-gray-700 dark:text-gray-300 rounded-bl-md shadow">Extracted Context</div>
              <Editor
                height="100%"
                defaultLanguage="json"
                theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                value={rawDataLeft}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  padding: { top: 12, bottom: 12 }
                }}
              />
            </div>
            
            <div 
              className="w-1.5 bg-gray-300 dark:bg-gray-700 hover:bg-blue-500/50 active:bg-blue-500 cursor-col-resize z-20 shrink-0 transition-colors"
              onMouseDown={() => setIsDragging(true)}
            />

            <div style={{ width: `${100 - leftWidth}%` }} className="h-full relative">
              <div className="absolute top-0 right-4 z-10 px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-xs text-blue-800 dark:text-blue-200 rounded-bl-md shadow">Mapped Key/Values</div>
              <Editor
                height="100%"
                defaultLanguage="ini"
                theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                value={rawDataRight}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  padding: { top: 12, bottom: 12 }
                }}
              />
            </div>
          </>
        ) : result.templateContent ? (
          <>
            <div style={{ width: `${leftWidth}%` }} className="h-full relative border-r theme-border">
              <div className="absolute top-0 right-4 z-10 px-2 py-1 bg-gray-200/90 dark:bg-gray-800/80 text-xs text-gray-700 dark:text-gray-300 rounded-bl-md shadow">Template</div>
              <Editor
                height="100%"
                language={editorLanguage}
                theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                value={result.templateContent}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  padding: { top: 12, bottom: 12 }
                }}
              />
            </div>
            
            <div 
              className="w-1.5 bg-gray-300 dark:bg-gray-700 hover:bg-blue-500/50 active:bg-blue-500 cursor-col-resize z-20 shrink-0 transition-colors"
              onMouseDown={() => setIsDragging(true)}
            />

            <div style={{ width: `${100 - leftWidth}%` }} className="h-full relative">
              <div className="absolute top-0 right-4 z-10 px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-xs text-blue-800 dark:text-blue-200 rounded-bl-md shadow">Generated</div>
              <Editor
                height="100%"
                language={editorLanguage}
                theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                value={result.content}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  padding: { top: 12, bottom: 12 }
                }}
              />
            </div>
          </>
        ) : (
          <div className="w-full h-full relative">
            <Editor
              height="100%"
              language={editorLanguage}
              theme={theme === 'dark' ? 'vs-dark' : 'vs'}
              value={result.content}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 12, bottom: 12 }
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom status footer */}
      <div className="theme-surface-elevated px-4 py-1.5 text-[11px] font-mono theme-muted flex justify-between border-t theme-border">
        <span>Encoding: UTF-8</span>
        <span>Lines: {result.content.split('\n').length}</span>
        <span>Size: {result.content.length} Bytes</span>
        <span>Mode: Production Read-Only</span>
      </div>
    </div>
  );
};
