export type Perfil = 'Super Conservador' | 'Conservador' | 'Moderado' | 'Arrojado' | 'Agressivo';

export interface ClasseAlocacao {
  tipo: string; // Classe (ex.: PÓS-FIXADO, IPCA, PRÉ-FIXADO, RV BRASIL, FII, MULTIMERCADO, INTERNACIONAL, ALTERNATIVO, MOEDAS, OUTROS, CRIPTOMOEDAS, DERIVATIVOS)
  percentual: number; // % alocação da classe
}

// Tabela extraída de Carteiras_Modelo_Completas_Novo.md (Alocação por classe)
export const MODEL_CLASS_ALLOCATION: Record<Perfil, ClasseAlocacao[]> = {
  'Super Conservador': [
    { tipo: 'PÓS-FIXADO', percentual: 84 },
    { tipo: 'IPCA', percentual: 11 },
    { tipo: 'PRÉ-FIXADO', percentual: 5 },
    { tipo: 'RV BRASIL', percentual: 0 },
    { tipo: 'FII', percentual: 0 },
    { tipo: 'MULTIMERCADO', percentual: 0 },
    { tipo: 'MOEDAS', percentual: 0 },
    { tipo: 'ALTERNATIVO', percentual: 0 },
    { tipo: 'INTERNACIONAL', percentual: 0 },
    { tipo: 'OUTROS', percentual: 0 },
    { tipo: 'CRIPTOMOEDAS', percentual: 0 },
    { tipo: 'DERIVATIVOS', percentual: 0 },
  ],
  'Conservador': [
    { tipo: 'PÓS-FIXADO', percentual: 71 },
    { tipo: 'IPCA', percentual: 14 },
    { tipo: 'PRÉ-FIXADO', percentual: 6 },
    { tipo: 'MULTIMERCADO', percentual: 3 },
    { tipo: 'INTERNACIONAL', percentual: 6 },
    { tipo: 'RV BRASIL', percentual: 0 },
    { tipo: 'FII', percentual: 0 },
    { tipo: 'MOEDAS', percentual: 0 },
    { tipo: 'ALTERNATIVO', percentual: 0 },
    { tipo: 'OUTROS', percentual: 0 },
    { tipo: 'CRIPTOMOEDAS', percentual: 0 },
    { tipo: 'DERIVATIVOS', percentual: 0 },
  ],
  'Moderado': [
    { tipo: 'PÓS-FIXADO', percentual: 45 },
    { tipo: 'IPCA', percentual: 19 },
    { tipo: 'PRÉ-FIXADO', percentual: 9 },
    { tipo: 'MULTIMERCADO', percentual: 7 },
    { tipo: 'RV BRASIL', percentual: 6 },
    { tipo: 'INTERNACIONAL', percentual: 10 },
    { tipo: 'FII', percentual: 2 },
    { tipo: 'ALTERNATIVO', percentual: 2 },
    { tipo: 'MOEDAS', percentual: 0 },
    { tipo: 'OUTROS', percentual: 0 },
    { tipo: 'CRIPTOMOEDAS', percentual: 0 },
    { tipo: 'DERIVATIVOS', percentual: 0 },
  ],
  'Arrojado': [
    { tipo: 'PÓS-FIXADO', percentual: 26 },
    { tipo: 'IPCA', percentual: 24 },
    { tipo: 'PRÉ-FIXADO', percentual: 11 },
    { tipo: 'RV BRASIL', percentual: 9 },
    { tipo: 'FII', percentual: 3 },
    { tipo: 'MULTIMERCADO', percentual: 10 },
    { tipo: 'INTERNACIONAL', percentual: 14 },
    { tipo: 'ALTERNATIVO', percentual: 3 },
    { tipo: 'MOEDAS', percentual: 0 },
    { tipo: 'OUTROS', percentual: 0 },
    { tipo: 'CRIPTOMOEDAS', percentual: 0 },
    { tipo: 'DERIVATIVOS', percentual: 0 },
  ],
  'Agressivo': [
    { tipo: 'PÓS-FIXADO', percentual: 11 },
    { tipo: 'IPCA', percentual: 26 },
    { tipo: 'PRÉ-FIXADO', percentual: 12 },
    { tipo: 'RV BRASIL', percentual: 14 },
    { tipo: 'FII', percentual: 4 },
    { tipo: 'MULTIMERCADO', percentual: 11 },
    { tipo: 'INTERNACIONAL', percentual: 18 },
    { tipo: 'ALTERNATIVO', percentual: 4 },
    { tipo: 'MOEDAS', percentual: 0 },
    { tipo: 'OUTROS', percentual: 0 },
    { tipo: 'CRIPTOMOEDAS', percentual: 0 },
    { tipo: 'DERIVATIVOS', percentual: 0 },
  ],
};

