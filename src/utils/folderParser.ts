import { GeneratedIniResult } from '../../server/graph/state.js';

export interface FolderInfo {
  root: string;         // e.g. "TP.PACK-ISO"
  parent: string;       // e.g. "Profile" or "Validations"
  subfolder: string;    // e.g. "Documents"
  fullKey: string;      // e.g. "Profile/Documents" or "Validations/Documents"
  displayLabel: string; // e.g. "Profile → Documents" or "Validations → Documents"
}

export interface SubfolderItem {
  subfolder: string;
  fullKey: string;
  displayLabel: string;
  count: number;
}

export interface FolderHierarchy {
  [parent: string]: {
    subfolders: SubfolderItem[];
    totalCount: number;
  };
}

/**
 * Parses the folder hierarchy (Root, Parent, Subfolder) for a given generated INI or XML result.
 * Strictly classifies files into their proper structural folders:
 * - Profile -> Documents (in.*.ini, out.*.ini)
 * - Validations -> Documents (RSP.*.ini, PAK.*.ini, ASN.*.ini, INV.*.ini, CRN.*.ini, PO.*.ini, etc.)
 * - Profile -> EDIBatches (EDIBatch.*.ini, etc.)
 * - Modules -> Modules / EDIBatchParsers / EDIBatchCreators / DCPReports
 * - DCP (xml) -> xml (DCP.*.xml)
 */
export function parseFolderInfo(r: GeneratedIniResult): FolderInfo {
  const filename = (r.filename || '').trim();
  const filenameLower = filename.toLowerCase();
  const templatePath = (r.templatePath || '').replace(/\\/g, '/').trim();
  const templateLower = templatePath.toLowerCase();
  const content = r.content || '';
  const contentLower = content.toLowerCase();

  if (r.sourceSheet === 'EDI') {
    return {
      root: 'TP.PACK-ISO',
      parent: 'Profile',
      subfolder: 'EDIBatches',
      fullKey: 'Profile/EDIBatches',
      displayLabel: 'Profile → EDIBatches'
    };
  }
  if (r.sourceSheet === 'Document') {
    return {
      root: 'TP.PACK-ISO',
      parent: 'Profiles',
      subfolder: 'Documents',
      fullKey: 'Profiles/Documents',
      displayLabel: 'Profiles → Documents'
    };
  }

  // 1. Explicit template path parsing (Highest Priority)
  // This preserves the exact folder structure selected by the user from the Template Manager.
  let rawPath = '';
  if (templatePath && templatePath !== 'previous_template.ini' && templatePath !== 'generated.ini') {
    rawPath = templatePath;
  }

  if (rawPath && rawPath.includes('/')) {
    rawPath = rawPath.replace(/\.{2,}$/, '').replace(/\/\*+$/, '').replace(/\/+$/, '').trim();
    if (/\.(ini|xml|json|txt|md|csv)$/i.test(rawPath)) {
      const lastSlash = rawPath.lastIndexOf('/');
      rawPath = lastSlash !== -1 ? rawPath.substring(0, lastSlash) : '';
    }
    const segments = rawPath.split('/').map(s => s.trim()).filter(Boolean);
    if (segments.length > 0 && segments[0].toLowerCase() === 'ini_templates') {
      segments.shift();
    }
    
    if (segments.length >= 2) {
      // Use the exact folder names from the tree (e.g. Validations / Documents)
      const p = segments[segments.length - 2];
      const s = segments[segments.length - 1];
      return {
        root: 'TP.PACK-ISO',
        parent: p,
        subfolder: s,
        fullKey: `${p}/${s}`,
        displayLabel: `${p} → ${s}`
      };
    } else if (segments.length === 1) {
      return {
        root: 'TP.PACK-ISO',
        parent: segments[0],
        subfolder: 'Files',
        fullKey: `${segments[0]}/Files`,
        displayLabel: `${segments[0]} → Files`
      };
    }
  }

  // 2. XML / DCP Files (Heuristic fallback)
  const isXml = 
    filenameLower.endsWith('.xml') ||
    templateLower.endsWith('.xml') ||
    templateLower.includes('dcp (xml)') ||
    templateLower.includes('dcp(xml)') ||
    contentLower.trim().startsWith('<?xml') ||
    contentLower.trim().startsWith('<configuration') ||
    contentLower.trim().startsWith('<dcp');

  if (isXml) {
    return {
      root: 'TP.PACK-ISO',
      parent: 'DCP (xml)',
      subfolder: 'xml',
      fullKey: 'DCP (xml)/xml',
      displayLabel: 'DCP (xml) → xml'
    };
  }

  // 2. Validation INI Files
  // Validation files are named: RSP.*, PAK.*, ASN.*, INV.*, CRN.*, PO.*, ORD.*, *.Validation.*
  // or come from Validations/Documents template folder
  const isDocProfile = filenameLower.startsWith('in.') || filenameLower.startsWith('out.');
  const isValidation = !isDocProfile && (
    templateLower.includes('validation') ||
    templateLower.includes('validations/documents') ||
    filenameLower.includes('validation') ||
    filenameLower.includes('schema') ||
    filenameLower.startsWith('pak.') ||
    filenameLower.startsWith('crn.') ||
    filenameLower.startsWith('rsp.') ||
    filenameLower.startsWith('asn.') ||
    filenameLower.startsWith('inv.') ||
    filenameLower.startsWith('po.') ||
    filenameLower.startsWith('ord.') ||
    (contentLower.includes('[general]') && contentLower.includes('error') && !contentLower.includes('inbound='))
  );

  if (isValidation) {
    return {
      root: 'TP.PACK-ISO',
      parent: 'Validations',
      subfolder: 'Documents',
      fullKey: 'Validations/Documents',
      displayLabel: 'Validations → Documents'
    };
  }

  // 3. EDIBatches Profile Files
  const isEdiBatch =
    templateLower.includes('edibatch') ||
    templateLower.includes('edibatches') ||
    templateLower.includes('profiles/edibatches') ||
    filenameLower.includes('edibatch') ||
    filenameLower.includes('syntax') ||
    filenameLower.includes('envelope') ||
    contentLower.includes('[edi_envelope]') ||
    contentLower.includes('edi_syntax') ||
    contentLower.includes('x12_interchange');

  if (isEdiBatch) {
    return {
      root: 'TP.PACK-ISO',
      parent: 'Profile',
      subfolder: 'EDIBatches',
      fullKey: 'Profile/EDIBatches',
      displayLabel: 'Profile → EDIBatches'
    };
  }

  // 4. Module Files
  const isModule =
    templateLower.includes('module') ||
    templateLower.includes('parser') ||
    templateLower.includes('creator') ||
    templateLower.includes('dcpreport') ||
    filenameLower.includes('module') ||
    filenameLower.includes('parser') ||
    filenameLower.includes('creator') ||
    filenameLower.includes('dcpreport') ||
    contentLower.includes('dcpreport') ||
    contentLower.includes('module_type');

  if (isModule) {
    let sub = 'Modules';
    if (templateLower.includes('parser') || filenameLower.includes('parser')) sub = 'EDIBatchParsers';
    else if (templateLower.includes('creator') || filenameLower.includes('creator')) sub = 'EDIBatchCreators';
    else if (templateLower.includes('dcpreport') || filenameLower.includes('dcpreport')) sub = 'DCPReports';
    return {
      root: 'TP.PACK-ISO',
      parent: 'Modules',
      subfolder: sub,
      fullKey: `Modules/${sub}`,
      displayLabel: `Modules → ${sub}`
    };
  }

  // 6. Default: Profiles -> Documents (for in.*.ini, out.*.ini, and Document routing INIs)
  return {
    root: 'TP.PACK-ISO',
    parent: 'Profiles',
    subfolder: 'Documents',
    fullKey: 'Profiles/Documents',
    displayLabel: 'Profiles → Documents'
  };
}

