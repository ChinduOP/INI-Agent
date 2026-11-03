export const INSTRUCTIONS = `Generation Rules
- Never remove existing sections (unless explicitly instructed to delete or remove by a condition/directive).
- REMOVE ALL COMMENTS WITH "#...": Delete all lines containing "#..." comments or starting with "#". Never include "#" comment lines in the final INI.
- SECTION REMOVAL & EMPTY LINE CLEANUP: When a section is removed or deleted, remove empty lines below and above so that ONLY ONE empty line remains between sections, except for Document-sheet outputs in Profiles/Documents, where intentional blank lines from the selected template must be preserved.
- STRICT SINGLE EMPTY LINE: For all INIs except Document-sheet outputs in Profiles/Documents, strictly maintain at most ONE empty line between sections. Preserve intentional template blank lines in those Document-sheet outputs.
- Never reorder sections.
- Never reorder keys.
- No spaces before or after the equal sign (=). Format strictly as Key=Value
- Preserve indentation.
- Preserve formatting.
- Preserve capitalization.
- Preserve spacing.
- For inbound Document-sheet INIs generated under Profiles/Documents, preserve intentional blank lines from the selected template. For outbound Document-sheet INIs, remove blank lines between key/value fields and keep exactly one blank line above every [Configuration.*] section header.
- Never invent values.
- Unknown values should become "I am not sure the value with the available data".
- Follow filename conventions.
- Match template formatting exactly.

System Instructions (Applies to all INI types):
- COMMENT DELETION MANDATE: Remove comments in INIs with "#...". Delete all lines that begin with "#" or contain "#..." comments. If a key=value line has an inline comment starting with "#", strip the "#..." comment from the line. Never output "#" comments in any generated INI file.
- SECTION REMOVAL EMPTY LINE CLEANUP: When a section is removed or omitted (e.g. conditional section delete or not applicable), remove extra empty lines below and above the removed section. ONLY keep ONE empty line separating the remaining sections, except for Document-sheet outputs in Profiles/Documents, where intentional blank lines from the selected template must be preserved.
- ONLY ONE EMPTY LINE: For all INIs except Document-sheet outputs in Profiles/Documents, ensure at most ONE empty line between sections. Do not include leading empty lines at the top of the file or multiple empty lines at the end.
- If the value after the equal sign in the template is written in double quotes, it should be hardcoded exactly as is, but WITHOUT the double quotes in the final output.
- If the value after the equal sign is written inbetween {} curly brackets, replace it with the extracted context key name from the json.
- Evaluate inline IF/THEN/ELSE directives against the current row. Treat "IN" and "Inbound" as inbound, and "OUT" and "Outbound" as outbound. After selecting a branch, resolve every {Key} in that branch from the current row before removing the directive comment.
- For EDI direction flags, {EDI_Direction_In} is true only for inbound rows and {EDI_Direction_Out} is true only for outbound rows; process conditions such as "if {EDI_Direction_In} then ... else ..." and "if {EDI_Direction_Out} then ... else ..." accordingly.
- If a line has a comment starting with // (e.g., "//remove line if it is null/blank"), and the extracted context value is null or blank, then DELETE that line from the output entirely.
- Resolve every brace-delimited placeholder in a selected conditional output branch (for example, if {Document_Report} is {default} then print "XtraReport.{Document_Document}" else print "XtraReport.{Document_Report}") using the current row's JSON values. Treat {default} as the row field being blank, null, or set to "default".
- If a line has a comment with a specific natural language instruction (e.g., "// Extract Capital letter word", "// split by hyphen"), you MUST execute that instruction on the value mentally and output ONLY the final transformed value, removing the comment.
- If an inline comment says to remove leading zeros from a placeholder, remove leading zeros from that placeholder's numeric value before substitution (for example, {EDI_X12Group_Version} value 004030 becomes 4030); preserve any other text in the value, such as the X12_ syntax prefix.
- If a line has a formula condition enclosed in /* */ (e.g. /* If packingClassification is IN then Yes else No */), process the condition. 
- A line may have both // and /* */ comments - consider both to generate the final value.
- Make sure to get and tag exact values from the extracted context which are defined in the ini file (e.g. for packingClassification tag exact EDI_Classification value from json).
- If DocLookup(key) is provided, lookup the exact key in the extracted context of that document type and substitute it.
- In future if any condition added, agent should understand and work. Update the file accordingly based on instructions.

DCP XML Rules (TP.PACK-ISO\config\application\DCP)
- DCP XML folder path: "TP.PACK-ISO\config\application\DCP".
- Generate XML files using the same extracted data and mappings from the corresponding transaction data / Excel records.
- Filename Rules:
  i. If user uploaded an Excel sheet:
     - Get the filename from the key "Document_ValidationFile" (or "Document_Validation File").
     - Append "DCP." at the starting and ".xml" at the ending: format is "DCP.{Document_ValidationFile}.xml".
     - IMPORTANT - Select the exact template file based on the "Document_ValidationFile" data (e.g. if the validation file data has "INV.", select "INV.xml"; if it has "ASN.", select "ASN.xml").
     - If there are multiple matching entries (e.g., two ASN entries in "Document_ValidationFile"), generate separate XML files for each entry (e.g. two separate ASN files).
  ii. If user has not uploaded a file and just asked to generate:
     - The output filename MUST be the actual filename from the folder (e.g. "INV.xml" or the original template filename).
- COMMENT & EMPTY LINE REMOVAL MANDATE:
  - Remove all XML comments (&lt;!-- ... --&gt;), multi-line comments, inline comments, and comment declarations completely.
  - After removing comments, remove all empty lines as well. The final XML output must have NO comments and NO blank/empty lines.
- Preserve XML tags, structure, and attribute formatting while populating values from data.
- Download Path: "TP.PACK-ISO\config\application\DCP"

Conditional Block Section Rules:
- Treat text inside /* ... */ that wraps one or more INI sections as a section-level directive. For an unconditional instruction such as /*Dont print this section, omit the entire enclosed section(s), including their keys. Do not output the block-comment markers or suppressed content.
- Treat "Print this section only if {Field} = \"Value\"" as a conditional: include the whole section only when the extracted field matches Value, otherwise omit the whole section. Compare case-insensitively and treat the document label "ASN" as equivalent to "ASNs".
- If a section or multiple keys are wrapped in a block comment with a condition, like:
  /* //If {Field} is "Value" then print this section else delete this section
  [SectionName]
  Key=Value
  */
  Evaluate the condition using the extracted context. If the condition is met, print the inner block (e.g., [SectionName] and its keys) without the starting "/* //If ..." and ending "*/" comment tags. If the condition is not met, delete the entire block section completely from the output.
- When a conditional section is deleted or omitted, remove empty lines below and above so that ONLY ONE empty line separates the surrounding sections. Never leave multiple consecutive empty lines.
- For a key such as Modules=//list of all {Module_Key} for DCPReport items, output a comma-separated list of every distinct nonblank Module_Key in the Modules sheet's ModuleType.DCPReport list in extractedJson. If that list is unavailable, use only rows classified as DCPReport in the parsed Modules worksheet. Never include keys from other module types.

Hardcoded Text Double Quotes Rules:
- If any text is written inside double quotes (e.g. "Partner" or "Live"), consider it to be hardcoded. Only print the text itself, NOT the surrounding double quotes in the final output.

Custom Variable Resolution Rules:
- If a line has a custom variable and a comment instruction like:
  EDIAddress="Partner".{Var_EdiLiveAddress}."Live"  //Split "{EDI_Address(Live[Test])}" by ".". Ignore "Live" and "Test". Extract the uppercase application name and print it in "{Var_EdiLiveAddress}".
  Split the source field value (e.g. "MUTUAL.Live/MUTUAL.Test") by the specified delimiter. Select the first all-uppercase word that is not "Partner", "Live", "Test", "Prod", "QA", or "UAT". If the source has no delimiter, select an all-uppercase word from the source instead. Do not concatenate other words, substitute the trading partner as a fallback, or use the instruction text as source data.
  The final output MUST be a single line formatted as "EDIAddress=Partner.MUTUAL.Live" (where Partner and Live are hardcoded values, without double quotes and without any duplicate lines below it).
- DLL=Module.Maps.Partners.{var_TPName}.{var_initial}.dll //Get the first letter from the {Module_Key} and print it in var_initial.
  - Resolve {var_initial} from the first character of the current module row's nonblank Module_Key. Use Module_Name only when Module_Key is missing or blank. Ignore stale var_initial aliases and placeholder values such as N/A; never use the trading partner key as a substitute.
  - Substitute the resulting character into every {var_initial} placeholder (e.g. "D" if Module_Key is "DMART-US").
  - Get the trading partner name from {Module_Key} or {Module_Name} or context, remove all spaces and special characters, and substitute it into {var_TPName} (e.g. "DMARTUS" or "TraderJoes").
- Class=OpenText.Freeway.Modules.Maps.Partners.{var_TPName}.{Module_Namespace}.V1.Parser //From the {Module_Name} get the partner name and print it in {var_TPName} position without any spaces & special characters.
  - Extract the trading partner name from {Module_Name} or {Module_Key}, remove all spaces and special characters, and substitute it into {var_TPName}.
  - Output ONLY the final line with resolved variables, removing all comment instructions.

Validation INI File Rules - {mnemonic}.{activation key}.ini
- In the extracted context, there is key "Document_Validation File" in json format for each document type.
- In the following multiple entries consider only unique values. For one document type they may have more than one with unique names.
- For those unique Document_Validation File, create validation ini files.
- Generate validation ini files for all the unique document_validation files.
- Download Path: "TP.PACK-ISO\Validations"

Strict Inbound/Outbound Template Selection Rules
- The agent must strictly identify whether the transaction is Inbound (Parser) or Outbound (Creator) before generating any INI.
- Inbound = Parser
- Outbound = Creator
- For Inbound / Parser INI generation, use only the "in..." template files.
- For Outbound / Creator INI generation, use only the "out..." template files.
- Never use an "in..." template to generate an Outbound / Creator INI.
- Never use an "out..." template to generate an Inbound / Parser INI.
- Always follow the template filename and the instructions provided for that transaction type.
- Before generating an INI, verify: Transaction direction (Inbound or Outbound), Terminology (Parser or Creator), Correct template filename, and Whether the template starts with "in." or "out.".
- If there is any conflict or ambiguity, do not guess. Follow the explicit instructions and template naming convention.

Modules INI Rules (TP.PACK-ISO\Modules)
- There are multiple subfolders in Modules, each mapping to a specific type of Module: EDIBatchParsers, EDIBatchCreators, DCPReports, etc.
- 1. EDIBatchParsers (TP.PACK-ISO\Modules\EDIBatchParsers): 
     - The template filename is typically "parser.{document group}.{syntax}.{version}.ini".
     - It should ONLY be used for parsers (Inbound).
     - Generate a separate INI file for each item. 
     - The output filename MUST exactly match the value of the "Module_Filename" key from the extracted context / Excel sheet for that item.
     - Generate as many separate INI files as there are items in the EDIBatchParsers module type.
     - Download Path: "TP.PACK-ISO\Modules\EdiBatchParsers"
- 2. EDIBatchCreators (TP.PACK-ISO\Modules\EDIBatchCreators): 
     - The template filename is typically "creator.{document group}.{syntax}.{version}.ini".
     - It should ONLY be used for creators (Outbound).
     - Generate a separate INI file for each item.
     - The output filename MUST exactly match the value of the "Module_Filename" key from the extracted context / Excel sheet for that item.
     - Generate as many separate INI files as there are items in the EDIBatchCreators module type.
     - Download Path: "TP.PACK-ISO\Modules\EdiBatchCreators"
- 3. DCP Reports (TP.PACK-ISO\Modules\DCPReports): 
     - The template filename is typically "{Name}.ini".
     - It should ONLY be used for DCP reports.
     - Generate a separate INI file for each item.
     - The output filename MUST exactly match the value of the "Module_Filename" key from the extracted context / Excel sheet for that item.
     - Generate as many separate INI files as there are items in the DCPReports module type.
     - Download Path: "TP.PACK-ISO\Modules\DCPReports"
- 4. Document Reconciliation (TP.PACK-ISO\Modules\DocumentReconciliation): 
     - The template filename is typically "DocumentReconciliation.ini" or "{document group}.{syntax}.{version}.ini".
     - In the extracted JSON, there is a "DocumentReconciliation" section containing items with key-value pairs.
     - Generate Document Reconciliation INI templates ONLY for items listed in the "DocumentReconciliation" section from the extracted JSON when a Document Reconciliation template is selected.
     - Inside the "DocumentReconciliation" section of the JSON, each item contains keys and values. In the INI template, replace/populate all corresponding keys with their exact values from the DocumentReconciliation item in the JSON.
     - The output filename MUST exactly match the value of the "Module_Filename" key from the extracted context / Excel sheet for that item.
     - Download Path: "TP.PACK-ISO\Modules\DocumentReconciliation"


EDI Batch Profile INI Rules
- Filename - in.{document group}.{syntax}.ini [For Inbounds]
- Filename - out.{document group}.{syntax}.ini [For Outbounds]
- The "in.{document group}.{syntax}.ini" template is only used for Direction "IN" message types (e.g., 850, 860, 830...).
- The "out.{document group}.{syntax}.ini" template is only used for Direction "OUT" message types (e.g., 855, 810, 856...).
- If the user selects only one (either in or out), generate INIs ONLY for that specific direction's message types.
- If the user selects the entire folder, consider both IN & OUT (generate /in files for all inbound message types, /out for all outbound message types).
- In the extracted context, the json format has all keys for each document type.
- For the EDI sheet, map X12 Details using the nested headers: Interchange > Version to EDI_X12Interchange_Version; Interchange > Std id (or Rep Char) to EDI_X12Interchange_RepChar; Group > Code to EDI_X12Group_Code; Group > Agency to EDI_X12Group_Agency; Group > Version to EDI_X12Group_Version; Message > Code to EDI_X12Message_Code. Preserve values from Excel for both IN and OUT directions; do not clear them based on direction.
- The file name should be ALWAYS - EDI sheet - Filename column. Generate an ini for each document type based on the "EDI_Filename" column (Generate as many INI files as there are EDI_Filenames).
- Generate both EDI directions from the EDI sheet unless the request explicitly limits generation to one direction. Use the matching inbound/outbound EDIBatches template for each row, and keep every EDI-sheet INI in Profiles/EDIBatches. Never route EDI rows or their INIs to Profiles/Documents.
- Download Path: "TP.PACK-ISO\Profiles\EDIBatches"

Transform Set INI Rules (TP.PACK-ISO\TransformsSets)
- Generate one Transform Set INI for every item (EDI_Item) in the EDI sheet, including items in both IN and OUT directions unless the request explicitly limits the direction. Use that item's EDI data and matching Transform Set template; do not combine or omit EDI items.
- Save Transform Set INIs under "TP.PACK-ISO\TransformsSets"; do not route them to Profiles\EDIBatches or Profiles\Documents.
- When a selected template is under "TP.PACK-ISO\TransformsSets", keep the generated download path under "TP.PACK-ISO\TransformsSets" for every EDI item; never route it to "Profiles\EDIBatches".
- The output filename format is "{EDI_Filename}.{EDI_Syntax}.{version}.ini": use that item's EDI_Filename column as the filename base (without any existing ".ini" extension). Do NOT prepend the TP key or any trading-partner identifier. Use EDI_X12Group_Version for X12 and EDI_EANCOMMessage_Version for EDIFACT. Build the syntax/version suffix exactly once, replacing any existing syntax/version suffix in EDI_Filename to avoid duplicates or conflicting versions. For X12, remove leading zeroes from a numeric version (for example, "004010" becomes "4010"). Append ".ini" exactly once. The "EDI_Module/Transform Sets" column is separately extracted for template placeholder values and is not the output filename base.
- Extract the actual Transform Set cell value for every EDI_Item into "EDI_Module/Transform Sets"; never leave it blank if the Excel cell contains a value. Preserve row-specific values and do not invent a filename, syntax, or version when the source value is missing.

Document Profile INI Rules
- Location: "...\TP.PACK-ISO\Profiles\Documents" folder path.
- Filename Templates:
  * in.{DocType}[.{SubType}].ini [For Inbounds / direction_In]
  * out.{DocType}[.{SubType}].ini [For Outbounds / direction_Out]
- FOLDER ISOLATION: There are two Documents folders: "Profiles\Documents" (for Document Profile INIs) and "Validation\Documents" (for Validation INIs). These rules apply strictly to "Profiles\Documents" ONLY and MUST NOT impact or alter the rules or templates for "Validation\Documents".
- OUTPUT FILENAME MANDATE: The generated INI filename for Document Profile INIs in "Profiles\Documents" MUST ALWAYS be the exact value of "Document_Filename" extracted from the JSON / Excel sheet (appending ".ini" if it does not already end with ".ini").
- TEMPLATE SELECTION: In the "/profiles/Documents" folder, ALWAYS use the inbound template ("in.{DocType}[.{SubType}].ini") with "Inbound=Yes" for direction_In / Inbound items, and ALWAYS use the outbound template ("out.{DocType}[.{SubType}].ini") with "Inbound=No" for direction_Out / Outbound items.
- NUMBER OF GENERATED FILES: Generate as many Document Profile INI files as there are "Document_Item" entries in the extracted JSON / Excel sheet for both Inbound and Outbound directions (one file per Document_Item).
- STRICT SEPARATION WARNING: NEVER use EDI sheet columns or data for Document INIs. Document INIs MUST strictly and exclusively use columns and data from the "Document" sheet. Similarly, EDI Batch INIs MUST strictly and exclusively use columns and data from the "EDI" sheet. Although columns may share similar names (e.g. Classification, Subtype, Keys), their data contents are entirely different and must never be mixed.
- Keep Document-sheet INIs in Profiles/Documents only. Never route Document rows or their INIs to Profiles/EDIBatches.
- KEY MAPPING GUIDELINES: Map all document keys defined in the INI templates:
  * "{Document_EDIProfile}" (or "{Document-EDIProfile}", "{Document_ProfileLookup}", "{EDIProfileKey}") maps directly to "EDIProfileKey" in the INI.
  * Map all other keys ("{Document_Key}", "{Document_Channel}", "{Document_Document}", "{Document_Function}", "{Document_Subtype}", "{Document_Classification}", "{Document_Workflow}", "{Document_FilenameSuffix}", "{Document_DisplayText}", "{Document_Hide}", "{Document_XrefLevel}") to their extracted Document values.
- INLINE COMMANDS & BLANK LINE DELETION: Evaluate inline comment directives such as "//delete line if it is blank". If the mapped value for a key is blank or empty, the entire line MUST be deleted from the generated INI. For populated keys, inline comment directives must be stripped from the final output.
- If an optional field's comment explicitly says the value falls back to another setting or defaults when blank, keep the field as an empty assignment (Key=) when no override value is provided; remove its comments but do not delete the key.
- DOCUMENT SECTION CONDITIONS: Evaluate each /* ... */ section/field condition against the current Document row. For contains, test for a case-insensitive substring; for multiple conditions joined by or, include the block when any condition matches. Only include conditional block content when its stated condition matches; do not print it for other document types or profiles.
- For example, include a block conditioned on {Document_EDIProfile} contains ".Orders.Changes" only when that current row's EDI profile contains .Orders.Changes. For {Document_Document} = "ASN" or {Document_Document} = "PackingList", include the block only for ASN or PackingList rows.
- Download Path: "TP.PACK-ISO\Profiles\Documents"

DCP INI Rules (TP.PACK-ISO\DCP)
- Folder path: "TP.PACK-ISO\DCP"
- Template filename pattern: "Document.{document type}.ini" (e.g. Document.Order.ini, Document.ASN.ini, Document.{document type}.ini, etc.)
- OUTPUT FILENAME FORMAT MAPPING:
  Generate DCP INIs using the following exact filename convention for each document type:
  1. For Order: "Document.1.Order.ini"
  2. For OrderResponse: "Document.2.OrderResponse.ini"
  3. For PackingList: "Document.3.PackingList.ini"
  4. For ASN: "Document.4.ASN.ini"
  5. For Invoice: "Document.5.Invoice.ini"
  6. For CreditNote: "Document.6.CreditNote.ini"
- INLINE COMMANDS & DOCUMENT TYPE MESSAGE FILTERING:
  - In the DCP INI template, lines may contain inline comments/directives specifying target message document applicability (e.g., "// only for Order", "// print for Order, OrderResponse", "// only for Invoice", "// for PackingList", etc.).
  - Also evaluate other inline // conditions against the current row. A directive such as "if {Document_Document} = \"ASN\" then print \"Yes\" else \"No\"" selects the key's value; directives such as "print this line only when {Document_Document} = \"ASN\"" or "delete line if {Document_Document} = \"ASN\"" control whether the whole line is included.
  - When generating the DCP INI for a specific document type (e.g. Order / "Document.1.Order.ini"):
    * Evaluate each line's inline comment directive.
    * Print lines ONLY if they match the current document type (or if no restriction is specified).
    * Discard/remove lines completely if they are restricted to other non-matching document types.
    * For retained lines, strip out the inline directive comment marker so that only clean INI configuration remains in the final output.
- CONDITIONAL SECTIONS:
  - Evaluate every /* ... */ block as a directive, not as output text. Include its body only when the condition in the opening comment matches the current DCP document row/type; otherwise remove the entire block.
  - Conditions may use {Document_Document} = "ASN" / "or" comparisons, "contains", and "and"/"or" combinations. They may also describe the field in prose (for example, the exact data value for template placeholder "Document_Document" ... = "ASN"); resolve that placeholder to the current document row before evaluating.
  - Resolve conditions and placeholders independently for each generated document type. Do not reuse the first document row when it belongs to a different type. Remove directive comments and block markers from the final INI.
- INLINE IGNORE COMMANDS & TEXT PLACEHOLDERS:
  - If a template line contains an inline comment directive instructing to ignore a placeholder (e.g., "//ignore {DocumentType}", "// ignore {DocumentType}", "; ignore DocumentType"):
    * Treat the placeholder (e.g., "{DocumentType}") as LITERAL TEXT.
    * DO NOT perform agent value extraction for that placeholder, and DO NOT replace it with description/instruction strings.
    * Keep the placeholder intact as literal text in the line.
    * Strip the inline comment directive marker during final comment cleanup.
- STRICT COMMENT & SPACING FORMATTING RULES:
  * Remove ALL comment lines starting with ";", "#", or "//".
  * Strip all inline comments outside quotes.
  * No blank or empty lines between key=value assignments within sections.
  * Exactly ONE blank line above each section header "[...]" (zero blank lines at the top of the file before the first section header).
- Download Path: "TP.PACK-ISO\DCP"

Validation XML Rules (TP.PACK-ISO\config\validation)
- Folder path: "TP.PACK-ISO\config\validation"
- EXCEL IS OPTIONAL: Uploading an Excel file is OPTIONAL for Validation XML generation. If no Excel sheet is attached, generate the Validation XML file(s) for the user-selected XML template(s) directly using its original filename and custom field selections.
- Validation XML template files follow naming conventions such as "Validation.{DocType}.{Version}.xml" (e.g. Validation.ASN.EDIFACT_D07A.xml).
- 3-LETTER DOCUMENT TYPE MATCHING & EXCEL MULTI-FILE GENERATION:
  - Validation XML templates contain 3-letter document keywords in between dots or in filenames (e.g., RSP, INV, PAK, ASN, STK, CRN, PRI, RRQ, SLS, WHI, etc.).
  - When an Excel file IS uploaded, extract all unique "Document_ValidationFile" values across all document items in the JSON / Excel data.
  - Match each selected template's 3-letter document keyword (e.g. ASN) against the unique "Document_ValidationFile" filenames from the Excel data.
  - For each selected Validation XML template, generate a separate Validation XML file for EVERY unique matching "Document_ValidationFile" filename found in the Excel data (e.g. if Document_ValidationFile contains two unique ASN filenames like "Validation.ASN.EDIFACT_D07A.xml" and "Validation.ASN.EDIFACT_D97A.xml", generate two ASN Validation XML files).
  - If NO Excel file is uploaded, generate the Validation XML file for each user-selected template directly using its original template filename.
- CUSTOM FIELD SELECTION MANDATE:
  - Users can select custom sections, headers, fields, and subfields in the Template Manager form popup before generation.
  - If custom fields are selected for a Validation XML, include ONLY those selected sections/headers and fields/subfields in the generated XML output, removing all unselected fields/sections.
  - If no custom fields are selected, include all default sections and fields from the XML template.
- COMMENT & BLANK LINE REMOVAL MANDATE:
  - Always remove ALL XML comments (<!-- ... -->), multi-line comments, inline comments, and comment declarations completely from the generated Validation XML output.
  - Remove all blank/empty lines resulting from comment removal or field filtering.
- Download Path: "TP.PACK-ISO\config\validation"

Validation Rules
- Required values cannot be empty.
- No duplicate sections.
- No duplicate keys.
- No invalid formatting.
- All Excel references should be correctly mapped.
- Validate final output before returning.

Output Format
Return:
- Generated Filename
- Validation Summary
- Final content in the selected template's file format. For a selected ".sql" template, preserve the ".sql" extension and SQL content; do not rename it to ".ini".
`;
