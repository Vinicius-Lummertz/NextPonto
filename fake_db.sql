-- Inserindo 10 estagiários com perfis variados
INSERT IGNORE INTO estagiarios (nome_usuario, jornada_diaria, data_contratacao, status) 
VALUES 
    -- 1. Admin/Dev base
    ('Vinicius Gomes', 6, '2025-01-01', 'ATIVO'),
    ('Dev.Local', 6, '2026-01-15', 'ATIVO'),
    -- 2. Veterana Super Pontual (1 ano de casa, certinha)
    ('Ana Pontual', 6, '2025-02-10', 'ATIVO'),
    -- 3. Vive Atrasado e devendo horas
    ('Carlos Atrasado', 8, '2025-08-01', 'ATIVO'),
    -- 4. Novato que chegou há menos de 1 semana
    ('Joao Novato', 4, '2026-03-05', 'ATIVO'),
    -- 5. Estagiário em Férias
    ('Maria Ferias', 6, '2024-01-10', 'FERIAS'),
    -- 6. O cara das Horas Extras (sempre sai mais tarde)
    ('Lucas Hora Extra', 6, '2025-11-20', 'ATIVO'),
    -- 7. Estagiária com muitas faltas injustificadas
    ('Juliana Faltante', 8, '2025-02-15', 'ATIVO'),
    -- 8. Demora 2 horas no almoço todo dia (devendo horas de almoço)
    ('Pedro Almoco Longo', 8, '2025-09-01', 'ATIVO'),
    -- 9. Horários cravados (Robô de 4h)
    ('Fernanda Certinha', 4, '2025-12-01', 'ATIVO');

-- Criação da Tabele de justificativas (Atestados)
CREATE TABLE IF NOT EXISTS justificativas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(150),
    data_falta DATE,
    motivo TEXT,
    anexo_path TEXT,
    status_aprovacao ENUM('PENDENTE', 'APROVADA', 'RECUSADA') DEFAULT 'PENDENTE'
);

-- Inserindo justificativas fakes
INSERT INTO justificativas (username, data_falta, motivo, anexo_path, status_aprovacao) 
VALUES 
    ('Joao Novato', '2026-03-06', 'Dengue, precisei ir no postinho de saúde.', 'C:\\Users\\Public\\atestado_dengue.pdf', 'PENDENTE'),
    ('Juliana Faltante', '2026-03-03', 'Problemas familiares.', NULL, 'PENDENTE'),
    ('Carlos Atrasado', '2026-03-02', 'Pneu furou na chuva', 'C:\\Users\\Public\\foto_pneu.jpg', 'RECUSADA');

-- INSERTS DE ponto PARA GERAR O ANALYTICS (Referência: Março 2026, dias 2 a 6)
-- (Vamos limpar dados testes antigos desses dias para não dar erro)
DELETE FROM ponto WHERE data >= '2026-03-01' AND data <= '2026-03-09' AND username != 'Vinicius Gomes' AND username != 'Dev.Local';

-- Ana Pontual (6h) - Perfeita (0 atrasos)
INSERT INTO ponto (username, data, entrada, almoco_saida, almoco_retorno, saida_final) VALUES
('Ana Pontual', '2026-03-02', '2026-03-02 08:00:00', '2026-03-02 12:00:00', '2026-03-02 13:00:00', '2026-03-02 15:00:00'),
('Ana Pontual', '2026-03-03', '2026-03-03 08:00:00', '2026-03-03 12:00:00', '2026-03-03 13:00:00', '2026-03-03 15:00:00'),
('Ana Pontual', '2026-03-04', '2026-03-04 08:00:00', '2026-03-04 12:00:00', '2026-03-04 13:00:00', '2026-03-04 15:00:00'),
('Ana Pontual', '2026-03-05', '2026-03-05 08:00:00', '2026-03-05 12:00:00', '2026-03-05 13:00:00', '2026-03-05 15:00:00'),
('Ana Pontual', '2026-03-06', '2026-03-06 08:00:00', '2026-03-06 12:00:00', '2026-03-06 13:00:00', '2026-03-06 15:00:00');

-- Carlos Atrasado (8h) - Chega muito atrasado (9h+, deve sair as 17h, mas sai devendo horas)
INSERT INTO ponto (username, data, entrada, almoco_saida, almoco_retorno, saida_final) VALUES
('Carlos Atrasado', '2026-03-03', '2026-03-03 09:15:00', '2026-03-03 12:00:00', '2026-03-03 13:00:00', '2026-03-03 17:30:00'),
('Carlos Atrasado', '2026-03-04', '2026-03-04 08:45:00', '2026-03-04 12:00:00', '2026-03-04 13:00:00', '2026-03-04 17:00:00'),
('Carlos Atrasado', '2026-03-05', '2026-03-05 08:30:00', '2026-03-05 12:00:00', '2026-03-05 13:00:00', '2026-03-05 17:00:00'),
('Carlos Atrasado', '2026-03-06', '2026-03-06 09:00:00', '2026-03-06 12:00:00', '2026-03-06 13:00:00', '2026-03-06 16:30:00');
-- Deixou de vir no dia 2! Falta injustificada + Justificativa do dia 2 recusada.

