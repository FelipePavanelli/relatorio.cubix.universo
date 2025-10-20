import React from 'react';
import { useSectionVisibility } from '@/context/SectionVisibilityContext';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';

interface HideableSectionProps {
  sectionId: string;
  children: React.ReactNode;
  className?: string;
  hideControls?: boolean;
}

const HideableSection: React.FC<HideableSectionProps> = ({
  sectionId,
  children,
  className,
  hideControls = false,
}) => {
  const { isSectionVisible, toggleSectionVisibility } = useSectionVisibility();
  const isVisible = isSectionVisible(sectionId);

  // Se os controles estão ocultos e a seção não está visível, não renderiza nada
  if (hideControls && !isVisible) {
    return null;
  }

  // Para o assessor (hideControls === false), quando a seção estiver oculta
  // mantemos o bloco no layout com um efeito de desfoque e uma tarja informativa.

  // Se a seção está visível, renderiza normalmente com botão de alternância (quando permitido)
  return (
    <div id={sectionId} className={cn("min-h-screen relative print-section", !isVisible && !hideControls && "section-collapsed", className)}>
      {!hideControls && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSectionVisibility(sectionId); }}
            className={cn(
              "no-print inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium shadow-sm transition-colors",
              "bg-accent/10 border-accent/40 text-accent hover:bg-accent/20"
            )}
            aria-label={isVisible ? "Ocultar seção inteira" : "Mostrar seção"}
            title={isVisible ? "Ocultar seção inteira" : "Mostrar seção"}
          >
            {isVisible ? (
              <Eye size={16} className="" />
            ) : (
              <EyeOff size={16} className="" />
            )}
            <span>Seção</span>
          </button>
        </div>
      )}
      {(isVisible || hideControls) && (
        <div className={cn("transition-all")}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default HideableSection; 