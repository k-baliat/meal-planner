import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface SearchableOption {
  value: string;
  label: string;
}

interface SearchableDropdownProps {
  id: string;
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyOptionLabel?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * SearchableDropdown
 *
 * This component is a single-box combobox:
 * users can type to filter options, then click or scroll-select.
 */
const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  id,
  value,
  options,
  onChange,
  placeholder = 'Type to search...',
  emptyOptionLabel,
  className = '',
  disabled = false
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Build all options, including an optional "all/none" item.
  const allOptions = useMemo(() => {
    if (!emptyOptionLabel) {
      return options;
    }

    return [{ value: '', label: emptyOptionLabel }, ...options];
  }, [emptyOptionLabel, options]);

  // Keep the search input synchronized with the selected value label.
  useEffect(() => {
    if (!value) {
      setSearchQuery('');
      return;
    }

    const selected = allOptions.find((option) => option.value === value);
    setSearchQuery(selected ? selected.label : '');
  }, [allOptions, value]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return allOptions;

    return allOptions.filter((option) =>
      option.label.toLowerCase().includes(normalizedQuery)
    );
  }, [allOptions, searchQuery]);

  useEffect(() => {
    if (!isOpen) return;
    setHighlightedIndex(0);
  }, [isOpen, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextQuery = event.target.value;
    setSearchQuery(nextQuery);
    setIsOpen(true);

    // Clearing the search also clears the selected value.
    if (!nextQuery.trim()) {
      onChange('');
    }
  };

  const handleSelectOption = (option: SearchableOption) => {
    onChange(option.value);
    setSearchQuery(option.label);
    setIsOpen(false);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setIsOpen(true);
      event.preventDefault();
      return;
    }

    if (!isOpen) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) =>
        Math.min(prev + 1, Math.max(filteredOptions.length - 1, 0))
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (filteredOptions.length > 0) {
        handleSelectOption(filteredOptions[highlightedIndex] || filteredOptions[0]);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div className="searchable-dropdown-combobox" ref={wrapperRef}>
      <input
        id={id}
        type="text"
        value={searchQuery}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleInputKeyDown}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        aria-label="Search and select option"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        role="combobox"
      />
      <button
        type="button"
        className="searchable-dropdown-toggle"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-label="Toggle options"
      >
        ▾
      </button>
      {isOpen && (
        <ul className="searchable-dropdown-menu" role="listbox">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <li key={`${id}-${option.value || 'empty'}`} role="option" aria-selected={option.value === value}>
                <button
                  type="button"
                  className={`searchable-dropdown-option ${index === highlightedIndex ? 'highlighted' : ''}`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelectOption(option)}
                >
                  {option.label}
                </button>
              </li>
            ))
          ) : (
            <li className="searchable-dropdown-empty">No matching options</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default SearchableDropdown;
