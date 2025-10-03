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
    <div className="max-w-4xl mx-auto">
      <div className={cn('rounded-lg border border-border/50 bg-muted/5 p-4 md:p-6', className)}>
        <h2 className="card-title-standard text-lg mb-3">Mapa do Planejamento</h2>
        <p className="text-sm text-muted-foreground mb-6">Como conduziremos a apresentação do relatório:</p>
        <ol className="relative grid md:grid-cols-3 gap-6">
        {visibleSteps.map((s, idx) => (
          <li key={s.id} className="flex items-start gap-3 rounded-md border border-border/40 bg-card/60 p-3 hover:bg-card/80 transition-colors">
            <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-accent/10 text-accent flex items-center justify-center text-sm font-semibold">
              {idx + 1}
            </div>
            <div className="min-w-0 flex-1">
              <a href={`#${s.id}`} className="font-medium text-foreground hover:underline break-words block">
                {s.title}
              </a>
              {s.description && (
                <div className="text-xs text-muted-foreground mt-1 break-words">{s.description}</div>
              )}
            </div>
          </li>
        ))}
        </ol>
      </div>
    </div>
  );
};

export default PlanningMap;
