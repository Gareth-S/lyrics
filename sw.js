const CACHE_NAME = "hhh-stomp-v1.2";
const UPDATE_FILE = "./assets/update.json";

async function getUpdateList() {
    const response = await fetch(UPDATE_FILE, { cache: "no-cache" });

    if (!response.ok) {
        throw new Error(
            `Could not load ${UPDATE_FILE}: HTTP ${response.status}`
        );
    }

    const data = await response.json();

    if (!Array.isArray(data.files)) {
        throw new Error("update.json does not contain a files array");
    }

    return data.files;
}

async function cacheInstallFiles(progressCallback = null) {

    const files = await getUpdateList();
    const cache = await caches.open(CACHE_NAME);
    const results = [];

    for (let i = 0; i < files.length; i++) {

        const file = files[i];

        if (progressCallback) {

            progressCallback({
                phase: "core",
                current: i + 1,
                total: files.length,
                file
            });
        }

        try {

            const response =
                await fetch(file, { cache: "no-cache" });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            await cache.put(file, response.clone());

            results.push({
                file,
                ok: true
            });

        } catch (error) {

            console.warn(
                "Song2HTML: could not cache",
                file,
                error
            );

            results.push({
                file,
                ok: false,
                error: String(error)
            });
        }
    }

    return results;
}        
        
        try {
            const response = await fetch(file, { cache: "no-cache" });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            
            await cache.put(file, response.clone());

            results.push({
                file,
                ok: true
            });
        } catch (error) {
            console.warn(
                "Song2HTML: could not cache",
                file,
                error
            );

            results.push({
                file,
                ok: false,
                error: String(error)
            });
        }
    }

    return results;
}


self.addEventListener("install", event => {
    event.waitUntil(
        cacheInstallFiles()
            .then(() => self.skipWaiting())
            .catch(error => {
                console.error(
                    "Song2HTML: service worker install failed",
                    error
                );

                // If update.json itself is unavailable, installation fails.
                throw error;
            })
    );
});


self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys =>
                Promise.all(
                    keys
                        .filter(key => key.startsWith("hhh-stomp-"))
                        .filter(key => key !== CACHE_NAME)
                        .map(key => caches.delete(key))
                )
            )
            .then(() => self.clients.claim())
    );
});


self.addEventListener("fetch", event => {
    const request = event.request;

    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);

    // Never cache PHP/server-side requests.
    if (url.pathname.toLowerCase().endsWith(".php")) {
        return;
    }

    // Only handle requests belonging to this Song2HTML origin.
    if (url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.match(request)
            .then(async cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                const response = await fetch(request);

                // Only cache successful responses.
                // This avoids caching server errors/challenge pages.
                if (response.ok) {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(request, response.clone());
                }

                return response;
            })
    );
});


/*
 * Settings can send:
 *
 *     { type: "UPDATE_CORE" }
 *
 * to refresh the install/application files.
 */

self.addEventListener("message", event => {

    if (!event.data || event.data.type !== "UPDATE_CORE") {
        return;
    }


    event.waitUntil(

        cacheInstallFiles(progress => {

            /*
             * Send progress back to settings.js.
             */
            if (event.ports && event.ports[0]) {

                event.ports[0].postMessage({
                    type: "UPDATE_PROGRESS",
                    phase: progress.phase,
                    current: progress.current,
                    total: progress.total,
                    file: progress.file
                });
            }

        })

        .then(results => {

            if (event.ports && event.ports[0]) {

                event.ports[0].postMessage({
                    type: "UPDATE_COMPLETE",
                    ok: true,
                    results
                });
            }

        })

        .catch(error => {

            console.error(
                "Song2HTML: core update failed",
                error
            );

            if (event.ports && event.ports[0]) {

                event.ports[0].postMessage({
                    type: "UPDATE_COMPLETE",
                    ok: false,
                    error: String(error)
                });
            }
        })
    );
});
