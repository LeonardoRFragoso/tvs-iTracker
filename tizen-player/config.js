/**
 * Configurações do iTracker TV Player para Tizen
 * Este arquivo pode ser editado para ajustar o comportamento do player
 * sem necessidade de modificar o código principal
 */

const TIZEN_PLAYER_CONFIG = {
    // Configurações de rede
    network: {
        // Tempo de reconexão em caso de falha (ms)
        reconnectDelay: 15000,
        
        // Máximo de tentativas de reconexão
        maxReconnectAttempts: 5,
        
        // Tempo entre verificações de playlist (ms)
        playlistCheckInterval: 60000,
        
        // Tempo para heartbeat (ms)
        heartbeatInterval: 30000,
        
        // URL base da API (deixe vazio para detecção automática)
        baseUrl: '',
    },
    
    // Configurações de reprodução
    playback: {
        // Tempo de transição entre conteúdos (ms)
        transitionTime: 1000,
        
        // Duração padrão para imagens (ms)
        defaultImageDuration: 10000,
        
        // Volume padrão (0-100)
        defaultVolume: 50,
        
        // Reproduzir áudio (true/false)
        enableAudio: false,
        
        // Orientação da tela (landscape/portrait)
        orientation: 'landscape',
    },
    
    // Configurações de interface
    ui: {
        // Tempo para esconder o cursor (ms)
        cursorHideDelay: 3000,
        
        // Mostrar informações de status (true/false)
        showStatusInfo: true,
        
        // Mostrar barra de progresso (true/false)
        showProgressBar: true,
        
        // Entrar em modo tela cheia automaticamente (true/false)
        autoFullscreen: true,
    },
    
    // Configurações de depuração
    debug: {
        // Modo de depuração (true/false)
        enabled: true,
        
        // Nível de log (1-4)
        logLevel: 3,
    },
    
    // Configurações específicas para Tizen
    tizen: {
        // Prevenir que a tela desligue (true/false)
        preventScreenOff: true,
        
        // Desativar screensaver (true/false)
        disableScreensaver: true,
    }
};

// Não modificar esta linha
if (typeof module !== 'undefined') module.exports = TIZEN_PLAYER_CONFIG;