-- Joao Novato (4h) - Entrou no meio da semana, os dias antigos devem perdoar ele.
INSERT INTO ponto (username, data, entrada, almoco_saida, almoco_retorno, saida_final) VALUES
('Joao Novato', '2026-03-05', '2026-03-05 08:00:00', NULL, NULL, '2026-03-05 12:00:00');
-- Falta dia 6 (Atestado mandado pra gestão)

-- Lucas Hora Extra (6h) - Trabalha mais do que devia
INSERT INTO ponto (username, data, entrada, almoco_saida, almoco_retorno, saida_final) VALUES
('Lucas Hora Extra', '2026-03-02', '2026-03-02 08:00:00', '2026-03-02 12:00:00', '2026-03-02 13:00:00', '2026-03-02 17:30:00'),
('Lucas Hora Extra', '2026-03-03', '2026-03-03 08:00:00', '2026-03-03 12:00:00', '2026-03-03 13:00:00', '2026-03-03 18:00:00'),
('Lucas Hora Extra', '2026-03-04', '2026-03-04 07:45:00', '2026-03-04 12:00:00', '2026-03-04 13:00:00', '2026-03-04 17:00:00'),
('Lucas Hora Extra', '2026-03-05', '2026-03-05 08:00:00', '2026-03-05 12:00:00', '2026-03-05 13:00:00', '2026-03-05 17:00:00'),
('Lucas Hora Extra', '2026-03-06', '2026-03-06 08:00:00', '2026-03-06 12:00:00', '2026-03-06 13:00:00', '2026-03-06 16:00:00');

-- Juliana Faltante (8h) - Veio só 2 vezes na semana
INSERT INTO ponto (username, data, entrada, almoco_saida, almoco_retorno, saida_final) VALUES
('Juliana Faltante', '2026-03-04', '2026-03-04 08:00:00', '2026-03-04 12:00:00', '2026-03-04 13:00:00', '2026-03-04 17:00:00'),
('Juliana Faltante', '2026-03-05', '2026-03-05 08:00:00', '2026-03-05 12:00:00', '2026-03-05 13:00:00', '2026-03-05 17:00:00');

-- Pedro Almoco Longo (8h) - Excede em muito o horário de retorno e acaba devendo o total de horas
INSERT INTO ponto (username, data, entrada, almoco_saida, almoco_retorno, saida_final) VALUES
('Pedro Almoco Longo', '2026-03-02', '2026-03-02 08:00:00', '2026-03-02 12:00:00', '2026-03-02 14:00:00', '2026-03-02 17:00:00'),
('Pedro Almoco Longo', '2026-03-03', '2026-03-03 08:00:00', '2026-03-03 12:00:00', '2026-03-03 14:15:00', '2026-03-03 17:00:00'),
('Pedro Almoco Longo', '2026-03-04', '2026-03-04 08:00:00', '2026-03-04 12:00:00', '2026-03-04 14:30:00', '2026-03-04 17:00:00'),
('Pedro Almoco Longo', '2026-03-05', '2026-03-05 08:00:00', '2026-03-05 12:00:00', '2026-03-05 14:00:00', '2026-03-05 17:00:00'),
('Pedro Almoco Longo', '2026-03-06', '2026-03-06 08:00:00', '2026-03-06 12:00:00', '2026-03-06 14:00:00', '2026-03-06 17:00:00');

-- Fernanda Certinha (4h) - Turno da Tarde (Apenas bater o ponto, sem almoço)
INSERT INTO ponto (username, data, entrada, almoco_saida, almoco_retorno, saida_final) VALUES
('Fernanda Certinha', '2026-03-02', '2026-03-02 13:00:00', NULL, NULL, '2026-03-02 17:00:00'),
('Fernanda Certinha', '2026-03-03', '2026-03-03 13:00:00', NULL, NULL, '2026-03-03 17:00:00'),
('Fernanda Certinha', '2026-03-04', '2026-03-04 13:00:00', NULL, NULL, '2026-03-04 17:00:00'),
('Fernanda Certinha', '2026-03-05', '2026-03-05 13:00:00', NULL, NULL, '2026-03-05 17:00:00'),
('Fernanda Certinha', '2026-03-06', '2026-03-06 13:00:00', NULL, NULL, '2026-03-06 17:00:00');
