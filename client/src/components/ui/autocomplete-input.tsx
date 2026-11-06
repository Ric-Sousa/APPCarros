import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Search, Lightbulb } from 'lucide-react';
import { useAutocomplete, type AutocompleteResult } from '@/hooks/useVehicleSpecs';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  type: 'oil' | 'tire';
  placeholder: string;
  label?: string;
  recommendations?: string[];
  onRecommendationSelect?: (recommendation: string) => void;
  disabled?: boolean;
  className?: string;
}

export function AutocompleteInput({
  value,
  onChange,
  type,
  placeholder,
  label,
  recommendations = [],
  onRecommendationSelect,
  disabled,
  className
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const { suggestions, loading } = useAutocomplete(inputValue, type);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    onChange(newValue);
    setIsOpen(newValue.length >= 2);
  };

  const handleSuggestionSelect = (suggestion: AutocompleteResult) => {
    setInputValue(suggestion.value);
    onChange(suggestion.value);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleRecommendationSelect = (recommendation: string) => {
    setInputValue(recommendation);
    onChange(recommendation);
    onRecommendationSelect?.(recommendation);
    inputRef.current?.focus();
  };

  const showDropdown = isOpen && (suggestions.length > 0 || loading);

  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-foreground">{label}</label>
          {recommendations.length > 0 && (
            <div className="flex items-center gap-1">
              <Lightbulb className="h-3 w-3 text-amber-500" />
              <span className="text-xs text-muted-foreground">Recomendado:</span>
            </div>
          )}
        </div>
      )}
      
      {/* Recomendações */}
      {recommendations.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {recommendations.slice(0, 4).map((rec, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs"
              onClick={() => handleRecommendationSelect(rec)}
            >
              {rec}
            </Badge>
          ))}
        </div>
      )}
      
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setIsOpen(inputValue.length >= 2)}
            placeholder={placeholder}
            disabled={disabled}
            className="pl-10 pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            onClick={() => setIsOpen(!isOpen)}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {/* Dropdown de sugestões */}
        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-auto">
            {loading ? (
              <div className="p-3 text-center text-muted-foreground text-sm">
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                Procurando...
              </div>
            ) : (
              <>
                {suggestions.length > 0 ? (
                  suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="p-2 hover:bg-accent cursor-pointer flex items-center justify-between"
                      onClick={() => handleSuggestionSelect(suggestion)}
                    >
                      <span className="text-sm">{suggestion.label}</span>
                      <Badge variant="outline" className="text-xs">
                        {suggestion.category === 'oil' ? '🛢️ Óleo' : '🛞 Pneu'}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-center text-muted-foreground text-sm">
                    Nenhuma sugestão encontrada
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
