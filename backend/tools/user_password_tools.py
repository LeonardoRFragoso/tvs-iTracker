#!/usr/bin/env python3
import argparse
import os
import shutil
import sqlite3
import sys
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import csv


def backup_db(db_path: str) -> str:
    if not os.path.exists(db_path):
        print(f"[ERRO] Banco não encontrado: {db_path}")
        sys.exit(2)
    ts = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    backup_path = f"{db_path}.backup_{ts}"
    shutil.copy2(db_path, backup_path)
    print(f"[BACKUP] Copiado DB para: {backup_path}")
    return backup_path


def connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    # Garantir respostas consistentes
    try:
        conn.execute('PRAGMA foreign_keys = ON;')
    except Exception:
        pass
    return conn


def verify_user(conn: sqlite3.Connection, identifier: str, password: str) -> int:
    """Verifica a senha de um usuário (identifier = email OU username).
    Return codes:
      0 -> senha confere
      1 -> senha não confere
      2 -> usuário não encontrado
      3 -> erro ao verificar hash
    """
    identifier = (identifier or '').strip()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, username, email, password_hash, role, status, is_active
        FROM users
        WHERE lower(email) = lower(?) OR lower(username) = lower(?)
        """,
        (identifier, identifier),
    )
    row = cur.fetchone()
    if not row:
        print("[INFO] Usuário não encontrado (por email/username):", identifier)
        return 2

    ok = False
    try:
        ok = check_password_hash(row["password_hash"], password)
    except Exception as e:
        print("[ERRO] Falha ao verificar hash:", e)
        return 3

    print(
        f"Usuário: {row['username']} | Email: {row['email']} | Papel: {row['role']} | "
        f"Ativo: {row['is_active']} | Status: {row['status']}"
    )
    print("Senha confere? ->", "SIM" if ok else "NÃO")
    return 0 if ok else 1


def reset_hr_passwords(conn: sqlite3.Connection, new_password: str, must_change: bool = True) -> int:
    """Redefine a senha de TODOS os usuários com papel RH (role='rh')."""
    cur = conn.cursor()
    cur.execute("SELECT id, username, email FROM users WHERE lower(role) = 'rh'")
    rows = cur.fetchall()
    if not rows:
        print("[INFO] Nenhum usuário RH encontrado.")
        return 0

    new_hash = generate_password_hash(new_password)
    updated_at = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    total = 0
    for row in rows:
        try:
            cur.execute(
                """
                UPDATE users
                SET password_hash = ?, must_change_password = ?, updated_at = ?
                WHERE id = ?
                """,
                (new_hash, 1 if must_change else 0, updated_at, row["id"]),
            )
            total += cur.rowcount
            print(f"[OK] Atualizado: {row['username']} ({row['email']})")
        except sqlite3.OperationalError as e:
            # Caso a coluna must_change_password não exista no banco atual
            if "no such column: must_change_password" in str(e).lower():
                cur.execute(
                    """
                    UPDATE users
                    SET password_hash = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (new_hash, updated_at, row["id"]),
                )
                total += cur.rowcount
                print(
                    f"[WARN] Coluna must_change_password ausente; atualizada apenas a senha de {row['username']} ({row['email']})"
                )
            else:
                raise

    conn.commit()
    print(f"[RESUMO] Senha atualizada para {total} usuário(s) RH.")
    return total


def list_users(conn: sqlite3.Connection, role: str | None = None) -> int:
    cur = conn.cursor()
    if role:
        cur.execute(
            """
            SELECT id, username, email, role, status, is_active
            FROM users
            WHERE lower(role) = lower(?)
            ORDER BY role, username
            """,
            (role,),
        )
    else:
        cur.execute(
            """
            SELECT id, username, email, role, status, is_active
            FROM users
            ORDER BY role, username
            """
        )
    rows = cur.fetchall()
    if not rows:
        print("[INFO] Nenhum usuário encontrado.")
        return 0
    for r in rows:
        print(f"{r['id']} | {r['username']} | {r['email']} | {r['role']} | {r['status']} | ativo={r['is_active']}")
    print(f"[RESUMO] {len(rows)} usuário(s).")
    return len(rows)


