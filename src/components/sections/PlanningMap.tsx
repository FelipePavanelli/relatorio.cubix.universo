import React from 'react';
import { cn } from '@/lib/utils';
import { useSectionVisibility } from '@/context/SectionVisibilityContext';

interface Step {
  id: string;
  title: string;
  description?: string;
}

interface PlanningMapProps {
  className?: string;
}

const steps: Step[] = [
  { id: 'summary', title: 'Resumo Financeiro', description: 'Panorama inicial' },
  { id: 'investment-management', title: 'Gestão de Investimentos', description: 'Análise e recomendações' },
  { id: 'retirement', title: 'Aposentadoria', description: 'Projeções e metas' },
  { id: 'beach-house', title: 'Aquisição de Bens', description: 'Planejamento de aquisição' },
  { id: 'protection', title: 'Proteção', description: 'Seguros e blindagem' },
  { id: 'succession', title: 'Sucessão', description: 'Estrutura patrimonial' },
  { id: 'tax', title: 'Tributação', description: 'Eficiência fiscal' },
  { id: 'action-plan', title: 'Plano de Ação', description: 'Próximos passos' },
];

const PlanningMap: React.FC<PlanningMapProps> = ({ className }) => {
  const { isSectionVisible } = useSectionVisibility();
  const visibleSteps = steps.filter(s => isSectionVisible(s.id));
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className={cn('rounded-xl border border-border/50 bg-gradient-to-br from-muted/5 to-muted/10 p-6 md:p-8 shadow-sm', className)}>
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Mapa do Planejamento</h2>
          <p className="text-sm md:text-base text-muted-foreground">Como conduziremos a apresentação do relatório:</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {visibleSteps.map((s, idx) => (
            <a 
              key={s.id} 
              href={`#${s.id}`}
              className="group relative flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 md:p-5 hover:border-accent/50 hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
            >
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 text-accent flex items-center justify-center text-base font-bold border border-accent/20 group-hover:from-accent group-hover:to-accent/80 group-hover:text-white transition-all duration-200">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors leading-snug">
                    {s.title}
                  </h3>
                  {s.description && (
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {s.description}
                    </p>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlanningMap;
