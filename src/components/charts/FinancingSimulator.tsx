import React, { useState, useEffect } from 'react';
import { formatCurrency } from '@/utils/formatCurrency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

// Custom currency input component
const CurrencyInput: React.FC<{
  value: number;
  onChange: (value: number) => void;
  className?: string;
  id?: string;
  placeholder?: string;
  min?: number;
}> = ({ value, onChange, className, id, placeholder, min }) => {
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
    const parsedValue = parseFloat(numericValue.replace(/\./g, '').replace(',', '.')) || 0;
    
    // Formatação brasileira durante a digitação
    if (parsedValue > 0) {
      const formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(parsedValue);
      setDisplayValue(formatted);
    } else {
      setDisplayValue(`R$ ${numericValue}`);
    }
    
    onChange(parsedValue);
  };

  const handleBlur = () => {
    // Validação apenas quando o usuário sai do campo
    console.log('onBlur - value:', value, 'min:', min);
    if (min !== undefined && value < min) {
      console.log('Ajustando para valor mínimo:', min);
      const formattedMin = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(min);
      setDisplayValue(formattedMin);
      onChange(min);
    }
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
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
    />
  );
};

interface FinancingSimulatorProps {
  valorImovel: number;
  onSimulationChange?: (simulation: any) => void;
}

interface StrategyResult {
  nome: string;
  parcelaMensal: number;
  valorTotalDesembolsado: number; // Renomeado de totalPago
  custoFinanceiro: number; // Apenas juros e taxas
  custoEfetivoTotal: number; // Renomeado de custoTotal - inclui oportunidade
  economia: number;
  parcelasDetalhadas?: { mes: number; valor: number; fase: 'Pré' | 'Pós' }[];
  detalhes: {
    jurosNominal: number;
    jurosReal: number;
    custoOportunidade: number;
    inflacao: number;
    taxaAdministracao?: number; // Para consórcio
    lanceEmbutido?: number; // Para consórcio
  };
  breakdown: {
    valorImovel: number;
    entrada: number;
    financiado: number;
    juros: number;
    taxas: number;
    custoOportunidade: number;
  };
}

// Função PMT simplificada
function PMT(taxa: number, periodos: number, vp: number) {
  if (taxa === 0) return -(vp) / periodos;
  
  const x = Math.pow(1 + taxa, periodos);
  return -(vp * x) * taxa / (x - 1);
}

// Função para calcular valor futuro
function FV(taxa: number, periodos: number, vp: number) {
  return vp * Math.pow(1 + taxa, periodos);
}

