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
    return <div>Dados de proteção patrimonial não disponíveis</div>;
  }

  // Dados base para cálculos
  const rendaAnualInformada = Number(protectionData?.analiseNecessidades?.rendaAnual) || 0;
  const rendaMensalPorRendaAnual = rendaAnualInformada > 0 ? rendaAnualInformada / 12 : 0;
  const rendaMensalPorRendas = Array.isArray(data?.financas?.rendas)
    ? data.financas.rendas.reduce((acc: number, r: any) => acc + (Number(r?.valor) || 0), 0)
    : 0;
  const rendaMensal = rendaMensalPorRendaAnual || rendaMensalPorRendas || 0;
  const rendaAnualBase = rendaAnualInformada || (rendaMensalPorRendas * 12);

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
  const capitalAssistenciaFuneral = 12000;
  const capitalInvalidezPermanente = rendaMensal * 1.25 * 60;
  const valorDiarioDIT = rendaMensal / 30; // Exibido como valor diário
  const capitalDoencasGraves = rendaMensal * 12;
  const capitalCirurgia = 50000; // base ajustável

  // Formação dos filhos: gasto educação mensal × 13 × anos restantes até 21 anos
  const gastoEducacaoMensal = Number(protectionData?.analiseNecessidades?.gastoEducacaoMensal) || 0;
  const idadesDependentes: number[] = Array.isArray((protectionData?.analiseNecessidades as any)?.idadesDependentes)
    ? ((protectionData?.analiseNecessidades as any)?.idadesDependentes as number[])
    : (Array.isArray((data as any)?.cliente?.dependentes)
      ? ((data as any).cliente.dependentes as any[]).map((d: any) => Number(d?.idade) || 0)
      : []);
  let anosRestantesAte21 = 0;
  if (idadesDependentes.length > 0) {
    anosRestantesAte21 = idadesDependentes.reduce((acc: number, idade: number) => acc + Math.max(0, 21 - (Number(idade) || 0)), 0);
  } else {
    const nDeps = Number(protectionData?.analiseNecessidades?.numeroDependentes) || 0;
    const anosSuporte = Number(protectionData?.analiseNecessidades?.anosSuporteDependentes) || 0;
    anosRestantesAte21 = nDeps * anosSuporte;
  }
  const capitalFormacaoFilhos = gastoEducacaoMensal * 13 * anosRestantesAte21;

  return (
    <section className="py-16 px-4" id="protection">
      <div className="container mx-auto max-w-5xl">
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
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-lg font-medium mb-3">Parâmetros Principais</h4>
                <ul className="space-y-3">
                  <li className="flex items-center justify-between">
                    <span className="text-muted-foreground">Renda Anual (base)</span>
                    <span className="font-medium">{formatCurrency(rendaAnualBase)}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-muted-foreground">Patrimônio Total</span>
                    <span className="font-medium">{formatCurrency(patrimonioTotal)}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-muted-foreground">Participação Empresarial</span>
                    <span className="font-medium">{protectionData.analiseNecessidades.atividadeEmpresarial}</span>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-lg font-medium mb-3">Dados Complementares</h4>
                <ul className="space-y-3">
                  <li className="flex items-center justify-between">
                    <span className="text-muted-foreground">Dependentes</span>
                    <span className="font-medium">{protectionData?.analiseNecessidades?.numeroDependentes} ({protectionData?.analiseNecessidades?.tiposDependentes?.join(", ") ?? ""})</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-muted-foreground">Anos até Aposentadoria</span>
                    <span className="font-medium">{anosAteAposentadoria} anos</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-muted-foreground">Viagens Internacionais</span>
                    <span className="font-medium">{protectionData.analiseNecessidades.viagensInternacionais}</span>
                  </li>
                </ul>
              </div>
            </div>
            {false && (
              <div className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                <span className="font-semibold">Como calculamos:</span>
                <span> Custos com Inventário: patrimônio total × 12% (ITCMD + inventário).</span>
                <span> Reestabelecimento de Padrão de Vida: renda mensal × 12 × anos até aposentadoria.</span>
                <span> Assistência Funeral: valor fixo de R$ 12.000.</span>
                <span> Necessidades por Invalidez: renda mensal × 1,25 × 60.</span>
                <span> Renda Diária por Incapacidade (DIT/DIH): renda mensal ÷ 30.</span>
                <span> Doenças Graves: renda mensal × 12.</span>
                <span> Cirurgia: valor base de R$ 50.000 (ajustável).</span>
              </div>
            )}
          </CardContent>
        </HideableCard>

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
                      <th className="px-2 py-2 text-left font-semibold">&nbsp;</th>
                      <th className="px-2 py-2 text-right font-semibold">Capital Sugerido</th>
                      <th className="px-2 py-2 text-right font-semibold">Apólice Atual</th>
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
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalCustosInventario)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(0)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalCustosInventario)}</td>
                    </tr>
                    <tr className="bg-white hover:bg-muted/50 rounded">
                      <td className="px-2 py-2">
                        <div className="flex flex-col leading-tight">
                          <span>Reestabelecimento de Padrão de Vida</span>
                          <span className="text-[11px] text-muted-foreground">renda anual × anos (limite 200 meses)</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalPadraoVidaFamilia)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(0)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalPadraoVidaFamilia)}</td>
                    </tr>
                    
                    <tr className="bg-white hover:bg-muted/50 rounded">
                      <td className="px-2 py-2">
                        <div className="flex flex-col leading-tight">
                          <span>Despesas até a Formação dos Filhos</span>
                          <span className="text-[11px] text-muted-foreground">educação mensal × 13 × anos até 21</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalFormacaoFilhos)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(0)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalFormacaoFilhos)}</td>
                    </tr>
                    <tr className="bg-white hover:bg-muted/50 rounded">
                      <td className="px-2 py-2">
                        <div className="flex flex-col leading-tight">
                          <span>Morte Acidental</span>
                          <span className="text-[11px] text-muted-foreground">mesmo valor de padrão de vida</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalPadraoVidaFamilia)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(0)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalPadraoVidaFamilia)}</td>
                    </tr>
                    <tr className="bg-white hover:bg-muted/50 rounded">
                      <td className="px-2 py-2">
                        <div className="flex flex-col leading-tight">
                          <span>Assistência Funeral</span>
                          <span className="text-[11px] text-muted-foreground">valor fixo de R$ 12.000</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalAssistenciaFuneral)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(0)}</td>
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
                      <th className="px-2 py-2 text-left font-semibold">&nbsp;</th>
                      <th className="px-2 py-2 text-right font-semibold">Capital Sugerido</th>
                      <th className="px-2 py-2 text-right font-semibold">Apólice Atual</th>
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
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalInvalidezPermanente)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(0)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalInvalidezPermanente)}</td>
                    </tr>
                    <tr className="bg-white hover:bg-muted/50 rounded">
                      <td className="px-2 py-2">
                        <div className="flex flex-col leading-tight">
                          <span>Renda Diária por Incapacidade (DIT/DIH)</span>
                          <span className="text-[11px] text-muted-foreground">renda mensal ÷ 30</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">{formatCurrency(valorDiarioDIT)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(0)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(valorDiarioDIT)}</td>
                    </tr>
                    <tr className="bg-white hover:bg-muted/50 rounded">
                      <td className="px-2 py-2">
                        <div className="flex flex-col leading-tight">
                          <span>Doenças Graves</span>
                          <span className="text-[11px] text-muted-foreground">renda mensal × 12</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalDoencasGraves)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(0)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalDoencasGraves)}</td>
                    </tr>
                    <tr className="bg-white hover:bg-muted/50 rounded">
                      <td className="px-2 py-2">
                        <div className="flex flex-col leading-tight">
                          <span>Cirurgia</span>
                          <span className="text-[11px] text-muted-foreground">valor base de R$ 50.000</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">{formatCurrency(capitalCirurgia)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(0)}</td>
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