/**
 * Builds a structured hierarchy of parent folders and subfolders from results list.
 */
export function buildFolderHierarchy(results: GeneratedIniResult[]): {
  hierarchy: FolderHierarchy;
  folderMap: Map<GeneratedIniResult, FolderInfo>;
  uniqueKeys: string[];
} {
  const hierarchy: FolderHierarchy = {};
  const folderMap = new Map<GeneratedIniResult, FolderInfo>();
  const keySet = new Set<string>();

  results.forEach(r => {
    const info = parseFolderInfo(r);
    folderMap.set(r, info);
    keySet.add(info.fullKey);

    const parentDisplay = info.parent;

    if (!hierarchy[parentDisplay]) {
      hierarchy[parentDisplay] = {
        subfolders: [],
        totalCount: 0
      };
    }

    hierarchy[parentDisplay].totalCount++;

    let sub = hierarchy[parentDisplay].subfolders.find(s => s.fullKey === info.fullKey);
    if (!sub) {
      sub = {
        subfolder: info.subfolder,
        fullKey: info.fullKey,
        displayLabel: info.displayLabel,
        count: 0
      };
      hierarchy[parentDisplay].subfolders.push(sub);
    }
    sub.count++;
  });

  // Sort subfolders alphabetically
  Object.values(hierarchy).forEach(parentGroup => {
    parentGroup.subfolders.sort((a, b) => a.subfolder.localeCompare(b.subfolder));
  });

  return {
    hierarchy,
    folderMap,
    uniqueKeys: Array.from(keySet)
  };
}
