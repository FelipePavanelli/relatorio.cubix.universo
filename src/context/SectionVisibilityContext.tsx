import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

interface SectionVisibilityContextType {
    hiddenSections: Record<string, boolean>;
    toggleSectionVisibility: (sectionId: string) => void;
    isSectionVisible: (sectionId: string) => boolean;
    isLoading: boolean;
}

const SectionVisibilityContext = createContext<SectionVisibilityContextType | undefined>(undefined);

// Lista de todas as seções possíveis
const ALL_SECTION_IDS = [
    "summary",           // Resumo Financeiro
    "investment-management", // Gestão de Investimentos
    "retirement",        // Aposentadoria
    "beach-house",       // Aquisição de Imóveis
    "tax",              // Planejamento Tributário
    "protection",        // Proteção Patrimonial
    "succession",        // Planejamento Sucessório
    "action-plan"        // Plano de Ação
];

// Função para criar um objeto com todas as seções visíveis
const createAllSectionsVisibleState = () => {
    return ALL_SECTION_IDS.reduce((acc, sectionId) => {
        acc[sectionId] = false; // false = visível (não oculto)
        return acc;
    }, {} as Record<string, boolean>);
};

export const SectionVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>({});
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
            const response = await axios.get(`${apiUrl}/clients/hidden-sections?session_id=${sessionId}`);

            if (response.data.hiddenSections === null) {
                // Se hiddenSections for null, faz uma requisição POST para setar todas as seções como visíveis
                const allVisibleState = createAllSectionsVisibleState();

                await axios.post(`${apiUrl}/clients/update-hidden-sections`, {
                    session_id: sessionId,
                    hiddenSections: allVisibleState
                });

                setHiddenSections(allVisibleState);
            } else {
                setHiddenSections(response.data.hiddenSections);
            }
            setInitialized(true);
        } catch (error) {
            console.error('Error fetching hidden sections state:', error);
            // Em caso de erro, define todas as seções como visíveis
            setHiddenSections(createAllSectionsVisibleState());
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
            await axios.post(`${apiUrl}/clients/update-hidden-sections`, {
                session_id: sessionId,
                hiddenSections: newState
            });
        } catch (error) {
            console.error('Error updating hidden sections state:', error);
        }
    }, [getSessionId]);

    // Buscar estado inicial ao montar o componente
    useEffect(() => {
        fetchInitialState();
    }, [fetchInitialState]);

    // Função para alternar visibilidade de uma seção
    const toggleSectionVisibility = useCallback((sectionId: string) => {
        setHiddenSections(prev => {
            const newState = {
                ...prev,
                [sectionId]: !prev[sectionId]
            };

            // Atualizar o backend quando houver mudança
            updateBackendState(newState);

            return newState;
        });
    }, [updateBackendState]);

    // Função para verificar se uma seção está visível
    const isSectionVisible = useCallback((sectionId: string) => {
        return !hiddenSections[sectionId];
    }, [hiddenSections]);

    const value = {
        hiddenSections,
        toggleSectionVisibility,
        isSectionVisible,
        isLoading
    };

    return (
        <SectionVisibilityContext.Provider value={value}>
            {children}
        </SectionVisibilityContext.Provider>
    );
};

export const useSectionVisibility = () => {
    const context = useContext(SectionVisibilityContext);
    if (context === undefined) {
        throw new Error('useSectionVisibility must be used within a SectionVisibilityProvider');
    }
    return context;
};

export default useSectionVisibility; 