import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

export interface XmlSubFieldItem {
  id: string; // e.g., "Header::ASN number::CheckMaximumLength"
  name: string; // e.g., "CheckMaximumLength (length=35)"
  tagName: string;
}

export interface XmlFieldItem {
  id: string; // e.g., "Header::ASN number"
  name: string; // e.g., "ASN number"
  sectionName: string; // e.g., "Header"
  dataType?: string;
  requirement?: string;
  tagName: string;
  subFields?: XmlSubFieldItem[];
}

export interface XmlSectionGroup {
  sectionName: string;
  fields: XmlFieldItem[];
}

export function isValidationXmlFile(pathOrFilename: string): boolean {
  if (!pathOrFilename) return false;
  const lower = pathOrFilename.toLowerCase();
  return (
    lower.includes('config/validation') ||
    lower.includes('config\\validation') ||
    lower.includes('/validation/') ||
    lower.includes('\\validation\\') ||
    lower.startsWith('validation.') ||
    lower.includes('/validation.') ||
    lower.includes('\\validation.') ||
    lower.endsWith('.xml')
  );
}

export function isDcpXmlFile(pathOrFilename: string): boolean {
  if (!pathOrFilename) return false;
  const normalizedPath = pathOrFilename.toLowerCase().replace(/\\/g, '/');
  return normalizedPath.includes('/config/application/dcp/') ||
    normalizedPath.startsWith('config/application/dcp/');
}

export function isXmlFieldSelectionAvailable(pathOrFilename: string): boolean {
  if (!pathOrFilename) return false;
  return isDcpXmlFile(pathOrFilename) || pathOrFilename.toLowerCase().endsWith('.xml');
}

