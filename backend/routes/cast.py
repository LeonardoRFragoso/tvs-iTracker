from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.player import Player, db
from services.chromecast_service import chromecast_service
import json

cast_bp = Blueprint('cast', __name__)

@cast_bp.route('/devices', methods=['GET'])
@jwt_required()
def get_cast_devices():
    """Retorna dispositivos Chromecast disponíveis na rede"""
    try:
        # Descobrir dispositivos reais na rede
        discovered_devices = chromecast_service.discover_devices()
        
        # Combinar com players cadastrados
        players = Player.query.filter(Player.is_active == True).all()
        
        cast_devices = []
        
        # Adicionar dispositivos descobertos
        for device in discovered_devices:
            # Verificar se já está associado a um player
            associated_player = None
            for player in players:
                if player.chromecast_id == device['id']:
                    associated_player = player
                    break
            
            cast_devices.append({
                'id': device['id'],
                'name': device['name'],
                'model': device['model'],
                'ip': device['ip'],
                'status': 'available',
                'player_id': associated_player.id if associated_player else None,
                'location': associated_player.location_name if associated_player else None,
                'room': associated_player.room_name if associated_player else None,
                'is_associated': associated_player is not None
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
        # Descoberta real de dispositivos
        discovered_devices = chromecast_service.discover_devices(timeout=10)
        
        return jsonify({
            'discovered_devices': discovered_devices,
            'scan_time': '2024-01-15T10:30:00Z',
            'total_found': len(discovered_devices)
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
        
        # Enviar comando real para Chromecast
        success = chromecast_service.send_command(player.chromecast_id, command, params)
        
        if success:
            return jsonify({
                'message': f'Comando {command} enviado com sucesso',
                'player_id': player_id,
                'chromecast_id': player.chromecast_id
            }), 200
        else:
            return jsonify({
                'error': f'Falha ao enviar comando {command}'
            }), 500
        
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
        
        # Carregar mídia real no Chromecast
        success = chromecast_service.load_media(player.chromecast_id, media_data)
        
        if success:
            return jsonify({
                'message': 'Conteúdo carregado com sucesso no Chromecast',
                'media_data': media_data
            }), 200
        else:
            return jsonify({
                'error': 'Falha ao carregar conteúdo'
            }), 500
        
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
        
        # Obter status real do Chromecast
        cast_status = chromecast_service.get_device_status(player.chromecast_id)
        
        if cast_status:
            return jsonify(cast_status), 200
        else:
            return jsonify({
                'error': 'Não foi possível obter status do Chromecast'
            }), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
