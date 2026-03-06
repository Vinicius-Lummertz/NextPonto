use std::env;

#[tauri::command]
fn get_windows_user() -> String {
    // 1. Obtém a variável do SO (com fallback para segurança)
    let username = env::var("USERNAME").unwrap_or_else(|_| "Usuario Desconhecido".to_string());

    // 2. Substitui o ponto por espaço e aplica Title Case
    let formatted_name = username
        .split('.')
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect::<Vec<String>>()
        .join(" ");

    formatted_name
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![get_windows_user])
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