function getElementPath(element: Element): string {
  const segments: string[] = [];
  let current: Element | null = element;

  while (current) {
    let index = 1;
    let sibling = current.previousSibling;
    while (sibling) {
      if (sibling.nodeType === 1 && (sibling as Element).tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousSibling;
    }
    segments.unshift(`${current.tagName}[${index}]`);
    current = current.parentNode?.nodeType === 1 ? current.parentNode as Element : null;
  }

  return `xml::/${segments.join('/')}`;
}

function getGenericDescendants(element: Element): XmlSubFieldItem[] {
  const descendants: XmlSubFieldItem[] = [];
  const visit = (parent: Element) => {
    for (let i = 0; i < parent.childNodes.length; i++) {
      const child = parent.childNodes[i];
      if (child.nodeType !== 1) continue;
      const childElement = child as Element;
      const attributes: string[] = [];
      for (let a = 0; a < childElement.attributes.length; a++) {
        const attribute = childElement.attributes[a];
        attributes.push(`${attribute.name}=${attribute.value}`);
      }
      const attributeText = attributes.length > 0 ? ` (${attributes.join(', ')})` : '';
      descendants.push({
        id: getElementPath(childElement),
        name: `${getElementPath(childElement).replace('xml::/', '')}${attributeText}`,
        tagName: childElement.tagName
      });
      visit(childElement);
    }
  };
  visit(element);
  return descendants;
}

export function parseXmlStructure(xmlContent: string): XmlSectionGroup[] {
  if (!xmlContent || !xmlContent.trim()) return [];
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    const groups: XmlSectionGroup[] = [];

    // 1. Check for <Document> section
    const docNode = doc.getElementsByTagName('Document')[0];
    if (docNode) {
      const docFields: XmlFieldItem[] = [];
      const children = docNode.childNodes;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.nodeType === 1) { // Element node
          const elem = child as unknown as Element;
          const nameAttr = elem.getAttribute('name') || elem.getAttribute('allowed') || elem.getAttribute('inclusions') || elem.tagName;
          docFields.push({
            id: `Document::${nameAttr}`,
            name: `${elem.tagName} (${nameAttr})`,
            sectionName: 'Document Settings',
            tagName: elem.tagName,
            requirement: elem.getAttribute('severity') || undefined
          });
        }
      }
      if (docFields.length > 0) {
        groups.push({ sectionName: 'Document Settings', fields: docFields });
      }
    }

    // 2. Check for <Section> nodes inside <Sections> or root
    const sectionNodes = doc.getElementsByTagName('Section');
    for (let s = 0; s < sectionNodes.length; s++) {
      const secElem = sectionNodes[s] as unknown as Element;
      const sectionName = secElem.getAttribute('name') || `Section ${s + 1}`;
      const fields: XmlFieldItem[] = [];

      // Find direct or indirect <Field> nodes
      const fieldElems = secElem.getElementsByTagName('Field');
      for (let f = 0; f < fieldElems.length; f++) {
        const fElem = fieldElems[f] as unknown as Element;
        const fieldName = fElem.getAttribute('name') || `Field ${f + 1}`;
        const fieldId = `${sectionName}::${fieldName}`;
        
        // Extract sub-fields / functions
        const subFields: XmlSubFieldItem[] = [];
        const funcContainer = fElem.getElementsByTagName('Functions')[0];
        if (funcContainer) {
          const fnChildren = funcContainer.childNodes;
          for (let fn = 0; fn < fnChildren.length; fn++) {
            const fnChild = fnChildren[fn];
            if (fnChild.nodeType === 1) { // Element
              const fnElem = fnChild as unknown as Element;
              const tagName = fnElem.tagName;
              const attrs: string[] = [];
              if (fnElem.getAttribute('length')) attrs.push(`length=${fnElem.getAttribute('length')}`);
              if (fnElem.getAttribute('format')) attrs.push(`format=${fnElem.getAttribute('format')}`);
              if (fnElem.getAttribute('severity')) attrs.push(`severity=${fnElem.getAttribute('severity')}`);
              
              const attrStr = attrs.length > 0 ? ` (${attrs.join(', ')})` : '';
              subFields.push({
                id: `${fieldId}::${tagName}`,
                name: `${tagName}${attrStr}`,
                tagName
              });
            }
          }
        }

        // If no explicit <Functions> subfields exist, create informative default subfield rule nodes
        if (subFields.length === 0) {
          if (fElem.getAttribute('dataType')) {
            subFields.push({
              id: `${fieldId}::DataType`,
              name: `TypeCheck: ${fElem.getAttribute('dataType')}`,
              tagName: 'DataType'
            });
          }
          if (fElem.getAttribute('requirement')) {
            subFields.push({
              id: `${fieldId}::Requirement`,
              name: `RequirementCheck: ${fElem.getAttribute('requirement')}`,
              tagName: 'Requirement'
            });
          }
        }

        fields.push({
          id: fieldId,
          name: fieldName,
          sectionName,
          tagName: 'Field',
          dataType: fElem.getAttribute('dataType') || undefined,
          requirement: fElem.getAttribute('requirement') || undefined,
          subFields: subFields.length > 0 ? subFields : undefined
        });
      }

      if (fields.length > 0) {
        groups.push({ sectionName, fields });
      }
    }

    const root = doc.documentElement;
    const documentNode = doc.getElementsByTagName('Document')[0];
    const hasLegacyDocumentSchema = !!documentNode && (
      documentNode === root || documentNode.parentNode === root
    );
    if (doc.getElementsByTagName('Section').length > 0 || hasLegacyDocumentSchema) {
      return groups;
    }
    groups.length = 0;

    // DCP XML templates can use schemas other than the Document/Section format.
    // In that case, expose every element beneath the document root as selectable.
    if (!root) return groups;

    const genericFields: XmlFieldItem[] = [];
    for (let i = 0; i < root.childNodes.length; i++) {
      const child = root.childNodes[i];
      if (child.nodeType !== 1) continue;
      const element = child as unknown as Element;
      const attributes: string[] = [];
      for (let a = 0; a < element.attributes.length; a++) {
        const attribute = element.attributes[a];
        attributes.push(`${attribute.name}=${attribute.value}`);
      }
      const attributeText = attributes.length > 0 ? ` (${attributes.join(', ')})` : '';
      genericFields.push({
        id: getElementPath(element),
        name: `${element.tagName}${attributeText}`,
        sectionName: root.tagName,
        tagName: element.tagName,
        subFields: getGenericDescendants(element)
      });
    }

    if (genericFields.length > 0) {
      groups.push({ sectionName: root.tagName, fields: genericFields });
    }
    return groups;
  } catch (err) {
    console.error('Error parsing XML structure:', err);
    return [];
  }
}

