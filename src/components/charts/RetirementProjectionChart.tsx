import React, { useState, useEffect } from 'react';
import HideableCard from '@/components/ui/HideableCard';
import { useCardVisibility } from '@/context/CardVisibilityContext';
import {
  AreaChart,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area
} from 'recharts';
import { formatCurrency } from '@/utils/formatCurrency';
import { ChartContainer } from '@/components/ui/chart';
import { chartPalette } from '@/theme/chartPalette';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { getLiquidityEvents, saveLiquidityEvents, LiquidityEventApi } from '@/services/liquidityEventsService';

// Custom currency input component
const CurrencyInput: React.FC<{
  value: number;
  onChange: (value: number) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
}> = ({ value, onChange, className, id, disabled }) => {
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
      disabled={disabled}
      readOnly={disabled}
      aria-readonly={disabled ? true : undefined}
    />
  );
};

interface RetirementProjectionChartProps {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  currentPortfolio: number;
  monthlyContribution: number;
  rendaMensalDesejada: number;
  safeWithdrawalRate: number;
  inflationRate: number;
  scenarios?: Array<{
    idade: number;
    aporteMensal: number;
    capitalNecessario: number;
  }>;
  onProjectionChange?: (projection: {
    capitalNecessario: number;
    aporteMensal: number;
    idadeEsgotamento: number | null;
    rendaMensal: number;
    idadeAposentadoria: number;
  }) => void;
  hideControls?: boolean;
  externalLiquidityEvents?: Array<{
    id?: string;
    name: string;
    value: number;
    isPositive: boolean;
    recurrence?: 'once' | 'annual' | 'monthly';
    startAge: number;
    endAge?: number | null;
    enabled?: boolean;
    isDerived?: boolean;
  }>;
}

interface LiquidityEvent {
  id: string;
  name: string;
  value: number;
  isPositive: boolean;
  // Backwards compatibility: some legacy events may have only a single age
  age?: number;
  // New recurrence fields
  recurrence?: 'once' | 'annual' | 'monthly';
  startAge: number;
  endAge?: number | null;
  // Enable/disable support
  enabled?: boolean;
}

interface DuracaoCapital {
  idadeFinal: number;
  duracaoAnos: number;
}

// Função PMT idêntica à usada na planilha
function PMT(taxa: number, periodos: number, vp: number, vf: number = 0, tipo: number = 0) {
  if (taxa === 0) return -(vp + vf) / periodos;
  const x = Math.pow(1 + taxa, periodos);
  return -(vp * x + vf) * taxa / ((x - 1) * (1 + taxa * tipo));
}

// Função para calcular o aporte mensal necessário para perpetuidade
const calculatePerpetuityContribution = (
  idade_atual: number,
  idade_para_aposentar: number,
  capitalDisponivelHoje: number,
  saque_mensal_desejado: number,
  rentabilidade_real_liquida_acumulacao: number = 0.03,
  eventosLiquidez: LiquidityEvent[] = []
) => {
  const taxa_mensal_real = Math.pow(1 + rentabilidade_real_liquida_acumulacao, 1 / 12) - 1;
  const meses_acumulacao = (idade_para_aposentar - idade_atual) * 12;

  if (meses_acumulacao <= 0) return 0;

  // Para perpetuidade, o capital necessário é: saque_mensal / taxa_mensal
  const capitalNecessarioPerpetuidade = saque_mensal_desejado / taxa_mensal_real;

  // Calculamos o valor futuro do capital disponível hoje
  const capitalFuturo = capitalDisponivelHoje * Math.pow(1 + taxa_mensal_real, meses_acumulacao);

  // Considere apenas eventos ativos
  const effectiveEvents = (eventosLiquidez || []).filter(e => e.enabled !== false);

  // Calculamos o valor futuro dos eventos de liquidez (suportando recorrência)
  let valorFuturoEventos = 0;
  effectiveEvents.forEach(evento => {
    const recurrence = evento.recurrence || 'once';
    const start = evento.startAge ?? evento.age ?? idade_atual;
    const last = Math.min(evento.endAge ?? (idade_para_aposentar - 1), idade_para_aposentar - 1);
    const annualAmount = recurrence === 'monthly' ? (evento.value * 12) : evento.value;

    if (recurrence === 'once') {
      if (start < idade_para_aposentar) {
        const mesesAteAposentadoria = (idade_para_aposentar - start) * 12;
        const valorFuturo = annualAmount * Math.pow(1 + taxa_mensal_real, mesesAteAposentadoria);
        valorFuturoEventos += evento.isPositive ? valorFuturo : -valorFuturo;
      }
    } else {
      for (let a = start; a <= last; a++) {
        if (a < idade_para_aposentar) {
          const mesesAteAposentadoria = (idade_para_aposentar - a) * 12;
          const valorFuturo = annualAmount * Math.pow(1 + taxa_mensal_real, mesesAteAposentadoria);
          valorFuturoEventos += evento.isPositive ? valorFuturo : -valorFuturo;
        }
      }
    }
  });

  // Capital total disponível no momento da aposentadoria
  const capitalTotalDisponivel = capitalFuturo + valorFuturoEventos;

  // Se já temos capital suficiente, retornamos 0
  if (capitalTotalDisponivel >= capitalNecessarioPerpetuidade) return 0;

  // Calculamos o aporte mensal necessário para complementar
  const aporteMensal = Math.abs(PMT(
    taxa_mensal_real,
    meses_acumulacao,
    -capitalDisponivelHoje,
    capitalNecessarioPerpetuidade - valorFuturoEventos
  ));

  return aporteMensal;
};

