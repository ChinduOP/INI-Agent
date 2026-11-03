# INI Generation Knowledge Base

This file contains rules, conditions, and instructions for generating different types of INI files. The AI should refer to this file when creating or modifying INI content.

## General Rules
- Always maintain valid INI format (`[Section]` followed by `Key=Value`).
- Ensure all required keys for a section are present based on the INI type.

## INI Type Definitions

### Type: EDIAddress.{key}.ini
- **Description**: This ini is used to define the EDI addresses
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO"
- **Key Rules**:
  - Rule 1: [e.g., Key X must be present]
  - Rule 2: [e.g., Value Y must be in uppercase]

### Type: Identifier.{unique_name}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: Partner.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: ReferenceIdentifier.{unique_name}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: ReferenceIdentifier.{unique_name}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: ReferenceIdentifier.{unique_name}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: {mnemonic}.{activation key}.ini
- **Description**: This ini is used to create validation files.
- **FilePath**: `C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\Validations\Documents`
- **Key Rules**:
  **For Single File Creation**:
  - **Rule 1**: User will specify for which transaction the validation ini to be created. Look for the particular transaction in the document column. The document column may have more than one document type; consider unique based on the validation file column for the particular document. For the particular documents, look for the validation file & validation description column, get data from attached sheet and Create ini file with naming same as validation file name.
  - **Rule 2**: For single file, show download ini and download file. If there is more than one file then follow: for download create folders with zip file format following path (/TP Root/Validations/Documents).
  **For Bulk Files Creation**:
  - **Rule 1**: In the Documents sheet, the validation file column has a list of filenames for In and Out Direction. Create an ini for each entry in the validation file column; it also has duplicate file names, consider only unique filenames.
  - **Rule 2**: In the Documents sheet, the validation description column maps to the Name (description) and validation filename (filename) in the INI template. For the filename, append ".xml" at the end.
  - **Rule 3**: Create ini file with naming, same as the validation file name. And for download, create folders with zip file format following path (/TP Root/Validations/Documents).


### Type: {business channel}.{direction}.{document group}.{document sub group}.{syntax}.{version}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\TransformsSets"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: in.{DocType}[.{SubType}].ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\Profiles\Documents"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: out.{DocType}[.{SubType}].ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\Profiles\Documents"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: in.{document group}.{syntax}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\Profiles\EDIBatches"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: out.{document group}.{syntax}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\Profiles\EDIBatches"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: DCP XML (*.xml)
- **Description**: DCP XML Configuration and Schema Definition files
- **FilePath**: "TP.PACK-ISO\DCP (xml)"
- **Key Rules**:
  - Folder path: `TP.PACK-ISO\DCP (xml)`
  - Filename conventions:
    i. If user uploaded an Excel sheet: Get key `Document_ValidationFile` (or `Document_Validation File`), prepend `DCP.` and append `.xml` (Format: `DCP.{Document_ValidationFile}.xml`). Match the exact template based on the validation file name (e.g. `INV.` maps to `INV.xml`, `ASN.` maps to `ASN.xml`). If multiple matching records exist (e.g., two ASN rows), generate separate XML files for each.
    ii. If user has not uploaded an Excel sheet: Output filename must be the actual filename from the folder (e.g. `INV.xml`).
  - Without any comments: Remove all XML comments (`<!-- ... -->`), inline comments, block comments, and headers completely.
  - Remove empty lines: Remove all empty lines so no blank lines remain in the output.

### Type: ActivationDefaulter.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\Modules\ActivationDefaulters"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: {message type group}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\Modules\Containers"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: {message type}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\Modules\DCPEditorViewModels"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: {message type}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\Modules\DCPEditorViews"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: {Name}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\Modules\DCPReports"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: creator.{document group}.{sytnax}.{version}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\Modules\EDIBatchCreators"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: {Name}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\Modules\EDIBatchIdentifiers"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: parser.{document group}.{syntax}.{version}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\Modules\EDIBatchParsers"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: {document type}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\Modules\Exports"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: {syntax}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\Modules\FunctionalAckCreators"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: {syntax}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\Modules\FunctionalAckParsers"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: {message type}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\Modules\Reports"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Type: {iso}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\Modules\TaxReports"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### {message type}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\Modules\ValidationModules"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### {document group}.{syntax}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\FunctionalAckParsers"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Document.{document type}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\DCP"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Reports.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\DCP"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]

### Workflow.{workflow key}.ini
- **Description**: [Description of Type B]
  **FilePath**: "C:\Users\chinduprasak\Documents\Local_Hub\TP.PACK-ISO\DCP"
- **Key Rules**:
  - Rule 1: [e.g., Section Z is mandatory]