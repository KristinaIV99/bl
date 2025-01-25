// service-worker.js
const CONFIG = {
    CACHE_NAME: 'swedish-reader-v1',
    BASE_PATH: 'https://kristinaiv99.github.io/MPD',  // pakeista atgal į pilną kelią
    CACHE_VERSION: '1.0.0',
    MAX_AGE: 7 * 24 * 60 * 60 * 1000,
    DEBUG: true
};

// Resursai, kuriuos norime cache'uoti
const RESOURCES = {
    CORE: [
        '',
        '/main.js',
        '/text-processor.js',
        '/word-reader.js',
        '/phrase-reader.js',
        '/index.html',
        '/manifest.json',
        '/dictionary.json',
        '/phrases.json'
    ],
    EXTERNAL: [
        'https://cdnjs.cloudflare.com/ajax/libs/marked/4.0.2/marked.min.js'
    ]
};

// Sujungiame visus URL su BASE_PATH
const urlsToCache = [
    ...RESOURCES.CORE.map(path => `${CONFIG.BASE_PATH}${path}`),
    ...RESOURCES.EXTERNAL
];

// Pagalbinės funkcijos
const utils = {
    log(...args) {
        if (CONFIG.DEBUG) {
            console.log('[ServiceWorker]', ...args);
        }
    },
    error(...args) {
        console.error('[ServiceWorker Error]', ...args);
    },
    warn(...args) {
        console.warn('[ServiceWorker Warning]', ...args);
    },

    async measureTime(fn, label) {
        const start = performance.now();
        try {
            return await fn();
        } finally {
            const duration = performance.now() - start;
            this.log(`${label} užtruko ${duration.toFixed(2)}ms`);
        }
    }
};

// Cache valdymo klasė
class CacheManager {
    constructor() {
        this.cacheName = CONFIG.CACHE_NAME;
    }

    async open() {
        try {
            return await caches.open(this.cacheName);
        } catch (error) {
            utils.error('Klaida atidarant cache:', error);
            throw error;
        }
    }

    async add(cache, url) {
        try {
            await cache.add(url);
            utils.log(`Sėkmingai pridėta į cache: ${url}`);
        } catch (error) {
            utils.warn(`Nepavyko pridėti į cache: ${url}`, error);
            // Nepavykus pridėti vieno resurso, tęsiame su kitais
            return Promise.resolve();
        }
    }

    async addAll(urls) {
        const cache = await this.open();
        return Promise.all(
            urls.map(url => this.add(cache, url))
        );
    }

    async cleanOld() {
        try {
            const cacheNames = await caches.keys();
            const deletionPromises = cacheNames
                .filter(cacheName => cacheName !== this.cacheName)
                .map(cacheName => {
                    utils.log(`Trinama sena cache: ${cacheName}`);
                    return caches.delete(cacheName);
                });
            await Promise.all(deletionPromises);
        } catch (error) {
            utils.error('Klaida valant seną cache:', error);
            throw error;
        }
    }

    async match(request) {
        try {
            const cache = await this.open();
            return await cache.match(request);
        } catch (error) {
            utils.error('Klaida ieškant cache:', error);
            throw error;
        }
    }

    async update(request, response) {
        try {
            const cache = await this.open();
            await cache.put(request, response);
            utils.log(`Atnaujinta cache: ${request.url}`);
        } catch (error) {
            utils.error('Klaida atnaujinant cache:', error);
            throw error;
        }
    }
}

// Tinklo užklausų valdymo klasė
class NetworkManager {
    async fetchWithTimeout(request, timeout = 5000) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(request, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error(`Užklausa nutraukta po ${timeout}ms: ${request.url}`);
            }
            throw error;
        }
    }

    isValidResponse(response) {
        return response && response.status === 200 && response.type === 'basic';
    }

    async handleFetch(request) {
        try {
            const response = await this.fetchWithTimeout(request);
            if (!this.isValidResponse(response)) {
                utils.warn(`Gautas netinkamas atsakymas: ${response?.status}`);
                return response;
            }
            return response;
        } catch (error) {
            utils.error('Klaida siunčiant užklausą:', error);
            throw error;
        }
    }
}

// Pagrindinis Service Worker valdymas
class ServiceWorkerManager {
    constructor() {
        this.cacheManager = new CacheManager();
        this.networkManager = new NetworkManager();
        this.setupEventListeners();
    }

    setupEventListeners() {
        self.addEventListener('install', event => this.handleInstall(event));
        self.addEventListener('activate', event => this.handleActivate(event));
        self.addEventListener('fetch', event => this.handleFetch(event));
        self.addEventListener('error', event => this.handleError(event));
        self.addEventListener('unhandledrejection', event => this.handleUnhandledRejection(event));
    }

    handleInstall(event) {
        utils.log('Įdiegiamas');
        event.waitUntil(
            utils.measureTime(
                () => this.cacheManager.addAll(urlsToCache),
                'Pradinių resursų cache'
            )
        );
    }

    handleActivate(event) {
        utils.log('Aktyvuojamas');
        event.waitUntil(
            utils.measureTime(
                () => this.cacheManager.cleanOld(),
                'Senos cache valymas'
            )
        );
    }

    handleFetch(event) {
        utils.log('Fetch įvykis:', event.request.url);
        event.respondWith(this.handleFetchEvent(event.request));
    }

    async handleFetchEvent(request) {
        try {
            // Pirma tikriname cache
            const cachedResponse = await this.cacheManager.match(request);
            if (cachedResponse) {
                utils.log('Rasta cache:', request.url);
                return cachedResponse;
            }

            // Jei nėra cache, bandome gauti iš tinklo
            utils.log('Siunčiama tinklo užklausa:', request.url);
            const response = await this.networkManager.handleFetch(request);
            
            // Išsaugome atsakymą į cache
            if (response && response.ok) {
                const clonedResponse = response.clone();
                await this.cacheManager.update(request, clonedResponse);
            }

            return response;
        } catch (error) {
            utils.error('Klaida apdorojant užklausą:', error);
            throw error;
        }
    }

    handleError(event) {
        utils.error('Įvyko klaida:', {
            filename: event.filename,
            lineno: event.lineno,
            message: event.message
        });
    }

    handleUnhandledRejection(event) {
        utils.error('Neapdorota klaida:', event.reason);
    }
}

// Paleidžiame Service Worker
const serviceWorker = new ServiceWorkerManager();
