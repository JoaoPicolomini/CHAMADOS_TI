-- ============================================================
-- SEEDS — Sistema de Chamados de T.I
-- Dados iniciais: categorias, permissões, SLA, config
-- ============================================================

-- ─── CATEGORIAS RAIZ ──────────────────────────────────────────
INSERT INTO ti_categorias (id, nome, slug, categoria_pai, icone, descricao, ordem) VALUES
  ('00000000-0000-0000-0000-000000000101', 'Hardware',              'hardware',        NULL, 'Monitor',    'Problemas com equipamentos físicos',                 1),
  ('00000000-0000-0000-0000-000000000102', 'Software',              'software',        NULL, 'Code',       'Problemas com programas e sistemas',                  2),
  ('00000000-0000-0000-0000-000000000103', 'Rede / Conectividade',  'rede',            NULL, 'Wifi',       'Problemas de internet, rede e acesso',                3),
  ('00000000-0000-0000-0000-000000000104', 'Acesso e Segurança',    'acesso',          NULL, 'ShieldCheck','Criação de usuários, senhas e permissões',            4),
  ('00000000-0000-0000-0000-000000000105', 'E-mail / Comunicação',  'email',           NULL, 'Mail',       'Outlook, Teams, videoconferência e e-mail',           5),
  ('00000000-0000-0000-0000-000000000106', 'Infraestrutura',        'infra',           NULL, 'Server',     'Servidores, backup, storage e datacenter',            6),
  ('00000000-0000-0000-0000-000000000107', 'Solicitação de Serviço','solicitacao',     NULL, 'ClipboardList','Pedidos de novos equipamentos, configuração',       7)
ON CONFLICT (slug) DO NOTHING;

-- ─── SUBCATEGORIAS — Hardware ─────────────────────────────────
INSERT INTO ti_categorias (id, nome, slug, categoria_pai, icone, ordem) VALUES
  ('00000000-0000-0000-0000-000000000201', 'Computador / Desktop',   'hardware-desktop',   '00000000-0000-0000-0000-000000000101', 'Cpu',            1),
  ('00000000-0000-0000-0000-000000000202', 'Notebook / Laptop',      'hardware-notebook',  '00000000-0000-0000-0000-000000000101', 'Laptop',         2),
  ('00000000-0000-0000-0000-000000000203', 'Monitor',                'hardware-monitor',   '00000000-0000-0000-0000-000000000101', 'Monitor',        3),
  ('00000000-0000-0000-0000-000000000204', 'Impressora / Scanner',   'hardware-impressora','00000000-0000-0000-0000-000000000101', 'Printer',        4),
  ('00000000-0000-0000-0000-000000000205', 'Teclado / Mouse',        'hardware-periferico','00000000-0000-0000-0000-000000000101', 'Mouse',          5),
  ('00000000-0000-0000-0000-000000000206', 'Telefone / Ramal',       'hardware-telefone',  '00000000-0000-0000-0000-000000000101', 'Phone',          6),
  ('00000000-0000-0000-0000-000000000207', 'Outros Hardware',        'hardware-outros',    '00000000-0000-0000-0000-000000000101', 'HardDrive',      7)
ON CONFLICT (slug) DO NOTHING;

-- ─── SUBCATEGORIAS — Software ─────────────────────────────────
INSERT INTO ti_categorias (id, nome, slug, categoria_pai, icone, ordem) VALUES
  ('00000000-0000-0000-0000-000000000211', 'Instalação / Atualização', 'software-instalacao', '00000000-0000-0000-0000-000000000102', 'Download',     1),
  ('00000000-0000-0000-0000-000000000212', 'Erro / Travamento',        'software-erro',       '00000000-0000-0000-0000-000000000102', 'AlertTriangle',2),
  ('00000000-0000-0000-0000-000000000213', 'Licença de Software',      'software-licenca',    '00000000-0000-0000-0000-000000000102', 'Key',          3),
  ('00000000-0000-0000-0000-000000000214', 'ERP / Sistema interno',    'software-erp',        '00000000-0000-0000-0000-000000000102', 'Database',     4),
  ('00000000-0000-0000-0000-000000000215', 'Antivírus / Segurança',    'software-antivirus',  '00000000-0000-0000-0000-000000000102', 'Shield',       5),
  ('00000000-0000-0000-0000-000000000216', 'Outros Software',          'software-outros',     '00000000-0000-0000-0000-000000000102', 'Package',      6)
