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
  Tooltip as RechartsTooltip,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { getLiquidityEvents, saveLiquidityEvents, LiquidityEventApi } from '@/services/liquidityEventsService';
import { Info } from 'lucide-react';

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
  isClientVersion?: boolean;
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
  pgblAnual?: number;
  taxaRetornoInicial?: number;
  onTaxaRetornoChange?: (taxa: number) => void;
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
  rendaMensalParaCalculo?: number,
  forceZeroAtEnd: boolean = true
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
          const months = (start - idade_para_aposentar) * 12;
          pvEventosPosApos += evento.isPositive ? (annualAmount / Math.pow(1 + taxa_mensal_real_consumo, months)) : -(annualAmount / Math.pow(1 + taxa_mensal_real_consumo, months));
        }
      } else {
        for (let a = Math.max(start, idade_para_aposentar); a <= last; a++) {
          const months = (a - idade_para_aposentar) * 12;
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
      // Finito: calcular PMT para esgotar o capital aos 99 anos (incluindo o ano 99 completo)
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
      while (idade <= consumoEndAge) {
        // Aplica eventos de liquidez no ano atual
        const delta = eventsByAge.get(idade) || 0;
        capital += delta;

        // Capitalização mensal equivalente na fase de consumo
        const taxaMensalConsumo = Math.pow(1 + rentabilidade_real_liquida_consumo, 1 / 12) - 1;
        const fatorAnualConsumo = Math.pow(1 + taxaMensalConsumo, 12);
        const saqueMensal = rendaParaCalculo;
        const fvSaques = taxaMensalConsumo === 0
          ? saqueMensal * 12
          : saqueMensal * ((fatorAnualConsumo - 1) / taxaMensalConsumo);

        const rendimentoCapital = capital * (fatorAnualConsumo - 1);
        let capitalFinal = capital + rendimentoCapital - fvSaques;

        // Se o capital ficaria negativo ANTES do ano 99, ajustamos o saque mas continuamos até os 99
        if (capitalFinal < 0 && idade < consumoEndAge) {
          // Limita o saque ao que está disponível
          capitalFinal = 0;
          // NÃO marca esgotamento aqui - apenas ajusta e continua
        }

        if (!forceZeroAtEnd && capitalFinal <= 0 && idadeEsgotamento === null) {
          capitalFinal = 0;
          idadeEsgotamento = idade;
        }

        // Forçar término APENAS no final do ano 99
        if (forceZeroAtEnd && idade === consumoEndAge) {
          capitalFinal = 0;
          if (idadeEsgotamento === null) idadeEsgotamento = idade;
        }

        capital = capitalFinal;
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
          const months = (a - idade_para_aposentar) * 12;
          const pv = annualAmount / Math.pow(1 + taxa_mensal_consumo, Math.max(0, months));
          pvEventosPosApos += evento.isPositive ? pv : -pv;
        }
      });

      return Math.max(0, base + pvEventosPosApos);
      } else {
        // Base: PV das retiradas mensais até o final do ano 99 (sempre termina no final do ano 99)
        const consumoEndAge = 99;
        // Ajuste: considerar que o capital deve durar até o final do ano 99 (incluindo o ano 99 completo)
        // Se aposenta aos 65, precisa durar: anos 65, 66, ..., 99 = 35 anos = 420 meses
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
              const months = (start - idade_para_aposentar) * 12;
              const pv = annualAmount / Math.pow(1 + taxa_mensal_consumo, Math.max(0, months));
              pvEventosPosApos += evento.isPositive ? pv : -pv;
            }
          } else {
            for (let a = Math.max(start, idade_para_aposentar); a <= last; a++) {
              const months = (a - idade_para_aposentar) * 12;
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
              const m = (start - idade_para_aposentar) * 12;
              pvEventosPosApos += evento.isPositive ? (annualAmount / Math.pow(1 + taxa_mensal_real_consumo, m)) : -(annualAmount / Math.pow(1 + taxa_mensal_real_consumo, m));
            }
          } else {
            for (let a = Math.max(start, idade_para_aposentar); a <= last; a++) {
              const m = (a - idade_para_aposentar) * 12;
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
        // Ajuste: considerar que o capital deve durar até o final do ano 99 (incluindo o ano 99 completo)
        // Se aposenta aos 65, precisa durar: anos 65, 66, ..., 99 = 35 anos = 420 meses
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
              const m = (start - idade_para_aposentar) * 12;
              pvEventosPosApos += evento.isPositive ? (annualAmount / Math.pow(1 + taxa_mensal_real_consumo, m)) : -(annualAmount / Math.pow(1 + taxa_mensal_real_consumo, m));
            }
          } else {
            for (let a = Math.max(start, idade_para_aposentar); a <= last; a++) {
              const m = (a - idade_para_aposentar) * 12;
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
        saque_mensal_desejado
      );
      return { 
        aporteMensal: overrideAporteMensal, 
        rendaMensal: rendaUsadaNoCalculo, 
        capitalNecessario: calcCapitalNecessario(rendaPermitida)
      };
    } else {
      // Calcular aporte para atingir a renda desejada e terminar com capital 0 aos 99 (considerando eventos)
      const kNec = calcCapitalNecessario(saque_mensal_desejado);
      const capitalTotalDisponivelNaAposentadoria = capitalFuturo + valorFuturoEventosPre;
      if (capitalTotalDisponivelNaAposentadoria >= kNec) {
        return { aporteMensal: 0, rendaMensal: saque_mensal_desejado, capitalNecessario: kNec };
      }
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
  const simularFluxoCapital = (options?: { forceZeroAtEnd?: boolean }) => {
    const forceZeroAtEnd = options?.forceZeroAtEnd ?? true;
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

    // Fase de acumulação
    while (idade < idade_para_aposentar) {
      const capitalInicial = capital;

      // Aplica eventos de liquidez no ano atual (já agregados por idade)
      const delta = eventsByAge.get(idade) || 0;
      capital += delta;

      // Capitalização mensal equivalente para 12 meses
      const taxaMensalReal = Math.pow(1 + rentabilidade_real_liquida_acumulacao, 1 / 12) - 1;
      const fatorAnual = Math.pow(1 + taxaMensalReal, 12);

      // Aportes mensais ao longo do ano (valor futuro no fim dos 12 meses)
      const aporteAnual = aporteMensal * 12;
      const fvAportes = taxaMensalReal === 0
        ? aporteAnual
        : aporteMensal * ((fatorAnual - 1) / taxaMensalReal);

      // Rendimento separando capital inicial e crescimento sobre os aportes do ano
      const rendimentoCapital = capital * (fatorAnual - 1);
      const rendimentoAportes = fvAportes - aporteAnual;
      const rendimentoTotal = rendimentoCapital + rendimentoAportes;

      // Atualiza o capital com rendimento total e o aporte efetivado no ano
      const capitalFinal = capital + aporteAnual + rendimentoTotal;

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

      // Registra o capital FINAL do ano (após todos os cálculos) para o gráfico
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

        // Eventos são exibidos, porém não alteram o principal em perpetuidade
        const delta = eventsByAge.get(idade) || 0;

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

        // Registra o capital FINAL do ano (após todos os cálculos) para o gráfico
        fluxo.push({ idade, capital: capitalFinal > 0 ? capitalFinal : 0 });

        capital = capitalFinal;
        idade++;
      }
    } else {
      const consumoEndAge = 99;
      while (idade <= consumoEndAge) {
        const capitalInicial = capital;

        // Aplica eventos de liquidez no ano atual (agregados) - aplica ANTES de calcular rendimento
        const delta = eventsByAge.get(idade) || 0;
        capital += delta; // Aplica eventos primeiro

        // Capitalização mensal equivalente na fase de consumo
        const taxaMensalConsumo = Math.pow(1 + rentabilidade_real_liquida_consumo, 1 / 12) - 1;
        const fatorAnualConsumo = Math.pow(1 + taxaMensalConsumo, 12);
        const saqueMensal = saque_mensal_desejado; // Sempre usar a renda desejada pelo usuário
        const fvSaques = taxaMensalConsumo === 0
          ? saqueMensal * 12
          : saqueMensal * ((fatorAnualConsumo - 1) / taxaMensalConsumo);

        const rendimentoCapital = capital * (fatorAnualConsumo - 1);
        let saqueEfetivo = fvSaques; // valor futuro dos 12 saques mensais
        
        // Calcula capital final: capital (já com eventos) + rendimento - saques
        let capitalFinal = capital + rendimentoCapital - saqueEfetivo;

        // Se o capital ficaria negativo ANTES do ano 99, ajustamos o saque para não ficar negativo
        // Mas NÃO marcamos esgotamento - continuamos até os 99 anos
        if (capitalFinal < 0 && idade < consumoEndAge) {
          // Limita o saque ao que está disponível (capital + rendimento)
          saqueEfetivo = Math.max(0, capital + rendimentoCapital);
          capitalFinal = 0;
          // NÃO marca esgotamento aqui - apenas ajusta o saque
        }

        if (!forceZeroAtEnd && capitalFinal <= 0 && idadeEsgotamento === null) {
          capitalFinal = 0;
          idadeEsgotamento = idade;
        }

        // Forçar término APENAS no final do ano 99: no último ano do horizonte, drenar o saldo remanescente
        if (forceZeroAtEnd && idade === consumoEndAge) {
          // No último ano, sempre drenar o saldo remanescente
          saqueEfetivo = Math.max(0, capital + rendimentoCapital);
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

        // Registra o capital FINAL do ano (após todos os cálculos) para o gráfico
        fluxo.push({ idade, capital: capitalFinal > 0 ? capitalFinal : 0 });

        capital = capitalFinal;
        idade++;
      }
    }

    return { fluxo, fluxoCaixaAnual, idadeEsgotamento };
  };

  const shouldForceZeroAtEnd = overrideAporteMensal == null ? aporteMensal > 0 : true;
  const resultado = simularFluxoCapital({ forceZeroAtEnd: shouldForceZeroAtEnd });
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
  isClientVersion,
  externalLiquidityEvents,
  pgblAnual,
  taxaRetornoInicial,
  onTaxaRetornoChange
}) => {
  const { isCardVisible, toggleCardVisibility } = useCardVisibility();
  // Removed selectedView state since we only show the complete scenario
  const initialReturnRate = typeof taxaRetornoInicial === 'number' ? taxaRetornoInicial : 0.03;
  const [taxaRetorno, setTaxaRetorno] = useState<number>(initialReturnRate); // 3% real ao ano como na planilha
  const [rendaMensal, setRendaMensal] = useState<number>(rendaMensalDesejada);
  const [idadeAposentadoria, setIdadeAposentadoria] = useState<number>(retirementAge);
  const [isPerpetuity, setIsPerpetuity] = useState<boolean>(false);
  // Seletor de cenários: 'current' usa excedente; 'target' calcula aporte necessário
  const [selectedScenario, setSelectedScenario] = useState<'current' | 'target'>('current');
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
      initialReturnRate,
      initialReturnRate,
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
    // Projeção principal com base no aporte editável (override quando presente)
    const effectiveOverride = overrideAporte;
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
      false
    );

    // Atualiza o aporte mostrado conforme o modo
    setAporteMensal(effectiveOverride != null ? effectiveOverride : result.aporteMensal);

    // Métrica paralela: renda alcançável e idade de esgotamento usando o excedente atual (100% do monthlyContribution)
    const aporteAtual = Math.max(0, monthlyContribution || 0);
    const { rendaPermitida, idadeEsgotamento: idadeFim } = calculatePermittedIncomeAndDepletionAge(
      currentAge,
      idadeAposentadoria,
      lifeExpectancy,
      currentPortfolio,
      aporteAtual,
      taxaRetorno,
      taxaRetorno,
      liquidityEvents,
      isPerpetuity
    );
    setReachableIncome(rendaPermitida);
    setIdadeEsgotamento(idadeFim ?? null);

    setProjection({
      ...result,
      fluxoCapital: result.fluxoCapital.map(item => ({
        age: item.idade,
        capital: Math.round(item.capital)
      }))
    });
  }, [liquidityEvents, currentAge, idadeAposentadoria, lifeExpectancy, currentPortfolio, monthlyContribution, rendaMensal, taxaRetorno, isPerpetuity, overrideAporte]);

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
      initialReturnRate,
      initialReturnRate,
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

  useEffect(() => {
    if (typeof taxaRetornoInicial === 'number' && Math.abs(taxaRetornoInicial - taxaRetorno) > 0.0001) {
      setTaxaRetorno(taxaRetornoInicial);
    }
  }, [taxaRetornoInicial]);

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

  // Recalcula projeção e rendas quando os eventos de liquidez mudam
  const recalculateAfterEventsChange = (updatedEvents: LiquidityEvent[]) => {
    // Cenário Atual (usa excedente mensal atual)
    const aporteAtual = Math.max(0, monthlyContribution || 0);
    const { rendaPermitida: rendaAtual, idadeEsgotamento: idadeFimAtual } = calculatePermittedIncomeAndDepletionAge(
      currentAge,
      idadeAposentadoria,
      lifeExpectancy,
      currentPortfolio,
      aporteAtual,
      taxaRetorno,
      taxaRetorno,
      updatedEvents,
      isPerpetuity
    );
    setReachableIncome(rendaAtual);
    setIdadeEsgotamento(idadeFimAtual ?? null);

    // Simulação (usa aporte editável ou override quando presente)
    const aporteSim = Math.max(0, (overrideAporte != null ? overrideAporte : aporteMensal) || 0);
    const { rendaPermitida: rendaSim } = calculatePermittedIncomeAndDepletionAge(
      currentAge,
      idadeAposentadoria,
      lifeExpectancy,
      currentPortfolio,
      aporteSim,
      taxaRetorno,
      taxaRetorno,
      updatedEvents,
      isPerpetuity
    );
    setRendaMensal(rendaSim);

    const result = calculateRetirementProjection(
      currentAge,
      idadeAposentadoria,
      lifeExpectancy,
      currentPortfolio,
      aporteSim,
      rendaSim,
      taxaRetorno,
      taxaRetorno,
      updatedEvents,
      isPerpetuity,
      aporteSim,
      false
    );
    setAporteMensal(overrideAporte != null ? aporteSim : result.aporteMensal);
    setProjection({
      ...result,
      fluxoCapital: result.fluxoCapital.map(item => ({
        age: item.idade,
        capital: Math.round(item.capital)
      }))
    });
  };

  const handleAddLiquidityEvent = async () => {
    // Não permitir adicionar eventos na versão cliente
    if (isClientVersion) return;
    
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
    // Não permitir remover eventos na versão cliente
    if (isClientVersion) return;
    
    const updatedEvents = liquidityEvents.filter(event => event.id !== id);
    setLiquidityEvents(updatedEvents);

    // Recalcula projeção/rendas e sincroniza
    recalculateAfterEventsChange(updatedEvents);
    await syncEventsToApi(updatedEvents);
  };

  const handleToggleLiquidityEvent = async (id: string, enabled: boolean) => {
    const updatedEvents = liquidityEvents.map(ev => ev.id === id ? { ...ev, enabled } : ev);
    setLiquidityEvents(updatedEvents);

    // Recalcula projeção/rendas e sincroniza
    recalculateAfterEventsChange(updatedEvents);
    await syncEventsToApi(updatedEvents);
  };

  const startEditLiquidityEvent = (ev: LiquidityEvent) => {
    // Não permitir iniciar edição na versão cliente
    if (isClientVersion) return;
    
    setEditingEventId(ev.id);
    setEditName(ev.name);
    setEditValue(ev.value);
    setEditType(ev.isPositive ? 'positive' : 'negative');
    setEditRecurrence(ev.recurrence || 'once');
    setEditStartAge(ev.startAge ?? ev.age ?? currentAge + 1);
    setEditEndAge(ev.endAge == null ? '' : ev.endAge);
  };

  const saveEditLiquidityEvent = async () => {
    // Não permitir editar eventos na versão cliente
    if (isClientVersion) return;
    
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

    // Recalcula projeção/rendas e sincroniza
    recalculateAfterEventsChange(updatedEvents);
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

  // Calcular ticks customizados para o eixo X baseado no range de idades
  const xAxisTicks = React.useMemo(() => {
    const range = 100 - currentAge;
    const ticks: number[] = [];
    
    // Determinar o intervalo baseado no range
    let interval: number;
    if (range <= 30) {
      interval = 2; // Mostrar de 2 em 2 anos
    } else if (range <= 50) {
      interval = 5; // Mostrar de 5 em 5 anos
    } else {
      interval = 10; // Mostrar de 10 em 10 anos
    }
    
    // Sempre incluir a idade atual e 100
    ticks.push(currentAge);
    
    // Adicionar ticks no intervalo calculado
    for (let age = Math.ceil(currentAge / interval) * interval; age < 100; age += interval) {
      if (age > currentAge && age < 100) {
        ticks.push(age);
      }
    }
    
    // Sempre incluir a idade de aposentadoria se estiver no range
    if (idadeAposentadoria > currentAge && idadeAposentadoria < 100 && !ticks.includes(idadeAposentadoria)) {
      ticks.push(idadeAposentadoria);
    }
    
    // Sempre incluir 100 (ou 99 se for o caso)
    ticks.push(100);
    
    // Ordenar e remover duplicatas
    return [...new Set(ticks)].sort((a, b) => a - b);
  }, [currentAge, idadeAposentadoria]);

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
    <TooltipProvider>
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

          {/* Cenário único: usar apenas o aporte atual e exibir renda alcançável */}

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

                // Cenário atual (lado esquerdo) usa o excedente mensal atual
                const aporteAtual = Math.max(0, monthlyContribution || 0);
                const { rendaPermitida: rendaAtual, idadeEsgotamento: idadeFimAtual } = calculatePermittedIncomeAndDepletionAge(
                  currentAge,
                  idadeAposentadoria,
                  lifeExpectancy,
                  currentPortfolio,
                  aporteAtual,
                  taxaRetorno,
                  taxaRetorno,
                  liquidityEvents,
                  checked
                );
                setReachableIncome(rendaAtual);
                setIdadeEsgotamento(idadeFimAtual ?? null);

                // Simulação (lado direito) usa o aporte editável atual
                const aporteSim = Math.max(0, (overrideAporte != null ? overrideAporte : aporteMensal) || 0);
                const { rendaPermitida: rendaSim } = calculatePermittedIncomeAndDepletionAge(
                  currentAge,
                  idadeAposentadoria,
                  lifeExpectancy,
                  currentPortfolio,
                  aporteSim,
                  taxaRetorno,
                  taxaRetorno,
                  liquidityEvents,
                  checked
                );
                // Ajusta automaticamente a renda objetivo da simulação
                setRendaMensal(rendaSim);

                // Recalcula projeção principal com os parâmetros da simulação
                const result = calculateRetirementProjection(
                  currentAge,
                  idadeAposentadoria,
                  lifeExpectancy,
                  currentPortfolio,
                  aporteSim,
                  rendaSim,
                  taxaRetorno,
                  taxaRetorno,
                  liquidityEvents,
                  checked,
                  aporteSim,
                  true
                );

                setProjection({
                  ...result,
                  fluxoCapital: result.fluxoCapital.map(item => ({
                    age: item.idade,
                    capital: Math.round(item.capital)
                  }))
                });

                // Sincroniza eventos de fluxo com a API para refletir o modo atual
                // (não altera a lista, apenas garante persistência do estado)
                syncEventsToApi(liquidityEvents);
              }}
            />
          </div>

          {/* Removido: slider de % do excedente. Sempre usa 100% do aporte atual. */}

          {/* Seção Principal: Cenário Atual vs Simulação */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Cenário Atual (Baseado no Excedente) */}
            <div className="space-y-4 p-4 rounded-lg" style={{ backgroundColor: chartPalette.alpha[8], borderColor: chartPalette.primary, borderWidth: '1px', borderStyle: 'solid' }}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: chartPalette.primary }}></div>
                <h3 className="font-semibold" style={{ color: chartPalette.primary }}>Cenário Atual</h3>
              </div>
              <p className="text-xs" style={{ color: chartPalette.primary, opacity: 0.8 }}>
                Baseado no seu excedente mensal atual. Mostra o que você conseguiria com o que já tem disponível para investir.
              </p>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium" style={{ color: chartPalette.primary }}>Excedente Mensal Atual</Label>
                  <div className="text-lg font-semibold" style={{ color: chartPalette.primary }}>
                    {formatCurrency(Math.max(0, monthlyContribution || 0))}
                  </div>
                  <p className="text-xs" style={{ color: chartPalette.primary, opacity: 0.7 }}>Valor disponível para investir</p>
                </div>
                
                <div className="p-3 rounded-md" style={{ backgroundColor: chartPalette.alpha[8], borderColor: chartPalette.secondary, borderWidth: '1px', borderStyle: 'solid' }}>
                  <div className="text-xs font-medium mb-1" style={{ color: chartPalette.secondary }}>Renda Alcançável até os 100 anos</div>
                  <div className="text-sm font-bold" style={{ color: chartPalette.secondary }}>
                    {formatCurrency(reachableIncome || 0)}
                  </div>
                </div>
              </div>
            </div>

            {/* Simulação (Aporte Editável) */}
            <div className="space-y-4 p-4 rounded-lg" style={{ backgroundColor: chartPalette.alpha[4], borderColor: chartPalette.emphasis, borderWidth: '1px', borderStyle: 'solid' }}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: chartPalette.emphasis }}></div>
                <h3 className="font-semibold" style={{ color: chartPalette.emphasis }}>Simulação</h3>
              </div>
              <p className="text-xs" style={{ color: chartPalette.emphasis, opacity: 0.8 }}>
                Teste diferentes cenários editando o aporte mensal e a renda objetivo. Veja como mudanças afetam seus resultados.
              </p>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="aporteMensal" className="text-sm font-medium" style={{ color: chartPalette.emphasis }}>Aporte Mensal (editável)</Label>
                  <CurrencyInput
                    id="aporteMensal"
                    value={aporteMensal}
                    onChange={(value) => {
                      setAporteMensal(value);
                      setOverrideAporte(value);
                      
                      // Recalcular renda objetivo baseada no novo aporte
                      const { rendaPermitida } = calculatePermittedIncomeAndDepletionAge(
                        currentAge,
                        idadeAposentadoria,
                        lifeExpectancy,
                        currentPortfolio,
                        value,
                        taxaRetorno,
                        taxaRetorno,
                        liquidityEvents,
                        isPerpetuity
                      );
                      setRendaMensal(rendaPermitida);
                    }}
                    className="h-9 mt-1"
                    disabled={false}
                  />
                  <p className="text-xs mt-1" style={{ color: chartPalette.emphasis, opacity: 0.7 }}>Teste diferentes valores de aporte</p>
                </div>
                
                <div>
                  <Label htmlFor="rendaMensal" className="text-sm font-medium" style={{ color: chartPalette.emphasis }}>Renda Objetivo</Label>
                  <CurrencyInput
                    id="rendaMensal"
                    value={rendaMensal}
                    onChange={(value) => {
                      setRendaMensal(value);
                      setOverrideAporte(null);
                      
                      // Recalcular aporte necessário para atingir a nova renda objetivo
                      const result = calculateRetirementProjection(
                        currentAge,
                        idadeAposentadoria,
                        lifeExpectancy,
                        currentPortfolio,
                        aporteMensal,
                        value,
                        taxaRetorno,
                        taxaRetorno,
                        liquidityEvents,
                        isPerpetuity,
                        null,
                        false
                      );
                      setAporteMensal(result.aporteMensal);
                    }}
                    className="h-9 mt-1"
                  />
                  <p className="text-xs mt-1" style={{ color: chartPalette.emphasis, opacity: 0.7 }}>Objetivo: {formatCurrency(rendaMensalDesejada)}</p>
                </div>

                {/* Resultados da Simulação */}
                <div className="mt-4">
                  <div className="p-3 rounded-md" style={{ backgroundColor: chartPalette.alpha[4], borderColor: chartPalette.secondary, borderWidth: '1px', borderStyle: 'solid' }}>
                    <div className="text-xs font-medium mb-1" style={{ color: chartPalette.secondary }}>Renda Alcançável até os 100 anos</div>
                    <div className="text-sm font-bold" style={{ color: chartPalette.secondary }}>
                      {(() => {
                        const { rendaPermitida } = calculatePermittedIncomeAndDepletionAge(
                          currentAge,
                          idadeAposentadoria,
                          lifeExpectancy,
                          currentPortfolio,
                          aporteMensal,
                          taxaRetorno,
                          taxaRetorno,
                          liquidityEvents,
                          isPerpetuity
                        );
                        return formatCurrency(rendaPermitida || 0);
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* Controles Avançados */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="taxaRetorno" style={{ color: chartPalette.primary }}>Taxa de Retorno Real</Label>
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
                    onTaxaRetornoChange?.(newTaxaRetorno);

                    // Recalcula a projeção com os novos valores
                    const aporteAtual = Math.max(0, monthlyContribution || 0);
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
                      overrideAporte,
                      false
                    );

                    setAporteMensal(overrideAporte != null ? overrideAporte : result.aporteMensal);

                    // Atualiza renda alcançável e idade de esgotamento
                    const { rendaPermitida, idadeEsgotamento: idadeFim } = calculatePermittedIncomeAndDepletionAge(
                      currentAge,
                      idadeAposentadoria,
                      lifeExpectancy,
                      currentPortfolio,
                      aporteAtual,
                      newTaxaRetorno,
                      newTaxaRetorno,
                      liquidityEvents,
                      isPerpetuity
                    );
                    setReachableIncome(rendaPermitida);
                    setIdadeEsgotamento(idadeFim ?? null);
                    
                    // Atualiza a renda objetivo baseada no aporte atual com a nova taxa
                    const aporteParaRenda = overrideAporte != null ? overrideAporte : aporteMensal;
                    const { rendaPermitida: rendaComAporte } = calculatePermittedIncomeAndDepletionAge(
                      currentAge,
                      idadeAposentadoria,
                      lifeExpectancy,
                      currentPortfolio,
                      aporteParaRenda,
                      newTaxaRetorno,
                      newTaxaRetorno,
                      liquidityEvents,
                      isPerpetuity
                    );
                    setRendaMensal(rendaComAporte);

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
              <Label htmlFor="idadeAposentadoria" style={{ color: chartPalette.primary }}>Idade de Aposentadoria</Label>
              <Input
                id="idadeAposentadoria"
                type="number"
                value={idadeAposentadoria}
                onChange={(e) => {
                  const newAge = parseInt(e.target.value) || retirementAge;
                  setIdadeAposentadoria(newAge);

                  // Recalcula a projeção com os novos valores
                  const aporteAtual = Math.max(0, monthlyContribution || 0);
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
                    overrideAporte,
                    false
                  );

                  setAporteMensal(overrideAporte != null ? overrideAporte : result.aporteMensal);

                  // Atualiza renda alcançável e idade de esgotamento
                  const { rendaPermitida, idadeEsgotamento: idadeFim } = calculatePermittedIncomeAndDepletionAge(
                    currentAge,
                    newAge,
                    lifeExpectancy,
                    currentPortfolio,
                    aporteAtual,
                    taxaRetorno,
                    taxaRetorno,
                    liquidityEvents,
                    isPerpetuity
                  );
                  setReachableIncome(rendaPermitida);
                  setIdadeEsgotamento(idadeFim ?? null);
                  
                  // Atualiza a renda objetivo baseada no aporte atual com a nova idade de aposentadoria
                  const aporteParaRenda = overrideAporte != null ? overrideAporte : aporteMensal;
                  const { rendaPermitida: rendaComAporte } = calculatePermittedIncomeAndDepletionAge(
                    currentAge,
                    newAge,
                    lifeExpectancy,
                    currentPortfolio,
                    aporteParaRenda,
                    taxaRetorno,
                    taxaRetorno,
                    liquidityEvents,
                    isPerpetuity
                  );
                  setRendaMensal(rendaComAporte);

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
              <p className="text-xs text-muted-foreground">Objetivo: {retirementAge} anos</p>
            </div>
          </div>

          {/* Seção de Eventos de Liquidez */}
          <div className="flex items-center justify-between mb-0.5">
            <Label style={{ color: chartPalette.primary }}>Eventos de Liquidez</Label>
            <div className="text-xs" style={{ color: chartPalette.primary, opacity: 0.7 }}>
              Eventos que afetam seu patrimônio em momentos específicos
            </div>
          </div>

          {/* Sugestões de rendas (inclusão manual) */}
          {Array.isArray(externalLiquidityEvents) && externalLiquidityEvents.filter(e => (e.isPositive !== false)).length > 0 && (
            <div className="border border-dashed rounded-md p-3 mb-3 w-full overflow-hidden" style={{ borderColor: chartPalette.primary, backgroundColor: chartPalette.alpha[4] }}>
              <div className="text-xs mb-2" style={{ color: chartPalette.primary, opacity: 0.7 }}>
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
                        style={{ borderColor: chartPalette.secondary, color: chartPalette.secondary, backgroundColor: chartPalette.alpha[8] }}
                        title={`${s.name} • ${(recurrence === 'once') ? 'Única' : (recurrence === 'annual' ? 'Anual' : 'Mensal')}`}
                      >
                        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: chartPalette.secondary }}></span>
                          <span className="truncate">{s.name}</span>
                          <span className="opacity-70">{startAge}+</span>
                          <span className="font-medium">{formatCurrency(Number(s.value || 0))}</span>
                        </div>
                        <button
                          onClick={() => addSuggestedIncome(s as any)}
                          disabled={alreadyIncluded}
                          className={`w-full sm:w-auto sm:ml-auto h-6 px-2 rounded mt-1 sm:mt-0 ${alreadyIncluded ? 'bg-muted text-muted-foreground cursor-not-allowed' : ''}`}
                          style={!alreadyIncluded ? { backgroundColor: chartPalette.secondary, color: 'white' } : {}}
                        >
                          {alreadyIncluded ? 'Incluída' : 'Incluir'}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Disclaimer sobre aportes PGBL */}
          {pgblAnual && pgblAnual > 0 && externalLiquidityEvents?.some(e => e.id === 'pgbl-contributions') && (
            <div className="mb-3 p-4 bg-muted/50 border border-border/50 rounded-lg">
              <div className="flex items-start gap-3">
                <Info size={18} className="text-financial-info mt-0.5 flex-shrink-0" style={{ color: chartPalette.primary }} />
                <div className="text-sm text-foreground">
                  <strong className="font-semibold">Sobre os aportes PGBL sugeridos:</strong>
                  <p className="mt-2 text-muted-foreground">
                    O valor sugerido considera aportes anuais de 12% da renda tributável ({formatCurrency(pgblAnual)}/ano), 
                    capitalizados até a data de aposentadoria. O cálculo assume:
                  </p>
                  <ul className="mt-2 ml-4 list-disc space-y-1 text-muted-foreground">
                    <li>Aportes anuais de 12% da renda tributável (limite legal para dedução no IRPF)</li>
                    <li>Aportes mantidos em termos reais (sem reajuste automático pela inflação)</li>
                    <li>Taxa de retorno real de {(taxaRetorno * 100).toFixed(1)}% ao ano — a mesma configurada no simulador</li>
                    <li>O valor total é projetado como uma entrada única na data de aposentadoria</li>
                  </ul>
                  <p className="mt-2 text-muted-foreground">
                    Você pode incluí-lo manualmente clicando em "Incluir" para considerar esse valor na projeção de aposentadoria.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="border rounded-md overflow-hidden mb-6" style={{ borderColor: chartPalette.primary }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead style={{ backgroundColor: chartPalette.alpha[8] }}>
                  <tr>
                    <th className="py-2 px-3 text-left font-medium" style={{ color: chartPalette.primary }}>Evento</th>
                    <th className="py-2 px-3 text-center font-medium" style={{ color: chartPalette.primary }}>Início</th>
                    <th className="py-2 px-3 text-center font-medium" style={{ color: chartPalette.primary }}>Término</th>
                    <th className="py-2 px-3 text-center font-medium" style={{ color: chartPalette.primary }}>Recorrência</th>
                    <th className="py-2 px-3 text-center font-medium" style={{ color: chartPalette.primary }}>Tipo</th>
                    <th className="py-2 px-3 text-right font-medium" style={{ color: chartPalette.primary }}>Valor</th>
                    <th className="py-2 px-3 text-center font-medium" style={{ color: chartPalette.primary }}>Ativo</th>
                    <th className="py-2 px-3 text-center font-medium" style={{ color: chartPalette.primary }}>Ações</th>
                  </tr>
                </thead>
              <tbody className="divide-y" style={{ borderColor: chartPalette.alpha[8] }}>
                {liquidityEvents.map(event => (
                  editingEventId === event.id ? (
                    <tr key={event.id} style={{ backgroundColor: chartPalette.alpha[4] }}>
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
                            className="text-xs font-medium"
                            style={{ color: chartPalette.secondary }}
                            onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.color = chartPalette.emphasis}
                            onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.color = chartPalette.secondary}
                          >Salvar</button>
                          <button
                            onClick={cancelEditLiquidityEvent}
                            className="text-xs"
                            style={{ color: chartPalette.primary, opacity: 0.7 }}
                            onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
                            onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.opacity = '0.7'}
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
                        <span className="inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: event.isPositive ? chartPalette.alpha[8] : chartPalette.alpha[8], color: event.isPositive ? chartPalette.secondary : chartPalette.accent }}>
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
                            style={{ color: isClientVersion ? '#ccc' : chartPalette.primary }}
                            onMouseEnter={(e) => {
                              if (!isClientVersion) {
                                (e.currentTarget as HTMLButtonElement).style.color = chartPalette.emphasis;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isClientVersion) {
                                (e.currentTarget as HTMLButtonElement).style.color = chartPalette.primary;
                              }
                            }}
                            title={isClientVersion ? "Não permitido na versão cliente" : "Editar"}
                            disabled={isClientVersion}
                          >✎</button>
                          <button
                            onClick={() => handleRemoveLiquidityEvent(event.id)}
                            style={{ color: isClientVersion ? '#ccc' : chartPalette.accent }}
                            onMouseEnter={(e) => {
                              if (!isClientVersion) {
                                (e.currentTarget as HTMLButtonElement).style.color = chartPalette.emphasis;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isClientVersion) {
                                (e.currentTarget as HTMLButtonElement).style.color = chartPalette.accent;
                              }
                            }}
                            title={isClientVersion ? "Não permitido na versão cliente" : "Remover evento"}
                            disabled={isClientVersion}
                          >
                            ×
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}

                {/* Formulário para adicionar novo evento */}
                <tr style={{ backgroundColor: chartPalette.alpha[4] }}>
                  <td className="py-2 px-3">
                    <Input
                      placeholder="Nome do evento"
                      value={newEventName}
                      onChange={(e) => setNewEventName(e.target.value)}
                      className="h-8 text-xs"
                      disabled={isClientVersion}
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
                      disabled={isClientVersion}
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
                      disabled={isClientVersion || newEventRecurrence === 'once'}
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <select
                      value={newEventRecurrence}
                      onChange={(e) => setNewEventRecurrence(e.target.value as 'once' | 'annual' | 'monthly')}
                      className="h-8 text-xs rounded-md border border-input bg-background px-2"
                      disabled={isClientVersion}
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
                      disabled={isClientVersion}
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
                      disabled={isClientVersion}
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={handleAddLiquidityEvent}
                      className="h-8 w-8 rounded-full flex items-center justify-center text-lg font-bold"
                      style={{ backgroundColor: chartPalette.primary, color: 'white' }}
                      title={isClientVersion ? "Não permitido na versão cliente" : "Adicionar evento"}
                      disabled={isClientVersion || !newEventName || newEventStartAge < currentAge || newEventValue <= 0 || (newEventRecurrence !== 'once' && newEventEndAge !== '' && Number(newEventEndAge) < newEventStartAge)}
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
        <div className="mb-3 p-2 rounded-md bg-muted/30 border border-border/60">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Info size={14} className="text-accent flex-shrink-0" />
            <span>O gráfico abaixo representa a <strong>Simulação</strong> (valores editáveis), não o Cenário Atual.</span>
          </p>
        </div>
        <div className="h-[320px] mb-6">
          <ChartContainer config={chartConfig} className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={filteredData}
                margin={{ top: 25, right: 30, left: 20, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} style={{ stroke: chartPalette.alpha[8] }} />
                <XAxis
                  dataKey="age"
                  label={{ value: 'Idade', position: 'insideBottom', offset: -15, fill: chartPalette.primary, fontSize: 12 }}
                  tick={{ fill: chartPalette.primary, fontSize: 11 }}
                  tickLine={{ stroke: chartPalette.primary }}
                  axisLine={{ stroke: chartPalette.primary }}
                  padding={{ left: 10, right: 10 }}
                  domain={xDomain}
                  ticks={xAxisTicks}
                  tickFormatter={(value) => value.toString()}
                  minTickGap={20}
                />
                <YAxis
                  tickFormatter={formatYAxis}
                  domain={[0, 'auto']}
                  tick={{ fill: chartPalette.primary, fontSize: 11 }}
                  tickLine={{ stroke: chartPalette.primary }}
                  axisLine={{ stroke: chartPalette.primary }}
                  label={{
                    value: 'Patrimônio',
                    angle: -90,
                    position: 'insideLeft',
                    offset: -5,
                    fill: chartPalette.primary,
                    fontSize: 12
                  }}
                />
                <RechartsTooltip
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
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: e.isPositive ? chartPalette.secondary : chartPalette.accent }} />
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
                    lineHeight: '1.2em',
                    color: chartPalette.primary
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
                    borderColor: e.isPositive ? chartPalette.secondary : chartPalette.accent,
                    color: e.isPositive ? chartPalette.secondary : chartPalette.accent,
                    backgroundColor: e.isPositive ? chartPalette.alpha[8] : chartPalette.alpha[8]
                  }}
                  title={`${e.name} • ${e.recurrence && e.recurrence !== 'once' ? 'Recorrente' : 'Único'}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-block w-2 h-2 rounded-full`} style={{ backgroundColor: e.isPositive ? chartPalette.secondary : chartPalette.accent }}></span>
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

        {/* Tabela de informações sobre o cenário removida por solicitação */}

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
    </TooltipProvider>
  );
};

export default RetirementProjectionChart;
