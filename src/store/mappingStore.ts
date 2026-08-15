import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MappingField, TextMappings } from '../../server/graph/state';

interface MappingStore extends TextMappings {
  // Actions
  setGlobalMappings: (mappings: MappingField[]) => void;
  setTabularMappings: (mappings: MappingField[]) => void;
  
  addGlobalMapping: () => void;
  removeGlobalMapping: (id: string) => void;
  updateGlobalMapping: (id: string, updates: Partial<MappingField>) => void;

  addTabularMapping: () => void;
  removeTabularMapping: (id: string) => void;
  updateTabularMapping: (id: string, updates: Partial<MappingField>) => void;
  
  resetToDefaults: () => void;
}

const DEFAULT_GLOBAL_MAPPINGS: MappingField[] = [
  { id: 'g1', iniName: '{TP KEY}', excelName: 'TP.PACK-ISO', prompt: 'In module sheet key column first element {TP.PACK-ISO[.Channel].l', examples: 'GARNET.HILL-US' },
  { id: 'g2', iniName: '{TP NAME}', excelName: 'Partner Name', prompt: 'Extract the partner name', examples: 'Garnet Hill' },
];

const DEFAULT_TABULAR_MAPPINGS: MappingField[] = [
  { id: '1', iniName: '{TRANSACTION}', excelName: 'DocType', prompt: 'Search for transaction code (e.g. 850, 855)', examples: '850, 855' },
  { id: '2', iniName: '{IN/OUT}', excelName: 'Direction', prompt: 'Identify if inbound or outbound', examples: 'IN, OUT' },
  { id: '3', iniName: '{GROUP}', excelName: 'Functional Group', prompt: 'Identify the functional group', examples: 'PO, IN, FA' },
  { id: '4', iniName: '{SUBGROUP}', excelName: 'Subgroup', prompt: 'Identify the subgroup', examples: 'S1, S2' },
  { id: '5', iniName: '{VERSION}', excelName: 'Version', prompt: 'Identify the version (e.g. 4010, 5010)', examples: '4010, 5010' },
  { id: '6', iniName: '{CLASSIFICATION}', excelName: 'Classification', prompt: 'Identify the classification', examples: 'Retail, Manufacturing' },
  { id: '7', iniName: '{FUNCTION}', excelName: 'Purpose', prompt: 'Identify the purpose/function', examples: 'Original, Cancellation' },
  { id: '8', iniName: '{SUBTYPE}', excelName: 'Subtype', prompt: 'Identify the subtype', examples: 'Standard, Dropship' },
];

export const useMappingStore = create<MappingStore>()(
  persist(
    (set) => ({
      globalMappings: DEFAULT_GLOBAL_MAPPINGS,
      tabularMappings: DEFAULT_TABULAR_MAPPINGS,

      setGlobalMappings: (globalMappings) => set({ globalMappings }),
      setTabularMappings: (tabularMappings) => set({ tabularMappings }),

      addGlobalMapping: () => {
        const id = Math.random().toString(36).substr(2, 9);
        set(state => ({
          globalMappings: [...state.globalMappings, { id, iniName: '{}', excelName: '', prompt: '', examples: '' }]
        }));
      },

      removeGlobalMapping: (id) => {
        set(state => ({
          globalMappings: state.globalMappings.filter(m => m.id !== id)
        }));
      },

      updateGlobalMapping: (id, updates) => {
        set(state => ({
          globalMappings: state.globalMappings.map(m => m.id === id ? { ...m, ...updates } : m)
        }));
      },

      addTabularMapping: () => {
        const id = Math.random().toString(36).substr(2, 9);
        set(state => ({
          tabularMappings: [...state.tabularMappings, { id, iniName: '{}', excelName: '', prompt: '', examples: '' }]
        }));
      },

      removeTabularMapping: (id) => {
        set(state => ({
          tabularMappings: state.tabularMappings.filter(m => m.id !== id)
        }));
      },

      updateTabularMapping: (id, updates) => {
        set(state => ({
          tabularMappings: state.tabularMappings.map(m => m.id === id ? { ...m, ...updates } : m)
        }));
      },

      resetToDefaults: () => {
        set({
          globalMappings: DEFAULT_GLOBAL_MAPPINGS,
          tabularMappings: DEFAULT_TABULAR_MAPPINGS
        });
      }
    }),
    {
      name: 'mapping-storage-v3',
    }
  )
);
