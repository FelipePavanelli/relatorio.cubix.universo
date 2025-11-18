import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

interface CardVisibilityContextType {
    hiddenCards: Record<string, boolean>;
    toggleCardVisibility: (cardId: string) => void;
    isCardVisible: (cardId: string) => boolean;
    isLoading: boolean;
}

const CardVisibilityContext = createContext<CardVisibilityContextType | undefined>(undefined);

// Lista de todos os IDs de cards possíveis
const ALL_CARD_IDS = [
    "situacao-financeira",
    "objetivo-aposentadoria",
    "projecao-patrimonial",
    "impacto-financeiro-sucessao",
    "objetivos-sucessao",
    "instrumentos-sucessorios",
    "projeto-vida-legado",
    "previdencia-privada-sucessao",
    "grafico-liquidez-sucessao",
    "patrimonio-resumo",
    "balanco-patrimonial-resumo",
    "composicao-patrimonial",
    "renda-despesas",
    "passivos",
    "ativos",
    "financial-resumo",
    "objetivo-casa-praia",
    "estrategias-casa-praia",
    "simulador-financiamento",
    "impacto-casa-praia",
    "diagnostico-tributario",
    "comparativo-irpf",
    "recomendacoes-estrategicas"
];

// Função para criar um objeto com todos os cards visíveis
const createAllHiddenState = () => {
    return ALL_CARD_IDS.reduce((acc, cardId) => {
        acc[cardId] = false; // false = visível (não oculto)
        return acc;
    }, {} as Record<string, boolean>);
};

export const CardVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [hiddenCards, setHiddenCards] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [initialized, setInitialized] = useState(false);

    // Função para obter o session_id da URL
    const getSessionId = useCallback(() => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('sessionId');
    }, []);

    // Função para buscar o estado inicial do backend
    const fetchInitialState = useCallback(async () => {
        const sessionId = getSessionId();
        if (!sessionId || initialized) {
            setIsLoading(false);
            return;
        }

        try {
            const apiUrl = import.meta.env.VITE_API_THE_WAY;
            const response = await axios.get(`${apiUrl}/clients/hidden-cards?session_id=${sessionId}`);

            if (response.data.hiddenCards === null) {
                // Se hiddenCards for null, faz uma requisição POST para setar todos os cards como visíveis
                const allVisibleState = {
                    "ativos": false,
                    "passivos": false,
                    "renda-despesas": false,
                    "financial-resumo": false,
                    "patrimonio-resumo": false,
                    "balanco-patrimonial-resumo": false,
                    "objetivos-sucessao": false,
                    "indicador-seguranca": false,
                    "projeto-vida-legado": false,
                    "situacao-financeira": false,
                    "projecao-patrimonial": false,
                    "composicao-patrimonial": false,
                    "estrategia-recomendada": false,
                    "objetivo-aposentadoria": false,
                    "instrumentos-sucessorios": false,
                    "recomendacoes-adicionais": false,
                    "impacto-financeiro-sucessao": false,
                    "previdencia-privada-sucessao": false,
                    "grafico-liquidez-sucessao": false,
                    "objetivo-casa-praia": false,
                    "estrategias-casa-praia": false,
                    "simulador-financiamento": false,
                    "impacto-casa-praia": false,
                    "diagnostico-tributario": false,
                    "recomendacoes-estrategicas": false
                };

                await axios.post(`${apiUrl}/clients/update-hidden-cards`, {
                    session_id: sessionId,
                    hiddenCards: allVisibleState
                });

                setHiddenCards(allVisibleState);
            } else {
                setHiddenCards(response.data.hiddenCards);
            }
            setInitialized(true);
        } catch (error) {
            console.error('Error fetching hidden cards state:', error);
            // Em caso de erro, define todos os cards como ocultos
            setHiddenCards(createAllHiddenState());
        } finally {
            setIsLoading(false);
        }
    }, [initialized, getSessionId]);

    // Função para atualizar o estado no backend
    const updateBackendState = useCallback(async (newState: Record<string, boolean>) => {
        const sessionId = getSessionId();
        if (!sessionId) return;

        try {
            const apiUrl = import.meta.env.VITE_API_THE_WAY;
            await axios.post(`${apiUrl}/clients/update-hidden-cards`, {
                session_id: sessionId,
                hiddenCards: newState
            });
        } catch (error) {
            console.error('Error updating hidden cards state:', error);
        }
    }, [getSessionId]);

    // Buscar estado inicial ao montar o componente
    useEffect(() => {
        fetchInitialState();
    }, [fetchInitialState]);

    // Função para alternar visibilidade de um card
    const toggleCardVisibility = useCallback((cardId: string) => {
        setHiddenCards(prev => {
            const newState = {
                ...prev,
                [cardId]: !prev[cardId]
            };

            // Atualizar o backend quando houver mudança
            updateBackendState(newState);

            return newState;
        });
    }, [updateBackendState]);

    // Função para verificar se um card está visível
    const isCardVisible = useCallback((cardId: string) => {
        return !hiddenCards[cardId];
    }, [hiddenCards]);

    const value = {
        hiddenCards,
        toggleCardVisibility,
        isCardVisible,
        isLoading
    };

    return (
        <CardVisibilityContext.Provider value={value}>
            {children}
        </CardVisibilityContext.Provider>
    );
};

export const useCardVisibility = () => {
    const context = useContext(CardVisibilityContext);
    if (context === undefined) {
        throw new Error('useCardVisibility must be used within a CardVisibilityProvider');
    }
    return context;
};

export default useCardVisibility; 