// Função para calcular renda permitida e idade de esgotamento no cenário atual
const calculatePermittedIncomeAndDepletionAge = (
  idade_atual: number,
  idade_para_aposentar: number,
  expectativa_de_vida: number,
  capitalDisponivelHoje: number,
  aporteMensal: number,
  rentabilidade_real_liquida_acumulacao: number,
  rentabilidade_real_liquida_consumo: number,
  eventosLiquidez: LiquidityEvent[],
  isPerpetuity: boolean,
  rendaMensalParaCalculo?: number
) => {
  try {
    // Verificar se os valores são válidos
    if (isNaN(rentabilidade_real_liquida_consumo) || isNaN(rentabilidade_real_liquida_acumulacao) || 
        isNaN(idade_atual) || isNaN(idade_para_aposentar) || isNaN(capitalDisponivelHoje) || isNaN(aporteMensal)) {
      console.error('Valores inválidos detectados:', {
        rentabilidade_real_liquida_consumo,
        rentabilidade_real_liquida_acumulacao,
        idade_atual,
        idade_para_aposentar,
        capitalDisponivelHoje,
        aporteMensal
      });
      return { rendaPermitida: 0, idadeEsgotamento: null, rendaUsadaNoCalculo: 0 };
    }

    const taxa_mensal_real_consumo = Math.pow(1 + rentabilidade_real_liquida_consumo, 1 / 12) - 1;
    const taxa_mensal_real = Math.pow(1 + rentabilidade_real_liquida_acumulacao, 1 / 12) - 1;
    const meses_acumulacao = (idade_para_aposentar - idade_atual) * 12;
    
    // Verificar se os meses de acumulação são válidos
    if (meses_acumulacao <= 0) {
      return { rendaPermitida: 0, idadeEsgotamento: null, rendaUsadaNoCalculo: 0 };
    }
    
    // Calcular capital disponível na aposentadoria
    const capitalFuturo = capitalDisponivelHoje * Math.pow(1 + taxa_mensal_real, meses_acumulacao);
    
    // Verificar se o capital futuro é válido
    if (isNaN(capitalFuturo) || !isFinite(capitalFuturo)) {
      console.error('Capital futuro inválido:', capitalFuturo);
      return { rendaPermitida: 0, idadeEsgotamento: null, rendaUsadaNoCalculo: 0 };
    }
    
    // Helper para FV de eventos pré-aposentadoria
    const fvEventosPre = () => {
      const effectiveEvents = (eventosLiquidez || []).filter(e => e.enabled !== false);
      let valorFuturoEventos = 0;
      effectiveEvents.forEach(evento => {
        const recurrence = evento.recurrence || 'once';
        const start = evento.startAge ?? evento.age ?? idade_atual;
        const last = Math.min(evento.endAge ?? (idade_para_aposentar - 1), idade_para_aposentar - 1);
        const annualAmount = recurrence === 'monthly' ? (evento.value * 12) : evento.value;
        if (recurrence === 'once') {
          if (start < idade_para_aposentar) {
            const mesesAteAposentadoria = (idade_para_aposentar - start) * 12;
            valorFuturoEventos += annualAmount * Math.pow(1 + taxa_mensal_real, mesesAteAposentadoria) * (evento.isPositive ? 1 : -1);
          }
        } else {
          for (let a = start; a <= last; a++) {
            if (a < idade_para_aposentar) {
              const mesesAteAposentadoria = (idade_para_aposentar - a) * 12;
              valorFuturoEventos += annualAmount * Math.pow(1 + taxa_mensal_real, mesesAteAposentadoria) * (evento.isPositive ? 1 : -1);
            }
          }
        }
      });
      return valorFuturoEventos;
    };
    
    const valorFuturoEventosPre = fvEventosPre();
    const fvAportes = taxa_mensal_real === 0
      ? aporteMensal * meses_acumulacao
      : aporteMensal * (Math.pow(1 + taxa_mensal_real, meses_acumulacao) - 1) / taxa_mensal_real;
    const capitalTotalAposentadoria = capitalFuturo + valorFuturoEventosPre + fvAportes;
    
    // Calcular eventos pós-aposentadoria
    let pvEventosPosApos = 0;
    const effectiveEvents = (eventosLiquidez || []).filter(e => e.enabled !== false);
    effectiveEvents.forEach(evento => {
      const recurrence = evento.recurrence || 'once';
      const start = evento.startAge ?? evento.age ?? idade_atual;
      const last = Math.min(evento.endAge ?? 99, 99);
      const annualAmount = recurrence === 'monthly' ? (evento.value * 12) : evento.value;
      if (recurrence === 'once') {
        if (start >= idade_para_aposentar) {
          const months = (start - idade_para_aposentar + 1) * 12; // evento no fim do ano
          pvEventosPosApos += evento.isPositive ? (annualAmount / Math.pow(1 + taxa_mensal_real_consumo, months)) : -(annualAmount / Math.pow(1 + taxa_mensal_real_consumo, months));
        }
      } else {
        for (let a = Math.max(start, idade_para_aposentar); a <= last; a++) {
          const months = (a - idade_para_aposentar + 1) * 12; // evento recorrente no fim de cada ano
          pvEventosPosApos += evento.isPositive ? (annualAmount / Math.pow(1 + taxa_mensal_real_consumo, months)) : -(annualAmount / Math.pow(1 + taxa_mensal_real_consumo, months));
        }
      }
    });
    
    // Calcular renda permitida baseada no modo (perpetuidade ou finito)
    let rendaPermitida;
    if (isPerpetuity) {
      // Perpetuidade: renda = capital * taxa mensal
      rendaPermitida = (capitalTotalAposentadoria + pvEventosPosApos) * taxa_mensal_real_consumo;
    } else {
      // Finito: calcular PMT para esgotar o capital aos 99 anos (inclui o ano de aposentadoria)
      const mesesConsumo = (99 - idade_para_aposentar + 1) * 12;
      if (taxa_mensal_real_consumo === 0) {
        rendaPermitida = (capitalTotalAposentadoria + pvEventosPosApos) / mesesConsumo;
      } else {
        const fator = Math.pow(1 + taxa_mensal_real_consumo, mesesConsumo);
        rendaPermitida = (capitalTotalAposentadoria + pvEventosPosApos) * taxa_mensal_real_consumo * fator / (fator - 1);
      }
    }
    
    // Verificar se a renda permitida é válida
    if (isNaN(rendaPermitida) || !isFinite(rendaPermitida) || rendaPermitida < 0) {
      console.error('Renda permitida inválida:', rendaPermitida, {
        capitalTotalAposentadoria,
        pvEventosPosApos,
        taxa_mensal_real_consumo
      });
      return { rendaPermitida: 0, idadeEsgotamento: null, rendaUsadaNoCalculo: 0 };
    }
    
    // Usar renda fornecida ou renda permitida
    const rendaParaCalculo = rendaMensalParaCalculo || rendaPermitida;
    
    // Simular fluxo de capital para calcular idade de esgotamento
    let idadeEsgotamento = null;
    let capital = capitalTotalAposentadoria;
    let idade = idade_para_aposentar;
    
    // Pré-processa eventos por idade considerando recorrência
    const eventsByAge = new Map<number, number>();
    effectiveEvents.forEach(evento => {
      const recurrence = evento.recurrence || 'once';
      const start = evento.startAge ?? evento.age ?? idade_atual;
      const maxAge = isPerpetuity ? 100 : expectativa_de_vida;
      const last = Math.min(evento.endAge ?? maxAge, maxAge);
      const annualAmount = recurrence === 'monthly' ? (evento.value * 12) : evento.value;

      if (recurrence === 'once') {
        const delta = (evento.isPositive ? 1 : -1) * annualAmount;
        eventsByAge.set(start, (eventsByAge.get(start) || 0) + delta);
      } else {
        for (let a = start; a <= last; a++) {
          const delta = (evento.isPositive ? 1 : -1) * annualAmount;
          eventsByAge.set(a, (eventsByAge.get(a) || 0) + delta);
        }
      }
    });
    
    if (isPerpetuity) {
      // Em perpetuidade, não há esgotamento - o patrimônio nunca se esgota
      idadeEsgotamento = null;
    } else {
      // Cenário finito: simular sempre até 99 e zerar no último ano
      const consumoEndAge = 99;
      let patrimonioEsgotado = false;
      while (idade <= consumoEndAge) {
        // Se o patrimônio já foi esgotado em ano anterior, ignoramos eventos e mantemos tudo zerado
        if (patrimonioEsgotado) {
          if (idadeEsgotamento === null) idadeEsgotamento = Math.min(idadeEsgotamento ?? idade, idade);
          capital = 0;
          patrimonioEsgotado = true;
          idade++;
          continue;
        }

        // Evento do ano corrente (aplicado após o rendimento, no fim do ano)
        const delta = eventsByAge.get(idade) || 0;

        // Capitalização mensal equivalente na fase de consumo
        const taxaMensalConsumo = Math.pow(1 + rentabilidade_real_liquida_consumo, 1 / 12) - 1;
        const fatorAnualConsumo = Math.pow(1 + taxaMensalConsumo, 12);
        const saqueMensal = rendaParaCalculo;
        const fvSaques = taxaMensalConsumo === 0
          ? saqueMensal * 12
          : saqueMensal * ((fatorAnualConsumo - 1) / taxaMensalConsumo);

        const rendimentoCapital = capital * (fatorAnualConsumo - 1);
        let saqueEfetivo = fvSaques; // valor futuro dos 12 saques mensais
        let capitalFinal = capital + rendimentoCapital + delta - saqueEfetivo;

        // Se o capital ficaria negativo, limitamos o saque do último ano para zerar
        if (capitalFinal < 0) {
          if (idade < consumoEndAge) {
            const saldoMinimoParaUltimoAno = 1;
            const maxSaque = Math.max(0, (capital + rendimentoCapital + delta) - saldoMinimoParaUltimoAno);
            saqueEfetivo = Math.min(saqueEfetivo, maxSaque);
            capitalFinal = Math.max(saldoMinimoParaUltimoAno, capital + rendimentoCapital + delta - saqueEfetivo);
          } else {
            saqueEfetivo = Math.max(0, capital + rendimentoCapital + delta);
            capitalFinal = 0;
            if (idadeEsgotamento === null) idadeEsgotamento = idade;
          }
        }

        capital = capitalFinal;
        if (capital === 0) {
          patrimonioEsgotado = true;
        }
        idade++;
      }
    }
    
    return { rendaPermitida, idadeEsgotamento, rendaUsadaNoCalculo: rendaParaCalculo };
  } catch (error) {
    console.error('Erro no cálculo da renda permitida:', error);
    return { rendaPermitida: 0, idadeEsgotamento: null, rendaUsadaNoCalculo: 0 };
  }
};