export function normalizePerfil(raw?: string): Perfil {
  const value = (raw || '').toLowerCase();
  if (value.includes('super')) return 'Super Conservador';
  if (value.includes('conserv')) return 'Conservador';
  if (value.includes('moder')) return 'Moderado';
  if (value.includes('arroj')) return 'Arrojado';
  if (value.includes('agress')) return 'Agressivo';
  return 'Moderado';
}

// Heurística simples de risco e liquidez por classe
export function getRiskForClass(tipo: string): 'Baixo' | 'Médio' | 'Alto' {
  const categoria = mapToAggregatedCategory(tipo);
  if (categoria === 'Renda Fixa') return 'Baixo';
  if (categoria === 'Multimercado') return 'Médio';
  if (categoria === 'Renda Variável') return 'Alto';
  return 'Médio';
}

export function getLiquidityForClass(tipo: string): 'Alta' | 'Média' | 'Baixa' {
  const categoria = mapToAggregatedCategory(tipo);
  if (categoria === 'Renda Fixa') return 'Alta';
  if (categoria === 'Renda Variável') return 'Média';
  if (categoria === 'Multimercado') return 'Média';
  return 'Média';
}

// Mapeia classes detalhadas para categorias agregadas
export function mapToAggregatedCategory(tipo: string): 'Renda Fixa' | 'Renda Variável' | 'Multimercado' | 'Outros' {
  const t = (tipo || '').toUpperCase();
  // Renda Fixa
  if (t.includes('PÓS-FIXADO') || t.includes('POS-FIXADO') || t.includes('IPCA') || t.includes('PRÉ-FIXADO') || t.includes('PRE-FIXADO')) {
    return 'Renda Fixa';
  }
  // Renda Variável
  if (t.includes('RV BRASIL') || t === 'RV' || t.includes('FII')) {
    return 'Renda Variável';
  }
  // Multimercado
  if (t.includes('MULTIMERCADO')) {
    return 'Multimercado';
  }
  // Demais
  return 'Outros';
}

// Agrega uma lista de classes detalhadas em categorias com percentuais somados
export function aggregateModelClasses(classes: ClasseAlocacao[]): ClasseAlocacao[] {
  const acumulado: Record<string, number> = {};
  for (const c of classes) {
    const categoria = mapToAggregatedCategory(c.tipo);
    acumulado[categoria] = (acumulado[categoria] || 0) + (c.percentual || 0);
  }
  // Ordena por uma ordem amigável
  const ordem = ['Renda Fixa', 'Renda Variável', 'Multimercado', 'Outros'];
  return Object.entries(acumulado)
    .filter(([, percentual]) => percentual > 0)
    .sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
    .map(([tipo, percentual]) => ({ tipo, percentual }));
}

// Mapeia nomes comuns de instrumentos para categorias agregadas
export function mapInstrumentToAggregatedCategory(nome: string, classe?: string): 'Renda Fixa' | 'Renda Variável' | 'Multimercado' | 'Outros' {
  const base = (classe || nome || '').toUpperCase();
  // Tenta primeiro pelo mapeamento de classes conhecidas
  const byClass = mapToAggregatedCategory(base);
  if (byClass) return byClass;
  // Heurísticas por instrumento
  if (base.includes('TESOURO') || base.includes('CDB') || base.includes('LCI') || base.includes('LCA') || base.includes('DEBENT') || base.includes('RENDA FIXA')) {
    return 'Renda Fixa';
  }
  if (base.includes('AÇÃO') || base.includes('ACOES') || base.includes('AÇÕES') || base.includes('FII') || base.includes('FUNDO IMOB')) {
    return 'Renda Variável';
  }
  if (base.includes('MULTIMERCADO')) {
    return 'Multimercado';
  }
  return 'Outros';
}

// Agrega investimentos atuais (por valor) para as categorias, recalculando percentuais
export function aggregateCurrentInvestments(investments: Array<{ tipo?: string; classe?: string; valor?: number; percentual?: number }>): Array<{ tipo: string; valor: number; percentual: number; risco: 'Baixo' | 'Médio' | 'Alto'; liquidez: 'Alta' | 'Média' | 'Baixa'; rentabilidade: number }> {
  const somaPorCategoria: Record<string, number> = {};
  let total = 0;
  for (const inv of investments || []) {
    const categoria = mapInstrumentToAggregatedCategory(inv.tipo || '', inv.classe);
    const valor = Number(inv.valor || 0);
    if (!somaPorCategoria[categoria]) somaPorCategoria[categoria] = 0;
    somaPorCategoria[categoria] += valor;
    total += valor;
  }
  const entries = Object.entries(somaPorCategoria);
  return entries
    .filter(([, valor]) => valor > 0)
    .map(([tipo, valor]) => {
      const percentual = total > 0 ? Math.round((valor / total) * 100) : 0;
      return {
        tipo,
        valor: Math.round(valor),
        percentual,
        risco: getRiskForClass(tipo),
        liquidez: getLiquidityForClass(tipo),
        rentabilidade: 0,
      } as const;
    });
}
