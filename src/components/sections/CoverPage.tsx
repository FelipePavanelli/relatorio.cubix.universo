import React, { useEffect, useRef } from 'react';
import { Card } from '../ui/card';
import { Calendar, MapPin, User, Users, Briefcase } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatCurrency';

interface ClientData {
  nome: string;
  idade: number;
  estadoCivil: string;
  regimeCasamento: string;
  residencia: string;
  profissao?: string;
  tempoProfissao?: string;
  dependentes?: Array<{ tipo?: string; idade?: number }>;
  cep?: string;
}

interface Priority {
  item: string;
  score: number;
}

interface CoverPageProps {
  clientData: ClientData;
  date?: string;
  priorities?: Priority[];
  retirementPlan?: {
    idadePlanejada?: number;
    rendaMensalDesejada?: number;
  };
  objetivos?: Array<{ prazo?: string; descricao?: string; valor_necessario?: number }>;
}

// Componente customizado que estende o Card básico
const CardWithHighlight = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { highlight?: boolean }
>(({ className, highlight, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm p-6",
      highlight && "border-accent/50 bg-accent/5",
      className
    )}
    {...props}
  />
));
CardWithHighlight.displayName = "CardWithHighlight";

const CoverPage: React.FC<CoverPageProps> = ({ 
  clientData,
  date = new Date().toLocaleDateString('pt-BR', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }),
  priorities = [],
  retirementPlan,
  objetivos = []
}) => {
  const headerRef = useScrollAnimation();
  const cardRef1 = useScrollAnimation();
  const cardRef2 = useScrollAnimation();
  const idadePlanejada = Number(retirementPlan?.idadePlanejada) || 0;
  const rendaMensalDesejada = Number(retirementPlan?.rendaMensalDesejada) || 0;
  const prioridadesTop = priorities
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(p => p.item);
  
  return (
    <section id="cover" className="min-h-screen flex flex-col items-center justify-center py-8 px-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div 
          ref={headerRef as React.RefObject<HTMLDivElement>} 
          className="text-center mb-8 animate-on-scroll"
        >
          <div className="mb-2 inline-block">
            <div className="text-sm font-medium text-accent mb-2 tracking-wider">
              UNIVALORES
            </div>
            <h1 className="text-5xl font-bold mb-2">Planejamento Financeiro</h1>
            <p className="text-muted-foreground">
              Preparado especialmente para <span className="font-medium text-foreground">{clientData.nome}</span>
            </p>
          </div>
        </div>
        
        {/* Client Info Card */}
        <div 
          ref={cardRef1 as React.RefObject<HTMLDivElement>} 
          className="mb-6 animate-on-scroll delay-1"
        >
          <Card className="md:p-8">
            <h2 className="text-2xl font-semibold mb-4">Informações do Cliente</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <div className="mt-1 bg-accent/10 p-2 rounded-full">
                  <User size={18} className="text-accent" />
                </div>
                <div>
                  <h3 className="font-medium">Cliente</h3>
                  <p className="text-lg">{clientData.nome}</p>
                  <p className="text-sm text-muted-foreground">{clientData.idade} anos</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="mt-1 bg-accent/10 p-2 rounded-full">
                  <Users size={18} className="text-accent" />
                </div>
                <div>
                  <h3 className="font-medium">Estado Civil</h3>
                  <p className="text-lg">{clientData.estadoCivil}</p>
                  <p className="text-sm text-muted-foreground">
                    {clientData.regimeCasamento}
                  </p>
                </div>
              </div>

              {clientData.profissao && (
                <div className="flex items-start gap-3">
                  <div className="mt-1 bg-accent/10 p-2 rounded-full">
                    <Briefcase size={18} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="font-medium">Profissão</h3>
                    <p className="text-lg">{clientData.profissao}</p>
                    {clientData.tempoProfissao && (
                      <p className="text-sm text-muted-foreground">Tempo na profissão: {clientData.tempoProfissao}</p>
                    )}
                  </div>
                </div>
              )}

              {(clientData.residencia || clientData.cep) && (
                <div className="flex items-start gap-3">
                  <div className="mt-1 bg-accent/10 p-2 rounded-full">
                    <MapPin size={18} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="font-medium">Residência</h3>
                    {clientData.residencia && (
                      <p className="text-lg">{clientData.residencia}</p>
                    )}
                    {clientData.cep && (
                      <p className="text-sm text-muted-foreground">CEP: {clientData.cep}</p>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-3">
                <div className="mt-1 bg-accent/10 p-2 rounded-full">
                  <Calendar size={18} className="text-accent" />
                </div>
                <div>
                  <h3 className="font-medium">Data do relatório</h3>
                  <p className="text-lg">{date}</p>
                </div>
              </div>

              {Array.isArray(clientData.dependentes) && clientData.dependentes.length > 0 && (
                <div className="flex items-start gap-3">
                  <div className="mt-1 bg-accent/10 p-2 rounded-full">
                    <Users size={18} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="font-medium">Dependentes</h3>
                    <p className="text-lg">{clientData.dependentes.length} dependente(s)</p>
                    <p className="text-sm text-muted-foreground">
                      {clientData.dependentes
                        .map((d) => `${d?.tipo || 'Dependente'}${typeof d?.idade === 'number' ? ` (${d.idade} anos)` : ''}`)
                        .join(', ')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
        
        {/* About This Report */}
        <div 
          ref={cardRef2 as React.RefObject<HTMLDivElement>} 
          className="animate-on-scroll delay-2"
        >
          <CardWithHighlight highlight>
            <h2 className="text-2xl font-semibold mb-4">Sobre este relatório</h2>
            <p className="mb-4">
              Este documento apresenta um planejamento financeiro personalizado, elaborado 
              especificamente para suas necessidades e objetivos. Ele contempla análises, 
              projeções e recomendações para otimizar sua jornada financeira.
            </p>
            
            {/* Prioridades do Cliente */}
            {priorities.length > 0 && (
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-3">Prioridades identificadas</h3>
                <div className="space-y-2">
                  {priorities
                    .sort((a, b) => b.score - a.score) // Ordenar por prioridade (maior para menor)
                    .map((priority, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="font-medium">{priority.item}</span>
                        <span className="text-accent font-bold text-lg">{priority.score}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
            
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Contexto do planejamento</h3>
              <p className="text-sm text-muted-foreground">
                Nosso plano considera como prioridades iniciais {prioridadesTop.join(', ')}.
                Além disso, sua aposentadoria está planejada aos <span className="font-medium text-foreground">{idadePlanejada}</span> anos
                com renda pretendida de <span className="font-medium text-foreground">{formatCurrency(rendaMensalDesejada)}</span> por mês.
              </p>
            </div>

            {objetivos && objetivos.length > 0 && (
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-3">Objetivos declarados</h3>
                <div className="space-y-2">
                  {objetivos.slice(0, 3).map((obj, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <div className="font-medium">{obj.descricao || 'Objetivo'}</div>
                        {obj.prazo && (
                          <div className="text-xs text-muted-foreground">Prazo: {obj.prazo}</div>
                        )}
                      </div>
                      {typeof obj.valor_necessario === 'number' && (
                        <div className="text-accent font-bold text-lg">{formatCurrency(obj.valor_necessario)}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <p>
              Navegue pelas seções usando a barra inferior ou os botões de navegação para 
              explorar cada aspecto do seu planejamento financeiro.
            </p>
          </CardWithHighlight>
        </div>
      </div>
    </section>
  );
};

export default CoverPage;
