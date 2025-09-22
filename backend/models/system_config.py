from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.sql import func
import json
from datetime import datetime

from database import db

class SystemConfig(db.Model):
    """Modelo para armazenar configurações do sistema"""
    __tablename__ = 'system_configs'

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text, nullable=True)
    value_type = db.Column(db.String(20), default='string')  # string, int, float, bool, json
    description = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<SystemConfig {self.key}={self.value}>'

    def to_dict(self):
        return {
            'id': self.id,
            'key': self.key,
            'value': self.get_typed_value(),
            'value_type': self.value_type,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def get_typed_value(self):
        """Retorna o valor convertido para o tipo correto"""
        if not self.value:
            return None
        
        try:
            if self.value_type == 'int':
                return int(self.value)
            elif self.value_type == 'float':
                return float(self.value)
            elif self.value_type == 'bool':
                return self.value.lower() in ('true', '1', 't', 'y', 'yes')
            elif self.value_type == 'json':
                return json.loads(self.value)
            else:  # string ou outro tipo
                return self.value
        except (ValueError, json.JSONDecodeError):
            return self.value

    @staticmethod
    def get_value(key, default=None):
        """Obtém o valor de uma configuração pelo nome da chave"""
        config = SystemConfig.query.filter_by(key=key).first()
        if config:
            return config.get_typed_value()
        return default

    @staticmethod
    def set_value(key, value, value_type=None, description=None):
        """Define o valor de uma configuração, criando-a se não existir"""
        config = SystemConfig.query.filter_by(key=key).first()
        
        # Determinar o tipo do valor se não for especificado
        if value_type is None:
            if isinstance(value, bool):
                value_type = 'bool'
            elif isinstance(value, int):
                value_type = 'int'
            elif isinstance(value, float):
                value_type = 'float'
            elif isinstance(value, (dict, list)):
                value_type = 'json'
                value = json.dumps(value)
            else:
                value_type = 'string'
        
        # Converter para string para armazenamento
        if value_type == 'json' and not isinstance(value, str):
            value = json.dumps(value)
        elif value_type == 'bool' and isinstance(value, bool):
            value = str(value).lower()
        elif value is not None:
            value = str(value)
        
        if config:
            # Atualizar configuração existente
            config.value = value
            config.value_type = value_type
            if description:
                config.description = description
        else:
            # Criar nova configuração
            config = SystemConfig(
                key=key,
                value=value,
                value_type=value_type,
                description=description
            )
            db.session.add(config)
        
        db.session.commit()
        return config

    @staticmethod
    def delete_value(key):
        """Exclui uma configuração pelo nome da chave"""
        config = SystemConfig.query.filter_by(key=key).first()
        if config:
            db.session.delete(config)
            db.session.commit()
            return True
        return False

    @staticmethod
    def get_all_configs():
        """Retorna todas as configurações como dicionário"""
        configs = SystemConfig.query.all()
        return {config.key: config.get_typed_value() for config in configs}

    @staticmethod
    def get_configs_by_prefix(prefix):
        """Retorna todas as configurações que começam com o prefixo especificado"""
        configs = SystemConfig.query.filter(SystemConfig.key.startswith(prefix)).all()
        return {config.key: config.get_typed_value() for config in configs}
