# Componentes de UI - Sistema de Loading

## Visão Geral

Este diretório contém componentes especializados para gerenciar estados de carregamento e processamento no relatório financeiro.

## Componentes Disponíveis

### 1. LoadingScreen
**Arquivo:** `LoadingScreen.tsx`

Componente para exibir durante o carregamento inicial dos dados.

**Props:**
- `title?: string` - Título da tela (padrão: "Gerando seu Relatório")
- `subtitle?: string` - Subtítulo explicativo
- `status?: string` - Status atual do processamento
- `showProgress?: boolean` - Mostrar barra de progresso
- `progress?: number` - Percentual de progresso (0-100)

**Uso:**
```tsx
<LoadingScreen 
  title="Carregando Dados"
  subtitle="Aguarde enquanto carregamos suas informações..."
  status="Conectando com a API..."
  progress={75}
/>
```

### 2. ErrorScreen
**Arquivo:** `ErrorScreen.tsx`

Componente para exibir quando há erro no carregamento ou quando o usuário precisa aguardar o processamento da IA.

**Props:**
- `title?: string` - Título da tela
- `subtitle?: string` - Mensagem explicativa
- `onRetry?: () => void` - Função chamada ao clicar em "Verificar Status"
- `showRetryButton?: boolean` - Mostrar botão de retry

**Uso:**
```tsx
<ErrorScreen 
  title="Aguarde o Processamento"
  subtitle="Nossa IA está trabalhando para fornecer o melhor relatório..."
  onRetry={() => window.location.reload()}
/>
```

### 3. AIProcessingScreen
**Arquivo:** `AIProcessingScreen.tsx`

Componente especializado para mostrar o processamento da IA com timer e informações detalhadas.

**Props:**
- `onTimeout?: () => void` - Função chamada quando o tempo máximo é atingido
- `maxWaitTime?: number` - Tempo máximo de espera em minutos (padrão: 3)

**Características:**
- Timer em tempo real
- Barra de progresso animada
- Lista de atividades da IA
- Dicas contextuais após 30 segundos
- Auto-timeout após o tempo máximo

**Uso:**
```tsx
<AIProcessingScreen 
  onTimeout={() => {
    setShowAIProcessing(false);
    setIsLoading(false);
  }}
  maxWaitTime={3}
/>
```

## Fluxo de Estados

```
1. LoadingScreen (carregamento inicial)
   ↓
2. AIProcessingScreen (se new=true na URL)
   ↓
3. Relatório (dados carregados)
   ↓
4. ErrorScreen (se houver erro)
```

## Integração com URL

Para ativar a tela de processamento da IA, adicione `?new=true` na URL:

```
/relatorio-cliente/?sessionId=123&new=true
```

## Personalização

Todos os componentes são totalmente personalizáveis através de props, permitindo diferentes mensagens e comportamentos conforme o contexto.

## Acessibilidade

- Componentes com foco adequado
- Animações respeitam preferências de movimento
- Contraste adequado para leitura
- Suporte a leitores de tela
