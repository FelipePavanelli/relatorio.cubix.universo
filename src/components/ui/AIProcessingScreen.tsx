import React from 'react';

interface AIProcessingScreenProps {
  onReload?: () => void;
}

const AIProcessingScreen: React.FC<AIProcessingScreenProps> = ({
  onReload
}) => {

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
      <div className="text-center space-y-6 max-w-md mx-auto px-6">
        {/* Ícone simples */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center">
            <svg className="h-8 w-8 text-accent animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>
        
        {/* Título simples */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Aguarde o Processamento
          </h1>
          <p className="text-muted-foreground">
            Nossa IA está trabalhando para fornecer o melhor relatório personalizado. Este processo pode levar até 3 minutos para ser concluído.
          </p>
        </div>
        
        {/* Botão de atualizar */}
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-accent text-accent-foreground px-8 py-4 rounded-lg font-medium hover:bg-accent/90 transition-colors text-lg"
        >
          🔄 Atualizar Página
        </button>
      </div>
    </div>
  );
};

export default AIProcessingScreen;
