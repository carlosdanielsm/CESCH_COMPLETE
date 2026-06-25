"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X } from "lucide-react"

interface Filter {
  key: string
  label: string
  options: { value: string; label: string }[]
}

interface FilterBarProps {
  filters: Filter[]
  activeFilters: Record<string, string>
  onFilterChange: (key: string, value: string) => void
  onClearFilters: () => void
}

export function FilterBar({ filters, activeFilters, onFilterChange, onClearFilters }: FilterBarProps) {
  const hasActiveFilters = Object.keys(activeFilters).length > 0

  return (
    <div className="flex flex-wrap items-center gap-3">
      {filters.map((filter) => (
        <Select
          key={filter.key}
          value={activeFilters[filter.key] || ""}
          onValueChange={(value) => onFilterChange(filter.key, value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent>
            {filter.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          <X className="mr-2 h-4 w-4" />
          Limpiar filtros
        </Button>
      )}
    </div>
  )
}
