import { ValidationSummary } from '../graph/state.js';

export class ValidatorService {
  /**
   * Node 8: Validator
   * Audits generated INI string for missing required fields, TODO placeholders,
   * duplicate sections, duplicate keys, and invalid formatting.
   */
  public static validateIniContent(iniContent: string): ValidationSummary {
    const lines = iniContent.split(/\r?\n/);
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const sectionsSeen: Set<string> = new Set();
    let currentSection: string | null = null;
    let keysInSection: Set<string> = new Set();
    
    let missingKeysCount = 0;
    let todoCount = 0;

    const requiredKeys = ['Partner', 'Version', 'Document', 'Protocol'];

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();

      // Skip blank lines and comments
      if (trimmed === '' || trimmed.startsWith(';') || trimmed.startsWith('#')) {
        return;
      }

      // Check section header [SECTION]
      if (trimmed.startsWith('[')) {
        if (!trimmed.endsWith(']')) {
          errors.push(`Line ${lineNum}: Invalid section formatting "${trimmed}" (missing closing bracket).`);
        } else {
          const sectionName = trimmed.substring(1, trimmed.length - 1).trim();
          if (sectionsSeen.has(sectionName.toLowerCase())) {
            errors.push(`Line ${lineNum}: Duplicate section "[${sectionName}]" detected.`);
          } else {
            sectionsSeen.add(sectionName.toLowerCase());
          }
          currentSection = sectionName;
          keysInSection = new Set(); // reset keys for new section
        }
        return;
      }

      // Check key=value assignment
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        errors.push(`Line ${lineNum}: Invalid syntax "${trimmed}" outside section or comment (missing '=').`);
        return;
      }

      const key = trimmed.substring(0, eqIndex).trim();
      const val = trimmed.substring(eqIndex + 1).trim();

      if (!currentSection) {
        warnings.push(`Line ${lineNum}: Key "${key}" assigned before any section header.`);
      }

      // Duplicate key check in current section
      if (keysInSection.has(key.toLowerCase())) {
        errors.push(`Line ${lineNum}: Duplicate key "${key}" inside section "[${currentSection}]".`);
      } else {
        keysInSection.add(key.toLowerCase());
      }

      // Check empty value or TODO
      if (val === '') {
        missingKeysCount++;
        if (requiredKeys.includes(key)) {
          errors.push(`Line ${lineNum}: Required field "${key}" is empty.`);
        } else {
          warnings.push(`Line ${lineNum}: Field "${key}" has no assigned value.`);
        }
      } else if (val.toUpperCase() === 'TODO') {
        todoCount++;
        warnings.push(`Line ${lineNum}: Field "${key}" requires manual configuration (currently set to TODO).`);
      }
    });

    if (sectionsSeen.size === 0) {
      errors.push('No INI sections found in generated file.');
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      warnings,
      missingKeysCount,
      todoCount
    };
  }
}
