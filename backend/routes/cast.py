from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.player import Player, db
import json

cast_bp = Blueprint('cast', __name__)

@cast_bp.route('/devices', methods=['GET'])
@jwt_required()
def get_cast_devices():
    """Retorna dispositivos Chromecast disponíveis na rede"""
    try:
        # Em produção, isso faria descoberta real de dispositivos Cast na rede
        # Por enquanto, retornamos dispositivos mockados baseados nos players
        players = Player.query.filter(Player.is_active == True).all()
        
        cast_devices = []
        for player in players:
            if player.chromecast_id:
                cast_devices.append({
                    'id': player.chromecast_id,
                    'name': player.chromecast_name or f"Chromecast {player.name}",
                    'player_id': player.id,
                    'location': player.location_name,
                    'room': player.room_name,
                    'status': 'available' if player.is_online else 'offline'
                })
        
        return jsonify({
            'devices': cast_devices,
            'total': len(cast_devices)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@cast_bp.route('/devices/scan', methods=['POST'])
@jwt_required()
def scan_cast_devices():
    """Escaneia a rede em busca de dispositivos Chromecast"""
    try:
        # Em produção, implementaria descoberta mDNS para Chromecast
        # Por enquanto, simula descoberta de dispositivos
        
        discovered_devices = [
            {
                'id': 'cc_living_room_001',
                'name': 'TV Recepção',
                'ip': '192.168.1.101',
                'model': 'Chromecast with Google TV'
            },
            {
                'id': 'cc_meeting_room_002', 
                'name': 'TV Sala Reunião',
                'ip': '192.168.1.102',
                'model': 'Chromecast Ultra'
            },
            {
                'id': 'cc_cafeteria_003',
                'name': 'TV Cafeteria', 
                'ip': '192.168.1.103',
                'model': 'Chromecast'
            }
        ]
        
        return jsonify({
            'discovered_devices': discovered_devices,
            'scan_time': '2024-01-15T10:30:00Z'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@cast_bp.route('/players/<player_id>/associate', methods=['POST'])
@jwt_required()
def associate_chromecast(player_id):
    """Associa um player com um dispositivo Chromecast"""
    try:
        data = request.get_json()
        chromecast_id = data.get('chromecast_id')
        chromecast_name = data.get('chromecast_name')
        
        if not chromecast_id:
            return jsonify({'error': 'chromecast_id é obrigatório'}), 400
        
        player = Player.query.get(player_id)
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404
        
        # Verificar se Chromecast já está associado a outro player
        existing = Player.query.filter(
            Player.chromecast_id == chromecast_id,
            Player.id != player_id
        ).first()
        
        if existing:
            return jsonify({
                'error': f'Chromecast já associado ao player {existing.name}'
            }), 409
        
        # Associar Chromecast ao player
        player.chromecast_id = chromecast_id
        player.chromecast_name = chromecast_name
        player.platform = 'chromecast'
        
        db.session.commit()
        
        return jsonify({
            'message': 'Chromecast associado com sucesso',
            'player': player.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@cast_bp.route('/players/<player_id>/cast/command', methods=['POST'])
@jwt_required()
def send_cast_command(player_id):
    """Envia comando para dispositivo Chromecast"""
    try:
        data = request.get_json()
        command = data.get('command')
        params = data.get('params', {})
        
        if not command:
            return jsonify({'error': 'Comando é obrigatório'}), 400
        
        player = Player.query.get(player_id)
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404
        
        if not player.chromecast_id:
            return jsonify({'error': 'Player não possui Chromecast associado'}), 400
        
        # Validar comandos suportados
        valid_commands = ['play', 'pause', 'stop', 'load_media', 'set_volume', 'seek']
        if command not in valid_commands:
            return jsonify({'error': f'Comando inválido. Suportados: {valid_commands}'}), 400
        
        # Em produção, enviaria comando real para Chromecast via Google Cast API
        # Por enquanto, simula envio de comando
        
        command_data = {
            'player_id': player_id,
            'chromecast_id': player.chromecast_id,
            'command': command,
            'params': params,
            'timestamp': '2024-01-15T10:30:00Z'
        }
        
        # Aqui seria implementada a comunicação real com Chromecast
        # usando bibliotecas como pychromecast ou via WebSocket
        
        return jsonify({
            'message': f'Comando {command} enviado com sucesso',
            'command_data': command_data
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@cast_bp.route('/players/<player_id>/cast/load', methods=['POST'])
@jwt_required()
def load_content_to_cast(player_id):
    """Carrega conteúdo específico no Chromecast"""
    try:
        data = request.get_json()
        content_url = data.get('content_url')
        content_type = data.get('content_type', 'video/mp4')
        title = data.get('title', 'TVS Content')
        description = data.get('description', '')
        
        if not content_url:
            return jsonify({'error': 'content_url é obrigatório'}), 400
        
        player = Player.query.get(player_id)
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404
        
        if not player.chromecast_id:
            return jsonify({'error': 'Player não possui Chromecast associado'}), 400
        
        # Preparar dados de mídia para Chromecast
        media_data = {
            'contentId': content_url,
            'contentType': content_type,
            'streamType': 'BUFFERED',
            'metadata': {
                'type': 0,  # GenericMediaMetadata
                'metadataType': 0,
                'title': title,
                'subtitle': description
            },
            'customData': {
                'player_id': player_id,
                'timestamp': '2024-01-15T10:30:00Z'
            }
        }
        
        # Em produção, carregaria mídia real no Chromecast
        # Por enquanto, simula carregamento
        
        return jsonify({
            'message': 'Conteúdo carregado com sucesso no Chromecast',
            'media_data': media_data
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@cast_bp.route('/players/<player_id>/cast/status', methods=['GET'])
@jwt_required()
def get_cast_status(player_id):
    """Retorna status atual do Chromecast"""
    try:
        player = Player.query.get(player_id)
        if not player:
            return jsonify({'error': 'Player não encontrado'}), 404
        
        if not player.chromecast_id:
            return jsonify({'error': 'Player não possui Chromecast associado'}), 400
        
        # Em produção, consultaria status real do Chromecast
        # Por enquanto, retorna status simulado
        
        cast_status = {
            'chromecast_id': player.chromecast_id,
            'chromecast_name': player.chromecast_name,
            'is_connected': player.is_online,
            'current_app': 'TVS Digital Signage',
            'media_status': {
                'player_state': 'PLAYING',
                'current_time': 45.2,
                'duration': 180.0,
                'volume': 0.8,
                'is_muted': False
            },
            'device_info': {
                'model': 'Chromecast with Google TV',
                'version': '1.56.281627',
                'ip_address': player.ip_address
            }
        }
        
        return jsonify(cast_status), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
