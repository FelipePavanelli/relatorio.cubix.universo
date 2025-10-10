import React from 'react';
import HideableCard from '@/components/ui/HideableCard';
import StatusChip from '@/components/ui/StatusChip';
import ProgressBar from '@/components/ui/ProgressBar';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { formatCurrency } from '@/utils/formatCurrency';
import { useCardVisibility } from '@/context/CardVisibilityContext';
import { useSpouseInclusion } from '@/context/SpouseInclusionContext';
import { Card } from '@/components/ui/card';
import { ChartContainer } from '@/components/ui/chart';
import { chartPalette } from '@/theme/chartPalette';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

interface FinanceSummary {
  patrimonioLiquido: number;
  excedenteMensal: number;
  rendas: Array<{ fonte?: string; descricao?: string; valor: number; tributacao?: string }>;
  despesasMensais: number;
  composicaoPatrimonial: Record<string, number>;
  ativos: Array<{ tipo: string; valor: number; classe?: string }>;
  passivos: Array<{ tipo: string; valor: number }>;
  formatoTrabalho?: string;
}

interface FinancialSummaryProps {
  data: FinanceSummary;
  hideControls?: boolean;
}

const FinancialSummary: React.FC<FinancialSummaryProps> = ({ data, hideControls }) => {
  const headerRef = useScrollAnimation();
  const summaryCardRef = useScrollAnimation();
  const incomeExpenseCardRef = useScrollAnimation();
  const balanceCardRef = useScrollAnimation();

  const { isCardVisible, toggleCardVisibility } = useCardVisibility();
  const { includeSpouse, setIncludeSpouse } = useSpouseInclusion();

  // Helpers: identify renda do cônjuge
  const normalize = (s: string) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const isSpouseIncome = (renda: { fonte?: string; descricao?: string }) => {
    const label = normalize(renda?.descricao || renda?.fonte || '');
    return label.includes('conjuge');
  };

  // Calculate total income - include or exclude spouse based on toggle
  const todasRendas = data.rendas || [];
  const incomesForTotals = includeSpouse 
    ? todasRendas 
    : todasRendas.filter(r => !isSpouseIncome(r));
  const totalIncome = incomesForTotals.reduce((sum, renda: any) => sum + (Number(renda?.valor) || 0), 0);

  // Valores derivados (mensal x anual)
  const totalIncomeAnnual = totalIncome * 12;
  const totalExpensesMonthly = data.despesasMensais;
  const totalExpensesAnnual = totalExpensesMonthly * 12;
  const surplusMonthly = (totalIncomeAnnual - totalExpensesAnnual) / 12;
  const surplusAnnual = totalIncomeAnnual - totalExpensesAnnual;

  // Totais de ativos e passivos para o balanço
  const totalAtivosLista = (data?.ativos || []).reduce((s, a) => s + (Number(a?.valor) || 0), 0);
  const totalPassivosLista = (data?.passivos || []).reduce((s, p) => s + (Number(p?.valor) || 0), 0);
  const patrimonioLiquidoResumo = totalAtivosLista - totalPassivosLista;

  // Tons próximos do violeta (paleta da marca)
  const barData = [
    { nome: 'Renda', valor: totalIncome, color: chartPalette.series[0] },
    { nome: 'Despesas', valor: totalExpensesMonthly, color: chartPalette.series[3] },
    { nome: 'Excedente', valor: surplusMonthly, color: chartPalette.series[5] },
  ];

  return (
    <section className="py-16 px-4" id="summary">
      <div className="section-container">
        {/* Header */}
        <div
          ref={headerRef as React.RefObject<HTMLDivElement>}
          className="mb-12 text-center animate-on-scroll"
        >
          <div className="inline-block">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-financial-info/10 p-3 rounded-full">
                <DollarSign size={28} className="text-financial-info" />
              </div>
            </div>
            <h2 className="text-4xl font-bold mb-3">1. Resumo Financeiro</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Visão geral da sua situação financeira atual, incluindo patrimônio,
              renda, gastos e composição patrimonial.
            </p>
          </div>
        </div>

        {/* Top Row - Key Financial Metrics */}
        <div
          ref={summaryCardRef as React.RefObject<HTMLDivElement>}
          className="mb-10 animate-on-scroll"
        >
          <div className="grid md:grid-cols-12 gap-6">
            {/* Renda Mensal */}
            <Card className="p-6 text-center h-full col-span-12 md:col-span-6">
              <h3 className="text-muted-foreground text-sm mb-1">
                Renda Mensal {includeSpouse ? '(cliente + cônjuge)' : '(cliente principal)'}
              </h3>
              <div className="text-3xl font-bold mb-1">
                {formatCurrency(totalIncome)}
              </div>
              {data?.formatoTrabalho && (
                <div className="text-xs text-muted-foreground mt-1">Formato de trabalho: {data.formatoTrabalho}</div>
              )}
            </Card>

            {/* Excedente Mensal */}
            <HideableCard
              id="financial-resumo"
              isVisible={isCardVisible("financial-resumo")}
              onToggleVisibility={() => toggleCardVisibility("financial-resumo")}
              hideControls={hideControls}
              className="p-6 text-center h-full col-span-12 md:col-span-6"
            >
              <h3 className="text-muted-foreground text-sm mb-1">Excedente Mensal</h3>
              <div className="text-3xl font-bold mb-1">
                {formatCurrency(surplusMonthly)}
              </div>
              {/* <StatusChip
                status={surplusMonthly >= 0 ? "success" : "danger"}
                label={surplusMonthly >= 0 ? "Positivo" : "Negativo"}
                icon={surplusMonthly >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              /> */}
            </HideableCard>
          </div>
        </div>

        {/* Middle Row - Income vs Expenses (Bar) */}
        <div
          ref={incomeExpenseCardRef as React.RefObject<HTMLDivElement>}
          className="mb-10 animate-on-scroll"
        >
          <div className="grid md:grid-cols-12 gap-6">
            {/* Renda vs. Despesas */}
            <HideableCard
              id="renda-despesas"
              isVisible={isCardVisible("renda-despesas")}
              onToggleVisibility={() => toggleCardVisibility("renda-despesas")}
              hideControls={hideControls}
              className="col-span-12"
            >
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-4">Renda vs. Despesas</h3>
                <div className="h-64">
                  <ChartContainer config={{}} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="nome" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} tickLine={{ stroke: '#9CA3AF' }} />
                        <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} tickLine={{ stroke: '#9CA3AF' }} />
                        <Tooltip formatter={(value: number) => [formatCurrency(value), '']} wrapperStyle={{ outline: 'none' }} />
                        <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                          {barData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.color}
                              stroke="rgba(0,0,0,0.25)"
                              strokeWidth={1}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Excedente: {totalIncome > 0 ? `${((surplusMonthly / totalIncome) * 100).toFixed(1)}%` : '0%'} da renda
                </div>
              </div>
            </HideableCard>

            {/* Detalhamento de Rendas e Despesas */}
            <HideableCard
              id="detalhe-renda-despesas"
              isVisible={isCardVisible("detalhe-renda-despesas")}
              onToggleVisibility={() => toggleCardVisibility("detalhe-renda-despesas")}
              hideControls={hideControls}
              className="col-span-12"
            >
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-4">Detalhamento</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-2">Rendas</h4>
                    <div className="space-y-2">
                      {data.rendas.map((renda, index) => {
                        const spouse = isSpouseIncome(renda);
                        const isExcluded = spouse && !includeSpouse;
                        return (
                          <div key={index} className="flex justify-between items-start">
                            <div className="text-sm">
                              <div className="font-medium">{renda.descricao || renda.fonte || 'Renda'}</div>
                              {renda.tributacao && (
                                <div className="text-xs text-muted-foreground">{renda.tributacao}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="text-sm font-medium">{formatCurrency(renda.valor)} / mês</div>
                              <div className="text-sm font-medium text-muted-foreground">{formatCurrency((renda as any)?.valorAnual ?? (renda.valor * 12))} / ano</div>
                              {isExcluded && (
                                <div className="text-xs text-muted-foreground italic">(não contabilizada)</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Despesas</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="text-sm">
                          <div className="font-medium">Despesas Mensais</div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-sm font-medium">{formatCurrency(data.despesasMensais)} / mês</div>
                          <div className="text-sm font-medium text-muted-foreground">{formatCurrency(data.despesasMensais * 12)} / ano</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </HideableCard>
          </div>
        </div>

        {/* Balanço Patrimonial */}
        <div
          ref={balanceCardRef as React.RefObject<HTMLDivElement>}
          className="mb-10 animate-on-scroll"
        >
          <HideableCard
            id="balanco-patrimonial-resumo"
            isVisible={isCardVisible("balanco-patrimonial-resumo")}
            onToggleVisibility={() => toggleCardVisibility("balanco-patrimonial-resumo")}
            hideControls={hideControls}
            className="col-span-12"
          >
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-6">Balanço Patrimonial</h3>
              
              {/* Resumo dos Totais */}
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {formatCurrency(totalAtivosLista)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total de Ativos</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {formatCurrency(totalPassivosLista)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total de Passivos</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {formatCurrency(patrimonioLiquidoResumo)}
                  </div>
                  <div className="text-sm text-muted-foreground">Patrimônio Líquido</div>
                </div>
              </div>

              {/* Detalhamento de Ativos e Passivos */}
              <div className="grid md:grid-cols-2 gap-8">
                {/* Ativos */}
                <div>
                  <h4 className="font-semibold text-lg mb-4 text-foreground">Ativos</h4>
                  <div className="space-y-3">
                    {data.ativos.map((ativo, index) => (
                      <div key={index} className="flex justify-between items-center p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <span className="text-sm font-medium">{ativo.tipo}{ativo.classe ? ` - ${ativo.classe}` : ''}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{formatCurrency(ativo.valor)}</span>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                            {totalAtivosLista > 0 ? Math.round((ativo.valor / totalAtivosLista) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                    {data.ativos.length === 0 && (
                      <div className="text-sm text-muted-foreground text-center py-8 bg-muted/30 rounded-lg">
                        Nenhum ativo registrado
                      </div>
                    )}
                    <div className="pt-4 border-t-2 border-financial-success/20 flex justify-between items-center font-bold text-foreground">
                      <span>Total de Ativos</span>
                      <span>{formatCurrency(totalAtivosLista)}</span>
                    </div>
                  </div>
                </div>

                {/* Passivos */}
                <div>
                  <h4 className="font-semibold text-lg mb-4 text-foreground">Passivos</h4>
                  <div className="space-y-3">
                    {data.passivos.map((passivo, index) => (
                      <div key={index} className="flex justify-between items-center p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <span className="text-sm font-medium">{passivo.tipo}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{formatCurrency(passivo.valor)}</span>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                            {totalPassivosLista > 0 ? Math.round((passivo.valor / totalPassivosLista) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                    {data.passivos.length === 0 && (
                      <div className="text-sm text-muted-foreground text-center py-8 bg-muted/30 rounded-lg">
                        Nenhum passivo registrado
                      </div>
                    )}
                    <div className="pt-4 border-t-2 border-financial-danger/20 flex justify-between items-center font-bold text-foreground">
                      <span>Total de Passivos</span>
                      <span>{formatCurrency(totalPassivosLista)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </HideableCard>
        </div>
      </div>
    </section>
  );
};

export default FinancialSummary;