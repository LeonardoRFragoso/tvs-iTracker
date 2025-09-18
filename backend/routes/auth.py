from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import check_password_hash, generate_password_hash
from datetime import datetime
import uuid
from models.user import User, db
from services.auto_sync_service import auto_sync_service

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Email e senha são obrigatórios'}), 400
        
        user = User.query.filter_by(email=email).first()
        
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({'error': 'Credenciais inválidas'}), 401
        
        # Bloquear acesso conforme status
        if getattr(user, 'status', 'active') == 'pending':
            return jsonify({'error': 'Sua conta está pendente de aprovação'}), 403
        if getattr(user, 'status', 'active') == 'rejected':
            return jsonify({'error': 'Sua solicitação de cadastro foi rejeitada'}), 403
        
        if not user.is_active:
            return jsonify({'error': 'Conta desativada'}), 401
        
        # Atualizar último login
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Criar token JWT
        access_token = create_access_token(identity=user.id)
        
        # Iniciar sincronização automática de players em background
        try:
            print("[AUTH] Iniciando sincronização automática de players após login...")
            
            # Executar sync em thread separada para não bloquear o login
            import threading
            from flask import current_app
            
            # Capturar a instância da aplicação antes de criar a thread
            app = current_app._get_current_object()
            
            def sync_with_context():
                with app.app_context():
                    auto_sync_service.sync_all_players()
            
            sync_thread = threading.Thread(
                target=sync_with_context,
                daemon=True
            )
            sync_thread.start()
            print("[AUTH] Sincronização automática iniciada em background")
        except Exception as sync_error:
            print(f"[AUTH] Erro ao iniciar sincronização automática: {sync_error}")
            # Não falhar o login se a sincronização falhar
        
        return jsonify({
            'access_token': access_token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/public-register', methods=['POST'])
def public_register():
    """Cadastro público: cria usuário com status 'pending' e sem senha válida.
    Admin irá aprovar e definir uma senha temporária.
    """
    try:
        data = request.get_json() or {}
        username = data.get('username')
        email = data.get('email')
        role = 'hr'  # Forçar RH para cadastro público
        company = data.get('company', 'iTracker')
        
        if not username or not email:
            return jsonify({'error': 'Username e email são obrigatórios'}), 400
        
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email já cadastrado'}), 409
        if User.query.filter_by(username=username).first():
            return jsonify({'error': 'Username já cadastrado'}), 409
        
        # Criar usuário pendente com senha aleatória inválida para login
        random_seed = str(uuid.uuid4())
        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(random_seed),
            role=role,
            company=company,
            is_active=False,
            status='pending',
            must_change_password=False
        )
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'Cadastro enviado com sucesso. Aguarde aprovação do administrador.',
            'user': user.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/pending-users', methods=['GET'])
@jwt_required()
def list_pending_users():
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        if current_user.role != 'admin':
            return jsonify({'error': 'Apenas administradores podem listar pendentes'}), 403
        users = User.query.filter_by(status='pending').all()
        return jsonify({'users': [u.to_dict() for u in users]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/users/<user_id>/approve', methods=['POST'])
@jwt_required()
def approve_user(user_id):
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        if current_user.role != 'admin':
            return jsonify({'error': 'Apenas administradores podem aprovar usuários'}), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        data = request.get_json() or {}
        temp_password = data.get('temp_password') or str(uuid.uuid4())[:8]
        
        user.password_hash = generate_password_hash(temp_password)
        user.status = 'active'
        user.is_active = True
        user.must_change_password = True
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Usuário aprovado com sucesso. Senha temporária definida.',
            'temp_password': temp_password,
            'user': user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/users/<user_id>/reject', methods=['POST'])
@jwt_required()
def reject_user(user_id):
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        if current_user.role != 'admin':
            return jsonify({'error': 'Apenas administradores podem rejeitar usuários'}), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        user.status = 'rejected'
        user.is_active = False
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'Usuário rejeitado com sucesso', 'user': user.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        data = request.get_json() or {}
        old_password = data.get('old_password')
        new_password = data.get('new_password')
        
        if not old_password or not new_password:
            return jsonify({'error': 'Senha atual e nova senha são obrigatórias'}), 400
        
        if not check_password_hash(user.password_hash, old_password):
            return jsonify({'error': 'Senha atual incorreta'}), 400
        
        user.password_hash = generate_password_hash(new_password)
        user.must_change_password = False
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'Senha atualizada com sucesso', 'user': user.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/register', methods=['POST'])
@jwt_required()
def register():
    try:
        # Verificar se usuário atual é admin
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Apenas administradores podem criar usuários'}), 403
        
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        role = data.get('role', 'user')
        company = data.get('company', 'iTracker')
        
        if not username or not email or not password:
            return jsonify({'error': 'Username, email e senha são obrigatórios'}), 400
        
        # Verificar se usuário já existe
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email já cadastrado'}), 409
        
        if User.query.filter_by(username=username).first():
            return jsonify({'error': 'Username já cadastrado'}), 409
        
        # Criar novo usuário
        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password),
            role=role,
            company=company
        )
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'Usuário criado com sucesso',
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        return jsonify({'user': user.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        data = request.get_json()
        
        if 'username' in data:
            # Verificar se username não está em uso
            existing = User.query.filter(User.username == data['username'], User.id != user_id).first()
            if existing:
                return jsonify({'error': 'Username já está em uso'}), 409
            user.username = data['username']
        
        if 'email' in data:
            # Verificar se email não está em uso
            existing = User.query.filter(User.email == data['email'], User.id != user_id).first()
            if existing:
                return jsonify({'error': 'Email já está em uso'}), 409
            user.email = data['email']
        
        if 'password' in data and data['password']:
            user.password_hash = generate_password_hash(data['password'])
        
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Perfil atualizado com sucesso',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/users', methods=['GET'])
@jwt_required()
def list_users():
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Acesso negado'}), 403
        
        users = User.query.all()
        return jsonify({
            'users': [user.to_dict() for user in users]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/users/<user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Apenas administradores podem editar usuários'}), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        data = request.get_json()
        
        if 'is_active' in data:
            user.is_active = data['is_active']
        
        if 'role' in data:
            user.role = data['role']
        
        if 'company' in data:
            user.company = data['company']
        
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Usuário atualizado com sucesso',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = request.get_json() or {}
        email = data.get('email')
        if not email:
            return jsonify({'error': 'Email é obrigatório'}), 400
        
        # Opcionalmente localizar o usuário, mas não revelar existência
        _user = User.query.filter_by(email=email).first()
        # Aqui poderíamos gerar um token e enviar email. Por ora, apenas retornar mensagem genérica.
        return jsonify({
            'message': 'Se este email estiver cadastrado, enviaremos instruções para redefinir a senha.'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
