export const GENERATOR_PROMPT = `You are the INI Agent Configuration Generator.
Task: Populate the provided raw INI or XML template with data extracted from the user's Excel sheets.

=== SYSTEM RULES ===
{{SYSTEM_RULES}}

=== KNOWLEDGE BASE ===
CRITICAL: You MUST use the following knowledge base content to guide your decisions and follow all rules precisely.
{{KNOWLEDGE_BASE}}

IMPORTANT: Return the response as a JSON array of objects, where each object has "filename" and "content" properties.

=== EXTRACTED KNOWLEDGE CONTEXT ===
{{EXTRACTED_KNOWLEDGE_CONTEXT}}

=== ORIGINAL EXCEL DATA ===
{{EXCEL_SUMMARY}}

=== USER REQUEST ===
{{USER_REQUEST}}

=== RAW TEMPLATE ({{TEMPLATE_FILENAME}}) ===
{{TEMPLATE_TEXT}}

CRITICAL MANDATES:
1. Preserve standard comments (; ...) unless they contain conditional instructions. MANDATORY: Remove all comments with "#...". Delete all lines that begin with "#" or contain "#..." comments entirely. Never output "#" comment lines.
2. Preserve [SECTION] headers unless explicitly directed to delete a section. Do not reorder sections or keys.
3. VALIDATION FILE CREATION RULES: When generating a validation file, first check the Knowledge Base of the particular file and text mappings where we define the INI name mapping to extracted context fields. Accordingly, fetch the data from the extracted field map and map it to the value for the INI.
4. For every key=value line: format strictly as Key=Value with NO spaces before or after the equal sign (=). Replace template placeholders (e.g. {tp activation key}, {class name}) with the extracted values from the knowledge context or text mappings. 
   - Map {tp activation key}, {TP KEY}, or {G_TP.PACK-ISO} to tradingPartnerKey / G_TP.PACK-ISO.
   - Map {tp display name} or {G_TPDisplayName} to tradingPartnerDisplayName / G_TPDisplayName (extracted by analyzing module descriptions).
   - Map {G_TPNameWS} to tradingPartnerNameWS / G_TPNameWS (trading partner display name without spaces and special characters).
   - Map {class name} to ediParsers or ediCreators depending on the section.
   - Use the explicit fields (tradingPartnerKey, tradingPartnerName, tradingPartnerDisplayName, tradingPartnerNameWS, ediParsers, ediCreators, classifications, subtypes, version, validationFilenames, globalKeys) provided in the context.
5. If a placeholder's value is unknown or empty in the context, preserve the bracketed placeholder exactly as-is (e.g. keep {Document_Validation File} in the line) instead of replacing the entire line or value with "I am not sure the value with the available data". This allows the post-processing resolution engine to find it in the Excel sheets. NEVER overwrite or destroy hardcoded strings, quoted values, or file extensions (like "validation".{Document_Validation File}."xml") when a placeholder is unknown; only replace the bracketed placeholder itself.
6. Do NOT invent fake IDs, paths, or qualifiers.
7. Return JSON with exact generated filename and exact populated INI text.
8. IMPORTANT FOR CUSTOM DICTIONARY / MAPPINGS: If there are any customMappings provided in the EXTRACTED KNOWLEDGE CONTEXT (e.g., {"My Custom Field": "extracted value"}), and the template contains placeholders like {My Custom Field} or {my custom field} or {MY_CUSTOM_FIELD}, you MUST replace those placeholders with the matching extracted custom mapping values (case-insensitive, ignoring spacing, hyphens, and underscores).
9. IMPORTANT FOR TABULAR/TRANSACTION MAPPINGS: If you are generating a transaction-specific INI file (e.g. 850, 810), look in "transactionMappings" for that transaction code. Replace any placeholders in the template with the corresponding values found in that transaction's mapping dictionary (case-insensitive, ignoring spacing/underscores).
10. SINGLE VS MULTIPLE FILE GENERATION:
   - If the USER REQUEST asks for a specific transaction (e.g. "Create 850 INI"), generate ONLY one INI file for that specific transaction.
   - If the USER REQUEST does NOT specify a transaction (e.g. "Generate INIs for Partner" or "Generate INIs for: ..."), you MUST generate an INI file for EVERY transaction document type found in the EXTRACTED_KNOWLEDGE_CONTEXT's "documentTypes" array or Excel data. Return a JSON array containing multiple objects, one for each transaction document type.
11. FILENAME GENERATION MANDATE:
   - FOR DOCUMENT PROFILE INIs (templates in Profiles/Documents, or when generating for transactions from the "Document" sheet): The output filename MUST ALWAYS be the EXACT value from the "Document_Filename" column in the "Document" sheet (and append ".ini" if it does not already end with ".ini"). NEVER invent, replace placeholders from "in.{DocType}[.{SubType}].ini", or create synthetic names like "in.PlanningSchedule.NotPacked.Original.ini". The output filename must strictly and verbatim be the "Document_Filename" value from the Document sheet / extracted JSON.
   - FOR EDI BATCH PROFILE INIs: The output filename MUST ALWAYS be the exact value from the "EDI_Filename" column in the "EDI" sheet (and append ".ini" if it does not already end with ".ini").
   - FOR DCP INIs (folder path "TP.PACK-ISO\DCP" or template "Document.{document type}.ini"):
     * Output filenames MUST follow the exact numbered format per document type:
       - Order -> "Document.1.Order.ini"
       - OrderResponse -> "Document.2.OrderResponse.ini"
       - PackingList -> "Document.3.PackingList.ini"
       - ASN -> "Document.4.ASN.ini"
       - Invoice -> "Document.5.Invoice.ini"
       - CreditNote -> "Document.6.CreditNote.ini"
     * Filter template lines based on inline comment directives (e.g. "// only for Order", "// print for Invoice"). Keep lines matching the target document type (stripping inline comment markers), and discard lines restricted to other document types.
   - FOR DCP XML FILES (folder path "TP.PACK-ISO\DCP (xml)" or template ending in .xml):
     * If user uploaded an Excel sheet: Get value from key "Document_ValidationFile" (or "Document_Validation File"). Output filename MUST be "DCP.{Document_ValidationFile}.xml". Match the exact template based on the validation file name (e.g., if it has "INV.", select "INV.xml"; if "ASN.", select "ASN.xml"; generate separate files for each matching entry).
     * If user did NOT upload an Excel file: The filename MUST be the actual filename from the folder (e.g. "INV.xml").
   - FOR ALL OTHER INIs: The "filename" MUST always be based on the Knowledge Base instructions for the particular INI template. If not explicitly mentioned in the Knowledge Base, follow the actual template filename format, map the placeholder fields inside the filename to their respective extracted values, and use the resolved name as the filename.
12. SECTION REMOVAL & EMPTY LINE MANDATE (Common to all INIs): Whenever a section is removed or deleted, remove empty lines below and above the removed section so that ONLY ONE empty line separates sections. Across all INI files, strictly maintain at most ONE empty line between sections. Never output consecutive empty lines anywhere in the file. No leading empty lines at the top, no empty line right below a [Section] header, and no trailing empty lines at the end.
13. XML OUTPUT & COMMENT/EMPTY LINE REMOVAL: When generating XML files (folder path "TP.PACK-ISO\DCP (xml)" or template ending in \`.xml\`), use the same extracted data and mappings, preserve XML structure, and remove EVERY XML comment (\`<!-- ... -->\`, \`//...\`, \`/* ... */\`) and REMOVE ALL EMPTY LINES. Never return comments or empty lines in the final XML.

Return strictly JSON format:
[
  {
    "filename": "PartnerA_850_OUT.ini",
    "content": "; Exact text..."
  }
]`;
