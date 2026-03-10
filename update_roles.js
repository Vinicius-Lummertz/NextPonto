const mysql = require('mysql2/promise');
async function run() {
    try {
        const conn = await mysql.createConnection('mysql://root:@localhost:3306/nextponto');
        try {
            await conn.query("ALTER TABLE estagiarios ADD COLUMN tipo_perfil ENUM('ESTAGIARIO', 'GESTOR', 'ESTAGIARIO_GESTOR') DEFAULT 'ESTAGIARIO'");
        } catch (e) {
            console.log("Column seems to exist already, or failed:", e.message);
        }
        await conn.query("UPDATE estagiarios SET tipo_perfil = 'ESTAGIARIO_GESTOR' WHERE nome_usuario = 'Vinicius Gomes'");
        await conn.query("UPDATE estagiarios SET tipo_perfil = 'GESTOR' WHERE nome_usuario = 'Dev.Local'"); // Exemplo de gestor puro
        console.log('DB Atualizado, tipo_perfil inserido');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
