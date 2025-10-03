import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Slider } from "@/components/ui/slider";
import { Line } from 'react-chartjs-2';
import { chartPalette } from '@/theme/chartPalette';
import { Badge } from "@/components/ui/badge";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import RetirementProjectionChart from './RetirementProjectionChart';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const CurrencyInput: React.FC<{
  value: number;
  onChange: (value: number) => void;
  className?: string;
  id?: string;
}> = ({ value, onChange, className, id }) => {
  const [displayValue, setDisplayValue] = useState<string>(() => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    const numericValue = inputVal.replace(/[^0-9,.]/g, '');
    setDisplayValue(`R$ ${numericValue}`);
    const parsedValue = parseFloat(numericValue.replace(/\./g, '').replace(',', '.')) || 0;
    onChange(parsedValue);
  };

  useEffect(() => {
    setDisplayValue(new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value));
  }, [value]);

  return (
    <Input
      id={id}
      value={displayValue}
      onChange={handleInputChange}
      className={className}
    />
  );
};

interface RealEstateSimulatorProps {
  data?: any;
}

const RealEstateSimulator: React.FC<RealEstateSimulatorProps> = ({ data }) => {
  const [tipo, setTipo] = useState<'financiamento' | 'consorcio' | 'vista'>('financiamento');
  const [valorImovel, setValorImovel] = useState(data?.imovelDesejado?.objetivo?.valorImovel || 0);
  const [taxaRealAnual, setTaxaRealAnual] = useState(0);
  const [prazoFinanciamento] = useState(0);
  const [taxaAdm, setTaxaAdm] = useState(0);
  const [lanceEmbutido, setLanceEmbutido] = useState(0);
  const [taxaCETAnual, setTaxaCETAnual] = useState(0);
  const [prazoConsorcio] = useState(0);
  const [contemplacaoNaParcela] = useState(0);
  const [entradaPercent, setEntradaPercent] = useState(0);
  
  // Parâmetros para análise real (descontada inflação)
  const [rentabilidadeRealAnual, setRentabilidadeRealAnual] = useState(0);
  const [prazoComparacao] = useState(0);

  // Resultados
  const [entrada, setEntrada] = useState(0);
  const [valorFinanciado, setValorFinanciado] = useState(0);
  const [parcelaFinanciamento, setParcelaFinanciamento] = useState(0);
  const [totalPagoFinanciamento, setTotalPagoFinanciamento] = useState(0);
  const [custoTotalFinanciamento, setCustoTotalFinanciamento] = useState(0);
  const [parcelasFinanciamento, setParcelasFinanciamento] = useState<any[]>([]);
  const [saldoDevedorFinanciamento, setSaldoDevedorFinanciamento] = useState<number[]>([]);

  const [parcelaConsorcio, setParcelaConsorcio] = useState(0);
  const [totalPagoConsorcio, setTotalPagoConsorcio] = useState(0);
  const [custoTotalConsorcio, setCustoTotalConsorcio] = useState(0);
  const [parcelasConsorcio, setParcelasConsorcio] = useState<any[]>([]);

  // Resultados para compra à vista
  const [custoOportunidade, setCustoOportunidade] = useState(0);
  const [valorFuturoInvestimento, setValorFuturoInvestimento] = useState(0);
  const [evolucaoInvestimento, setEvolucaoInvestimento] = useState<any[]>([]);

  // Novo cálculo de custo total efetivo (todos em termos reais)
  const custoTotalEfetivo = tipo === 'financiamento'
    ? (totalPagoFinanciamento + entrada - valorImovel)
    : tipo === 'consorcio'
    ? (totalPagoConsorcio - valorImovel)
    : custoOportunidade;
    
  // Cálculo do custo do consórcio para comparação
  const custoConsorcio = totalPagoConsorcio - valorImovel;

  // Formatação moeda
  const formatarMoedaBRL = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Cálculo do financiamento (SAC)
  const calcularFinanciamento = () => {
    const entrada_financiamento = valorImovel * (entradaPercent / 100);
    const valor_que_precisa_financiamento = valorImovel - entrada_financiamento;
    const taxa_cet_mensal = Math.pow(1 + taxaCETAnual, 1 / 12) - 1;
    const amortizacao_mensal = valor_que_precisa_financiamento / prazoFinanciamento;
    let saldo_devedor = valor_que_precisa_financiamento;
    let parcelas: any[] = [];
    let total_pago = 0;
    let saldoArray: number[] = [];
    for (let mes = 1; mes <= prazoFinanciamento; mes++) {
      const juros_mensal = saldo_devedor * taxa_cet_mensal;
      const parcela = amortizacao_mensal + juros_mensal;
      parcelas.push({
        mes,
        saldo_devedor: saldo_devedor,
        juros: juros_mensal,
        amortizacao: amortizacao_mensal,
        parcela: parcela
      });
      saldoArray.push(saldo_devedor);
      saldo_devedor -= amortizacao_mensal;
      total_pago += parcela;
    }
    setEntrada(entrada_financiamento);
    setValorFinanciado(valor_que_precisa_financiamento);
    setParcelaFinanciamento(parcelas[0].parcela);
    setTotalPagoFinanciamento(total_pago);
    setCustoTotalFinanciamento(total_pago - valor_que_precisa_financiamento);
    setParcelasFinanciamento(parcelas);
    setSaldoDevedorFinanciamento(saldoArray);
  };

  // Cálculo do consórcio
  const calcularConsorcio = () => {
    const lanceEmbutidoDecimal = lanceEmbutido / 100;
    const taxaAdmDecimal = taxaAdm / 100;
    const valor_lance_embutido = valorImovel * lanceEmbutidoDecimal;
    const carta_liquida = valorImovel - valor_lance_embutido;
    const taxa_total = valorImovel * taxaAdmDecimal;
    const parcela_taxa_adm = taxa_total / prazoConsorcio;
    const parcela_cota = valorImovel / prazoConsorcio;
    const parcela_total_mensal = parcela_cota + parcela_taxa_adm;
    let parcelas: any[] = [];
    let total_pago = 0;
    for (let mes = 1; mes <= prazoConsorcio; mes++) {
      parcelas.push({
        mes,
        status: mes < contemplacaoNaParcela ? 'Antes da contemplação' : 'Após contemplação',
        parcela: parcela_total_mensal
      });
      total_pago += parcela_total_mensal;
    }
    setParcelaConsorcio(parcela_total_mensal);
    setTotalPagoConsorcio(total_pago);
    setCustoTotalConsorcio(total_pago);
    setParcelasConsorcio(parcelas);
  };

  // Cálculo da compra à vista (oportunidade perdida)
  const calcularCompraVista = () => {
    const rentabilidadeRealMensal = Math.pow(1 + rentabilidadeRealAnual / 100, 1 / 12) - 1;
    let valorAtual = valorImovel;
    let evolucao: any[] = [];
    
    // Simula o que o dinheiro renderia se investido ao invés de comprar à vista
    for (let mes = 1; mes <= prazoComparacao; mes++) {
      const rendimentoMensal = valorAtual * rentabilidadeRealMensal;
      valorAtual += rendimentoMensal;
      evolucao.push({
        mes,
        valor: valorAtual,
        rendimento: rendimentoMensal
      });
    }
    
    const valorFuturo = valorAtual;
    // O "custo" é a oportunidade perdida de investir o dinheiro
    const oportunidadePerdida = valorFuturo - valorImovel;
    
    setValorFuturoInvestimento(valorFuturo);
    setCustoOportunidade(oportunidadePerdida);
    setEvolucaoInvestimento(evolucao);
  };

  // Atualizar taxaCETAnual sempre que taxaRealAnual mudar
  React.useEffect(() => {
    setTaxaCETAnual(taxaRealAnual / 100);
  }, [taxaRealAnual]);

  React.useEffect(() => {
    if (tipo === 'financiamento') {
      calcularFinanciamento();
    } else if (tipo === 'consorcio') {
      calcularConsorcio();
    } else if (tipo === 'vista') {
      calcularCompraVista();
    }
    // eslint-disable-next-line
  }, [tipo, valorImovel, taxaRealAnual, taxaAdm, lanceEmbutido, entradaPercent, rentabilidadeRealAnual]);

  // Dados para o gráfico
  const chartData = tipo === 'financiamento'
    ? {
        labels: parcelasFinanciamento.map((_, i) => i + 1),
        datasets: [
          {
            label: 'Valor da Parcela (SAC)',
            data: parcelasFinanciamento.map(p => p.parcela),
            borderColor: chartPalette.primary,
            backgroundColor: chartPalette.alpha[16],
            fill: true,
            tension: 0.1,
          },
          {
            label: 'Saldo Devedor',
            data: saldoDevedorFinanciamento,
            borderColor: chartPalette.emphasis,
            backgroundColor: chartPalette.alpha[12],
            fill: false,
            tension: 0.1,
            yAxisID: 'y1',
          },
        ],
      }
    : tipo === 'consorcio'
    ? {
        labels: parcelasConsorcio.map((_, i) => i + 1),
        datasets: [
          {
            label: 'Parcela Consórcio',
            data: parcelasConsorcio.map(p => p.parcela),
            borderColor: chartPalette.secondary,
            backgroundColor: chartPalette.alpha[12],
            fill: true,
            tension: 0.1,
          },
        ],
      }
    : {
        labels: evolucaoInvestimento.map((_, i) => i + 1),
        datasets: [
          {
            label: 'Valor do Investimento',
            data: evolucaoInvestimento.map(p => p.valor),
            borderColor: chartPalette.tint(0.25),
            backgroundColor: chartPalette.alpha[12],
            fill: true,
            tension: 0.1,
          },
        ],
      };

  return (
    <Card className="w-full h-full border-border/80 shadow-sm mt-16 mb-16">
      <CardHeader className="px-6 pb-0">
        <div className="flex flex-col w-full gap-6">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between w-full">
            <div>
              <CardTitle className="text-2xl font-bold text-foreground mb-2">
                Simulador de Aquisição Imobiliária
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                Compare custos reais de financiamento e consórcio vs. oportunidade perdida da compra à vista
              </CardDescription>
            </div>
            <ToggleGroup
              type="single"
              value={tipo}
              onValueChange={v => v && setTipo(v as 'financiamento' | 'consorcio' | 'vista')}
              className="bg-muted/30 p-1 rounded-lg"
            >
              <ToggleGroupItem 
                value="financiamento" 
                size="sm" 
                className="text-sm font-medium px-4 py-2 rounded bg-transparent hover:bg-muted/50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
              >
                Financiamento
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="consorcio" 
                size="sm" 
                className="text-sm font-medium px-4 py-2 rounded bg-transparent hover:bg-muted/50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
              >
                Consórcio
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="vista" 
                size="sm" 
                className="text-sm font-medium px-4 py-2 rounded bg-transparent hover:bg-muted/50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
              >
                Compra à Vista
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Parameters Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Parâmetros de Simulação</h3>
            
            {/* Explicação das Modalidades */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-gray-900 mb-3">Entendendo cada modalidade:</h4>
              <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-700">
                <div>
                  <h5 className="font-medium text-blue-700 mb-1">🏦 Financiamento</h5>
                  <p>Você paga uma entrada e financia o restante. O custo real é a diferença entre o total pago (parcelas + entrada) e o valor do imóvel.</p>
                </div>
                <div>
                  <h5 className="font-medium text-green-700 mb-1">🤝 Consórcio</h5>
                  <p>Você paga parcelas mensais até ser contemplado. O custo real é a diferença entre o total pago e o valor do imóvel (inclui taxas de administração).</p>
                </div>
                <div>
                  <h5 className="font-medium text-orange-700 mb-1">💰 Compra à Vista</h5>
                  <p>Você paga o valor total do imóvel. A "perda" é a oportunidade de investir esse dinheiro e obter rendimentos ao longo do tempo.</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
              <div className="flex flex-col gap-2">
                <Label htmlFor="valorImovel" className="text-sm font-medium text-foreground">
                  Valor do Bem
                </Label>
                <CurrencyInput id="valorImovel" value={valorImovel} onChange={setValorImovel} className="h-10" />
              </div>
              {tipo === 'financiamento' && (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="entradaSlider" className="text-sm font-medium text-foreground">
                      Entrada (%)
                    </Label>
                    <div className="flex flex-col gap-2">
                      <Slider 
                        id="entradaSlider" 
                        min={10} 
                        max={80} 
                        step={1} 
                        value={[entradaPercent]} 
                        onValueChange={v => setEntradaPercent(v[0])} 
                        className="w-full" 
                      />
                      <div className="flex justify-between w-full text-sm text-muted-foreground">
                        <span className="font-medium">{entradaPercent}%</span>
                        <span className="font-medium">{formatarMoedaBRL(valorImovel * (entradaPercent / 100))}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="taxaRealSlider" className="text-sm font-medium text-foreground">
                      Taxa Real de Financiamento (%)
                    </Label>
                    <div className="flex flex-col gap-2">
                      <Slider 
                        id="taxaRealSlider" 
                        min={3} 
                        max={10} 
                        step={0.1} 
                        value={[taxaRealAnual]} 
                        onValueChange={v => setTaxaRealAnual(Number(v[0].toFixed(1)))} 
                        className="w-full" 
                      />
                      <div className="flex justify-end w-full text-sm text-muted-foreground">
                        <span className="font-medium">{taxaRealAnual.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div />
                </>
              )}
              {tipo === 'consorcio' && (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="taxaAdm" className="text-sm font-medium text-foreground">
                      Taxa de Administração (%)
                    </Label>
                    <div className="flex flex-col gap-2">
                      <Slider 
                        id="taxaAdmSlider" 
                        min={0} 
                        max={30} 
                        step={0.1} 
                        value={[taxaAdm]} 
                        onValueChange={v => setTaxaAdm(Number(v[0].toFixed(1)))} 
                        className="w-full" 
                      />
                      <div className="flex justify-end w-full text-sm text-muted-foreground">
                        <span className="font-medium">{taxaAdm.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="lanceEmbutido" className="text-sm font-medium text-foreground">
                      % de Lance Embutido
                    </Label>
                    <div className="flex flex-col gap-2">
                      <Slider 
                        id="lanceEmbutidoSlider" 
                        min={0} 
                        max={30} 
                        step={0.1} 
                        value={[lanceEmbutido]} 
                        onValueChange={v => setLanceEmbutido(Number(v[0].toFixed(1)))} 
                        className="w-full" 
                      />
                      <div className="flex justify-end w-full text-sm text-muted-foreground">
                        <span className="font-medium">{lanceEmbutido.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div />
                  <div />
                </>
              )}
              {tipo === 'vista' && (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="rentabilidadeSlider" className="text-sm font-medium text-foreground">
                      Rentabilidade Real Anual (%)
                    </Label>
                    <div className="flex flex-col gap-2">
                      <Slider 
                        id="rentabilidadeSlider" 
                        min={2} 
                        max={10} 
                        step={0.1} 
                        value={[rentabilidadeRealAnual]} 
                        onValueChange={v => setRentabilidadeRealAnual(Number(v[0].toFixed(1)))} 
                        className="w-full" 
                      />
                      <div className="flex justify-end w-full text-sm text-muted-foreground">
                        <span className="font-medium">{rentabilidadeRealAnual.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div />
                  <div />
                  <div />
                </>
              )}
            </div>
          </div>

          {/* Results Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Resultados da Simulação</h3>
            
            {/* Explicação do Racional */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-blue-900 mb-2">Como interpretar os resultados:</h4>
              <div className="space-y-2 text-sm text-blue-800">
                <p><strong>Financiamento:</strong> Mostra o custo real total que você pagará a mais pelo imóvel (juros + entrada - valor do imóvel).</p>
                <p><strong>Consórcio:</strong> Mostra o custo real total das parcelas menos o valor do imóvel (inclui taxas de administração).</p>
                <p><strong>Compra à Vista:</strong> Mostra quanto você "deixaria de ganhar" se investisse o dinheiro ao invés de comprar o imóvel à vista.</p>
                <p className="font-medium">A opção com menor valor é a mais vantajosa financeiramente!</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Parcela Mensal / Valor Investido */}
              <div className="flex flex-col items-center justify-center p-6 bg-white border border-border rounded-xl shadow-sm min-h-[120px]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base font-semibold text-muted-foreground">
                    {tipo === 'vista' ? 'Valor Investido' : 'Parcela Mensal'}
                  </span>
                  {tipo === 'financiamento' && (
                    <Badge variant="secondary" className="text-xs font-medium">SAC</Badge>
                  )}
                  {tipo === 'consorcio' && (
                    <Badge variant="secondary" className="text-xs font-medium">Consórcio</Badge>
                  )}
                  {tipo === 'vista' && (
                    <Badge variant="secondary" className="text-xs font-medium">À Vista</Badge>
                  )}
                </div>
                <span className="text-3xl font-extrabold text-primary tracking-tight">
                  {tipo === 'vista' 
                    ? formatarMoedaBRL(valorImovel)
                    : formatarMoedaBRL(tipo === 'financiamento' ? parcelaFinanciamento : parcelaConsorcio)
                  }
                </span>
              </div>
              {/* Custo Total */}
              <div className="flex flex-col items-center justify-center p-6 bg-white border border-border rounded-xl shadow-sm min-h-[120px]">
                <span className="text-base font-semibold text-muted-foreground mb-2">
                  {tipo === 'vista' ? 'Oportunidade Perdida' : 'Custo Total'}
                </span>
                <span className="text-3xl font-extrabold text-primary tracking-tight">
                  {formatarMoedaBRL(custoTotalEfetivo)}
                </span>
              </div>
              {/* Total Pago / Valor Futuro */}
              <div className="flex flex-col items-center justify-center p-6 bg-white border border-border rounded-xl shadow-sm min-h-[120px]">
                <span className="text-base font-semibold text-muted-foreground mb-2">
                  {tipo === 'vista' ? 'Valor Futuro' : 'Total Pago'}
                </span>
                <span className="text-3xl font-extrabold text-primary tracking-tight">
                  {tipo === 'vista' 
                    ? formatarMoedaBRL(valorFuturoInvestimento)
                    : formatarMoedaBRL(tipo === 'financiamento' ? totalPagoFinanciamento + entrada : totalPagoConsorcio)
                  }
                </span>
              </div>
            </div>
            {/* Additional Details */}
            <div className="flex flex-col md:flex-row md:justify-between w-full gap-4 text-sm text-muted-foreground p-4 bg-muted/10 rounded-lg">
              {tipo === 'financiamento' && (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">Entrada: <span className="text-foreground">{formatarMoedaBRL(entrada)}</span></span>
                    <span className="font-medium">Valor Financiado: <span className="text-foreground">{formatarMoedaBRL(valorFinanciado)}</span></span>
                  </div>
                  <div className="flex items-center">
                    <Badge variant="outline" className="text-xs font-medium text-accent border-accent">
                      Sistema SAC - Amortização Constante
                    </Badge>
                  </div>
                </>
              )}
              {tipo === 'consorcio' && (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">Lance Embutido: <span className="text-foreground">{formatarMoedaBRL(valorImovel * (lanceEmbutido / 100))}</span></span>
                    <span className="font-medium">Carta Líquida: <span className="text-foreground">{formatarMoedaBRL(valorImovel - valorImovel * (lanceEmbutido / 100))}</span></span>
                  </div>
                </>
              )}
              {tipo === 'vista' && (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">Valor do Imóvel: <span className="text-foreground">{formatarMoedaBRL(valorImovel)}</span></span>
                    <span className="font-medium">Rentabilidade Real: <span className="text-foreground">{rentabilidadeRealAnual.toFixed(1)}%</span></span>
                  </div>
                  <div className="flex items-center">
                    <Badge variant="outline" className="text-xs font-medium text-accent border-accent">
                      Oportunidade Perdida - {prazoComparacao / 12} anos
                    </Badge>
                  </div>
                </>
              )}
            </div>
            
            {/* Quadro Comparativo */}
            <div className="space-y-4 mt-8">
              <h3 className="text-lg font-semibold text-foreground">Comparativo Completo</h3>
              <div className="bg-white border border-border rounded-lg overflow-hidden">
                <div className="grid grid-cols-4 bg-muted/50 border-b border-border">
                  <div className="p-4 font-semibold text-sm">Modalidade</div>
                  <div className="p-4 font-semibold text-sm text-center">Custo Real</div>
                  <div className="p-4 font-semibold text-sm text-center">Parcela/Investimento</div>
                  <div className="p-4 font-semibold text-sm text-center">Prazo</div>
                </div>
                
                {/* Financiamento */}
                <div className={`grid grid-cols-4 border-b border-border ${custoTotalEfetivo === Math.min(custoTotalEfetivo, custoConsorcio, custoOportunidade) ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                  <div className="p-4 flex items-center">
                    <span className="font-medium">Financiamento</span>
                    {custoTotalEfetivo === Math.min(custoTotalEfetivo, custoConsorcio, custoOportunidade) && (
                      <Badge variant="secondary" className="ml-2 text-xs bg-green-100 text-green-800">Melhor Opção</Badge>
                    )}
                  </div>
                  <div className="p-4 text-center font-semibold">{formatarMoedaBRL(custoTotalEfetivo)}</div>
                  <div className="p-4 text-center">{formatarMoedaBRL(parcelaFinanciamento)}</div>
                  <div className="p-4 text-center">{prazoFinanciamento / 12} anos</div>
                </div>
                
                {/* Consórcio */}
                <div className={`grid grid-cols-4 border-b border-border ${custoConsorcio === Math.min(custoTotalEfetivo, custoConsorcio, custoOportunidade) ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                  <div className="p-4 flex items-center">
                    <span className="font-medium">Consórcio</span>
                    {custoConsorcio === Math.min(custoTotalEfetivo, custoConsorcio, custoOportunidade) && (
                      <Badge variant="secondary" className="ml-2 text-xs bg-green-100 text-green-800">Melhor Opção</Badge>
                    )}
                  </div>
                  <div className="p-4 text-center font-semibold">{formatarMoedaBRL(custoConsorcio)}</div>
                  <div className="p-4 text-center">{formatarMoedaBRL(parcelaConsorcio)}</div>
                  <div className="p-4 text-center">{prazoConsorcio / 12} anos</div>
                </div>
                
                {/* Compra à Vista */}
                <div className={`grid grid-cols-4 ${custoOportunidade === Math.min(custoTotalEfetivo, custoConsorcio, custoOportunidade) ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                  <div className="p-4 flex items-center">
                    <span className="font-medium">Compra à Vista</span>
                    {custoOportunidade === Math.min(custoTotalEfetivo, custoConsorcio, custoOportunidade) && (
                      <Badge variant="secondary" className="ml-2 text-xs bg-green-100 text-green-800">Melhor Opção</Badge>
                    )}
                  </div>
                  <div className="p-4 text-center font-semibold">{formatarMoedaBRL(custoOportunidade)}</div>
                  <div className="p-4 text-center">{formatarMoedaBRL(valorImovel)}</div>
                  <div className="p-4 text-center">Imediato</div>
                </div>
              </div>
              
              {/* Recomendação */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">Recomendação:</h4>
                <p className="text-sm text-green-800">
                  {custoTotalEfetivo === Math.min(custoTotalEfetivo, custoConsorcio, custoOportunidade) && 
                    "O financiamento apresenta o menor custo real total. Recomendamos esta opção para maximizar seu patrimônio."
                  }
                  {custoConsorcio === Math.min(custoTotalEfetivo, custoConsorcio, custoOportunidade) && 
                    "O consórcio apresenta o menor custo real total. Recomendamos esta opção para maximizar seu patrimônio."
                  }
                  {custoOportunidade === Math.min(custoTotalEfetivo, custoConsorcio, custoOportunidade) && 
                    "A compra à vista apresenta a menor perda de oportunidade. Recomendamos esta opção se você tem o capital disponível."
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">
            {tipo === 'vista' ? 'Evolução do Investimento' : 'Evolução Temporal'}
          </h3>
          <div className="w-full h-[420px]">
            <Line data={chartData} options={{
              responsive: true,
              plugins: {
                legend: { 
                  display: true,
                  labels: {
                    font: {
                      size: 12,
                      weight: '500'
                    }
                  }
                },
                tooltip: { 
                  mode: 'index', 
                  intersect: false,
                  titleFont: {
                    size: 14,
                    weight: '600'
                  },
                  bodyFont: {
                    size: 12,
                    weight: '500'
                  }
                },
              },
              scales: {
                x: { 
                  title: { 
                    display: true, 
                    text: tipo === 'vista' ? 'Mês' : tipo === 'financiamento' ? 'Parcela (mês)' : 'Mês',
                    font: {
                      size: 12,
                      weight: '600'
                    }
                  },
                  ticks: {
                    font: {
                      size: 11,
                      weight: '500'
                    }
                  }
                },
                y: { 
                  title: { 
                    display: true, 
                    text: tipo === 'vista' ? 'Valor do Investimento (R$)' : 'Valor da Parcela (R$)',
                    font: {
                      size: 12,
                      weight: '600'
                    }
                  },
                  position: 'left',
                  ticks: {
                    font: {
                      size: 11,
                      weight: '500'
                    }
                  }
                },
                y1: {
                  title: { 
                    display: true, 
                    text: 'Saldo Devedor (R$)',
                    font: {
                      size: 12,
                      weight: '600'
                    }
                  },
                  position: 'right',
                  grid: {
                    drawOnChartArea: false,
                  },
                  ticks: {
                    font: {
                      size: 11,
                      weight: '500'
                    }
                  }
                },
              },
            }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RealEstateSimulator; 