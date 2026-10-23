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
  ChevronsUp
} from 'lucide-react';

interface FileNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  fileType?: 'ini' | 'sql';
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
        "EDI_Syntax": "",
        "EDI_APRF": "",
        "EDI_Address(Live[Test])": "",
        "EDI_ValidateDocs": null,
        "EDI_FunctionAck(FA)Module": "",
        "EDI_Details": {
          "EDI_Interchange_Version": "",
          "EDI_Interchange_RepChar": "",
          "EDI_Group_Code": "",
          "EDI_Group_Agency": "",
          "EDI_Group_Version": "",
          "EDI_Message_Code": ""
        }
      },
      {
        "EDI_Item": 2,
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
        "EDI_ValidateDocs": null,
        "EDI_FunctionAck(FA)Module": "",
        "EDI_Details": {
          "EDI_Interchange_Version": "",
          "EDI_Interchange_RepChar": "",
          "EDI_Group_Code": "",
          "EDI_Group_Agency": "",
          "EDI_Group_Version": "",
          "EDI_Message_Code": ""
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
        "Document_FilenameSuffix": "",
        "Document_Validate": "",
        "Document_ValidationFile": "",
        "Document_ValidationDescription": "",
        "Document_Report": "",
        "Document_PrintOnly": "",
        "Document_Export": "",
        "Document_Hide": ""
      },
      {
        "Document_Item": 2,
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
  
  // Tabs layout as direct user requested: (Extracted Context, Conditions & Logic, Functions)
  const [activeTab, setActiveTab] = useState<'extracted_context' | 'conditions_logic' | 'functions'>('extracted_context');
  
  // Sub-navigation inside Extracted Context (pills for Modules, EDI, Document)
  const [contextSheetTab, setContextSheetTab] = useState<'Modules' | 'EDI' | 'Document'>('Modules');
  const [contextSearch, setContextSearch] = useState('');
  const [contextViewMode, setContextViewMode] = useState<'fields' | 'rows'>('fields');
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});
  
  // Search state inside Functions
  const [functionSearch, setFunctionSearch] = useState('');
  const [expandedFunctionCategory, setExpandedFunctionCategory] = useState<string | null>('Text Functions');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
          setFileSystem(result.data);
          
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
    if (!activeFileId || !history[activeFileId] || history[activeFileId].past.length === 0) return;
    
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
    if (!activeFileId || !history[activeFileId] || history[activeFileId].future.length === 0) return;
    
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
    if (activeFileId && history[activeFileId]) {
      const activeFileNode = getFileById(activeFileId, fileSystem);
      if (!activeFileNode) return;

      const contentToSave = history[activeFileId].present;
      
      // Update local state first for instant response
      setFileSystem(updateFileContentFileSystem(activeFileId, contentToSave, fileSystem));
      
      try {
        setIsSavingLocal(true);
        const fileRelativePath = activeFileNode.path || activeFileNode.name;
        
        const res = await fetch('/api/templates/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filePath: fileRelativePath,
            content: contentToSave,
            configuredDir: templateFolderPath
          })
        });

        if (res.ok) {
          const result = await res.json();
          if (result.success) {
            setShowSaveToast(true);
            setTimeout(() => {
              setShowSaveToast(false);
            }, 3000);
          }
        }
      } catch (err) {
        console.error("Error saving file locally on server disk:", err);
      } finally {
        setIsSavingLocal(false);
      }
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
          className={`flex items-center py-1.5 px-2 cursor-pointer hover:bg-gray-700/50 rounded transition-colors group ${activeFileId === node.id ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-300'}`}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => handleSelectFile(node.id)}
        >
          {node.type === 'folder' ? (
            <>
              {node.isOpen ? <ChevronDown size={14} className="mr-1 text-gray-500 shrink-0" /> : <ChevronRight size={14} className="mr-1 text-gray-500 shrink-0" />}
              <Folder size={16} className="mr-2 text-yellow-500 shrink-0" />
            </>
          ) : (
            <>
              <span className="w-[18px] shrink-0" />
              {node.fileType === 'sql' ? <FileCode size={16} className="mr-2 text-blue-400 shrink-0" /> : <FileText size={16} className="mr-2 text-gray-400 shrink-0" />}
            </>
          )}
          
          {renamingNodeId === node.id ? (
            <div className="flex-1 flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                className="flex-1 bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded outline-none border border-indigo-500 min-w-0"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitRenameNode(node.id);
                  if (e.key === 'Escape') setRenamingNodeId(null);
                }}
              />
              <button
                onClick={(e) => { e.stopPropagation(); submitRenameNode(node.id); }}
                className="p-0.5 hover:bg-gray-700 rounded text-emerald-400"
                title="Save Name"
              >
                <Check size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setRenamingNodeId(null); }}
                className="p-0.5 hover:bg-gray-700 rounded text-rose-400"
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
          <div className="flex items-center py-1 px-2 pr-4 bg-gray-800/30 rounded mt-0.5" style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}>
            {isCreatingNode.type === 'folder' ? <Folder size={14} className="mr-2 text-yellow-500 shrink-0" /> : <FileText size={14} className="mr-2 text-gray-400 shrink-0" />}
            <input 
              autoFocus
              className="flex-1 bg-gray-800 text-white text-sm px-1.5 py-0.5 rounded outline-none border border-indigo-500 w-full min-w-0"
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
                className="p-0.5 hover:bg-gray-700 rounded text-emerald-400 hover:text-emerald-300"
                title="Confirm"
              >
                <Check size={14} />
              </button>
              <button 
                onMouseDown={(e) => { e.preventDefault(); setIsCreatingNode(null); }} 
                className="p-0.5 hover:bg-gray-700 rounded text-rose-400 hover:text-rose-300"
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
    <div ref={containerRef} className="flex h-full w-full bg-[#111111] text-gray-200 overflow-hidden font-sans">
      
      {/* Invisible full screen resize overlay to capture drag event moves safely */}
      {(isResizing || isResizingRight) && (
        <div className="fixed inset-0 z-[9999] cursor-col-resize select-none pointer-events-auto bg-transparent" />
      )}

      {/* Sidebar: File Explorer */}
      <div 
        style={{ width: `${sidebarWidth}px` }}
        className="relative border-r border-gray-800 flex flex-col bg-[#161616] shrink-0 h-full select-none"
      >
        <div className="p-4 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 truncate">Templates</h2>
          </div>
          
          {/* Collapse and Expand actions for folders/subfolders/files */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleExpandAll}
              className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Expand All"
            >
              <ChevronsDown size={14} />
            </button>
            <button
              onClick={handleCollapseAll}
              className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Collapse All"
            >
              <ChevronsUp size={14} />
            </button>
          </div>
        </div>

        {/* Configured Folder Path */}
        <div className="px-3 py-2.5 border-b border-gray-800 bg-[#141414] flex flex-col gap-1.5 shrink-0">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Local Folder Path</label>
          <div className="text-xs text-indigo-300 font-mono bg-[#1c1c1c] border border-gray-800 rounded px-2.5 py-1.5 break-all leading-relaxed whitespace-pre-wrap">
            {templateFolderPath}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {fileSystem.length === 0 ? (
            <div className="text-center py-8 px-4 text-xs text-gray-500 leading-relaxed">
              No template files found in the directory.
            </div>
          ) : (
            renderTree(fileSystem)
          )}
          
          {isCreatingNode?.parentId === null && (
            <div className="flex items-center py-1 px-2 pr-4 bg-gray-800/30 rounded mt-1">
              {isCreatingNode.type === 'folder' ? <Folder size={14} className="mr-2 text-yellow-500 shrink-0" /> : <FileText size={14} className="mr-2 text-gray-400 shrink-0" />}
              <input 
                autoFocus
                className="flex-1 bg-gray-800 text-white text-sm px-1.5 py-0.5 rounded outline-none border border-indigo-500 w-full min-w-0"
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
                  className="p-0.5 hover:bg-gray-700 rounded text-emerald-400 hover:text-emerald-300"
                >
                  <Check size={14} />
                </button>
                <button 
                  onMouseDown={(e) => { e.preventDefault(); setIsCreatingNode(null); }} 
                  className="p-0.5 hover:bg-gray-700 rounded text-rose-400 hover:text-rose-300"
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
          className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/50 transition-colors z-50 ${isResizing ? 'bg-indigo-600' : 'bg-transparent'}`}
          title="Drag to resize Templates panel"
        />
      </div>

      {/* Main Area: Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeFile ? (
          <>
            <div className="h-12 border-b border-gray-800 flex items-center justify-between px-4 bg-[#141414] shrink-0">
              <div className="flex items-center text-sm truncate">
                <span className="text-gray-500">Templates</span>
                <ChevronRight size={14} className="mx-2 text-gray-700 shrink-0" />
                <span className="text-gray-200 font-medium truncate">{activeFile.name}</span>
                
                {/* Undo/Redo tools */}
                <div className="flex items-center space-x-1 ml-6 border-l border-gray-800 pl-4">
                  <button 
                    onClick={undo} disabled={!canUndo}
                    className={`p-1.5 rounded transition-colors ${canUndo ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : 'text-gray-600 cursor-not-allowed'}`} 
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo size={14} />
                  </button>
                  <button 
                    onClick={redo} disabled={!canRedo}
                    className={`p-1.5 rounded transition-colors ${canRedo ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : 'text-gray-600 cursor-not-allowed'}`} 
                    title="Redo (Ctrl+Y)"
                  >
                    <Redo size={14} />
                  </button>
                </div>
              </div>
              <button 
                onClick={handleSave}
                className="flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded transition-colors shrink-0 shadow-md shadow-indigo-900/10"
              >
                <Save size={14} className="mr-1.5" /> Save Template
              </button>
            </div>
            
            <div className="flex-1 flex min-h-0">
              {/* Editor View */}
              <div className="flex-1 flex flex-col relative bg-[#090909]">
                <textarea
                  ref={textareaRef}
                  id="template-editor"
                  value={fileContent}
                  onChange={(e) => {
                    if (activeFileId) updateHistory(activeFileId, e.target.value);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
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
                  className="flex-1 w-full bg-transparent border-none p-5 font-mono text-xs leading-relaxed text-gray-300 focus:outline-none resize-none whitespace-pre"
                  spellCheck={false}
                  placeholder="Type or design your template here... Drag & Drop fields, logical condition blocks, and formulas from the right side panel."
                />
                
                {/* Micro Footer Bar */}
                <div className="h-6 bg-[#111111] border-t border-gray-800 px-4 flex items-center justify-between text-[10px] text-gray-500 font-mono">
                  <span>Lines: {fileContent.split('\n').length} | Chars: {fileContent.length}</span>
                  <span>Drag & Drop Enabled</span>
                </div>
              </div>

              {/* Right Panel: Re-engineered Editor Tools */}
              <div 
                style={{ width: `${rightPanelWidth}px` }}
                className="relative border-l border-gray-800 bg-[#161616] flex flex-col shrink-0"
              >
                
                {/* Horizontal Resize Drag Handle on the Left edge */}
                <div
                  onMouseDown={handleMouseDownResizeRight}
                  className={`absolute top-0 left-0 -ml-1 w-2 h-full cursor-col-resize hover:bg-indigo-500/50 transition-colors z-50 ${isResizingRight ? 'bg-indigo-600' : 'bg-transparent'}`}
                  title="Drag to resize Tools panel"
                />

                {/* Single Elegant Header instead of Tabs */}
                <div className="flex border-b border-gray-800 bg-[#1A1A1A] shrink-0 items-center justify-center py-3">
                  <span className="text-[11px] font-semibold text-indigo-400">
                    Extracted Context
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                  
                  {/* TAB 1: Extracted Context */}
                  {activeTab === 'extracted_context' && (
                    <div className="space-y-3.5">
                      
                      {/* Static Info Alert */}
                      <div className="p-2.5 rounded-lg bg-gray-800/40 border border-gray-700/50 text-[11px] leading-relaxed text-gray-300 flex items-start gap-2">
                        <Database className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-indigo-400">Extracted Context Data</p>
                          <p className="text-gray-400 text-[10px] mt-0.5 truncate max-w-[210px]">Loaded from extracted_context.json</p>
                        </div>
                      </div>

                      {/* Sheet Select Tab Pills */}
                      <div className="flex rounded-lg bg-black/40 p-1 border border-gray-800 shrink-0">
                        {(['Modules', 'EDI', 'Document'] as const).map(sheet => (
                          <button
                            key={sheet}
                            onClick={() => {
                              setContextSheetTab(sheet);
                              setContextSearch('');
                            }}
                            className={`flex-1 py-1 rounded text-[10px] font-semibold transition-all ${contextSheetTab === sheet ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                          >
                            {sheet}
                          </button>
                        ))}
                      </div>

                      {/* Search & Toggle row/fields */}
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-600" />
                          <input
                            type="text"
                            value={contextSearch}
                            onChange={(e) => setContextSearch(e.target.value)}
                            placeholder={`Search ${contextSheetTab} keys...`}
                            className="w-full bg-black/40 border border-gray-800 rounded-lg pl-8 pr-7 py-2 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-indigo-500"
                          />
                          {contextSearch && (
                            <button onClick={() => setContextSearch('')} className="absolute right-2 top-2 p-1 text-gray-500 hover:text-gray-300">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        
                        <div className="flex bg-black/40 border border-gray-800 rounded-lg p-0.5 shrink-0">
                          <button
                            onClick={() => setContextViewMode('fields')}
                            className={`p-1.5 rounded-md text-[10px] font-semibold transition-all ${contextViewMode === 'fields' ? 'bg-[#2A2A2A] text-indigo-400 shadow-sm' : 'text-gray-600 hover:text-gray-300'}`}
                            title="Fields View (Unique Keys)"
                          >
                            Keys
                          </button>
                          <button
                            onClick={() => setContextViewMode('rows')}
                            className={`p-1.5 rounded-md text-[10px] font-semibold transition-all ${contextViewMode === 'rows' ? 'bg-[#2A2A2A] text-indigo-400 shadow-sm' : 'text-gray-600 hover:text-gray-300'}`}
                            title="Rows View (Dynamic Records)"
                          >
                            Rows
                          </button>
                        </div>
                      </div>

                      {/* Content Render: Keys vs. Rows list */}
                      {contextViewMode === 'fields' ? (
                        <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                          {filteredKeys.length === 0 ? (
                            <p className="text-xs text-gray-600 text-center py-6">No matching fields found</p>
                          ) : (
                            filteredKeys.map(field => {
                              const cleanField = field.replace(/\n/g, ' ');
                              return (
                                <div
                                  key={field}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, `{${field}}`)}
                                  onClick={() => insertText(`{${field}}`)}
                                  className="w-full text-left px-2.5 py-2 rounded-lg bg-gray-800/40 hover:bg-gray-800 text-xs font-mono text-indigo-300 hover:text-indigo-200 transition-colors flex items-center justify-between group cursor-pointer border border-gray-800 hover:border-indigo-500/40 shadow-sm gap-2"
                                  title={`Click to insert {${field}}, or drag & drop`}
                                >
                                  <span className="truncate flex-1" title={field}>{cleanField}</span>
                                  <CornerDownLeft size={11} className="opacity-0 group-hover:opacity-100 text-gray-500 shrink-0 ml-1.5" />
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
                                <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pl-1 mt-1">{subgroupName}</h5>
                                
                                {rows.length === 0 ? (
                                  <p className="text-[10px] text-gray-600 italic pl-1.5">No rows in this subgroup</p>
                                ) : (
                                  rows.map((row, idx) => {
                                    const rowKeyId = `${contextSheetTab}_${subgroupName}_${idx}`;
                                    const isExpanded = !!expandedRows[rowKeyId];
                                    
                                    // Extract title fields to show in row preview
                                    const previewText = row.Module_Filename || row.EDI_Filename || row.Document_Filename || row.Document_Document || row.Module_Name || row.EDI_Key || row.Document_Key || 'Record ' + (idx + 1);

                                    return (
                                      <div key={idx} className="bg-[#1D1D1D] rounded-lg border border-gray-800/60 overflow-hidden shadow-sm">
                                        <button
                                          onClick={() => toggleRowExpansion(rowKeyId)}
                                          className="w-full px-2.5 py-2 text-left flex items-center justify-between hover:bg-gray-800/40 text-xs text-gray-300 transition-colors"
                                        >
                                          <div className="flex items-center gap-1.5 truncate">
                                            <Grid className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                            <span className="font-semibold text-gray-400 text-[10px] shrink-0">Row {idx + 1}:</span>
                                            <span className="truncate text-gray-200 text-[11px] font-medium" title={String(previewText)}>{String(previewText)}</span>
                                          </div>
                                          {isExpanded ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />}
                                        </button>

                                        {isExpanded && (
                                          <div className="border-t border-gray-800 bg-[#141414] p-2 space-y-1 text-[10px]">
                                            {Object.keys(row).map(k => {
                                              const cleanKey = k.replace(/\n/g, ' ');
                                              return (
                                                <div 
                                                  key={k}
                                                  draggable
                                                  onDragStart={(e) => handleDragStart(e, `{${k}}`)}
                                                  onClick={() => insertText(`{${k}}`)}
                                                  className="flex items-center justify-between hover:bg-gray-800 px-1.5 py-1 rounded font-mono group cursor-pointer transition-colors gap-2"
                                                  title={`Click to insert {${k}}, or drag & drop`}
                                                >
                                                  <span className="text-indigo-300 font-semibold truncate flex-1" title={k}>{cleanKey}</span>
                                                  <div className="flex items-center gap-1.5 shrink-0 max-w-[60%]">
                                                    <span className="text-gray-400 text-right truncate" title={String(row[k])}>
                                                      {row[k] === '' || row[k] === null ? <span className="text-gray-700 italic">null</span> : String(row[k])}
                                                    </span>
                                                    <CornerDownLeft size={9} className="opacity-0 group-hover:opacity-100 text-gray-500 shrink-0" />
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
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-[#0A0A0A]">
            <div className="w-16 h-16 rounded-2xl bg-gray-800/40 flex items-center justify-center mb-4 border border-gray-800">
              <FileCode size={32} className="text-gray-600" />
            </div>
            <p className="text-sm font-semibold text-gray-400">Select an INI template file to edit</p>
            <p className="text-xs text-gray-600 mt-1">Or create a new file or folder in the sidebar tree explorer</p>
          </div>
        )}
      </div>

      {showSaveToast && (
        <div className="fixed bottom-5 right-5 z-[9999] bg-emerald-500 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-emerald-400/20 animate-in fade-in slide-in-from-bottom-2">
          <Check size={14} className="bg-white/25 p-0.5 rounded-full shrink-0" />
          <span>Template saved successfully!</span>
        </div>
      )}
    </div>
  );
}
