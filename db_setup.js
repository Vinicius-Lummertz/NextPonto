const mysql = require('mysql2/promise');

async function run() {
    try {
        const conn = await mysql.createConnection('mysql://root:@localhost:3306/nextponto');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS Estagiarios (
                nome_usuario VARCHAR(150) PRIMARY KEY,
                jornada_diaria INT DEFAULT 8,
                data_contratacao DATE,
                status ENUM('ATIVO', 'REMOVIDO', 'FERIAS') DEFAULT 'ATIVO'
            )
        `);

        try {
            await conn.query(`
                ALTER TABLE Justificativas 
                ADD COLUMN status_aprovacao ENUM('PENDENTE', 'APROVADA', 'RECUSADA') DEFAULT 'PENDENTE'
            `);
        } catch (e) {
            // Se já existir, a query acima falha, o que é seguro ignorar
            console.log("Coluna possivelmente já existe: ", e.message);
        }

        await conn.query(`
            INSERT IGNORE INTO Estagiarios (nome_usuario, jornada_diaria, data_contratacao, status) 
            VALUES 
                ('Vinicius Gomes', 6, '2025-01-01', 'ATIVO'),
                ('Dev.Local', 6, '2025-01-01', 'ATIVO')
        `);

        console.log('DB Migrated');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
