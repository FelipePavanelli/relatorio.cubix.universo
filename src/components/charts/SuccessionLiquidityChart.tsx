import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { formatCurrency } from '@/utils/formatCurrency';
import { ChartContainer } from '@/components/ui/chart';
import { chartPalette } from '@/theme/chartPalette';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import HideableCard from '@/components/ui/HideableCard';
import { useCardVisibility } from '@/context/CardVisibilityContext';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { TrendingUp, Pencil } from 'lucide-react';
import { CurrencyInput } from '@/components/ui/CurrencyInput';

interface SuccessionLiquidityChartProps {
  data?: any;
  hideControls?: boolean;
}

const SuccessionLiquidityChart: React.FC<SuccessionLiquidityChartProps> = ({ data, hideControls }) => {
  const cardRef = useScrollAnimation();
  const { isCardVisible, toggleCardVisibility } = useCardVisibility();

  // Patrimônio Líquido (Ativos - Passivos)
  const patrimonioLiquido = 
    Number(data?.financas?.resumo?.patrimonio_liquido) ||
    Number(data?.sucessao?.situacaoAtual?.patrimonioTotal) ||
    0;

  // Previdência fora do inventário (VGBL/PGBL) - editável
  const [previdenciaForaInventario, setPrevidenciaForaInventario] = useState(
    Number(data?.previdencia_privada?.saldo_atual) || 0
  );

  // Base do Inventário (Patrimônio Líquido - Previdência fora do inventário)
  const baseInventario = patrimonioLiquido - previdenciaForaInventario;

  // Custo Sucessório Estimado (12% da base do inventário)
  // Inclui: ITCMD (4-8%), custos do inventário, honorários jurídicos
  const custoSucessorioEstimado = baseInventario * 0.12;

  // Patrimônio Transmissível (inclui previdência)
  const patrimonioTransmissivel = patrimonioLiquido - custoSucessorioEstimado;

  // Dados para o gráfico de barras
  const chartData = useMemo(() => [
    {
      name: 'Inventário',
      patrimonioTotal: patrimonioLiquido,
      custoTransmissao: custoSucessorioEstimado,
      patrimonioTransmissivel: patrimonioTransmissivel
    }
  ], [patrimonioLiquido, custoSucessorioEstimado, patrimonioTransmissivel]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-4">
          <div className="space-y-1 text-sm">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex justify-between gap-4">
                <span className="text-muted-foreground" style={{ color: entry.color }}>
                  {entry.name}:
                </span>
                <span className="font-medium">{formatCurrency(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      ref={cardRef as React.RefObject<HTMLDivElement>}
      className="mb-8 animate-on-scroll delay-4"
    >
      <HideableCard
        id="grafico-liquidez-sucessao"
        isVisible={isCardVisible("grafico-liquidez-sucessao")}
        onToggleVisibility={() => toggleCardVisibility("grafico-liquidez-sucessao")}
        hideControls={hideControls}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp size={20} className="text-accent" />
            Análise de Liquidez Sucessória
          </CardTitle>
          <CardDescription>
            Projeção da liquidez disponível para herdeiros e impacto dos custos sucessórios no patrimônio transmissível
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Coluna Esquerda - Cards e Texto Explicativo */}
            <div className="space-y-6 order-2 lg:order-1">
              {/* Cards de Dados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border bg-muted/50">
                  <div className="text-sm text-muted-foreground mb-1">Patrimônio Líquido</div>
                  <div className="text-xl sm:text-2xl font-bold break-words">{formatCurrency(patrimonioLiquido)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Ativos – Passivos (Gestão de Ativos)</div>
                </div>
                
                <div className="p-4 rounded-lg border bg-muted/50 group hover:border-accent/50 transition-colors">
                  <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                    Previdência (fora do inventário)
                    <Pencil size={12} className="text-muted-foreground/60 group-hover:text-accent transition-colors" />
                  </div>
                  <div className="relative">
                    <CurrencyInput
                      value={previdenciaForaInventario}
                      onChange={(value) => setPrevidenciaForaInventario(value)}
                      className="!text-xl sm:!text-2xl !font-bold border-0 bg-transparent p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-accent/5 rounded px-1 -ml-1 transition-colors cursor-text break-words"
                    />
                  </div>
                </div>
                
                <div className="p-4 rounded-lg border bg-muted/50">
                  <div className="text-sm text-muted-foreground mb-1">Base do Inventário</div>
                  <div className="text-xl sm:text-2xl font-bold break-words">{formatCurrency(baseInventario)}</div>
                </div>
                
                <div className="p-4 rounded-lg border bg-accent/5">
                  <div className="text-sm text-muted-foreground mb-1">Custo Sucessório Estimado</div>
                  <div className="text-xl sm:text-2xl font-bold text-accent break-words">{formatCurrency(custoSucessorioEstimado)}</div>
                </div>
                
                {/* Card Destacado - Patrimônio Transmissível */}
                <div className="p-4 rounded-lg border bg-muted/50 sm:col-span-2">
                  <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                    <TrendingUp size={14} className="text-muted-foreground" />
                    Patrimônio Transmissível (inclui previdência)
                  </div>
                  <div className="text-xl sm:text-2xl font-bold break-words">{formatCurrency(patrimonioTransmissivel)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Valor líquido disponível para herdeiros após custos sucessórios</div>
                </div>
              </div>

              {/* Texto Explicativo */}
              <div className="space-y-4 text-sm">
                <p className="text-muted-foreground">
                  Previdência VGBL/PGBL e Seguro de Vida costumam ficar fora do inventário e oferecem liquidez imediata.
                </p>

                <div>
                  <p className="font-medium mb-2">Como calculamos o custo sucessório estimado</p>
                  <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                    <li>Correspondente a 12% da base do inventário</li>
                    <li>Inclui ITCMD (alíquota estimada entre 4% e 8%)</li>
                    <li>Inclui custos do inventário (taxas e despesas cartorárias/judiciais)</li>
                    <li>Inclui honorários jurídicos</li>
                  </ul>
                </div>

                <p className="text-muted-foreground">
                  Tanto a previdência privada (VGBL/PGBL) quanto o seguro de vida costumam ser pagos diretamente aos beneficiários, sem necessidade de inventário, oferecendo liquidez imediata para despesas e preservação do patrimônio. O seguro pode ser calibrado para cobrir o custo sucessório estimado, reduzindo ou eliminando o consumo de patrimônio no inventário.
                </p>
              </div>
            </div>

            {/* Coluna Direita - Gráfico */}
            <div className="order-1 lg:order-2">
              <div className="w-full h-[300px] sm:h-[350px] lg:h-[400px]">
                <ChartContainer
                  config={{
                    patrimonioTotal: {
                      label: "Patrimônio total",
                      color: chartPalette.primary,
                    },
                    custoTransmissao: {
                      label: "Custo de transmissão",
                      color: chartPalette.accent,
                    },
                    patrimonioTransmissivel: {
                      label: "Patrimônio transmissível (inclui previdência)",
                      color: chartPalette.secondary,
                    },
                  }}
                  className="h-full w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 20, right: 10, left: 5, bottom: 5 }}
                      barCategoryGap="20%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.alpha[12]} />
                      <XAxis 
                        dataKey="name" 
                        stroke={chartPalette.primary}
                        fontSize={11}
                        tickLine={{ stroke: chartPalette.primary }}
                      />
                      <YAxis
                        stroke={chartPalette.primary}
                        fontSize={11}
                        tickLine={{ stroke: chartPalette.primary }}
                        width={50}
                        tickFormatter={(value) => {
                          if (value >= 1000000) {
                            return `${(value / 1000000).toFixed(1)}Mi`;
                          }
                          if (value >= 1000) {
                            return `${(value / 1000).toFixed(0)}k`;
                          }
                          return value.toString();
                        }}
                        label={{ value: 'Valor (R$)', angle: -90, position: 'insideLeft', style: { fill: chartPalette.primary, fontSize: '10px' } }}
                      />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{ paddingTop: 15 }}
                        iconType="square"
                        iconSize={10}
                        fontSize={11}
                        formatter={(value) => {
                          const labels: Record<string, string> = {
                            patrimonioTotal: "Patrimônio total",
                            custoTransmissao: "Custo de transmissão",
                            patrimonioTransmissivel: "Patrimônio transmissível (inclui previdência)"
                          };
                          return labels[value] || value;
                        }}
                      />
                      
                      <Bar dataKey="patrimonioTotal" name="patrimonioTotal" fill={chartPalette.primary} opacity={0.7} />
                      <Bar dataKey="custoTransmissao" name="custoTransmissao" fill={chartPalette.accent} opacity={0.7} />
                      <Bar 
                        dataKey="patrimonioTransmissivel" 
                        name="patrimonioTransmissivel" 
                        fill={chartPalette.secondary}
                        radius={[4, 4, 0, 0]}
                        stroke={chartPalette.secondary}
                        strokeWidth={2}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </div>
          </div>
        </CardContent>
      </HideableCard>
    </div>
  );
};

export default SuccessionLiquidityChart;

