import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import HideableCard from '@/components/ui/HideableCard';
import StatusChip from '@/components/ui/StatusChip';
import DonutChart from '@/components/charts/DonutChart';
import ProgressBar from '@/components/ui/ProgressBar';
import { Target, BarChart3, PieChart } from 'lucide-react';
import { chartPalette } from '@/theme/chartPalette';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { formatCurrency } from '@/utils/formatCurrency';
import { useCardVisibility } from '@/context/CardVisibilityContext';

interface Investment {
  tipo: string;
  valor: number;
  percentual: number;
  risco: 'Baixo' | 'Médio' | 'Alto';
  liquidez: 'Alta' | 'Média' | 'Baixa';
  rentabilidade: number;
}

interface InvestimentosDetalhados {
  total_investimentos: number;
  por_classe: {
    renda_fixa: number | null;
    renda_variavel: number | null;
    multimercado: number | null;
    outras: number | null;
  };
  por_classe_percentual: {
    renda_fixa_pct: number | null;
    renda_variavel_pct: number | null;
    multimercado_pct: number | null;
    outras_pct: number | null;
  };
  alocacao_por_produto: any[];
  liquidez: {
    imediata_estimado: number | null;
    fonte: string | null;
  };
  observacoes: string | null;
}

interface InvestmentComparison {
  investimentosAtuais: Investment[];
  sugestaoAltaVista: Investment[];
  perfilInvestidor: string;
  scoreDiversificacao: number;
  scoreRisco: number;
  scoreLiquidez: number;
  recomendacoes: string[];
  impactoEsperado: {
    rentabilidadeEsperada: number;
    reducaoRisco: number;
    melhoriaLiquidez: number;
  };
  reservaEmergencia?: { atual: number; sugerida: number };
  totalInvestimentos?: number;
  investimentosDetalhados?: InvestimentosDetalhados;
}

interface InvestmentManagementProps {
  data: InvestmentComparison;
  hideControls?: boolean;
}

// Mapeia categorias a tons derivados do brand para manter coerência visual
// Usar variações próximas do violeta (chartPalette.series)
const investmentColors: Record<string, string> = {
  'Renda Fixa': chartPalette.series[0],
  'Renda Variável': chartPalette.series[1],
  'Multimercado': chartPalette.series[2],
  'Outros': chartPalette.series[3],
  'Fundos Imobiliários': chartPalette.series[4],
  'Previdência': chartPalette.series[5],
  'Tesouro Direto': chartPalette.series[6],
  'CDB': chartPalette.series[7],
  'LCI/LCA': chartPalette.tint(0.10),
  'Ações': chartPalette.shade(0.10),
  'Fundos de Investimento': chartPalette.tint(0.20),
  'Criptomoedas': chartPalette.shade(0.20),
  'Ouro': chartPalette.tint(0.30),
  'Internacional': chartPalette.tint(0.15),
};

