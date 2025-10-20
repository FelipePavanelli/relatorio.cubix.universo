import React from 'react';
import { BarChart, Wallet, PiggyBank, LineChart, Calculator, Calendar, ArrowRight, AlertCircle, TrendingUp, Shield, Globe, Target, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import HideableCard from '@/components/ui/HideableCard';
import StatusChip from "@/components/ui/StatusChip";
import { formatCurrency } from '@/utils/formatCurrency';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import RetirementProjectionChart from '@/components/charts/RetirementProjectionChart';
import { useCardVisibility } from '@/context/CardVisibilityContext';
import { useSpouseInclusion } from '@/context/SpouseInclusionContext';

interface RetirementData {
  ativos: Array<{ tipo: string; valor: number }>;
  passivos: Array<{ tipo: string; valor: number }>;
  patrimonioLiquido: number;
  excedenteMensal: number;
  totalInvestido: number;
  rendaMensalDesejada: number;
  idadeAposentadoria: number;
  patrimonioAlvo: number;
  idadeAtual: number;
  expectativaVida: number;
  cenarios: any[];
  perfilInvestidor: string;
  alocacaoAtivos: any[];
  anosRestantes: number;
  aporteMensalRecomendado: number;
  possuiPGBL: boolean;
  valorPGBL: number;
  taxaRetiradaSegura: number;
  taxaInflacao: number;
  taxaJurosReal: number;
  rendas?: Array<{ fonte?: string; descricao?: string; origem?: string; valor: number; tributacao?: string; renda_passiva?: boolean }>;
  despesasMensais?: number;
  objetivos?: Array<{ tipo?: string; valor?: number; prazo?: string | number; prioridade?: any; nao_aposentadoria?: boolean }>;
}

interface RetirementPlanningProps {
  data: RetirementData;
  hideControls?: boolean;
  isClientVersion?: boolean;
}

const RetirementPlanning: React.FC<RetirementPlanningProps> = ({ data, hideControls, isClientVersion }) => {
  const headerRef = useScrollAnimation();
  const currentSituationRef = useScrollAnimation();
  const objetivoRef = useScrollAnimation();
  const projecaoRef = useScrollAnimation();

  const { isCardVisible, toggleCardVisibility } = useCardVisibility();
  const { includeSpouse, setIncludeSpouse } = useSpouseInclusion();
  const [projectionData, setProjectionData] = React.useState<{
    capitalNecessario: number;
    aporteMensal: number;
    idadeEsgotamento: number | null;
    rendaMensal: number;
    idadeAposentadoria: number;
  }>({
    capitalNecessario: 0,
    aporteMensal: 0,
    idadeEsgotamento: null,
    rendaMensal: data?.rendaMensalDesejada || 0,
    idadeAposentadoria: data?.idadeAposentadoria || 65
  });

  // Valores declarados pelo cliente (não mudam com a simulação)
  const [declaredGoal, setDeclaredGoal] = React.useState<{ rendaMensalPretendida: number; idadeAposentadoriaPretendida: number }>({
    rendaMensalPretendida: data?.rendaMensalDesejada || 0,
    idadeAposentadoriaPretendida: data?.idadeAposentadoria || 65,
  });

  // Calcular excedente baseado na inclusão ou não do cônjuge
  const normalize = (s: string) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const isSpouseIncome = (renda: any) => {
    const label = normalize(renda?.descricao || renda?.origem || renda?.fonte || '');
    return label.includes('conjuge');
  };

  const todasRendas = data?.rendas || [];
  const rendasFiltradas = includeSpouse 
    ? todasRendas 
    : todasRendas.filter((r: any) => !isSpouseIncome(r));
  
  const rendaMensalCalculada = rendasFiltradas.reduce((sum, renda: any) => sum + (Number(renda?.valor) || 0), 0);
  
  // Calcular excedente mensal ajustado
  const excedenteMensalAjustado = rendaMensalCalculada - (Number(data?.despesasMensais) || 0);
  
  // Usar excedente ajustado se tivermos dados de renda, caso contrário usar o valor original
  const excedenteMensal = todasRendas.length > 0 ? excedenteMensalAjustado : (data?.excedenteMensal || 0);

  // Calculate percentage of income that should be invested (aligned with spreadsheet)
  const percentualInvestir = () => {
    if (!excedenteMensal || !projectionData.aporteMensal) return 0;
    return Math.round((projectionData.aporteMensal / excedenteMensal) * 100);
  };

  // Calculate percentage increase needed
  const percentualAumento = () => {
    if (!excedenteMensal || !projectionData.aporteMensal) return 0;
    if (projectionData.aporteMensal <= excedenteMensal) return 0;
    return Math.round(((projectionData.aporteMensal - excedenteMensal) / excedenteMensal) * 100);
  };

  // Calculate if contribution needs to be increased
  const calcularAumentoAporte = () => {
    if (!excedenteMensal || !projectionData.aporteMensal) return 0;
    return Math.max(0, projectionData.aporteMensal - excedenteMensal);
  };

  // Check if contribution needs to be increased
  const precisaAumentarAporte = () => {
    return calcularAumentoAporte() > 0;
  };

  // Get recommended monthly investment (aligned with spreadsheet)
  const getAporteRecomendado = () => {
    return data?.aporteMensalRecomendado || 0;
  };

  // Check if client fits the scenarios (aligned with spreadsheet)
  const adequaAosCenarios = () => {
    return data?.aporteMensalRecomendado <= (excedenteMensal || 0);
  };

  // Calculate missing percentage (aligned with spreadsheet)
  const calcularPorcentagemFaltante = () => {
    if (!data?.aporteMensalRecomendado || !excedenteMensal) return 0;
    if (data.aporteMensalRecomendado <= excedenteMensal) return 0;

    const faltante = data.aporteMensalRecomendado - excedenteMensal;
    return Math.round((faltante / excedenteMensal) * 100);
  };

  // Calculate necessary income reduction (aligned with spreadsheet)
  const calcularReducaoRendaNecessaria = () => {
    if (!data?.rendaMensalDesejada || !excedenteMensal || !data?.aporteMensalRecomendado) return 0;

    if (data.aporteMensalRecomendado <= excedenteMensal) return 0;

    const porcentagemReducao = Math.round(
      (1 - (excedenteMensal / data.aporteMensalRecomendado)) * 100
    );
    return porcentagemReducao > 0 ? porcentagemReducao : 0;
  };

  // Valores derivados apenas para exibição amigável
  const realInterestRatePercent = ((data?.taxaJurosReal ?? 0.03) * 100).toFixed(1);
  const lifeExpectancyYears = data?.expectativaVida ?? 100;

  return (
    <section className="min-h-screen py-16 px-4" id="retirement">
      <div className="section-container">
        <div
          ref={headerRef as React.RefObject<HTMLDivElement>}
          className="mb-12 text-center animate-on-scroll"
        >
          <div className="inline-block">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-accent/10 p-3 rounded-full">
                <PiggyBank size={28} className="text-accent" />
              </div>
            </div>
            <h2 className="heading-2 mb-3">3. Planejamento de Aposentadoria</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Estratégias e projeções para garantir sua independência financeira e
              qualidade de vida na aposentadoria.
            </p>
          </div>
        </div>

        <div
          ref={currentSituationRef as React.RefObject<HTMLDivElement>}
          className="mb-8 animate-on-scroll delay-1"
        >
          <HideableCard
            id="situacao-financeira"
            isVisible={isCardVisible("situacao-financeira")}
            onToggleVisibility={() => toggleCardVisibility("situacao-financeira")}
            hideControls={hideControls}
          >
            <CardHeader>
              <CardTitle className="card-title-standard text-lg">Situação Financeira Atual</CardTitle>
              <CardDescription>
                Análise do seu patrimônio e fluxo financeiro
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="card-grid-3">
                <div className="card-metric">
                  <h3 className="card-metric-label">Patrimônio Líquido</h3>
                  <div className="card-metric-value">
                    {formatCurrency(data.ativos.reduce((sum, asset) => sum + asset.valor, 0) - data.passivos.reduce((sum, liability) => sum + liability.valor, 0))}
                  </div>
                </div>
                <div className="card-metric">
                  <h3 className="card-metric-label">
                    Excedente Mensal {includeSpouse ? '(cliente + cônjuge)' : '(cliente principal)'}
                  </h3>
                  <div className="card-metric-value">
                    {formatCurrency(excedenteMensal || 0)}
                  </div>
                </div>
                <div className="card-metric">
                  <h3 className="card-metric-label">Investimentos Financeiros Atuais</h3>
                  <div className="card-metric-value">
                    {formatCurrency(data?.totalInvestido || 0)}
                  </div>
                </div>
              </div>

        


            </CardContent>
          </HideableCard>
        </div>

        <div
          ref={objetivoRef as React.RefObject<HTMLDivElement>}
          className="mb-8 animate-on-scroll delay-2"
        >
          <HideableCard
            id="objetivo-aposentadoria"
            isVisible={isCardVisible("objetivo-aposentadoria")}
            onToggleVisibility={() => toggleCardVisibility("objetivo-aposentadoria")}
            hideControls={hideControls}
          >
            <CardHeader>
              <CardTitle className="card-title-standard text-lg">Objetivo de Aposentadoria</CardTitle>
              <CardDescription>
                Baseado nas suas preferências e estilo de vida
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Registro fixo do objetivo informado (apresentação simplificada) */}
              <div className="p-3 rounded-md border border-border/70 bg-muted/20 text-sm">
                <div className="font-medium">Objetivo registrado</div>
                <div className="text-muted-foreground mt-0.5">Renda passiva pretendida: <span className="font-semibold">{formatCurrency(declaredGoal.rendaMensalPretendida)}</span></div>
                <div className="text-muted-foreground">Idade de aposentadoria: <span className="font-semibold">{declaredGoal.idadeAposentadoriaPretendida} anos</span></div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="flex flex-col items-center p-4 bg-muted/30 rounded-lg">
                  <Calendar size={28} className="text-financial-info mb-2" />
                  <div className="text-sm text-muted-foreground">Idade Planejada</div>
                  <div className="text-xl font-semibold mt-1">
                    {projectionData.idadeAposentadoria} anos
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    ({projectionData.idadeAposentadoria - (data?.idadeAtual || 0)} anos restantes)
                  </div>
                </div>

                <div className="flex flex-col items-center p-4 bg-muted/30 rounded-lg">
                  <Calculator size={28} className="text-financial-success mb-2" />
                  <div className="text-sm text-muted-foreground">Renda Mensal Desejada</div>
                  <div className="text-xl font-semibold mt-1">
                    {formatCurrency(projectionData.rendaMensal)}
                  </div>
                </div>

                <div className="flex flex-col items-center p-4 bg-muted/30 rounded-lg">
                  <PiggyBank size={28} className="text-financial-highlight mb-2" />
                  <div className="text-sm text-muted-foreground">Investimentos Financeiros Alvo</div>
                  <div className="text-xl font-semibold mt-1">
                    {formatCurrency(Math.round(projectionData.capitalNecessario))}
                  </div>
                </div>
              </div>

              <div className="bg-muted/10 border border-border/80 rounded-lg p-5 md:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={18} className="text-accent" />
                  <h4 className="font-medium">Premissas Utilizadas</h4>
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <div className="flex items-start gap-2 p-3 rounded-md border border-border/60 bg-muted/5">
                    <CheckCircle size={16} className="mt-0.5 text-accent" />
                    <span className="text-sm leading-snug">
                      Taxa de juros real de {realInterestRatePercent}% a.a. — rendimento acima da inflação,
                      aplicada tanto na fase de acumulação quanto de consumo do patrimônio.
                    </span>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-md border border-border/60 bg-muted/5">
                    <CheckCircle size={16} className="mt-0.5 text-accent" />
                    <span className="text-sm leading-snug">
                      Expectativa de vida considerada: {lifeExpectancyYears} anos — parâmetro para estimar
                      por quanto tempo o patrimônio precisa sustentar a renda.
                    </span>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-md border border-border/60 bg-muted/5">
                    <CheckCircle size={16} className="mt-0.5 text-accent" />
                    <span className="text-sm leading-snug">
                      Capital necessário calculado pelo Valor Presente (PV) dos saques mensais —
                      quanto é preciso ter hoje, em reais de hoje, para manter a renda planejada.
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </HideableCard>
        </div>

        <div
          ref={projecaoRef as React.RefObject<HTMLDivElement>}
          className="mb-8 animate-on-scroll delay-2"
        >
          <HideableCard
            id="projecao-patrimonial"
            isVisible={isCardVisible("projecao-patrimonial")}
            onToggleVisibility={() => toggleCardVisibility("projecao-patrimonial")}
            hideControls={hideControls}
          >
            <CardHeader>
              <CardTitle className="card-title-standard text-lg">Projeção Financeira</CardTitle>
              <CardDescription>
                Análise da evolução do seu patrimônio ao longo do tempo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RetirementProjectionChart
                currentAge={data?.idadeAtual || 0}
                retirementAge={data?.idadeAposentadoria || 65}
                lifeExpectancy={data?.expectativaVida || 100}
                currentPortfolio={data?.totalInvestido || 0}
                monthlyContribution={excedenteMensal || 0}
                rendaMensalDesejada={data?.rendaMensalDesejada || 0}
                safeWithdrawalRate={data?.taxaRetiradaSegura || 0.03}
                inflationRate={data?.taxaInflacao || 0.0345}
                scenarios={data?.cenarios || []}
                onProjectionChange={setProjectionData}
                hideControls={hideControls}
                isClientVersion={isClientVersion}
                externalLiquidityEvents={(() => {
                  const idadeAtual = Number(data?.idadeAtual) || 0;
                  const aposentadoria = Number(data?.idadeAposentadoria) || 65;

                  // Rendas passivas viram entradas mensais a partir da aposentadoria
                  const passiveIncomeEvents = (Array.isArray((data as any)?.rendas) ? (data as any).rendas : [])
                    .filter((r: any) => r && (r.renda_passiva === true || /alug|dividen|inss/i.test(String(r?.descricao || r?.fonte || '')))
                      && Number(r.valor) > 0)
                    .map((r: any, idx: number) => ({
                      id: `derived-passive-${idx}`,
                      name: `${r.descricao || r.fonte || 'Renda passiva'}`,
                      value: Number(r.valor) || 0,
                      isPositive: true,
                      recurrence: 'monthly' as const,
                      startAge: aposentadoria,
                      endAge: null,
                      enabled: true,
                      isDerived: true
                    }));

                  // Objetivos não relacionados à aposentadoria viram saídas únicas
                  const parsePrazoToAge = (prazo: any): number | null => {
                    if (prazo == null) return null;
                    if (typeof prazo === 'number' && isFinite(prazo)) {
                      // Interpreta número puro como anos a partir da idade atual
                      return Math.max(idadeAtual, idadeAtual + Math.max(0, Math.floor(prazo)));
                    }
                    const text = String(prazo).toLowerCase().trim();
                    const aosMatch = text.match(/aos\s*(\d{1,3})\s*anos?/);
                    if (aosMatch) {
                      const age = parseInt(aosMatch[1], 10);
                      return isFinite(age) ? age : null;
                    }
                    const anosMatch = text.match(/(\d{1,3})\s*anos?/);
                    if (anosMatch) {
                      const years = parseInt(anosMatch[1], 10);
                      if (isFinite(years)) return Math.max(idadeAtual, idadeAtual + Math.max(0, years));
                    }
                    const mesesMatch = text.match(/(\d{1,3})\s*mes/);
                    if (mesesMatch) {
                      const months = parseInt(mesesMatch[1], 10);
                      if (isFinite(months)) {
                        const years = Math.max(1, Math.round(months / 12));
                        return Math.max(idadeAtual, idadeAtual + years);
                      }
                    }
                    return null;
                  };

                  const goalEvents = (Array.isArray((data as any)?.objetivos) ? (data as any).objetivos : [])
                    .filter((o: any) => o && o.nao_aposentadoria === true && Number(o.valor) > 0)
                    .map((o: any, idx: number) => {
                      const start = parsePrazoToAge(o.prazo);
                      return {
                        id: `derived-goal-${idx}`,
                        name: `${o.tipo || 'Objetivo'}`,
                        value: Number(o.valor) || 0,
                        isPositive: false,
                        recurrence: 'once' as const,
                        startAge: start ?? Math.max(idadeAtual + 1,  idadeAtual + 1),
                        endAge: null,
                        enabled: true,
                        isDerived: true
                      };
                    });

                  return [...passiveIncomeEvents, ...goalEvents];
                })()}
              />
            </CardContent>
          </HideableCard>
        </div>
      </div>
    </section>
  );
};

export default RetirementPlanning;