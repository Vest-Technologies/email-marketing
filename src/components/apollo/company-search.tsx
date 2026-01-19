"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Building2,
  MapPin,
  Users,
  Globe,
  Loader2,
  ChevronRight,
  CheckCircle2,
  Filter,
  AlertCircle,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { useCompanySearchStore, ApolloCompany } from "@/store/company-search-store";

interface CompanySearchProps {
  onImport: (companies: ApolloCompany[]) => Promise<void>;
}

export function CompanySearch({ onImport }: CompanySearchProps) {
  // Zustand store for persistent state
  const {
    filters,
    setFilters,
    currentPage,
    setCurrentPage,
    pagination,
    selectedCompanies,
    toggleCompany,
    selectAll,
    clearSelection,
    isSearching,
    setIsSearching,
    error,
    setError,
    setSearchResults,
    getDisplayableCompanies,
    markCompaniesAsGenerated,
    isHydrated,
  } = useCompanySearchStore();

  // Local transient state
  const [isImporting, setIsImporting] = useState(false);

  // Get displayable companies (filters out generated ones)
  const displayableCompanies = getDisplayableCompanies();

  const handleSearch = async (page: number = 1) => {
    setIsSearching(true);
    setError(null);
    try {
      const response = await fetch("/api/companies/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
          filters: {
            locations: filters.locations?.trim() 
              ? filters.locations.split(",").map(s => s.trim()).filter(s => s.length > 0)
              : undefined,
            employeeCountMin: filters.employeeCountMin?.trim() 
              ? parseInt(filters.employeeCountMin) 
              : undefined,
            employeeCountMax: filters.employeeCountMax?.trim() 
              ? parseInt(filters.employeeCountMax) 
              : undefined,
            industries: filters.industries?.trim() 
              ? filters.industries.split(",").map(s => s.trim()).filter(s => s.length > 0)
              : undefined,
            keywords: filters.keywords?.trim() 
              ? filters.keywords.split(",").map(s => s.trim()).filter(s => s.length > 0)
              : undefined,
          },
          page,
          perPage: 50,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || "Search failed");
        setSearchResults([], null);
        return;
      }

      setSearchResults(data.companies || [], data.pagination || null);
      setCurrentPage(data.pagination?.page || page);
      clearSelection();
    } catch (err) {
      console.error("Search failed:", err);
      setError("Network error - please try again");
    } finally {
      setIsSearching(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || (pagination && pagination.total_pages && newPage > pagination.total_pages)) {
      return;
    }
    handleSearch(newPage);
  };

  const toggleAll = () => {
    if (selectedCompanies.size === displayableCompanies.length) {
      clearSelection();
    } else {
      selectAll(displayableCompanies.map(c => c.id));
    }
  };

  const handleImport = async () => {
    const selected = displayableCompanies.filter(c => selectedCompanies.has(c.id));
    if (selected.length === 0) return;

    setIsImporting(true);
    try {
      // Track generated companies before import
      const orgIds = selected.map(c => c.organization_id || c.id);
      markCompaniesAsGenerated(orgIds);

      await onImport(selected);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Filter className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Apollo Search Filters</CardTitle>
              <CardDescription>Configure filters to find target companies</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="locations">Locations</Label>
              <Input
                id="locations"
                value={filters.locations}
                onChange={(e) => setFilters({ locations: e.target.value })}
                placeholder="e.g., Turkey, Istanbul"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="employeeMin">Min Employees</Label>
              <Input
                id="employeeMin"
                type="number"
                value={filters.employeeCountMin}
                onChange={(e) => setFilters({ employeeCountMin: e.target.value })}
                placeholder="e.g., 50"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="employeeMax">Max Employees</Label>
              <Input
                id="employeeMax"
                type="number"
                value={filters.employeeCountMax}
                onChange={(e) => setFilters({ employeeCountMax: e.target.value })}
                placeholder="e.g., 500"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="industries">Industries</Label>
              <Input
                id="industries"
                value={filters.industries}
                onChange={(e) => setFilters({ industries: e.target.value })}
                placeholder="e.g., Technology, SaaS"
              />
            </div>
            
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="keywords">Keywords</Label>
              <Input
                id="keywords"
                value={filters.keywords}
                onChange={(e) => setFilters({ keywords: e.target.value })}
                placeholder="e.g., AI, machine learning, automation"
              />
            </div>
          </div>

          <Button onClick={() => handleSearch(1)} disabled={isSearching} className="w-full md:w-auto">
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search Companies
          </Button>
          
          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {isHydrated && displayableCompanies.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg">Search Results</CardTitle>
                <Badge variant="secondary">
                  {displayableCompanies.length} of {pagination?.total_entries || displayableCompanies.length} companies
                </Badge>
                {pagination && pagination.total_pages && pagination.total_pages > 1 && (
                  <Badge variant="outline">
                    Page {pagination.page || 1} / {pagination.total_pages}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selectedCompanies.size === displayableCompanies.length ? "Deselect All" : "Select All"}
                </Button>
                <Button
                  size="sm"
                  onClick={handleImport}
                  disabled={selectedCompanies.size === 0 || isImporting}
                >
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {isImporting ? "Generating..." : `Generate ${selectedCompanies.size} Selected`}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {displayableCompanies.map((company) => (
                  <div
                    key={company.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer ${
                      selectedCompanies.has(company.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                    onClick={() => toggleCompany(company.id)}
                  >
                    <Checkbox
                      checked={selectedCompanies.has(company.id)}
                      onCheckedChange={() => toggleCompany(company.id)}
                    />
                    
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{company.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-3 mt-0.5">
                        {company.domain && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {company.domain}
                          </span>
                        )}
                        {company.industry && (
                          <span>{company.industry}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {company.city && company.state && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {company.city}, {company.state}
                        </span>
                      )}
                      {company.employee_count && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {company.employee_count.toLocaleString()}
                        </span>
                      )}
                    </div>
                    
                    {selectedCompanies.has(company.id) && (
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            {/* Pagination Controls */}
            {pagination && pagination.total_pages && pagination.total_pages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing page {pagination.page || currentPage} of {pagination.total_pages}
                  {pagination.total_entries && (
                    <span className="ml-2">
                      ({pagination.total_entries.toLocaleString()} total companies)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1 || isSearching}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || isSearching}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1 px-2">
                    <span className="text-sm font-medium">{currentPage}</span>
                    <span className="text-sm text-muted-foreground">/</span>
                    <span className="text-sm text-muted-foreground">{pagination.total_pages}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= (pagination.total_pages || 1) || isSearching}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.total_pages || 1)}
                    disabled={currentPage >= (pagination.total_pages || 1) || isSearching}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
