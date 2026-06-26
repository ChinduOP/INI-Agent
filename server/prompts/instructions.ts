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
- Unknown values should become TODO.
- Follow filename conventions.
- Match template formatting exactly.

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
