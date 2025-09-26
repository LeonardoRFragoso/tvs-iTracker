/**
 * iTracker TV Player - Versão Tizen
 * Player minimalista para TVs Samsung com sistema Tizen
 * Utiliza apenas JavaScript nativo e APIs padrão do navegador
 */

(function() {
    'use strict';

    // Configurações
    const CONFIG = {
        // Tempo de reconexão em caso de falha (ms)
        reconnectDelay: window.TIZEN_PLAYER_CONFIG?.network?.reconnectDelay || 15000,
        // Máximo de tentativas de reconexão
        maxReconnectAttempts: window.TIZEN_PLAYER_CONFIG?.network?.maxReconnectAttempts || 5,
        // Tempo entre verificações de playlist (ms)
        playlistCheckInterval: window.TIZEN_PLAYER_CONFIG?.network?.playlistCheckInterval || 60000,
        // Tempo de transição entre conteúdos (ms)
        transitionTime: window.TIZEN_PLAYER_CONFIG?.playback?.transitionTime || 1000,
        // Duração padrão para imagens (ms)
        defaultImageDuration: window.TIZEN_PLAYER_CONFIG?.playback?.defaultImageDuration || 10000,
        // Tempo para esconder o cursor (ms)
        cursorHideDelay: window.TIZEN_PLAYER_CONFIG?.ui?.cursorHideDelay || 3000,
        // Tempo para heartbeat (ms)
        heartbeatInterval: window.TIZEN_PLAYER_CONFIG?.network?.heartbeatInterval || 30000,
        // Debug mode
        debug: window.TIZEN_PLAYER_CONFIG?.debug?.enabled !== undefined ? window.TIZEN_PLAYER_CONFIG.debug.enabled : true,
        // Configurações específicas para Tizen
        tizen: window.TIZEN_PLAYER_CONFIG?.tizen || { preventScreenOff: true, disableScreensaver: true }
    };

    // Estado global do player
    const STATE = {
        playerId: null,
        accessCode: null,
        baseUrl: null,
        playlist: [],
        currentIndex: 0,
        currentContent: null,
        isPlaying: false,
        loadAttempts: 0,
        reconnectTimer: null,
        playlistTimer: null,
        heartbeatTimer: null,
        mediaElement: null,
        imageTimer: null,
        playbackStartTime: null,
        lastActivity: Date.now(),
        connected: false,
        circuitBreakerOpen: false
    };

    // Elementos DOM
    const DOM = {
        mediaContainer: document.getElementById('mediaContainer'),
        loadingScreen: document.getElementById('loadingScreen'),
        loadingText: document.getElementById('loadingText'),
        errorMessage: document.getElementById('errorMessage'),
        statusInfo: document.getElementById('statusInfo'),
        progressBar: document.getElementById('progressBar')
    };

    // ===== Funções de Inicialização =====

    /**
     * Configura recursos específicos do Tizen
     */
    function setupTizenFeatures() {
        // Verificar se estamos em um ambiente Tizen
        if (typeof tizen !== 'undefined') {
            log('Ambiente Tizen detectado, configurando recursos específicos...');
            
            try {
                // Prevenir que a tela desligue
                if (CONFIG.tizen.preventScreenOff) {
                    tizen.power.request('SCREEN', 'SCREEN_NORMAL');
                    log('Prevenção de desligamento de tela ativada');
                }
                
                // Desativar screensaver
                if (CONFIG.tizen.disableScreensaver && tizen.systeminfo) {
                    tizen.systeminfo.setScreenSaver(false);
                    log('Screensaver desativado');
                }
                
                // Configurar orientação da tela
                if (tizen.systeminfo && tizen.systeminfo.setScreenOrientation) {
                    const orientation = window.TIZEN_PLAYER_CONFIG?.playback?.orientation || 'landscape';
                    tizen.systeminfo.setScreenOrientation(orientation.toUpperCase());
                    log('Orientação da tela configurada para: ' + orientation);
                }
            } catch (e) {
                log('Erro ao configurar recursos Tizen:', e);
            }
        } else {
            log('Ambiente Tizen não detectado, executando em navegador padrão');
        }
    }

    /**
     * Inicializa o player
     */
    function init() {
        log('Inicializando player...');
        
        // Configurar recursos específicos do Tizen
        setupTizenFeatures();
        
        // Detectar ID do player da URL
        const urlParams = new URLSearchParams(window.location.search);
        STATE.playerId = urlParams.get('id') || extractPlayerIdFromPath();
        STATE.accessCode = urlParams.get('code');
        
        // Configurar URL base da API
        setupBaseUrl();
        
        // Configurar eventos
        setupEventListeners();
        
        // Iniciar o player
        if (STATE.playerId) {
            log('ID do player detectado: ' + STATE.playerId);
            loadPlayerData();
        } else if (STATE.accessCode) {
            log('Código de acesso detectado: ' + STATE.accessCode);
            resolveAccessCode();
        } else {
            showError('ID do player ou código de acesso não fornecido');
        }
        
        // Esconder cursor após inatividade
        setupCursorHiding();
        
        // Entrar em modo tela cheia automaticamente, se configurado
        if (window.TIZEN_PLAYER_CONFIG?.ui?.autoFullscreen) {
            // Aguardar um pouco para garantir que o navegador está pronto
            setTimeout(() => {
                log('Entrando em modo tela cheia automaticamente');
                enterFullscreen();
            }, 1000);
        }
    }

    /**
     * Extrai ID do player da URL do caminho
     */
    function extractPlayerIdFromPath() {
        const path = window.location.pathname;
        const matches = path.match(/\/kiosk\/player\/([^\/\?]+)/);
        return matches ? matches[1] : null;
    }

    /**
     * Configura a URL base para a API
     */
    function setupBaseUrl() {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const port = window.location.port;
        
        // Se estiver em porta de desenvolvimento, usar porta 5000
        if (port === '3000' || port === '5173' || port === '5174') {
            STATE.baseUrl = `${protocol}//${hostname}:5000/api`;
        } else if (port) {
            // Se tiver porta específica, manter
            STATE.baseUrl = `${protocol}//${hostname}:${port}/api`;
        } else {
            // Produção: mesmo domínio
            STATE.baseUrl = `${protocol}//${hostname}/api`;
        }
        
        log('URL base configurada: ' + STATE.baseUrl);
    }

    /**
     * Configura os event listeners
     */
    function setupEventListeners() {
        // Detectar atividade do usuário
        document.addEventListener('mousemove', onUserActivity);
        document.addEventListener('keydown', onUserActivity);
        document.addEventListener('click', onUserActivity);
        
        // Capturar teclas de controle
        document.addEventListener('keydown', function(e) {
            // ESC para sair do modo fullscreen
            if (e.key === 'Escape' && document.fullscreenElement) {
                exitFullscreen();
            }
            
            // F para entrar em fullscreen
            if (e.key === 'f' || e.key === 'F') {
                toggleFullscreen();
            }
        });
    }

    /**
     * Configura o esconder automático do cursor
     */
    function setupCursorHiding() {
        setInterval(function() {
            const now = Date.now();
            if (now - STATE.lastActivity > CONFIG.cursorHideDelay) {
                document.body.classList.add('hide-cursor');
            } else {
                document.body.classList.remove('hide-cursor');
            }
        }, 1000);
    }

    /**
     * Registra atividade do usuário
     */
    function onUserActivity() {
        STATE.lastActivity = Date.now();
    }

    // ===== Funções de Comunicação com API =====

    /**
     * Faz uma requisição HTTP
     * @param {string} method - Método HTTP
     * @param {string} endpoint - Endpoint da API
     * @param {Object} data - Dados para enviar (opcional)
     * @returns {Promise} - Promise com a resposta
     */
    function request(method, endpoint, data = null) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const url = STATE.baseUrl + endpoint;
            
            xhr.open(method, url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.timeout = 30000; // 30 segundos
            
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (e) {
                        resolve(xhr.responseText);
                    }
                } else {
                    reject({
                        status: xhr.status,
                        message: xhr.statusText
                    });
                }
            };
            
            xhr.onerror = function() {
                reject({
                    status: 0,
                    message: 'Erro de conexão'
                });
            };
            
            xhr.ontimeout = function() {
                reject({
                    status: 0,
                    message: 'Timeout'
                });
            };
            
            if (data) {
                xhr.send(JSON.stringify(data));
            } else {
                xhr.send();
            }
        });
    }

    /**
     * Resolve o código de acesso para obter o ID do player
     */
    function resolveAccessCode() {
        showLoading('Resolvendo código de acesso...');
        
        request('GET', `/players/resolve-code/${STATE.accessCode}`)
            .then(response => {
                if (response && response.player_id) {
                    STATE.playerId = response.player_id;
                    log('ID do player resolvido: ' + STATE.playerId);
                    
                    // Atualizar URL para facilitar refresh
                    const newUrl = `${window.location.origin}/kiosk/player/${STATE.playerId}?fullscreen=true`;
                    window.history.replaceState({}, document.title, newUrl);
                    
                    // Carregar dados do player
                    loadPlayerData();
                } else {
                    throw new Error('Código de acesso inválido');
                }
            })
            .catch(error => {
                showError('Código de acesso inválido ou expirado');
                scheduleReconnect();
            });
    }

    /**
     * Carrega os dados do player
     */
    function loadPlayerData() {
        showLoading('Carregando dados do player...');
        STATE.loadAttempts++;
        
        // Circuit breaker
        if (STATE.loadAttempts > CONFIG.maxReconnectAttempts) {
            STATE.circuitBreakerOpen = true;
            showError('Sistema temporariamente indisponível. Tentando reconectar...');
            scheduleReconnect(CONFIG.reconnectDelay * 2);
            return;
        }
        
        // Carregar playlist
        request('GET', `/players/${STATE.playerId}/playlist`)
            .then(response => {
                log('Playlist carregada', response);
                
                if (response && response.contents && response.contents.length > 0) {
                    STATE.playlist = response.contents;
                    STATE.currentIndex = 0;
                    STATE.loadAttempts = 0;
                    STATE.connected = true;
                    
                    // Salvar configurações de reprodução
                    if (response.playback_config) {
                        STATE.playbackConfig = response.playback_config;
                    }
                    
                    hideLoading();
                    updateStatusInfo();
                    
                    // Iniciar reprodução
                    playContent();
                    
                    // Conectar ao player
                    connectToPlayer();
                    
                    // Agendar próxima verificação de playlist
                    schedulePlaylistCheck();
                } else {
                    showLoading('Aguardando programação...');
                    scheduleReconnect();
                }
            })
            .catch(error => {
                log('Erro ao carregar playlist', error);
                showError('Erro ao carregar dados do player');
                scheduleReconnect();
            });
        
        // Tentar carregar informações do player
        request('GET', `/players/${STATE.playerId}/info`)
            .then(response => {
                log('Informações do player carregadas', response);
                if (response && response.name) {
                    updateStatusInfo(`Player: ${response.name}`);
                }
            })
            .catch(() => {
                log('Informações do player não disponíveis (modo kiosk)');
            });
    }

    /**
     * Conecta ao player
     */
    function connectToPlayer() {
        request('POST', `/players/${STATE.playerId}/connect`)
            .then(() => {
                log('Conectado com sucesso');
                STATE.connected = true;
                updateStatusInfo();
                
                // Iniciar heartbeat
                startHeartbeat();
            })
            .catch(error => {
                log('Erro ao conectar', error);
                STATE.connected = false;
                updateStatusInfo();
            });
    }

    /**
     * Inicia o heartbeat para manter a conexão
     */
    function startHeartbeat() {
        // Limpar heartbeat anterior se existir
        if (STATE.heartbeatTimer) {
            clearInterval(STATE.heartbeatTimer);
        }
        
        // Iniciar novo heartbeat
        STATE.heartbeatTimer = setInterval(() => {
            if (STATE.currentContent && STATE.isPlaying) {
                sendPlaybackHeartbeat();
            }
            
            // Reconectar se necessário
            connectToPlayer();
        }, CONFIG.heartbeatInterval);
    }

    /**
     * Envia heartbeat de reprodução
     */
    function sendPlaybackHeartbeat() {
        if (!STATE.currentContent) return;
        
        const heartbeatData = {
            player_id: STATE.playerId,
            content_id: STATE.currentContent.id,
            content_title: STATE.currentContent.title,
            content_type: STATE.currentContent.type,
            is_playing: STATE.isPlaying,
            playlist_index: STATE.currentIndex,
            playlist_total: STATE.playlist.length,
            timestamp: new Date().toISOString()
        };
        
        request('POST', `/players/${STATE.playerId}/heartbeat`, heartbeatData)
            .then(() => {
                log('Heartbeat enviado');
            })
            .catch(error => {
                log('Erro ao enviar heartbeat', error);
            });
    }

    /**
     * Envia evento de início de reprodução
     */
    function sendPlaybackStart() {
        if (!STATE.currentContent) return;
        
        const startData = {
            player_id: STATE.playerId,
            content_id: STATE.currentContent.id,
            content_title: STATE.currentContent.title,
            content_type: STATE.currentContent.type,
            campaign_id: STATE.currentContent.campaign_id,
            campaign_name: STATE.currentContent.campaign_name,
            playlist_index: STATE.currentIndex,
            playlist_total: STATE.playlist.length,
            duration_expected: STATE.currentContent.duration || 0,
            timestamp: new Date().toISOString()
        };
        
        request('POST', `/players/${STATE.playerId}/playback_start`, startData)
            .then(() => {
                log('Evento de início enviado');
            })
            .catch(error => {
                log('Erro ao enviar evento de início', error);
            });
    }

    /**
     * Envia evento de fim de reprodução
     */
    function sendPlaybackEnd() {
        if (!STATE.currentContent) return;
        
        const endData = {
            player_id: STATE.playerId,
            content_id: STATE.currentContent.id,
            content_title: STATE.currentContent.title,
            content_type: STATE.currentContent.type,
            duration_actual: Date.now() - (STATE.playbackStartTime || Date.now()),
            timestamp: new Date().toISOString()
        };
        
        request('POST', `/players/${STATE.playerId}/playback_end`, endData)
            .then(() => {
                log('Evento de fim enviado');
            })
            .catch(error => {
                log('Erro ao enviar evento de fim', error);
            });
    }

    /**
     * Agenda verificação periódica da playlist
     */
    function schedulePlaylistCheck() {
        // Limpar timer anterior se existir
        if (STATE.playlistTimer) {
            clearTimeout(STATE.playlistTimer);
        }
        
        // Agendar próxima verificação
        STATE.playlistTimer = setTimeout(() => {
            log('Verificando atualizações na playlist...');
            loadPlayerData();
        }, CONFIG.playlistCheckInterval);
    }

    /**
     * Agenda reconexão em caso de falha
     */
    function scheduleReconnect(delay = CONFIG.reconnectDelay) {
        // Limpar timer anterior se existir
        if (STATE.reconnectTimer) {
            clearTimeout(STATE.reconnectTimer);
        }
        
        // Agendar reconexão
        STATE.reconnectTimer = setTimeout(() => {
            log('Tentando reconectar...');
            if (STATE.circuitBreakerOpen) {
                STATE.circuitBreakerOpen = false;
                STATE.loadAttempts = 0;
            }
            loadPlayerData();
        }, delay);
        
        updateStatusInfo(`Reconectando em ${Math.round(delay/1000)}s...`);
    }

    // ===== Funções de Reprodução de Mídia =====

    /**
     * Reproduz o conteúdo atual
     */
    function playContent() {
        if (STATE.playlist.length === 0) {
            showLoading('Aguardando programação...');
            return;
        }
        
        // Obter conteúdo atual
        STATE.currentContent = STATE.playlist[STATE.currentIndex];
        log('Reproduzindo conteúdo', STATE.currentContent);
        
        // Limpar container
        DOM.mediaContainer.innerHTML = '';
        
        // Limpar timers anteriores
        if (STATE.imageTimer) {
            clearTimeout(STATE.imageTimer);
            STATE.imageTimer = null;
        }
        
        // Criar elemento de mídia adequado
        if (STATE.currentContent.type === 'video') {
            createVideoElement();
        } else if (STATE.currentContent.type === 'image') {
            createImageElement();
        } else {
            showError('Tipo de conteúdo não suportado: ' + STATE.currentContent.type);
            nextContent();
            return;
        }
        
        // Atualizar informações de status
        updateStatusInfo();
    }

    /**
     * Cria e configura elemento de vídeo
     */
    function createVideoElement() {
        const video = document.createElement('video');
        video.src = STATE.currentContent.file_url || STATE.currentContent.url;
        video.autoplay = true;
        video.muted = !(window.TIZEN_PLAYER_CONFIG?.playback?.enableAudio || false);
        video.playsInline = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        
        // Configurar volume se o áudio estiver habilitado
        if (!video.muted) {
            const volume = window.TIZEN_PLAYER_CONFIG?.playback?.defaultVolume || 50;
            video.volume = volume / 100; // Converter de 0-100 para 0-1
            log(`Áudio habilitado com volume ${volume}%`);
        }
        
        // Loop se configurado
        const playbackConfig = STATE.playbackConfig || {};
        if (playbackConfig.playback_mode === 'loop_infinite' || 
            (STATE.playlist.length === 1 && playbackConfig.loop_behavior === 'infinite')) {
            video.loop = true;
        }
        
        // Adicionar event listeners
        video.addEventListener('loadstart', onVideoLoadStart);
        video.addEventListener('canplay', onVideoCanPlay);
        video.addEventListener('play', onVideoPlay);
        video.addEventListener('pause', onVideoPause);
        video.addEventListener('ended', onVideoEnded);
        video.addEventListener('error', onVideoError);
        video.addEventListener('timeupdate', onVideoTimeUpdate);
        
        // Adicionar ao DOM
        DOM.mediaContainer.appendChild(video);
        STATE.mediaElement = video;
    }

    /**
     * Cria e configura elemento de imagem
     */
    function createImageElement() {
        const img = document.createElement('img');
        img.src = STATE.currentContent.file_url || STATE.currentContent.url;
        img.alt = STATE.currentContent.title || 'Imagem';
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        
        // Adicionar event listeners
        img.addEventListener('load', onImageLoad);
        img.addEventListener('error', onImageError);
        
        // Adicionar ao DOM
        DOM.mediaContainer.appendChild(img);
        STATE.mediaElement = img;
    }

    /**
     * Avança para o próximo conteúdo
     */
    function nextContent() {
        // Enviar evento de fim
        sendPlaybackEnd();
        
        // Determinar próximo índice
        const playbackConfig = STATE.playbackConfig || {};
        const playbackMode = playbackConfig.playback_mode || 'sequential';
        const loopBehavior = playbackConfig.loop_behavior || 'until_next';
        const shuffleEnabled = playbackConfig.shuffle_enabled || false;
        
        // Não avançar se for modo single e não for loop infinito
        if (playbackMode === 'single' && loopBehavior !== 'infinite') {
            log('Modo single sem loop, parando após reprodução');
            return;
        }
        
        let nextIndex = 0;
        
        // Determinar próximo índice com base no modo de reprodução
        if (playbackMode === 'random' || shuffleEnabled) {
            // Modo aleatório
            nextIndex = Math.floor(Math.random() * STATE.playlist.length);
            log(`Modo aleatório: próximo índice = ${nextIndex}`);
        } else if (playbackMode === 'sequential' || playbackMode === 'loop_infinite') {
            // Modo sequencial
            if (STATE.currentIndex < STATE.playlist.length - 1) {
                // Ainda há próximos itens
                nextIndex = STATE.currentIndex + 1;
                log(`Modo sequencial: próximo índice = ${nextIndex}`);
            } else {
                // Chegou ao fim da playlist
                if (playbackMode === 'loop_infinite' || loopBehavior === 'infinite' || loopBehavior === 'until_next') {
                    // Voltar ao início
                    nextIndex = 0;
                    log('Fim da playlist: voltando ao início (loop)');
                } else {
                    // Parar reprodução
                    log('Fim da playlist: parando reprodução');
                    return;
                }
            }
        }
        
        // Aplicar transição
        const transitionTime = (playbackConfig.transition_duration || 1) * 1000;
        log(`Aplicando transição de ${transitionTime}ms`);
        
        setTimeout(() => {
            STATE.currentIndex = nextIndex;
            playContent();
        }, transitionTime);
    }

    // ===== Event Handlers para Vídeo =====

    function onVideoLoadStart() {
        log('Vídeo começou a carregar');
        showLoading('Carregando vídeo...');
    }

    function onVideoCanPlay() {
        log('Vídeo pronto para reproduzir');
        hideLoading();
        STATE.isPlaying = true;
        STATE.playbackStartTime = Date.now();
        
        // Enviar evento de início de reprodução
        sendPlaybackStart();
    }

    function onVideoPlay() {
        log('Reprodução de vídeo iniciada');
        STATE.isPlaying = true;
    }

    function onVideoPause() {
        log('Reprodução de vídeo pausada');
        STATE.isPlaying = false;
    }

    function onVideoEnded() {
        log('Reprodução de vídeo finalizada');
        STATE.isPlaying = false;
        nextContent();
    }

    function onVideoError() {
        log('Erro na reprodução do vídeo');
        showError('Erro ao reproduzir vídeo');
        STATE.isPlaying = false;
        
        // Tentar próximo conteúdo após delay
        setTimeout(() => {
            nextContent();
        }, 3000);
    }

    function onVideoTimeUpdate() {
        if (!STATE.mediaElement) return;
        
        const video = STATE.mediaElement;
        const progress = (video.currentTime / video.duration) * 100;
        updateProgressBar(progress);
    }

    // ===== Event Handlers para Imagem =====

    function onImageLoad() {
        log('Imagem carregada');
        hideLoading();
        STATE.isPlaying = true;
        STATE.playbackStartTime = Date.now();
        
        // Enviar evento de início de reprodução
        sendPlaybackStart();
        
        // Simular duração da imagem
        const duration = STATE.currentContent.duration || CONFIG.defaultImageDuration;
        updateStatusInfo(`Imagem: ${Math.round(duration/1000)}s`);
        
        // Iniciar timer de progresso
        startImageProgressTimer(duration);
        
        // Agendar próximo conteúdo
        STATE.imageTimer = setTimeout(() => {
            nextContent();
        }, duration);
    }

    function onImageError() {
        log('Erro ao carregar imagem');
        showError('Erro ao carregar imagem');
        
        // Tentar próximo conteúdo após delay
        setTimeout(() => {
            nextContent();
        }, 3000);
    }

    /**
     * Inicia timer para atualizar barra de progresso da imagem
     */
    function startImageProgressTimer(duration) {
        const startTime = Date.now();
        const interval = 100; // 100ms para atualização suave
        
        const updateProgress = () => {
            const elapsed = Date.now() - startTime;
            const progress = (elapsed / duration) * 100;
            
            if (progress < 100) {
                updateProgressBar(progress);
                setTimeout(updateProgress, interval);
            } else {
                updateProgressBar(100);
            }
        };
        
        updateProgress();
    }

    // ===== Funções de UI =====

    /**
     * Mostra tela de carregamento
     */
    function showLoading(message = 'Carregando...') {
        DOM.loadingScreen.style.display = 'flex';
        DOM.loadingText.textContent = message;
    }

    /**
     * Esconde tela de carregamento
     */
    function hideLoading() {
        DOM.loadingScreen.style.display = 'none';
    }

    /**
     * Mostra mensagem de erro
     */
    function showError(message) {
        DOM.errorMessage.textContent = message;
        DOM.errorMessage.style.display = 'block';
        
        // Auto-esconder após 5 segundos
        setTimeout(() => {
            DOM.errorMessage.style.display = 'none';
        }, 5000);
    }

    /**
     * Atualiza informações de status
     */
    function updateStatusInfo(text) {
        // Verificar se as informações de status devem ser mostradas
        const showStatus = window.TIZEN_PLAYER_CONFIG?.ui?.showStatusInfo !== false;
        
        // Mostrar ou ocultar o elemento de status
        DOM.statusInfo.style.display = showStatus ? 'block' : 'none';
        
        // Se não deve mostrar, sair da função
        if (!showStatus) return;
        
        if (text) {
            DOM.statusInfo.textContent = text;
            return;
        }
        
        // Status padrão baseado no estado atual
        let status = '';
        
        if (STATE.connected) {
            status += '✓ ';
        } else {
            status += '✗ ';
        }
        
        if (STATE.currentContent) {
            status += `${STATE.currentIndex + 1}/${STATE.playlist.length}: ${STATE.currentContent.title}`;
        } else {
            status += 'Aguardando conteúdo';
        }
        
        DOM.statusInfo.textContent = status;
    }

    /**
     * Atualiza barra de progresso
     */
    function updateProgressBar(percent) {
        // Verificar se a barra de progresso deve ser mostrada
        const showProgressBar = window.TIZEN_PLAYER_CONFIG?.ui?.showProgressBar !== false;
        
        // Mostrar ou ocultar a barra de progresso
        DOM.progressBar.style.display = showProgressBar ? 'block' : 'none';
        
        // Se não deve mostrar, sair da função
        if (!showProgressBar) return;
        
        DOM.progressBar.style.width = `${percent}%`;
    }

    /**
     * Alterna modo tela cheia
     */
    function toggleFullscreen() {
        if (isFullscreenActive()) {
            exitFullscreen();
        } else {
            enterFullscreen();
        }
    }

    /**
     * Verifica se está em modo tela cheia
     */
    function isFullscreenActive() {
        return !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );
    }

    /**
     * Entra em modo tela cheia
     */
    function enterFullscreen() {
        const element = document.documentElement;
        
        try {
            if (element.requestFullscreen) {
                element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                element.webkitRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                element.mozRequestFullScreen();
            } else if (element.msRequestFullscreen) {
                element.msRequestFullscreen();
            }
        } catch (e) {
            log('Erro ao entrar em tela cheia', e);
        }
    }

    /**
     * Sai do modo tela cheia
     */
    function exitFullscreen() {
        try {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        } catch (e) {
            log('Erro ao sair da tela cheia', e);
        }
    }

    // ===== Funções de Utilidade =====

    /**
     * Função de log condicional
     */
    function log(message, data) {
        if (!CONFIG.debug) return;
        
        if (data) {
            console.log(`[TizenPlayer] ${message}:`, data);
        } else {
            console.log(`[TizenPlayer] ${message}`);
        }
    }

    // ===== Inicialização =====
    
    // Iniciar o player quando o documento estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
