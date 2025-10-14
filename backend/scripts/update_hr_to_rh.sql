-- =====================================================
-- MIGRAÇÃO DE TERMINOLOGIA: HR → RH (RECURSOS HUMANOS)
-- =====================================================
-- 
-- Este script atualiza todos os usuários com role 'hr' 
-- para 'rh' para usar a terminologia brasileira correta
--
-- Data: 13/10/2025
-- Motivo: Padronização para português brasileiro
-- =====================================================

-- 1. Verificar usuários atuais com role 'hr'
SELECT 
    'ANTES DA MIGRAÇÃO' as status,
    role,
    COUNT(*) as total_usuarios
FROM users 
WHERE role IN ('hr', 'rh')
GROUP BY role;

-- 2. Mostrar detalhes dos usuários que serão atualizados
SELECT 
    id,
    username,
    email,
    role,
    company,
    is_active,
    created_at
FROM users 
WHERE role = 'hr'
ORDER BY username;

-- 3. Atualizar role de 'hr' para 'rh'
UPDATE users 
SET 
    role = 'rh',
    updated_at = datetime('now')
WHERE role = 'hr';

-- 4. Verificar resultado da migração
SELECT 
    'APÓS A MIGRAÇÃO' as status,
    role,
    COUNT(*) as total_usuarios
FROM users 
WHERE role IN ('hr', 'rh')
GROUP BY role;

-- 5. Mostrar todos os usuários RH atualizados
SELECT 
    id,
    username,
    email,
    role,
    company,
    is_active,
    updated_at
FROM users 
WHERE role = 'rh'
ORDER BY username;

-- 6. Verificação final - não deve retornar nenhum registro
SELECT 
    COUNT(*) as usuarios_hr_restantes,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!'
        ELSE '❌ AINDA EXISTEM USUÁRIOS COM ROLE HR'
    END as status_migracao
FROM users 
WHERE role = 'hr';

-- =====================================================
-- INSTRUÇÕES DE USO:
-- =====================================================
-- 
-- 1. Faça backup do banco antes de executar
-- 2. Execute este script no SQLite do projeto
-- 3. Verifique os resultados das consultas
-- 4. Confirme que não há mais usuários com role 'hr'
--
-- COMANDO PARA EXECUTAR:
-- sqlite3 backend/instance/tvs_platform.db < backend/scripts/update_hr_to_rh.sql
-- =====================================================
