import { create } from 'zustand';

// ==========================================
// 1. ATOMIC JSON INTERFACES
// ==========================================

export interface ResumeTheme {
  primaryColor: string;
  fontFamily: string;
  fontSize: number | string;
}

export interface AtomicFormatting {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  color?: string;
  letterSpacing?: number;
  alignment?: string;
  marginTop?: number;
  marginBottom?: number;
  backgroundColor?: string;
  padding?: string;
  borderRadius?: number;
  borderBottom?: string;
  [key: string]: any; // Catch-all for other CSS properties
}

export interface AtomicNode {
  type: string; // 'text', 'section', 'educationEntry', 'workEntry', 'bulletList', 'bulletItem'
  id: string;
  value?: string | any;
  title?: string;
  formatting?: AtomicFormatting;
  titleFormatting?: AtomicFormatting;
  children?: AtomicNode[]; //   The recursive secret!
}

export interface ResumeMetadata {
  version?: string;
  resumeName?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  atsScore: number;
  theme: ResumeTheme;
}

export interface ResumeData {
  metadata: ResumeMetadata;
  personalInfo: AtomicNode;
  experience: AtomicNode;
  education: AtomicNode;
  skills?: AtomicNode[]; 
  id?: string; // Database ID for saving
}

// ==========================================
// 2. THE STORE DEFINITION
// ==========================================

interface ResumeStore {
  data: ResumeData;
  isLoading: boolean;
  
  // Actions
  setInitialData: (data: ResumeData) => void;
  updateTheme: (field: keyof ResumeTheme, value: string | number) => void;
  
  //   THE MASTER ATOMIC MUTATOR
  updateNodeValue: (sectionKey: keyof Omit<ResumeData, 'metadata' | 'id'>, targetId: string, newValue: string) => void;
}

// ==========================================
// 3. RECURSIVE HELPER FUNCTION
// ==========================================
// This function walks through the nested JSON tree. When it finds the matching ID, 
// it creates a safe copy and updates ONLY the value, preserving all formatting!
const recursiveUpdateNode = (nodes: AtomicNode[], targetId: string, newValue: string): AtomicNode[] => {
  return nodes.map(node => {
    // 🎯 Target Locked: Update this specific node
    if (node.id === targetId) {
      return { ...node, value: newValue };
    }
    // 🔍 Target Not Found: If this node has children, search inside them!
    if (node.children && node.children.length > 0) {
      return { ...node, children: recursiveUpdateNode(node.children, targetId, newValue) };
    }
    // Keep moving
    return node;
  });
};

// ==========================================
// 4. THE ZUSTAND STORE
// ==========================================

export const useResumeStore = create<ResumeStore>((set) => ({
  // Default Empty State (Will be overwritten by setInitialData when routing from Dashboard)
  data: {
    metadata: {
      atsScore: 0,
      theme: { primaryColor: '#0A2342', fontFamily: 'Inter', fontSize: '14px' },
    },
    personalInfo: { type: 'section', id: 'personal_info_1', children: [] },
    experience: { type: 'section', id: 'experience_section_1', children: [] },
    education: { type: 'section', id: 'education_section_1', children: [] },
  },
  isLoading: false,

  setInitialData: (data) => set({ data }),

  updateTheme: (field, value) =>
    set((state) => ({
      data: {
        ...state.data,
        metadata: {
          ...state.data.metadata,
          theme: { ...state.data.metadata.theme, [field]: value },
        },
      },
    })),

  //   THE MASTER ATOMIC MUTATOR IN ACTION
  updateNodeValue: (sectionKey, targetId, newValue) =>
    set((state) => {
      // 1. Grab the specific section (e.g., personalInfo or experience)
      const section = state.data[sectionKey];

      // 🛡️ THE GUARD: If section is undefined or null, return immediately
      if (!section) return state;
      
      // 2. Ensure it's not a flat array (like skills) and has a valid children array
      if (!Array.isArray(section) && section.children) {
        return {
          data: {
            ...state.data,
            [sectionKey]: {
              ...section,
              // Run the recursive engine on this section's children!
              children: recursiveUpdateNode(section.children, targetId, newValue)
            }
          }
        };
      }
      
      return state; // Return unchanged if structural mismatch
    }),
}));