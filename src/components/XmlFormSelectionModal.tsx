import React, { useState, useMemo, useEffect } from 'react';
import { X, CheckSquare, Square, FileCode, Search, Check, RotateCcw, ListFilter, ChevronDown, ChevronRight, Layers, FolderTree } from 'lucide-react';
import { parseXmlStructure, XmlSectionGroup } from '../utils/xmlParser';

interface XmlFormSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: {
    path: string;
    filename: string;
    content: string;
  } | null;
  initialSelectedFields?: string[];
  onSave: (selectedFields: string[]) => void;
}

export const XmlFormSelectionModal: React.FC<XmlFormSelectionModalProps> = ({
  isOpen,
  onClose,
  file,
  initialSelectedFields,
  onSave,
}) => {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Parse XML structure when file or modal opens
  const groups: XmlSectionGroup[] = useMemo(() => {
    if (!file || !file.content) return [];
    return parseXmlStructure(file.content);
  }, [file]);

  // Collect all selectable IDs (field IDs and subfield IDs)
  const allSelectableIds = useMemo(() => {
    const ids: string[] = [];
    groups.forEach(g => {
      g.fields.forEach(f => {
        ids.push(f.id);
        if (f.subFields) {
          f.subFields.forEach(sf => ids.push(sf.id));
        }
      });
    });
    return ids;
  }, [groups]);

  // All expandable node keys for "Expand All" / "Collapse All"
  const allExpandableKeys = useMemo(() => {
    const keys: string[] = [];
    groups.forEach(g => {
      keys.push(`group_${g.sectionName}`);
      keys.push(`fields_${g.sectionName}`);
      g.fields.forEach(f => {
        if (f.subFields && f.subFields.length > 0) {
          keys.push(`field_${f.id}`);
        }
      });
    });
    return keys;
  }, [groups]);

  // Reset modal state when opening
  useEffect(() => {
    if (isOpen) {
      setExpandedNodes(new Set()); // Default: ALL COLLAPSED
      if (allSelectableIds.length > 0) {
        if (initialSelectedFields !== undefined) {
          setSelectedIds(new Set(initialSelectedFields));
        } else {
          // Default: select all
          setSelectedIds(new Set(allSelectableIds));
        }
      }
    }
  }, [isOpen, file, initialSelectedFields, allSelectableIds]);

  if (!isOpen || !file) return null;

  const toggleSingleId = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleIdsGroup = (idsToToggle: string[]) => {
    const allSelected = idsToToggle.every(id => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) {
      idsToToggle.forEach(id => next.delete(id));
    } else {
      idsToToggle.forEach(id => next.add(id));
    }
    setSelectedIds(next);
  };

  const toggleExpand = (nodeKey: string) => {
    const next = new Set(expandedNodes);
    if (next.has(nodeKey)) {
      next.delete(nodeKey);
    } else {
      next.add(nodeKey);
    }
    setExpandedNodes(next);
  };

  const handleExpandAll = () => {
    setExpandedNodes(new Set(allExpandableKeys));
  };

  const handleCollapseAll = () => {
    setExpandedNodes(new Set());
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(allSelectableIds));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleSave = () => {
    onSave(Array.from(selectedIds));
    onClose();
  };

  // Helper to check selection state of a list of IDs
  const getCheckState = (ids: string[]) => {
    if (ids.length === 0) return 'none';
    const count = ids.filter(id => selectedIds.has(id)).length;
    if (count === ids.length) return 'all';
    if (count > 0) return 'some';
    return 'none';
  };

  const renderCheckbox = (state: 'all' | 'some' | 'none', onClick: () => void) => {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="cursor-pointer shrink-0 transition-transform active:scale-95"
      >
        {state === 'all' ? (
          <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 fill-emerald-100 dark:fill-emerald-950/80" />
        ) : state === 'some' ? (
          <div className="w-4 h-4 bg-emerald-500/20 border border-emerald-500 rounded flex items-center justify-center">
            <div className="w-2 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full"></div>
          </div>
        ) : (
          <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 hover:text-slate-400 dark:hover:text-slate-500 transition-colors" />
        )}
      </button>
    );
  };

  // Filter groups according to search input
  const filteredGroups = groups.map(g => {
    if (!search.trim()) return g;
    const searchLower = search.toLowerCase();

    const matchingFields = g.fields.filter(f => {
      const matchName = f.name.toLowerCase().includes(searchLower);
      const matchSection = g.sectionName.toLowerCase().includes(searchLower);
      const matchSub = f.subFields?.some(sf => sf.name.toLowerCase().includes(searchLower));
      return matchName || matchSection || matchSub;
    });

    return { ...g, fields: matchingFields };
  }).filter(g => g.fields.length > 0);

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#181818] border border-slate-200 dark:border-slate-800 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50/80 dark:bg-[#202020] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">
                Custom Field Selection: <span className="text-emerald-600 dark:text-emerald-400 font-mono">{file.filename}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hierarchical XML field & section schema tree configuration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Search */}
        <div className="px-6 py-3 bg-slate-100/60 dark:bg-[#1a1a1a] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 font-sans text-xs">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search sections, fields or subfields..."
              className="w-full bg-white dark:bg-[#242424] text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 transition-all font-sans"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800/50">
              {allSelectableIds.filter(id => selectedIds.has(id)).length} / {allSelectableIds.length} Selected
            </span>
            <button
              onClick={handleExpandAll}
              className="px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded font-medium cursor-pointer transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={handleCollapseAll}
              className="px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded font-medium cursor-pointer transition-colors"
            >
              Collapse All
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              onClick={handleSelectAll}
              className="px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded font-medium cursor-pointer transition-colors"
            >
              Select All
            </button>
            <button
              onClick={handleDeselectAll}
              className="px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded font-medium cursor-pointer transition-colors"
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* Hierarchical Tree Body */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-50/70 dark:bg-[#121212] text-slate-800 dark:text-slate-200 font-sans text-xs leading-relaxed select-none">
          {filteredGroups.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 font-sans text-xs">
              <ListFilter className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              No matching XML nodes found.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredGroups.map((group) => {
                // Collect all selectable IDs under this section
                const sectionAllIds: string[] = [];
                group.fields.forEach(f => {
                  sectionAllIds.push(f.id);
                  if (f.subFields) f.subFields.forEach(sf => sectionAllIds.push(sf.id));
                });

                const sectionCheckState = getCheckState(sectionAllIds);
                const groupKey = `group_${group.sectionName}`;
                const isGroupExpanded = expandedNodes.has(groupKey) || !!search.trim();

                // Friendly display mapping e.g. Header, Body / Sections, Summary / Footer
                let displaySectionName = group.sectionName;
                if (group.sectionName.toLowerCase().includes('detail')) {
                  displaySectionName = `${group.sectionName} (Body / Sections)`;
                } else if (group.sectionName.toLowerCase().includes('summary')) {
                  displaySectionName = `${group.sectionName} (Footer)`;
                }

                return (
                  <div key={group.sectionName} className="bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 shadow-xs transition-colors">
                    
                    {/* SECTION HEADER CARD */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 font-sans">
                        {renderCheckbox(sectionCheckState, () => toggleIdsGroup(sectionAllIds))}
                        <div
                          className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1"
                          onClick={() => toggleExpand(groupKey)}
                        >
                          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                            <FolderTree className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white text-sm tracking-wide truncate">
                            {displaySectionName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700/60">
                          {sectionAllIds.filter(id => selectedIds.has(id)).length} / {sectionAllIds.length}
                        </span>
                        <button
                          onClick={() => toggleExpand(groupKey)}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                        >
                          {isGroupExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {isGroupExpanded && (
                      <div className="mt-3 pl-3 border-l-2 border-indigo-200 dark:border-indigo-900/60 space-y-3">
                        
                        {/* FIELDS BRANCH */}
                        {(() => {
                          const fieldsGroupKey = `fields_${group.sectionName}`;
                          const isFieldsExpanded = expandedNodes.has(fieldsGroupKey) || !!search.trim();

                          return (
                            <div>
                              {/* Fields Header Row */}
                              <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  {renderCheckbox(sectionCheckState, () => toggleIdsGroup(sectionAllIds))}
                                  <div
                                    className="flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-300 cursor-pointer min-w-0 flex-1"
                                    onClick={() => toggleExpand(fieldsGroupKey)}
                                  >
                                    <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                    <span>Fields</span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => toggleExpand(fieldsGroupKey)}
                                  className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded cursor-pointer"
                                >
                                  {isFieldsExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                </button>
                              </div>

                              {isFieldsExpanded && (
                                <div className="mt-2 pl-4 border-l-2 border-indigo-200/80 dark:border-indigo-900/40 space-y-2">
                                  {group.fields.map((field) => {
                                    const fieldAllIds = [field.id, ...(field.subFields ? field.subFields.map(sf => sf.id) : [])];
                                    const fieldCheckState = getCheckState(fieldAllIds);
                                    const fieldKey = `field_${field.id}`;
                                    const isFieldExpanded = expandedNodes.has(fieldKey) || !!search.trim();

                                    return (
                                      <div key={field.id} className="bg-slate-50/80 dark:bg-[#222222] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 transition-colors">
                                        
                                        {/* INDIVIDUAL FIELD NODE */}
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            {renderCheckbox(fieldCheckState, () => toggleIdsGroup(fieldAllIds))}
                                            <div
                                              className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                                              onClick={() => {
                                                if (field.subFields && field.subFields.length > 0) {
                                                  toggleExpand(fieldKey);
                                                } else {
                                                  toggleIdsGroup(fieldAllIds);
                                                }
                                              }}
                                            >
                                              <span className="font-medium font-mono text-slate-800 dark:text-slate-200 text-xs truncate">
                                                {field.name}
                                              </span>

                                              {/* Badges */}
                                              <div className="flex items-center gap-1.5 shrink-0">
                                                {field.dataType && (
                                                  <span className="text-[10px] font-mono font-medium text-sky-700 dark:text-sky-300 bg-sky-100/80 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800/60 px-1.5 py-0.5 rounded">
                                                    {field.dataType}
                                                  </span>
                                                )}
                                                {field.requirement && (
                                                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                                                    field.requirement.toLowerCase().includes('mandatory') || field.requirement.toLowerCase().includes('fail')
                                                      ? 'text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800/60'
                                                      : 'text-slate-600 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                                                  }`}>
                                                    {field.requirement}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>

                                          {field.subFields && field.subFields.length > 0 && (
                                            <button
                                              onClick={() => toggleExpand(fieldKey)}
                                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded cursor-pointer shrink-0"
                                            >
                                              {isFieldExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                            </button>
                                          )}
                                        </div>

                                        {/* SUB-FIELDS BRANCH */}
                                        {field.subFields && field.subFields.length > 0 && isFieldExpanded && (
                                          <div className="mt-2.5 pl-3 border-l-2 border-amber-300 dark:border-amber-800/60 pt-1 space-y-1.5">
                                            {(() => {
                                              const subFieldsAllIds = field.subFields.map(sf => sf.id);
                                              const subFieldsCheckState = getCheckState(subFieldsAllIds);

                                              return (
                                                <div>
                                                  <div className="flex items-center gap-2 py-0.5 font-semibold text-amber-700 dark:text-amber-400 text-[11px] cursor-pointer" onClick={() => toggleIdsGroup(subFieldsAllIds)}>
                                                    {renderCheckbox(subFieldsCheckState, () => toggleIdsGroup(subFieldsAllIds))}
                                                    <span>Sub-fields / Functions</span>
                                                  </div>

                                                  <div className="mt-1 pl-4 space-y-1">
                                                    {field.subFields.map((sf) => {
                                                      const isSfSelected = selectedIds.has(sf.id);

                                                      return (
                                                        <div
                                                          key={sf.id}
                                                          onClick={() => toggleSingleId(sf.id)}
                                                          className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-slate-200/50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                                                        >
                                                          {renderCheckbox(isSfSelected ? 'all' : 'none', () => toggleSingleId(sf.id))}
                                                          <span className="text-slate-700 dark:text-slate-300 text-[11px] font-mono">
                                                            {sf.name}
                                                          </span>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        )}

                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#202020] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-sans">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Default
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Save Field Selection
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
