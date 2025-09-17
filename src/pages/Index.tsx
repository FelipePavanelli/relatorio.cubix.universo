import React, { useState, useEffect } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { CardVisibilityProvider } from '@/context/CardVisibilityContext';
import { SectionVisibilityProvider } from '@/context/SectionVisibilityContext';
import Header from '@/components/layout/Header';
import CoverPage from '@/components/sections/CoverPage';
import FinancialSummary from '@/components/sections/FinancialSummary';
import InvestmentManagement from '@/components/sections/InvestmentManagement';

import RetirementPlanning from '@/components/sections/RetirementPlanning';
import BeachHouse from '@/components/sections/BeachHouse';
import TaxPlanning from '@/components/sections/TaxPlanning';
import ProtectionPlanning from '@/components/sections/ProtectionPlanning';
import SuccessionPlanning from '@/components/sections/SuccessionPlanning';
import ActionPlan from '@/components/sections/ActionPlan';
import FloatingActions from '@/components/layout/FloatingActions';
import { DotNavigation, MobileDotNavigation } from '@/components/layout/DotNavigation';
import { useSectionObserver } from '@/hooks/useSectionObserver';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import SectionVisibilityControls from '@/components/layout/SectionVisibilityControls';
import HideableSection from '@/components/ui/HideableSection';
import { MODEL_CLASS_ALLOCATION, normalizePerfil, getRiskForClass, getLiquidityForClass, aggregateModelClasses, aggregateCurrentInvestments } from '@/data/modelPortfolios';
import localUserReports from '@/pages/UserReports.json';

// Utilitário simples de deep-merge (preserva valores do destino e preenche com origem)
const deepMerge = (target: any, source: any) => {
  if (Array.isArray(target) && Array.isArray(source)) return target.length ? target : source;
  if (target && typeof target === 'object' && source && typeof source === 'object') {
    const result: any = { ...source, ...target };
    for (const key of Object.keys(result)) {
      if (key in target && key in source) {
        const t = (target as any)[key];
        const s = (source as any)[key];
        if (t && s && typeof t === 'object' && typeof s === 'object') {
          result[key] = deepMerge(t, s);
        } else {
          result[key] = t ?? s;
        }
      }
    }
    return result;
  }
  return target ?? source;
};

interface IndexPageProps {
  accessor?: boolean;
  clientPropect?: boolean;
}

