import React, { useState, useRef, useEffect, DragEvent } from 'react';
import { useChatStore } from '../store/chatStore';
import { 
  Folder, 
  File, 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Save, 
  FileCode, 
  Check, 
  X, 
  CornerDownLeft, 
  Undo, 
  Redo, 
  LayoutTemplate,
  Search,
  Database,
  Grid,
  Info,
  Layers,
  Sparkles,
  Play,
  Settings,
  HelpCircle,
  Edit,
  Trash2,
  ChevronsDown,
  ChevronsUp,
  Upload,
  FileSpreadsheet,
  Pencil
} from 'lucide-react';

interface CustomKeyMetaData {
  keyName: string;
  prompt: string;
  example: string;
}

const initialCustomKeyDetails: Record<string, CustomKeyMetaData> = {
  'G_TP.PACK-ISO': {
    keyName: 'G_TP.PACK-ISO',
    prompt: 'Find the common trading partner identifier in the workbook, primarily from Modules.Module_Key. Return only the partner key prefix before document or functional suffixes (for example, ACME-US from ACME-US.Orders). Do not use this example as the answer.',
    example: 'TRADER.JOES-US'
  },
  'G_TPDisplayName': {
    keyName: 'G_TPDisplayName',
    prompt: 'Extract the actual human-readable trading partner name from the workbook. Prefer an explicit partner name field; otherwise derive the name from the common partner identifier in Modules.Module_Key. Do not use this example as the answer.',
    example: "Trader Joe's"
  },
  'G_TPNameWS': {
    keyName: 'G_TPNameWS',
    prompt: 'Return the trading partner name for webservice methods using the workbook partner name or common Modules.Module_Key identifier. Remove spaces and non-alphanumeric characters. Do not use this example as the answer.',
    example: 'TraderJoes'
  }
};

interface FileNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  fileType?: 'ini' | 'sql' | 'xml' | 'txt' | 'json' | string;
  content?: string;
  children?: FileNode[];
  isOpen?: boolean;
  path?: string;
}

const initialFiles: FileNode[] = [];

// Fallback garnet hill excel extraction dataset
const garnetHillDefaultExcelData = [
  {
    "Sheet": "Modules",
    "ModuleType": {
      "DCPReport": [
        {
          "Module_Item": 1,
          "Module_Filename": "",
          "Module_Key": "",
          "Module_Class": "",
          "Module_Namespace": "",
          "Module_Name": "",
          "Module_Description": "",
          "Module_Usage": "",
          "Module_Subusage": ""
        },
        {
          "Module_Item": 2,
          "Module_Filename": "",
          "Module_Key": "",
          "Module_Class": "",
          "Module_Namespace": "",
          "Module_Name": "",
          "Module_Description": "",
          "Module_Usage": "",
          "Module_Subusage": ""
        }
      ],
      "DocumentReconciliation": [
        {
          "Module_Item": 1,
          "Module_Filename": "",
          "Module_Key": "",
          "Module_Class": "",
          "Module_Namespace": "",
          "Module_Name": "",
          "Module_Description": ""
        }
      ],
      "EdiBatchParser": [
        {
          "Module_Parser_Item": 1,
          "Module_Filename": "",
          "Module_Key": "",
          "Module_Class": "",
          "Module_Namespace": "",
          "Module_Name": "",
          "Module_Description": ""
        }
      ],
      "EdiBatchCreator": [
        {
          "Module_Creator_Item": 1,
          "Module_Filename": "",
          "Module_Key": "",
          "Module_Class": "",
          "Module_Namespace": "",
          "Module_Name": "",
          "Module_Description": ""
        },
        {
          "Module_Creator_Item": 2,
          "Module_Filename": "",
          "Module_Key": "",
          "Module_Class": "",
          "Module_Namespace": "",
          "Module_Name": "",
          "Module_Description": ""
        },
        {
          "Module_Creator_Item": 3,
          "Module_Filename": "",
          "Module_Key": "",
          "Module_Class": "",
          "Module_Namespace": "",
          "Module_Name": "",
          "Module_Description": ""
        }
      ],
      "Reports": [
        {
          "Module_Item": 1,
          "Module_Filename": "",
          "Module_Key": "",
          "Module_Class": "",
          "Module_Namespace": "",
          "Module_Name": "",
          "Module_Description": ""
        }
      ]
    }
  },
  {
    "Sheet": "EDI",
    "Items": [
      {
        "EDI_Item": 1,
        "EDI_Channel": "",
        "EDI_Direction": "",
        "EDI_Filename": "",
        "EDI_Group": "",
        "EDI_Subgroup": "",
        "EDI_Subtype": "",
        "EDI_Classification": "",
        "EDI_Key": "",
        "EDI_Module": "",
        "EDI_Module/Transform Sets": "",
        "EDI_Syntax": "",
        "EDI_APRF": "",
        "EDI_Address(Live[Test])": "",
        "EDI_ValidateDocs": null,
        "EDI_FunctionAck(FA)Module": "",
        "EDI_X12Details": {
          "EDI_X12Interchange_Version": "",
          "EDI_X12Interchange_RepChar": "",
          "EDI_X12Group_Code": "",
          "EDI_X12Group_Agency": "",
          "EDI_X12Group_Version": "",
          "EDI_X12Message_Code": ""
        },
        "EDI_EANCOMDetails": {
          "EDI_EANCOMInterchange_Identifier": "",
          "EDI_EANCOMInterchange_Version": "",
          "EDI_EANCOMMessage_Agency": "",
          "EDI_EANCOMMessage_Version": "",
          "EDI_EANCOMMessage_Release": "",
          "EDI_EANCOMMessage_Association": "",
          "EDI_EANCOMMessage_Code": ""
        }
      }
    ]
  },
  {
    "Sheet": "Document",
    "Items": [
      {
        "Document_Item": 1,
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
        "Document_Manual": "",
        "Document_FilenameSuffix": "",
        "Document_Validate": "",
        "Document_Syntax": "",
        "Document_ValidationFile": "",
        "Document_ValidationDescription": "",
        "Document_Report": "",
        "Document_PrintOnly": "",
        "Document_Export": "",
        "Document_Hide": "",
        "Document_Labels": "",
        "Document_Duplicates": ""
      }
    ]
  }
]

;

