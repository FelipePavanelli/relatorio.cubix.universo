import React from 'react';
import { CircleDollarSign, Shield, Briefcase, Umbrella, Plane, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import HideableCard from '@/components/ui/HideableCard';
import { useCardVisibility } from '@/context/CardVisibilityContext';
import { formatCurrency } from '@/utils/formatCurrency';
import { Separator } from '@/components/ui/separator';

interface ProtectionPlanningProps {
  data: any;
  hideControls?: boolean;
}

const ProtectionPlanning: React.FC<ProtectionPlanningProps> = ({ data, hideControls }) => {
  const protectionData = data?.protecao;
  const { isCardVisible, toggleCardVisibility } = useCardVisibility();

  if (!protectionData) {
    return (
      <div className="py-16 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Dados de Proteção Patrimonial</h2>
          <p className="text-muted-foreground">Dados de proteção patrimonial não disponíveis. Aguarde o carregamento dos dados da API.</p>
        </div>
      </div>
    );
  }

  // Verificar se data está disponível
  if (!data) {
    return (
      <div className="py-16 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Dados Não Disponíveis</h2>
          <p className="text-muted-foreground">Aguarde o carregamento dos dados da API.</p>
        </div>
      </div>
    );
  }

  // Helpers: identificar renda do cônjuge para não somar nos totais
  const normalize = (s: string) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const isSpouseIncome = (renda: any) => {
    const label = normalize(renda?.descricao || renda?.origem || renda?.fonte || '');
    return label.includes('conjuge') || label.includes('conjuge clt');
  };

  // Dados base para cálculos - APENAS renda do cliente principal (excluindo cônjuge)
  // Filtrar rendas para excluir cônjuge
  const rendasClientePrincipal = Array.isArray(data?.financas?.rendas)
    ? data.financas.rendas.filter((r: any) => !isSpouseIncome(r))
    : [];
  const rendaMensalPorRendas = rendasClientePrincipal.reduce((acc: number, r: any) => acc + (Number(r?.valor) || 0), 0);
  
  // Usar apenas renda do cliente principal (ignorar dados mockados que podem incluir cônjuge)
  const rendaMensal = rendaMensalPorRendas || 0;
  const rendaAnualBase = rendaMensalPorRendas * 12;

  // Patrimônio total para Sucessão Patrimonial (custos de inventário/ITCMD)
  const patrimonioTotal =
    Number(data?.sucessao?.situacaoAtual?.patrimonioTotal) ||
    Number(protectionData?.analiseNecessidades?.patrimonioTotal) ||
    Number(data?.financas?.resumo?.patrimonio_liquido) ||
    0;

  const anosAteAposentadoria = Number(data?.aposentadoria?.anosRestantes) || 0;

  // Fórmulas padronizadas
  const capitalCustosInventario = patrimonioTotal * 0.12; // ITCMD + inventário (~12%)
  const mesesPadraoVida = Math.min(Math.max(anosAteAposentadoria, 0) * 12, 200);
  const anosConsiderados = mesesPadraoVida / 12; // cap de 200 meses convertido em anos
  const capitalPadraoVidaFamilia = rendaAnualBase * anosConsiderados;
  const capitalAssistenciaFuneral = 12000; // R$ 12.000 - valor fixo mockado
  const capitalInvalidezPermanente = rendaMensal * 1.25 * 60;
  const valorDiarioDIT = rendaMensal / 30; // Exibido como valor diário
  const capitalDoencasGraves = rendaMensal * 12;
  const capitalCirurgia = 50000; // R$ 50.000 - valor fixo mockado

  // Exibir/ocultar coluna "Apólice Atual"
  const showApoliceAtual = false;

  // Formação dos filhos: gasto educação mensal × 13 × anos restantes até 21 anos
  const gastoEducacaoMensal = Number(protectionData?.analiseNecessidades?.gastoEducacaoMensal) || 0;
  
  // Extrair idades dos dependentes do JSON
  const idadesDependentes: number[] = Array.isArray((data as any)?.cliente?.dependentes)
    ? ((data as any).cliente.dependentes as any[]).map((d: any) => Number(d?.idade) || 0)
    : [];
  
  // Calcular anos restantes até 21 anos para cada dependente
  let anosRestantesAte21 = 0;
  if (idadesDependentes.length > 0) {
    anosRestantesAte21 = idadesDependentes.reduce((acc: number, idade: number) => {
      const anosRestantes = Math.max(0, 21 - idade);
      return acc + anosRestantes;
    }, 0);
  } else {
    // Fallback: usar dados da análise de necessidades se disponível
    const nDeps = Number(protectionData?.analiseNecessidades?.numeroDependentes) || 0;
    const anosSuporte = Number(protectionData?.analiseNecessidades?.anosSuporteDependentes) || 0;
    anosRestantesAte21 = nDeps * anosSuporte;
  }
  
  // Se não há gasto de educação definido, usar um valor padrão baseado na renda do cliente principal
  const gastoEducacaoMensalFinal = gastoEducacaoMensal > 0 
    ? gastoEducacaoMensal 
    : rendaMensal * 0.1; // 10% da renda mensal do cliente como estimativa para educação
  
  const capitalFormacaoFilhos = gastoEducacaoMensalFinal * 13 * anosRestantesAte21;

  return (
    <section className="py-16 px-4" id="protection">
      <div className="section-container">
        <div className="mb-12 text-center">
          <div className="inline-block">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-accent/10 p-3 rounded-full">
                <Shield size={28} className="text-accent" />
              </div>
            </div>
            <h2 className="text-4xl font-bold mb-3">6. Proteção Patrimonial</h2>
            <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
              {protectionData.resumo}
            </p>
          </div>
        </div>

        {/* Insurance Needs Analysis */}
        <HideableCard
          id="analise-necessidades"
          isVisible={isCardVisible("analise-necessidades")}
          onToggleVisibility={() => toggleCardVisibility("analise-necessidades")}
          hideControls={hideControls}
          className="mb-10"
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-accent" />
              <div>
                <CardTitle>Base de Cálculo dos Seguros</CardTitle>
                <CardDescription>Campos utilizados nos cálculos de capital segurado</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="text-sm text-muted-foreground">Renda Anual (cliente principal)</div>
                <div className="text-xl font-semibold mt-1">{formatCurrency(rendaAnualBase)}</div>
              </div>
              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="text-sm text-muted-foreground">Patrimônio Total</div>
                <div className="text-xl font-semibold mt-1">{formatCurrency(patrimonioTotal)}</div>
              </div>
              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="text-sm text-muted-foreground">Participação Empresarial</div>
                <div className="text-xl font-semibold mt-1">{String(protectionData?.analiseNecessidades?.atividadeEmpresarial ?? '—')}</div>
              </div>
              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="text-sm text-muted-foreground">Dependentes</div>
                <div className="text-xl font-semibold mt-1">{protectionData?.analiseNecessidades?.numeroDependentes} ({protectionData?.analiseNecessidades?.tiposDependentes?.join(", ") ?? ""})</div>
              </div>
              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="text-sm text-muted-foreground">Anos até Aposentadoria</div>
                <div className="text-xl font-semibold mt-1">{anosAteAposentadoria} anos</div>
              </div>
              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="text-sm text-muted-foreground">Viagens Internacionais</div>
                <div className="text-xl font-semibold mt-1">{String(protectionData?.analiseNecessidades?.viagensInternacionais ?? '—')}</div>
              </div>
            </div>
            {false && (
              <div className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                <span className="font-semibold">Como calculamos:</span>
                <span> Custos com Inventário: patrimônio total × 12% (ITCMD + inventário).</span>
                <span> Reestabelecimento de Padrão de Vida: renda mensal × 12 × anos até aposentadoria.</span>
                <span> Assistência Funeral: valor definido nos dados.</span>
                <span> Necessidades por Invalidez: renda mensal × 1,25 × 60.</span>
                <span> Renda Diária por Incapacidade (DIT/DIH): renda mensal ÷ 30.</span>
                <span> Doenças Graves: renda mensal × 12.</span>
                <span> Cirurgia: valor definido nos dados.</span>
              </div>
            )}
          </CardContent>
        </HideableCard>

        {/* Dependência de Renda e Revisão */}
        <HideableCard
          id="dependencia-renda"
          isVisible={isCardVisible("dependencia-renda")}
          onToggleVisibility={() => toggleCardVisibility("dependencia-renda")}
          hideControls={hideControls}
          className="mb-10"
        >
          <CardHeader>
            <CardTitle>Dependência de Renda e Revisão</CardTitle>
            <CardDescription>Informações declaradas sobre a dependência de renda e interesse de revisão</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="text-sm text-muted-foreground">Dependência da renda ativa</div>
                <div className="text-xl font-semibold mt-1">{protectionData?.dependenciaRenda === true ? 'Sim' : protectionData?.dependenciaRenda === false ? 'Não' : '—'}</div>
              </div>
              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="text-sm text-muted-foreground">Impacto da perda de renda</div>
                <div className="text-xl font-semibold mt-1">{protectionData?.impactoPerdaRenda || '—'}</div>
              </div>
              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="text-sm text-muted-foreground">Deseja revisão das proteções</div>
                <div className="text-xl font-semibold mt-1">{protectionData?.desejaRevisao === true ? 'Sim' : protectionData?.desejaRevisao === false ? 'Não' : '—'}</div>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-6 mt-6">
              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="text-sm text-muted-foreground">Patrimônio em nome próprio</div>
                <div className="text-xl font-semibold mt-1">{formatCurrency(Number(protectionData?.patrimonioEmNomeProprio || 0))}</div>
              </div>
              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="text-sm text-muted-foreground">Solução de inventário</div>
                <div className="text-xl font-semibold mt-1">{protectionData?.solucaoInventario || '—'}</div>
              </div>
              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="text-sm text-muted-foreground">Soluções existentes</div>
                <div className="mt-2">
                  {Array.isArray(protectionData?.solucoesExistentes) && protectionData.solucoesExistentes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {protectionData.solucoesExistentes.map((solucao: string, index: number) => (
                        <span key={index} className="inline-block bg-accent/10 text-accent text-sm px-3 py-1 rounded-full">
                          {solucao}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xl font-semibold text-muted-foreground">Nenhuma informada</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </HideableCard>

        {/* Seguros Existentes */}
        {Array.isArray(protectionData?.segurosExistentes) && protectionData.segurosExistentes.length > 0 && (
          <HideableCard
            id="seguros-existentes"
            isVisible={isCardVisible("seguros-existentes")}
            onToggleVisibility={() => toggleCardVisibility("seguros-existentes")}
            hideControls={hideControls}
            className="mb-10"
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <Umbrella className="h-8 w-8 text-accent" />
                <div>
                  <CardTitle>Seguros Existentes</CardTitle>
                  <CardDescription>Proteções já contratadas pelo cliente</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                {protectionData.segurosExistentes.map((seguro: any, index: number) => (
                  <div key={index} className="p-6 rounded-xl border-2 border-muted/30 bg-gradient-to-br from-background to-muted/10 hover:shadow-lg transition-all duration-300">
                    {/* Header do Seguro */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                          <Umbrella className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                          <h4 className="text-xl font-bold text-foreground">{seguro.tipo}</h4>
                          {seguro.seguradora && (
                            <p className="text-sm text-muted-foreground">{seguro.seguradora}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-accent">{formatCurrency(seguro.cobertura_atual || 0)}</div>
                        <div className="text-xs text-muted-foreground">Cobertura Atual</div>
                      </div>
                    </div>

                    {/* Informações Principais */}
                    <div className="grid md:grid-cols-3 gap-6 mb-6">
                      {seguro.premio_anual && (
                        <div className="p-4 rounded-lg bg-muted/20 border">
                          <div className="text-sm text-muted-foreground mb-1">Prêmio Anual</div>
                          <div className="text-lg font-semibold">{formatCurrency(seguro.premio_anual)}</div>
                        </div>
                      )}
                      {seguro.validade && (
                        <div className="p-4 rounded-lg bg-muted/20 border">
                          <div className="text-sm text-muted-foreground mb-1">Validade</div>
                          <div className="text-lg font-semibold">{seguro.validade}</div>
                        </div>
                      )}
                      {Array.isArray(seguro.beneficiarios) && seguro.beneficiarios.length > 0 && (
                        <div className="p-4 rounded-lg bg-muted/20 border">
                          <div className="text-sm text-muted-foreground mb-2">Beneficiários</div>
                          <div className="flex flex-wrap gap-1">
                            {seguro.beneficiarios.map((beneficiario: string, i: number) => (
                              <span key={i} className="inline-flex items-center px-2 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
                                {beneficiario}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Observações */}
                    {seguro.observacoes && (
                      <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-200">
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-sm font-medium text-blue-900 mb-1">Observações</div>
                            <p className="text-sm text-blue-800 leading-relaxed">{seguro.observacoes}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </HideableCard>
        )}

        {/* Tabela Visual de Riscos */}
        <HideableCard
          id="tabela-seguros"
          isVisible={isCardVisible("tabela-seguros")}
          onToggleVisibility={() => toggleCardVisibility("tabela-seguros")}
          hideControls={hideControls}
          className="mb-10"
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield size={28} className="text-accent" />
                  Gestão de Riscos
                </CardTitle>
                <CardDescription>Tabela visual de riscos sugeridos e soluções</CardDescription>
              </div>
              <div />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              {/* Riscos em Morte */}
              <div className="bg-white border rounded-lg shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-base">Riscos em Morte</span>
                  <span className="text-muted-foreground text-xs">▼</span>
                </div>
                <table className="min-w-full text-sm border-separate border-spacing-y-1">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold">Risco</th>
                      <th className="px-2 py-2 text-right font-semibold">Valores Utilizados</th>
                      {false && (
                        <th className="px-2 py-2 text-right font-semibold">Capital Sugerido</th>
                      )}
                      {showApoliceAtual && (
                        <th className="px-2 py-2 text-right font-semibold">Apólice Atual</th>
                      )}
                      <th className="px-2 py-2 text-right font-semibold">Total de Capital Sugerido</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white hover:bg-muted/50 rounded">
                      <td className="px-2 py-2">
                        <div className="flex flex-col leading-tight">
                          <span>Custos com Inventário</span>
                          <span className="text-[11px] text-muted-foreground">patrimônio total × 12%</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(patrimonioTotal)} × 12%
                        </div>
                      </td>
                      {false && (
                        <td className="px-2 py-2 text-right">{formatCurrency(capitalCustosInventario)}</td>
                      )}
                      {showApoliceAtual && (
                        <td className="px-2 py-2 text-right">{formatCurrency(0)}</td>
                      )}
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalCustosInventario)}</td>
                    </tr>
                    <tr className="bg-white hover:bg-muted/50 rounded">
                      <td className="px-2 py-2">
                        <div className="flex flex-col leading-tight">
                          <span>Reestabelecimento de Padrão de Vida</span>
                          <span className="text-[11px] text-muted-foreground">renda anual × anos (limite 200 meses)</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(rendaAnualBase)} × {anosConsiderados.toFixed(1)} anos
                        </div>
                      </td>
                      {false && (
                        <td className="px-2 py-2 text-right">{formatCurrency(capitalPadraoVidaFamilia)}</td>
                      )}
                      {showApoliceAtual && (
                        <td className="px-2 py-2 text-right">{formatCurrency(0)}</td>
                      )}
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalPadraoVidaFamilia)}</td>
                    </tr>
                    
                    {false && (
                      <tr className="bg-white hover:bg-muted/50 rounded">
                        <td className="px-2 py-2">
                          <div className="flex flex-col leading-tight">
                            <span>Despesas até a Formação dos Filhos</span>
                            <span className="text-[11px] text-muted-foreground">educação mensal × 13 × anos até 21</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(gastoEducacaoMensalFinal)} × 13 × {anosRestantesAte21} anos
                          </div>
                        </td>
                        {false && (
                          <td className="px-2 py-2 text-right">{formatCurrency(capitalFormacaoFilhos)}</td>
                        )}
                        {showApoliceAtual && (
                          <td className="px-2 py-2 text-right">{formatCurrency(0)}</td>
                        )}
                        <td className="px-2 py-2 text-right">{formatCurrency(capitalFormacaoFilhos)}</td>
                      </tr>
                    )}
                    <tr className="bg-white hover:bg-muted/50 rounded">
                      <td className="px-2 py-2">
                        <div className="flex flex-col leading-tight">
                          <span>Morte Acidental</span>
                          <span className="text-[11px] text-muted-foreground">mesmo valor de padrão de vida</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="text-xs text-muted-foreground">
                          = Padrão de Vida
                        </div>
                      </td>
                      {false && (
                        <td className="px-2 py-2 text-right">{formatCurrency(capitalPadraoVidaFamilia)}</td>
                      )}
                      {showApoliceAtual && (
                        <td className="px-2 py-2 text-right">{formatCurrency(0)}</td>
                      )}
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalPadraoVidaFamilia)}</td>
                    </tr>
                    <tr className="bg-white hover:bg-muted/50 rounded">
                      <td className="px-2 py-2">
                        <div className="flex flex-col leading-tight">
                          <span>Assistência Funeral</span>
                          <span className="text-[11px] text-muted-foreground">valor definido nos dados</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="text-xs text-muted-foreground">
                          Valor fixo
                        </div>
                      </td>
                      {false && (
                        <td className="px-2 py-2 text-right">{formatCurrency(capitalAssistenciaFuneral)}</td>
                      )}
                      {showApoliceAtual && (
                        <td className="px-2 py-2 text-right">{formatCurrency(0)}</td>
                      )}
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalAssistenciaFuneral)}</td>
                    </tr>
                  </tbody>
                </table>
                {false && (
                  <div className="mt-4">
                    <span className="font-semibold text-sm mb-1 block">Soluções Sugeridas</span>
                    <table className="min-w-full text-sm border-separate border-spacing-y-1">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-2 py-2 text-left font-semibold">&nbsp;</th>
                          <th className="px-2 py-2 text-right font-semibold">MAG</th>
                          <th className="px-2 py-2 text-right font-semibold">Prudential</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white hover:bg-muted/50 rounded"><td className="px-2 py-2">&nbsp;</td><td className="px-2 py-2 text-right">0,00</td><td className="px-2 py-2 text-right">0,00</td></tr>
                        <tr className="bg-white hover:bg-muted/50 rounded"><td className="px-2 py-2">&nbsp;</td><td className="px-2 py-2 text-right">0,00</td><td className="px-2 py-2 text-right">0,00</td></tr>
                        <tr className="bg-white hover:bg-muted/50 rounded"><td className="px-2 py-2">&nbsp;</td><td className="px-2 py-2 text-right">0,00</td><td className="px-2 py-2 text-right">0,00</td></tr>
                        <tr className="bg-white hover:bg-muted/50 rounded"><td className="px-2 py-2">&nbsp;</td><td className="px-2 py-2 text-right">0,00</td><td className="px-2 py-2 text-right">0,00</td></tr>
                        <tr className="bg-white hover:bg-muted/50 rounded"><td className="px-2 py-2">&nbsp;</td><td className="px-2 py-2 text-right">0,00</td><td className="px-2 py-2 text-right">0,00</td></tr>
                        <tr className="bg-white hover:bg-muted/50 rounded"><td className="px-2 py-2">&nbsp;</td><td className="px-2 py-2 text-right">0,00</td><td className="px-2 py-2 text-right">0,00</td></tr>
                        <tr className="bg-white hover:bg-muted/50 rounded font-bold"><td className="px-2 py-2">Total</td><td className="px-2 py-2 text-right">0,00</td><td className="px-2 py-2 text-right">0,00</td></tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              {/* Riscos em Vida */}
              <div className="bg-white border rounded-lg shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-base">Riscos em Vida</span>
                  <span className="text-muted-foreground text-xs">▼</span>
                </div>
                <table className="min-w-full text-sm border-separate border-spacing-y-1">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold">Risco</th>
                      <th className="px-2 py-2 text-right font-semibold">Valores Utilizados</th>
                      {false && (
                        <th className="px-2 py-2 text-right font-semibold">Capital Sugerido</th>
                      )}
                      {showApoliceAtual && (
                        <th className="px-2 py-2 text-right font-semibold">Apólice Atual</th>
                      )}
                      <th className="px-2 py-2 text-right font-semibold">Total de Capital Sugerido</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white hover:bg-muted/50 rounded">
                      <td className="px-2 py-2">
                        <div className="flex flex-col leading-tight">
                          <span>Necessidades por Invalidez</span>
                          <span className="text-[11px] text-muted-foreground">renda mensal × 1,25 × 60</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(rendaMensal)} × 1,25 × 60
                        </div>
                      </td>
                      {false && (
                        <td className="px-2 py-2 text-right">{formatCurrency(capitalInvalidezPermanente)}</td>
                      )}
                      {showApoliceAtual && (
                        <td className="px-2 py-2 text-right">{formatCurrency(0)}</td>
                      )}
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalInvalidezPermanente)}</td>
                    </tr>
                    <tr className="bg-white hover:bg-muted/50 rounded">
                      <td className="px-2 py-2">
                        <div className="flex flex-col leading-tight">
                          <span>Renda Diária por Incapacidade (DIT/DIH)</span>
                          <span className="text-[11px] text-muted-foreground">renda mensal ÷ 30</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(rendaMensal)} ÷ 30
                        </div>
                      </td>
                      {false && (
                        <td className="px-2 py-2 text-right">{formatCurrency(valorDiarioDIT)}</td>
                      )}
                      {showApoliceAtual && (
                        <td className="px-2 py-2 text-right">{formatCurrency(0)}</td>
                      )}
                      <td className="px-2 py-2 text-right">{formatCurrency(valorDiarioDIT)}</td>
                    </tr>
                    <tr className="bg-white hover:bg-muted/50 rounded">
                      <td className="px-2 py-2">
                        <div className="flex flex-col leading-tight">
                          <span>Doenças Graves</span>
                          <span className="text-[11px] text-muted-foreground">renda mensal × 12</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(rendaMensal)} × 12
                        </div>
                      </td>
                      {false && (
                        <td className="px-2 py-2 text-right">{formatCurrency(capitalDoencasGraves)}</td>
                      )}
                      {showApoliceAtual && (
                        <td className="px-2 py-2 text-right">{formatCurrency(0)}</td>
                      )}
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalDoencasGraves)}</td>
                    </tr>
                    <tr className="bg-white hover:bg-muted/50 rounded">
                      <td className="px-2 py-2">
                        <div className="flex flex-col leading-tight">
                          <span>Cirurgia</span>
                          <span className="text-[11px] text-muted-foreground">valor definido nos dados</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="text-xs text-muted-foreground">
                          Valor fixo
                        </div>
                      </td>
                      {false && (
                        <td className="px-2 py-2 text-right">{formatCurrency(capitalCirurgia)}</td>
                      )}
                      {showApoliceAtual && (
                        <td className="px-2 py-2 text-right">{formatCurrency(0)}</td>
                      )}
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalCirurgia)}</td>
                    </tr>
                  </tbody>
                </table>
                {false && (
                  <div className="mt-4">
                    <span className="font-semibold text-sm mb-1 block">Soluções Sugeridas</span>
                    <table className="min-w-full text-sm border-separate border-spacing-y-1">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-2 py-2 text-left font-semibold">&nbsp;</th>
                          <th className="px-2 py-2 text-right font-semibold">MAG</th>
                          <th className="px-2 py-2 text-right font-semibold">Prudential</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white hover:bg-muted/50 rounded"><td className="px-2 py-2">&nbsp;</td><td className="px-2 py-2 text-right">0,00</td><td className="px-2 py-2 text-right">0,00</td></tr>
                        <tr className="bg-white hover:bg-muted/50 rounded"><td className="px-2 py-2">&nbsp;</td><td className="px-2 py-2 text-right">0,00</td><td className="px-2 py-2 text-right">0,00</td></tr>
                        <tr className="bg-white hover:bg-muted/50 rounded font-bold"><td className="px-2 py-2">Total</td><td className="px-2 py-2 text-right">0,00</td><td className="px-2 py-2 text-right">0,00</td></tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </HideableCard>

        {/* Legal Protection */}
        {/* Removido conforme solicitado */}

        
      </div>
    </section>
  );
};

export default ProtectionPlanning;