export function cleanXmlComments(xml: string): string {
  if (!xml) return '';
  // Strip XML comments
  let cleaned = xml.replace(/<!--[\s\S]*?-->/g, '');
  // Remove empty lines
  const lines = cleaned.split(/\r?\n/).filter(line => line.trim().length > 0);
  return lines.join('\n');
}

export function filterXmlBySelectedFields(xmlContent: string, selectedFieldIds?: string[]): string {
  if (!xmlContent || !xmlContent.trim()) return '';

  // Always remove comments
  if (selectedFieldIds === undefined) {
    return cleanXmlComments(xmlContent);
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    const selectedSet = new Set(selectedFieldIds);
    const root = doc.documentElement;
    const documentNode = doc.getElementsByTagName('Document')[0];
    const hasKnownSchema = doc.getElementsByTagName('Section').length > 0 ||
      (!!documentNode && (documentNode === root || documentNode.parentNode === root));

    if (!hasKnownSchema) {
      if (!root) return cleanXmlComments(xmlContent);

      const filterChildren = (parent: Element) => {
        const children = Array.from(parent.childNodes);
        children.forEach(child => {
          if (child.nodeType !== 1) return;
          const element = child as Element;
          const elementId = getElementPath(element);
          const hasSelectedDescendant = Array.from(selectedSet).some(id => id.startsWith(`${elementId}/`));
          if (!selectedSet.has(elementId) && !hasSelectedDescendant) {
            parent.removeChild(child);
            return;
          }
          filterChildren(element);
        });
      };
      filterChildren(root as unknown as Element);
      return cleanXmlComments(new XMLSerializer().serializeToString(doc));
    }

    // 1. Filter <Document> children if Document Settings was customized
    const docNode = doc.getElementsByTagName('Document')[0];
    if (docNode) {
      const children = Array.from(docNode.childNodes);
      children.forEach(child => {
        if (child.nodeType === 1) {
          const elem = child as unknown as Element;
          const nameAttr = elem.getAttribute('name') || elem.getAttribute('allowed') || elem.getAttribute('inclusions') || elem.tagName;
          const id = `Document::${nameAttr}`;
          if (!selectedSet.has(id)) {
            docNode.removeChild(child);
          }
        }
      });
    }

    // 2. Filter <Section> nodes and <Field> nodes
    const sectionNodes = Array.from(doc.getElementsByTagName('Section'));
    sectionNodes.forEach(sNode => {
      const secElem = sNode as unknown as Element;
      const sectionName = secElem.getAttribute('name') || '';
      const fieldElems = Array.from(secElem.getElementsByTagName('Field'));
      let keptFieldsCount = 0;

      fieldElems.forEach(fNode => {
        const fElem = fNode as unknown as Element;
        const fieldName = fElem.getAttribute('name') || '';
        const fieldId = `${sectionName}::${fieldName}`;
        
        // Check if field itself is selected or if any of its subfields are selected
        const isFieldSelected = selectedSet.has(fieldId) || Array.from(selectedSet).some(s => s.startsWith(`${fieldId}::`));
        if (!isFieldSelected) {
          if (fElem.parentNode) {
            fElem.parentNode.removeChild(fElem);
          }
        } else {
          keptFieldsCount++;
        }
      });

      // If no fields remain in this section, remove the section
      if (keptFieldsCount === 0 && secElem.parentNode) {
        secElem.parentNode.removeChild(secElem);
      }
    });

    const serializer = new XMLSerializer();
    const rawXml = serializer.serializeToString(doc);
    return cleanXmlComments(rawXml);
  } catch (err) {
    console.error('Error filtering XML by selected fields:', err);
    return cleanXmlComments(xmlContent);
  }
}