ON CONFLICT (slug) DO NOTHING;

-- ─── SUBCATEGORIAS — Rede ─────────────────────────────────────
INSERT INTO ti_categorias (id, nome, slug, categoria_pai, icone, ordem) VALUES
  ('00000000-0000-0000-0000-000000000221', 'Sem internet',            'rede-sem-internet',  '00000000-0000-0000-0000-000000000103', 'WifiOff',      1),
  ('00000000-0000-0000-0000-000000000222', 'Lentidão na rede',        'rede-lentidao',      '00000000-0000-0000-0000-000000000103', 'Activity',     2),
  ('00000000-0000-0000-0000-000000000223', 'VPN / Acesso remoto',     'rede-vpn',           '00000000-0000-0000-0000-000000000103', 'Lock',         3),
  ('00000000-0000-0000-0000-000000000224', 'Acesso a pasta / servidor','rede-pasta',        '00000000-0000-0000-0000-000000000103', 'FolderOpen',   4),
  ('00000000-0000-0000-0000-000000000225', 'Wi-Fi',                   'rede-wifi',          '00000000-0000-0000-0000-000000000103', 'Wifi',         5),
  ('00000000-0000-0000-0000-000000000226', 'Outros Rede',             'rede-outros',        '00000000-0000-0000-0000-000000000103', 'Network',      6)
ON CONFLICT (slug) DO NOTHING;

-- ─── SUBCATEGORIAS — Acesso e Segurança ───────────────────────
INSERT INTO ti_categorias (id, nome, slug, categoria_pai, icone, ordem) VALUES
  ('00000000-0000-0000-0000-000000000231', 'Reset de senha',          'acesso-senha',       '00000000-0000-0000-0000-000000000104', 'KeyRound',     1),
  ('00000000-0000-0000-0000-000000000232', 'Criação de usuário',      'acesso-criacao',     '00000000-0000-0000-0000-000000000104', 'UserPlus',     2),
  ('00000000-0000-0000-0000-000000000233', 'Permissão de acesso',     'acesso-permissao',   '00000000-0000-0000-0000-000000000104', 'Unlock',       3),
  ('00000000-0000-0000-0000-000000000234', 'Bloqueio / Desbloqueio',  'acesso-bloqueio',    '00000000-0000-0000-0000-000000000104', 'UserX',        4),
  ('00000000-0000-0000-0000-000000000235', 'Certificado digital',     'acesso-certificado', '00000000-0000-0000-0000-000000000104', 'Award',        5)
ON CONFLICT (slug) DO NOTHING;

-- ─── SUBCATEGORIAS — E-mail / Comunicação ─────────────────────
INSERT INTO ti_categorias (id, nome, slug, categoria_pai, icone, ordem) VALUES
  ('00000000-0000-0000-0000-000000000241', 'Outlook / Exchange',      'email-outlook',      '00000000-0000-0000-0000-000000000105', 'Mail',         1),
  ('00000000-0000-0000-0000-000000000242', 'Microsoft Teams',         'email-teams',        '00000000-0000-0000-0000-000000000105', 'MessageSquare',2),
  ('00000000-0000-0000-0000-000000000243', 'Videoconferência',        'email-video',        '00000000-0000-0000-0000-000000000105', 'Video',        3),
  ('00000000-0000-0000-0000-000000000244', 'Outros Comunicação',      'email-outros',       '00000000-0000-0000-0000-000000000105', 'MessageCircle',4)
ON CONFLICT (slug) DO NOTHING;