// Função para obter uma cor baseada no tipo de investimento
const getColorForInvestmentType = (investmentType: string): string => {
  if (investmentType in investmentColors) {
    return investmentColors[investmentType];
  }

  // Gera uma cor para tipos não mapeados
  const hash = investmentType.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 60%)`;
};



const InvestmentManagement: React.FC<InvestmentManagementProps> = ({ data, hideControls }) => {
  const headerRef = useScrollAnimation();
  const overviewCardRef = useScrollAnimation();
  const currentInvestmentsCardRef = useScrollAnimation();
  const suggestedInvestmentsCardRef = useScrollAnimation();

  const { isCardVisible, toggleCardVisibility } = useCardVisibility();

  // Verificar se dados estão disponíveis
  if (!data) {
    return (
      <section className="py-16 px-4" id="investment-management">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Gestão de Investimentos</h2>
          <p className="text-muted-foreground">Aguarde o carregamento dos dados da API.</p>
        </div>
      </section>
    );
  }

  // Verificar se temos dados detalhados preenchidos
  const hasDetailedData = data.investimentosDetalhados && 
    (data.investimentosDetalhados.por_classe.renda_fixa !== null ||
     data.investimentosDetalhados.por_classe.renda_variavel !== null ||
     data.investimentosDetalhados.por_classe.multimercado !== null ||
     data.investimentosDetalhados.por_classe.outras !== null);

  // Calcular totais
  const totalCurrent = data.totalInvestimentos || data.investimentosAtuais.reduce((sum, inv) => sum + inv.valor, 0);
  
  // Se temos dados detalhados, usar eles; senão, usar os dados atuais
  const currentInvestmentsData = hasDetailedData ? 
    (() => {
      const detailed = data.investimentosDetalhados!;
      const investments: Investment[] = [];
      
      // Mapear dados detalhados para o formato Investment
      if (detailed.por_classe.renda_fixa !== null) {
        investments.push({
          tipo: 'Renda Fixa',
          valor: detailed.por_classe.renda_fixa,
          percentual: detailed.por_classe_percentual.renda_fixa_pct || 0,
          risco: 'Baixo',
          liquidez: 'Alta',
          rentabilidade: 0
        });
      }
      if (detailed.por_classe.renda_variavel !== null) {
        investments.push({
          tipo: 'Renda Variável',
          valor: detailed.por_classe.renda_variavel,
          percentual: detailed.por_classe_percentual.renda_variavel_pct || 0,
          risco: 'Alto',
          liquidez: 'Média',
          rentabilidade: 0
        });
      }
      if (detailed.por_classe.multimercado !== null) {
        investments.push({
          tipo: 'Multimercado',
          valor: detailed.por_classe.multimercado,
          percentual: detailed.por_classe_percentual.multimercado_pct || 0,
          risco: 'Médio',
          liquidez: 'Média',
          rentabilidade: 0
        });
      }
      if (detailed.por_classe.outras !== null) {
        investments.push({
          tipo: 'Outros',
          valor: detailed.por_classe.outras,
          percentual: detailed.por_classe_percentual.outras_pct || 0,
          risco: 'Médio',
          liquidez: 'Baixa',
          rentabilidade: 0
        });
      }
      
      // Se não temos nenhum dado detalhado preenchido, usar dados de fallback
      if (investments.length === 0) {
        // Recalcular os dados de fallback para somar o total_investimentos
        const fallbackTotal = data.investimentosAtuais.reduce((sum, inv) => sum + inv.valor, 0);
        const scaleFactor = totalCurrent / fallbackTotal;
        
        return data.investimentosAtuais.map(inv => ({
          ...inv,
          valor: Math.round(inv.valor * scaleFactor)
        }));
      }
      
      return investments;
    })() : 
    (() => {
      // Quando não temos dados detalhados, recalcular os dados de fallback
      const fallbackTotal = data.investimentosAtuais.reduce((sum, inv) => sum + inv.valor, 0);
      const scaleFactor = totalCurrent / fallbackTotal;
      
      return data.investimentosAtuais.map(inv => ({
        ...inv,
        valor: Math.round(inv.valor * scaleFactor)
      }));
    })();
  
  // Recalcular sugestões baseadas no total_investimentos
  const recalculatedSuggestions = data.sugestaoAltaVista.map(inv => ({
    ...inv,
    valor: Math.round((inv.percentual / 100) * totalCurrent)
  }));
  
  const totalSuggested = totalCurrent; // O total sugerido deve ser igual ao total atual

  // Preparar dados para os gráficos
  const currentChartData = currentInvestmentsData.map(inv => ({
    name: inv.tipo,
    value: inv.percentual,
    color: getColorForInvestmentType(inv.tipo),
    rawValue: formatCurrency(inv.valor)
  }));

  // Preparar dados para os gráficos com valores recalculados
  const suggestedChartData = recalculatedSuggestions.map(inv => ({
    name: inv.tipo,
    value: inv.percentual,
    color: getColorForInvestmentType(inv.tipo),
    rawValue: formatCurrency(inv.valor)
  }));

  // Comparativo sugerido vs. atual
  const TOLERANCE = 5; // % de tolerância para considerar enquadrado
  const categories = Array.from(
    new Set([
      ...currentInvestmentsData.map(i => i.tipo),
      ...recalculatedSuggestions.map(i => i.tipo),
    ])
  );

  const mapPerc = (arr: typeof currentInvestmentsData) =>
    arr.reduce<Record<string, number>>((acc, i) => {
      acc[i.tipo] = (acc[i.tipo] || 0) + i.percentual;
      return acc;
    }, {});

  const currentPercMap = mapPerc(currentInvestmentsData);
  const suggestedPercMap = mapPerc(recalculatedSuggestions);

  const comparativeRows = categories.map(cat => {
    const atual = Math.round(currentPercMap[cat] || 0);
    const sugerido = Math.round(suggestedPercMap[cat] || 0);
    const diff = atual - sugerido; // positivo: acima do sugerido
    return { categoria: cat, atual, sugerido, diff };
  });

  const isAligned = comparativeRows.every(r => Math.abs(r.diff) <= TOLERANCE);

  return (
    <section className="py-16 px-4" id="investment-management">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div
          ref={headerRef as React.RefObject<HTMLDivElement>}
          className="mb-12 text-center animate-on-scroll"
        >
          <div className="inline-block">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-investment-primary/10 p-3 rounded-full">
                <BarChart3 size={28} className="text-blue-600" />
              </div>
            </div>
            <h2 className="text-4xl font-bold mb-3">2. Gestão de Investimentos</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Análise comparativa entre seus investimentos atuais e as recomendações 
              personalizadas da Alta Vista para otimizar seu portfólio.
            </p>
          </div>
        </div>

        {/* Overview */}
        <div
          ref={overviewCardRef as React.RefObject<HTMLDivElement>}
          className="mb-10 animate-on-scroll"
        >
          <HideableCard
            id="investment-overview"
            isVisible={isCardVisible("investment-overview")}
            onToggleVisibility={() => toggleCardVisibility("investment-overview")}
            hideControls={hideControls}
          >
            <div className="grid md:grid-cols-2 gap-6 p-8">
              <div className="text-center">
                <h3 className="text-muted-foreground text-sm mb-1">Perfil do Investidor</h3>
                <div className="text-xl font-bold mb-1">{data.perfilInvestidor}</div>
                <StatusChip
                  status="info"
                  label="Definido"
                  icon={<Target size={14} />}
                />
              </div>
              <div className="text-center">
                <h3 className="text-muted-foreground text-sm mb-1">Reserva de Emergência</h3>
                <div className="text-lg font-semibold">Atual: {formatCurrency(data.reservaEmergencia?.atual || 0)}</div>
                <div className="text-sm text-muted-foreground">Sugerida (6 meses): {formatCurrency(data.reservaEmergencia?.sugerida || 0)}</div>
                {(() => {
                  const atual = data.reservaEmergencia?.atual || 0;
                  const sugerida = data.reservaEmergencia?.sugerida || 0;
                  const ok = sugerida === 0 ? true : atual >= sugerida;
                  return (
                    <div className="mt-1 flex justify-center">
                      <StatusChip status={ok ? 'success' : 'warning'} label={ok ? 'Adequada' : 'Insuficiente'} />
                    </div>
                  );
                })()}
              </div>
            </div>
          </HideableCard>
        </div>

        {/* Current vs Suggested Investments */}
        <div className="grid md:grid-cols-2 gap-8 mb-10">
          {/* Current Investments */}
          <div
            ref={currentInvestmentsCardRef as React.RefObject<HTMLDivElement>}
            className="animate-on-scroll h-full"
          >
            <HideableCard
              id="current-investments"
              isVisible={isCardVisible("current-investments")}
              onToggleVisibility={() => toggleCardVisibility("current-investments")}
              hideControls={hideControls}
              className="h-full"
            >
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <PieChart size={20} className="text-muted-foreground" />
                  <h3 className="text-xl font-semibold">Investimentos Atuais</h3>
                </div>
                <div className="mb-4">
                  <div className="text-2xl font-bold mb-1">{formatCurrency(totalCurrent)}</div>
                  <p className="text-sm text-muted-foreground">Total investido</p>
                </div>
                <DonutChart 
                  data={currentChartData} 
                  height={200}
                  legendPosition="bottom"
                />
                <div className="mt-4 space-y-2">
                  {currentInvestmentsData.map((inv, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                      <span className="text-sm font-medium">{inv.tipo}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground hidden sm:inline">{formatCurrency(inv.valor)}</span>
                        <span className="text-sm">{inv.percentual}%</span>
                        {/* Risk chip removed by request */}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </HideableCard>
          </div>

          {/* Suggested Investments */}
          <div
            ref={suggestedInvestmentsCardRef as React.RefObject<HTMLDivElement>}
            className="animate-on-scroll delay-1 h-full"
          >
            <HideableCard
              id="suggested-investments"
              isVisible={isCardVisible("suggested-investments")}
              onToggleVisibility={() => toggleCardVisibility("suggested-investments")}
              hideControls={hideControls}
              className="h-full"
            >
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Target size={20} className="text-muted-foreground" />
                  <h3 className="text-xl font-semibold">Sugestão de Investimentos</h3>
                </div>
                <div className="mb-4">
                  <div className="text-2xl font-bold mb-1">{formatCurrency(totalSuggested)}</div>
                  <p className="text-sm text-muted-foreground">Alocação recomendada</p>
                </div>
                <DonutChart 
                  data={suggestedChartData} 
                  height={200}
                  legendPosition="bottom"
                />
                <div className="mt-4 space-y-2">
                  {recalculatedSuggestions.map((inv, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-primary/10 rounded">
                      <span className="text-sm font-medium">{inv.tipo}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground hidden sm:inline">{formatCurrency(inv.valor)}</span>
                        <span className="text-sm">{inv.percentual}%</span>
                        {/* Risk chip removed by request */}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </HideableCard>
          </div>
        </div>

        {/* Comparative table and status */}
        <div className="mb-10">
          <HideableCard
            id="investment-comparative"
            isVisible={isCardVisible("investment-comparative")}
            onToggleVisibility={() => toggleCardVisibility("investment-comparative")}
            hideControls={hideControls}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Comparativo por Categoria</h3>
                <StatusChip
                  status={isAligned ? 'success' : 'warning'}
                  label={isAligned ? 'Cliente enquadrado' : 'Fora do enquadramento'}
                />
              </div>
               <div className="space-y-2">
                 {/* Header das colunas */}
                 <div className="grid grid-cols-4 gap-2 items-center p-2 bg-muted/50 rounded font-medium text-sm">
                   <span>Categoria</span>
                   <span className="text-right">Atual</span>
                   <span className="text-right">Sugerido</span>
                   <span className="text-right">Diferença</span>
                 </div>
                 
                 {/* Dados das linhas */}
                 {comparativeRows.map((row, idx) => (
                   <div key={idx} className="grid grid-cols-4 gap-2 items-center p-2 bg-muted/30 rounded">
                     <span className="text-sm font-medium">{row.categoria}</span>
                     <span className="text-sm text-right">{row.atual}%</span>
                     <span className="text-sm text-right">{row.sugerido}%</span>
                     <span className={`text-sm text-right ${Math.abs(row.diff) <= TOLERANCE ? 'text-muted-foreground' : row.diff > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                       {row.diff > 0 ? '+' : ''}{row.diff}%
                     </span>
                   </div>
                 ))}
               </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Diferença = Atual − Sugerido. Tolerância de {TOLERANCE}% por categoria.
              </div>
            </div>
          </HideableCard>
        </div>

      </div>
    </section>
  );
};

export default InvestmentManagement; 