def reset_user_password(conn: sqlite3.Connection, identifier: str, new_password: str, must_change: bool = True) -> int:
    identifier = (identifier or '').strip()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, username, email FROM users
        WHERE lower(email) = lower(?) OR lower(username) = lower(?)
        """,
        (identifier, identifier),
    )
    row = cur.fetchone()
    if not row:
        print("[INFO] Usuário não encontrado (por email/username):", identifier)
        return 0
    new_hash = generate_password_hash(new_password)
    updated_at = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    try:
        cur.execute(
            """
            UPDATE users
            SET password_hash = ?, must_change_password = ?, updated_at = ?
            WHERE id = ?
            """,
            (new_hash, 1 if must_change else 0, updated_at, row["id"]),
        )
    except sqlite3.OperationalError as e:
        if "no such column: must_change_password" in str(e).lower():
            cur.execute(
                """
                UPDATE users
                SET password_hash = ?, updated_at = ?
                WHERE id = ?
                """,
                (new_hash, updated_at, row["id"]),
            )
        else:
            raise
    conn.commit()
    print(f"[OK] Senha atualizada para: {row['username']} ({row['email']})")
    return 1


def set_user_company(conn: sqlite3.Connection, identifier: str, company: str) -> int:
    """Atualiza o campo company de um usuário (identifier = email OU username)."""
    identifier = (identifier or '').strip()
    company = (company or '').strip()
    if not identifier or not company:
        print('[ERRO] identifier e company são obrigatórios')
        return 0
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, username, email, company FROM users
            WHERE lower(email) = lower(?) OR lower(username) = lower(?)
            """,
            (identifier, identifier),
        )
    except sqlite3.OperationalError as e:
        if 'no such column: company' in str(e).lower():
            print('[ERRO] A coluna company não existe na tabela users neste banco. Rode a aplicação para migração automática ou adicione a coluna manualmente.')
            return 0
        raise
    row = cur.fetchone()
    if not row:
        print('[INFO] Usuário não encontrado:', identifier)
        return 0
    cur.execute("UPDATE users SET company = ?, updated_at = ? WHERE id = ?", (company, datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'), row['id']))
    conn.commit()
    print(f"[OK] company atualizado para '{company}' em {row['username']} ({row['email']})")
    return 1


def bulk_set_company_from_csv(conn: sqlite3.Connection, csv_path: str) -> int:
    """Atualiza company de múltiplos usuários a partir de um CSV com colunas: identifier,company"""
    if not os.path.exists(csv_path):
        print('[ERRO] CSV não encontrado:', csv_path)
        return 0
    total = 0
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        if not {'identifier', 'company'}.issubset(set(h.strip() for h in reader.fieldnames or [])):
            print('[ERRO] CSV deve conter cabeçalhos: identifier,company')
            return 0
        for row in reader:
            ident = (row.get('identifier') or '').strip()
            comp = (row.get('company') or '').strip()
            if not ident or not comp:
                print('[WARN] Linha ignorada (identifier/company vazio):', row)
                continue
            try:
                total += set_user_company(conn, ident, comp)
            except Exception as e:
                print(f"[ERRO] Falha ao atualizar '{ident}': {e}")
    print(f'[RESUMO] Atualizados {total} usuário(s).')
    return total


def list_companies(conn: sqlite3.Connection) -> int:
    """Lista empresas distintas a partir de users.company e locations.company"""
    cur = conn.cursor()
    companies = set()
    # Users
    try:
        cur.execute("SELECT DISTINCT company FROM users")
        for r in cur.fetchall():
            c = r[0]
            if c and str(c).strip():
                companies.add(str(c).strip())
    except sqlite3.OperationalError:
        print('[WARN] Tabela/coluna users.company ausente neste banco.')
    # Locations
    try:
        cur.execute("SELECT DISTINCT company FROM locations")
        for r in cur.fetchall():
            c = r[0]
            if c and str(c).strip():
                companies.add(str(c).strip())
    except sqlite3.OperationalError:
        print('[WARN] Tabela/coluna locations.company ausente neste banco.')
    items = sorted(companies)
    if not items:
        print('[INFO] Nenhuma empresa encontrada. Exemplos: iTracker, Rio Brasil Terminal - RBT, CLIA')
        return 0
    for c in items:
        print('-', c)
    print(f'[RESUMO] {len(items)} empresa(s).')
    return len(items)


def main():
    parser = argparse.ArgumentParser(description="Ferramentas de senha (TVs iTracker)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_ver = sub.add_parser("verify", help="Verifica a senha de um usuário (por email ou username)")
    p_ver.add_argument("--db", required=True, help="Caminho do SQLite (ex: backend\\instance\\tvs_platform.db)")
    p_ver.add_argument("--identifier", required=True, help="Email OU username do usuário")
    p_ver.add_argument("--password", required=True, help="Senha a testar")

    p_reset = sub.add_parser("reset-hr", help="Redefine a senha de TODOS os usuários com papel RH")
    p_reset.add_argument("--db", required=True, help="Caminho do SQLite (ex: backend\\instance\\tvs_platform.db)")
    p_reset.add_argument("--new-password", required=True, help="Nova senha a aplicar")
    p_reset.add_argument(
        "--must-change",
        default="true",
        help="true/false (forçar troca no primeiro login). Padrão: true",
    )

    p_list = sub.add_parser("list-users", help="Lista usuários (opcionalmente filtrando por role)")
    p_list.add_argument("--db", required=True, help="Caminho do SQLite (ex: backend\\instance\\tvs_platform.db)")
    p_list.add_argument("--role", required=False, help="Filtrar por role (admin, manager, hr, user)")

    p_reset_user = sub.add_parser("reset-user", help="Redefine a senha de um único usuário por email/username")
    p_reset_user.add_argument("--db", required=True, help="Caminho do SQLite (ex: backend\\instance\\tvs_platform.db)")
    p_reset_user.add_argument("--identifier", required=True, help="Email OU username do usuário")
    p_reset_user.add_argument("--new-password", required=True, help="Nova senha a aplicar")
    p_reset_user.add_argument(
        "--must-change",
        default="true",
        help="true/false (forçar troca no primeiro login). Padrão: true",
    )

    p_set_company = sub.add_parser("set-company", help="Atualiza a empresa de um usuário por email/username")
    p_set_company.add_argument("--db", required=True, help="Caminho do SQLite (ex: backend\\instance\\tvs_platform.db)")
    p_set_company.add_argument("--identifier", required=True, help="Email OU username do usuário")
    p_set_company.add_argument("--company", required=True, help="Nome da empresa (ex: CLIA)")

    p_bulk_company = sub.add_parser("bulk-set-company", help="Atualiza empresas em lote a partir de CSV (identifier,company)")
    p_bulk_company.add_argument("--db", required=True, help="Caminho do SQLite (ex: backend\\instance\\tvs_platform.db)")
    p_bulk_company.add_argument("--csv", required=True, help="Caminho do CSV (UTF-8) com colunas: identifier,company")

    p_list_companies = sub.add_parser("list-companies", help="Lista empresas distintas (users/locations)")
    p_list_companies.add_argument("--db", required=True, help="Caminho do SQLite (ex: backend\\instance\\tvs_platform.db)")

    args = parser.parse_args()

    # Conectar
    conn = connect(args.db)

    if args.cmd == "verify":
        sys.exit(verify_user(conn, args.identifier.strip(), args.password))

    if args.cmd == "reset-hr":
        # Backup antes de alterar
        backup_db(args.db)
        must_change = str(args.must_change).strip().lower() in ("1", "true", "yes", "y", "sim", "s")
        reset_hr_passwords(conn, args.new_password, must_change)
        sys.exit(0)

    if args.cmd == "list-users":
        rc = list_users(conn, role=args.role)
        sys.exit(0 if rc >= 0 else 1)

    if args.cmd == "reset-user":
        backup_db(args.db)
        must_change = str(args.must_change).strip().lower() in ("1", "true", "yes", "y", "sim", "s")
        rc = reset_user_password(conn, args.identifier.strip(), args.new_password, must_change)
        sys.exit(0 if rc > 0 else 1)

    if args.cmd == "set-company":
        backup_db(args.db)
        rc = set_user_company(conn, args.identifier.strip(), args.company.strip())
        sys.exit(0 if rc > 0 else 1)

    if args.cmd == "bulk-set-company":
        backup_db(args.db)
        rc = bulk_set_company_from_csv(conn, args.csv)
        sys.exit(0 if rc > 0 else 1)

    if args.cmd == "list-companies":
        rc = list_companies(conn)
        sys.exit(0 if rc >= 0 else 1)


if __name__ == "__main__":
    main()