// Função principal de cálculo alinhada com a planilha
const calculateRetirementProjection = (
  idade_atual: number,
  idade_para_aposentar: number,
  expectativa_de_vida: number,
  capitalDisponivelHoje: number,
  capital_disponivel_mensal: number,
  saque_mensal_desejado: number,
  rentabilidade_real_liquida_acumulacao: number = 0.03,
  rentabilidade_real_liquida_consumo: number = 0.03,
  eventosLiquidez: LiquidityEvent[] = [],
  isPerpetuity: boolean = false,
  overrideAporteMensal: number | null = null,
  lockWithdrawalToTarget: boolean = false
) => {

  // Taxa mensal equivalente (igual à planilha)
  const taxa_mensal_real = Math.pow(1 + rentabilidade_real_liquida_acumulacao, 1 / 12) - 1;
  const taxa_mensal_consumo = Math.pow(1 + rentabilidade_real_liquida_consumo, 1 / 12) - 1;

  // Cálculo do capital necessário (usando a mesma abordagem da planilha)
  const calculaCapitalNecessario = () => {
    if (isPerpetuity) {
      // Base: consumir apenas o rendimento, mantendo o principal
      const base = saque_mensal_desejado / taxa_mensal_consumo;

      // Ajuste: eventos pós-aposentadoria impactam o capital necessário
      let pvEventosPosApos = 0;
      const effectiveEvents = (eventosLiquidez || []).filter(e => e.enabled !== false);
      effectiveEvents.forEach(evento => {
        const recurrence = evento.recurrence || 'once';
        const start = evento.startAge ?? evento.age ?? idade_atual;
        const maxAge = 100;
        const last = Math.min(evento.endAge ?? maxAge, maxAge);
        const annualAmount = recurrence === 'monthly' ? (evento.value * 12) : evento.value;
        for (let a = Math.max(start, idade_para_aposentar); a <= last; a++) {
          const months = (a - idade_para_aposentar + 1) * 12; // evento no fim do ano
          const pv = annualAmount / Math.pow(1 + taxa_mensal_consumo, Math.max(0, months));
          pvEventosPosApos += evento.isPositive ? pv : -pv;
        }
      });

      return Math.max(0, base + pvEventosPosApos);
      } else {
        // Base: PV das retiradas mensais até o final do ano 99 (inclui o ano de aposentadoria)
        const consumoEndAge = 99;
        // Ajuste: considerar que o capital deve durar até o final do ano 99 (inclui o ano da aposentadoria)
        const meses_consumo = (consumoEndAge - idade_para_aposentar + 1) * 12;
        const base = (saque_mensal_desejado * (1 - Math.pow(1 + taxa_mensal_consumo, -meses_consumo)) / taxa_mensal_consumo);

        // Ajuste: eventos pós-aposentadoria (entradas reduzem capital necessário; saídas aumentam)
        let pvEventosPosApos = 0;
        const effectiveEvents = (eventosLiquidez || []).filter(e => e.enabled !== false);
        effectiveEvents.forEach(evento => {
          const recurrence = evento.recurrence || 'once';
          const start = evento.startAge ?? evento.age ?? idade_atual;
          const last = Math.min(evento.endAge ?? consumoEndAge, consumoEndAge);
          const annualAmount = recurrence === 'monthly' ? (evento.value * 12) : evento.value;
          if (recurrence === 'once') {
            if (start >= idade_para_aposentar) {
              const months = (start - idade_para_aposentar + 1) * 12; // evento no fim do ano
              const pv = annualAmount / Math.pow(1 + taxa_mensal_consumo, Math.max(0, months));
              pvEventosPosApos += evento.isPositive ? pv : -pv;
            }
          } else {
            for (let a = Math.max(start, idade_para_aposentar); a <= last; a++) {
              const months = (a - idade_para_aposentar + 1) * 12; // evento no fim do ano
              const pv = annualAmount / Math.pow(1 + taxa_mensal_consumo, Math.max(0, months));
              pvEventosPosApos += evento.isPositive ? pv : -pv;
            }
          }
        });

        return Math.max(0, base + pvEventosPosApos);
      }
  };

  // Meses de acumulação
    const meses_acumulacao = (idade_para_aposentar - idade_atual) * 12;


  // Flag para indicar se, sem aportes, o objetivo exigiria contribuição adicional (usado para drenagem no ano 99)
  let shouldForceDrainAtEnd = false;

  // Determinar aporte mensal e renda resultante (suporta override)
  const { aporteMensal, rendaMensal: rendaMensalCalculada, capitalNecessario } = (() => {
    // Helper para FV de eventos pré-aposentadoria
    const fvEventosPre = () => {
    const effectiveEvents = (eventosLiquidez || []).filter(e => e.enabled !== false);
    let valorFuturoEventos = 0;
    effectiveEvents.forEach(evento => {
      const recurrence = evento.recurrence || 'once';
      const start = evento.startAge ?? evento.age ?? idade_atual;
      const last = Math.min(evento.endAge ?? (idade_para_aposentar - 1), idade_para_aposentar - 1);
      const annualAmount = recurrence === 'monthly' ? (evento.value * 12) : evento.value;
      if (recurrence === 'once') {
        if (start < idade_para_aposentar) {
          const mesesAteAposentadoria = (idade_para_aposentar - start) * 12;
            valorFuturoEventos += annualAmount * Math.pow(1 + taxa_mensal_real, mesesAteAposentadoria) * (evento.isPositive ? 1 : -1);
        }
      } else {
        for (let a = start; a <= last; a++) {
          if (a < idade_para_aposentar) {
            const mesesAteAposentadoria = (idade_para_aposentar - a) * 12;
              valorFuturoEventos += annualAmount * Math.pow(1 + taxa_mensal_real, mesesAteAposentadoria) * (evento.isPositive ? 1 : -1);
          }
        }
      }
    });
      return valorFuturoEventos;
    };

    const capitalFuturo = capitalDisponivelHoje * Math.pow(1 + taxa_mensal_real, meses_acumulacao);
    const valorFuturoEventosPre = fvEventosPre();

    const calcCapitalNecessario = (rendaAlvo: number) => {
      const taxa_mensal_real_consumo = Math.pow(1 + rentabilidade_real_liquida_consumo, 1 / 12) - 1;
      if (isPerpetuity) {
        // PV dos eventos pós-aposentadoria
        let pvEventosPosApos = 0;
        const effectiveEvents = (eventosLiquidez || []).filter(e => e.enabled !== false);
        const idadeMaxima = 99;
        effectiveEvents.forEach(evento => {
          const recurrence = evento.recurrence || 'once';
          const start = evento.startAge ?? evento.age ?? idade_atual;
          const last = Math.min(evento.endAge ?? idadeMaxima, idadeMaxima);
          const annualAmount = recurrence === 'monthly' ? (evento.value * 12) : evento.value;
          if (recurrence === 'once') {
            if (start >= idade_para_aposentar) {
              const m = (start - idade_para_aposentar + 1) * 12; // evento no fim do ano
              pvEventosPosApos += evento.isPositive ? (annualAmount / Math.pow(1 + taxa_mensal_real_consumo, m)) : -(annualAmount / Math.pow(1 + taxa_mensal_real_consumo, m));
            }
          } else {
            for (let a = Math.max(start, idade_para_aposentar); a <= last; a++) {
              const m = (a - idade_para_aposentar + 1) * 12; // evento no fim do ano
              pvEventosPosApos += evento.isPositive ? (annualAmount / Math.pow(1 + taxa_mensal_real_consumo, m)) : -(annualAmount / Math.pow(1 + taxa_mensal_real_consumo, m));
            }
          }
        });
        if (taxa_mensal_real_consumo === 0) {
          return Math.max(0, rendaAlvo * 12 * (100 - idade_para_aposentar) - pvEventosPosApos);
        }
        return Math.max(0, rendaAlvo / taxa_mensal_real_consumo - pvEventosPosApos);
      } else {
        const consumoEndAge = 99;
        // Ajuste: considerar que o capital deve durar até o final do ano 99 (inclui o ano da aposentadoria)
        const meses_consumo = (consumoEndAge - idade_para_aposentar + 1) * 12;
        const taxa_mensal_real_consumo = Math.pow(1 + rentabilidade_real_liquida_consumo, 1 / 12) - 1;
        let pvEventosPosApos = 0;
        const effectiveEvents = (eventosLiquidez || []).filter(e => e.enabled !== false);
        effectiveEvents.forEach(evento => {
          const recurrence = evento.recurrence || 'once';
          const start = evento.startAge ?? evento.age ?? idade_atual;
          const last = Math.min(evento.endAge ?? consumoEndAge, consumoEndAge);
          const annualAmount = recurrence === 'monthly' ? (evento.value * 12) : evento.value;
          if (recurrence === 'once') {
            if (start >= idade_para_aposentar) {
              const m = (start - idade_para_aposentar + 1) * 12; // evento no fim do ano
              pvEventosPosApos += evento.isPositive ? (annualAmount / Math.pow(1 + taxa_mensal_real_consumo, m)) : -(annualAmount / Math.pow(1 + taxa_mensal_real_consumo, m));
            }
          } else {
            for (let a = Math.max(start, idade_para_aposentar); a <= last; a++) {
              const m = (a - idade_para_aposentar + 1) * 12; // evento no fim do ano
              pvEventosPosApos += evento.isPositive ? (annualAmount / Math.pow(1 + taxa_mensal_real_consumo, m)) : -(annualAmount / Math.pow(1 + taxa_mensal_real_consumo, m));
            }
          }
        });
        const coef = (1 - Math.pow(1 + taxa_mensal_real_consumo, -meses_consumo)) / taxa_mensal_real_consumo;
        return Math.max(0, rendaAlvo * coef - pvEventosPosApos);
      }
    };

    if (meses_acumulacao <= 0) {
      const kNec = calcCapitalNecessario(saque_mensal_desejado);
      const capitalTotalDisponivelNaAposentadoriaSemAporte = capitalFuturo + valorFuturoEventosPre;
      shouldForceDrainAtEnd = capitalTotalDisponivelNaAposentadoriaSemAporte < kNec;
      return { aporteMensal: 0, rendaMensal: saque_mensal_desejado, capitalNecessario: kNec };
    }

    if (overrideAporteMensal != null) {
      // Usar a nova função para calcular renda permitida e idade de esgotamento
      const { rendaPermitida, idadeEsgotamento, rendaUsadaNoCalculo } = calculatePermittedIncomeAndDepletionAge(
        idade_atual,
        idade_para_aposentar,
        expectativa_de_vida,
        capitalDisponivelHoje,
        overrideAporteMensal,
        rentabilidade_real_liquida_acumulacao,
        rentabilidade_real_liquida_consumo,
        eventosLiquidez,
        isPerpetuity,
        lockWithdrawalToTarget ? saque_mensal_desejado : undefined
      );

      // Define se aporte seria necessário SEM considerar override (base para drenagem ao fim)
      const kNecSemOverride = calcCapitalNecessario(saque_mensal_desejado);
      const capitalTotalDisponivelNaAposentadoriaSemAporte = capitalFuturo + valorFuturoEventosPre;
      shouldForceDrainAtEnd = capitalTotalDisponivelNaAposentadoriaSemAporte < kNecSemOverride;
      return { 
        aporteMensal: overrideAporteMensal, 
        rendaMensal: rendaUsadaNoCalculo, 
        capitalNecessario: calcCapitalNecessario(rendaPermitida),
        idadeEsgotamento,
        rendaPermitida
      };
    } else {
      // Calcular aporte para atingir a renda desejada e terminar com capital 0 aos 99 (considerando eventos)
      const kNec = calcCapitalNecessario(saque_mensal_desejado);
      const capitalTotalDisponivelNaAposentadoria = capitalFuturo + valorFuturoEventosPre;
      if (capitalTotalDisponivelNaAposentadoria >= kNec) {
        // Sem aportes, objetivo é atingível -> não forçar drenagem
        shouldForceDrainAtEnd = false;
        return { aporteMensal: 0, rendaMensal: saque_mensal_desejado, capitalNecessario: kNec };
      }
      // Aportes necessários -> pode forçar drenagem ao fim
      shouldForceDrainAtEnd = true;
      const pmt = PMT(
      taxa_mensal_real,
      meses_acumulacao,
      -capitalDisponivelHoje,
        kNec - valorFuturoEventosPre
      );
      // pmt calculado já considera PV dos eventos pós via kNec e FV dos eventos pré via valorFuturoEventosPre,
      // garantindo que o patrimônio zere no ano 99 no cenário finito
      return { aporteMensal: Math.max(0, Math.abs(pmt)), rendaMensal: saque_mensal_desejado, capitalNecessario: kNec };
    }
  })();

  // Simulação do fluxo de capital (ajustado para a lógica da planilha)
  const simularFluxoCapital = () => {
    const fluxo = [];
    const fluxoCaixaAnual: Array<{
      idade: number;
      fase: 'Acumulação' | 'Consumo';
      capitalInicial: number;
      eventos: number;
      aporte: number;
      rendimento: number;
      saque: number;
      capitalFinal: number;
    }> = [];
    let capital = capitalDisponivelHoje;
    let idade = idade_atual;

    // Considere apenas eventos ativos
    const effectiveEvents = (eventosLiquidez || []).filter(e => e.enabled !== false);

    // Pré-processa eventos por idade considerando recorrência
    const eventsByAge = new Map<number, number>();
    effectiveEvents.forEach(evento => {
      const recurrence = evento.recurrence || 'once';
      const start = evento.startAge ?? evento.age ?? idade_atual;
      const maxAge = 99; // Sempre termina aos 99 anos
      const last = Math.min(evento.endAge ?? maxAge, maxAge);
      const annualAmount = recurrence === 'monthly' ? (evento.value * 12) : evento.value;

      if (recurrence === 'once') {
        const delta = (evento.isPositive ? 1 : -1) * annualAmount;
        eventsByAge.set(start, (eventsByAge.get(start) || 0) + delta);
      } else {
        for (let a = start; a <= last; a++) {
          const delta = (evento.isPositive ? 1 : -1) * annualAmount;
          eventsByAge.set(a, (eventsByAge.get(a) || 0) + delta);
        }
      }
    });

    // Fase de acumulação (eventos aplicados ao fim do ano)
    while (idade < idade_para_aposentar) {
      const capitalInicial = capital;
      const delta = eventsByAge.get(idade) || 0; // evento anual (fim do ano)

      // Capitalização mensal equivalente para 12 meses
      const taxaMensalReal = Math.pow(1 + rentabilidade_real_liquida_acumulacao, 1 / 12) - 1;
      const fatorAnual = Math.pow(1 + taxaMensalReal, 12);

      // Aportes mensais ao longo do ano (valor futuro no fim dos 12 meses)
      const aporteAnual = aporteMensal * 12;
      const fvAportes = taxaMensalReal === 0
        ? aporteAnual
        : aporteMensal * ((fatorAnual - 1) / taxaMensalReal);

      // Rendimento separando capital inicial e crescimento sobre os aportes do ano
      const rendimentoCapital = capitalInicial * (fatorAnual - 1);
      const rendimentoAportes = fvAportes - aporteAnual;
      const rendimentoTotal = rendimentoCapital + rendimentoAportes;

      // Atualiza o capital com rendimento, aporte e só então aplica eventos de fim de ano
      const capitalAntesEventos = capitalInicial + aporteAnual + rendimentoTotal;
      const capitalFinal = capitalAntesEventos + delta;

      // Registra no fluxo de caixa
      fluxoCaixaAnual.push({
        idade,
        fase: 'Acumulação',
        capitalInicial,
        eventos: delta,
        aporte: aporteAnual,
        rendimento: rendimentoTotal,
        saque: 0,
        capitalFinal
      });

      // Para o gráfico, registre o capital de fim de ano
      fluxo.push({ idade, capital: capitalFinal });

      capital = capitalFinal;
      idade++;
    }

    // Fase de consumo
    const saqueAnual = saque_mensal_desejado * 12;
    let idadeEsgotamento = null;

    if (isPerpetuity) {
      // Perpetuidade: mantém o principal após a aposentadoria (sem crescimento visual do patrimônio)
      const idadeMaxima = 99; // Sempre termina aos 99 anos
      while (idade <= idadeMaxima) {
        const capitalInicial = capital;
        const delta = eventsByAge.get(idade) || 0; // apenas exibido

        // Em perpetuidade, saque = rendimento -> principal constante
        const saqueEfetivo = saque_mensal_desejado * 12;
        const rendimentoCapital = saqueEfetivo;
        const capitalFinal = capitalInicial;

        fluxoCaixaAnual.push({
          idade,
          fase: 'Consumo',
          capitalInicial,
          eventos: delta,
          aporte: 0,
          rendimento: rendimentoCapital,
          saque: saqueEfetivo,
          capitalFinal
        });

        // Para o gráfico, usar capital de fim de ano
        fluxo.push({ idade, capital: capitalFinal > 0 ? capitalFinal : 0 });

        capital = capitalFinal;
        idade++;
      }
    } else {
      const consumoEndAge = 99;
      let patrimonioEsgotado = false;
      while (idade <= consumoEndAge) {
        const capitalInicial = capital;

        // Se o patrimônio já foi esgotado em ano anterior, ignoramos eventos e mantemos tudo zerado
        if (patrimonioEsgotado) {
          fluxo.push({ idade, capital: 0 });
          fluxoCaixaAnual.push({
            idade,
            fase: 'Consumo',
            capitalInicial: 0,
            eventos: 0,
            aporte: 0,
            rendimento: 0,
            saque: 0,
            capitalFinal: 0
          });
          capital = 0;
          idade++;
          continue;
        }

        // Aplica eventos de liquidez no ano atual (agregados)
        const delta = eventsByAge.get(idade) || 0;

        // Capitalização mensal equivalente na fase de consumo
        const taxaMensalConsumo = Math.pow(1 + rentabilidade_real_liquida_consumo, 1 / 12) - 1;
        const fatorAnualConsumo = Math.pow(1 + taxaMensalConsumo, 12);
        const saqueMensal = saque_mensal_desejado; // Sempre usar a renda desejada pelo usuário
        const fvSaques = taxaMensalConsumo === 0
          ? saqueMensal * 12
          : saqueMensal * ((fatorAnualConsumo - 1) / taxaMensalConsumo);

        const rendimentoCapital = capital * (fatorAnualConsumo - 1);
        let saqueEfetivo = fvSaques; // valor futuro dos 12 saques mensais
        // Aplica evento como fluxo do ano após rendimento
        let capitalFinal = capital + rendimentoCapital + delta - saqueEfetivo;

        // Se o capital ficaria negativo ANTES do ano 99, limitamos o saque do ano para não ficar negativo
        if (capitalFinal < 0 && idade < consumoEndAge) {
          saqueEfetivo = Math.max(0, capital + rendimentoCapital + delta);
          capitalFinal = 0;
          if (idadeEsgotamento === null) idadeEsgotamento = idade;
        }

        // Forçar término APENAS no final do ano 99: no último ano do horizonte, drenar o saldo remanescente
        // Só força esgotamento se o capital ainda for positivo (cliente precisa aportar)
        // Só drena o saldo remanescente no último ano no cenário target (não travado) e quando o objetivo exija aporte
        if (idade === consumoEndAge && capitalFinal > 0 && shouldForceDrainAtEnd && !lockWithdrawalToTarget) {
          saqueEfetivo = capital + rendimentoCapital + delta;
          capitalFinal = 0;
          if (idadeEsgotamento === null) idadeEsgotamento = idade;
        }

        fluxoCaixaAnual.push({
          idade,
          fase: 'Consumo',
          capitalInicial,
          eventos: delta,
          aporte: 0,
          rendimento: rendimentoCapital,
          saque: saqueEfetivo,
          capitalFinal
        });

        // Para o gráfico, usar o capital de fim de ano
        fluxo.push({ idade, capital: capitalFinal > 0 ? capitalFinal : 0 });

        capital = capitalFinal;
        if (capital === 0) {
          patrimonioEsgotado = true;
        }
        idade++;
      }
    }

    return { fluxo, fluxoCaixaAnual, idadeEsgotamento };
  };

  const resultado = simularFluxoCapital();
  const fluxoCapital = resultado.fluxo;
  const idadeEsgotamento = resultado.idadeEsgotamento;
  const fluxoCaixaAnual = resultado.fluxoCaixaAnual;

  return {
    capitalNecessario,
    aporteMensal,
    rendaMensal: rendaMensalCalculada,
    fluxoCapital,
    fluxoCaixaAnual,
    idadeEsgotamento
  };
};

