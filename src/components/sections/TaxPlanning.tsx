import React, { useMemo, useState } from 'react';
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
  Shield
} from 'lucide-react';
import { formatCurrency } from '@/utils/formatCurrency';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { calculateIrpfComparison } from '@/utils/irpf';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Card as UiCard } from '@/components/ui/card';

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
              <div className="bg-financial-info/30 p-3 rounded-full">
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
                <div className="bg-muted/50 p-4 rounded-lg border border-border/50">
                  <div className="text-sm text-muted-foreground mb-1">Modelo de IR potencialmente mais vantajoso</div>
                  <div className="font-medium">{modeloIR}</div>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg border border-border/50">
                  <div className="text-sm text-muted-foreground mb-1">Aporte recomendado em PGBL (limite legal de 12%)</div>
                  <div className="font-medium">{formatCurrency(pgblAnnualMax)} ao ano ({formatCurrency(pgblMonthlySuggest)}/mês)</div>
                </div>
              </div>

              <div className="bg-accent/5 p-4 rounded-lg border border-accent/30">
                <div className="text-sm">
                  Consideraremos despesas dedutíveis, dependentes, previdência e outras particularidades para
                  confirmar o regime de IR mais eficiente.
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
                Informe abaixo os dados anuais dedutíveis para comparar os modelos de declaração.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Renda Tributável (ano) {includeSpouse ? '(cliente + cônjuge)' : '(cliente principal)'}
                  </div>
                  <div className="font-medium">{formatCurrency(rendaTributavelAnual)}</div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Dependentes</label>
                  <Input type="number" min={0} value={numDependentes}
                    onChange={(e) => setNumDependentes(Number((e.target as HTMLInputElement).value) || 0)} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Gastos com Educação (ano)</label>
                  <CurrencyInput value={gastoEducacao}
                    onChange={(v) => setGastoEducacao(v)} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Despesas de Saúde (ano)</label>
                  <CurrencyInput value={gastoSaude}
                    onChange={(v) => setGastoSaude(v)} />
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-4">
                <div className="md:col-span-2 bg-muted/50 p-4 rounded-lg border border-border/50">
                  <div className="text-sm text-muted-foreground mb-1">Contribuições PGBL (ano)</div>
                  <div className="font-medium">{formatCurrency(pgblAnual)}</div>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg border border-border/50">
                  <div className="text-sm text-muted-foreground mb-1">Modelo recomendável</div>
                  <div className="font-medium">{irpf.recommendedModel}</div>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg border border-border/50">
                  <div className="text-sm text-muted-foreground mb-1">Alíquota efetiva (recomendado)</div>
                  <div className="font-medium">{(irpf.recommendedModel === 'Completo' ? irpf.complete.effectiveRate : irpf.recommendedModel === 'Simplificado' ? irpf.simplified.effectiveRate : Math.min(irpf.complete.effectiveRate, irpf.simplified.effectiveRate)).toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 })}</div>
                </div>
              </div>


              {/* Detalhes dos Cálculos e Projeção Integrados */}
              <div className="mt-8">
                <h4 className="text-lg font-semibold mb-6">Detalhamento dos Cálculos e Projeção de Economia</h4>

                {/* Layout Principal - 2 colunas principais */}
                <div className="grid lg:grid-cols-2 gap-8">
                  
                  {/* Coluna Esquerda - Comparativo dos Modelos */}
                  <div className="space-y-6">
                    <h5 className="text-md font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Calculator size={18} className="text-accent" />
                      Comparativo dos Modelos de Declaração
                    </h5>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Modelo Completo - Detalhes */}
                      <div className="bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/30 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                            <Calculator size={16} className="text-accent" />
                          </div>
                          <h6 className="font-semibold text-accent">Modelo Completo</h6>
                        </div>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between items-center py-2 border-b border-accent/20">
                            <span className="text-foreground font-medium">Renda Tributável</span>
                            <span className="font-semibold text-accent">{formatCurrency(rendaTributavelAnual)}</span>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="text-foreground font-medium text-xs">Deduções Legais:</div>
                            
                            <div className="flex justify-between items-center pl-3 text-xs">
                              <span className="text-muted-foreground">• PGBL (12%)</span>
                              <span className="font-medium text-foreground">{formatCurrency(Math.min(pgblAnual, rendaTributavelAnual * 0.12))}</span>
                            </div>
                            
                            <div className="flex justify-between items-center pl-3 text-xs">
                              <span className="text-muted-foreground">• Dependentes ({numDependentes})</span>
                              <span className="font-medium text-foreground">{formatCurrency(numDependentes * 2275.08)}</span>
                            </div>
                            
                            <div className="flex justify-between items-center pl-3 text-xs">
                              <span className="text-muted-foreground">• Educação</span>
                              <span className="font-medium text-foreground">{formatCurrency(Math.min(gastoEducacao, (numDependentes + 1) * 3561.50))}</span>
                            </div>
                            
                            <div className="flex justify-between items-center pl-3 text-xs">
                              <span className="text-muted-foreground">• Saúde</span>
                              <span className="font-medium text-foreground">{formatCurrency(gastoSaude)}</span>
                            </div>
                            
                            <div className="flex justify-between items-center py-2 border-t border-accent/20 font-semibold">
                              <span className="text-foreground">Total Deduções</span>
                              <span className="text-accent">{formatCurrency(Math.min(pgblAnual, rendaTributavelAnual * 0.12) + (numDependentes * 2275.08) + Math.min(gastoEducacao, (numDependentes + 1) * 3561.50) + gastoSaude)}</span>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center py-2 border-b border-accent/20">
                            <span className="text-foreground font-medium">Base de Cálculo</span>
                            <span className="font-semibold text-accent">{formatCurrency(irpf.complete.taxableBase)}</span>
                          </div>
                          
                          <div className="bg-accent/10 p-3 rounded-lg">
                            <div className="text-foreground font-medium mb-2 text-xs">Tabela Progressiva:</div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <div>• Até R$ 27.110,40: Isento</div>
                              <div>• R$ 27.110,41 a R$ 33.919,80: 7,5%</div>
                              <div>• R$ 33.919,81 a R$ 45.012,60: 15%</div>
                              <div>• R$ 45.012,61 a R$ 55.976,16: 22,5%</div>
                              <div>• Acima de R$ 55.976,16: 27,5%</div>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center py-2 border-t border-accent/30 font-semibold bg-accent/5 rounded-lg px-3">
                            <span className="text-foreground">Imposto Devido</span>
                            <span className="text-accent text-lg">{formatCurrency(irpf.complete.taxDue)}</span>
                          </div>
                          
                          <div className="flex justify-between items-center py-2 border-t border-accent/30 font-semibold bg-accent/5 rounded-lg px-3">
                            <span className="text-foreground">Alíquota Efetiva</span>
                            <span className="text-accent text-lg">{irpf.complete.effectiveRate.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>

                      {/* Modelo Simplificado - Detalhes */}
                      <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/30 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <Calculator size={16} className="text-primary" />
                          </div>
                          <h6 className="font-semibold text-primary">Modelo Simplificado</h6>
                        </div>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between items-center py-2 border-b border-primary/20">
                            <span className="text-foreground font-medium">Renda Tributável</span>
                            <span className="font-semibold text-primary">{formatCurrency(rendaTributavelAnual)}</span>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="text-foreground font-medium text-xs">Desconto Simplificado:</div>
                            
                            <div className="flex justify-between items-center pl-3 text-xs">
                              <span className="text-muted-foreground">• 20% da renda</span>
                              <span className="font-medium text-primary">{formatCurrency(Math.min(rendaTributavelAnual * 0.20, 16754.34))}</span>
                            </div>
                            
                            <div className="text-xs text-muted-foreground bg-primary/10 p-2 rounded">
                              <strong>Fórmula:</strong> min(renda × 20%, R$ 16.754,34)
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center py-2 border-b border-primary/20">
                            <span className="text-foreground font-medium">Base de Cálculo</span>
                            <span className="font-semibold text-primary">{formatCurrency(irpf.simplified.taxableBase)}</span>
                          </div>
                          
                          <div className="bg-primary/10 p-3 rounded-lg">
                            <div className="text-foreground font-medium mb-2 text-xs">Tabela Progressiva:</div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <div>• Até R$ 27.110,40: Isento</div>
                              <div>• R$ 27.110,41 a R$ 33.919,80: 7,5%</div>
                              <div>• R$ 33.919,81 a R$ 45.012,60: 15%</div>
                              <div>• R$ 45.012,61 a R$ 55.976,16: 22,5%</div>
                              <div>• Acima de R$ 55.976,16: 27,5%</div>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center py-2 border-t border-primary/30 font-semibold bg-primary/5 rounded-lg px-3">
                            <span className="text-foreground">Imposto Devido</span>
                            <span className="text-primary text-lg">{formatCurrency(irpf.simplified.taxDue)}</span>
                          </div>
                          
                          <div className="flex justify-between items-center py-2 border-t border-primary/30 font-semibold bg-primary/5 rounded-lg px-3">
                            <span className="text-foreground">Alíquota Efetiva</span>
                            <span className="text-primary text-lg">{irpf.simplified.effectiveRate.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Coluna Direita - Projeção de Economia */}
                  <div className="bg-gradient-to-br from-muted/10 to-muted/20 border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                        <Calculator size={16} className="text-accent" />
                      </div>
                      <h5 className="font-semibold text-foreground">Projeção de Economia Tributária</h5>
                    </div>
                    
                    <div className="space-y-6">
                      {/* Economia Anual Projetada */}
                      <div>
                        <h6 className="text-sm font-semibold text-foreground mb-3">Economia Anual Projetada</h6>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-3 px-4 bg-accent/5 border border-accent/20 rounded-lg">
                            <span className="text-sm text-muted-foreground">Economia anual atual</span>
                            <span className="font-bold text-accent text-lg">
                              {formatCurrency(Math.abs(irpf.complete.taxDue - irpf.simplified.taxDue))}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2 px-4 bg-muted/30 rounded-lg">
                            <span className="text-sm text-muted-foreground">5 anos</span>
                            <span className="font-semibold text-primary">
                              {formatCurrency(Math.abs(irpf.complete.taxDue - irpf.simplified.taxDue) * 5)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2 px-4 bg-muted/30 rounded-lg">
                            <span className="text-sm text-muted-foreground">10 anos</span>
                            <span className="font-semibold text-primary">
                              {formatCurrency(Math.abs(irpf.complete.taxDue - irpf.simplified.taxDue) * 10)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2 px-4 bg-muted/30 rounded-lg">
                            <span className="text-sm text-muted-foreground">20 anos</span>
                            <span className="font-semibold text-accent">
                              {formatCurrency(Math.abs(irpf.complete.taxDue - irpf.simplified.taxDue) * 20)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Cenários de Crescimento */}
                      <div>
                        <h6 className="text-sm font-semibold text-foreground mb-3">Cenários de Crescimento</h6>
                        <div className="space-y-3">
                          <div className="bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/30 rounded-lg p-4">
                            <div className="text-sm font-semibold text-accent mb-1">Cenário Conservador (10% a.a.)</div>
                            <div className="text-xs text-muted-foreground">
                              Economia em 10 anos: <span className="font-semibold text-accent">{formatCurrency(Math.abs(irpf.complete.taxDue - irpf.simplified.taxDue) * 15.94)}</span>
                            </div>
                          </div>
                          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg p-4">
                            <div className="text-sm font-semibold text-primary mb-1">Cenário Moderado (15% a.a.)</div>
                            <div className="text-xs text-muted-foreground">
                              Economia em 10 anos: <span className="font-semibold text-primary">{formatCurrency(Math.abs(irpf.complete.taxDue - irpf.simplified.taxDue) * 20.30)}</span>
                            </div>
                          </div>
                          <div className="bg-gradient-to-r from-muted/20 to-muted/10 border border-border rounded-lg p-4">
                            <div className="text-sm font-semibold text-foreground mb-1">Cenário Otimista (20% a.a.)</div>
                            <div className="text-xs text-muted-foreground">
                              Economia em 10 anos: <span className="font-semibold text-foreground">{formatCurrency(Math.abs(irpf.complete.taxDue - irpf.simplified.taxDue) * 25.96)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 p-4 bg-accent/5 border border-accent/20 rounded-lg">
                      <div className="text-xs text-muted-foreground">
                        <strong>Nota:</strong> Os cenários consideram a economia anual como um "aporte" que se repete a cada ano, 
                        aplicando a fórmula de valor futuro de uma série de pagamentos iguais (anualidade). 
                        Os percentuais representam o crescimento da renda e consequente aumento da economia tributária.
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
