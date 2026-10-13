// Desktop entry point for the INFINITY // terminal shell.
//
// The game itself is a single-file web build (npm run build → dist/index.html);
// this crate only hosts a webview. No Tauri commands or plugins are needed —
// storage stays in the webview's own localStorage via src/ui/platform.ts.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!("tauri.conf.json"))
        .expect("error while running INFINITY // terminal");
}
