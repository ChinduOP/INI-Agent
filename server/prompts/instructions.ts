export const INSTRUCTIONS = `Generation Rules
- Never remove existing sections.
- Never remove comments.
- Never reorder sections.
- Never reorder keys.
- Preserve blank lines.
- Preserve indentation.
- Preserve formatting.
- Preserve capitalization.
- Preserve spacing.
- Never invent values.
- Unknown values should become "I am not sure the value with the available data".
- Follow filename conventions.
- Match template formatting exactly.

Validation INI File Rules - {mnemonic}.{activation key}.ini
- In the extracted context, there is key "Document_Validation File" in json format for each document type.
- In the following multiple entries consider only unique values. For one document type they may have more than one with unique names.
- For those unique Document_Validation File, create validation ini files.
- If the value after the equal sign in the template is written in double quotes, it should be hardcoded exactly as is, but WITHOUT the double quotes in the final output.
- If the value after the equal sign is written inbetween {} curly brackets, replace it with the extracted context key name from the json.
- Generate validation ini files for all the unique document_validation files.

EDI Batch Profile INI Rules
- Filename - in.{document group}.{syntax}.ini [For Inbounds]
- Filename - out.{document group}.{syntax}.ini [For Outbounds]
- The "in.{document group}.{syntax}.ini" template is only used for Direction "IN" message types (e.g., 850, 860, 830...).
- The "out.{document group}.{syntax}.ini" template is only used for Direction "OUT" message types (e.g., 855, 810, 856...).
- If the user selects only one (either in or out), generate INIs ONLY for that specific direction's message types.
- If the user selects the entire folder, consider both IN & OUT (generate /in files for all inbound message types, /out for all outbound message types).
- In the extracted context, the json format has all keys for each document type.
- For the EDI sheet: Group is in Column D, Subgroup in Column E, Subtype in Column F, and Classification in Column G. The interchange details (EDI_Interchange_Version in Column Q, EDI_Interchange_RepChar in Column R, EDI_Group_Code in Column S, EDI_Group_Agency in Column T, EDI_Group_Version in Column U, and EDI_Message_Code in Column V) are ONLY populated for Outbound (OUT) transactions. For Inbound (IN) transactions, these interchange fields must always be null/empty.
- The file name should be ALWAYS - EDI sheet - Filename column. Generate an ini for each document type based on the "EDI_Filename" column (Generate as many INI files as there are EDI_Filenames).
- In the EDI batch profile ini, if the value after the equal sign is written in double quotes (""), hardcode it in the final output WITHOUT the double quotes.
- If the value is written inbetween {} curly brackets, replace it with the exact extracted context key name from the json.
- If a line has a comment starting with // (e.g., "//remove line if it is null/blank"), and the extracted context value is null or blank, then DELETE that line from the output entirely.
- If a line has a comment with a specific natural language instruction (e.g., "// Extract Capital letter word", "// split by hyphen"), you MUST execute that instruction on the value mentally and output ONLY the final transformed value, removing the comment.
- If a line has a formula condition enclosed in /* */ (e.g. /* If packingClassification is IN then Yes else No */), process the condition. 
- A line may have both // and /* */ comments - consider both to generate the final value.
- Make sure to get and tag exact values from the extracted context which are defined in the ini file (e.g. for packingClassification tag exact EDI_Classification value from json).
- If DocLookup(key) is provided, lookup the exact key in the extracted context of that document type and substitute it.

Document INI Rules
- Location: "...\TP.PACK-ISO\Profiles\Documents" folder path.
- Filename templates: "in.{DocType}[.{SubType}].ini" and "out.{DocType}[.{SubType}].ini".
- STRICT SEPARATION WARNING: NEVER use EDI sheet columns or data for Document INIs. Document INIs MUST strictly and exclusively use columns and data from the "Document" sheet. Similarly, EDI Batch INIs MUST strictly and exclusively use columns and data from the "EDI" sheet. Although columns may share similar names (e.g. Classification, Subtype, Keys), their data contents are entirely different and must never be mixed.
- In this "in.{DocType}[.{SubType}].ini", it is only used for Direction "IN" message types (e.g., 850, 860, 830...).
- In this "out.{DocType}[.{SubType}].ini", it is only used for Direction "OUT" message types (e.g., 855, 810, 856...).
- If the user selects only one (either in or out), then ONLY generate INI for that particular direction's message types (e.g., if the user selects "in.{DocType}[.{SubType}].ini" from the template manager, get the list of inbound / "IN" direction message types from the attached Excel sheet, and create INIs only for those transactions. Similarly for outbounds).
- In a simpler way: in the "Document" sheet under the "Document_Filename" column, the INI needs to be generated only for those filenames. For the "IN" direction, those files with filenames in the "Document_Filename" column need to be generated; similarly for the "OUT" direction, those files with filenames in the "Document_Filename" column in the "Document" sheet need to be generated.
- The output filename should ALWAYS be the exact value from the "Document_Filename" column in the "Document" sheet (and append ".ini" if it does not already end with ".ini").
- In the Document sheet, the column names are always present in the 2nd row (index 1 / row 2).
- From the extracted context JSON, tag required keys to the document INIs. Make sure to populate correct values based on the keys tagged for each message type.
- Key mapping guidelines:
  1. "{TP.PACK-ISO}" or "{TP_PACK_ISO}" placeholder refers to the Trading Partner Key (e.g., "TRADER.JOES-US" or "PARTNERB_KEY") from the Excel worksheets.
  2. "{Document_Direction_In}" or "{Document_Direction_Out}" placeholder refers to the Document / transaction name (e.g., "PlanningSchedule", "Order", "OrderResponse"), which is the value of the "Document_Document" column from the Document worksheet.
  3. All other placeholders like "{Document_Classification}", "{Document_ProfileLookup}", "{Document_Channel}", etc., map directly to their corresponding prefixed or non-prefixed columns in the matching Document sheet row.
- Follow the same value resolution, hardcoded text, custom variable resolution, conditional block section, and comment instructions rules as defined for the other INI types to populate the correct values.

Conditional Block Section Rules:
- If a section or multiple keys are wrapped in a block comment with a condition, like:
  /* //If {Field} is "Value" then print this section else delete this section
  [SectionName]
  Key=Value
  */
  Evaluate the condition using the extracted context. If the condition is met, print the inner block (e.g., [SectionName] and its keys) without the starting "/* //If ..." and ending "*/" comment tags. If the condition is not met, delete the entire block section completely from the output.

Hardcoded Text Double Quotes Rules:
- If any text is written inside double quotes (e.g. "Partner" or "Live"), consider it to be hardcoded. Only print the text itself, NOT the surrounding double quotes in the final output.

Custom Variable Resolution Rules:
- If a line has a custom variable and a comment instruction like:
  EDIAddress= "Partner".{Var_EdiLiveAddress}."Live"  //extract capital word from "{EDI_Address}" and print in place of "{Var_EdiLiveAddress}"
  You must extract the capital word from the specified source field (e.g. {EDI_Address}) and substitute it in place of the target custom variable (e.g. {Var_EdiLiveAddress}) in the final output.

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
- Final INI Content`;
