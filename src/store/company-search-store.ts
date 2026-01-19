import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ApolloCompany {
  id: string;
  organization_id?: string;
  name: string;
  domain?: string;
  primary_domain?: string;
  website_url?: string;
  industry?: string;
  city?: string;
  state?: string;
  country?: string;
  employee_count?: number;
}

interface SearchFilters {
  locations: string;
  employeeCountMin: string;
  employeeCountMax: string;
  industries: string;
  keywords: string;
}

interface PaginationState {
  total_entries?: number;
  total_pages?: number;
  page?: number;
  per_page?: number;
}

interface CompanySearchState {
  // Persisted state
  filters: SearchFilters;
  companies: ApolloCompany[];
  currentPage: number;
  pagination: PaginationState | null;
  generatedCompanyIds: string[];

  // Transient state (not persisted)
  selectedCompanies: Set<string>;
  isSearching: boolean;
  error: string | null;
  isHydrated: boolean;
}

interface CompanySearchActions {
  // Filter actions
  setFilters: (filters: Partial<SearchFilters>) => void;
  resetFilters: () => void;

  // Search actions
  setSearchResults: (companies: ApolloCompany[], pagination: PaginationState | null) => void;
  setCurrentPage: (page: number) => void;
  setIsSearching: (isSearching: boolean) => void;
  setError: (error: string | null) => void;

  // Selection actions (transient)
  toggleCompany: (id: string) => void;
  selectAll: (companyIds: string[]) => void;
  clearSelection: () => void;

  // Generated companies tracking
  markCompaniesAsGenerated: (organizationIds: string[]) => void;

  // Computed
  getDisplayableCompanies: () => ApolloCompany[];

  // Hydration
  setHydrated: () => void;

  // Reset
  clearSearchState: () => void;
}

type CompanySearchStore = CompanySearchState & CompanySearchActions;

const initialFilters: SearchFilters = {
  locations: '',
  employeeCountMin: '',
  employeeCountMax: '',
  industries: '',
  keywords: '',
};

const initialState: Omit<CompanySearchState, 'selectedCompanies' | 'isHydrated'> = {
  filters: initialFilters,
  companies: [],
  currentPage: 1,
  pagination: null,
  generatedCompanyIds: [],
  isSearching: false,
  error: null,
};

export const useCompanySearchStore = create<CompanySearchStore>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialState,
      selectedCompanies: new Set(),
      isHydrated: false,

      // Filter actions
      setFilters: (newFilters) => set((state) => ({
        filters: { ...state.filters, ...newFilters }
      })),

      resetFilters: () => set({
        filters: initialFilters
      }),

      // Search actions
      setSearchResults: (companies, pagination) => set({
        companies,
        pagination,
        error: null,
      }),

      setCurrentPage: (page) => set({ currentPage: page }),
      setIsSearching: (isSearching) => set({ isSearching }),
      setError: (error) => set({ error }),

      // Selection (transient)
      toggleCompany: (id) => set((state) => {
        const newSelected = new Set(state.selectedCompanies);
        if (newSelected.has(id)) {
          newSelected.delete(id);
        } else {
          newSelected.add(id);
        }
        return { selectedCompanies: newSelected };
      }),

      selectAll: (companyIds) => set({
        selectedCompanies: new Set(companyIds)
      }),

      clearSelection: () => set({ selectedCompanies: new Set() }),

      // Generated tracking
      markCompaniesAsGenerated: (orgIds) => set((state) => {
        const newGenerated = new Set(state.generatedCompanyIds);
        orgIds.forEach(id => newGenerated.add(id));
        return {
          generatedCompanyIds: Array.from(newGenerated),
          selectedCompanies: new Set(),
        };
      }),

      // Computed - filter out generated companies
      getDisplayableCompanies: () => {
        const { companies, generatedCompanyIds } = get();
        const generatedSet = new Set(generatedCompanyIds);
        return companies.filter(company => {
          const orgId = company.organization_id || company.id;
          return !generatedSet.has(orgId);
        });
      },

      // Hydration
      setHydrated: () => set({ isHydrated: true }),

      // Reset (preserves generated IDs)
      clearSearchState: () => set((state) => ({
        ...initialState,
        generatedCompanyIds: state.generatedCompanyIds,
        selectedCompanies: new Set(),
      })),
    }),
    {
      name: 'company-search-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist these fields
        filters: state.filters,
        companies: state.companies,
        currentPage: state.currentPage,
        pagination: state.pagination,
        generatedCompanyIds: state.generatedCompanyIds,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
