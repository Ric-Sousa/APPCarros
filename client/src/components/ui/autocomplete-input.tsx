import { useState, useRef, useEffect, useId } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Search, Lightbulb } from 'lucide-react';
import { useAutocomplete, type AutocompleteResult } from '@/hooks/useVehicleSpecs';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Valor final escolhido: sugestão, recomendação ou ao sair do campo (não a cada tecla). */
  onCommit?: (value: string) => void;
  type: 'oil' | 'tire';
  placeholder: string;
  label?: string;
  recommendations?: string[];
  disabled?: boolean;
  className?: string;
}

export function AutocompleteInput({
  value,
  onChange,
  onCommit,
  type,
  placeholder,
  label,
  recommendations = [],
  disabled,
  className,
}: AutocompleteInputProps) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const { suggestions, loading } = useAutocomplete(value, type);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const committed = useRef(value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const commit = (v: string) => {
    if (v === committed.current) return;
    committed.current = v;
    onCommit?.(v);
  };

  const choose = (v: string) => {
    onChange(v);
    commit(v);
    setIsOpen(false);
  };

  const showDropdown = isOpen && (suggestions.length > 0 || loading);

  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
          {recommendations.length > 0 && (
            <div className="flex items-center gap-1">
              <Lightbulb className="h-3 w-3 text-amber-500" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">Recomendado:</span>
            </div>
          )}
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {recommendations.slice(0, 4).map((rec) => (
            <button key={rec} type="button" onClick={() => choose(rec)}>
              <Badge variant="secondary" className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs">
                {rec}
              </Badge>
            </button>
          ))}
        </div>
      )}

      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" aria-hidden="true" />
          <Input
            id={id}
            ref={inputRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setIsOpen(e.target.value.length >= 2);
            }}
            onFocus={() => setIsOpen(value.length >= 2)}
            onBlur={() => commit(value)}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            className="pl-10 pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Fechar sugestões' : 'Mostrar sugestões'}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </Button>
        </div>

        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-auto" role="listbox">
            {loading ? (
              <div className="p-3 text-center text-muted-foreground text-sm" role="status">
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                A procurar...
              </div>
            ) : (
              suggestions.map((s: AutocompleteResult) => (
                <button
                  key={s.value}
                  type="button"
                  role="option"
                  aria-selected={s.value === value}
                  className="w-full p-2 hover:bg-accent text-left flex items-center justify-between"
                  // mousedown evita que o blur do input feche a lista antes do clique
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(s.value)}
                >
                  <span className="text-sm">{s.label}</span>
                  <Badge variant="outline" className="text-xs">{s.category === 'oil' ? 'Óleo' : 'Pneu'}</Badge>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
