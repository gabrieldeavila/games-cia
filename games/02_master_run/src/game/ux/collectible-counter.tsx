import { useGameInput } from "../../context/game";

export default function CollectibleCounter() {
    const { collectibles } = useGameInput();

    if (collectibles.total <= 0) {
        return null;
    }

    return (
        <div
            style={{
                position: "absolute",
                top: "1rem",
                left: "1rem",
                padding: "0.5rem 0.75rem",
                backgroundColor: "rgba(0, 0, 0, 0.55)",
                color: "white",
                fontFamily: "Arial, sans-serif",
                fontWeight: 700,
                borderRadius: "8px",
                zIndex: 999,
            }}
        >
            Influência Comprada: {collectibles.collected}/{collectibles.total}
        </div>
    );
}