const chartConfig = {
  capital: {
    label: "Patrimônio acumulado",
    theme: {
      light: chartPalette.primary,
      dark: chartPalette.primary,
    }
  },
};

const RetirementProjectionChart: React.FC<RetirementProjectionChartProps> = ({
  currentAge,
  retirementAge,
  lifeExpectancy,
  currentPortfolio,
  monthlyContribution,
  rendaMensalDesejada,
  safeWithdrawalRate,
  inflationRate,
  onProjectionChange,
  scenarios,
  hideControls,
  externalLiquidityEvents
}) => {
  const { isCardVisible, toggleCardVisibility } = useCardVisibility();
  // Removed selectedView state since we only show the complete scenario
  const [taxaRetorno, setTaxaRetorno] = useState<number>(0.03); // 3% real ao ano como na planilha
  const [rendaMensal, setRendaMensal] = useState<number>(rendaMensalDesejada);
  const [idadeAposentadoria, setIdadeAposentadoria] = useState<number>(retirementAge);
  const [isPerpetuity, setIsPerpetuity] = useState<boolean>(false);
  // Seletor de cenários: 'current' usa excedente; 'target' calcula aporte necessário
  const [selectedScenario, setSelectedScenario] = useState<'current' | 'target'>("target");
  const [excedentePct, setExcedentePct] = useState<number>(100);
  const [reachableIncome, setReachableIncome] = useState<number | null>(null);
  const [idadeEsgotamento, setIdadeEsgotamento] = useState<number | null>(null);
  const [aporteMensal, setAporteMensal] = useState<number>(() => {
    const result = calculateRetirementProjection(
      currentAge,
      retirementAge,
      lifeExpectancy,
      currentPortfolio,
      monthlyContribution,
      rendaMensalDesejada,
      0.03,
      0.03,
      [],
      false
    );
    return result.aporteMensal;
  });
  const [overrideAporte, setOverrideAporte] = useState<number | null>(null);
  const [liquidityEvents, setLiquidityEvents] = useState<LiquidityEvent[]>([]);
  const [newEventName, setNewEventName] = useState<string>('');
  const [newEventValue, setNewEventValue] = useState<number>(0);
  const [newEventType, setNewEventType] = useState<'positive' | 'negative'>('positive');

  // Função para obter o session_id da URL
  const getSessionId = (): string | null => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('sessionId');
  };

  // Carregar eventos de liquidez da API ao montar o componente
  useEffect(() => {
    const loadLiquidityEvents = async () => {
      const sessionId = getSessionId();
      if (!sessionId) return;

      try {
        const apiEvents = await getLiquidityEvents(sessionId);
        const events: LiquidityEvent[] = apiEvents.map((event, index) => ({
          id: `event-${index}`,
          name: event.nome,
          age: Number(event.idade),
          startAge: Number(event.idade),
          value: Number(event.valor),
          isPositive: event.tipo === 'entrada',
          recurrence: event.recorrencia || 'once',
          endAge: event.termino || null,
          enabled: event.status || true
        }));
        console.log('events', events);
        setLiquidityEvents(events);
      } catch (error) {
        console.error('Error loading liquidity events:', error);
      }
    };

    loadLiquidityEvents();
  }, []);

  // Removido: não injetar automaticamente eventos derivados; apenas exibir sugestões na UI

  // Recalcular projeção sempre que inputs mudarem
  useEffect(() => {
    // Se estivermos no Cenário Atual, forçar override do aporte como % do excedente atual
    const aporteFromCurrentScenario = selectedScenario === 'current'
      ? Math.max(0, (monthlyContribution || 0) * (excedentePct / 100))
      : null;
    const effectiveOverride = (selectedScenario === 'current' ? aporteFromCurrentScenario : overrideAporte);
    
    // Se mudaram eventos e estamos no cenário target, limpar override para recalcular aporte automaticamente
    // (garante ajuste automático do aporte para esgotar no 99 quando há fluxos)
    if (selectedScenario === 'target' && effectiveOverride != null) {
      setOverrideAporte(null);
    }


    const result = calculateRetirementProjection(
      currentAge,
      idadeAposentadoria,
      lifeExpectancy,
      currentPortfolio,
      aporteMensal,
      rendaMensal,
      taxaRetorno,
      taxaRetorno,
      liquidityEvents,
      isPerpetuity,
      effectiveOverride,
      selectedScenario === 'current' // quando cenário atual ativo, travamos saque na renda-alvo
    );

    // Atualiza saídas conforme a origem da edição
    if (effectiveOverride != null) {
      setAporteMensal(effectiveOverride);
      // No cenário atual, não alteramos a renda pretendida; mostramos a alcançável separadamente
      if (selectedScenario !== 'current') {
        setRendaMensal(result.rendaMensal);
      }
      // Atualizar idade de esgotamento se disponível
      if (result.idadeEsgotamento !== undefined) {
        setIdadeEsgotamento(result.idadeEsgotamento);
      }
    } else {
      setAporteMensal(result.aporteMensal);
      setIdadeEsgotamento(null); // Limpar idade de esgotamento no cenário target
    }
    // Renda alcançável com o aporte atual: calcula separadamente SEM travar a renda na meta
    if (selectedScenario === 'current') {
      // Calcular a renda alcançável usando a função específica
      const { rendaPermitida } = calculatePermittedIncomeAndDepletionAge(
        currentAge,
        idadeAposentadoria,
        lifeExpectancy,
        currentPortfolio,
        aporteFromCurrentScenario || 0,
        taxaRetorno,
        taxaRetorno,
        liquidityEvents,
        isPerpetuity
      );
      setReachableIncome(rendaPermitida);
    } else {
      setReachableIncome(null);
    }
    setProjection({
      ...result,
      fluxoCapital: result.fluxoCapital.map(item => ({
        age: item.idade,
        capital: Math.round(item.capital)
      }))
    });
  }, [liquidityEvents, currentAge, idadeAposentadoria, lifeExpectancy, currentPortfolio, aporteMensal, rendaMensal, taxaRetorno, isPerpetuity, overrideAporte, selectedScenario, excedentePct, monthlyContribution]);

  const [newEventRecurrence, setNewEventRecurrence] = useState<'once' | 'annual' | 'monthly'>('once');
  const [newEventStartAge, setNewEventStartAge] = useState<number>(currentAge + 5);
  const [newEventEndAge, setNewEventEndAge] = useState<number | ''>('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editValue, setEditValue] = useState<number>(0);
  const [editType, setEditType] = useState<'positive' | 'negative'>('positive');
  const [editRecurrence, setEditRecurrence] = useState<'once' | 'annual' | 'monthly'>('once');
  const [editStartAge, setEditStartAge] = useState<number>(currentAge + 1);
  const [editEndAge, setEditEndAge] = useState<number | ''>('');
  
  // Controle de expansão/colapso da tabela de fluxo de caixa anual
  const [isFlowTableExpanded, setIsFlowTableExpanded] = useState<boolean>(false);
  
  const [projection, setProjection] = useState(() => {
    const result = calculateRetirementProjection(
      currentAge,
      retirementAge,
      lifeExpectancy,
      currentPortfolio,
      monthlyContribution,
      rendaMensalDesejada,
      0.03,
      0.03,
      [],
      false
    );
    return {
      ...result,
      fluxoCapital: result.fluxoCapital.map(item => ({
        age: item.idade,
        capital: Math.round(item.capital)
      }))
    };
  });

  // Atualizar API ao adicionar/remover evento
  const syncEventsToApi = async (events: LiquidityEvent[]) => {
    const sessionId = getSessionId();
    console.log('sessionId', sessionId);
    if (!sessionId) return;
    console.log('teste');
    try {
      console.log('syncEventsToApi', events);
      let apiEvents: LiquidityEventApi[];
      console.log('apiEvents', events);
      if (events.length === 0) {
        // Se não houver eventos, envie apenas o session_id
        console.log('apiEvents', [{ session_id: sessionId } as LiquidityEventApi]);
        apiEvents = [{ session_id: sessionId } as LiquidityEventApi];
      } else {
        apiEvents = events.map(e => ({
          session_id: sessionId,
          nome: e.name,
          idade: e.startAge ?? e.age ?? currentAge + 1,
          tipo: e.isPositive ? 'entrada' : 'saida',
          valor: e.value,
          recorrencia: e.recurrence,
          termino: e.endAge,
          status: e.enabled
        }));
        console.log('apiEvents', apiEvents);
      }
      await saveLiquidityEvents(apiEvents);
    } catch (error) {
      console.error('Error syncing liquidity events:', error);
    }
  };

  const handleAddLiquidityEvent = async () => {
    const startAge = newEventStartAge;
    const endAge = newEventRecurrence === 'once' ? undefined : (newEventEndAge === '' ? undefined : Number(newEventEndAge));
    if (!newEventName || startAge < currentAge || newEventValue <= 0) return;
    if (endAge !== undefined && endAge < startAge) return;
    console.log('newEvent', {
      id: Date.now().toString(),
      name: newEventName,
      value: newEventValue,
      isPositive: newEventType === 'positive',
      recurrence: newEventRecurrence,
      startAge: startAge,
      endAge: endAge ?? null,
      enabled: true
    });
    const newEvent: LiquidityEvent = {
      id: Date.now().toString(),
      name: newEventName,
      value: newEventValue,
      isPositive: newEventType === 'positive',
      recurrence: newEventRecurrence,
      startAge: startAge,
      endAge: endAge ?? null,
      enabled: true
    };

    const updatedEvents = [...liquidityEvents, newEvent];
    console.log('updatedEvents', updatedEvents);
    setLiquidityEvents(updatedEvents);
    // Limpamos override em cenário target para recálculo automático do aporte
    if (selectedScenario === 'target') setOverrideAporte(null);
    setNewEventName('');
    setNewEventStartAge(currentAge + 5);
    setNewEventEndAge('');
    setNewEventValue(0);
    setNewEventType('positive');
    setNewEventRecurrence('once');

    // Sincroniza com a API
    await syncEventsToApi(updatedEvents);
  };

  // Incluir uma renda sugerida (vinda de externalLiquidityEvents) como evento manual
  const addSuggestedIncome = async (sugg: {
    id?: string;
    name: string;
    value: number;
    isPositive?: boolean;
    recurrence?: 'once' | 'annual' | 'monthly';
    startAge?: number;
    endAge?: number | null;
    enabled?: boolean;
  }) => {
    const recurrence = sugg.recurrence || 'monthly';
    const startAge = (sugg.startAge ?? idadeAposentadoria);
    const newEvent: LiquidityEvent = {
      id: `manual-${Date.now()}`,
      name: sugg.name,
      value: Number(sugg.value) || 0,
      isPositive: sugg.isPositive !== false,
      recurrence,
      startAge,
      endAge: recurrence === 'once' ? null : (sugg.endAge ?? null),
      enabled: true,
    };
    const updated = [...liquidityEvents, newEvent];
    setLiquidityEvents(updated);
    await syncEventsToApi(updated);
  };

  const handleRemoveLiquidityEvent = async (id: string) => {
    const updatedEvents = liquidityEvents.filter(event => event.id !== id);
    setLiquidityEvents(updatedEvents);
    if (selectedScenario === 'target') setOverrideAporte(null);

    // Sincroniza com a API
    await syncEventsToApi(updatedEvents);
  };

  const handleToggleLiquidityEvent = async (id: string, enabled: boolean) => {
    const updatedEvents = liquidityEvents.map(ev => ev.id === id ? { ...ev, enabled } : ev);
    setLiquidityEvents(updatedEvents);
    if (selectedScenario === 'target') setOverrideAporte(null);

    const result = calculateRetirementProjection(
      currentAge,
      idadeAposentadoria,
      lifeExpectancy,
      currentPortfolio,
      aporteMensal,
      rendaMensal,
      taxaRetorno,
      taxaRetorno,
      updatedEvents,
      isPerpetuity
    );
    setAporteMensal(result.aporteMensal);
    setProjection({
      ...result,
      fluxoCapital: result.fluxoCapital.map(item => ({
        age: item.idade,
        capital: Math.round(item.capital)
      }))
    });

    // Sincroniza com a API
    await syncEventsToApi(updatedEvents);
  };

  const startEditLiquidityEvent = (ev: LiquidityEvent) => {
    setEditingEventId(ev.id);
    setEditName(ev.name);
    setEditValue(ev.value);
    setEditType(ev.isPositive ? 'positive' : 'negative');
    setEditRecurrence(ev.recurrence || 'once');
    setEditStartAge(ev.startAge ?? ev.age ?? currentAge + 1);
    setEditEndAge(ev.endAge == null ? '' : ev.endAge);
  };

  const saveEditLiquidityEvent = async () => {
    if (!editingEventId) return;
    const startAge = editStartAge;
    const endAge = editRecurrence === 'once' ? undefined : (editEndAge === '' ? undefined : Number(editEndAge));
    if (!editName || startAge < currentAge || editValue <= 0) return;
    if (endAge !== undefined && endAge < startAge) return;

    const updatedEvents = liquidityEvents.map(ev => {
      if (ev.id !== editingEventId) return ev;
      return {
        ...ev,
        name: editName,
        value: editValue,
        isPositive: editType === 'positive',
        recurrence: editRecurrence,
        startAge: startAge,
        endAge: endAge ?? null
      };
    });

    setLiquidityEvents(updatedEvents);
    setEditingEventId(null);
    if (selectedScenario === 'target') setOverrideAporte(null);

    const result = calculateRetirementProjection(
      currentAge,
      idadeAposentadoria,
      lifeExpectancy,
      currentPortfolio,
      aporteMensal,
      rendaMensal,
      taxaRetorno,
      taxaRetorno,
      updatedEvents,
      isPerpetuity
    );
    setAporteMensal(result.aporteMensal);
    setProjection({
      ...result,
      fluxoCapital: result.fluxoCapital.map(item => ({
        age: item.idade,
        capital: Math.round(item.capital)
      }))
    });

    // Sincroniza com a API
    await syncEventsToApi(updatedEvents);
  };

  const cancelEditLiquidityEvent = () => {
    setEditingEventId(null);
  };

  useEffect(() => {
    if (idadeAposentadoria < currentAge + 1) {
      setIdadeAposentadoria(currentAge + 1);
    }
  }, [currentAge, idadeAposentadoria]);

  // Add effect to notify parent of projection changes
  useEffect(() => {
    onProjectionChange?.({
      capitalNecessario: projection.capitalNecessario,
      aporteMensal: projection.aporteMensal,
      idadeEsgotamento: projection.idadeEsgotamento,
      rendaMensal: rendaMensal,
      idadeAposentadoria: idadeAposentadoria
    });
  }, [projection, rendaMensal, idadeAposentadoria, onProjectionChange]);

  const xDomain = React.useMemo(() => {
    return [currentAge, 100];
  }, [currentAge]);

  const filteredData = React.useMemo(() => {
    // Always show complete scenario
    return projection.fluxoCapital;
  }, [projection.fluxoCapital]);

  const eventsByAge = React.useMemo(() => {
    const map = new Map<number, any[]>();
    (liquidityEvents || [])
      .filter((e: any) => e && e.enabled !== false)
      .forEach((e: any) => {
        const age = (e.startAge ?? e.age) as number;
        if (!map.has(age)) map.set(age, []);
        map.get(age)!.push(e);
      });
    return map;
  }, [liquidityEvents]);

  const isEventActiveAtAge = React.useCallback((e: any, age: number) => {
    const start = e.startAge ?? e.age;
    const end = e.endAge ?? start;
    const recurrence = e.recurrence || 'once';
    if (recurrence === 'once') return age === start;
    // Para anual/mensal consideramos ativo em qualquer ano dentro do intervalo
    return age >= start && age <= end;
  }, []);

  const formatYAxis = (value: number) => {
    if (value === 0) return 'R$ 0';
    if (value >= 1000000) return `R$ ${Math.floor(value / 1000000)}M`;
    return formatCurrency(value);
  };

  return (
    <Card className="w-full h-full border-border/80 shadow-sm">
      <CardHeader className="px-6 pb-0">
        <div className="flex flex-col w-full gap-4">
          <div className="w-full">
            <CardTitle className="text-xl font-semibold">
              Cenário de Aposentadoria {isPerpetuity && "(Perpetuidade)"}
            </CardTitle>
            <CardDescription className="mt-1">
              {isPerpetuity ?
                "Patrimônio perpétuo - apenas os rendimentos são consumidos" :
                "Evolução do patrimônio no prazo desejado (alinhado com a planilha)"
              }
            </CardDescription>
          </div>

          {/* Seletor de Cenário */}
          <div className="grid md:grid-cols-2 gap-3 mb-4">
            <button
              type="button"
              className={`p-3 rounded-lg border text-left ${selectedScenario === 'current' ? 'border-accent bg-accent/10' : 'border-border/60 hover:bg-muted/30'}`}
              onClick={() => {
                setSelectedScenario('current');
                setOverrideAporte(null);
              }}
            >
              <div className="font-medium">Cenário Atual (com excedente)</div>
              <div className="text-xs text-muted-foreground mt-1">Usa o excedente mensal atual (ajustável por %) como aporte recorrente até a aposentadoria. Eventos de fluxo são considerados. Modo perpétuo opcional.</div>
            </button>
            <button
              type="button"
              className={`p-3 rounded-lg border text-left ${selectedScenario === 'target' ? 'border-accent bg-accent/10' : 'border-border/60 hover:bg-muted/30'}`}
              onClick={() => {
                setSelectedScenario('target');
                setOverrideAporte(null);
              }}
            >
              <div className="font-medium">Cenário para Atingir a Renda Desejada (padrão)</div>
              <div className="text-xs text-muted-foreground mt-1">Calcula o aporte necessário para atingir a renda pretendida na idade planejada, considerando eventos de fluxo. Modo perpétuo opcional.</div>
            </button>
          </div>

          {/* Toggle de Perpetuidade */}
          <div className="flex items-center justify-between mb-4 p-3 bg-muted/30 rounded-lg">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Modo Perpetuidade</Label>
              <p className="text-xs text-muted-foreground">
                {isPerpetuity ?
                  "Patrimônio nunca se esgota - apenas os rendimentos são consumidos" :
                  "Patrimônio finito - pode se esgotar durante a aposentadoria"
                }
              </p>
            </div>
            <Switch
              checked={isPerpetuity}
              onCheckedChange={(checked) => {
                setIsPerpetuity(checked);

                // Recalcula a projeção com o novo modo
                const aporteFromCurrentScenario = selectedScenario === 'current' ? Math.max(0, (monthlyContribution || 0) * (excedentePct / 100)) : null;
                const result = calculateRetirementProjection(
                  currentAge,
                  idadeAposentadoria,
                  lifeExpectancy,
                  currentPortfolio,
                  aporteMensal,
                  rendaMensal,
                  taxaRetorno,
                  taxaRetorno,
                  liquidityEvents,
                  checked,
                  aporteFromCurrentScenario,
                  selectedScenario === 'current'
                );

                // Atualiza o aporte mensal com o valor calculado
                if (selectedScenario === 'current') {
                  setAporteMensal(aporteFromCurrentScenario || 0);
                } else {
                  setAporteMensal(result.aporteMensal);
                }

                // Atualiza o gráfico com os novos dados
                setProjection({
                  ...result,
                  fluxoCapital: result.fluxoCapital.map(item => ({
                    age: item.idade,
                    capital: Math.round(item.capital)
                  }))
                });
              }}
            />
          </div>

          {/* Slider de % do Excedente quando Cenário Atual ativo */}
          {selectedScenario === 'current' && (
            <div className="space-y-2 mb-4">
              <Label htmlFor="pctExcedente">% do Excedente utilizado ({excedentePct}%)</Label>
              <div className="flex items-center gap-2">
                <Slider
                  id="pctExcedente"
                  value={[excedentePct]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={(value) => setExcedentePct(value[0])}
                  className="flex-1"
                />
                <div className="w-28 text-right text-sm font-medium">
                  {formatCurrency(Math.max(0, (monthlyContribution || 0) * (excedentePct / 100)))}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">Excedente atual: {formatCurrency(monthlyContribution || 0)} / mês</p>
            </div>
          )}

          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="taxaRetorno">Taxa de Retorno Real</Label>
              <div className="flex items-center gap-2">
                <Slider
                  id="taxaRetorno"
                  value={[taxaRetorno * 100]}
                  min={1}
                  max={5}
                  step={0.1}
                  onValueChange={(value) => {
                    const newTaxaRetorno = value[0] / 100;
                    setTaxaRetorno(newTaxaRetorno);

                    // Recalcula a projeção com os novos valores
                    const aporteFromCurrentScenario = selectedScenario === 'current' ? Math.max(0, (monthlyContribution || 0) * (excedentePct / 100)) : null;
                    const result = calculateRetirementProjection(
                      currentAge,
                      idadeAposentadoria,
                      lifeExpectancy,
                      currentPortfolio,
                      aporteMensal,
                      rendaMensal,
                      newTaxaRetorno,
                      newTaxaRetorno,
                      liquidityEvents,
                      isPerpetuity,
                      aporteFromCurrentScenario,
                      selectedScenario === 'current'
                    );

                    // Atualiza o aporte mensal com o valor calculado
                    if (selectedScenario === 'current') {
                      setAporteMensal(aporteFromCurrentScenario || 0);
                    } else {
                      setAporteMensal(result.aporteMensal);
                    }

                    // Atualiza o gráfico com os novos dados
                    setProjection({
                      ...result,
                      fluxoCapital: result.fluxoCapital.map(item => ({
                        age: item.idade,
                        capital: Math.round(item.capital)
                      }))
                    });
                  }}
                  className="flex-1"
                />
                <div className="w-12 text-center text-sm font-medium">{(taxaRetorno * 100).toFixed(1)}%</div>
              </div>
              <p className="text-xs text-muted-foreground">
                Taxa real líquida % a.a (igual para acumulação e consumo)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aporteMensal">Aporte Mensal (editável)</Label>
              <CurrencyInput
                id="aporteMensal"
                value={aporteMensal}
                onChange={(value) => {
                  setAporteMensal(value);
                  setOverrideAporte(value);
                }}
                className="h-9"
                disabled={selectedScenario === 'current'}
              />
              {selectedScenario === 'current' && (
                <p className="text-[11px] text-muted-foreground">Controlado pelo % do excedente acima</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="rendaMensal">Renda Mensal (editável)</Label>
              <CurrencyInput
                id="rendaMensal"
                value={rendaMensal}
                onChange={(value) => {
                  setRendaMensal(value);
                  // Se o usuário modificou a renda manualmente, cancelamos o override do aporte para voltar ao modo "calcular aporte"
                  setOverrideAporte(null);
                }}
                className="h-9"
              />
              <p className="text-[11px] text-muted-foreground">Objetivo registrado: {formatCurrency(rendaMensalDesejada)}</p>
              {selectedScenario === 'current' && (
                <>
                  <p className="text-[11px] text-muted-foreground">Renda alcançável com aporte atual: <span className="font-medium">{formatCurrency(reachableIncome || 0)}</span></p>
                  {idadeEsgotamento && (
                    <p className="text-[11px] text-muted-foreground">Patrimônio se esgota aos: <span className="font-medium">{Math.round(idadeEsgotamento)} anos</span></p>
                  )}
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="idadeAposentadoria">Idade de Aposentadoria</Label>
              <Input
                id="idadeAposentadoria"
                type="number"
                value={idadeAposentadoria}
                onChange={(e) => {
                  const newAge = parseInt(e.target.value) || retirementAge;
                  setIdadeAposentadoria(newAge);

                  // Recalcula a projeção com os novos valores
                  const aporteFromCurrentScenario = selectedScenario === 'current' ? Math.max(0, (monthlyContribution || 0) * (excedentePct / 100)) : null;
                  const result = calculateRetirementProjection(
                    currentAge,
                    newAge,
                    lifeExpectancy,
                    currentPortfolio,
                    aporteMensal,
                    rendaMensal,
                    taxaRetorno,
                    taxaRetorno,
                    liquidityEvents,
                    isPerpetuity,
                    aporteFromCurrentScenario,
                    selectedScenario === 'current'
                  );

                  // Atualiza o aporte mensal com o valor calculado
                  if (selectedScenario === 'current') {
                    setAporteMensal(aporteFromCurrentScenario || 0);
                  } else {
                    setAporteMensal(result.aporteMensal);
                  }

                  // Atualiza o gráfico com os novos dados
                  setProjection({
                    ...result,
                    fluxoCapital: result.fluxoCapital.map(item => ({
                      age: item.idade,
                      capital: Math.round(item.capital)
                    }))
                  });
                }}
                min={currentAge + 1}
                max={90}
                className="h-9"
              />
              <p className="text-[11px] text-muted-foreground">Objetivo registrado: {retirementAge} anos</p>
            </div>
          </div>

          {/* Seção de Eventos de Liquidez */}
          <div className="flex items-center justify-between mb-0.5">
            <Label>Eventos de Liquidez</Label>
            <div className="text-xs text-muted-foreground">
              Eventos que afetam seu patrimônio em momentos específicos
            </div>
          </div>

          {/* Sugestões de rendas (inclusão manual) */}
          {Array.isArray(externalLiquidityEvents) && externalLiquidityEvents.filter(e => (e.isPositive !== false)).length > 0 && (
            <div className="border border-dashed border-border rounded-md p-3 mb-3 bg-muted/20 w-full overflow-hidden">
              <div className="text-xs text-muted-foreground mb-2">
                Rendas sugeridas a incluir (manual):
              </div>
              <div className="flex flex-wrap gap-2 w-full">
                {externalLiquidityEvents
                  .filter((s) => s && (s.isPositive !== false))
                  .map((s) => {
                    const recurrence = s.recurrence || 'monthly';
                    const startAge = (s.startAge ?? idadeAposentadoria);
                    const alreadyIncluded = (liquidityEvents || []).some((nd) => (
                      nd.name === s.name &&
                      (nd.startAge ?? nd.age) === startAge &&
                      (nd.recurrence || 'once') === recurrence &&
                      Math.abs((nd.value ?? 0) - Number(s.value || 0)) < 1e-6 &&
                      nd.isPositive === (s.isPositive !== false)
                    ));
                    return (
                      <div key={s.id || s.name} className="px-2 py-1 rounded-md border text-xs w-full sm:w-auto min-w-0 max-w-full break-words"
                        style={{ borderColor: '#21887C', color: '#21887C', backgroundColor: '#21887C20' }}
                        title={`${s.name} • ${(recurrence === 'once') ? 'Única' : (recurrence === 'annual' ? 'Anual' : 'Mensal')}`}
                      >
                        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#21887C' }}></span>
                          <span className="truncate">{s.name}</span>
                          <span className="opacity-70">{startAge}+</span>
                          <span className="font-medium">{formatCurrency(Number(s.value || 0))}</span>
                        </div>
                        <button
                          onClick={() => addSuggestedIncome(s as any)}
                          disabled={alreadyIncluded}
                          className={`w-full sm:w-auto sm:ml-auto h-6 px-2 rounded mt-1 sm:mt-0 ${alreadyIncluded ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-[#21887C] text-white'}`}
                        >
                          {alreadyIncluded ? 'Incluída' : 'Incluir'}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="border border-border rounded-md overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="py-2 px-3 text-left font-medium">Evento</th>
                    <th className="py-2 px-3 text-center font-medium">Início</th>
                    <th className="py-2 px-3 text-center font-medium">Término</th>
                    <th className="py-2 px-3 text-center font-medium">Recorrência</th>
                    <th className="py-2 px-3 text-center font-medium">Tipo</th>
                    <th className="py-2 px-3 text-right font-medium">Valor</th>
                    <th className="py-2 px-3 text-center font-medium">Ativo</th>
                    <th className="py-2 px-3 text-center font-medium">Ações</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-border">
                {liquidityEvents.map(event => (
                  editingEventId === event.id ? (
                    <tr key={event.id} className="bg-accent/10">
                      <td className="py-2 px-3">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Input
                          type="number"
                          value={editStartAge}
                          onChange={(e) => setEditStartAge(parseInt(e.target.value) || currentAge + 1)}
                          min={currentAge}
                          max={90}
                          className="h-8 text-xs w-20 mx-auto text-center"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Input
                          type="number"
                          value={editRecurrence === 'once' ? '' : editEndAge}
                          onChange={(e) => setEditEndAge(e.target.value === '' ? '' : (parseInt(e.target.value) || currentAge + 1))}
                          min={currentAge}
                          max={90}
                          className="h-8 text-xs w-20 mx-auto text-center"
                          disabled={editRecurrence === 'once'}
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <select
                          value={editRecurrence}
                          onChange={(e) => setEditRecurrence(e.target.value as 'once' | 'annual' | 'monthly')}
                          className="h-8 text-xs rounded-md border border-input bg-background px-2"
                        >
                          <option value="once">Única</option>
                          <option value="annual">Anual</option>
                          <option value="monthly">Mensal</option>
                        </select>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as 'positive' | 'negative')}
                          className="h-8 text-xs rounded-md border border-input bg-background px-2"
                        >
                          <option value="positive">Entrada</option>
                          <option value="negative">Saída</option>
                        </select>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <CurrencyInput
                          value={editValue}
                          onChange={(value) => setEditValue(value)}
                          className="h-8 text-xs w-28 ml-auto"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">-</td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={saveEditLiquidityEvent}
                            className="text-green-600 hover:text-green-800 text-xs font-medium"
                          >Salvar</button>
                          <button
                            onClick={cancelEditLiquidityEvent}
                            className="text-muted-foreground hover:text-foreground text-xs"
                          >Cancelar</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={event.id}>
                      <td className="py-2 px-3">{event.name}</td>
                      <td className="py-2 px-3 text-center">{event.startAge ?? event.age} anos</td>
                      <td className="py-2 px-3 text-center">{event.endAge != null ? `${event.endAge} anos` : '-'}</td>
                      <td className="py-2 px-3 text-center">{(event.recurrence || 'once') === 'once' ? 'Única' : (event.recurrence === 'annual' ? 'Anual' : 'Mensal')}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-medium ${event.isPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {event.isPositive ? 'Entrada' : 'Saída'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-medium">
                        {formatCurrency(event.value)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Switch
                          checked={event.enabled !== false}
                          onCheckedChange={(checked) => handleToggleLiquidityEvent(event.id, checked)}
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => startEditLiquidityEvent(event)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Editar"
                          >✎</button>
                          <button
                            onClick={() => handleRemoveLiquidityEvent(event.id)}
                            className="text-red-500 hover:text-red-700"
                            title="Remover evento"
                          >
                            ×
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}

                {/* Formulário para adicionar novo evento */}
                <tr className="bg-accent/5">
                  <td className="py-2 px-3">
                    <Input
                      placeholder="Nome do evento"
                      value={newEventName}
                      onChange={(e) => setNewEventName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <Input
                      type="number"
                      value={newEventStartAge}
                      onChange={(e) => setNewEventStartAge(parseInt(e.target.value) || currentAge + 1)}
                      min={currentAge}
                      max={90}
                      className="h-8 text-xs w-20 mx-auto text-center"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <Input
                      type="number"
                      value={newEventRecurrence === 'once' ? '' : newEventEndAge}
                      onChange={(e) => setNewEventEndAge(e.target.value === '' ? '' : (parseInt(e.target.value) || currentAge + 1))}
                      min={currentAge}
                      max={90}
                      className="h-8 text-xs w-20 mx-auto text-center"
                      disabled={newEventRecurrence === 'once'}
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <select
                      value={newEventRecurrence}
                      onChange={(e) => setNewEventRecurrence(e.target.value as 'once' | 'annual' | 'monthly')}
                      className="h-8 text-xs rounded-md border border-input bg-background px-2"
                    >
                      <option value="once">Única</option>
                      <option value="annual">Anual</option>
                      <option value="monthly">Mensal</option>
                    </select>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <select
                      value={newEventType}
                      onChange={(e) => setNewEventType(e.target.value as 'positive' | 'negative')}
                      className="h-8 text-xs rounded-md border border-input bg-background px-2"
                    >
                      <option value="positive">Entrada</option>
                      <option value="negative">Saída</option>
                    </select>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <CurrencyInput
                      value={newEventValue}
                      onChange={(value) => setNewEventValue(value)}
                      className="h-8 text-xs w-28 ml-auto"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={handleAddLiquidityEvent}
                      className="bg-primary text-white h-8 w-8 rounded-full flex items-center justify-center text-lg font-bold"
                      title="Adicionar evento"
                      disabled={!newEventName || newEventStartAge < currentAge || newEventValue <= 0 || (newEventRecurrence !== 'once' && newEventEndAge !== '' && Number(newEventEndAge) < newEventStartAge)}
                    >
                      +
                    </button>
                  </td>
                </tr>
              </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 pt-4">
        <div className="h-[320px] mb-6">
          <ChartContainer config={chartConfig} className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={filteredData}
                margin={{ top: 25, right: 30, left: 20, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis
                  dataKey="age"
                  label={{ value: 'Idade', position: 'insideBottom', offset: -15, fill: '#6b7280', fontSize: 12 }}
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickLine={{ stroke: '#9CA3AF' }}
                  axisLine={{ stroke: '#d1d5db' }}
                  padding={{ left: 10, right: 10 }}
                  domain={xDomain}
                />
                <YAxis
                  tickFormatter={formatYAxis}
                  domain={[0, 'auto']}
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickLine={{ stroke: '#9CA3AF' }}
                  axisLine={{ stroke: '#d1d5db' }}
                  label={{
                    value: 'Patrimônio',
                    angle: -90,
                    position: 'insideLeft',
                    offset: -5,
                    fill: '#6b7280',
                    fontSize: 12
                  }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const age = payload[0]?.payload.age;
                      const activeEvents = (liquidityEvents || []).filter((e) => e && e.enabled !== false && isEventActiveAtAge(e, age));
                      return (
                        <div className="bg-card/95 backdrop-blur-sm border border-border/80 px-3 py-2 rounded-md shadow-lg">
                          <p className="font-medium text-xs mb-1">{`Idade: ${age} anos`}</p>
                          <div className="space-y-1">
                            {payload.map((entry) => (
                              <div key={entry.name} className="flex items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className="w-2.5 h-2.5 rounded-[2px]"
                                    style={{ backgroundColor: entry.color }}
                                  />
                                  <span className="text-muted-foreground">{entry.name}:</span>
                                </div>
                                <span className="font-medium tabular-nums">
                                  {formatCurrency(entry.value as number)}
                                </span>
                              </div>
                            ))}
                            {activeEvents.length > 0 && (
                              <div className="pt-2 mt-1 border-t border-border/60">
                                <div className="text-[10px] mb-1 text-muted-foreground">Eventos de liquidez</div>
                                {activeEvents.map((e) => (
                                  <div key={e.id} className="flex items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-1.5">
                                      <div className={`w-2 h-2 rounded-full ${e.isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                      <span className="text-muted-foreground">{e.name}</span>
                                    </div>
                                    <span className="font-medium tabular-nums">{formatCurrency(e.value)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                  wrapperStyle={{ outline: 'none' }}
                />

                {/* Linha de referência para a idade de aposentadoria */}
                <ReferenceLine
                  x={idadeAposentadoria}
                  stroke={chartPalette.secondary}
                  strokeDasharray="3 3"
                  label={({ viewBox }: any) => {
                    const x = (viewBox?.x ?? 0) + (viewBox?.width ?? 0) - 6;
                    const y = (viewBox?.y ?? 0) + 12;
                    return (
                      <text x={x} y={y} fill={chartPalette.secondary} fontSize={11} textAnchor="end">
                        {`Aposentadoria (${idadeAposentadoria} anos)`}
                      </text>
                    );
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="capital"
                  name="Patrimônio acumulado"
                  stroke={chartPalette.primary}
                  fill={chartPalette.primary}
                  fillOpacity={0.25}
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 1.25 }}
                />

                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{
                    paddingTop: 15,
                    fontSize: 11,
                    lineHeight: '1.2em'
                  }}
                  iconType="plainline"
                  iconSize={10}
                />

                {liquidityEvents.map((event) => {
                  if (event.enabled === false) return null;
                  const age = event.startAge ?? event.age;
                  const siblings = eventsByAge.get(age) || [];
                  const localIndex = siblings.findIndex((e) => e.id === event.id);
                  return (
                    <ReferenceLine
                      key={event.id}
                      x={age}
                      stroke={event.isPositive ? chartPalette.secondary : chartPalette.emphasis}
                      strokeDasharray="3 3"
                      label={null}
                    />
                  );
                })}
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* Lista compacta de eventos de liquidez */}
        {liquidityEvents && liquidityEvents.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 w-full">
            {liquidityEvents
              .filter((e) => e && e.enabled !== false)
              .sort((a, b) => (a.startAge ?? a.age) - (b.startAge ?? b.age))
              .map((e) => (
                <div
                  key={e.id}
                  className={`px-2 py-1 border text-xs w-full sm:w-auto rounded-md sm:rounded-full min-w-0 break-words`}
                  style={{
                    borderColor: e.isPositive ? '#21887C' : '#E52B50',
                    color: e.isPositive ? '#21887C' : '#E52B50',
                    backgroundColor: e.isPositive ? '#21887C20' : '#E52B5020'
                  }}
                  title={`${e.name} • ${e.recurrence && e.recurrence !== 'once' ? 'Recorrente' : 'Único'}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-block w-2 h-2 rounded-full`} style={{ backgroundColor: e.isPositive ? '#21887C' : '#E52B50' }}></span>
                      <span className="font-medium truncate">{e.name}</span>
                    </div>
                    <span className="hidden sm:inline mx-1">—</span>
                    <span className="font-medium">{formatCurrency(e.value)}</span>
                    <span className="hidden sm:inline mx-1">•</span>
                    <div className="flex items-center gap-1">
                      <span>{(e.startAge ?? e.age)} anos{e.endAge ? ` até ${e.endAge}` : ''}</span>
                      {e.recurrence && e.recurrence !== 'once' && (
                        <span className="text-muted-foreground">(recorrente)</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Tabela de informações sobre o cenário */}
        <div className="mt-6 border border-border rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead className="bg-muted/30">
                <tr>
                  <th className="py-2 px-3 text-left font-medium">Detalhe</th>
                  <th className="py-2 px-3 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Aporte necessário para atingir a renda alvo (ignorando overrides)
                  const recomputeForNeeded = calculateRetirementProjection(
                    currentAge,
                    idadeAposentadoria,
                    lifeExpectancy,
                    currentPortfolio,
                    aporteMensal,
                    rendaMensal,
                    taxaRetorno,
                    taxaRetorno,
                    liquidityEvents,
                    isPerpetuity,
                    null
                  );
                  const aporteNecessario = recomputeForNeeded.aporteMensal || 0;
                  const aporteAtual = selectedScenario === 'current'
                    ? Math.max(0, (monthlyContribution || 0) * (excedentePct / 100))
                    : (overrideAporte != null ? overrideAporte : projection.aporteMensal);
                  const aporteAdicional = Math.max(0, aporteNecessario - (aporteAtual || 0));
                  return (
                    <>
                      {selectedScenario === 'current' && (
                        <tr>
                          <td className="py-2 px-3">Aporte Atual (excedente usado)</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(aporteAtual)}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="py-2 px-3">Aporte Mensal Necessário</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(aporteNecessario)}</td>
                      </tr>
                      {selectedScenario === 'current' && (
                        <tr>
                          <td className="py-2 px-3">Aporte Adicional p/ Objetivo</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(aporteAdicional)}</td>
                        </tr>
                      )}
                      {selectedScenario === 'current' && (
                        <tr>
                          <td className="py-2 px-3">Renda Permitida (atual)</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(reachableIncome || 0)}</td>
                        </tr>
                      )}
                      {selectedScenario === 'current' && idadeEsgotamento && (
                        <tr>
                          <td className="py-2 px-3">Idade de Esgotamento</td>
                          <td className="py-2 px-3 text-right">{Math.round(idadeEsgotamento)} anos</td>
                        </tr>
                      )}
                    </>
                  );
                })()}
                <tr>
                  <td className="py-2 px-3">Investimentos Financeiros Alvo</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(Math.round(projection.capitalNecessario))}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3">Retirada Mensal Planejada</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(rendaMensal)}</td>
                </tr>
                {selectedScenario === 'current' && reachableIncome != null && (
                  <tr>
                    <td className="py-2 px-3">Renda Alcançável (Cenário Atual)</td>
                    <td className="py-2 px-3 text-right">{formatCurrency(reachableIncome)}</td>
                  </tr>
                )}
                <tr>
                  <td className="py-2 px-3">Duração do Patrimônio</td>
                  <td className="py-2 px-3 text-right">
                    {isPerpetuity ?
                      "Perpétuo (nunca se esgota)" :
                      (projection.idadeEsgotamento ?
                        `Até os ${projection.idadeEsgotamento} anos (${projection.idadeEsgotamento - idadeAposentadoria} anos)` :
                        `Até os ${lifeExpectancy} anos`)
                    }
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabela de Fluxo de Caixa Anual com ocultar */}
        <HideableCard
          id="tabela-fluxo-caixa-aposentadoria"
          isVisible={isCardVisible('tabela-fluxo-caixa-aposentadoria')}
          onToggleVisibility={() => toggleCardVisibility('tabela-fluxo-caixa-aposentadoria')}
          hideControls={Boolean(hideControls)}
          className="mt-6"
        >
          <div className="border border-border rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/60">
              <div className="text-xs text-muted-foreground">
                {isFlowTableExpanded ? 'Exibindo todos os anos' : 'Exibindo próximos 10 anos'}
              </div>
              <button
                className="text-xs font-medium px-2 py-1 rounded-md border border-border hover:bg-muted/50"
                onClick={() => setIsFlowTableExpanded(v => !v)}
              >
                {isFlowTableExpanded ? 'Colapsar' : 'Expandir'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[720px]">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="py-2 px-3 text-left font-medium">Idade</th>
                    <th className="py-2 px-3 text-left font-medium">Fase</th>
                    <th className="py-2 px-3 text-right font-medium">Capital Inicial</th>
                    <th className="py-2 px-3 text-right font-medium">Eventos</th>
                    <th className="py-2 px-3 text-right font-medium">Aporte</th>
                    <th className="py-2 px-3 text-right font-medium">Rendimento</th>
                    <th className="py-2 px-3 text-right font-medium">Saque</th>
                    <th className="py-2 px-3 text-right font-medium">Capital Final</th>
                  </tr>
                </thead>
                <tbody>
                  {((projection.fluxoCaixaAnual || []).slice(0, isFlowTableExpanded ? undefined : 10)).map((row: any, idx: number) => (
                    <tr key={idx} className="border-b border-border last:border-0">
                      <td className="py-2 px-3">{row.idade}</td>
                      <td className="py-2 px-3">{row.fase}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(Math.round(row.capitalInicial))}</td>
                      <td className="py-2 px-3 text-right">{row.eventos === 0 ? '-' : formatCurrency(Math.round(row.eventos))}</td>
                      <td className="py-2 px-3 text-right">{row.aporte === 0 ? '-' : formatCurrency(Math.round(row.aporte))}</td>
                      <td className="py-2 px-3 text-right">{row.rendimento === 0 ? '-' : formatCurrency(Math.round(row.rendimento))}</td>
                      <td className="py-2 px-3 text-right">{row.saque === 0 ? '-' : formatCurrency(Math.round(row.saque))}</td>
                      <td className="py-2 px-3 text-right font-medium">{formatCurrency(Math.round(row.capitalFinal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </HideableCard>
      </CardContent>
    </Card>
  );
};

export default RetirementProjectionChart;