-- ─── SUBCATEGORIAS — Infraestrutura ───────────────────────────
INSERT INTO ti_categorias (id, nome, slug, categoria_pai, icone, ordem) VALUES
  ('00000000-0000-0000-0000-000000000251', 'Servidor',                'infra-servidor',     '00000000-0000-0000-0000-000000000106', 'Server',       1),
  ('00000000-0000-0000-0000-000000000252', 'Backup / Restauração',    'infra-backup',       '00000000-0000-0000-0000-000000000106', 'HardDrive',    2),
  ('00000000-0000-0000-0000-000000000253', 'Storage / Arquivos',      'infra-storage',      '00000000-0000-0000-0000-000000000106', 'Archive',      3),
  ('00000000-0000-0000-0000-000000000254', 'Outros Infra',            'infra-outros',       '00000000-0000-0000-0000-000000000106', 'Settings',     4)
ON CONFLICT (slug) DO NOTHING;

-- ─── SUBCATEGORIAS — Solicitação de Serviço ───────────────────
INSERT INTO ti_categorias (id, nome, slug, categoria_pai, icone, ordem) VALUES
  ('00000000-0000-0000-0000-000000000261', 'Novo equipamento',        'solic-equipamento',  '00000000-0000-0000-0000-000000000107', 'PackagePlus',  1),
  ('00000000-0000-0000-0000-000000000262', 'Configuração de sistema', 'solic-config',       '00000000-0000-0000-0000-000000000107', 'Settings2',    2),
  ('00000000-0000-0000-0000-000000000263', 'Consultoria / Treinamento','solic-treinamento', '00000000-0000-0000-0000-000000000107', 'GraduationCap',3),
  ('00000000-0000-0000-0000-000000000264', 'Outras Solicitações',     'solic-outros',       '00000000-0000-0000-0000-000000000107', 'ClipboardList',4)
ON CONFLICT (slug) DO NOTHING;

-- ─── EQUIPES PADRÃO ───────────────────────────────────────────
INSERT INTO ti_equipes (id, nome, descricao, nivel) VALUES
  ('00000000-0000-0000-0001-000000000001', 'Suporte N1',         'Atendimento de primeiro nível — incidentes comuns',       1),
  ('00000000-0000-0000-0001-000000000002', 'Suporte N2',         'Segundo nível — problemas técnicos avançados',            2),
  ('00000000-0000-0000-0001-000000000003', 'Infraestrutura',     'Servidores, redes e infraestrutura de TI',                3),
  ('00000000-0000-0000-0001-000000000004', 'Segurança da Informação', 'Segurança, acessos e conformidade',                 3),
  ('00000000-0000-0000-0001-000000000005', 'Suporte a Sistemas', 'ERP, sistemas internos e integrações',                   2)
ON CONFLICT DO NOTHING;

-- ─── SLA PADRÃO (sem categoria específica) ────────────────────
-- Prioridade Crítica: 4h
INSERT INTO ti_sla_configs (prioridade, categoria_id, prazo_horas, horario_comercial) VALUES
  ('critica', NULL, 4,  false),
  ('alta',    NULL, 8,  true),
  ('media',   NULL, 24, true),
  ('baixa',   NULL, 72, true)
ON CONFLICT (prioridade, categoria_id) DO NOTHING;

-- ─── PERMISSÕES DO SISTEMA ────────────────────────────────────
INSERT INTO ti_permissions (code, label, descricao) VALUES
  ('dashboard.view',        'Ver Painel',               'Visualizar o painel de chamados'),
  ('chamado.view.own',      'Ver Próprios Chamados',    'Ver apenas os chamados criados por si'),
  ('chamado.view.all',      'Ver Todos os Chamados',    'Ver todos os chamados do sistema'),
  ('chamado.create',        'Abrir Chamado',            'Abrir novos chamados'),
  ('chamado.assign',        'Atribuir Chamado',         'Atribuir chamados a técnicos/equipes'),
  ('chamado.resolve',       'Resolver Chamado',         'Marcar chamados como resolvidos'),
  ('chamado.close',         'Fechar Chamado',           'Fechar ou cancelar chamados'),
  ('chamado.reopen',        'Reabrir Chamado',          'Reabrir chamados fechados'),
  ('chamado.escalate',      'Escalar Chamado',          'Escalar chamados entre níveis'),
  ('comentario.interno',    'Comentário Interno',       'Criar comentários internos (visível só para técnicos)'),
  ('analytics.view',        'Ver Analytics',            'Acessar relatórios e análises'),
  ('kb.view',               'Ver Base de Conhecimento', 'Ler artigos da base de conhecimento'),
  ('kb.manage',             'Gerenciar KB',             'Criar e editar artigos da base de conhecimento'),
  ('ativos.view',           'Ver Ativos',               'Visualizar inventário de ativos de TI'),
  ('ativos.manage',         'Gerenciar Ativos',         'Cadastrar e editar ativos de TI'),
  ('users.manage',          'Gerenciar Usuários',       'Adicionar e editar usuários do sistema'),
  ('equipes.manage',        'Gerenciar Equipes',        'Gerenciar equipes e técnicos'),
  ('config.view',           'Ver Configurações',        'Acessar configurações do sistema'),
  ('config.manage',         'Gerenciar Configurações',  'Alterar configurações de SLA e sistema'),
  ('audit.view',            'Ver Auditoria',            'Acessar logs e trilha de auditoria'),
  ('email.logs.view',       'Ver Logs de E-mail',       'Visualizar log de notificações')
