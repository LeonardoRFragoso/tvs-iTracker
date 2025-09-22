from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.user import User
from models.system_config import SystemConfig
from sqlalchemy.exc import SQLAlchemyError
import json

settings_bp = Blueprint('settings', __name__)

# Prefixos para agrupar configurações
CONFIG_PREFIXES = {
    'general': 'general.',
    'ui': 'ui.',
    'display': 'display.',
    'storage': 'storage.',
    'security': 'security.'
}

# Configurações padrão do sistema
DEFAULT_SETTINGS = {
    # Configurações Gerais
    'general.company_name': {'value': 'TVS Digital Signage', 'type': 'string', 'description': 'Nome da empresa'},
    'general.timezone': {'value': 'America/Sao_Paulo', 'type': 'string', 'description': 'Fuso horário do sistema'},
    'general.language': {'value': 'pt-BR', 'type': 'string', 'description': 'Idioma padrão do sistema'},
    'general.auto_sync': {'value': True, 'type': 'bool', 'description': 'Sincronização automática de players'},
    'general.auto_update': {'value': True, 'type': 'bool', 'description': 'Atualizações automáticas do sistema'},
    'general.debug_mode': {'value': False, 'type': 'bool', 'description': 'Modo de depuração'},
    
    # Configurações de UI
    'ui.dark_theme': {'value': False, 'type': 'bool', 'description': 'Tema escuro'},
    'ui.animations_enabled': {'value': True, 'type': 'bool', 'description': 'Animações habilitadas'},
    'ui.transition_duration': {'value': 300, 'type': 'int', 'description': 'Duração das transições (ms)'},
    
    # Configurações de Display
    'display.default_orientation': {'value': 'landscape', 'type': 'string', 'description': 'Orientação padrão'},
    'display.default_volume': {'value': 50, 'type': 'int', 'description': 'Volume padrão (%)'},
    
    # Configurações de Armazenamento
    'storage.max_storage_gb': {'value': 100, 'type': 'int', 'description': 'Limite máximo de armazenamento (GB)'},
    'storage.auto_cleanup': {'value': True, 'type': 'bool', 'description': 'Limpeza automática de arquivos não utilizados'},
    'storage.backup_enabled': {'value': False, 'type': 'bool', 'description': 'Backup automático habilitado'},
    
    # Configurações de Segurança
    'security.session_timeout': {'value': 30, 'type': 'int', 'description': 'Timeout da sessão (minutos)'},
    'security.password_policy': {'value': 'medium', 'type': 'string', 'description': 'Política de senha (low, medium, high)'}
}

def ensure_default_settings():
    """Garante que todas as configurações padrão existam no banco de dados"""
    for key, config in DEFAULT_SETTINGS.items():
        if SystemConfig.get_value(key) is None:
            SystemConfig.set_value(
                key=key,
                value=config['value'],
                value_type=config['type'],
                description=config['description']
            )
    # Limpar chaves obsoletas removidas do sistema
    try:
        if SystemConfig.get_value('display.default_resolution') is not None:
            SystemConfig.delete_value('display.default_resolution')
    except Exception:
        pass

