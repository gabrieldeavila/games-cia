import { useRef, useState } from "react";
import { IRefPhaserGame, PhaserGame } from "./PhaserGame";
import { GameInputProvider } from "./context/game";
import Joystick from "./game/ux/joystick";
import CollectibleCounter from "./game/ux/collectible-counter";

function App() {
    const [started, setStarted] = useState(false);
    const phaserRef = useRef<IRefPhaserGame | null>(null);

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
                <div id="app">
                    <PhaserGame ref={phaserRef} />
                    <CollectibleCounter />
                    <Joystick />
                </div>
            )}
        </GameInputProvider>
    );
}

export default App;