ON CONFLICT (code) DO NOTHING;

-- ─── PERMISSÕES POR PERFIL ────────────────────────────────────

-- user: apenas abrir e acompanhar próprios chamados
INSERT INTO ti_profile_permissions (perfil, permission) VALUES
  ('user', 'chamado.create'),
  ('user', 'chamado.view.own'),
  ('user', 'kb.view')
ON CONFLICT (perfil, permission) DO NOTHING;

-- tecnico: atendimento completo
INSERT INTO ti_profile_permissions (perfil, permission) VALUES
  ('tecnico', 'dashboard.view'),
  ('tecnico', 'chamado.view.all'),
  ('tecnico', 'chamado.create'),
  ('tecnico', 'chamado.assign'),
  ('tecnico', 'chamado.resolve'),
  ('tecnico', 'chamado.close'),
  ('tecnico', 'chamado.reopen'),
  ('tecnico', 'chamado.escalate'),
  ('tecnico', 'comentario.interno'),
  ('tecnico', 'kb.view'),
  ('tecnico', 'kb.manage'),
  ('tecnico', 'ativos.view')
ON CONFLICT (perfil, permission) DO NOTHING;

-- gestor_ti: tudo do técnico + analytics + config
INSERT INTO ti_profile_permissions (perfil, permission) VALUES
  ('gestor_ti', 'dashboard.view'),
  ('gestor_ti', 'chamado.view.all'),
  ('gestor_ti', 'chamado.create'),
  ('gestor_ti', 'chamado.assign'),
  ('gestor_ti', 'chamado.resolve'),
  ('gestor_ti', 'chamado.close'),
  ('gestor_ti', 'chamado.reopen'),
  ('gestor_ti', 'chamado.escalate'),
  ('gestor_ti', 'comentario.interno'),
  ('gestor_ti', 'analytics.view'),
  ('gestor_ti', 'kb.view'),
  ('gestor_ti', 'kb.manage'),
  ('gestor_ti', 'ativos.view'),
  ('gestor_ti', 'ativos.manage'),
  ('gestor_ti', 'equipes.manage'),
  ('gestor_ti', 'config.view'),
  ('gestor_ti', 'config.manage'),
  ('gestor_ti', 'audit.view'),
  ('gestor_ti', 'email.logs.view')
ON CONFLICT (perfil, permission) DO NOTHING;

-- admin: tudo
INSERT INTO ti_profile_permissions (perfil, permission)
SELECT 'admin', code FROM ti_permissions
ON CONFLICT (perfil, permission) DO NOTHING;

-- ─── CONFIG SATISFAÇÃO ────────────────────────────────────────
INSERT INTO ti_satisfacao_config (ativa, horas_apos_fechamento, lembrete_horas, max_lembretes)
VALUES (true, 1, 24, 2);

-- ─── PRIMEIRO USUÁRIO ADMIN ───────────────────────────────────
INSERT INTO ti_access_users (email, nome, cargo, perfil, ativo)
VALUES ('admin@dominio.com.br', 'Administrador do Sistema', 'Administrador TI', 'admin', true)
ON CONFLICT (email) DO NOTHING;

