import ExcelJS from 'exceljs';
import fs from 'fs';
import { ParsedExcelData } from '../graph/state.js';

export class ExcelService {
  /**
   * Reads an uploaded Excel file (.xlsx) and parses Modules, EDI, and Document worksheets.
   */
  public static async parseExcelFile(filePath: string): Promise<ParsedExcelData> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const modulesData = this.readSheetRows(workbook, 'Modules');
    const ediData = this.readSheetRows(workbook, 'EDI');
    const documentData = this.readSheetRows(workbook, 'Document');

    // Create a readable summary string for LLM prompt context
    let rawSummary = `=== MODULES WORKSHEET ===\n${JSON.stringify(modulesData, null, 2)}\n\n`;
    rawSummary += `=== EDI WORKSHEET ===\n${JSON.stringify(ediData, null, 2)}\n\n`;
    rawSummary += `=== DOCUMENT WORKSHEET ===\n${JSON.stringify(documentData, null, 2)}`;

    return {
      modules: modulesData,
      edi: ediData,
      document: documentData,
      rawTextSummary: rawSummary
    };
  }

  private static readSheetRows(workbook: ExcelJS.Workbook, sheetName: string): Record<string, any>[] {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      return [];
    }

    const rows: Record<string, any>[] = [];
    let headers: string[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        // Assume first row is headers
        row.eachCell((cell, colNumber) => {
          headers[colNumber] = cell.text ? cell.text.trim() : `Col_${colNumber}`;
        });
      } else {
        const rowData: Record<string, any> = {};
        let hasValue = false;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const header = headers[colNumber] || `Col_${colNumber}`;
          const val = cell.text ? cell.text.trim() : '';
          rowData[header] = val;
          if (val !== '') hasValue = true;
        });
        if (hasValue) {
          rows.push(rowData);
        }
      }
    });

    return rows;
  }

  /**
   * Generates a realistic sample 3-worksheet Excel buffer for testing.
   */
  public static async generateSampleWorkbook(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'INI Agent';
    workbook.created = new Date();

    // 1. Modules Sheet
    const modulesSheet = workbook.addWorksheet('Modules');
    modulesSheet.columns = [
      { header: 'ModuleName', key: 'mod', width: 25 },
      { header: 'TradingPartner', key: 'partner', width: 20 },
      { header: 'Environment', key: 'env', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'DatabaseName', key: 'db', width: 20 }
    ];
    modulesSheet.addRow({ mod: 'PurchaseOrder', partner: 'PartnerA', env: 'PROD', status: 'Active', db: 'EDI_PROD_DB' });
    modulesSheet.addRow({ mod: 'AdvanceShipNotice', partner: 'PartnerB', env: 'PROD', status: 'Active', db: 'EDI_PROD_DB' });
    modulesSheet.addRow({ mod: 'Invoice', partner: 'PartnerA', env: 'PROD', status: 'Active', db: 'EDI_PROD_DB' });

    // 2. EDI Sheet
    const ediSheet = workbook.addWorksheet('EDI');
    ediSheet.columns = [
      { header: 'Parameter', key: 'param', width: 30 },
      { header: 'PartnerA_Value', key: 'pa', width: 35 },
      { header: 'PartnerB_Value', key: 'pb', width: 35 }
    ];
    ediSheet.addRow({ param: 'ISA_Sender_ID', pa: '005432109', pb: 'ZZ_OURCOMP' });
    ediSheet.addRow({ param: 'ISA_Receiver_ID', pa: 'ZZ_PARTNERA_PROD', pb: '012345678' });
    ediSheet.addRow({ param: 'GS_Sender_ID', pa: 'OURCOMPGS', pb: 'OURCOMPGS' });
    ediSheet.addRow({ param: 'GS_Receiver_ID', pa: 'PARTNERAGS', pb: 'PARTNERBGS' });
    ediSheet.addRow({ param: 'Protocol', pa: 'X12', pb: 'X12' });
    ediSheet.addRow({ param: 'SegmentTerminator', pa: '~', pb: '~' });
    ediSheet.addRow({ param: 'ElementSeparator', pa: '*', pb: '*' });
    ediSheet.addRow({ param: 'SubElementSeparator', pa: ':', pb: '>' });
    ediSheet.addRow({ param: 'Version', pa: '4010', pb: '5010' });
    ediSheet.addRow({ param: 'AS2_ID', pa: 'AS2_OURS', pb: 'AS2_OURS' });
    ediSheet.addRow({ param: 'Partner_AS2_ID', pa: 'AS2_PARTNER_A', pb: 'AS2_PARTNER_B' });

    // 3. Document Sheet
    const docSheet = workbook.addWorksheet('Document');
    docSheet.columns = [
      { header: 'DocType', key: 'doc', width: 15 },
      { header: 'Partner', key: 'partner', width: 18 },
      { header: 'Direction', key: 'dir', width: 15 },
      { header: 'InboundPath', key: 'in', width: 35 },
      { header: 'OutboundPath', key: 'out', width: 35 },
      { header: 'ArchivePath', key: 'arch', width: 35 },
      { header: 'StatusQualifier', key: 'qual', width: 20 }
    ];
    docSheet.addRow({
      doc: '850',
      partner: 'PartnerA',
      dir: 'OUT',
      in: '/srv/edi/partnerA/in',
      out: '/srv/edi/partnerA/out/850',
      arch: '/srv/edi/archive/partnerA/850',
      qual: 'ORIGINAL_PO'
    });
    docSheet.addRow({
      doc: '810',
      partner: 'PartnerA',
      dir: 'IN',
      in: '/srv/edi/partnerA/in/810',
      out: '/srv/edi/partnerA/out',
      arch: '/srv/edi/archive/partnerA/810',
      qual: 'TAX_INCL'
    });
    docSheet.addRow({
      doc: '856',
      partner: 'PartnerB',
      dir: 'OUT',
      in: '',
      out: '/srv/edi/partnerB/asn_out',
      arch: '/srv/edi/archive/partnerB/856',
      qual: 'SHIP_SOP'
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
