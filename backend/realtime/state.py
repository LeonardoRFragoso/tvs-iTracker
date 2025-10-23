# Estado compartilhado para conexões WebSocket e reprodução
# Mantido separado para evitar importações circulares

CONNECTED_PLAYERS = {}
SOCKET_SID_TO_PLAYER = {}
SOCKET_SID_TO_USER = {}

# Status de reprodução por player (compatibilidade)
PLAYER_PLAYBACK_STATUS = {}