const FinancingSimulator: React.FC<FinancingSimulatorProps> = ({
  valorImovel,
  onSimulationChange
}) => {
  const [valorImovelInput, setValorImovelInput] = useState<number>(valorImovel);
  const [entrada, setEntrada] = useState<number>(valorImovel * 0.2);
  const [prazoFinanciamento, setPrazoFinanciamento] = useState<number>(30);
  // Taxas REAL e inflação (nominal será derivada)
  const [taxaRealFinanciamento, setTaxaRealFinanciamento] = useState<number>(0.075); // ~13% nominal com 5.5% inflação
  // Prazo do consórcio em MESES
  const [prazoConsorcio, setPrazoConsorcio] = useState<number>(180);
  const [mesContemplacaoConsorcio, setMesContemplacaoConsorcio] = useState<number>(12);
  const [taxaAdministracaoConsorcio, setTaxaAdministracaoConsorcio] = useState<number>(0.18); // 18% do valor total
  const [lancePercentConsorcio, setLancePercentConsorcio] = useState<number>(0.4); // 40% a 70%
  const [lanceEmbutidoPercentConsorcio, setLanceEmbutidoPercentConsorcio] = useState<number>(0); // 0% a 30%
  const [retornoRealInvestimento, setRetornoRealInvestimento] = useState<number>(0.045); // ~10% nominal com 5.5% inflação
  const [inflacaoAnual, setInflacaoAnual] = useState<number>(0.055); // Inflação anual (ex-INCC)
  
  // Estado para controle de breakdown expansível
  const [expandedBreakdown, setExpandedBreakdown] = useState<string | null>(null);

  const toggleBreakdown = (key: string) => {
    setExpandedBreakdown(expandedBreakdown === key ? null : key);
  };

  // Função para validar entrada mínima de 20%
  const handleEntradaChange = (value: number) => {
    const entradaMinima = valorImovelInput * 0.2;
    
    // Sempre força o valor mínimo se o valor for menor
    if (value < entradaMinima) {
      setEntrada(entradaMinima);
    } else {
      setEntrada(value);
    }
  };

  // Ajustar entrada quando valor do imóvel mudar
  useEffect(() => {
    const entradaMinima = valorImovelInput * 0.2;
    if (entrada < entradaMinima) {
      setEntrada(entradaMinima);
    }
  }, [valorImovelInput, entrada]);

  // Converter taxa anual para mensal
  const taxaAnualParaMensal = (taxaAnual: number) => {
    return Math.pow(1 + taxaAnual, 1/12) - 1;
  };

  // Taxas NOMINAIS derivadas
  const taxaNominalFinanciamento = Math.max(0, inflacaoAnual + taxaRealFinanciamento);
  const taxaNominalInvestimento = Math.max(0, inflacaoAnual + retornoRealInvestimento);

  // Calcular financiamento SAC (Sistema de Amortização Constante) usando taxa nominal derivada
  const calcularFinanciamento = (): StrategyResult => {
    const valorFinanciado = Math.max(0, valorImovelInput - entrada);
    const taxaNominalMensal = taxaAnualParaMensal(taxaNominalFinanciamento);
    const meses = Math.max(1, prazoFinanciamento * 12);
    
    if (taxaNominalFinanciamento === 0) {
      const parcelaMensal = valorFinanciado / meses;
      const totalParcelas = parcelaMensal * meses;
      const desembolsoTotal = entrada + totalParcelas;
      // Custo de oportunidade apenas da entrada (capital desembolsado)
      const custoOportunidade = entrada * (Math.pow(1 + taxaAnualParaMensal(taxaNominalInvestimento), meses) - 1);
    
      return {
        nome: "Financiamento SAC",
        parcelaMensal,
        valorTotalDesembolsado: desembolsoTotal,
        custoFinanceiro: 0,
        custoEfetivoTotal: desembolsoTotal + custoOportunidade,
        economia: 0,
        detalhes: {
          jurosNominal: 0,
          jurosReal: 0,
          custoOportunidade,
          inflacao: inflacaoAnual
        },
        breakdown: {
          valorImovel: valorImovelInput,
          entrada: entrada,
          financiado: valorFinanciado,
          juros: 0,
          taxas: 0,
          custoOportunidade
        }
      };
    }
    
    // SAC: Amortização constante + juros decrescentes
    const amortizacaoMensal = valorFinanciado / meses;
    let saldoDevedor = valorFinanciado;
    let totalJuros = 0;
    
    // Calcular juros totais nominais
    for (let i = 0; i < meses; i++) {
      const jurosMes = saldoDevedor * taxaNominalMensal;
      totalJuros += jurosMes;
      saldoDevedor -= amortizacaoMensal;
    }
    
    // Parcela inicial (maior) para mostrar na tabela
    const parcelaInicial = amortizacaoMensal + (valorFinanciado * taxaNominalMensal);
    const totalParcelas = valorFinanciado + totalJuros; // soma de todas as parcelas
    const desembolsoTotal = entrada + totalParcelas; // entrada + parcelas
    // Custo de oportunidade apenas da entrada (capital desembolsado)
    const custoOportunidade = entrada * (Math.pow(1 + taxaAnualParaMensal(taxaNominalInvestimento), meses) - 1);

    return {
      nome: "Financiamento SAC",
      parcelaMensal: parcelaInicial,
      valorTotalDesembolsado: desembolsoTotal,
      custoFinanceiro: totalJuros,
      custoEfetivoTotal: desembolsoTotal + custoOportunidade,
      economia: 0,
      detalhes: {
        jurosNominal: totalJuros,
        jurosReal: totalJuros,
        custoOportunidade,
        inflacao: inflacaoAnual
      },
      breakdown: {
        valorImovel: valorImovelInput,
        entrada: entrada,
        financiado: valorFinanciado,
        juros: totalJuros,
        taxas: 0,
        custoOportunidade
      }
    };
  };

  // Calcular consórcio com inflação anual (antes INCC)
  const calcularConsorcio = (): StrategyResult => {
    const meses = Math.max(1, prazoConsorcio);
    const mesCont = Math.min(Math.max(1, mesContemplacaoConsorcio), meses);
    
    // Modelagem com carta bruta para contemplar lance embutido
    const e = Math.max(0, Math.min(0.3, lanceEmbutidoPercentConsorcio));
    const gross = valorImovelInput / (1 - e); // carta bruta necessária para entregar o valor líquido desejado
    const lanceEmbutido = gross * e; // sai de dentro da carta

    // Lance próprio aplicado sobre a carta bruta (consistência de base)
    const valorLance = Math.max(0, gross * lancePercentConsorcio);

    // Taxa administrativa calculada sobre a carta bruta
    const taxaAdmTotal = taxaAdministracaoConsorcio;
    const valorTaxaAdm = gross * taxaAdmTotal;

    // Principal a parcelar não desconta o lance embutido (já está dentro da carta)
    const principalPosLance = Math.max(0, gross - valorLance);

    // Bases de parcela (sem reajuste):
    // Nova lógica: pós-contemplação recalculada com o saldo nominal restante.
    const totalNominalObrigacao = gross + valorTaxaAdm; // obrigação total sem inflação
    const parcelaBasePre = totalNominalObrigacao / meses || 0;
    const pagosPreNominal = mesCont * parcelaBasePre;
    const mesesRestantes = Math.max(0, meses - mesCont);
    // Subtrair pagamentos pré-contemplação e o LANCE TOTAL (embutido + próprio)
    const lanceTotal = lanceEmbutido + valorLance;
    const restanteNominal = Math.max(0, totalNominalObrigacao - pagosPreNominal - lanceTotal);
    const parcelaBasePos = mesesRestantes > 0 ? (restanteNominal / mesesRestantes) : 0;

    // Reajuste anual por inflação, trocando a base no mês da contemplação
    let totalParcelasAjustadas = 0;
    const parcelasDetalhadas: { mes: number; valor: number; fase: 'Pré' | 'Pós' }[] = [];
    for (let m = 1; m <= meses; m++) {
      const anoIndex = Math.floor((m - 1) / 12); // 0 para meses 1–12, 1 para 13–24, etc.
      const fatorAnual = Math.pow(1 + inflacaoAnual, anoIndex);
      const base = m <= mesCont ? parcelaBasePre : parcelaBasePos;
      const valorParcela = base * fatorAnual;
      totalParcelasAjustadas += valorParcela;
      parcelasDetalhadas.push({ mes: m, valor: valorParcela, fase: m <= mesCont ? 'Pré' : 'Pós' });
    }

    const parcelaMensalExibida = parcelaBasePre; // parcela do mês 1 (sem reajuste)
    // Ajuste do lance próprio ao mês de contemplação (nominal no tempo)
    const anoIndexLance = Math.floor((mesCont - 1) / 12);
    const fatorLance = Math.pow(1 + inflacaoAnual, anoIndexLance);
    const valorLanceNominal = valorLance * fatorLance;
    // Total pago: lance próprio (no mês de contemplação) + parcelas ajustadas
    const desembolsoTotal = totalParcelasAjustadas + valorLanceNominal;
    // Custo real comparável: desembolso acima do crédito líquido desejado
    const custoReal = Math.max(0, desembolsoTotal - valorImovelInput);

    // Componentes de "juros": tudo que excede (valor do imóvel + taxa adm)
    const baseSemReajuste = (mesCont * parcelaBasePre) + (mesesRestantes * parcelaBasePos);
    const custoReajuste = Math.max(0, totalParcelasAjustadas - baseSemReajuste);

    // Custo de oportunidade das parcelas pagas (não do valor total)
    // Simular o custo de oportunidade das parcelas pagas ao longo do tempo
    let custoOportunidadeTotal = 0;
    for (let m = 1; m <= meses; m++) {
      const anoIndex = Math.floor((m - 1) / 12);
      const fatorAnual = Math.pow(1 + inflacaoAnual, anoIndex);
      const base = m <= mesCont ? parcelaBasePre : parcelaBasePos;
      const valorParcela = base * fatorAnual;
      const mesesRestantes = meses - m;
      if (mesesRestantes > 0) {
        custoOportunidadeTotal += valorParcela * (Math.pow(1 + taxaAnualParaMensal(taxaNominalInvestimento), mesesRestantes) - 1);
      }
    }
    // Adicionar custo de oportunidade do lance próprio
    const custoOportunidadeLance = valorLanceNominal * (Math.pow(1 + taxaAnualParaMensal(taxaNominalInvestimento), meses - mesCont) - 1);
    const custoOportunidade = custoOportunidadeTotal + custoOportunidadeLance;

    return {
      nome: "Consórcio",
      parcelaMensal: parcelaMensalExibida,
      valorTotalDesembolsado: desembolsoTotal,
      custoFinanceiro: custoReajuste + valorTaxaAdm,
      custoEfetivoTotal: custoReal + custoOportunidade,
      parcelasDetalhadas,
      economia: 0,
      detalhes: {
        jurosNominal: custoReajuste + valorTaxaAdm,
        jurosReal: custoReajuste + valorTaxaAdm,
        custoOportunidade,
        inflacao: inflacaoAnual,
        taxaAdministracao: valorTaxaAdm,
        lanceEmbutido: lanceEmbutido
      },
      breakdown: {
        valorImovel: valorImovelInput,
        entrada: 0,
        financiado: gross,
        juros: custoReajuste,
        taxas: valorTaxaAdm,
        custoOportunidade
      }
    };
  };

  // Calcular compra à vista com custo de oportunidade
  const calcularCompraVista = (): StrategyResult => {
    const meses = Math.max(1, prazoFinanciamento * 12);
    
    // Custo de oportunidade: o que o dinheiro renderia se investido
    const valorFuturoInvestimento = valorImovelInput * Math.pow(1 + taxaAnualParaMensal(taxaNominalInvestimento), meses);
    const custoOportunidade = valorFuturoInvestimento - valorImovelInput;
    
    // Desembolso total = valor do imóvel à vista
    const desembolsoTotal = valorImovelInput;

    return {
      nome: "Compra à Vista",
      parcelaMensal: 0,
      valorTotalDesembolsado: desembolsoTotal,
      custoFinanceiro: 0,
      custoEfetivoTotal: desembolsoTotal + custoOportunidade,
      economia: 0,
      detalhes: {
        jurosNominal: 0,
        jurosReal: 0,
        custoOportunidade,
        inflacao: 0
      },
      breakdown: {
        valorImovel: valorImovelInput,
        entrada: valorImovelInput,
        financiado: 0,
        juros: 0,
        taxas: 0,
        custoOportunidade
      }
    };
  };

  // Calcular todas as estratégias
  const calcularEstrategias = () => {
    const financiamento = calcularFinanciamento();
    const consorcio = calcularConsorcio();
    const compraVista = calcularCompraVista();

    // Calcular economia relativa baseada no CUSTO EFETIVO TOTAL
    const menorCusto = Math.min(financiamento.custoEfetivoTotal, consorcio.custoEfetivoTotal, compraVista.custoEfetivoTotal);
    
    financiamento.economia = financiamento.custoEfetivoTotal - menorCusto;
    consorcio.economia = consorcio.custoEfetivoTotal - menorCusto;
    compraVista.economia = compraVista.custoEfetivoTotal - menorCusto;

    return { financiamento, consorcio, compraVista };
  };

  const estrategias = calcularEstrategias();

  // Cálculos auxiliares para exibição no painel de Consórcio
  const consorcioEmbutidoCap = Math.max(0, Math.min(0.3, lanceEmbutidoPercentConsorcio));
  const consorcioCartaBruta = valorImovelInput > 0 ? (valorImovelInput / (1 - consorcioEmbutidoCap)) : 0;
  const consorcioLanceEmbutidoValor = consorcioCartaBruta * consorcioEmbutidoCap;
  const consorcioLanceProprioValor = consorcioCartaBruta * Math.max(0, lancePercentConsorcio);

  // Notificar mudanças
  useEffect(() => {
    if (estrategias) {
      onSimulationChange?.(estrategias);
    }
  }, [estrategias, onSimulationChange]);

  return (
    <Card className="w-full h-full border-border/80 shadow-sm">
      <CardHeader className="px-6 pb-0">
        <div className="flex flex-col w-full gap-4">
          <div>
            <CardTitle className="text-xl font-semibold">Simulador de Estratégias</CardTitle>
            <CardDescription className="mt-1">
              Comparação com juros nominais derivados (Inflação + Taxa Real). O prazo do financiamento também é usado como horizonte para calcular o valor futuro do investimento nas estratégias de consórcio e compra à vista.
            </CardDescription>
          </div>

          {/* Controles */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="valorImovel">Valor do Imóvel</Label>
              <CurrencyInput
                id="valorImovel"
                value={valorImovelInput}
                onChange={setValorImovelInput}
                className="h-9"
              />
            </div>

            {/* Parâmetro Global */}
            <div className="space-y-3 md:col-span-3 rounded-md border border-border/60 p-4 bg-muted/5">
              <h4 className="text-sm font-semibold">Parâmetro Global</h4>
              <div className="space-y-2">
                <Label htmlFor="inflacaoAnual">Inflação Anual</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    id="inflacaoAnual"
                    value={[inflacaoAnual * 100]}
                    min={2}
                    max={10}
                    step={0.1}
                    onValueChange={(value) => setInflacaoAnual(value[0] / 100)}
                    className="flex-1"
                  />
                  <div className="w-12 text-center text-sm font-medium">{(inflacaoAnual * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>

            {/* Financiamento */}
            <div className="space-y-3 rounded-md border border-border/60 p-4 bg-muted/5">
              <h4 className="text-sm font-semibold">Financiamento SAC</h4>
              <div className="space-y-2">
                <Label htmlFor="entrada">Entrada (mínimo 20%)</Label>
                <CurrencyInput
                  id="entrada"
                  value={entrada}
                  onChange={handleEntradaChange}
                  className="h-8 text-xs"
                  min={valorImovelInput * 0.2}
                />
                <p className="text-xs text-muted-foreground">
                  Entrada mínima: {formatCurrency(valorImovelInput * 0.2)}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prazoFinanciamento">Prazo (anos)</Label>
                <Input
                  id="prazoFinanciamento"
                  type="number"
                  value={prazoFinanciamento}
                  onChange={(e) => setPrazoFinanciamento(parseInt(e.target.value) || 30)}
                  min={1}
                  max={35}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxaRealFinanciamento">Taxa Real Anual</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    id="taxaRealFinanciamento"
                    value={[taxaRealFinanciamento * 100]}
                    min={2}
                    max={15}
                    step={0.1}
                    onValueChange={(value) => setTaxaRealFinanciamento(value[0] / 100)}
                    className="flex-1"
                  />
                  <div className="w-12 text-center text-sm font-medium">{(taxaRealFinanciamento * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>

            {/* Consórcio */}
            <div className="space-y-3 rounded-md border border-border/60 p-4 bg-muted/5">
              <h4 className="text-sm font-semibold">Consórcio</h4>
              <div className="space-y-2">
                <Label htmlFor="prazoConsorcio">Prazo (meses)</Label>
                <Input
                  id="prazoConsorcio"
                  type="number"
                  value={prazoConsorcio}
                  onChange={(e) => setPrazoConsorcio(parseInt(e.target.value) || 180)}
                  min={12}
                  max={240}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mesContemplacaoConsorcio">Mês de contemplação</Label>
                <Input
                  id="mesContemplacaoConsorcio"
                  type="number"
                  value={mesContemplacaoConsorcio}
                  onChange={(e) => setMesContemplacaoConsorcio(Math.min(Math.max(1, parseInt(e.target.value) || 1), prazoConsorcio))}
                  min={1}
                  max={prazoConsorcio}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxaAdministracaoConsorcio">Taxa Administração</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    id="taxaAdministracaoConsorcio"
                    value={[taxaAdministracaoConsorcio * 100]}
                    min={10}
                    max={30}
                    step={0.5}
                    onValueChange={(value) => setTaxaAdministracaoConsorcio(value[0] / 100)}
                    className="flex-1"
                  />
                  <div className="w-12 text-center text-sm font-medium">{(taxaAdministracaoConsorcio * 100).toFixed(1)}%</div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lancePercentConsorcio">Lance Próprio (0% a 100%)</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    id="lancePercentConsorcio"
                    value={[lancePercentConsorcio * 100]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(value) => setLancePercentConsorcio(value[0] / 100)}
                    className="flex-1"
                  />
                  <div className="w-12 text-center text-sm font-medium">{(lancePercentConsorcio * 100).toFixed(0)}%</div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lanceEmbutidoPercentConsorcio">Lance embutido (0% a 30%)</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    id="lanceEmbutidoPercentConsorcio"
                    value={[lanceEmbutidoPercentConsorcio * 100]}
                    min={0}
                    max={30}
                    step={1}
                    onValueChange={(value) => setLanceEmbutidoPercentConsorcio(value[0] / 100)}
                    className="flex-1"
                  />
                  <div className="w-12 text-center text-sm font-medium">{(lanceEmbutidoPercentConsorcio * 100).toFixed(0)}%</div>
                </div>
              </div>
              {/* Resumo do crédito */}
              <div className="mt-2 p-3 rounded-md border border-border/60 bg-muted/5 text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Crédito líquido (ao cliente):</span>
                  <span className="font-medium">{formatCurrency(valorImovelInput)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Carta contratada (com embutido):</span>
                  <span className="font-medium">{formatCurrency(consorcioCartaBruta)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Lance embutido:</span>
                  <span className="font-medium">{formatCurrency(consorcioLanceEmbutidoValor)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Lance próprio:</span>
                  <span className="font-medium">{formatCurrency(consorcioLanceProprioValor)}</span>
                </div>
              </div>
            </div>

            {/* Investimento */}
            <div className="space-y-3 rounded-md border border-border/60 p-4 bg-muted/5">
              <h4 className="text-sm font-semibold">Investimento</h4>
              <div className="space-y-2">
                <Label htmlFor="retornoRealInvestimento">Retorno Real Anual</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    id="retornoRealInvestimento"
                    value={[retornoRealInvestimento * 100]}
                    min={2}
                    max={12}
                    step={0.1}
                    onValueChange={(value) => setRetornoRealInvestimento(value[0] / 100)}
                    className="flex-1"
                  />
                  <div className="w-12 text-center text-sm font-medium">{(retornoRealInvestimento * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-6">
        {/* Legenda Explicativa */}
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <h4 className="text-sm font-semibold mb-2">📊 Como Interpretar os Resultados</h4>
          <div className="grid md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded"></span>
                <span><strong>Total Desembolsado:</strong> Valor bruto que você pagará</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-orange-500 rounded"></span>
                <span><strong>Custo Financeiro:</strong> Juros e taxas pagas</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded"></span>
                <span><strong>Custo Efetivo:</strong> Inclui custo de oportunidade</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded"></span>
                <span><strong>Economia:</strong> Quanto você economiza vs. pior opção</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabela de Resultados */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="py-2 px-3 text-left font-medium">Estratégia</th>
                <th className="py-2 px-3 text-center font-medium">
                  <div className="flex flex-col items-center">
                    <span>Parcela Mensal</span>
                    <span className="text-xs text-muted-foreground">(Mês 1)</span>
                  </div>
                </th>
                <th className="py-2 px-3 text-center font-medium">
                  <div className="flex flex-col items-center">
                    <span>Total Desembolsado</span>
                    <span className="text-xs text-muted-foreground">(Valor bruto pago)</span>
                  </div>
                </th>
                <th className="py-2 px-3 text-center font-medium">
                  <div className="flex flex-col items-center">
                    <span>Custo Financeiro</span>
                    <span className="text-xs text-muted-foreground">(Juros + Taxas)</span>
                  </div>
                </th>
                <th className="py-2 px-3 text-center font-medium">
                  <div className="flex flex-col items-center">
                    <span>Custo Efetivo</span>
                    <span className="text-xs text-muted-foreground">(Inclui oportunidade)</span>
                  </div>
                </th>
                <th className="py-2 px-3 text-center font-medium">Economia</th>
                <th className="py-2 px-3 text-center font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Object.entries(estrategias).map(([key, estrategia]) => (
                <tr key={key} className={estrategia.economia === 0 ? 'bg-green-50 dark:bg-green-950' : ''}>
                  <td className="py-2 px-3 font-medium">{estrategia.nome}</td>
                  <td className="py-2 px-3 text-center">
                    {estrategia.parcelaMensal > 0 ? formatCurrency(estrategia.parcelaMensal) : '-'}
                  </td>
                  <td className="py-2 px-3 text-center font-medium">
                    {formatCurrency(estrategia.valorTotalDesembolsado)}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className="text-orange-600 font-medium">
                      {formatCurrency(estrategia.custoFinanceiro)}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className="text-red-600 font-medium">
                      {formatCurrency(estrategia.custoEfetivoTotal)}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    {estrategia.economia === 0 ? (
                      <span className="text-green-600 font-medium bg-green-100 dark:bg-green-900 px-2 py-1 rounded-full text-xs">
                        Melhor opção
                      </span>
                    ) : (
                      <span className="text-red-600 font-medium">
                        +{formatCurrency(estrategia.economia)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() => toggleBreakdown(key)}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      {expandedBreakdown === key ? 'Ocultar' : 'Ver'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Seção de Breakdown Detalhado */}
        {expandedBreakdown && (
          <div className="mt-4 p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-semibold mb-1">
              Detalhamento: {estrategias[expandedBreakdown]?.nome}
            </h4>
            <div className="text-[11px] text-muted-foreground mb-3">
              Prazo analisado: <strong>{prazoFinanciamento}</strong> anos (<strong>{Math.max(1, prazoFinanciamento * 12)}</strong> meses)
            </div>
            
            {/* Explicação do Cenário (ultra-compacta) */}
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-[11px] text-muted-foreground">
                {expandedBreakdown === 'financiamento' && (
                  <div><strong>Financiamento (SAC):</strong> Entrada + saldo com juros; parcelas decrescentes. Prós: previsível. Contras: juros altos no início.</div>
                )}
                {expandedBreakdown === 'consorcio' && (
                  <div><strong>Consórcio:</strong> Parcelas reajustadas por inflação; contemplação por sorteio/lance. Prós: sem juros. Contras: incerteza + taxa adm.</div>
                )}
                {expandedBreakdown === 'compraVista' && (
                  <div><strong>À vista:</strong> Pagamento integral imediato. Prós: sem juros/possível desconto. Contras: alto capital imobilizado.</div>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h5 className="text-xs font-medium text-muted-foreground">COMPOSIÇÃO DO VALOR</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Valor do Imóvel:</span>
                    <span className="font-medium">{formatCurrency(estrategias[expandedBreakdown].breakdown.valorImovel)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Entrada:</span>
                    <span className="font-medium">{formatCurrency(estrategias[expandedBreakdown].breakdown.entrada)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor Financiado:</span>
                    <span className="font-medium">{formatCurrency(estrategias[expandedBreakdown].breakdown.financiado)}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h5 className="text-xs font-medium text-muted-foreground">CUSTOS</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Juros:</span>
                    <span className="font-medium text-orange-600">{formatCurrency(estrategias[expandedBreakdown].breakdown.juros)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxas:</span>
                    <span className="font-medium text-orange-600">{formatCurrency(estrategias[expandedBreakdown].breakdown.taxas)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Custo Oportunidade:</span>
                    <span className="font-medium text-red-600">{formatCurrency(estrategias[expandedBreakdown].breakdown.custoOportunidade)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Explicação dos Custos (ultra-compacta) */}
            <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
              <div className="text-[11px] text-muted-foreground space-y-1">
                <div><strong>Juros</strong>: preço do tempo (só no financiamento). <strong>Taxas</strong>: adm/operacionais. <strong>Oportunidade</strong>: o que seu capital deixaria de render.</div>
                {expandedBreakdown === 'financiamento' && (
                  <div className="text-blue-600">💡 Oportunidade só da entrada; parcelas já precificam o tempo via juros.</div>
                )}
                {expandedBreakdown === 'consorcio' && (
                  <div className="text-blue-600">💡 Oportunidade das parcelas (e do lance), pois não há juros financeiros.</div>
                )}
                {expandedBreakdown === 'compraVista' && (
                  <div className="text-blue-600">💡 Oportunidade do valor total; desembolso é imediato.</div>
                )}
              </div>
            </div>

            {/* Custo Efetivo Total (CET) */}
            <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950 rounded-lg">
              <h5 className="text-sm font-medium mb-1">📈 Como calculamos o Custo Efetivo Total (CET)</h5>
              <div className="text-[11px] text-muted-foreground mb-2">Prazo analisado: <strong>{prazoFinanciamento}</strong> anos (<strong>{Math.max(1, prazoFinanciamento * 12)}</strong> meses)</div>
              <div className="text-xs text-muted-foreground space-y-2">
                <p>
                  <strong>Fórmula geral:</strong> CET = <em>valor total desembolsado</em> + <em>custo de oportunidade</em>
                </p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>
                    <strong>Financiamento (SAC):</strong> custo de oportunidade apenas sobre a entrada. Juros e eventuais
                    taxas compõem o valor desembolsado ao longo das parcelas.
                  </li>
                  <li>
                    <strong>Consórcio:</strong> custo de oportunidade sobre as parcelas pagas ao longo do tempo (e sobre o lance
                    próprio, se houver). O valor das parcelas é reajustado pela inflação.
                  </li>
                  <li>
                    <strong>Compra à vista:</strong> custo de oportunidade sobre o valor total do imóvel, pois o desembolso é imediato.
                  </li>
                </ul>

                {/* Recap numérico com os valores desta estratégia */}
                <div className="mt-2 grid sm:grid-cols-3 gap-3 text-[11px]">
                  <div className="p-2 bg-background/60 rounded border">
                    <div className="text-muted-foreground">Valor total desembolsado</div>
                    <div className="font-medium">{formatCurrency(estrategias[expandedBreakdown].valorTotalDesembolsado)}</div>
                  </div>
                  <div className="p-2 bg-background/60 rounded border">
                    <div className="text-muted-foreground">Custo financeiro (juros + taxas)</div>
                    <div className="font-medium">{formatCurrency(estrategias[expandedBreakdown].custoFinanceiro)}</div>
                  </div>
                  <div className="p-2 bg-background/60 rounded border">
                    <div className="text-muted-foreground">Custo de oportunidade</div>
                    <div className="font-medium">{formatCurrency(estrategias[expandedBreakdown].breakdown.custoOportunidade)}</div>
                  </div>
                </div>

                <div className="mt-2 p-2 rounded bg-emerald-100/70 dark:bg-emerald-900/50">
                  <div className="text-muted-foreground text-[11px]">CET desta estratégia</div>
                  <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    {formatCurrency(estrategias[expandedBreakdown].custoEfetivoTotal)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quadro de "Parcelas do Consórcio" removido por solicitação */}

        {/* Detalhes dos Custos - Oculto */}
        {false && (
          <div className="mt-6 grid md:grid-cols-3 gap-4">
            {Object.entries(estrategias).map(([key, estrategia]) => (
              <div key={key} className="space-y-2 p-3 rounded-lg border border-border/60 bg-muted/5">
                <h4 className="text-sm font-semibold">{estrategia.nome}</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Juros Nominal:</span>
                    <span>{formatCurrency(estrategia.detalhes.jurosNominal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Custo Oportunidade:</span>
                    <span>{formatCurrency(estrategia.detalhes.custoOportunidade)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Inflação:</span>
                    <span>{(estrategia.detalhes.inflacao * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FinancingSimulator;
