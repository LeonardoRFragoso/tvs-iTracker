from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import check_password_hash, generate_password_hash
from datetime import datetime
import uuid
from models.user import User, db
from sqlalchemy import or_
from sqlalchemy import distinct
from services.auto_sync_service import auto_sync_service
from models.system_config import SystemConfig

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json() or {}
        # Aceita email OU username no mesmo campo (frontend envia 'email')
        identifier_raw = (data.get('email') or data.get('username') or '').strip()
        identifier = identifier_raw.lower()
        password = (data.get('password') or '').strip()
        
        if not identifier or not password:
            return jsonify({'error': 'Email/usuário e senha são obrigatórios'}), 400
        
        user = User.query.filter(
            or_(
                db.func.lower(User.email) == identifier,
                db.func.lower(User.username) == identifier
            )
        ).first()
        
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
        
        # Iniciar sincronização automática de players em background (se habilitada)
        try:
            enabled = SystemConfig.get_value('general.auto_sync')
            if str(enabled).lower() in ['1', 'true', 'yes'] or enabled is True or enabled is None:
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
            else:
                print("[AUTH] Auto-sync desabilitado por configuração (general.auto_sync = false)")
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
        username = (data.get('username') or '').strip()
        email = (data.get('email') or '').strip().lower()
        role = 'hr'  # Forçar RH para cadastro público
        company = data.get('company', 'iTracker')
        
        if not username or not email:
            return jsonify({'error': 'Username e email são obrigatórios'}), 400
        
        if User.query.filter(db.func.lower(User.email) == email).first():
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
        username = (data.get('username') or '').strip()
        email = (data.get('email') or '').strip().lower()
        password = data.get('password')
        role = data.get('role', 'user')
        company = data.get('company', 'iTracker')
        
        if not username or not email or not password:
            return jsonify({'error': 'Username, email e senha são obrigatórios'}), 400
        
        # Verificar se usuário já existe
        if User.query.filter(db.func.lower(User.email) == email).first():
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
            new_email = (data['email'] or '').strip().lower()
            existing = User.query.filter(User.id != user_id, db.func.lower(User.email) == new_email).first()
            if existing:
                return jsonify({'error': 'Email já está em uso'}), 409
            user.email = new_email
        
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
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Acesso negado'}), 403
        
        users = User.query.all()
        return jsonify({
            'users': [user.to_dict() for user in users]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/users/summary', methods=['GET'])
@jwt_required()
def users_summary():
    """Resumo de usuários por empresa/role e pendências (apenas admin)."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Apenas administradores podem visualizar o resumo'}), 403
        
        # Lista de empresas distintas
        companies_rows = db.session.query(User.company).distinct().all()
        companies = [row[0] for row in companies_rows if row and row[0]]
        
        total_users = db.session.query(db.func.count(User.id)).scalar() or 0
        
        # Contagem por empresa e role
        rows = db.session.query(User.company, User.role, db.func.count(User.id)) \
            .group_by(User.company, User.role).all()
        by_company = {}
        for company, role, count in rows:
            comp = company or 'unknown'
            by_company.setdefault(comp, {})[role or 'user'] = int(count or 0)
        
        # Pendentes por empresa
        pend_rows = db.session.query(User.company, db.func.count(User.id)) \
            .filter(User.status == 'pending').group_by(User.company).all()
        pending_by_company = { (c or 'unknown'): int(cnt or 0) for c, cnt in pend_rows }
        
        # Lista de usuários RH por empresa (dados básicos)
        hr_users = User.query.filter(User.role == 'hr').all()
        hr_by_company = {}
        for u in hr_users:
            comp = u.company or 'unknown'
            hr_by_company.setdefault(comp, []).append({
                'id': u.id,
                'username': u.username,
                'email': u.email,
                'status': getattr(u, 'status', 'active')
            })
        
        return jsonify({
            'total_users': int(total_users),
            'companies': companies,
            'by_company': by_company,
            'pending_by_company': pending_by_company,
            'hr_by_company': hr_by_company,
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

@auth_bp.route('/users/<user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Apenas administradores podem excluir usuários'}), 403

        if str(current_user_id) == str(user_id):
            return jsonify({'error': 'Você não pode excluir a si mesmo'}), 400

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Usuário não encontrado'}), 404

        # Impedir exclusão do último admin ativo
        if user.role == 'admin':
            other_admins = db.session.query(db.func.count(User.id)).filter(
                User.id != user_id,
                User.role == 'admin',
                User.is_active == True,
                User.status != 'rejected'
            ).scalar() or 0
            if other_admins == 0:
                return jsonify({'error': 'Não é possível excluir o último administrador ativo'}), 400

        # Verificar vínculos obrigatórios para evitar falhas de FK
        from models.content import Content
        from models.campaign import Campaign
        content_count = db.session.query(db.func.count(Content.id)).filter(Content.user_id == user_id).scalar() or 0
        campaign_count = db.session.query(db.func.count(Campaign.id)).filter(Campaign.user_id == user_id).scalar() or 0
        if content_count > 0 or campaign_count > 0:
            return jsonify({'error': f'Usuário possui {int(content_count)} conteúdos e {int(campaign_count)} campanhas vinculados. Transfira a propriedade ou exclua-os antes.'}), 409

        db.session.delete(user)
        db.session.commit()
        return jsonify({'message': 'Usuário excluído com sucesso'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/users/<user_id>/set-password', methods=['POST'])
@jwt_required()
def admin_set_password(user_id):
    """Permite que ADMIN redefina a senha de qualquer usuário sem a senha atual.
    Body: { "new_password": "...", "must_change_password": bool }
    """
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Apenas administradores podem definir senha de usuários'}), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        data = request.get_json() or {}
        new_password = (data.get('new_password') or '').strip()
        must_change = bool(data.get('must_change_password', False))
        
        if not new_password or len(new_password) < 6:
            return jsonify({'error': 'Nova senha é obrigatória e deve ter ao menos 6 caracteres'}), 400
        
        user.password_hash = generate_password_hash(new_password)
        user.must_change_password = must_change
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Senha definida com sucesso',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = request.get_json() or {}
        email = (data.get('email') or '').strip().lower()
        if not email:
            return jsonify({'error': 'Email é obrigatório'}), 400
        
        # Opcionalmente localizar o usuário, mas não revelar existência
        _user = User.query.filter(db.func.lower(User.email) == email).first()
        # Aqui poderíamos gerar um token e enviar email. Por ora, apenas retornar mensagem genérica.
        return jsonify({
            'message': 'Se este email estiver cadastrado, enviaremos instruções para redefinir a senha.'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/companies', methods=['GET'])
@jwt_required()
def list_companies():
    """Lista de empresas conhecidas no sistema (distintas de usuários e empresas)."""
    try:
        # Coletar companies distintas de Users e Locations
        from models.location import Location  # import interno para evitar ciclos
        user_companies = [row[0] for row in db.session.query(distinct(User.company)).all()]
        location_companies = [row[0] for row in db.session.query(distinct(Location.company)).all()]

        # Empresas padrão conhecidas do sistema
        default_companies = ['iTracker', 'Rio Brasil Terminal - RBT', 'CLIA']

        # Unificar, remover vazios/nulos e incluir defaults
        base_set = {c.strip() for c in (user_companies + location_companies) if c and str(c).strip()}
        companies = sorted(base_set.union(default_companies))

        return jsonify({'companies': companies}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
