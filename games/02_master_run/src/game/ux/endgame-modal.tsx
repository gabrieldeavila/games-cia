import { useGameInput } from "../../context/game";

export default function EndGameModal() {
    const { gameComplete } = useGameInput();

    if (!gameComplete) {
        return null;
    }

    return (
        <div
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                zIndex: 1000,
                padding: "1rem",
            }}
        >
            <div
                style={{
                    maxWidth: "420px",
                    width: "100%",
                    backgroundColor: "rgba(10, 10, 10, 0.95)",
                    borderRadius: "16px",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    padding: "2rem",
                    textAlign: "center",
                    boxShadow: "0 0 40px rgba(0, 0, 0, 0.45)",
                }}
            >
                <h2 style={{ margin: 0, fontSize: "2rem", color: "#ffffff" }}>
                    Parabéns!
                </h2>
                <p
                    style={{
                        marginTop: "1rem",
                        marginBottom: "1.5rem",
                        color: "#d9d9d9",
                        lineHeight: 1.6,
                    }}
                >
                    Você chegou ao navio e concluiu a operação!
                </p>
                <button
                    className="button"
                    type="button"
                    onClick={() => window.location.reload()}
                    style={{
                        width: "100%",
                        maxWidth: "240px",
                        margin: "0 auto",
                    }}
                >
                    Jogar de novo
                </button>
            </div>
        </div>
    );
}