@settings_bp.route('/api/settings', methods=['GET'])
@jwt_required()
def get_all_settings():
    """Retorna todas as configurações do sistema"""
    try:
        # Verificar se o usuário é admin
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Acesso negado. Apenas administradores podem acessar configurações do sistema'}), 403
        
        # Garantir que as configurações padrão existam
        ensure_default_settings()
        
        # Obter todas as configurações e filtrar apenas as suportadas atualmente
        all_existing = SystemConfig.get_all_configs()
        all_settings = {k: v for k, v in all_existing.items() if k in DEFAULT_SETTINGS}
        
        # Organizar por categoria
        settings_by_category = {}
        for key, value in all_settings.items():
            category = key.split('.')[0] if '.' in key else 'other'
            if category not in settings_by_category:
                settings_by_category[category] = {}
            settings_by_category[category][key] = value
        
        return jsonify({
            'settings': all_settings,
            'settings_by_category': settings_by_category
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/api/settings/<category>', methods=['GET'])
@jwt_required()
def get_settings_by_category(category):
    """Retorna configurações de uma categoria específica"""
    try:
        # Verificar se o usuário é admin
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Acesso negado. Apenas administradores podem acessar configurações do sistema'}), 403
        
        # Garantir que as configurações padrão existam
        ensure_default_settings()
        
        # Verificar se a categoria existe
        prefix = CONFIG_PREFIXES.get(category)
        if not prefix:
            return jsonify({'error': f'Categoria {category} não encontrada'}), 404
        
        # Obter configurações da categoria
        settings = SystemConfig.get_configs_by_prefix(prefix)
        
        return jsonify({'settings': settings}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/api/settings', methods=['PUT'])
@jwt_required()
def update_settings():
    """Atualiza configurações do sistema"""
    try:
        # Verificar se o usuário é admin
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Acesso negado. Apenas administradores podem modificar configurações do sistema'}), 403
        
        # Obter dados da requisição
        data = request.get_json()
        if not data or not isinstance(data, dict):
            return jsonify({'error': 'Dados inválidos'}), 400
        
        # Enforce mandatory settings regardless of client input
        data['general.language'] = 'pt-BR'
        data['general.timezone'] = 'America/Sao_Paulo'
        
        # Atualizar cada configuração
        updated = {}
        for key, value in data.items():
            # Verificar se a configuração existe
            config = SystemConfig.query.filter_by(key=key).first()
            if not config:
                # Verificar se é uma configuração padrão
                if key in DEFAULT_SETTINGS:
                    value_type = DEFAULT_SETTINGS[key]['type']
                    description = DEFAULT_SETTINGS[key]['description']
                    SystemConfig.set_value(key, value, value_type, description)
                    updated[key] = value
                else:
                    # Ignorar configurações desconhecidas
                    continue
            else:
                # Atualizar configuração existente
                SystemConfig.set_value(key, value)
                updated[key] = value
        
        return jsonify({
            'message': 'Configurações atualizadas com sucesso',
            'updated': updated
        }), 200
    except SQLAlchemyError as e:
        return jsonify({'error': f'Erro de banco de dados: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/api/settings/reset', methods=['POST'])
@jwt_required()
def reset_settings():
    """Redefine todas as configurações para os valores padrão"""
    try:
        # Verificar se o usuário é admin
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Acesso negado. Apenas administradores podem redefinir configurações do sistema'}), 403
        
        # Excluir todas as configurações existentes
        for config in SystemConfig.query.all():
            SystemConfig.delete_value(config.key)
        
        # Recriar configurações padrão
        for key, config in DEFAULT_SETTINGS.items():
            SystemConfig.set_value(
                key=key,
                value=config['value'],
                value_type=config['type'],
                description=config['description']
            )
        
        return jsonify({
            'message': 'Configurações redefinidas com sucesso',
            'settings': SystemConfig.get_all_configs()
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/api/settings/ui-preferences', methods=['GET'])
def get_ui_preferences():
    """Retorna preferências de UI para o frontend (não requer autenticação)"""
    try:
        # Garantir que as configurações padrão existam
        ensure_default_settings()
        
        # Obter configurações de UI
        ui_settings = SystemConfig.get_configs_by_prefix('ui.')
        
        return jsonify({'preferences': ui_settings}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Endpoint público para players em modo kiosk consumirem preferências relevantes
@settings_bp.route('/api/settings/player-preferences', methods=['GET'])
def get_player_preferences():
    """Retorna preferências necessárias para players (público)."""
    try:
        ensure_default_settings()
        prefs = SystemConfig.get_configs_by_prefix('display.')
        # Filtrar apenas chaves suportadas para players
        whitelisted = {
            'display.default_orientation': prefs.get('display.default_orientation', 'landscape'),
            'display.default_volume': prefs.get('display.default_volume', 50),
        }
        return jsonify({'preferences': whitelisted}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
