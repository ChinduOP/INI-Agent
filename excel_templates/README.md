# Excel Reference Templates Repository

Upload your master Excel workbook templates (`.xlsx`) or reference schema files into this folder.

When users upload an Excel document in the chat interface, the **LangGraph Excel Analyzer** automatically compares the uploaded workbook against the reference templates stored here to accurately extract:
1. **Modules**: Trading Partner assignments, environment settings, and database configurations.
2. **EDI**: Protocol qualifiers, sender/receiver IDs, segment terminators (`~`), and element separators (`*`).
3. **Document**: Inbound/Outbound directory paths and archiving rules.

## Master Worksheet Schema Requirement
Every Excel template placed here must define three core worksheets:
- `Modules`
- `EDI`
- `Document`
