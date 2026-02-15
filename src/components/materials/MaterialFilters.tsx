import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Filter, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface MaterialFiltersProps {
  filters: {
    brands: string[];
    colors: string[];
    minPrice: string;
    maxPrice: string;
    stockStatus: string[];
  };
  onFiltersChange: (filters: any) => void;
  materials: any[];
}

export const MaterialFilters = ({ filters, onFiltersChange, materials }: MaterialFiltersProps) => {
  const uniqueBrands = Array.from(new Set(materials.map(m => m.brand).filter(Boolean)));
  const uniqueColors = Array.from(new Set(materials.map(m => m.color).filter(Boolean)));

  const hasActiveFilters = 
    filters.brands.length > 0 || 
    filters.colors.length > 0 || 
    filters.minPrice || 
    filters.maxPrice || 
    filters.stockStatus.length > 0;

  const clearFilters = () => {
    onFiltersChange({
      brands: [],
      colors: [],
      minPrice: "",
      maxPrice: "",
      stockStatus: []
    });
  };

  const activeFilterCount = 
    filters.brands.length + 
    filters.colors.length + 
    filters.stockStatus.length +
    (filters.minPrice ? 1 : 0) +
    (filters.maxPrice ? 1 : 0);

  return (
    <div className="flex gap-2 flex-wrap">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {activeFilterCount > 0 && (
              <Badge className="ml-2" variant="secondary">{activeFilterCount}</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Faixa de Preço</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Mín"
                  value={filters.minPrice}
                  onChange={(e) => onFiltersChange({ ...filters, minPrice: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Máx"
                  value={filters.maxPrice}
                  onChange={(e) => onFiltersChange({ ...filters, maxPrice: e.target.value })}
                />
              </div>
            </div>

            {uniqueBrands.length > 0 && (
              <div className="space-y-2">
                <Label>Marcas</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {uniqueBrands.map((brand) => (
                    <div key={brand} className="flex items-center space-x-2">
                      <Checkbox
                        id={`brand-${brand}`}
                        checked={filters.brands.includes(brand)}
                        onCheckedChange={(checked) => {
                          onFiltersChange({
                            ...filters,
                            brands: checked
                              ? [...filters.brands, brand]
                              : filters.brands.filter((b) => b !== brand)
                          });
                        }}
                      />
                      <Label htmlFor={`brand-${brand}`} className="cursor-pointer">
                        {brand}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uniqueColors.length > 0 && (
              <div className="space-y-2">
                <Label>Cores</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {uniqueColors.map((color) => (
                    <div key={color} className="flex items-center space-x-2">
                      <Checkbox
                        id={`color-${color}`}
                        checked={filters.colors.includes(color)}
                        onCheckedChange={(checked) => {
                          onFiltersChange({
                            ...filters,
                            colors: checked
                              ? [...filters.colors, color]
                              : filters.colors.filter((c) => c !== color)
                          });
                        }}
                      />
                      <Label htmlFor={`color-${color}`} className="cursor-pointer">
                        {color}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Status de Estoque</Label>
              <div className="space-y-2">
                {[
                  { value: 'low', label: 'Estoque Baixo' },
                  { value: 'out', label: 'Sem Estoque' },
                  { value: 'normal', label: 'Normal' }
                ].map((status) => (
                  <div key={status.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${status.value}`}
                      checked={filters.stockStatus.includes(status.value)}
                      onCheckedChange={(checked) => {
                        onFiltersChange({
                          ...filters,
                          stockStatus: checked
                            ? [...filters.stockStatus, status.value]
                            : filters.stockStatus.filter((s) => s !== status.value)
                        });
                      }}
                    />
                    <Label htmlFor={`status-${status.value}`} className="cursor-pointer">
                      {status.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-2" />
          Limpar Filtros
        </Button>
      )}
    </div>
  );
};
