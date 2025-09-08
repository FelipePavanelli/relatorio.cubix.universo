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

interface IndexPageProps {
  accessor?: boolean;
  clientPropect?: boolean;
}

const IndexPage: React.FC<IndexPageProps> = ({ accessor, clientPropect }) => {
  const { activeSection, navigateToSection } = useSectionObserver();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userReports, setUserReports] = useState(null);

  const getClientData = () => ({
    cliente: {
      nome: userReports?.cliente?.nome || "",
      idade: userReports?.cliente?.idade || 0,
      estadoCivil: userReports?.cliente?.estadoCivil || "",
      regimeCasamento: userReports?.cliente?.regimeCasamento || "",
      residencia: userReports?.cliente?.residencia || ""
    },
    financas: {
      patrimonioLiquido: userReports?.financas?.resumo?.patrimonio_liquido || 0,
      excedenteMensal: userReports?.financas?.resumo?.excedente_mensal || 0,
      rendas: userReports?.financas?.rendas || [],
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
      excedenteMensal: userReports?.financas?.resumo?.excedente_mensal || 0,
      totalInvestido: userReports?.financas?.composicao_patrimonial?.Investimentos || 0,
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
      expectativaVida: userReports?.planoAposentadoria?.expectativa_vida || 0,

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
      resumo: userReports?.protecao?.resumo || "Proteção do patrimônio",
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

  // Garantir dados fictícios para imovelDesejado se não houver dados reais
  const fakeImovelDesejado = {
    objetivo: {
      tipo: 'Apartamento',
      localizacao: 'São Paulo',
      valorImovel: 600000,
      prazoDesejado: '5 anos',
    },
    vantagens: ['Sem aluguel', 'Valorização do imóvel'],
    desvantagens: ['Comprometimento de renda', 'Taxas e impostos'],
    impactoFinanceiro: {
      parcela: 3500,
      observacao: 'Parcela estimada para financiamento bancário',
      excedenteMensalApos: 1500,
      excedenteMensalAtual: 5000,
    },
    estrategiaRecomendada: 'Financiamento Bancário',
    comparativoEstrategias: [
      { estrategia: 'Financiamento Bancário', parcelaMensal: 3500, totalPago: 700000, tempoContemplacao: 'Imediato' },
      { estrategia: 'Consórcio', parcelaMensal: 2500, totalPago: 650000, tempoContemplacao: '3 anos' },
    ],
  };
  const beachHouseData = userReports && userReports.imovelDesejado ? userReports : { ...(userReports || {}), imovelDesejado: fakeImovelDesejado };

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
                  priorities={[
                    { item: "Proteção familiar e patrimonial no caso de morte", score: 10 },
                    { item: "Reserva para educação dos filhos", score: 9 },
                    { item: "Manutenção do padrão de vida: no caso de acidente, invalidez ou doença", score: 9 },
                    { item: "Aposentadoria", score: 8 },
                    { item: "Reserva de emergência", score: 7 },
                    { item: "Projetos e sonhos financeiros", score: 6 }
                  ]}
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
                <RetirementPlanning data={getClientData().aposentadoria} hideControls={clientPropect} />
              </HideableSection>
              
              <HideableSection sectionId="beach-house" hideControls={clientPropect}>
                <BeachHouse data={beachHouseData} hideControls={clientPropect} />
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