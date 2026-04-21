import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { toggleTheme, useTheme } from "@/lib/session";

export function ThemeToggle() {
  const isDark = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      data-testid="button-theme-toggle"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