// Richly organized formulas by category (Text, Logic & Conditions, Null/Default, Numbers, Dates, Collections, Utilities)
const functionCategories = [
  {
    category: 'Text Functions',
    functions: [
      { name: 'CONCAT', desc: 'Join multiple strings', example: 'CONCAT(Partner, ".", Document)', snippet: 'CONCAT(${1:str1}, ${2:str2})' },
      { name: 'UPPER', desc: 'Convert text to uppercase', example: 'UPPER(Document)', snippet: 'UPPER(${1:text})' },
      { name: 'LOWER', desc: 'Convert text to lowercase', example: 'LOWER(Document)', snippet: 'LOWER(${1:text})' },
      { name: 'TITLE', desc: 'Convert text to title case', example: 'TITLE(Document)', snippet: 'TITLE(${1:text})' },
      { name: 'TRIM', desc: 'Remove leading and trailing spaces', example: 'TRIM(Value)', snippet: 'TRIM(${1:text})' },
      { name: 'LTRIM', desc: 'Remove leading spaces from left side', example: 'LTRIM(Value)', snippet: 'LTRIM(${1:text})' },
      { name: 'RTRIM', desc: 'Remove trailing spaces from right side', example: 'RTRIM(Value)', snippet: 'RTRIM(${1:text})' },
      { name: 'LEFT', desc: 'Get specified number of left characters', example: 'LEFT(Document,3)', snippet: 'LEFT(${1:text}, ${2:count})' },
      { name: 'RIGHT', desc: 'Get specified number of right characters', example: 'RIGHT(Document,3)', snippet: 'RIGHT(${1:text}, ${2:count})' },
      { name: 'MID', desc: 'Extract substring with start index and length', example: 'MID(Value, 2, 4)', snippet: 'MID(${1:text}, ${2:start}, ${3:length})' },
      { name: 'REPLACE', desc: 'Replace occurrence of text pattern', example: 'REPLACE(Value," ","_")', snippet: 'REPLACE(${1:text}, "${2:search}", "${3:replace}")' },
      { name: 'SUBSTITUTE', desc: 'Substitute text by explicit position index', example: 'SUBSTITUTE(Value, 1, 3, "New")', snippet: 'SUBSTITUTE(${1:text}, ${2:start}, ${3:length}, "${4:newText}")' },
      { name: 'STARTSWITH', desc: 'Check if text starts with suffix prefix', example: 'STARTSWITH(Value, "GARNET")', snippet: 'STARTSWITH(${1:text}, "${2:prefix}")' },
      { name: 'ENDSWITH', desc: 'Check if text ends with specific suffix', example: 'ENDSWITH(Value, "IN")', snippet: 'ENDSWITH(${1:text}, "${2:suffix}")' },
      { name: 'CONTAINS', desc: 'Check if text contains a search substring', example: 'CONTAINS(Value, "850")', snippet: 'CONTAINS(${1:text}, "${2:search}")' },
      { name: 'SPLIT', desc: 'Split string by delimiter into array list', example: 'SPLIT(Value, "-")', snippet: 'SPLIT(${1:text}, "${2:delimiter}")' },
      { name: 'JOIN', desc: 'Join array collection with a delimiter character', example: 'JOIN(Collection, ",")', snippet: 'JOIN(${1:collection}, "${2:delimiter}")' },
      { name: 'PADLEFT', desc: 'Pad string on left to reach total length', example: 'PADLEFT(Value, 10, "0")', snippet: 'PADLEFT(${1:text}, ${2:length}, "${3:padChar}")' },
      { name: 'PADRIGHT', desc: 'Pad string on right to reach total length', example: 'PADRIGHT(Value, 10, " ")', snippet: 'PADRIGHT(${1:text}, ${2:length}, "${3:padChar}")' },
      { name: 'LEN', desc: 'Get characters count/string length', example: 'LEN(Document)', snippet: 'LEN(${1:text})' },
    ]
  },
  {
    category: 'Logical & Choice Functions',
    functions: [
      { name: 'IF', desc: 'Inline ternary IF condition evaluator', example: 'IF(A="1", "Yes", "No")', snippet: 'IF(${1:Condition}, "${2:True}", "${3:False}")' },
      { name: 'IFS', desc: 'Chain multiple conditions sequentially', example: 'IFS(A="1", "One", A="2", "Two", "Other")', snippet: 'IFS(${1:Cond1}, "${2:Res1}", ${3:Cond2}, "${4:Res2}", "${5:Default}")' },
      { name: 'SWITCH', desc: 'Switch variable mapping lookup', example: 'SWITCH(A, "1", "One", "Default")', snippet: 'SWITCH(${1:Variable}, "${2:Val1}", "${3:Res1}", "${4:Default}")' },
      { name: 'AND', desc: 'Logical AND logic operator', example: 'AND(A="1", B="2")', snippet: 'AND(${1:Cond1}, ${2:Cond2})' },
      { name: 'OR', desc: 'Logical OR logic operator', example: 'OR(A="1", B="2")', snippet: 'OR(${1:Cond1}, ${2:Cond2})' },
      { name: 'NOT', desc: 'Invert boolean logical state', example: 'NOT(A="1")', snippet: 'NOT(${1:Cond})' },
      { name: 'XOR', desc: 'Exclusive logical OR gate', example: 'XOR(A="1", B="2")', snippet: 'XOR(${1:Cond1}, ${2:Cond2})' },
    ]
  },
  {
    category: 'Null & Fallback Functions',
    functions: [
      { name: 'DEFAULT', desc: 'Evaluate and fallback if value is null/empty', example: 'DEFAULT(Value,"N/A")', snippet: 'DEFAULT(${1:val}, "${2:default}")' },
      { name: 'COALESCE', desc: 'Select first non-null argument', example: 'COALESCE(Val1, Val2, "None")', snippet: 'COALESCE(${1:val1}, ${2:val2})' },
      { name: 'ISBLANK', desc: 'Return true if text consists of only spaces', example: 'ISBLANK(Value)', snippet: 'ISBLANK(${1:val})' },
      { name: 'ISEMPTY', desc: 'Return true if value is null or empty string', example: 'ISEMPTY(Value)', snippet: 'ISEMPTY(${1:val})' },
      { name: 'ISNULL', desc: 'Return true if variable is strictly null', example: 'ISNULL(Value)', snippet: 'ISNULL(${1:val})' },
      { name: 'EXISTS', desc: 'Confirm if variable key exists in active context', example: 'EXISTS(Value)', snippet: 'EXISTS(${1:val})' },
      { name: 'NULLIF', desc: 'Return null if val1 equals val2 parameter', example: 'NULLIF(Value, "0")', snippet: 'NULLIF(${1:val1}, "${2:val2}")' },
    ]
  },
  {
    category: 'Math & Number Functions',
    functions: [
      { name: 'ABS', desc: 'Get absolute number value', example: 'ABS(-5)', snippet: 'ABS(${1:num})' },
      { name: 'ROUND', desc: 'Round decimal number to places limit', example: 'ROUND(Value, 2)', snippet: 'ROUND(${1:num}, ${2:decimals})' },
      { name: 'CEILING', desc: 'Round number up to nearest integer', example: 'CEILING(Value)', snippet: 'CEILING(${1:num})' },
      { name: 'FLOOR', desc: 'Round number down to nearest integer', example: 'FLOOR(Value)', snippet: 'FLOOR(${1:num})' },
      { name: 'MAX', desc: 'Return maximum of provided arguments', example: 'MAX(Val1, Val2)', snippet: 'MAX(${1:val1}, ${2:val2})' },
      { name: 'MIN', desc: 'Return minimum of provided arguments', example: 'MIN(Val1, Val2)', snippet: 'MIN(${1:val1}, ${2:val2})' },
      { name: 'SUM', desc: 'Sum up numeric list values', example: 'SUM(Collection)', snippet: 'SUM(${1:collection})' },
      { name: 'AVG', desc: 'Average value of list', example: 'AVG(Collection)', snippet: 'AVG(${1:collection})' },
      { name: 'INT', desc: 'Parse or cast text to integer number', example: 'INT("123")', snippet: 'INT(${1:text})' },
      { name: 'MOD', desc: 'Modulo remainder', example: 'MOD(Value, 2)', snippet: 'MOD(${1:num}, ${2:divisor})' },
    ]
  },
  {
    category: 'Date & Calendar Functions',
    functions: [
      { name: 'TODAY', desc: 'Get current date object without hours component', example: 'TODAY()', snippet: 'TODAY()' },
      { name: 'NOW', desc: 'Get current precise system timestamp', example: 'NOW()', snippet: 'NOW()' },
      { name: 'FORMATDATE', desc: 'Format date with specified pattern format', example: 'FORMATDATE(NOW(), "yyyyMMdd")', snippet: 'FORMATDATE(${1:date}, "${2:pattern}")' },
      { name: 'ADDDAYS', desc: 'Add days offset to a date object', example: 'ADDDAYS(NOW(), 5)', snippet: 'ADDDAYS(${1:date}, ${2:days})' },
      { name: 'ADDMONTHS', desc: 'Add months offset to a date object', example: 'ADDMONTHS(NOW(), 1)', snippet: 'ADDMONTHS(${1:date}, ${2:months})' },
      { name: 'DATEDIFF', desc: 'Days or units difference between dates', example: 'DATEDIFF(Date1, Date2, "days")', snippet: 'DATEDIFF(${1:date1}, ${2:date2}, "${3:unit}")' },
    ]
  },
  {
    category: 'Collections & Queries',
    functions: [
      { name: 'FIRST', desc: 'Get first element in list collection', example: 'FIRST(Collection)', snippet: 'FIRST(${1:collection})' },
      { name: 'LAST', desc: 'Get last element in list collection', example: 'LAST(Collection)', snippet: 'LAST(${1:collection})' },
      { name: 'COUNT', desc: 'Count entries count in collection list', example: 'COUNT(Collection)', snippet: 'COUNT(${1:collection})' },
      { name: 'LOOKUP', desc: 'Execute database schema lookup', example: 'LOOKUP("EDI_Map", "Key", "Val")', snippet: 'LOOKUP("${1:dataset}", "${2:keyField}", "${3:keyValue}")' },
      { name: 'LOOKUPBYKEY', desc: 'Perform single direct key lookup', example: 'LOOKUPBYKEY("Profiles", Key)', snippet: 'LOOKUPBYKEY("${1:dataset}", ${2:key})' },
    ]
  },
  {
    category: 'System & Utility Functions',
    functions: [
      { name: 'GUID', desc: 'Instantiate a brand new GUID string', example: 'GUID()', snippet: 'GUID()' },
      { name: 'UUID', desc: 'Instantiate a brand new UUID string', example: 'UUID()', snippet: 'UUID()' },
      { name: 'BASE64', desc: 'Encode text in Base64 string', example: 'BASE64("text")', snippet: 'BASE64(${1:text})' },
      { name: 'HASH', desc: 'Apply SHA256 checksum hash algorithm', example: 'HASH("text")', snippet: 'HASH(${1:text})' },
    ]
  }
];

const blockTemplates = [
  { 
    name: 'IF Block', 
    snippet: '{{#if ${1:Condition}}}\n\n  ${2:// content here}\n\n{{/if}}\n',
    desc: 'Conditionally render a block of lines.'
  },
  { 
    name: 'IF ELSE Block', 
    snippet: '{{#if ${1:Condition}}}\n\n  ${2:// true content}\n\n{{else}}\n\n  ${3:// false content}\n\n{{/if}}\n',
    desc: 'Render alternating code block based on conditional.'
  },
  { 
    name: 'FOR EACH Block', 
    snippet: '{{#each ${1:Collection}}}\n\n  ${2:// content per item}\n\n{{/each}}\n',
    desc: 'Loop over a set of items or dynamic spreadsheet rows.'
  },
  { 
    name: 'SWITCH Block', 
    snippet: '{{#switch ${1:Variable}}}\n\n{{case "${2:Value1}"}}\n  ${3:// content}\n\n{{default}}\n  ${4:// default content}\n\n{{/switch}}\n',
    desc: 'Multi-conditional branching block.'
  },
  { 
    name: 'Feature Block (3-Line Condition)', 
    snippet: '{{#block ${1:EntireBlockCondition}}}\nLine 1: Enter template code statement here\nLine 2: Enter template code statement here\nLine 3: Enter template code statement here\n{{/block}}\n',
    desc: 'A robust 3-line structural block where a formula covers the entire lines block.'
  }
];

const templateActions = [
  { name: 'DELETE_LINE()', desc: 'Deletes current output line if condition is true', snippet: 'DELETE_LINE()' },
  { name: 'SKIP()', desc: 'Skips rendering remaining lines of this block', snippet: 'SKIP()' },
  { name: 'STOP()', desc: 'Halts rendering and terminates compilation', snippet: 'STOP()' },
  { name: 'RETURN()', desc: 'Exits early from active nested macro block', snippet: 'RETURN()' },
  { name: 'BREAK', desc: 'Breaks execution cycle inside while/each loops', snippet: 'BREAK' },
  { name: 'CONTINUE', desc: 'Skips ahead to next iteration inside each loops', snippet: 'CONTINUE' },
  { name: 'LOG()', desc: 'Output status message to execution logs console', snippet: 'LOG("${1:info}")' },
  { name: 'WARNING()', desc: 'Trigger a non-fatal warning condition log', snippet: 'WARNING("${1:message}")' },
  { name: 'ERROR()', desc: 'Trigger a fatal exception and stop build', snippet: 'ERROR("${1:critical error message}")' },
];

