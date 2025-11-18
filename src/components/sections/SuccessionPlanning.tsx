import React from 'react';
import { Users, FileText, GanttChart } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import HideableCard from '@/components/ui/HideableCard';
import { useCardVisibility } from '@/context/CardVisibilityContext';
import StatusChip from '@/components/ui/StatusChip';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import SuccessionLiquidityChart from '@/components/charts/SuccessionLiquidityChart';

interface SuccessionPlanningProps {
  data?: any;
  hideControls?: boolean;
}

const SuccessionPlanning: React.FC<SuccessionPlanningProps> = ({ data, hideControls }) => {
  const headerRef = useScrollAnimation();
  const cardRef1 = useScrollAnimation();
  const cardRef2 = useScrollAnimation();
  const { isCardVisible, toggleCardVisibility } = useCardVisibility();

  return (
    <section className="py-16 px-4" id="succession">
      <div className="section-container">
        {/* Header */}
        <div
          ref={headerRef as React.RefObject<HTMLDivElement>}
          className="mb-12 text-center animate-on-scroll"
        >
          <div className="inline-block">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-accent/10 p-3 rounded-full">
                <Users size={28} className="text-accent" />
              </div>
            </div>
            <h2 className="text-4xl font-bold mb-3">7. Planejamento Sucessório</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Estratégias para garantir a transferência eficiente de patrimônio, preservar a harmonia familiar e minimizar custos tributários no processo sucessório.
            </p>
          </div>
        </div>

        {/* Objectives */}
        <div
          ref={cardRef1 as React.RefObject<HTMLDivElement>}
          className="mb-8 animate-on-scroll delay-1"
        >
          <div className="grid md:grid-cols-1 gap-6">
            {/* Objectives */}
            <HideableCard
              id="objetivos-sucessao"
              isVisible={isCardVisible("objetivos-sucessao")}
              onToggleVisibility={() => toggleCardVisibility("objetivos-sucessao")}
              hideControls={hideControls}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GanttChart size={20} className="text-accent" />
                  Objetivos
                </CardTitle>
                <CardDescription>
                  Principais metas do planejamento sucessório
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-3">
                  {data?.sucessao?.situacaoAtual?.objetivosSucessorios?.map((objetivo, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 rounded-lg border">
                      <div className="h-6 w-6 rounded-full bg-accent/15 flex items-center justify-center text-accent shrink-0 mt-0.5">
                        {index + 1}
                      </div>
                      <span className="text-sm">{objetivo}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </HideableCard>
          </div>
        </div>

        {/* Succession Instruments */}
        <div
          ref={cardRef2 as React.RefObject<HTMLDivElement>}
          className="mb-8 animate-on-scroll delay-2"
        >
          <HideableCard
            id="instrumentos-sucessorios"
            isVisible={isCardVisible("instrumentos-sucessorios")}
            onToggleVisibility={() => toggleCardVisibility("instrumentos-sucessorios")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText size={20} className="text-accent" />
                Instrumentos Sucessórios
              </CardTitle>
              <CardDescription>
                Ferramentas jurídicas para implementação do planejamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {data?.sucessao?.instrumentos?.map((instrumento, index) => (
                  <div key={index} className="border-b last:border-0 pb-5 last:pb-0">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-medium">{instrumento.tipo}</h3>
                      <StatusChip
                        status="warning"
                        label="Pendente"
                      />
                    </div>
                    <p className="text-muted-foreground mb-3">{instrumento.descricao}</p>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Vantagens:</h4>
                      <ul className="grid md:grid-cols-2 gap-2">
                        {instrumento.vantagens && Array.isArray(instrumento.vantagens) && instrumento.vantagens.length > 0 ? (
                          instrumento.vantagens.map((vantagem, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <div className="text-accent mt-1">•</div>
                              <span>{vantagem}</span>
                            </li>
                          ))
                        ) : instrumento.tipo === "Holding Familiar" && data?.tributario?.holdingFamiliar?.beneficios ? (
                          data.tributario.holdingFamiliar.beneficios.map((beneficio, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <div className="text-accent mt-1">•</div>
                              <span>{beneficio}</span>
                            </li>
                          ))
                        ) : instrumento.tipo === "Previdência VGBL" && data?.tributario?.previdenciaVGBL?.vantagensSucessorias ? (
                          data.tributario.previdenciaVGBL.vantagensSucessorias.map((vantagem, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <div className="text-accent mt-1">•</div>
                              <span>{vantagem}</span>
                            </li>
                          ))
                        ) : instrumento.tipo === "Mandato Duradouro" && data?.protecao?.protecaoJuridica?.mandatoDuradouro?.beneficios ? (
                          data.protecao.protecaoJuridica.mandatoDuradouro.beneficios.map((beneficio, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <div className="text-accent mt-1">•</div>
                              <span>{beneficio}</span>
                            </li>
                          ))
                        ) : (
                          <li className="flex items-start gap-2 text-sm">
                            <div className="text-accent mt-1">•</div>
                            <span>{instrumento.descricao}</span>
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </HideableCard>
        </div>

        {/* Succession Liquidity Chart */}
        <SuccessionLiquidityChart data={data} hideControls={hideControls} />
      </div>
    </section>
  );
};

export default SuccessionPlanning;