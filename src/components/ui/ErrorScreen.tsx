import React from 'react';

interface ErrorScreenProps {
  title?: string;
  subtitle?: string;
  onRetry?: () => void;
  showRetryButton?: boolean;
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({
  title = "Aguarde o Processamento",
  subtitle = "Nossa IA está trabalhando para fornecer o melhor relatório personalizado. Este processo pode levar até 3 minutos para ser concluído.",
  onRetry = () => window.location.reload(),
  showRetryButton = true
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
      <div className="text-center space-y-6 max-w-md mx-auto px-6">
        {/* Ícone de processamento */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center">
            <svg className="h-8 w-8 text-accent animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        </div>
        
        {/* Título de processamento */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {title}
          </h1>
          <p className="text-muted-foreground">
            {subtitle}
          </p>
        </div>
        
        {/* Informações adicionais */}
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <p>💡 <strong>Dica:</strong> Aguarde pelo menos 3 minutos após clicar em "Gerar Relatório"</p>
          </div>
          <div className="text-xs text-muted-foreground">
            Nossa IA está analisando seus dados financeiros e criando recomendações personalizadas
          </div>
        </div>
        
        {/* Botão de retry */}
        {showRetryButton && (
          <button 
            onClick={onRetry} 
            className="px-6 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-colors"
          >
            Verificar Status
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorScreen;
