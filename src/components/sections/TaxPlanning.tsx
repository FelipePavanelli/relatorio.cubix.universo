import React, { useMemo, useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from "@/components/ui/card";
import HideableCard from '@/components/ui/HideableCard';
import { useCardVisibility } from '@/context/CardVisibilityContext';
import { useSpouseInclusion } from '@/context/SpouseInclusionContext';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import StatusChip from '@/components/ui/StatusChip';
import {
  Calculator,
  FileText,
  Shield,
  TrendingUp,
  TrendingDown,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { formatCurrency } from '@/utils/formatCurrency';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { calculateIrpfComparison } from '@/utils/irpf';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Card as UiCard } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';

interface TaxPlanningProps {
  data: any;
  hideControls?: boolean;
}

const TaxPlanning: React.FC<TaxPlanningProps> = ({ data, hideControls }) => {
  // Get access to the tax planning data
  const { tributario } = data;
  const headerRef = useScrollAnimation();
  const diagnosticoRef = useScrollAnimation();
  const comparativoRef = useScrollAnimation();
  const recomendacoesRef = useScrollAnimation();
  const { isCardVisible, toggleCardVisibility } = useCardVisibility();
  const { includeSpouse, setIncludeSpouse } = useSpouseInclusion();

  // Diagnóstico Tributário - cálculos dinâmicos a partir das rendas
  const rendas = Array.isArray(data?.financas?.rendas) ? data.financas.rendas : [];
  const normalize = (s: string) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const isSpouseIncome = (r: any) => normalize(r?.descricao || r?.fonte || '').includes('conjuge');
  const rendasAnalise = includeSpouse ? rendas : rendas.filter((r: any) => !isSpouseIncome(r));
  const isIsento = (txt?: string) => (txt || '').toLowerCase().includes('isento');
  const isAluguel = (txt?: string) => /alug|loca/i.test(txt || '');
  const isDividendo = (txt?: string) => /dividen/i.test(txt || '');

  const rendaTributavelMensal = rendasAnalise
    .filter((r: any) => !isIsento(r?.tributacao))
    .reduce((acc: number, r: any) => acc + (Number(r?.valor) || 0), 0);

  const rendaIsentaMensal = rendasAnalise
    .filter((r: any) => isIsento(r?.tributacao))
    .reduce((acc: number, r: any) => acc + (Number(r?.valor) || 0), 0);

  const dividendosIsentosMensais = rendasAnalise
    .filter((r: any) => isDividendo(r?.descricao || r?.fonte) && isIsento(r?.tributacao))
    .reduce((acc: number, r: any) => acc + (Number(r?.valor) || 0), 0);

  const doacaoAnual = rendasAnalise
    .filter((r: any) => /(doa[cç][aã]o)/i.test(r?.descricao || r?.fonte))
    .reduce((acc: number, r: any) => acc + (Number(r?.valorAnual || 0)), 0);

  const modeloIRFallback = tributario?.resumo?.modeloIR || 'A avaliar (completo x simplificado)';

  const pgblAnnualMax = Math.max(0, rendaTributavelMensal * 12 * 0.12);
  const pgblMonthlySuggest = pgblAnnualMax / 12;

  const possuiRendaDeAluguel = rendasAnalise.some((r: any) => isAluguel(r?.descricao || r?.fonte));

  // Comparativo IRPF - estados e cálculo
  const rendaTributavelAnual = Math.max(0, rendaTributavelMensal * 12);
  const deducoesArray = Array.isArray(data?.tributario?.deducoes) ? data.tributario.deducoes : [];
  const findDeduction = (tipo: string) => deducoesArray.find((d: any) => (d?.tipo || '').toLowerCase() === tipo.toLowerCase());
  const dependentesFromDeducao = Number(findDeduction('Dependentes')?.quantidade || 0);
  const dependentesFromProtecao = Number(data?.protecao?.analiseNecessidades?.numeroDependentes || 0);
  const numDependentesDefault = dependentesFromDeducao || dependentesFromProtecao || 0;

  const [numDependentes, setNumDependentes] = useState<number>(numDependentesDefault);
  const despesasArray = Array.isArray(data?.financas?.despesas) ? data.financas.despesas : [];
  const educacaoFromExpensesMonthly = despesasArray
    .filter((d: any) => /educa/i.test(d?.tipo || d?.subtipo || ''))
    .reduce((acc: number, d: any) => acc + (Number(d?.valor) || 0), 0);
  const educacaoAnualFromExpenses = educacaoFromExpensesMonthly * 12;
  const [gastoEducacao, setGastoEducacao] = useState<number>(
    Number(
      findDeduction('Educacao')?.valor ||
      findDeduction('Educação')?.valor ||
      educacaoAnualFromExpenses || 0
    )
  );
  const saudeFromExpensesMonthly = despesasArray
    .filter((d: any) => /(sa[úu]de|plano|m[eé]dico|odont|hospital)/i.test(d?.tipo || d?.subtipo || ''))
    .reduce((acc: number, d: any) => acc + (Number(d?.valor) || 0), 0);
  const saudeAnualFromExpenses = saudeFromExpensesMonthly * 12;
  const [gastoSaude, setGastoSaude] = useState<number>(
    Number(
      findDeduction('Saude')?.valor ||
      findDeduction('Saúde')?.valor ||
      saudeAnualFromExpenses || 0
    )
  );
  const [pgblAnual, setPgblAnual] = useState<number>(pgblAnnualMax);
  const pgblPercentualUtilizado = pgblAnnualMax > 0 ? Math.round((pgblAnual / pgblAnnualMax) * 100) : 0;

  // Atualizar pgblAnual quando pgblAnnualMax mudar (ex: quando incluir cônjuge muda)
  useEffect(() => {
    setPgblAnual(pgblAnnualMax);
  }, [pgblAnnualMax]);

  const irpf = useMemo(() => calculateIrpfComparison({
    annualTaxableIncome: rendaTributavelAnual,
    numberOfDependents: numDependentes || 0,
    educationExpenses: gastoEducacao || 0,
    healthExpenses: gastoSaude || 0,
    pgblContributions: pgblAnual || 0,
  }), [rendaTributavelAnual, numDependentes, gastoEducacao, gastoSaude, pgblAnual]);
  const modeloIR = irpf?.recommendedModel || modeloIRFallback;
  const showRecomendacoes = false;

  return (
    <section className="min-h-screen py-16 px-4" id="tax">
      <div className="section-container">
        {/* Section Header */}
        <div
          ref={headerRef as React.RefObject<HTMLDivElement>}
          className="mb-12 text-center animate-on-scroll"
        >
          <div className="inline-block">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-financial-info/10 p-3 rounded-full">
                <Calculator size={28} className="text-financial-info" />
              </div>
            </div>
            <h2 className="text-4xl font-bold mb-3">5. Planejamento Tributário</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Estratégias para otimização fiscal e redução da carga tributária através de estruturação
              patrimonial e organização financeira.
            </p>
          </div>
        </div>

        {/* Diagnóstico Tributário */}
        <div
          ref={diagnosticoRef as React.RefObject<HTMLDivElement>}
          className="mb-8 animate-on-scroll delay-1"
        >
          <HideableCard
            id="diagnostico-tributario"
            isVisible={isCardVisible("diagnostico-tributario")}
            onToggleVisibility={() => toggleCardVisibility("diagnostico-tributario")}
            hideControls={hideControls}
          >
            <CardHeader>
              <CardTitle className="card-title-standard flex items-center gap-2">
                <FileText size={20} className="text-financial-info" />
                Diagnóstico Tributário
              </CardTitle>
              <CardDescription>
                Avaliação dos impactos tributários sobre renda e patrimônio, com identificação de deduções e
                oportunidades de otimização fiscal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">Rendimentos e Tributação</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fonte</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Tributação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rendas.map((r: any, idx: number) => {
                      const spouse = isSpouseIncome(r);
                      const isExcluded = spouse && !includeSpouse;
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {r?.descricao || r?.fonte || 'Renda'}
                            {isExcluded && (
                              <span className="ml-2 text-xs text-muted-foreground italic">(não contabilizada)</span>
                            )}
                          </TableCell>
                          <TableCell>{formatCurrency(Number(r?.valor) || 0)}</TableCell>
                          <TableCell>
                            <StatusChip status={isIsento(r?.tributacao) ? 'success' : 'warning'} label={r?.tributacao || '—'} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="grid md:grid-cols-3 gap-4 mt-4">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground mb-1">
                      Renda Tributável (mês) {includeSpouse ? '(cliente + cônjuge)' : '(cliente principal)'}
                    </span>
                    <span className="font-medium">{formatCurrency(rendaTributavelMensal)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground mb-1">
                      Renda Isenta (mês) {includeSpouse ? '(cliente + cônjuge)' : '(cliente principal)'}
                    </span>
                    <span className="font-medium">{formatCurrency(rendaIsentaMensal)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground mb-1">Dividendos Isentos (mês)</span>
                    <span className="font-medium">{formatCurrency(dividendosIsentosMensais)}</span>
                  </div>
                </div>
                {doacaoAnual > 0 && (
                  <div className="mt-4 text-sm text-muted-foreground">
                    Doações declaradas (ano): <span className="font-medium text-foreground">{formatCurrency(doacaoAnual)}</span> (isentas conforme legislação vigente, quando aplicável)
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-financial-info/10 to-financial-info/5 p-5 rounded-xl border-2 border-financial-info/30 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={18} className="text-financial-info" />
                    <div className="text-sm font-semibold text-foreground">Modelo Recomendado</div>
                  </div>
                  <div className="text-2xl font-bold text-financial-info mt-2">{modeloIR}</div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Baseado na análise de deduções e alíquotas efetivas
                  </div>
                </div>
                <div className="bg-gradient-to-br from-financial-info/10 to-financial-info/5 p-5 rounded-xl border-2 border-financial-info/30 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={18} className="text-financial-info" />
                    <div className="text-sm font-semibold text-foreground">Oportunidade PGBL</div>
                  </div>
                  <div className="text-xl font-bold text-financial-info mt-2">{formatCurrency(pgblAnnualMax)}</div>
                  <div className="text-xs text-muted-foreground mt-1">ao ano ({formatCurrency(pgblMonthlySuggest)}/mês)</div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Limite legal: 12% da renda tributável
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg border border-border/50">
                <div className="flex items-start gap-3">
                  <Info size={18} className="text-financial-info mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-foreground">
                    <strong className="font-semibold">Como funciona:</strong> O modelo mais vantajoso é determinado comparando as alíquotas efetivas 
                    de cada regime. Consideramos todas as despesas dedutíveis, dependentes, previdência e outras particularidades 
                    para identificar o regime de IR mais eficiente para sua situação.
                  </div>
                </div>
              </div>
            </CardContent>
          </HideableCard>
        </div>

        {/* Comparativo IRPF: Completo vs Simplificado */}
        <div
          ref={comparativoRef as React.RefObject<HTMLDivElement>}
          className="mb-8 animate-on-scroll delay-2"
        >
          <HideableCard
            id="comparativo-irpf"
            isVisible={isCardVisible("comparativo-irpf")}
            onToggleVisibility={() => toggleCardVisibility("comparativo-irpf")}
            hideControls={hideControls}
          >
            <CardHeader>
              <CardTitle className="card-title-standard flex items-center gap-2">
                <Calculator size={20} className="text-financial-info" />
                Comparativo IRPF (Completo vs Simplificado)
              </CardTitle>
              <CardDescription>
                Ajuste os valores abaixo para comparar os modelos de declaração e identificar qual oferece maior economia tributária.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Parâmetros de Entrada */}
              <div className="bg-muted/30 p-5 rounded-xl border border-border/50">
                <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <FileText size={16} className="text-financial-info" />
                  Parâmetros para Cálculo
                </h4>
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="bg-background p-4 rounded-lg border border-border/30">
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">
                      Renda Tributável (ano)
                    </label>
                    <div className="text-lg font-bold text-foreground">{formatCurrency(rendaTributavelAnual)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {includeSpouse ? '(cliente + cônjuge)' : '(cliente principal)'}
                    </div>
                  </div>
                  <div className="bg-background p-4 rounded-lg border border-border/30">
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Dependentes</label>
                    <Input 
                      type="number" 
                      min={0} 
                      value={numDependentes}
                      onChange={(e) => setNumDependentes(Number((e.target as HTMLInputElement).value) || 0)}
                      className="text-lg font-semibold"
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      R$ {formatCurrency(numDependentes * 2275.08)} de dedução
                    </div>
                  </div>
                  <div className="bg-background p-4 rounded-lg border border-border/30">
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Gastos com Educação (ano)</label>
                    <CurrencyInput 
                      value={gastoEducacao}
                      onChange={(v) => setGastoEducacao(v)}
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      Limite: R$ {formatCurrency((numDependentes + 1) * 3561.50)} por dependente
                    </div>
                  </div>
                  <div className="bg-background p-4 rounded-lg border border-border/30">
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Despesas de Saúde (ano)</label>
                    <CurrencyInput 
                      value={gastoSaude}
                      onChange={(v) => setGastoSaude(v)}
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      Sem limite de dedução
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumo e Recomendação */}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="md:col-span-2 bg-gradient-to-br from-financial-info/10 to-financial-info/5 p-5 rounded-xl border-2 border-financial-info/30">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={18} className="text-financial-info" />
                    <div className="text-sm font-semibold text-foreground">Contribuições PGBL (ano)</div>
                  </div>
                  <div className="text-2xl font-bold text-financial-info mb-2">{formatCurrency(pgblAnual)}</div>
                  <div className="text-xs text-muted-foreground">
                    Limite máximo: {formatCurrency(rendaTributavelAnual * 0.12)} (12% da renda)
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
                      <span>Percentual do limite utilizado</span>
                      <span className="font-semibold text-foreground text-xs">{pgblPercentualUtilizado}%</span>
                    </div>
                    <Slider
                      value={[pgblPercentualUtilizado]}
                      min={0}
                      max={100}
                      step={1}
                      disabled={pgblAnnualMax <= 0}
                      onValueChange={(value) => {
                        if (pgblAnnualMax <= 0) {
                          setPgblAnual(0);
                          return;
                        }
                        const percent = Math.min(100, Math.max(0, value[0]));
                        const novoValor = (percent / 100) * pgblAnnualMax;
                        setPgblAnual(novoValor);
                      }}
                    />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2">
                      <span>Atual: {formatCurrency(pgblAnual)} / ano</span>
                      <span>{formatCurrency(pgblAnual / 12 || 0)} / mês</span>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-financial-info/10 to-financial-info/5 p-5 rounded-xl border-2 border-financial-info/30">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={16} className="text-financial-info" />
                    <div className="text-xs font-semibold text-foreground">Recomendado</div>
                  </div>
                  <div className="text-lg font-bold text-financial-info mb-1">{irpf.recommendedModel}</div>
                  <div className="text-xs text-muted-foreground">
                    Alíquota: {(irpf.recommendedModel === 'Completo' ? irpf.complete.effectiveRate : irpf.recommendedModel === 'Simplificado' ? irpf.simplified.effectiveRate : Math.min(irpf.complete.effectiveRate, irpf.simplified.effectiveRate)).toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>


              {/* Detalhes dos Cálculos e Projeção Integrados */}
              <div className="mt-8 pt-6 border-t border-border/50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent"></div>
                  <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Calculator size={20} className="text-financial-info" />
                    Detalhamento dos Cálculos e Projeção de Economia
                  </h4>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent"></div>
                </div>

                {/* Layout Principal - 2 colunas principais */}
                <div className="grid lg:grid-cols-2 gap-8">
                  
                  {/* Coluna Esquerda - Comparativo dos Modelos */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between mb-4">
                      <h5 className="text-md font-semibold text-foreground flex items-center gap-2">
                        <FileText size={18} className="text-financial-info" />
                        Comparativo dos Modelos
                      </h5>
                      {irpf.complete.taxDue < irpf.simplified.taxDue && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-financial-info/10 text-financial-info text-xs font-semibold rounded-full">
                          <CheckCircle2 size={12} />
                          Completo é mais vantajoso
                        </span>
                      )}
                      {irpf.simplified.taxDue < irpf.complete.taxDue && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-financial-info/10 text-financial-info text-xs font-semibold rounded-full">
                          <CheckCircle2 size={12} />
                          Simplificado é mais vantajoso
                        </span>
                      )}
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Modelo Completo - Detalhes */}
                      <div className={`bg-gradient-to-br from-muted/20 to-muted/10 border-2 ${irpf.recommendedModel === 'Completo' ? 'border-financial-info shadow-md' : 'border-border/50'} rounded-xl p-5 shadow-sm relative`}>
                        {irpf.recommendedModel === 'Completo' && (
                          <div className="absolute -top-3 right-4 bg-financial-info text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                            RECOMENDADO
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-10 h-10 rounded-full bg-financial-info/20 flex items-center justify-center">
                            <Calculator size={18} className="text-financial-info" />
                          </div>
                          <div>
                            <h6 className="font-bold text-financial-info text-base">Modelo Completo</h6>
                            <p className="text-xs text-muted-foreground">Deduções detalhadas</p>
                          </div>
                        </div>
                        <div className="space-y-4 text-sm">
                          <div className="bg-background/50 p-3 rounded-lg border border-border/30">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-foreground font-medium text-xs">Renda Tributável</span>
                              <span className="font-bold text-financial-info">{formatCurrency(rendaTributavelAnual)}</span>
                            </div>
                          </div>
                          
                          <div className="bg-background/30 p-3 rounded-lg border border-border/20">
                            <div className="text-foreground font-semibold text-xs mb-3 flex items-center gap-1">
                              <Info size={12} className="text-financial-info" />
                              Deduções Legais Aplicadas:
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">PGBL (até 12% da renda)</span>
                                <span className="font-semibold text-foreground">{formatCurrency(Math.min(pgblAnual, rendaTributavelAnual * 0.12))}</span>
                              </div>
                              
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">Dependentes ({numDependentes} × R$ 2.275,08)</span>
                                <span className="font-semibold text-foreground">{formatCurrency(numDependentes * 2275.08)}</span>
                              </div>
                              
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">Educação (limitado)</span>
                                <span className="font-semibold text-foreground">{formatCurrency(Math.min(gastoEducacao, (numDependentes + 1) * 3561.50))}</span>
                              </div>
                              
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">Saúde (sem limite)</span>
                                <span className="font-semibold text-foreground">{formatCurrency(gastoSaude)}</span>
                              </div>
                              
                              <div className="pt-2 mt-2 border-t border-border/30">
                                <div className="flex justify-between items-center">
                                  <span className="text-foreground font-bold text-xs">Total Deduções</span>
                                  <span className="text-financial-info font-bold">{formatCurrency(Math.min(pgblAnual, rendaTributavelAnual * 0.12) + (numDependentes * 2275.08) + Math.min(gastoEducacao, (numDependentes + 1) * 3561.50) + gastoSaude)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-background/50 p-3 rounded-lg border border-border/30">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-foreground font-medium text-xs">Base de Cálculo</span>
                              <span className="font-bold text-financial-info">{formatCurrency(irpf.complete.taxableBase)}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Renda Tributável - Total Deduções
                            </div>
                          </div>
                          
                          <div className="bg-financial-info/10 p-4 rounded-lg border-2 border-financial-info/30">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-foreground font-semibold text-sm">Imposto Devido</span>
                              <span className="text-financial-info text-xl font-bold">{formatCurrency(irpf.complete.taxDue)}</span>
                            </div>
                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-financial-info/20">
                              <span className="text-foreground font-medium text-xs">Alíquota Efetiva</span>
                              <span className="text-financial-info font-bold text-base">{irpf.complete.effectiveRate.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Modelo Simplificado - Detalhes */}
                      <div className={`bg-gradient-to-br from-muted/20 to-muted/10 border-2 ${irpf.recommendedModel === 'Simplificado' ? 'border-financial-info shadow-md' : 'border-border/50'} rounded-xl p-5 shadow-sm relative`}>
                        {irpf.recommendedModel === 'Simplificado' && (
                          <div className="absolute -top-3 right-4 bg-financial-info text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                            RECOMENDADO
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-10 h-10 rounded-full bg-financial-info/20 flex items-center justify-center">
                            <Calculator size={18} className="text-financial-info" />
                          </div>
                          <div>
                            <h6 className="font-bold text-financial-info text-base">Modelo Simplificado</h6>
                            <p className="text-xs text-muted-foreground">Desconto padrão de 20%</p>
                          </div>
                        </div>
                        <div className="space-y-4 text-sm">
                          <div className="bg-background/50 p-3 rounded-lg border border-border/30">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-foreground font-medium text-xs">Renda Tributável</span>
                              <span className="font-bold text-financial-info">{formatCurrency(rendaTributavelAnual)}</span>
                            </div>
                          </div>
                          
                          <div className="bg-background/30 p-3 rounded-lg border border-border/20">
                            <div className="text-foreground font-semibold text-xs mb-3 flex items-center gap-1">
                              <Info size={12} className="text-financial-info" />
                              Desconto Simplificado:
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">20% da renda (limitado)</span>
                                <span className="font-semibold text-foreground">{formatCurrency(Math.min(rendaTributavelAnual * 0.20, 16754.34))}</span>
                              </div>
                              
                              <div className="bg-financial-info/10 p-2 rounded text-xs text-muted-foreground mt-2">
                                <strong className="text-financial-info">Fórmula:</strong> min(renda × 20%, R$ 16.754,34)
                                <div className="text-[10px] mt-1 text-muted-foreground/80">
                                  Não permite deduções detalhadas
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-background/50 p-3 rounded-lg border border-border/30">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-foreground font-medium text-xs">Base de Cálculo</span>
                              <span className="font-bold text-financial-info">{formatCurrency(irpf.simplified.taxableBase)}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Renda Tributável - Desconto Simplificado
                            </div>
                          </div>
                          
                          <div className="bg-financial-info/10 p-4 rounded-lg border-2 border-financial-info/30">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-foreground font-semibold text-sm">Imposto Devido</span>
                              <span className="text-financial-info text-xl font-bold">{formatCurrency(irpf.simplified.taxDue)}</span>
                            </div>
                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-financial-info/20">
                              <span className="text-foreground font-medium text-xs">Alíquota Efetiva</span>
                              <span className="text-financial-info font-bold text-base">{irpf.simplified.effectiveRate.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Coluna Direita - Projeção de Economia */}
                  <div className="bg-gradient-to-br from-muted/10 to-muted/20 border-2 border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-10 h-10 rounded-full bg-financial-info/20 flex items-center justify-center">
                        <TrendingUp size={18} className="text-financial-info" />
                      </div>
                      <div>
                        <h5 className="font-bold text-foreground text-base">Projeção de Economia Tributária</h5>
                        <p className="text-xs text-muted-foreground">Economia potencial ao escolher o modelo recomendado</p>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      {/* Economia Anual Projetada */}
                      <div>
                        <h6 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                          <TrendingDown size={14} className="text-financial-info" />
                          Economia Anual Projetada
                        </h6>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-4 px-5 bg-gradient-to-r from-financial-info/10 to-financial-info/5 border-2 border-financial-info/30 rounded-xl shadow-sm">
                            <div>
                              <span className="text-sm font-medium text-foreground block">Economia anual atual</span>
                              <span className="text-xs text-muted-foreground">Diferença entre os modelos</span>
                            </div>
                            <span className="font-bold text-financial-info text-xl">
                              {formatCurrency(Math.abs(irpf.complete.taxDue - irpf.simplified.taxDue))}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="flex flex-col items-center py-3 px-3 bg-muted/40 rounded-lg border border-border/50">
                              <span className="text-xs text-muted-foreground mb-1">5 anos</span>
                              <span className="font-bold text-financial-info text-sm">
                                {formatCurrency(Math.abs(irpf.complete.taxDue - irpf.simplified.taxDue) * 5)}
                              </span>
                            </div>
                            <div className="flex flex-col items-center py-3 px-3 bg-muted/40 rounded-lg border border-border/50">
                              <span className="text-xs text-muted-foreground mb-1">10 anos</span>
                              <span className="font-bold text-financial-info text-sm">
                                {formatCurrency(Math.abs(irpf.complete.taxDue - irpf.simplified.taxDue) * 10)}
                              </span>
                            </div>
                            <div className="flex flex-col items-center py-3 px-3 bg-muted/40 rounded-lg border border-border/50">
                              <span className="text-xs text-muted-foreground mb-1">20 anos</span>
                              <span className="font-bold text-financial-info text-sm">
                                {formatCurrency(Math.abs(irpf.complete.taxDue - irpf.simplified.taxDue) * 20)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Cenários de Crescimento */}
                      <div>
                        <h6 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                          <TrendingUp size={14} className="text-financial-info" />
                          Cenários de Crescimento da Renda
                        </h6>
                        <div className="space-y-3">
                          <div className="bg-gradient-to-r from-financial-info/10 to-financial-info/5 border-2 border-financial-info/30 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-financial-info"></div>
                                <div className="text-sm font-bold text-financial-info">Conservador (8% a.a.)</div>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground mb-1">Economia acumulada em 10 anos:</div>
                            <div className="text-lg font-bold text-financial-info">
                              {formatCurrency(Math.abs(irpf.complete.taxDue - irpf.simplified.taxDue) * 14.49)}
                            </div>
                          </div>
                          <div className="bg-gradient-to-r from-financial-info/10 to-financial-info/5 border-2 border-financial-info/30 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-financial-info"></div>
                                <div className="text-sm font-bold text-financial-info">Moderado (12% a.a.)</div>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground mb-1">Economia acumulada em 10 anos:</div>
                            <div className="text-lg font-bold text-financial-info">
                              {formatCurrency(Math.abs(irpf.complete.taxDue - irpf.simplified.taxDue) * 17.54)}
                            </div>
                          </div>
                          <div className="bg-gradient-to-r from-financial-info/10 to-financial-info/5 border-2 border-financial-info/30 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-financial-info"></div>
                                <div className="text-sm font-bold text-financial-info">Otimista (15% a.a.)</div>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground mb-1">Economia acumulada em 10 anos:</div>
                            <div className="text-lg font-bold text-financial-info">
                              {formatCurrency(Math.abs(irpf.complete.taxDue - irpf.simplified.taxDue) * 20.30)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 p-4 bg-muted/50 border border-border/50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Info size={14} className="text-financial-info mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-foreground">
                          <strong className="font-semibold">Como calculamos:</strong> Os cenários consideram a economia anual como um "aporte" que se repete a cada ano, 
                          aplicando a fórmula de valor futuro de uma série de pagamentos iguais (anualidade). 
                          Os percentuais representam o crescimento da renda e consequente aumento da economia tributária.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <div className="text-xs text-muted-foreground">
                Estimativa com base em faixas e limites aproximados. Confirme com a tabela vigente.
              </div>
            </CardFooter>
          </HideableCard>
        </div>

        {/* Recomendações Estratégicas */}
        {showRecomendacoes && (
          <div
            ref={recomendacoesRef as React.RefObject<HTMLDivElement>}
            className="mb-8 animate-on-scroll delay-2"
          >
            <HideableCard
              id="recomendacoes-estrategicas"
              isVisible={isCardVisible("recomendacoes-estrategicas")}
              onToggleVisibility={() => toggleCardVisibility("recomendacoes-estrategicas")}
              hideControls={hideControls}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield size={18} className="text-financial-info" />
                  Recomendações Estratégicas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-2">Eficiência Fiscal na Pessoa Física</h4>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-md">
                      <div className="h-1.5 w-1.5 rounded-full bg-financial-info"></div>
                      <span>
                        {modeloIR === 'Completo'
                          ? 'Optar pelo modelo completo de IR para maximizar deduções.'
                          : modeloIR === 'Simplificado'
                          ? 'Optar pelo modelo simplificado de IR para alíquota efetiva menor.'
                          : 'Considerar modelo completo se houver deduções relevantes; caso contrário, avaliar o simplificado.'}
                      </span>
                    </li>
                    <li className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-md">
                      <div className="h-1.5 w-1.5 rounded-full bg-financial-info"></div>
                      <span>Aportar até 12% da renda tributável em PGBL: {formatCurrency(pgblAnnualMax)} ao ano ({formatCurrency(pgblMonthlySuggest)}/mês).</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Investimentos com Vantagens Tributárias</h4>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-md">
                      <div className="h-1.5 w-1.5 rounded-full bg-financial-success"></div>
                      <span>Priorizar LCI, LCA e debêntures incentivadas (isentas de IR na PF).</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Estruturação da Receita e Proteção Patrimonial</h4>
                  <ul className="space-y-2">
                    {possuiRendaDeAluguel && (
                      <li className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-md">
                        <div className="h-1.5 w-1.5 rounded-full bg-financial-info"></div>
                        <span>Avaliar migração de aluguéis para PJ, quando aplicável, visando otimização fiscal.</span>
                      </li>
                    )}
                    <li className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-md">
                      <div className="h-1.5 w-1.5 rounded-full bg-financial-info"></div>
                      <span>Avaliar constituição de holding patrimonial para eficiência tributária e facilitação sucessória.</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </HideableCard>
          </div>
        )}

      </div>
    </section>
  );
};

export default TaxPlanning;
