from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from models.user import User, db

onboarding_bp = Blueprint('onboarding', __name__)

DEFAULT_FLOW = 'gettingStarted@1'

@onboarding_bp.route('/state', methods=['GET'])
@jwt_required()
def get_state():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        flow = (request.args.get('flow') or DEFAULT_FLOW).strip()
        completed = bool(user.onboarding_completed_at) and (user.onboarding_version == flow)
        step_index = int(user.onboarding_step_index or 0) if not completed else 0
        return jsonify({
            'flow': flow,
            'version': user.onboarding_version,
            'completed': completed,
            'step_index': step_index,
            'completed_at': user.onboarding_completed_at.isoformat() if user.onboarding_completed_at else None,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@onboarding_bp.route('/progress', methods=['POST'])
@jwt_required()
def set_progress():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        data = request.get_json(silent=True) or {}
        flow = (data.get('flow') or DEFAULT_FLOW).strip()
        step_index = int(data.get('step_index') or 0)
        if step_index < 0:
            step_index = 0
        user.onboarding_version = flow
        user.onboarding_step_index = step_index
        db.session.commit()
        return jsonify({'message': 'Progresso atualizado', 'step_index': user.onboarding_step_index}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@onboarding_bp.route('/complete', methods=['POST'])
@jwt_required()
def complete():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        data = request.get_json(silent=True) or {}
        flow = (data.get('flow') or DEFAULT_FLOW).strip()
        user.onboarding_version = flow
        user.onboarding_completed_at = datetime.utcnow()
        user.onboarding_step_index = 0
        db.session.commit()
        return jsonify({'message': 'Onboarding concluído', 'completed_at': user.onboarding_completed_at.isoformat()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
