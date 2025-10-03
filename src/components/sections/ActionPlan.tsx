import React, { useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Clock,
  ListChecks,
  User,
  Building2
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '../ui/card';
import StatusChip from '@/components/ui/StatusChip';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ActionPlanProps {
  data: any;
  hideControls?: boolean;
}

// Componente customizado que estende o Card básico
const CardWithHighlight = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { highlight?: boolean }
>(({ className, highlight, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      highlight && "border-accent/50 bg-accent/5",
      className
    )}
    {...props}
  />
));
CardWithHighlight.displayName = "CardWithHighlight";

const ActionPlan: React.FC<ActionPlanProps> = ({ data, hideControls }) => {
  const titleRef = useScrollAnimation<HTMLDivElement>();
  const timelineRef = useScrollAnimation<HTMLDivElement>({ threshold: 0.2 });
  const priorityRef = useScrollAnimation<HTMLDivElement>({ threshold: 0.2 });
  const nextStepsRef = useScrollAnimation<HTMLDivElement>({ threshold: 0.2 });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Alta':
        return 'bg-financial-danger/20 text-financial-danger';
      case 'Média':
        return 'bg-financial-warning/20 text-financial-warning';
      case 'Baixa':
        return 'bg-financial-success/20 text-financial-success';
      default:
        return 'bg-financial-info/20 text-financial-info';
    }
  };

  if (!data || !data.planoAcao) {
    console.error('Dados do plano de ação não disponíveis:', data);
    return <div className="py-12 px-4 text-center">Dados do plano de ação não disponíveis</div>;
  }

  // Mapear próximos passos usando os dados do JSON
  const cronogramaInicial = [
    {
      titulo: "Sucessório e Tributário",
      descricao: "Planejamento sucessório e otimização tributária",
      icone: "⚖️",
      cor: "bg-orange-500/10 text-orange-600 border-orange-200",
      acoes: [
        "Elaboração de testamento",
        "Estruturação de doações em vida",
        "Otimização tributária",
        "Proteção sucessória"
      ]
    },
    {
      titulo: "Diagnóstico de Alocação",
      descricao: "Análise e reestruturação da alocação de investimentos",
      icone: "📊",
      cor: "bg-blue-500/10 text-blue-600 border-blue-200",
      acoes: [
        "Análise da carteira atual",
        "Definição de nova alocação estratégica",
        "Implementação das mudanças",
        "Monitoramento contínuo"
      ]
    },
    {
      titulo: "Projetos Imobilizados",
      descricao: "Estruturação e otimização de investimentos em imóveis",
      icone: "🏠",
      cor: "bg-blue-500/10 text-blue-600 border-blue-200",
      acoes: [
        "Análise da carteira imobiliária atual",
        "Identificação de oportunidades de otimização",
        "Estruturação de novos investimentos",
        "Monitoramento de performance"
      ]
    },
    {
      titulo: "Internacional",
      descricao: "Planejamento e estruturação para atuação e proteção internacional",
      icone: "🌍",
      cor: "bg-cyan-500/10 text-cyan-600 border-cyan-200",
      acoes: [
        "Abertura de conta internacional",
        "Planejamento cambial e remessas",
        "Investimentos e estrutura patrimonial no exterior",
        "Seguro viagem e cobertura de saúde internacional"
      ]
    },
    {
      titulo: "Proteção Patrimonial",
      descricao: "Implementação de estratégias para proteção do patrimônio",
      icone: "🛡️",
      cor: "bg-green-500/10 text-green-600 border-green-200",
      acoes: [
        "Constituição de holding patrimonial",
        "Estruturação de proteções jurídicas",
        "Implementação de seguros adequados",
        "Revisão de estruturas societárias"
      ]
    },
    {
      titulo: "Corporate (Soluções PJ)",
      descricao: "Soluções para PJ: estrutura, caixa, investimentos e proteção",
      icone: "🏢",
      cor: "bg-amber-500/10 text-amber-600 border-amber-200",
      acoes: [
        "Diagnóstico societário e fiscal",
        "Gestão de caixa e aplicações da PJ",
        "Benefícios, previdência e planos para colaboradores",
        "Proteções corporativas (D&O, riscos e compliance)"
      ]
    }
  ];

  // Estado local para permitir reordenação de cards (não persistido)
  const [cronograma, setCronograma] = useState(cronogramaInicial);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (toIndex: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (isNaN(fromIndex) || fromIndex === toIndex) {
      setDragIndex(null);
      return;
    }
    setCronograma(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
    setDragIndex(null);
  };

  // Verifica se o cliente precisa de uma holding familiar
  const precisaHolding = () => {
    // Verifica se a estruturação patrimonial inclui "Holding Familiar"
    return data.tributario?.estruturacaoPatrimonial?.includes("Holding Familiar") || false;
  };

  // Ações prioritárias dinâmicas
  const getAcoesPrioritarias = () => {
    const acoes = [];

    // Adiciona a ação de Holding Familiar apenas se necessário
    if (precisaHolding()) {
      acoes.push({
        titulo: "Holding Familiar",
        descricao: "Constituição de holding patrimonial para proteção de bens e otimização fiscal",
        prioridade: "Alta",
        prazo: data.planoAcao.cronograma?.[2]?.prazo || "90 dias",
        responsavel: "Advogado societário",
        passos: [
          "Análise da estrutura patrimonial atual",
          "Definição do tipo societário",
          "Elaboração de contrato/estatuto social",
          "Integralização dos bens imóveis"
        ],
        impacto: "Redução de até 50% em impostos sucessórios",
        status: "Não iniciado"
      });
    }

    // Adiciona as outras ações prioritárias
    acoes.push({
      titulo: "Planejamento Sucessório",
      descricao: "Estruturação de instrumentos jurídicos para proteção sucessória",
      prioridade: "Alta",
      prazo: data.planoAcao.cronograma?.[2]?.prazo || "120 dias",
      responsavel: "Advogado especialista",
      passos: [
        "Elaboração de testamento",
        "Estruturação de doações em vida",
        "Definição de beneficiários de previdência",
        "Criação de mandato duradouro"
      ],
      impacto: "Segurança jurídica e financeira para a família",
      status: "Não iniciado"
    });

    acoes.push({
      titulo: "Consórcio do Imóvel Desejado",
      descricao: data.imovelDesejado?.estrategiaRecomendada === "Consórcio" ?
        `Contratação de consórcio para aquisição da casa de praia no valor de ${data.imovelDesejado?.objetivo?.valorImovel ?
          'R$ ' + data.imovelDesejado.objetivo.valorImovel.toLocaleString('pt-BR') : 'R$ 1.000.000'}` :
        "Contratação de consórcio para aquisição da casa de praia",
      prioridade: "Média",
      prazo: data.planoAcao.cronograma?.[3]?.prazo || "30 dias",
      responsavel: "Assessor de Investimentos",
      passos: [
        "Pesquisa das melhores administradoras",
        "Análise das condições contratuais",
        "Definição do valor da carta",
        "Contratação e início dos pagamentos"
      ],
      impacto: `Aquisição do imóvel em até ${data.imovelDesejado?.objetivo?.prazoDesejado || "5 anos"}`,
      status: "Em progresso"
    });

    acoes.push({
      titulo: "Diversificação de Investimentos",
      descricao: "Reestruturação da carteira para maior diversificação e proteção",
      prioridade: "Média",
      prazo: data.planoAcao.cronograma?.[1]?.prazo || "60 dias",
      responsavel: "Assessor de Investimentos",
      passos: [
        "Análise da carteira atual",
        "Definição de nova alocação estratégica",
        "Implementação das mudanças",
        "Monitoramento de resultados"
      ],
      impacto: "Redução de volatilidade e potencial aumento de retorno",
      status: "Não iniciado"
    });

    return acoes;
  };

  // Obter as ações prioritárias dinâmicas
  const acoesPrioritarias = getAcoesPrioritarias();

  const specialistUrl = 'https://outlook.office.com/bookwithme/user/431917f0f5654e55bb2fa25f5b91cc7c@altavistainvest.com.br?anonymous&ismsaljsauthenabled&ep=pcard';

  return (
    <section className="py-16 px-4" id="action-plan">
      <div className="section-container">
        <div
          ref={titleRef}
          className="mb-12 text-center animate-on-scroll"
        >
          <div className="inline-block">
            <div className="card-flex-center mb-4">
              <div className="bg-accent/10 p-3 rounded-full">
                <ListChecks size={28} className="text-accent" />
              </div>
            </div>
            <h2 className="text-4xl font-bold mb-3">8. Plano de Ação</h2>
            <p className="card-description-standard max-w-2xl mx-auto">
              Conjunto de ações estratégicas para alcançar seus objetivos financeiros e patrimoniais
            </p>
          </div>
        </div>

        <div
          ref={timelineRef}
          className="section-container mb-8 animate-on-scroll"
        >
          <h3 className="text-xl font-semibold mb-6">Próximos Passos</h3>
          {!hideControls && (
            <div className="text-xs text-muted-foreground mb-2">Arraste os cards para reordenar conforme a prioridade do cliente</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cronograma.map((fase, index) => (
              <Card
                key={index}
                className={cn(
                  "group hover:shadow-lg transition-all duration-300 border-2 hover:border-accent/50",
                  dragIndex === index && "border-accent/70 bg-accent/5"
                )}
                draggable={!hideControls}
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver}
                onDrop={handleDrop(index)}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${fase.cor} border-2`}>
                      <span className="text-2xl">{fase.icone}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium bg-accent/10 text-accent px-2 py-1 rounded-full">
                          Passo {index + 1}
                        </span>
                        {!hideControls && (
                          <span className="text-[10px] text-muted-foreground">(arraste para mover)</span>
                        )}
                      </div>
                      <CardTitle className="text-lg font-bold">{fase.titulo}</CardTitle>
                      <CardDescription className="mt-1">{fase.descricao}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-2 mb-4">
                    {fase.acoes.map((acao, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-accent mt-2 flex-shrink-0"></div>
                        <span className="text-sm text-muted-foreground">{acao}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="space-y-2">
                    {fase.titulo === "Diagnóstico de Alocação" ? (
                      <Button asChild size="sm" className="w-full">
                        <a href="https://outlook.office.com/bookwithme/user/a6966fc789e84b01a9ea117c59722594%40altavistawm.com.br?anonymous&ismsaljsauthenabled" target="_blank" rel="noopener noreferrer">
                          Agendar Diagnóstico
                        </a>
                      </Button>
                    ) : (
                      <Button size="sm" className="w-full" disabled title="Em breve">
                        Em breve
                      </Button>
                    )}
                    {(fase.titulo === "Projetos Imobilizados" || fase.titulo === "Proteção Patrimonial") && (
                      <Button asChild size="sm" variant="outline" className="w-full">
                        <a href="https://homolog.universo.univalores.com.br/modulo/univalores-credito" target="_blank" rel="noopener noreferrer">
                          Tire suas dúvidas
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div
          ref={priorityRef}
          className="section-container mb-6 animate-on-scroll"
        >
          {false && (
            <>
              <h3 className="text-xl font-semibold mb-6">Ações Prioritárias</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {acoesPrioritarias.map((acao, index) => (
                  <Card key={index} className={acao.prioridade === 'Alta' ? 'border-financial-danger/50' : ''}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-xl">{acao.titulo}</CardTitle>
                        <Badge className={getPriorityColor(acao.prioridade)}>
                          {acao.prioridade}
                        </Badge>
                      </div>
                      <CardDescription className="mt-1">{acao.descricao}</CardDescription>
                    </CardHeader>
                    <CardContent className="py-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Prazo: <span className="font-medium">{acao.prazo}</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Responsável: <span className="font-medium">{acao.responsavel}</span></span>
                        </div>
                      </div>
                      <div className="mb-3">
                        <h5 className="text-sm font-medium mb-2">Passos principais:</h5>
                        <ol className="text-sm space-y-1">
                          {acao.passos.map((passo, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <span className="text-xs inline-flex items-center justify-center size-5 rounded-full bg-accent/10 text-accent font-medium">{i + 1}</span>
                              {passo}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between border-t pt-4">
                      <span className="text-sm text-muted-foreground">Impacto: {acao.impacto}</span>
                      <StatusChip
                        status={acao.status === 'Concluído' ? 'success' : acao.status === 'Em progresso' ? 'info' : 'warning'}
                        label={acao.status}
                      />
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default ActionPlan;