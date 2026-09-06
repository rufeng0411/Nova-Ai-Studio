export const PORT_FALLBACK_ATTEMPTS = 5;

export function pickRandomHighPort(randomFn = Math.random) {
    return 20000 + Math.floor(randomFn() * 40000);
}

/**
 * Listen on `preferredPort`; on EADDRINUSE retry on random high ports up to
 * `maxAttempts` times. Resolves with the actually-bound port, or null if every
 * attempt was in use. Non-EADDRINUSE errors reject.
 */
export function listenWithPortFallback(srv, preferredPort, host, options = {}) {
    const maxAttempts = options.maxAttempts ?? PORT_FALLBACK_ATTEMPTS;
    const pickPort = options.pickPort ?? pickRandomHighPort;
    const log = options.log ?? console.log;

    let port = preferredPort;
    let attempt = 0;
    return new Promise((resolve, reject) => {
        const tryListen = () => {
            attempt += 1;
            const onError = (err) => {
                srv.removeListener('listening', onListening);
                if (err && err.code === 'EADDRINUSE') {
                    if (attempt >= maxAttempts) {
                        resolve(null);
                        return;
                    }
                    const nextPort = pickPort();
                    log(`Port ${port} is in use; retrying on random port ${nextPort} (attempt ${attempt}/${maxAttempts})...`);
                    port = nextPort;
                    setImmediate(tryListen);
                    return;
                }
                reject(err);
            };
            const onListening = () => {
                srv.removeListener('error', onError);
                resolve(srv.address().port);
            };
            srv.once('error', onError);
            srv.once('listening', onListening);
            srv.listen(port, host);
        };
        tryListen();
    });
}
