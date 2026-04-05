import React, { createContext, useContext, useRef, useCallback } from "react";

export type ControlAction = "left" | "right" | "jump" | "attack";

export interface InputState {
    left: boolean;
    right: boolean;
    jump: boolean;
    attack: boolean;
}

export interface CollectibleState {
    collected: number;
    total: number;
}

export interface GameInputContextData {
    controlsRef: React.RefObject<InputState>;
    setControl: (action: ControlAction, isActive: boolean) => void;
    collectibles: CollectibleState;
    setCollectibles: (collected: number, total: number) => void;
    gameComplete: boolean;
    setGameComplete: (complete: boolean) => void;
}

const GameInputContext = createContext<GameInputContextData | null>(null);

export const GameInputProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const controlsRef = useRef<InputState>({
        left: false,
        right: false,
        jump: false,
        attack: false,
    });

    const [collectibles, setCollectiblesState] = React.useState<CollectibleState>(
        { collected: 0, total: 0 },
    );
    const [gameComplete, setGameCompleteState] = React.useState(false);

    const setControl = useCallback(
        (action: ControlAction, isActive: boolean) => {
            controlsRef.current[action] = isActive;
        },
        [],
    );

    const setCollectibles = useCallback(
        (collected: number, total: number) => {
            setCollectiblesState({ collected, total });
        },
        [],
    );

    const setGameComplete = useCallback((complete: boolean) => {
        setGameCompleteState(complete);
    }, []);

    return (
        <GameInputContext.Provider
            value={{
                controlsRef,
                setControl,
                collectibles,
                setCollectibles,
                gameComplete,
                setGameComplete,
            }}
        >
            {children}
        </GameInputContext.Provider>
    );
};

// Hook personalizado para facilitar o uso
export const useGameInput = () => {
    const context = useContext(GameInputContext);
    if (!context) {
        throw new Error(
            "useGameInput deve ser usado dentro de um GameInputProvider",
        );
    }
    return context;
};

