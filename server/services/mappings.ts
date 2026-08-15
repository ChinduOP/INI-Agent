/**
 * Centralized Text and Terminology Mappings.
 * 
 * This file centralizes all mapping definitions used by the application to bridge 
 * the gap between template placeholder terms and the actual text/column headers 
 * in the uploaded Excel worksheets.
 * 
 * Modify or add items to this dictionary to customize the dynamic text matching behavior.
 */

export const CENTRAL_DICTIONARY: Record<string, string> = {
  // --- Core Trading Partner Mappings ---
  "TP KEY": "TP.PACK-ISO", // Maps to key column (TP.PACK-ISO[.Channel].Label.Carton.4x6.1up)
  "TP name": "Trading Partner Name",
  
  // --- EDI & Document Engines ---
  "DocumentReconciliation": "Reconciliation", // Matches document reconciliation worksheet settings
  "Report": "DCP Report", // Matches DCP Report or Module worksheet columns
  "Filename Suffix": "Suffix", // Matches filename suffix/extension settings
  "EDI creators": "EDIBatchCreator", // Matches EDIBatchCreator
  "EDI parsers": "EDIBatchParser", // Matches EDIBatchParser
  
  // --- Additional Mappings ---
  "Classifications": "Classification",
  "subtypes": "Subtype",
  "version": "Version",
  "validation filenames": "Validation",
  "Display Text": "Display Text"
};
