import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  title?: string;
  subtitle?: string;
  status?: string;
  showProgress?: boolean;
  progress?: number;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  title = "Gerando seu Relatório",
  subtitle = "Nossa IA está analisando seus dados financeiros e criando um relatório personalizado. Este processo pode levar até 3 minutos.",
  status = "IA processando dados da sessão...",
  showProgress = true,
  progress = 60
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
      <div className="text-center space-y-6 max-w-md mx-auto px-6">
        {/* Logo/Ícone */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        </div>
        
        {/* Título */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {title}
          </h1>
          <p className="text-muted-foreground">
            {subtitle}
          </p>
        </div>
        
        {/* Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
            <span>{status}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            💡 <strong>Dica:</strong> Aguarde pelo menos 3 minutos após clicar em "Gerar Relatório"
          </div>
          <div className="text-xs text-muted-foreground">
            Nossa IA está criando recomendações personalizadas baseadas nos seus dados
          </div>
        </div>
        
        {/* Barra de progresso animada */}
        {showProgress && (
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-accent to-accent/60 h-2 rounded-full animate-pulse" 
              style={{width: `${progress}%`}}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;
