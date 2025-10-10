import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useSpouseInclusion } from '@/context/SpouseInclusionContext';
import { Sun, Moon, Users } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  const { theme, toggleTheme } = useTheme();
  const { includeSpouse, setIncludeSpouse } = useSpouseInclusion();

  return (
    <header className="w-full py-3 animate-fade-in border-b">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-4">
          {theme === 'light' ? (
            <img 
              src="/logo-light.png" 
              alt="Logo" 
              width={80} 
              height={24} 
              className="h-6 w-auto object-contain"
            />
          ) : (
            <img 
              src="/logo-dark.png" 
              alt="Logo" 
              width={80} 
              height={24} 
              className="h-6 w-auto object-contain"
            />
          )}
          {title && (
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {/* Toggle Global - Incluir Cônjuge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card/50">
            <Users className="h-4 w-4 text-accent" />
            <Label htmlFor="global-spouse-toggle" className="text-xs font-medium cursor-pointer whitespace-nowrap">
              Incluir cônjuge
            </Label>
            <Switch
              id="global-spouse-toggle"
              checked={includeSpouse}
              onCheckedChange={setIncludeSpouse}
            />
          </div>
          
          {/* Toggle de Tema */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
