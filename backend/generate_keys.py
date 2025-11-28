#!/usr/bin/env python3
"""
Script para gerar chaves de segurança para o arquivo .env
Uso: python generate_keys.py
"""

import secrets

def generate_keys():
    """Gera chaves seguras para SECRET_KEY e JWT_SECRET_KEY"""
    
    print("=" * 60)
    print("GERADOR DE CHAVES DE SEGURANÇA - TVS iTracker")
    print("=" * 60)
    print()
    
    # Gerar SECRET_KEY
    secret_key = secrets.token_urlsafe(32)
    print("🔐 SECRET_KEY (Flask):")
    print(f"SECRET_KEY={secret_key}")
    print()
    
    # Gerar JWT_SECRET_KEY
    jwt_secret_key = secrets.token_urlsafe(32)
    print("🔑 JWT_SECRET_KEY (Autenticação):")
    print(f"JWT_SECRET_KEY={jwt_secret_key}")
    print()
    
    print("=" * 60)
    print("📋 INSTRUÇÕES:")
    print("=" * 60)
    print("1. Copie as chaves acima")
    print("2. Cole no arquivo backend/.env")
    print("3. Substitua os valores existentes")
    print("4. NUNCA compartilhe estas chaves!")
    print("5. NUNCA commite o arquivo .env no Git!")
    print()
    print("⚠️  IMPORTANTE: Gere novas chaves para cada ambiente!")
    print("   - Desenvolvimento: um conjunto de chaves")
    print("   - Produção: outro conjunto de chaves (diferente!)")
    print()
    
    # Perguntar se quer salvar em arquivo
    try:
        save = input("Deseja salvar em um arquivo? (s/N): ").strip().lower()
        if save == 's':
            filename = ".env.keys"
            with open(filename, 'w') as f:
                f.write(f"SECRET_KEY={secret_key}\n")
                f.write(f"JWT_SECRET_KEY={jwt_secret_key}\n")
            print(f"✅ Chaves salvas em: {filename}")
            print(f"⚠️  Lembre-se de deletar este arquivo após copiar as chaves!")
    except KeyboardInterrupt:
        print("\n\n❌ Operação cancelada.")
    except Exception as e:
        print(f"\n❌ Erro ao salvar: {e}")

if __name__ == "__main__":
    generate_keys()
