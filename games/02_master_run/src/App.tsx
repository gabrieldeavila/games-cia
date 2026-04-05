import { useRef, useState } from "react";
import { IRefPhaserGame, PhaserGame } from "./PhaserGame";
import { GameInputProvider, useGameInput } from "./context/game";
import Joystick from "./game/ux/joystick";
import CollectibleCounter from "./game/ux/collectible-counter";
import EndGameModal from "./game/ux/endgame-modal";

function GameScreen() {
    const { gameComplete } = useGameInput();
    const phaserRef = useRef<IRefPhaserGame | null>(null);

    return (
        <div id="app">
            <PhaserGame ref={phaserRef} />
            <CollectibleCounter />
            <Joystick />
            {gameComplete && <EndGameModal />}
        </div>
    );
}

function App() {
    const [started, setStarted] = useState(false);

    const onStart = () => {
        setStarted(true);
    };

    return (
        <GameInputProvider>
            {!started ? (
                <div id="start-screen">
                    <div className="start-overlay">
                        <h1 className="start-title">
                            Compre influência e quebre a banca.
                        </h1>
                        <button
                            className="button ready-button"
                            onClick={onStart}
                        >
                            Iniciar Operação
                        </button>
                    </div>
                </div>
            ) : (
                <GameScreen />
            )}
        </GameInputProvider>
    );
}

export default App;
