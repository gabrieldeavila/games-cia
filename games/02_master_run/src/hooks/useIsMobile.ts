import { useState, useEffect } from "react";

export const useIsMobile = (breakpoint: number = 768): boolean => {
    const [isMobile, setIsMobile] = useState<boolean>(false);

    useEffect(() => {
        const isTouchDevice = () => {
            return (
                "ontouchstart" in window ||
                navigator.maxTouchPoints > 0 ||
                // @ts-expect-error - support for older IE versions
                navigator.msMaxTouchPoints > 0
            );
        };

        setIsMobile(isTouchDevice());
    }, [breakpoint]);

    return isMobile;
};