const IndexPage: React.FC<IndexPageProps> = ({ accessor, clientPropect }) => {
  const { activeSection, navigateToSection } = useSectionObserver();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userReports, setUserReports] = useState(null);

  const getClientData = () => {
    const rendasOrigem = (userReports as any)?.financas?.rendas || [];
    const normalize = (s: string) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const isSpouseIncome = (r: any) => {
      const label = normalize(r?.descricao || r?.origem || r?.fonte || '');
      return label.includes('conjuge');
    };
    const totalRendasSemConjuge = rendasOrigem
      .filter((r: any) => !isSpouseIncome(r))
      .reduce((sum: number, r: any) => sum + (Number(r?.valor) || 0), 0);
    const despesasMensais = Number((userReports as any)?.financas?.resumo?.despesas_mensais) || 0;
    const excedenteMensalCorrigido = totalRendasSemConjuge - despesasMensais;

    return ({
      cliente: {
        nome: userReports?.cliente?.nome || "",
        idade: userReports?.cliente?.idade || 0,
        estadoCivil: userReports?.cliente?.estadoCivil || "",
        regimeCasamento: userReports?.cliente?.regimeCasamento || "",
        residencia: userReports?.cliente?.residencia || "",
        profissao: userReports?.cliente?.profissao || "",
        tempoProfissao: userReports?.cliente?.tempo_profissao || userReports?.cliente?.tempoProfissao || "",
        dependentes: userReports?.cliente?.dependentes || [],
        cep: userReports?.cliente?.cep || ""
      },
      financas: {
        formatoTrabalho: userReports?.financas?.formato_trabalho || userReports?.financas?.formatoTrabalho || '',
        patrimonioLiquido: userReports?.financas?.resumo?.patrimonio_liquido || 0,
        excedenteMensal: excedenteMensalCorrigido,
        rendas: (userReports?.financas?.rendas || []).map((r: any) => ({
          fonte: r.fonte,
          descricao: r.descricao || r.origem,
          valor: r.valor,
          tributacao: r.tributacao,
          renda_passiva: (r as any)?.renda_passiva ?? (r as any)?.rendaPassiva ?? false
        })),
        despesasMensais: userReports?.financas?.resumo?.despesas_mensais || 0,
        // Utilizar diretamente a composição patrimonial do JSON, sem transformação
        composicaoPatrimonial: userReports?.financas?.composicao_patrimonial || {},
        // Processar os ativos de forma dinâmica, independente do tipo
        ativos: userReports?.financas?.ativos?.map(a => ({
          tipo: a.tipo,
          valor: a.valor,
          classe: a.classe
        })) || [],
        passivos: userReports?.financas?.passivos || []
      },
      aposentadoria: {
        patrimonioLiquido: userReports?.financas?.resumo?.patrimonio_liquido || 0,
        excedenteMensal: excedenteMensalCorrigido,
        totalInvestido: userReports?.financas?.investimentos_detalhados?.total_investimentos || 0,
        ativos: userReports?.financas?.ativos?.map(a => ({
          tipo: a.tipo,
          valor: a.valor,
          classe: a.classe
        })) || [],
        passivos: userReports?.financas?.passivos || [],

        rendaMensalDesejada: userReports?.planoAposentadoria?.renda_desejada || 0,
        idadeAposentadoria: userReports?.planoAposentadoria?.idade_aposentadoria || 0,
        patrimonioAlvo: userReports?.planoAposentadoria?.capital_necessario || 0,

        idadeAtual: userReports?.planoAposentadoria?.idade_atual || 0,
        // Padroniza expectativa de vida até os 100 anos
        expectativaVida: 100,

        cenarios: userReports?.planoAposentadoria?.cenarios?.map(c => ({
          idade: c.idade_aposentadoria,
          aporteMensal: c.aporte_mensal,
          capitalNecessario: c.capital_necessario
        })) || [],

        perfilInvestidor: userReports?.perfil_investidor || "",
        alocacaoAtivos: userReports?.alocacao_ativos?.composicao?.map(a => ({
          ativo: a.ativo,
          percentual: a.percentual
        })) || [],

        anosRestantes: (userReports?.planoAposentadoria?.idade_aposentadoria || 0) -
          (userReports?.planoAposentadoria?.idade_atual || 0),
        aporteMensalRecomendado: userReports?.planoAposentadoria?.cenarios?.[0]?.aporte_mensal || 0,

        possuiPGBL: userReports?.tributario?.deducoes?.some(d => d.tipo === "PGBL") || false,
        valorPGBL: userReports?.tributario?.deducoes?.find(d => d.tipo === "PGBL")?.valor || 0,

        taxaRetiradaSegura: 0.04,
        taxaInflacao: 0.03,
        taxaJurosReal: 0.03
      },
      objetivos: userReports?.objetivos || [],
      tributario: {
        resumo: userReports?.tributario?.resumo || {},
        estruturacaoPatrimonial: userReports?.tributario?.estruturacaoPatrimonial || [],
        investimentosIsentos: userReports?.tributario?.investimentosIsentos || [],
        deducoes: userReports?.tributario?.deducoes || [],
        holdingFamiliar: userReports?.tributario?.holdingFamiliar || {},
        previdenciaVGBL: userReports?.tributario?.previdenciaVGBL || {},
        economiaTributaria: userReports?.tributario?.economiaTributaria || {}
      },
      protecao: {
        titulo: userReports?.protecao?.titulo || "Proteção Patrimonial",
        resumo: userReports?.protecao?.resumo || (userReports as any)?.protecao?.descricao || "Proteção do patrimônio",
        dependenciaRenda: (userReports as any)?.protecao?.dependencia_renda ?? (userReports as any)?.protecao?.dependenciaRenda ?? null,
        impactoPerdaRenda: (userReports as any)?.protecao?.impacto_perda_renda || (userReports as any)?.protecao?.impactoPerdaRenda || "",
        solucoesExistentes: (userReports as any)?.protecao?.solucoes_existentes || (userReports as any)?.protecao?.solucoesExistentes || [],
        desejaRevisao: (userReports as any)?.protecao?.deseja_revisao ?? (userReports as any)?.protecao?.desejaRevisao ?? null,
        patrimonioEmNomeProprio: Number((userReports as any)?.protecao?.patrimonio_em_nome_proprio ?? (userReports as any)?.protecao?.patrimonioEmNomeProprio) || 0,
        solucaoInventario: (userReports as any)?.protecao?.solucao_inventario || (userReports as any)?.protecao?.solucaoInventario || "",
        analiseNecessidades: userReports?.protecao?.analiseNecessidades || {},
        seguroVida: userReports?.protecao?.seguroVida || {},
        seguroPatrimonial: userReports?.protecao?.seguroPatrimonial || {},
        seguroDO: userReports?.protecao?.seguroDO || {},
        seguroInternacional: userReports?.protecao?.seguroInternacional || {},
        protecaoJuridica: userReports?.protecao?.protecaoJuridica || {},
        recomendacoesAdicionais: userReports?.protecao?.recomendacoesAdicionais || {}
      },
      sucessao: userReports?.sucessao || {},
      planoAcao: {
        titulo: userReports?.planoAcao?.titulo || "Plano de Ação Financeira",
        resumo: userReports?.planoAcao?.resumo || "Plano de ação financeira",
        indicadorSegurancaFinanceira: userReports?.planoAcao?.indicadorSegurancaFinanceira || {},
        cronograma: userReports?.planoAcao?.cronograma || [],
        acoesPrioritarias: userReports?.planoAcao?.acoesPrioritarias || [],
        metasCurtoPrazo: userReports?.planoAcao?.metasCurtoPrazo || [],
        acompanhamentoProgresso: userReports?.planoAcao?.acompanhamentoProgresso || {},
        conclusao: userReports?.planoAcao?.conclusao || {}
      },
      imovelDesejado: userReports?.imovelDesejado || {},
      scoreFinanceiro: userReports?.scoreFinanceiro || {},
      investimentos: {
        totalInvestimentos: userReports?.financas?.investimentos_detalhados?.total_investimentos || 0,
        investimentosDetalhados: userReports?.financas?.investimentos_detalhados,
        investimentosAtuais: (() => {
          const atuais = userReports?.investimentos?.atuais || [
            { tipo: 'Tesouro Direto', valor: 300000, percentual: 35, risco: 'Baixo', liquidez: 'Alta', rentabilidade: 0.115 },
            { tipo: 'CDB', valor: 200000, percentual: 23, risco: 'Baixo', liquidez: 'Alta', rentabilidade: 0.125 },
            { tipo: 'Ações', valor: 180000, percentual: 21, risco: 'Alto', liquidez: 'Média', rentabilidade: 0.18 },
            { tipo: 'Fundos Imobiliários', valor: 120000, percentual: 14, risco: 'Médio', liquidez: 'Baixa', rentabilidade: 0.15 },
            { tipo: 'Previdência', valor: 60000, percentual: 7, risco: 'Baixo', liquidez: 'Baixa', rentabilidade: 0.13 }
          ];
          return aggregateCurrentInvestments(atuais);
        })(),
        sugestaoAltaVista: (() => {
          // Se vier da API, priorizar
          if (userReports?.investimentos?.sugestao) return userReports.investimentos.sugestao;
          // Caso contrário, montar a partir do perfil declarado e alocação por classe
          const perfil = normalizePerfil(userReports?.perfil_investidor || 'Moderado');
          const classes = MODEL_CLASS_ALLOCATION[perfil] || MODEL_CLASS_ALLOCATION['Moderado'];
          // Agregar classes conforme regra: Pós/IPCA/Pré => Renda Fixa; RV Brasil/FII => Renda Variável; Multimercado permanece; demais => Outros
          const aggregated = aggregateModelClasses(classes);
          const totalAtual = (userReports?.investimentos?.atuais || []).reduce((sum: number, inv: any) => sum + (inv.valor || 0), 0) || 0;
          const baseTotal = (userReports?.financas?.composicao_patrimonial?.Investimentos || 0) || totalAtual
          const suggested = aggregated
            .filter(c => c.percentual > 0)
            .map(c => ({
              tipo: c.tipo,
              valor: Math.round((c.percentual / 100) * baseTotal),
              percentual: c.percentual,
              risco: getRiskForClass(c.tipo),
              liquidez: getLiquidityForClass(c.tipo),
              rentabilidade: 0
            }));
          return suggested;
        })(),
        perfilInvestidor: userReports?.perfil_investidor || 'Moderado',
        scoreDiversificacao: userReports?.investimentos?.scoreDiversificacao || 65,
        scoreRisco: userReports?.investimentos?.scoreRisco || 70,
        scoreLiquidez: userReports?.investimentos?.scoreLiquidez || 75,
        recomendacoes: userReports?.investimentos?.recomendacoes || [
          'Aumentar exposição a ativos internacionais para melhorar a diversificação geográfica',
          'Reduzir concentração em renda fixa e aumentar alocação em renda variável para melhor retorno',
          'Considerar fundos de investimento especializados para otimizar a gestão de risco',
          'Implementar estratégia de rebalanceamento trimestral para manter a alocação alvo',
          'Diversificar entre diferentes emissores de CDB para reduzir risco de crédito'
        ],
        impactoEsperado: userReports?.investimentos?.impactoEsperado || {
          rentabilidadeEsperada: 2.8,
          reducaoRisco: 18,
          melhoriaLiquidez: 12
        },
        reservaEmergencia: (() => {
          const despesasMensais = userReports?.financas?.resumo?.despesas_mensais || 0;
          const sugerida = Math.max(0, Math.round(despesasMensais * 6));
          const comp = userReports?.financas?.composicao_patrimonial || {};
          const normalize = (s: string) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          let atual = 0;
          try {
            const keys = Object.keys(comp || {});
            for (const k of keys) {
              const nk = normalize(k);
              if (nk.includes('reserva') || nk.includes('emergencia')) {
                const v = (comp as any)[k];
                if (typeof v === 'number') atual += v;
              }
            }
          } catch (_) { /* noop */ }
          return { atual: Math.round(atual), sugerida };
        })()
      },
      previdencia_privada: userReports?.previdencia_privada || {},
      
    });
  };

  const getPriorities = () => {
    const labels: Record<string, string> = {
      aposentadoria: 'Aposentadoria',
      educacao_filhos: 'Reserva para educação dos filhos',
      reserva_emergencia: 'Reserva de emergência',
      projetos_sonhos: 'Projetos e sonhos financeiros',
      protecao_familiar: 'Proteção familiar e patrimonial no caso de morte',
      manutencao_padrao_vida: 'Manutenção do padrão de vida: no caso de acidente, invalidez ou doença',
    };
    const source = (userReports as any)?.prioridades ?? (localUserReports as any)?.prioridades;
    if (!source || typeof source !== 'object') {
      return [
        { item: 'Proteção familiar e patrimonial no caso de morte', score: 10 },
        { item: 'Reserva para educação dos filhos', score: 9 },
        { item: 'Manutenção do padrão de vida: no caso de acidente, invalidez ou doença', score: 9 },
        { item: 'Aposentadoria', score: 8 },
        { item: 'Reserva de emergência', score: 7 },
        { item: 'Projetos e sonhos financeiros', score: 6 },
      ];
    }
    return Object.entries(source)
      .map(([key, val]) => ({
        item: labels[key] || key,
        score: Number(val) || 0,
      }))
      .sort((a, b) => b.score - a.score);
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('sessionId');

        if (sessionId) {
          const apiUrl = import.meta.env.VITE_API_THE_WAY;
          const response = await axios.get(`${apiUrl}/data-extract/${sessionId}`);
          setUser(response.data[0]);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        if (error.response) {
          console.error('Error response:', error.response.data);
          console.error('Error status:', error.response.status);
        }
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    const fetchUserReportsData = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('sessionId');

        if (sessionId) {
          const apiUrl = import.meta.env.VITE_API_THE_WAY;
          const response = await axios.get(`${apiUrl}/client-reports/${sessionId}`);

          const reportData = JSON.parse(response.data[0].report_data);
          setUserReports(reportData);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    fetchUserReportsData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  // Usar dados do JSON local como padrão quando não houver dados da API
  // Garantir que imovelDesejado exista, mesclando API com JSON local
  const beachHouseData = deepMerge(userReports || {}, localUserReports as any);

  return (
    <ThemeProvider>
      <CardVisibilityProvider>
        <SectionVisibilityProvider>
          <div className="relative h-screen overflow-hidden">
            <Header />
            <main className="h-[calc(100vh-64px)] overflow-y-auto">
              <div className="min-h-screen">
                <CoverPage 
                  clientData={getClientData().cliente} 
                  objetivos={getClientData().objetivos}
                  priorities={getPriorities()}
                  retirementPlan={{
                    idadePlanejada: getClientData().aposentadoria.idadeAposentadoria,
                    rendaMensalDesejada: getClientData().aposentadoria.rendaMensalDesejada,
                  }}
                />
              </div>
              
              <HideableSection sectionId="summary" hideControls={clientPropect}>
                <FinancialSummary data={getClientData().financas} hideControls={clientPropect} />
              </HideableSection>
              

              
              <HideableSection sectionId="investment-management" hideControls={clientPropect}>
                <InvestmentManagement data={getClientData().investimentos} hideControls={clientPropect} />
              </HideableSection>

              <HideableSection sectionId="retirement" hideControls={clientPropect}>
                <RetirementPlanning
                  data={{
                    ...getClientData().aposentadoria,
                    rendas: getClientData().financas.rendas,
                    objetivos: (getClientData() as any)?.objetivos || []
                  } as any}
                  hideControls={clientPropect}
                />
              </HideableSection>
              
              <HideableSection sectionId="beach-house" hideControls={clientPropect}>
                <BeachHouse data={getClientData()} hideControls={clientPropect} />
              </HideableSection>
              
              <HideableSection sectionId="tax" hideControls={clientPropect}>
                <TaxPlanning data={getClientData()} hideControls={clientPropect} />
              </HideableSection>
              
              <HideableSection sectionId="protection" hideControls={clientPropect}>
                <ProtectionPlanning data={getClientData()} hideControls={clientPropect} />
              </HideableSection>
              
              <HideableSection sectionId="succession" hideControls={clientPropect}>
                <SuccessionPlanning data={getClientData()} hideControls={clientPropect} />
              </HideableSection>
              
              <HideableSection sectionId="action-plan" hideControls={clientPropect}>
                <ActionPlan data={getClientData()} hideControls={clientPropect} />
              </HideableSection>
            </main>
            <DotNavigation />
            <MobileDotNavigation />
            <FloatingActions userReports={userReports} />
            {!clientPropect && <SectionVisibilityControls />}
          </div>
        </SectionVisibilityProvider>
      </CardVisibilityProvider>
    </ThemeProvider>
  );
};

export default IndexPage;