/* eslint-disable no-restricted-globals */
self.onmessage = (e: MessageEvent) => {
    const { action, payload } = e.data;

    if (action === 'START') {
        const endTime = Date.now() + payload * 1000;

        // Clear any existing interval if we were running
        if ((self as any).timerId) clearInterval((self as any).timerId);

        (self as any).timerId = setInterval(() => {
            const remaining = Math.ceil((endTime - Date.now()) / 1000);

            if (remaining <= 0) {
                postMessage({ action: 'TICK', payload: 0 });
                postMessage({ action: 'COMPLETE' });
                clearInterval((self as any).timerId);
            } else {
                postMessage({ action: 'TICK', payload: remaining });
            }
        }, 1000);
    }
    else if (action === 'STOP') {
        if ((self as any).timerId) clearInterval((self as any).timerId);
    }
};

export { };
