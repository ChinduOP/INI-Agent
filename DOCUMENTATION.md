# System & Architecture Documentation: INI Agent Web Platform

Welcome to the comprehensive system documentation for the **INI Agent Web Platform**. This document provides an in-depth technical overview of the platform's visual interface, data ingestion engine, AI-driven knowledge extraction, and state-machine orchestration workflow.

---

## 📖 Table of Contents
1. [Platform Overview & Visual Layout](#1-platform-overview--visual-layout)
2. [Worksheet Data Extraction Engine](#2-worksheet-data-extraction-engine)
3. [AI Implementation & Prompt Heuristics](#3-ai-implementation--prompt-heuristics)
4. [LangGraph State-Machine Orchestration](#4-langgraph-state-machine-orchestration)
5. [System Architecture & Dataflow Diagrams](#5-system-architecture--dataflow-diagrams)
6. [Interactive Monaco Editor & Live Mappings](#6-interactive-monaco-editor-with-drag--drop)

---

## 1. Platform Overview & Visual Layout

The application is structured as a responsive, desktop-first workspace with two primary functional views managed by a global React state engine (`chatStore`).

### Page 1: AI Chat Assistant (`ChatWindow`)
*   **Purpose**: Provides an immersive, dual-panel conversation space for analyzing data workbooks and generating configured outputs.
*   **Left Panel (Chat Feed)**:
    *   **Interactive Input Box**: Allows users to enter natural language instructions, attach template files directly, or toggle test configurations.
    *   **Trace Log Accordion (`AiStatusIndicator`)**: Renders a live, step-by-step audit of the LangGraph execution path. Users can watch the status (started, completed, skipped, or failed) of each node during orchestration.
    *   **Attachment Manager**: Displays active Excel files and manually uploaded INI files associated with the conversation session.
*   **Right Panel (Notepad Viewer)**:
    *   **Monaco Code Editor**: An embeddable editor rendering the newly generated INI files.
    *   **Split Screen Layout**: Utilizes a resizable split view (via custom mouse-drag handlers).
    *   **Worksheet Schema Display (Left Tab)**: Dynamically fetches `/api/upload/data` to show the parsed and structured columns from the active workbook.
    *   **Dynamic Mapping Status (Right Tab)**: Compares the generated INI parameters against mapped templates and dictionary variables to verify data matching.
    *   **Validation Alert Banner**: Indicates whether the generated file conforms to strict format validations (e.g., duplicate headers, syntax anomalies, or missing values marked as `TODO`).

### Page 2: Template Manager & Editor (`TemplateManagerPage`)
*   **Purpose**: Serves as a full-featured Integrated Development Environment (IDE) to organize template files and create custom configurations.
*   **Left Panel (Template File Tree)**:
    *   Recursively lists all directories and files inside the configured templates folder.
    *   Supports live inline file/folder creation, file deletion, and direct file selection.
*   **Middle Panel (Monaco Template Editor)**:
    *   Renders the raw INI template structure with persistent auto-saving.
    *   Allows editing the template layout, adding placeholder variables (e.g., `{Module_Name}`), and saving direct modifications back to disk.
*   **Right Panel (Worksheet Data & Key Browser)**:
    *   **Live Worksheets Browser**: Displays loaded worksheets (`Modules`, `EDI`, `Document`).
    *   **Key Selector**: Lists every column name extracted from the chosen worksheet row.
    *   **Row-by-Row Inspector**: Lists individual records. Clicking a row expands its details to reveal key-value pairs.
    *   **Drag-and-Drop / Click Insertion**: Clicking a key name or dragging it into the Monaco editor automatically inserts the placeholder variable (e.g. `{EDI_Channel}`) at the current cursor coordinate.

---

## 2. Worksheet Data Extraction Engine

The platform implements a server-side parser powered by the `exceljs` library inside `ExcelService` (`server/services/excel_service.ts`). 

### Core Extraction Pipeline
```
[ Excel Upload (.xlsx) ]
           │
           ▼
 [ exceljs Worksheet Load ] ──► Validate presence of (Modules, EDI, Document)
           │
           ▼
[ Row Data Iteration ] ───────► Standardize & skip blank/formula headings
           │
           ▼
[ EXTRACTION_SCHEMA Alignment ] ──► Map arbitrary column names to normalized fields
```

### The Standardized Schema (`EXTRACTION_SCHEMA`)
To shield the downstream LLM generator from typos or custom headers introduced by trading partners, the engine aligns worksheet records with a strict, normalized schema:

1.  **Modules Worksheet**:
    *   Grouped into Module Types: `DCPReport`, `DocumentReconciliation`, `EdiBatchParser`, `EdiBatchCreator`, `Reports`.
    *   Attributes extracted: `Module_Item`, `Module_Filename`, `Module_Key`, `Module_Class`, `Module_Namespace`, `Module_Name`, `Module_Description`, `Module_Usage`, `Module_Subusage`.
2.  **EDI Worksheet**:
    *   Identifies trading partner communication parameters.
    *   Attributes extracted: `EDI_Item`, `EDI_Channel`, `EDI_Direction`, `EDI_Filename`, `EDI_Group`, `EDI_Subgroup`, `EDI_Subtype`, `EDI_Key`, `EDI_Module`, `EDI_Syntax`, `EDI_Details` (including sub-objects like Interchange Version, Group Version, Message Code).
3.  **Document Worksheet**:
    *   Identifies file routing and business validation rules.
    *   Attributes extracted: `Document_Item`, `Document_Channel`, `Document_Direction`, `Document_Filename`, `Document_Document`, `Document_Classification`, `Document_Key`, `Document_Routing`, `Document_ValidationFile`, `Document_ValidationDescription`.

---

## 3. AI Implementation & Prompt Heuristics

The artificial intelligence engine leverages custom language model configurations via the `LlmService` (`server/services/llm_service.ts`) using the robust `openai` client.

### AI Task Division

```
                          ┌───────────────────────────┐
                          │    userRequest Ingress    │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                       ┌─────────────────────────────────┐
                       │   LlmService.classifyIntent     │
                       └────────────────┬────────────────┘
                                        │
                ┌───────────────────────┴──────────────────────┐
                ▼                                              ▼
        [ general_chat ]                               [ generate_ini ]
   - Standard conversational response            - Ingest parsed Excel worksheets
   - Returns interactive prompt suggestions       - Execute LangGraph State Machine
                                                 - Parse custom knowledge base
                                                 - Format-preserved INI generation
```

### Prompt Engineering Strategies
1.  **Intent Classification (`CHAT_PROMPT`)**:
    *   Decides whether a user wants to converse, configure directory settings, or build an actual configuration. This prevents costly multi-step node traversals for simple greetings.
2.  **Worksheet Analysis (`ANALYZER_PROMPT`)**:
    *   Instructs the LLM to analyze raw JSON strings of parsed worksheets.
    *   Builds an `ExtractedKnowledgeContext` schema containing:
        *   `tradingPartner`: The extracted brand identity (e.g., Garnet Hill, Nordstrom).
        *   `documentTypes`: List of detected transaction sets (e.g., 850, 810, 856).
        *   `dictionary`: A flat key-value dictionary pairing target INI placeholders to worksheet data points.
        *   `customMappings`: User-defined structural overrides.
3.  **INI Generation (`GENERATOR_PROMPT`)**:
    *   **Format-Preservation Rule**: The original layout, indentation, comments, and empty lines of the template *must be preserved exactly*. The LLM replaces only the bracketed parameters (e.g., `{EDI_Channel}`) with extracted data.
    *   **Robust Falling Back**: If a variable is missing from the worksheet, the prompt mandates setting the value to `TODO` alongside a descriptive comment indicating what was expected.

---

## 4. LangGraph State-Machine Orchestration

The backend executes a state-machine graph (`LangGraphEngine` in `server/graph/graph.ts`) which manages strict state progression and failure isolation.

### The Graph State (`LangGraphState`)
```typescript
interface LangGraphState {
  chatHistory: ChatMessage[];
  uploadedExcelPath: string | null;
  uploadedExcelName: string | null;
  parsedExcelData: ParsedExcelData | null;
  extractedContext: ExtractedKnowledgeContext | null;
  selectedTemplatePath: string | null;
  templateText: string | null;
  generatedINI: string | null;
  validationResult: ValidationSummary | null;
  userRequest: string;
  currentNode: string;
  traceLog: TraceMessage[];
  needsExcelUpload: boolean;
}
```

### Graph Progression Flow (Sequence of Nodes)

```
[Start]
  │
  ▼
[UploadNode] ─────────────► Is Excel present?
  │ Yes                         │ No
  ▼                             ▼
[ExcelReader] ◄──────────── [Pause & Prompt User]
  │
  ▼
[ExcelAnalyzer] ──────────► Extract knowledge context via LLM
  │
  ▼
[TemplateFinder] ─────────► Search OneDrive repository (Heuristics or manual override)
  │
  ▼
[TemplateReader] ─────────► Load template file content from disk
  │
  ▼
[IniGenerator] ───────────► Populate template variables via LLM
  │
  ▼
[Validator] ──────────────► Scan syntax & flag formatting anomalies
  │
  ▼
[ResponseNode] ───────────► Finalize output parameters & logs
  │
  ▼
[End]
```

### Conditional Nodes Explained
*   **`UploadNode`**: Interrupts execution if no active Excel workbook has been uploaded. Sets state triggers and prompts the user, returning gracefully.
*   **`TemplateFinder`**: Prioritizes template files manually attached in the current turn. If none exist, it analyzes the `ExtractedKnowledgeContext` (Partner + Document Type) and scans the templates folder on OneDrive recursively to locate the closest visual match (e.g., `Nordstrom/850.ini`).
*   **`Validator`**: Performs server-side sanity checks via `ValidatorService` looking for duplicate headings, unmapped `{brackets}`, and unresolved `TODO` variables.

---

## 5. System Architecture & Dataflow Diagrams

### High-Level Component Interactions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             REACT FRONTEND (Vite)                           │
│                                                                             │
│   ┌────────────────────┐      ┌─────────────────┐     ┌─────────────────┐   │
│   │    Chat Panel      ├─────►│  Notepad Panel  ├────►│Template Manager │   │
│   └─────────▲──────────┘      └────────▲────────┘     └────────▲────────┘   │
└─────────────┼──────────────────────────┼───────────────────────┼────────────┘
              │                          │                       │
              │ API requests             │ API /upload/data      │ API /templates/*
              ▼                          ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EXPRESS BACKEND (Node)                           │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      LangGraphEngine (Orchestrator)                 │   │
│   │                                                                     │   │
│   │  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐          │   │
│   │  │ ExcelService │     │  LlmService  │     │  Validator  │          │   │
│   │  └──────────────┘     └──────────────┘     └─────────────┘          │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Global Dataflow Pipeline

```
1. User uploads Garnet_Hill.xlsx & prompts "Generate 850 INI"
   │
   ▼
2. Express upload handler stores file in /uploads
   │
   ▼
3. LangGraph starts -> ExcelReader extracts Modules, EDI, Document rows
   │
   ▼
4. ExcelAnalyzer asks LLM to find Partner ("Garnet Hill") & Doc ("850")
   │
   ▼
5. TemplateFinder scans OneDrive directory and returns "GarnetHill/850.ini"
   │
   ▼
6. IniGenerator maps standard worksheet values into template format
   │
   ▼
7. Validator verifies syntax, checking if any key failed mapping
   │
   ▼
8. ResponseNode returns file list, trace log, and validation details
   │
   ▼
9. React displays output files in the Notepad panel & renders live schema keys
```

---

## 6. Interactive Monaco Editor with Drag & Drop

One of the most powerful features of the **Template Manager** is the drag-and-drop template mapping system:

### Drag & Drop Event Ingestion Sequence
```
[ User grabs column name "Module_Filename" in Right Panel ]
                             │
                             ▼
     (Fires dragStart: payload formatted as "{Module_Filename}")
                             │
                             ▼
[ User drags over Monaco Editor & releases cursor ]
                             │
                             ▼
  (Editor locates drop coordinates & inserts placeholder "{Module_Filename}")
```

This interaction permits non-technical integration managers to quickly author production templates directly from partner workbooks without memorizing schema mappings.

---

## 7. File Structure Documentation

Below is a detailed breakdown of the files used in the platform:

### Frontend Components (`src/components/`)
*   **`InputBox.tsx`**: Manages user text input, file attachment triggers, and form submission for chat interactions.
*   **`AiStatusIndicator.tsx`**: Renders the step-by-step trace log of the LangGraph execution process, showing node status.
*   **`ChatWindow.tsx`**: The main interface for the chat feed and notepad editor, orchestrating the dual-panel layout.
*   **`ChatMessageItem.tsx`**: Responsible for rendering individual message bubbles in the chat thread, including text and file links.
*   **`Upload.tsx`**: Handles drag-and-drop or manual selection for Excel workbooks and template files.
*   **`DownloadButton.tsx`**: Triggers the download of generated INI configurations to the user's local machine.
*   **`TemplateManagerPage.tsx`**: Provides an IDE-like interface for managing template files, exploring worksheet schema keys, and performing drag-and-drop mapping.
*   **`OneDriveModal.tsx`**: Manages the interface for selecting or uploading templates stored on OneDrive.
*   **`Sidebar.tsx`**: Global navigation component for switching between workspace views.
*   **`NotepadViewer.tsx`**: The editor for viewing, editing, and validating generated INI files with split-screen functionality.

### Frontend State (`src/store/`)
*   **`chatStore.ts`**: Manages the global React state for active chat sessions, user input, and LangGraph trace logs.
*   **`mappingStore.ts`**: Handles the state of drag-and-drop mappings between worksheet keys and template variables.

### Backend Services (`server/services/`)
*   **`llm_service.ts`**: The core AI service layer managing calls to LLM models for intent analysis, knowledge extraction, and configuration generation.
*   **`validator_service.ts`**: Executes automated sanity checks on generated configurations to ensure syntax compliance and parameter resolution.
*   **`onedrive_service.ts`**: Interfaces with OneDrive APIs to list, upload, read, and manage template file storage.
*   **`excel_service.ts`**: Uses `exceljs` to parse, standardize, and extract structured data from uploaded Excel workbooks.

### AI Prompts (`server/prompts/`)
*   **`system_prompt.ts`**: Defines the fundamental behavior, persona, and operational constraints for the AI agent.
*   **`analyzer_prompt.ts`**: Contains instructions for analyzing raw JSON extracted from worksheets to build the knowledge context.
*   **`generator_prompt.ts`**: Directs the LLM on how to map extracted knowledge into INI templates while preserving formatting.
*   **`instructions.ts`**: Centralized repository of technical rules, best practices, and project heuristics for the AI.
*   **`chat_prompt.ts`**: Governs conversational capabilities and response formatting for the chat assistant.

### Orchestration Engine (`server/graph/`)
*   **`graph.ts`**: The LangGraph engine defining the state machine, node progression, and branching logic for orchestration.
*   **`state.ts`**: Specifies the TypeScript interface (`LangGraphState`) for the shared data structure maintained across nodes.

### Configuration & Root Files
*   **`server.ts`**: The main Express backend entry point managing API routes, middleware, and Dev/Prod environment configuration.
*   **`index.html`**: The root HTML file serving the React single-page application.
*   **`package.json`**: Manages dependencies, scripts, and build configuration for the application.
*   **`vite.config.ts`**: Configures the Vite build system, including Tailwind CSS integration and path aliasing.
*   **`metadata.json`**: Stores core application configuration like name, description, and permissions.
*   **`knowledge-base.md`**: The central repository of rules and context for template configurations.
*   **`excel_templates/extracted_context.json`**: Stores the parsed JSON data extracted from the most recent Excel workbook upload.
