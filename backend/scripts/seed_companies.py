import os
import sys
from pathlib import Path

# Garantir que o diretório raiz do backend (um nível acima) esteja no sys.path
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Usar o banco correto: priorizar instance/tvs_platform.db quando disponível
if not os.environ.get('DATABASE_URL'):
    try:
        instance_db = BACKEND_ROOT / 'instance' / 'tvs_platform.db'
        root_db = BACKEND_ROOT / 'tvs_platform.db'
        if instance_db.exists() and instance_db.stat().st_size > 0:
            os.environ['DATABASE_URL'] = f"sqlite:///{instance_db.as_posix()}"
        elif root_db.exists():
            os.environ['DATABASE_URL'] = f"sqlite:///{root_db.as_posix()}"
    except Exception:
        pass

from app import app
from database import db
from models.user import User
from models.location import Location

# Empresas que devem estar sempre disponíveis no /api/public/companies
TARGET_COMPANIES = [
    'iTracker',
    'Rio Brasil Terminal - RBT',
    'CLIA',
]

# Metadados mínimos para criar uma Location por empresa (campos obrigatórios: name, city, state)
SEED_LOCATIONS = {
    'iTracker': {
        'name': 'Default - iTracker',
        'city': 'São Paulo',
        'state': 'SP',
        'address': 'Seed para expor empresa no registro público',
    },
    'Rio Brasil Terminal - RBT': {
        'name': 'Default - RBT',
        'city': 'Rio de Janeiro',
        'state': 'RJ',
        'address': 'Seed para expor empresa no registro público',
    },
    'CLIA': {
        'name': 'Default - CLIA',
        'city': 'Santos',
        'state': 'SP',
        'address': 'Seed para expor empresa no registro público',
    },
}


def get_existing_companies():
    """Lê as empresas já presentes nas tabelas Users e Locations (distintas)."""
    user_companies = [row[0] for row in db.session.query(db.func.distinct(User.company)).all()]
    location_companies = [row[0] for row in db.session.query(db.func.distinct(Location.company)).all()]
    existing = {
        str(c).strip() for c in (user_companies + location_companies) if c and str(c).strip()
    }
    return existing


def ensure_company_via_location(company: str) -> bool:
    """Garante que exista ao menos 1 Location com a empresa informada.
    Retorna True se criou, False se já existia.
    """
    exists = db.session.query(Location.id).filter(Location.company == company).first()
    if exists:
        print(f"OK: empresa '{company}' já presente (via Location).")
        return False

    meta = SEED_LOCATIONS.get(company)
    if not meta:
        # fallback básico, caso TARGET_COMPANIES tenha sido alterado sem atualizar SEED_LOCATIONS
        meta = {'name': f'Default - {company}', 'city': 'São Paulo', 'state': 'SP', 'address': ''}

    loc = Location(
        name=meta['name'],
        city=meta['city'],
        state=meta['state'],
        address=meta.get('address', ''),
        company=company,
        is_active=True,
    )
    db.session.add(loc)
    print(f"CRIADO: Location padrão para empresa '{company}'.")
    return True


def main():
    created = 0
    with app.app_context():
        # Opcional: criar tabelas que não existirem (não interfere em tabelas já criadas)
        try:
            db.create_all()
        except Exception:
            pass

        existing = get_existing_companies()
        targets = set(TARGET_COMPANIES)
        missing = sorted(targets - existing)

        if not missing:
            print('Nenhuma empresa faltando. Nada a fazer.')
            return 0

        print('Empresas existentes:', ', '.join(sorted(existing)) or '—')
        print('Empresas alvo     :', ', '.join(sorted(target)))
        print('Empresas ausentes :', ', '.join(missing))

        for company in missing:
            if ensure_company_via_location(company):
                created += 1

        if created:
            db.session.commit()
            print(f'OK: {created} registro(s) criado(s).')
        else:
            print('Nenhuma alteração realizada.')

    return 0


if __name__ == '__main__':
    sys.exit(main())