export function TemplateManagerPage() {
  const storeFileSystem = useChatStore(s => s.fileSystem) as FileNode[];
  const storeSetFileSystem = useChatStore(s => s.setFileSystem);

  const fileSystem = storeFileSystem;
  const setFileSystem = (update: FileNode[] | ((prev: FileNode[]) => FileNode[])) => {
    if (typeof update === 'function') {
      storeSetFileSystem(update(storeFileSystem) as any);
    } else {
      storeSetFileSystem(update as any);
    }
  };

  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isTemplateEditMode, setIsTemplateEditMode] = useState(false);
  const [saveConfirmation, setSaveConfirmation] = useState<{ fileId: string; fileName: string } | null>(null);
  
  // History state for Undo/Redo
  const [history, setHistory] = useState<{ [id: string]: { past: string[], present: string, future: string[] } }>({});
  
  const [isCreatingNode, setIsCreatingNode] = useState<{ parentId: string | null, type: 'file' | 'folder' } | null>(null);
  const [newNodeName, setNewNodeName] = useState('');
  
  // Renaming state for file/folder name editing
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');

  const handleRenameNode = (id: string, nameValue: string, nodes: FileNode[]): FileNode[] => {
    return nodes.map(node => {
      if (node.id === id) {
        return { ...node, name: nameValue };
      }
      if (node.children) {
        return { ...node, children: handleRenameNode(id, nameValue, node.children) };
      }
      return node;
    });
  };

  const submitRenameNode = (id: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingNodeId(null);
      return;
    }
    setFileSystem(prev => handleRenameNode(id, trimmed, prev));
    setRenamingNodeId(null);
  };
  
  // Dynamic spreadsheet context data state
  const [excelData, setExcelData] = useState<any[]>(garnetHillDefaultExcelData);
  const [isTested, setIsTested] = useState<boolean>(false);
  const [testFileName, setTestFileName] = useState<string>('');
  const [isTestModalOpen, setIsTestModalOpen] = useState<boolean>(false);
  const [isUploadingTestExcel, setIsUploadingTestExcel] = useState<boolean>(false);
  const [testExcelError, setTestExcelError] = useState<string | null>(null);
  const [customGlobalKeysList, setCustomGlobalKeysList] = useState<string[]>([]);
  const [userCustomGlobalValues, setUserCustomGlobalValues] = useState<Record<string, string>>({});
  const [customKeyDetailsMap, setCustomKeyDetailsMap] = useState<Record<string, CustomKeyMetaData>>(initialCustomKeyDetails);
  const [customExtractionValues, setCustomExtractionValues] = useState<Record<string, string>>({});
  const [customExtractionError, setCustomExtractionError] = useState<string | null>(null);
  const [isExtractingCustomContext, setIsExtractingCustomContext] = useState(false);
  const [customKeySettingsLoaded, setCustomKeySettingsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('template-manager-custom-key-settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.keys)) {
            setCustomGlobalKeysList(parsed.keys.filter((key: unknown): key is string => typeof key === 'string'));
          }
          if (parsed.details && typeof parsed.details === 'object') {
            setCustomKeyDetailsMap({
              ...initialCustomKeyDetails,
              ...parsed.details
            });
          }
        }
      }
    } catch (error) {
      console.error('Could not load saved custom key prompts:', error);
    } finally {
      setCustomKeySettingsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!customKeySettingsLoaded) return;
    try {
      localStorage.setItem('template-manager-custom-key-settings', JSON.stringify({
        keys: customGlobalKeysList,
        details: customKeyDetailsMap
      }));
    } catch (error) {
      console.error('Could not save custom key prompts:', error);
    }
  }, [customKeySettingsLoaded, customGlobalKeysList, customKeyDetailsMap]);

  useEffect(() => {
    fetch('/api/upload/data')
      .then(res => res.json())
      .then(resData => {
        if (resData && resData.success && resData.data && resData.data.length > 0) {
          setExcelData(resData.data);
        }
      })
      .catch(err => console.error("Error fetching dynamic excel data for Template Manager:", err));
  }, []);

  const extractCustomContext = async (
    extractedData: any[],
    keyDetails: Record<string, CustomKeyMetaData> = customKeyDetailsMap
  ) => {
    const definitions = Object.values(keyDetails)
      .filter(({ keyName, prompt }) => keyName.trim() && prompt.trim())
      .map(({ keyName, prompt }) => ({ keyName, prompt }));
    if (definitions.length === 0) {
      setCustomExtractionValues({});
      setCustomExtractionError(null);
      return;
    }

    setIsExtractingCustomContext(true);
    try {
      const response = await fetch('/api/custom-context/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractedData, definitions })
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.values || typeof result.values !== 'object') {
        throw new Error(result.error || 'Failed to extract custom context values.');
      }
      setCustomExtractionValues(result.values);
      setCustomExtractionError(null);
    } finally {
      setIsExtractingCustomContext(false);
    }
  };

  const handleUploadExcelFile = async (file: File) => {
    setIsUploadingTestExcel(true);
    setTestExcelError(null);
    setCustomExtractionError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error || 'Failed to upload Excel file');
      }

      const dataRes = await fetch('/api/upload/data');
      if (!dataRes.ok) throw new Error('Failed to parse extracted Excel data');
      
      const resData = await dataRes.json();
      if (resData && resData.success && resData.data) {
        setExcelData(resData.data);
        setTestFileName(file.name);
        setIsTestModalOpen(false);
        try {
          await extractCustomContext(resData.data);
        } catch (error: any) {
          console.error('Error extracting custom context values:', error);
          setCustomExtractionValues({});
          setCustomExtractionError(error.message || 'Failed to extract custom context values.');
        }
        setIsTested(true);
      } else {
        throw new Error('No valid extracted context returned');
      }
    } catch (err: any) {
      console.error("Error testing Excel upload:", err);
      setTestExcelError(err.message || 'Error processing Excel file');
    } finally {
      setIsUploadingTestExcel(false);
    }
  };

  const handleLoadSampleExcel = async () => {
    setIsUploadingTestExcel(true);
    setTestExcelError(null);
    setCustomExtractionError(null);

    try {
      const sampleRes = await fetch('/api/sample-excel', {
        method: 'POST'
      });

      if (!sampleRes.ok) throw new Error('Failed to load sample Excel file');

      const dataRes = await fetch('/api/upload/data');
      if (!dataRes.ok) throw new Error('Failed to parse sample Excel data');

      const resData = await dataRes.json();
      if (resData && resData.success && resData.data) {
        setExcelData(resData.data);
        setTestFileName('Sample_TradingPartners_EDI.xlsx');
        setIsTestModalOpen(false);
        try {
          await extractCustomContext(resData.data);
        } catch (error: any) {
          console.error('Error extracting custom context values:', error);
          setCustomExtractionValues({});
          setCustomExtractionError(error.message || 'Failed to extract custom context values.');
        }
        setIsTested(true);
      } else {
        throw new Error('No valid sample context returned');
      }
    } catch (err: any) {
      console.error("Error loading sample Excel:", err);
      setTestExcelError(err.message || 'Error loading sample Excel file');
    } finally {
      setIsUploadingTestExcel(false);
    }
  };

  const handleClearTestedValues = () => {
    setIsTested(false);
    setTestFileName('');
    setExcelData(garnetHillDefaultExcelData);
    setCustomExtractionValues({});
    setCustomExtractionError(null);
  };

  const getValueForKey = (sheetTab: string, keyName: string): string => {
    if (!isTested) return '';

    if (sheetTab === 'Custom') {
      return customExtractionValues[keyName] || '';
    }

    const currentSheet = excelData.find(item => item && item.Sheet && item.Sheet.toLowerCase() === sheetTab.toLowerCase());
    if (!currentSheet) return '';

    const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const values: string[] = [];
    const searchObj = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        obj.forEach(searchObj);
        return;
      }
      for (const k of Object.keys(obj)) {
        const value = obj[k];
        if (normalizeKey(k) === normalizeKey(keyName)) {
          if (value !== null && value !== undefined) {
            const formatted = formatContextValue(value);
            if (formatted) values.push(formatted);
          }
        } else if (value && typeof value === 'object') {
          searchObj(value);
        }
      }
    };

    searchObj(currentSheet);
    return [...new Set(values)].join(', ');
  };

  const formatContextValue = (value: any): string => {
    if (value === null || value === undefined || value === '') return '';
    if (Array.isArray(value)) {
      return value.map(formatContextValue).filter(Boolean).join('; ');
    }
    if (typeof value === 'object') {
      return Object.entries(value)
        .map(([key, child]) => {
          const formatted = formatContextValue(child);
          return formatted ? `${key}: ${formatted}` : '';
        })
        .filter(Boolean)
        .join('; ');
    }
    return String(value).trim();
  };

  const [showSaveToast, setShowSaveToast] = useState(false);

  // Resize sidebar state
  const [sidebarWidth, setSidebarWidth] = useState<number>(256); // Default 256px
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // Resize right panel state
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(320);
  const [isResizingRight, setIsResizingRight] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag-to-resize sidebar effect
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newWidth = Math.max(180, Math.min(500, e.clientX - rect.left));
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Drag-to-resize right panel effect
  useEffect(() => {
    if (!isResizingRight) return;

    const handleMouseMoveRight = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newWidth = Math.max(250, Math.min(600, rect.right - e.clientX));
        setRightPanelWidth(newWidth);
      }
    };

    const handleMouseUpRight = () => {
      setIsResizingRight(false);
    };

    window.addEventListener('mousemove', handleMouseMoveRight);
    window.addEventListener('mouseup', handleMouseUpRight);

    return () => {
      window.removeEventListener('mousemove', handleMouseMoveRight);
      window.removeEventListener('mouseup', handleMouseUpRight);
    };
  }, [isResizingRight]);

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  };

  const handleMouseDownResizeRight = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingRight(true);
  };

  // Expand / Collapse all folders
  const handleExpandAll = () => {
    const expandNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.type === 'folder') {
          return {
            ...node,
            isOpen: true,
            children: node.children ? expandNodes(node.children) : []
          };
        }
        return node;
      });
    };
    setFileSystem(expandNodes(fileSystem));
  };

  const handleCollapseAll = () => {
    const collapseNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.type === 'folder') {
          return {
            ...node,
            isOpen: false,
            children: node.children ? collapseNodes(node.children) : []
          };
        }
        return node;
      });
    };
    setFileSystem(collapseNodes(fileSystem));
  };

  // Read folder path state from global useChatStore for perfect synchronization across components
  const templateFolderPath = useChatStore(s => s.templateFolderPath);
  const setTemplateFolderPath = useChatStore(s => s.setTemplateFolderPath);
  const [isSavingLocal, setIsSavingLocal] = useState<boolean>(false);
  const [viewModeWarning, setViewModeWarning] = useState(false);
  const [templateSaveError, setTemplateSaveError] = useState<string | null>(null);
  
  // Tabs layout as direct user requested: (Extracted Context, Conditions & Logic, Functions)
  const [activeTab, setActiveTab] = useState<'extracted_context' | 'conditions_logic' | 'functions'>('extracted_context');
  
  // Sub-navigation inside Extracted Context (pills for Modules, EDI, Document, Custom)
  const [contextSheetTab, setContextSheetTab] = useState<'Modules' | 'EDI' | 'Document' | 'Custom'>('Modules');
  
  // Custom Global Key Modal state (Add / Edit)
  const [isCustomKeyModalOpen, setIsCustomKeyModalOpen] = useState<boolean>(false);
  const [editingKeyName, setEditingKeyName] = useState<string | null>(null);
  const [keyFormName, setKeyFormName] = useState<string>('');
  const [keyFormPrompt, setKeyFormPrompt] = useState<string>('');
  const [keyFormExample, setKeyFormExample] = useState<string>('');
  const [keyFormError, setKeyFormError] = useState<string | null>(null);

  const handleOpenCustomKeyModal = (targetKey: string | null) => {
    setKeyFormError(null);
    if (targetKey === null) {
      setEditingKeyName(null);
      setKeyFormName('G_');
      setKeyFormPrompt('');
      setKeyFormExample('');
    } else {
      const details = customKeyDetailsMap[targetKey] || {
        keyName: targetKey,
        prompt: `Global custom context key for ${targetKey}`,
        example: userCustomGlobalValues[targetKey] || (
          targetKey === 'G_TP.PACK-ISO' ? 'TRADER.JOES-US' :
          targetKey === 'G_TPDisplayName' ? "Trader Joe's" :
          targetKey === 'G_TPNameWS' ? 'TraderJoes' : ''
        )
      };
      setEditingKeyName(targetKey);
      setKeyFormName(details.keyName);
      setKeyFormPrompt(details.prompt);
      setKeyFormExample(details.example);
    }
    setIsCustomKeyModalOpen(true);
  };

  const handleSaveCustomKey = async () => {
    const rawName = keyFormName.trim();
    if (!rawName) {
      setKeyFormError('Key name cannot be empty');
      return;
    }
    if (!keyFormPrompt.trim()) {
      setKeyFormError('A prompt is required to extract this key from the workbook');
      return;
    }

    const formattedName = rawName.startsWith('G_') ? rawName : `G_${rawName}`;
    const newDetails = {
      keyName: formattedName,
      prompt: keyFormPrompt.trim(),
      example: keyFormExample.trim()
    };
    const nextDetailsMap = { ...customKeyDetailsMap };
    const nextKeyList = [...customGlobalKeysList];

    if (editingKeyName === null) {
      // Adding a new key
      const isExisting = ['G_TP.PACK-ISO', 'G_TPDisplayName', 'G_TPNameWS', ...customGlobalKeysList].includes(formattedName);
      if (isExisting) {
        setKeyFormError(`Key "${formattedName}" already exists`);
        return;
      }
      nextKeyList.push(formattedName);
    } else if (editingKeyName !== formattedName) {
      // Key name was changed during edit
      if (customGlobalKeysList.includes(editingKeyName)) {
        const index = nextKeyList.indexOf(editingKeyName);
        nextKeyList[index] = formattedName;
      }
      delete nextDetailsMap[editingKeyName];
      setUserCustomGlobalValues(prev => {
        const next = { ...prev };
        delete next[editingKeyName];
        return next;
      });
    }

    nextDetailsMap[formattedName] = newDetails;
    setCustomGlobalKeysList(nextKeyList);
    setCustomKeyDetailsMap(nextDetailsMap);

    // Save/update values
    setUserCustomGlobalValues(prev => ({
      ...prev,
      [formattedName]: keyFormExample.trim()
    }));

    setIsCustomKeyModalOpen(false);
    setCustomExtractionValues(prev => ({ ...prev, [formattedName]: '' }));
    if (isTested) {
      setCustomExtractionError(null);
      try {
        await extractCustomContext(excelData, nextDetailsMap);
      } catch (error: any) {
        console.error('Error extracting custom context values:', error);
        setCustomExtractionError(error.message || 'Failed to extract custom context values.');
      }
    }
  };

  const [contextSearch, setContextSearch] = useState('');
  const [contextViewMode, setContextViewMode] = useState<'fields' | 'rows'>('fields');
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});
  
  // Search state inside Functions
  const [functionSearch, setFunctionSearch] = useState('');
  const [expandedFunctionCategory, setExpandedFunctionCategory] = useState<string | null>('Text Functions');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const warnViewMode = () => {
    setViewModeWarning(true);
    window.setTimeout(() => setViewModeWarning(false), 3000);
  };

  // Load templates recursively from local disk path
  const loadLocalTemplates = async (pathOverride?: string) => {
    let dirPath = pathOverride !== undefined ? pathOverride : templateFolderPath;
    
    // Fetch default config if using the default folder on mount
    if (pathOverride === undefined && templateFolderPath === 'ini_templates') {
      try {
        const configRes = await fetch('/api/templates/config');
        if (configRes.ok) {
          const configResult = await configRes.json();
          if (configResult.success && configResult.defaultDir) {
            dirPath = configResult.defaultDir;
            setTemplateFolderPath(dirPath);
          }
        }
      } catch (configErr) {
        console.error("Error fetching template config:", configErr);
      }
    }

    try {
      const res = await fetch(`/api/templates/list?dir=${encodeURIComponent(dirPath)}`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          const collapseAllByDefault = (nodes: FileNode[]): FileNode[] => {
            return nodes.map(n => {
              if (n.type === 'folder') {
                return {
                  ...n,
                  isOpen: false,
                  children: n.children ? collapseAllByDefault(n.children) : []
                };
              }
              return n;
            });
          };
          setFileSystem(collapseAllByDefault(result.data));
          
          // Seed history/editor state with new contents
          const seedHistory = (nodes: FileNode[]) => {
            nodes.forEach(node => {
              if (node.type === 'file') {
                setHistory(prev => {
                  if (prev[node.id]) return prev; // Keep if already initialized
                  return {
                    ...prev,
                    [node.id]: { past: [], present: node.content || '', future: [] }
                  };
                });
              } else if (node.children) {
                seedHistory(node.children);
              }
            });
          };
          seedHistory(result.data);

          // Find first available file to auto-select
          const findFirstFile = (nodes: FileNode[]): string | null => {
            for (const n of nodes) {
              if (n.type === 'file') return n.id;
              if (n.children) {
                const found = findFirstFile(n.children);
                if (found) return found;
              }
            }
            return null;
          };
          
          const firstId = findFirstFile(result.data);
          if (firstId) {
            setActiveFileId(prev => {
              const exists = (nodes: FileNode[], id: string | null): boolean => {
                if (!id) return false;
                for (const n of nodes) {
                  if (n.id === id) return true;
                  if (n.children && exists(n.children, id)) return true;
                }
                return false;
              };
              if (prev && exists(result.data, prev)) return prev;
              return firstId;
            });
          } else {
            setActiveFileId(null);
          }
        }
      }
    } catch (err) {
      console.error("Error loading local templates:", err);
    }
  };

  useEffect(() => {
    loadLocalTemplates();
  }, []);

  const getFileById = (id: string, nodes: FileNode[]): FileNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = getFileById(id, node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const fileContent = activeFileId && history[activeFileId] ? history[activeFileId].present : '';

  const updateHistory = (id: string, newContent: string) => {
    setHistory(prev => {
      const state = prev[id] || { past: [], present: '', future: [] };
      if (state.present === newContent) return prev;
      
      return {
        ...prev,
        [id]: {
          past: [...state.past, state.present],
          present: newContent,
          future: [] // clear future on new edit
        }
      };
    });
  };

  const undo = () => {
    if (!isTemplateEditMode || !activeFileId || !history[activeFileId] || history[activeFileId].past.length === 0) return;
    
    setHistory(prev => {
      const state = prev[activeFileId];
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, state.past.length - 1);
      
      return {
        ...prev,
        [activeFileId]: {
          past: newPast,
          present: previous,
          future: [state.present, ...state.future]
        }
      };
    });
  };

  const redo = () => {
    if (!isTemplateEditMode || !activeFileId || !history[activeFileId] || history[activeFileId].future.length === 0) return;
    
    setHistory(prev => {
      const state = prev[activeFileId];
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      
      return {
        ...prev,
        [activeFileId]: {
          past: [...state.past, state.present],
          present: next,
          future: newFuture
        }
      };
    });
  };

  // Keep a reference of undo/redo to avoid stale event listeners closures
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  useEffect(() => {
    undoRef.current = undo;
    redoRef.current = redo;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redoRef.current();
        } else {
          e.preventDefault();
          undoRef.current();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redoRef.current();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectFile = (id: string) => {
    const file = getFileById(id, fileSystem);
    if (file && file.type === 'file') {
      setActiveFileId(id);
      if (!history[id]) {
        setHistory(prev => ({
          ...prev,
          [id]: { past: [], present: file.content || '', future: [] }
        }));
      }
    } else if (file && file.type === 'folder') {
      setFileSystem(handleToggleFolder(id, fileSystem));
    }
  };

  const handleToggleFolder = (id: string, nodes: FileNode[]): FileNode[] => {
    return nodes.map(node => {
      if (node.id === id) {
        return { ...node, isOpen: !node.isOpen };
      }
      if (node.children) {
        return { ...node, children: handleToggleFolder(id, node.children) };
      }
      return node;
    });
  };

  const updateFileContentFileSystem = (id: string, content: string, nodes: FileNode[]): FileNode[] => {
    return nodes.map(node => {
      if (node.id === id) {
        return { ...node, content };
      }
      if (node.children) {
        return { ...node, children: updateFileContentFileSystem(id, content, node.children) };
      }
      return node;
    });
  };

  const handleSave = async () => {
    if (isTemplateEditMode && activeFileId && history[activeFileId]) {
      const activeFileNode = getFileById(activeFileId, fileSystem);
      if (!activeFileNode) return;

      setTemplateSaveError(null);
      setSaveConfirmation({ fileId: activeFileId, fileName: activeFileNode.name });
    }
  };

  const confirmSaveTemplate = async () => {
    if (!saveConfirmation || !isTemplateEditMode) return;
    const { fileId } = saveConfirmation;
    const activeFileNode = getFileById(fileId, fileSystem);
    const contentToSave = history[fileId]?.present;
    if (!activeFileNode || contentToSave === undefined) {
      setSaveConfirmation(null);
      setTemplateSaveError('The selected template is no longer available to save.');
      return;
    }

    try {
      setIsSavingLocal(true);
      const res = await fetch('/api/templates/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: activeFileNode.path || activeFileNode.name,
          content: contentToSave,
          configuredDir: templateFolderPath
        })
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to save the template.');
      }

      setFileSystem(updateFileContentFileSystem(fileId, contentToSave, fileSystem));
      setSaveConfirmation(null);
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 3000);
    } catch (err: any) {
      console.error("Error saving file locally on server disk:", err);
      setTemplateSaveError(err.message || 'Failed to save the template.');
    } finally {
      setIsSavingLocal(false);
    }
  };

  const handleDeleteNode = async (node: FileNode) => {
    try {
      const res = await fetch('/api/templates/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filePath: node.path || node.name,
          configuredDir: templateFolderPath
        })
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          if (activeFileId === node.id) {
            setActiveFileId(null);
          }
          await loadLocalTemplates();
        }
      }
    } catch (err) {
      console.error("Error deleting template node:", err);
    }
  };

  const insertText = (text: string, selectionOffset: number = 0) => {
    if (!isTemplateEditMode) {
      warnViewMode();
      return;
    }
    if (!activeFileId) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = fileContent;
    const newText = current.substring(0, start) + text + current.substring(end);
    
    updateHistory(activeFileId, newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start + text.length + selectionOffset;
      textarea.selectionEnd = start + text.length + selectionOffset;
    }, 0);
  };

  const handleCreateNode = (parentId: string | null, type: 'file' | 'folder') => {
    setIsCreatingNode({ parentId, type });
    setNewNodeName('');
    
    if (parentId !== null) {
      // Force parent folder to open so that the creation text input is visible in the tree
      setFileSystem(prev => {
        const openParent = (nodes: FileNode[]): FileNode[] => {
          return nodes.map(node => {
            if (node.id === parentId) {
              return { ...node, isOpen: true };
            }
            if (node.children) {
              return { ...node, children: openParent(node.children) };
            }
            return node;
          });
        };
        return openParent(prev);
      });
    }
  };

  const submitCreateNode = async () => {
    if (!isCreatingNode || !newNodeName.trim()) {
      setIsCreatingNode(null);
      return;
    }
    
    const nodeName = newNodeName.trim();
    const parentNode = isCreatingNode.parentId ? getFileById(isCreatingNode.parentId, fileSystem) : null;
    const parentPath = parentNode ? parentNode.path : null;

    try {
      const res = await fetch('/api/templates/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nodeName,
          parentPath,
          type: isCreatingNode.type,
          configuredDir: templateFolderPath
        })
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          // Re-load file tree recursively from local disk path
          await loadLocalTemplates();
        }
      }
    } catch (err) {
      console.error("Error creating node on disk:", err);
    }

    setIsCreatingNode(null);
    setNewNodeName('');
  };

  // Drag and Drop support
  const handleDragStart = (e: DragEvent<HTMLDivElement | HTMLButtonElement>, text: string) => {
    e.dataTransfer.setData('text/plain', text);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const renderTree = (nodes: FileNode[], level: number = 0) => {
    return nodes.map(node => (
      <div key={node.id}>
        <div 
          className={`flex items-center py-1.5 px-2 cursor-pointer hover:bg-gray-200/70 dark:hover:bg-gray-800/60 rounded transition-colors group ${
            activeFileId === node.id 
              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium' 
              : 'text-gray-700 dark:text-gray-300'
          }`}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => handleSelectFile(node.id)}
        >
          {node.type === 'folder' ? (
            <>
              {node.isOpen ? <ChevronDown size={14} className="mr-1 text-gray-400 dark:text-gray-500 shrink-0" /> : <ChevronRight size={14} className="mr-1 text-gray-400 dark:text-gray-500 shrink-0" />}
              <Folder size={16} className="mr-2 text-yellow-500 shrink-0" />
            </>
          ) : (
            <>
              <span className="w-[18px] shrink-0" />
              {node.fileType === 'sql' ? (
                <FileCode size={16} className="mr-2 text-blue-500 dark:text-blue-400 shrink-0" />
              ) : node.fileType === 'xml' || node.name.toLowerCase().endsWith('.xml') ? (
                <FileCode size={16} className="mr-2 text-emerald-500 dark:text-emerald-400 shrink-0" />
              ) : (
                <FileText size={16} className="mr-2 text-gray-400 dark:text-gray-500 shrink-0" />
              )}
            </>
          )}
          
          {renamingNodeId === node.id ? (
            <div className="flex-1 flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                className="flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs px-1.5 py-0.5 rounded outline-none border border-indigo-500 min-w-0"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitRenameNode(node.id);
                  if (e.key === 'Escape') setRenamingNodeId(null);
                }}
              />
              <button
                onClick={(e) => { e.stopPropagation(); submitRenameNode(node.id); }}
                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-emerald-600 dark:text-emerald-400"
                title="Save Name"
              >
                <Check size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setRenamingNodeId(null); }}
                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-rose-600 dark:text-rose-400"
                title="Cancel"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <>
              <span 
                className="text-sm truncate flex-1"
              >
                {node.name}
              </span>
            </>
          )}
        </div>
        
        {isCreatingNode?.parentId === node.id && (
          <div className="flex items-center py-1 px-2 pr-4 bg-gray-200/60 dark:bg-gray-800/40 rounded mt-0.5" style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}>
            {isCreatingNode.type === 'folder' ? <Folder size={14} className="mr-2 text-yellow-500 shrink-0" /> : <FileText size={14} className="mr-2 text-gray-400 dark:text-gray-500 shrink-0" />}
            <input 
              autoFocus
              className="flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-1.5 py-0.5 rounded outline-none border border-indigo-500 w-full min-w-0"
              value={newNodeName}
              placeholder={isCreatingNode.type === 'folder' ? 'Folder name...' : 'Filename.ini...'}
              onChange={e => setNewNodeName(e.target.value)}
              onKeyDown={e => { 
                if (e.key === 'Enter') submitCreateNode(); 
                if (e.key === 'Escape') setIsCreatingNode(null); 
              }}
            />
            <div className="flex items-center ml-1 shrink-0">
              <button 
                onMouseDown={(e) => { e.preventDefault(); submitCreateNode(); }} 
                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-emerald-600 dark:text-emerald-400"
                title="Confirm"
              >
                <Check size={14} />
              </button>
              <button 
                onMouseDown={(e) => { e.preventDefault(); setIsCreatingNode(null); }} 
                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-rose-600 dark:text-rose-400"
                title="Cancel"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
        
        {node.type === 'folder' && node.isOpen && node.children && (
          <div>
            {renderTree(node.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const activeFile = activeFileId ? getFileById(activeFileId, fileSystem) : null;
  const canUndo = activeFileId ? history[activeFileId]?.past.length > 0 : false;
  const canRedo = activeFileId ? history[activeFileId]?.future.length > 0 : false;

  // Extract dynamic fields and rows for selected Sheet Context
  const getContextSheetData = () => {
    if (contextSheetTab === 'Custom') {
      const keysSet = new Set<string>();
      const groups: { [groupName: string]: any[] } = {};

      const globalKeyList = [
        'G_TP.PACK-ISO',
        'G_TPDisplayName',
        'G_TPNameWS',
        ...customGlobalKeysList
      ];
      globalKeyList.forEach(k => keysSet.add(k));

      const globalRecordObj: Record<string, string> = {};
      globalKeyList.forEach(key => {
        globalRecordObj[key] = getValueForKey('Custom', key);
      });
      customGlobalKeysList.forEach(k => {
        globalRecordObj[k] = getValueForKey('Custom', k);
      });

      groups['Global Keys'] = [globalRecordObj];

      return {
        keys: Array.from(keysSet),
        groups
      };
    }

    const sheetObj = excelData.find(item => item && item.Sheet && item.Sheet.toLowerCase() === contextSheetTab.toLowerCase());
    const baselineSheetObj = garnetHillDefaultExcelData.find(item => item && item.Sheet && item.Sheet.toLowerCase() === contextSheetTab.toLowerCase());
    
    console.log("DEBUG: getContextSheetData called", { contextSheetTab, sheetObj, excelData });

    const keysSet = new Set<string>();
    const groups: { [groupName: string]: any[] } = {};

    const extractKeys = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        obj.forEach(extractKeys);
      } else {
        Object.keys(obj).forEach(k => {
          keysSet.add(k);
          if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
            extractKeys(obj[k]);
          }
        });
      }
    };

    const processSheetObject = (obj: any) => {
      if (!obj) return;
      
      // Extract keys from the root object itself
      extractKeys(obj);
      
      const processArray = (arr: any[], groupName: string) => {
        if (!groups[groupName]) groups[groupName] = [];
        arr.forEach((row: any) => {
          if (row && typeof row === 'object') {
            extractKeys(row);
            groups[groupName].push(row);
          }
        });
      };

      if (obj.rows && Array.isArray(obj.rows)) {
        processArray(obj.rows, "Records");
        return;
      }

      const lowerTab = contextSheetTab.toLowerCase();

      if (lowerTab === 'modules') {
        const types = obj.ModuleType || {};
        Object.keys(types).forEach(typeKey => {
          if (Array.isArray(types[typeKey])) {
            processArray(types[typeKey], typeKey);
          }
        });
        
        // Dynamic fallback to discover any arrays
        Object.keys(obj).forEach(key => {
          if (key !== 'Sheet' && key !== 'ModuleType' && Array.isArray(obj[key])) {
            processArray(obj[key], key);
          }
        });
      } else if (lowerTab === 'edi' || lowerTab === 'document') {
        // Look for standard Items
        if (obj.Items && Array.isArray(obj.Items)) {
          processArray(obj.Items, "Items");
        }
        
        // Look for direction arrays specifically
        const dirInKey = lowerTab === 'edi' ? 'EDI_Direction_In' : 'Document_Direction_In';
        const dirOutKey = lowerTab === 'edi' ? 'EDI_Direction_Out' : 'Document_Direction_Out';

        if (obj[dirInKey] && Array.isArray(obj[dirInKey])) {
          processArray(obj[dirInKey], lowerTab === 'edi' ? 'EDI Inbound' : 'Document Inbound');
        }
        if (obj[dirOutKey] && Array.isArray(obj[dirOutKey])) {
          processArray(obj[dirOutKey], lowerTab === 'edi' ? 'EDI Outbound' : 'Document Outbound');
        }

        // Dynamic fallback to discover any other arrays
        Object.keys(obj).forEach(key => {
          if (key !== 'Sheet' && key !== 'Items' && key !== dirInKey && key !== dirOutKey && Array.isArray(obj[key])) {
            processArray(obj[key], key);
          }
        });
      }
    };

    const hasCustomData = excelData !== garnetHillDefaultExcelData && excelData.length > 0;
    if (hasCustomData && sheetObj) {
      processSheetObject(sheetObj);
    } else if (baselineSheetObj) {
      processSheetObject(baselineSheetObj);
    }
    
    return {
      keys: Array.from(keysSet),
      groups
    };
  };

  const { keys: contextKeys, groups: contextGroups } = getContextSheetData();

  // Filter keys by search criteria
  const filteredKeys = contextKeys.filter(k => 
    k.toLowerCase().includes(contextSearch.toLowerCase())
  );

  const toggleRowExpansion = (rowId: string) => {
    setExpandedRows(prev => ({ ...prev, [rowId]: !prev[rowId] }));
  };

  const getCaretIndexFromCoords = (textarea: HTMLTextAreaElement, clientX: number, clientY: number): number => {
    const rect = textarea.getBoundingClientRect();
    
    // Calculate relative coordinates, accounting for padding (p-5 = 20px) and scroll
    const x = clientX - rect.left - 20 + textarea.scrollLeft;
    const y = clientY - rect.top - 20 + textarea.scrollTop;
    
    const lineHeight = 19.5; // for text-xs leading-relaxed
    const charWidth = 7.23;  // for font-mono text-xs
    
    // Calculate clicked line (0-indexed)
    const clickedLineIdx = Math.max(0, Math.floor(y / lineHeight));
    
    // Calculate clicked column (0-indexed)
    const clickedColIdx = Math.max(0, Math.round(x / charWidth));
    
    const lines = textarea.value.split('\n');
    
    let charIndex = 0;
    for (let i = 0; i < clickedLineIdx && i < lines.length; i++) {
      charIndex += lines[i].length + 1; // +1 for the newline character
    }
    
    const currentLine = lines[clickedLineIdx];
    if (currentLine !== undefined) {
      charIndex += Math.min(clickedColIdx, currentLine.length);
    } else if (lines.length > 0) {
      charIndex = textarea.value.length;
    }
    
    return charIndex;
  };

  return (
    <div ref={containerRef} className="flex h-full w-full theme-editor-panel theme-secondary overflow-hidden font-sans">
      
      {/* Invisible full screen resize overlay to capture drag event moves safely */}
      {(isResizing || isResizingRight) && (
        <div className="fixed inset-0 z-[9999] cursor-col-resize select-none pointer-events-auto bg-transparent" />
      )}

      {/* Sidebar: File Explorer */}
      <div 
        style={{ width: `${sidebarWidth}px` }}
        className="relative border-r theme-border flex flex-col theme-surface-muted shrink-0 h-full select-none"
      >
        <div className="p-4 border-b theme-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
            <h2 className="text-xs font-semibold uppercase tracking-wider theme-muted truncate">Templates</h2>
          </div>
          
          {/* Collapse and Expand actions for folders/subfolders/files */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleExpandAll}
              className="p-1.5 hover:bg-gray-200/70 dark:hover:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Expand All"
            >
              <ChevronsDown size={14} />
            </button>
            <button
              onClick={handleCollapseAll}
              className="p-1.5 hover:bg-gray-200/70 dark:hover:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Collapse All"
            >
              <ChevronsUp size={14} />
            </button>
          </div>
        </div>

        {/* Configured Folder Path */}
        <div className="px-3 py-2.5 border-b theme-border bg-gray-50/60 dark:bg-[#161616] flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Local Folder Path</label>
            <button
              type="button"
              role="switch"
              aria-checked={isTemplateEditMode}
              onClick={() => setIsTemplateEditMode(value => !value)}
              className="flex items-center gap-1.5 shrink-0 text-[10px] font-semibold text-gray-600 dark:text-gray-300 cursor-pointer"
              title={isTemplateEditMode ? 'Editing enabled: click to switch to view-only mode' : 'View-only mode: click to enable editing'}
            >
              <span>{isTemplateEditMode ? 'Edit' : 'View'}</span>
              <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${isTemplateEditMode ? 'bg-indigo-600' : 'bg-gray-400 dark:bg-gray-600'}`}>
                <span className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${isTemplateEditMode ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </span>
            </button>
          </div>
          <div className="text-xs text-indigo-700 dark:text-indigo-300 font-mono bg-indigo-50/70 dark:bg-[#1f1f1f] border border-indigo-200/70 dark:border-gray-800 rounded px-2.5 py-1.5 break-all leading-relaxed whitespace-pre-wrap">
            {templateFolderPath}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {fileSystem.length === 0 ? (
            <div className="text-center py-8 px-4 text-xs theme-disabled leading-relaxed">
              No template files found in the directory.
            </div>
          ) : (
            renderTree(fileSystem)
          )}
          
          {isCreatingNode?.parentId === null && (
            <div className="flex items-center py-1 px-2 pr-4 bg-gray-200/60 dark:bg-gray-800/40 rounded mt-1">
              {isCreatingNode.type === 'folder' ? <Folder size={14} className="mr-2 text-yellow-500 shrink-0" /> : <FileText size={14} className="mr-2 text-gray-400 dark:text-gray-500 shrink-0" />}
              <input 
                autoFocus
                className="flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-1.5 py-0.5 rounded outline-none border border-indigo-500 w-full min-w-0"
                value={newNodeName}
                placeholder={isCreatingNode.type === 'folder' ? 'Folder name...' : 'Filename.ini...'}
                onChange={e => setNewNodeName(e.target.value)}
                onKeyDown={e => { 
                  if (e.key === 'Enter') submitCreateNode(); 
                  if (e.key === 'Escape') setIsCreatingNode(null); 
                }}
              />
              <div className="flex items-center ml-1 shrink-0">
                <button 
                  onMouseDown={(e) => { e.preventDefault(); submitCreateNode(); }} 
                  className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-emerald-600 dark:text-emerald-400"
                >
                  <Check size={14} />
                </button>
                <button 
                  onMouseDown={(e) => { e.preventDefault(); setIsCreatingNode(null); }} 
                  className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-rose-600 dark:text-rose-400"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Vertical Resize Drag Handle on the Right edge */}
        <div
          onMouseDown={handleMouseDownResize}
          className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/50 transition-colors z-50${isResizing ? 'bg-indigo-600' : 'bg-transparent'}`}
          title="Drag to resize Templates panel"
        />
      </div>

      {/* Main Area: Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeFile ? (
          <>
            <div className="h-12 border-b theme-border flex items-center justify-between px-4 theme-editor-panel shrink-0">
              <div className="flex items-center text-sm truncate">
                <span className="text-gray-400 dark:text-gray-500">Templates</span>
                <ChevronRight size={14} className="mx-2 text-gray-400 dark:text-gray-600 shrink-0" />
                <span className="text-gray-800 dark:text-gray-200 font-medium truncate">{activeFile.name}</span>
                
                {/* Undo/Redo tools */}
                <div className="flex items-center space-x-1 ml-6 border-l theme-border pl-4">
                  <button 
                    onClick={undo} disabled={!isTemplateEditMode || !canUndo}
                    className={`p-1.5 rounded transition-colors ${isTemplateEditMode && canUndo ? 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/70 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white cursor-pointer' : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'}`}
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo size={14} />
                  </button>
                  <button 
                    onClick={redo} disabled={!isTemplateEditMode || !canRedo}
                    className={`p-1.5 rounded transition-colors ${isTemplateEditMode && canRedo ? 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/70 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white cursor-pointer' : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'}`}
                    title="Redo (Ctrl+Y)"
                  >
                    <Redo size={14} />
                  </button>
                </div>
              </div>
              <button 
                onClick={handleSave}
                disabled={!isTemplateEditMode || isSavingLocal}
                className="flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed !text-white text-white text-xs font-semibold rounded transition-colors shrink-0 shadow-md shadow-indigo-900/10 cursor-pointer"
                title={isTemplateEditMode ? 'Save changes to the local template' : 'Enable Edit mode to save changes'}
              >
                <Save size={14} className="mr-1.5 !text-white text-white" /> <span className="!text-white text-white">Save Changes</span>
              </button>
            </div>
            
            <div className="flex-1 flex min-h-0">
              {/* Editor View */}
              <div className="flex-1 flex flex-col relative theme-editor">
                <textarea
                  ref={textareaRef}
                  id="template-editor"
                  readOnly={!isTemplateEditMode}
                  value={fileContent}
                  onKeyDown={(e) => {
                    if (
                      !isTemplateEditMode &&
                      ((e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) ||
                        e.key === 'Backspace' ||
                        e.key === 'Delete' ||
                        ((e.ctrlKey || e.metaKey) && ['v', 'x'].includes(e.key.toLowerCase())))
                    ) {
                      e.preventDefault();
                      warnViewMode();
                    }
                  }}
                  onPaste={(e) => {
                    if (!isTemplateEditMode) {
                      e.preventDefault();
                      warnViewMode();
                    }
                  }}
                  onChange={(e) => {
                    if (isTemplateEditMode && activeFileId) updateHistory(activeFileId, e.target.value);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!isTemplateEditMode) {
                      warnViewMode();
                      return;
                    }
                    const text = e.dataTransfer.getData('text/plain');
                    if (text) {
                      const textarea = textareaRef.current;
                      if (textarea) {
                        const dropPos = getCaretIndexFromCoords(textarea, e.clientX, e.clientY);
                        
                        const current = fileContent;
                        const newText = current.substring(0, dropPos) + text + current.substring(dropPos);
                        
                        if (activeFileId) {
                          updateHistory(activeFileId, newText);
                        }
                        
                        setTimeout(() => {
                          textarea.focus();
                          textarea.selectionStart = dropPos + text.length;
                          textarea.selectionEnd = dropPos + text.length;
                        }, 0);
                      }
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!isTemplateEditMode) return;
                    const textarea = textareaRef.current;
                    if (textarea) {
                      textarea.focus();
                      const dropPos = getCaretIndexFromCoords(textarea, e.clientX, e.clientY);
                      try {
                        textarea.selectionStart = dropPos;
                        textarea.selectionEnd = dropPos;
                      } catch (err) {
                        // ignore selection boundary range exceptions
                      }
                    }
                  }}
                  className="flex-1 w-full bg-transparent border-none p-5 font-mono text-xs leading-relaxed text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none resize-none whitespace-pre"
                  spellCheck={false}
                  placeholder="Type or design your template here... Drag & Drop fields, logical condition blocks, and formulas from the right side panel."
                />
                {viewModeWarning && (
                  <div
                    role="status"
                    className="absolute top-3 left-1/2 -translate-x-1/2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 shadow-lg dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
                  >
                    You are in view mode. Switch to Edit to modify this INI file.
                  </div>
                )}
                
                {/* Micro Footer Bar */}
                <div className="h-6 theme-editor-panel border-t theme-border px-4 flex items-center justify-between text-[10px] theme-disabled font-mono">
                  <span>Lines: {fileContent.split('\n').length} | Chars: {fileContent.length}</span>
                  <span>{isTemplateEditMode ? 'Edit mode' : 'View mode'}</span>
                </div>
              </div>

              {/* Right Panel: Re-engineered Editor Tools */}
              <div 
                style={{ width: `${rightPanelWidth}px` }}
                className="relative border-l theme-border theme-surface-muted flex flex-col shrink-0"
              >
                
                {/* Horizontal Resize Drag Handle on the Left edge */}
                <div
                  onMouseDown={handleMouseDownResizeRight}
                  className={`absolute top-0 left-0 -ml-1 w-2 h-full cursor-col-resize hover:bg-indigo-500/50 transition-colors z-50${isResizingRight ? 'bg-indigo-600' : 'bg-transparent'}`}
                  title="Drag to resize Tools panel"
                />

                {/* Single Elegant Header instead of Tabs */}
                <div className="flex border-b theme-border theme-surface-muted shrink-0 items-center justify-center py-3">
                  <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    Extracted Context
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                  
                  {/* TAB 1: Extracted Context */}
                  {activeTab === 'extracted_context' && (
                    <div className="space-y-3.5">
                      
                      {/* Static Info Alert with Test / Clear Button */}
                      <div className="p-2.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/40 text-[11px] leading-relaxed flex items-center justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <Database className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-semibold text-indigo-700 dark:text-indigo-300">Extracted Context Data</p>
                            <p className="text-gray-600 dark:text-gray-400 text-[10px] mt-0.5 truncate max-w-[140px]" title={isTested ? testFileName || 'Uploaded Excel' : 'extracted_context.json'}>
                              {isTested ? `Extracted: ${testFileName || 'Excel'}` : 'Loaded from extracted_context.json'}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (isUploadingTestExcel) return;
                            if (isTested) {
                              handleClearTestedValues();
                            } else {
                              setTestExcelError(null);
                              setIsTestModalOpen(true);
                            }
                          }}
                          disabled={isUploadingTestExcel}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all shrink-0 flex items-center gap-1.5 shadow-xs ${
                            isUploadingTestExcel
                              ? 'bg-indigo-600/70 text-white cursor-wait'
                              : isTested
                                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-300/60 dark:border-rose-800/60 cursor-pointer'
                                : 'bg-indigo-600 hover:bg-indigo-700 !text-white text-white shadow-indigo-500/20 cursor-pointer'
                          }`}
                          title={isUploadingTestExcel ? "Loading and extracting Excel context" : isTested ? "Clear extracted test values" : "Test context extraction with an Excel sheet"}
                        >
                          {isUploadingTestExcel ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                              <span>Loading...</span>
                            </>
                          ) : isTested ? (
                            <>
                              <X className="w-3.5 h-3.5" />
                              <span>Clear</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 !text-white text-white" />
                              <span className="!text-white text-white font-bold">Test</span>
                            </>
                          )}
                        </button>
                      </div>

                      {contextSheetTab === 'Custom' && isExtractingCustomContext && (
                        <div role="status" className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
                          Extracting global keys using their saved prompts...
                        </div>
                      )}
                      {contextSheetTab === 'Custom' && customExtractionError && (
                        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                          Custom key extraction failed: {customExtractionError}
                        </div>
                      )}

                      {/* Sheet Select Tab Pills */}
                      <div className="flex rounded-lg bg-gray-200/70 dark:bg-[#202020] p-1 border border-gray-300/70 dark:border-gray-800 shrink-0">
                        {(['Modules', 'EDI', 'Document', 'Custom'] as const).map(sheet => (
                          <button
                            key={sheet}
                            onClick={() => {
                              setContextSheetTab(sheet);
                              setContextSearch('');
                            }}
                            className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                              contextSheetTab === sheet 
                                ? 'bg-indigo-600 !text-white text-white shadow-xs' 
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-gray-800/50'
                            }`}
                          >
                            <span className={contextSheetTab === sheet ? '!text-white text-white' : ''}>{sheet}</span>
                          </button>
                        ))}
                      </div>

                      {/* Add Custom Global Key Action Row (shown when Custom tab is selected) */}
                      {contextSheetTab === 'Custom' && (
                        <div className="p-2.5 rounded-xl bg-gray-100/80 dark:bg-[#202020] border border-gray-300/80 dark:border-gray-800 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Add Custom Global Key</span>
                          <button
                            onClick={() => handleOpenCustomKeyModal(null)}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 !text-white text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer shrink-0 flex items-center gap-1 shadow-xs"
                            title="Add Custom Global Key"
                          >
                            <Plus size={13} className="!text-white text-white" />
                            <span className="!text-white text-white">Add</span>
                          </button>
                        </div>
                      )}

                      {/* Search & Toggle row/fields */}
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                          <input
                            type="text"
                            value={contextSearch}
                            onChange={(e) => setContextSearch(e.target.value)}
                            placeholder={`Search ${contextSheetTab} keys...`}
                            className="w-full bg-white dark:bg-[#202020] border border-gray-300 dark:border-gray-700 rounded-lg pl-8 pr-7 py-2 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors"
                          />
                          {contextSearch && (
                            <button onClick={() => setContextSearch('')} className="absolute right-2 top-2 p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        
                        <div className="flex bg-gray-200/70 dark:bg-[#202020] border border-gray-300/70 dark:border-gray-800 rounded-lg p-0.5 shrink-0">
                          <button
                            onClick={() => setContextViewMode('fields')}
                            className={`p-1.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              contextViewMode === 'fields' 
                                ? 'bg-indigo-600 !text-white text-white shadow-xs' 
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                            title="Fields View (Unique Keys)"
                          >
                            <span className={contextViewMode === 'fields' ? '!text-white text-white' : ''}>Keys</span>
                          </button>
                          <button
                            onClick={() => setContextViewMode('rows')}
                            className={`p-1.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              contextViewMode === 'rows' 
                                ? 'bg-indigo-600 !text-white text-white shadow-xs' 
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                            title="Rows View (Dynamic Records)"
                          >
                            <span className={contextViewMode === 'rows' ? '!text-white text-white' : ''}>Rows</span>
                          </button>
                        </div>
                      </div>

                      {/* Content Render: Keys vs. Rows list */}
                      {contextViewMode === 'fields' ? (
                        <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                          {filteredKeys.length === 0 ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-6">No matching fields found</p>
                          ) : (
                            filteredKeys.map(field => {
                              const cleanField = field.replace(/\n/g, ' ');
                              const val = getValueForKey(contextSheetTab, field);

                              return (
                                <div
                                  key={field}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, `{${field}}`)}
                                  onClick={() => insertText(`{${field}}`)}
                                  className="w-full text-left px-2.5 py-2 rounded-lg bg-white dark:bg-[#202020] hover:bg-indigo-50/70 dark:hover:bg-gray-800 text-xs transition-colors flex items-center justify-between group cursor-pointer border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-500/40 shadow-xs gap-2"
                                  title={`Click to insert {${field}}, or drag & drop`}
                                >
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="font-mono text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-200 font-semibold truncate" title={field}>
                                      {cleanField}
                                    </span>
                                    {isTested && (
                                      <span className="text-[10.5px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 truncate flex items-center gap-1">
                                        <span className="text-gray-400 dark:text-gray-500 select-none">=</span>
                                        <span className="truncate font-medium">{val !== '' && val !== null ? val : <span className="italic text-gray-400 dark:text-gray-600">null</span>}</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {contextSheetTab === 'Custom' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenCustomKeyModal(field);
                                        }}
                                        className="p-1 rounded-md hover:bg-indigo-100 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                                        title={`Edit custom key ${field}`}
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <CornerDownLeft size={11} className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-gray-500 shrink-0 ml-1" />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                          {Object.keys(contextGroups).map(subgroupName => {
                            const rows = contextGroups[subgroupName] || [];
                            return (
                              <div key={subgroupName} className="space-y-1.5">
                                <h5 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider pl-1 mt-1">{subgroupName}</h5>
                                
                                {rows.length === 0 ? (
                                  <p className="text-[10px] text-gray-400 italic pl-1.5">No rows in this subgroup</p>
                                ) : (
                                  rows.map((row, idx) => {
                                    const rowKeyId = `${contextSheetTab}_${subgroupName}_${idx}`;
                                    const isExpanded = !!expandedRows[rowKeyId];
                                    
                                    // Extract title fields to show in row preview
                                    const previewText = row.Module_Filename || row.EDI_Filename || row.Document_Filename || row.Document_Document || row.Module_Name || row.EDI_Key || row.Document_Key || 'Record ' + (idx + 1);

                                    return (
                                      <div key={idx} className="bg-white dark:bg-[#202020] rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs">
                                        <button
                                          onClick={() => toggleRowExpansion(rowKeyId)}
                                          className="w-full px-2.5 py-2 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 text-xs transition-colors cursor-pointer"
                                        >
                                          <div className="flex items-center gap-1.5 truncate">
                                            <Grid className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
                                            <span className="font-semibold text-gray-500 dark:text-gray-400 text-[10px] shrink-0">Row {idx + 1}:</span>
                                            <span className="truncate text-gray-800 dark:text-gray-200 text-[11px] font-medium" title={String(previewText)}>{String(previewText)}</span>
                                          </div>
                                          {isExpanded ? <ChevronDown size={12} className="text-gray-400 dark:text-gray-500" /> : <ChevronRight size={12} className="text-gray-400 dark:text-gray-500" />}
                                        </button>

                                        {isExpanded && (
                                          <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-[#181818] p-2 space-y-1 text-[10px]">
                                            {Object.keys(row).map(k => {
                                              const cleanKey = k.replace(/\n/g, ' ');
                                              return (
                                                <div 
                                                  key={k}
                                                  draggable
                                                  onDragStart={(e) => handleDragStart(e, `{${k}}`)}
                                                  onClick={() => insertText(`{${k}}`)}
                                                  className="flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800/80 px-1.5 py-1 rounded font-mono group cursor-pointer transition-colors gap-2 text-gray-800 dark:text-gray-200"
                                                  title={`Click to insert {${k}}, or drag & drop`}
                                                >
                                                  <span className="text-indigo-700 dark:text-indigo-300 font-semibold truncate flex-1" title={k}>{cleanKey}</span>
                                                  <div className="flex items-center gap-1.5 shrink-0 max-w-[60%]">
                                                    <span className="text-gray-600 dark:text-gray-400 text-right truncate" title={formatContextValue(row[k])}>
                                                      {!isTested ? (
                                                        <span className="text-gray-400 italic">cleared</span>
                                                      ) : row[k] === '' || row[k] === null ? (
                                                        <span className="text-gray-400 italic">null</span>
                                                      ) : (
                                                        formatContextValue(row[k])
                                                      )}
                                                    </span>
                                                    <CornerDownLeft size={9} className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-gray-500 shrink-0" />
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>

            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center theme-disabled theme-editor">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-gray-800/40 flex items-center justify-center mb-4 border theme-border">
              <FileCode size={32} className="text-gray-600" />
            </div>
            <p className="text-sm font-semibold theme-muted">Select an INI template file to edit</p>
            <p className="text-xs text-gray-600 mt-1">Or create a new file or folder in the sidebar tree explorer</p>
          </div>
        )}
      </div>

      {saveConfirmation && (
        <div
          className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center z-[10000] p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSavingLocal) setSaveConfirmation(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-template-title"
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-[#1e1e1e]"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                <Save className="h-5 w-5" />
              </div>
              <div>
                <h3 id="save-template-title" className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Confirm save
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                  Save changes to <span className="font-semibold text-gray-900 dark:text-gray-100">{saveConfirmation.fileName}</span>?
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={isSavingLocal}
                onClick={() => setSaveConfirmation(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingLocal}
                onClick={confirmSaveTemplate}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
              >
                {isSavingLocal && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                {isSavingLocal ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Upload Test Modal Popup */}
      {isTestModalOpen && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-2xl max-w-md w-full relative animate-in fade-in zoom-in-95 duration-150">
            
            {/* Close Button */}
            <button
              onClick={() => {
                if (!isUploadingTestExcel) {
                  setIsTestModalOpen(false);
                }
              }}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Test Context Extraction</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Upload Excel sheet (Modules, EDI, Document) to extract context JSON and test key values.</p>
              </div>
            </div>

            {/* Dropzone / Upload Area */}
            <div 
              className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-xl p-6 text-center cursor-pointer bg-gray-50/50 dark:bg-[#181818] transition-colors relative group"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleUploadExcelFile(e.dataTransfer.files[0]);
                }
              }}
            >
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleUploadExcelFile(e.target.files[0]);
                  }
                }}
                disabled={isUploadingTestExcel}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
              />
              
              {isUploadingTestExcel ? (
                <div className="flex flex-col items-center justify-center py-3 space-y-2">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Extracting context & JSON data...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <Upload className="w-8 h-8 text-indigo-500/80 dark:text-indigo-400/80 group-hover:scale-105 transition-transform" />
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                    Drag & drop Excel file here, or <span className="text-indigo-600 dark:text-indigo-400 underline">browse</span>
                  </p>
                  <p className="text-[10px] text-gray-400">Supports .xlsx, .xls, .csv with Modules, EDI, Document sheets</p>
                </div>
              )}
            </div>

            {testExcelError && (
              <p className="text-[11px] text-rose-500 mt-2 text-center font-medium">{testExcelError}</p>
            )}

            {/* Divider & Sample Excel Option */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-gray-800" /></div>
              <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-white dark:bg-[#1e1e1e] px-2 text-gray-400 font-semibold">Or</span></div>
            </div>

            <button
              onClick={handleLoadSampleExcel}
              disabled={isUploadingTestExcel}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Use Sample Excel Sheet (Trader Joe's EDI)</span>
            </button>
          </div>
        </div>
      )}

      {/* Custom Global Key Modal (Add / Edit) */}
      {isCustomKeyModalOpen && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-2xl max-w-md w-full relative animate-in fade-in zoom-in-95 duration-150 space-y-4">
            
            {/* Close Button */}
            <button
              onClick={() => setIsCustomKeyModalOpen(false)}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                {editingKeyName ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {editingKeyName ? `Edit Custom Global Key` : 'Add Custom Global Key'}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {editingKeyName ? 'Update key name, prompt instructions, and example value.' : 'Define key name, prompt instructions, and example value.'}
                </p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-3 text-xs">
              {/* Key Name */}
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 dark:text-gray-300 block">
                  Key Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={keyFormName}
                  onChange={(e) => setKeyFormName(e.target.value)}
                  placeholder="e.g. G_Environment"
                  className="w-full bg-gray-50 dark:bg-[#181818] border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none focus:border-indigo-500 font-mono text-xs"
                />
              </div>

              {/* Prompt */}
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 dark:text-gray-300 block">
                  Prompt
                </label>
                <textarea
                  rows={3}
                  value={keyFormPrompt}
                  onChange={(e) => setKeyFormPrompt(e.target.value)}
                  placeholder="e.g. Trading partner ISO package code designation for EDI format lookup..."
                  className="w-full bg-gray-50 dark:bg-[#181818] border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none focus:border-indigo-500 text-xs resize-none"
                />
              </div>

              {/* Example */}
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 dark:text-gray-300 block">
                  Example
                </label>
                <input
                  type="text"
                  value={keyFormExample}
                  onChange={(e) => setKeyFormExample(e.target.value)}
                  placeholder="e.g. PROD or TRADER.JOES-US"
                  className="w-full bg-gray-50 dark:bg-[#181818] border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none focus:border-indigo-500 font-mono text-xs"
                />
              </div>
            </div>

            {keyFormError && (
              <p className="text-[11px] text-rose-500 font-medium">{keyFormError}</p>
            )}

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setIsCustomKeyModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomKey}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {showSaveToast && (
        <div className="fixed bottom-5 right-5 z-[9999] bg-emerald-500 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-emerald-400/20 animate-in fade-in slide-in-from-bottom-2">
          <Check size={14} className="bg-white/25 p-0.5 rounded-full shrink-0" />
          <span>Template saved successfully!</span>
        </div>
      )}
      {templateSaveError && (
        <div role="alert" className="fixed bottom-5 right-5 z-[9999] max-w-md bg-rose-600 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg border border-rose-400/30">
          Could not save template: {templateSaveError}
        </div>
      )}
    </div>
  );
}
