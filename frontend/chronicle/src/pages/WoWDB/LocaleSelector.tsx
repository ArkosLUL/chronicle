import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu/DropdownMenu";
import { Button } from "@/components/ui/button";
import { LOCALES, type LocaleIndex } from "@/api/wowdb";

interface LocaleSelectorProps {
  value: LocaleIndex;
  onChange: (locale: LocaleIndex) => void;
}

export function LocaleSelector({ value, onChange }: LocaleSelectorProps) {
  const current = LOCALES.find((l) => l.index === value) || LOCALES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Globe className="h-4 w-4 mr-2" />
          {current.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as LocaleIndex)}
        >
          {LOCALES.map((locale) => (
            <DropdownMenuRadioItem key={locale.index} value={locale.index}>
              {locale.label} ({locale.code})
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
