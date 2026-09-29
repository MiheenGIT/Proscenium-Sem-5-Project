import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

/**
 * CustomSelect - Luxury Obsidian & Gold themed dropdown
 * Replaces native browser <select> elements with an accessible, styled dropdown.
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select an option",
  disabled = false,
  className = "",
  menuClassName = "",
  size = "md",
  align = "left",
  icon = null,
  name,
  id,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Normalize options array into { value, label, icon, description } objects
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === "object" && opt !== null) {
      return {
        value: opt.value,
        label: opt.label !== undefined ? opt.label : opt.value,
        icon: opt.icon || null,
        description: opt.description || null,
      };
    }
    return {
      value: opt,
      label: String(opt),
      icon: null,
      description: null,
    };
  });

  // Find currently selected option
  const selectedOption = normalizedOptions.find(
    (opt) => String(opt.value) === String(value)
  );

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  function handleKeyDown(event) {
    if (disabled) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = normalizedOptions.findIndex(
          (opt) => String(opt.value) === String(value)
        );
        const nextIndex =
          currentIndex < normalizedOptions.length - 1 ? currentIndex + 1 : 0;
        selectOption(normalizedOptions[nextIndex].value);
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = normalizedOptions.findIndex(
          (opt) => String(opt.value) === String(value)
        );
        const prevIndex =
          currentIndex > 0 ? currentIndex - 1 : normalizedOptions.length - 1;
        selectOption(normalizedOptions[prevIndex].value);
      }
    }
  }

  function selectOption(optValue) {
    if (onChange) {
      onChange(optValue);
    }
    setIsOpen(false);
  }

  // Size styling variants
  const sizeStyles = {
    sm: "px-2.5 py-1 text-[11px] gap-1.5 rounded-lg",
    md: "px-3 py-1.5 text-xs gap-2 rounded-xl",
    lg: "px-4 py-2.5 text-xs sm:text-sm gap-2.5 rounded-xl",
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left ${className}`}
      id={id}
    >
      {/* Hidden input for form integrations */}
      {name && <input type="hidden" name={name} value={value || ""} />}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`group relative flex w-full items-center justify-between border bg-[#140f14] font-[var(--font-mono)] text-[#efe7da] outline-none transition-all duration-150 select-none ${
          sizeStyles[size] || sizeStyles.md
        } ${
          isOpen
            ? "border-[#d9a653]/60 bg-[#191319] shadow-[0_0_12px_rgba(217,166,83,0.12)] text-[#e6c184]"
            : "border-white/[0.09] hover:border-white/20 hover:bg-[#181318]"
        } ${
          disabled
            ? "cursor-not-allowed opacity-50 hover:border-white/[0.09] hover:bg-[#140f14]"
            : "cursor-pointer"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2 pr-1">
          {icon && (
            <span className="shrink-0 text-[#756a6f] group-hover:text-[#d9a653] transition-colors">
              {icon}
            </span>
          )}
          {selectedOption?.icon && (
            <span className="shrink-0">{selectedOption.icon}</span>
          )}
          <span className="truncate font-medium">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown
          size={size === "sm" ? 12 : 14}
          className={`shrink-0 text-[#756a6f] transition-transform duration-200 ease-out group-hover:text-[#d9a653] ${
            isOpen ? "rotate-180 text-[#d9a653]" : "rotate-0"
          }`}
        />
      </button>

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className={`absolute z-[100] mt-1.5 max-h-64 min-w-full overflow-y-auto rounded-xl border border-white/[0.12] bg-[#171217]/98 p-1 shadow-[0_16px_40px_rgba(0,0,0,0.85)] backdrop-blur-md outline-none transition-all [scrollbar-width:thin] [scrollbar-color:rgba(217,166,83,0.25)_transparent] ${
            align === "right" ? "right-0" : "left-0"
          } ${menuClassName}`}
          style={{ minWidth: "max-content" }}
        >
          {normalizedOptions.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => selectOption(opt.value)}
                className={`group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left font-[var(--font-mono)] text-xs transition-colors select-none ${
                  isSelected
                    ? "bg-[#d9a653]/15 text-[#e6c184] font-medium"
                    : "text-[#c2b6b9] hover:bg-white/[0.06] hover:text-[#efe7da]"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                  <div className="truncate">
                    <div className="truncate">{opt.label}</div>
                    {opt.description && (
                      <div className="text-[10px] text-[#756a6f]">
                        {opt.description}
                      </div>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <Check
                    size={13}
                    className="shrink-0 text-[#d9a653] animate-in fade-in zoom-in-75 duration-150"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
