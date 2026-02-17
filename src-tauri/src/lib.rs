use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use regex::Regex;

// --- Enum types for type-safe deserialization ---

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Position {
    Start,
    End,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "lowercase")]
pub enum CaseMode {
    Upper,
    Lower,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "lowercase")]
pub enum WidthMode {
    Zenkaku,
    Hankaku,
}

// --- Rename commands ---

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "mode", content = "config")]
pub enum RenameCommand {
    Fixed {
        name: String,
        keep_ext: bool,
    },
    Serial {
        prefix: String,
        suffix: String,
        number: u32,
        pad: usize,
        keep_ext: bool,
        keep_original: bool,
    },
    Replace {
        from: String,
        to: String,
        use_regex: bool,
    },
    Add {
        text: String,
        position: Position,
    },
    Trim {
        count: usize,
        position: Position,
    },
    Extension {
        new_ext: String,
    },
    Case {
        mode: CaseMode,
    },
    Convert {
        mode: WidthMode,
    },
}

#[derive(Serialize, Deserialize)]
pub struct RenameResult {
    path: String,
    status: String,
    new_name: Option<String>,
}

// --- Character width conversion helpers ---

fn to_zenkaku(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            ' ' => '\u{3000}',
            '!'..='~' => char::from_u32(c as u32 + 0xFEE0).unwrap_or(c),
            _ => c,
        })
        .collect()
}

fn to_hankaku(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '\u{3000}' => ' ',
            '\u{FF01}'..='\u{FF5E}' => char::from_u32(c as u32 - 0xFEE0).unwrap_or(c),
            _ => c,
        })
        .collect()
}

/// Reconstruct filename from stem and extension.
/// If ext is empty, returns just the stem.
fn join_name_ext(stem: &str, ext: &str) -> String {
    if ext.is_empty() {
        stem.to_string()
    } else {
        format!("{}.{}", stem, ext)
    }
}

// --- Core rename logic ---

#[tauri::command]
fn handle_rename(path: String, cmd: RenameCommand) -> RenameResult {
    let old_path = Path::new(&path);
    if !old_path.exists() {
        return RenameResult {
            path,
            status: "File not found".into(),
            new_name: None,
        };
    }

    let parent = match old_path.parent() {
        Some(p) => p,
        None => {
            return RenameResult {
                path,
                status: "Invalid path".into(),
                new_name: None,
            }
        }
    };

    let old_name = match old_path.file_name().and_then(|n| n.to_str()) {
        Some(n) => n,
        None => {
            return RenameResult {
                path,
                status: "Invalid filename".into(),
                new_name: None,
            }
        }
    };

    let ext = old_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    let name_stem = old_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(old_name);

    let new_name_res: Result<String, String> = match &cmd {
        // --- Fixed: replace entire name ---
        RenameCommand::Fixed { name, keep_ext } => {
            if *keep_ext && !ext.is_empty() {
                Ok(join_name_ext(name, ext))
            } else {
                Ok(name.clone())
            }
        }

        // --- Serial: prefix + (original?) + number + suffix ---
        RenameCommand::Serial {
            prefix,
            suffix,
            number,
            pad,
            keep_ext,
            keep_original,
        } => {
            let num_str = format!("{:0width$}", number, width = pad);
            let generated = if *keep_original {
                // prefix + original_stem + number + suffix
                format!("{}{}{}{}", prefix, name_stem, num_str, suffix)
            } else {
                format!("{}{}{}", prefix, num_str, suffix)
            };

            if *keep_ext && !ext.is_empty() {
                Ok(join_name_ext(&generated, ext))
            } else {
                Ok(generated)
            }
        }

        // --- Replace: string or regex replacement ---
        RenameCommand::Replace {
            from,
            to,
            use_regex,
        } => {
            if *use_regex {
                match Regex::new(from) {
                    Ok(re) => Ok(re.replace_all(old_name, to.as_str()).to_string()),
                    Err(e) => Err(format!("Regex error: {}", e)),
                }
            } else {
                Ok(old_name.replace(from, to))
            }
        }

        // --- Add: prepend or append text to stem ---
        RenameCommand::Add { text, position } => {
            let new_stem = match position {
                Position::Start => format!("{}{}", text, name_stem),
                Position::End => format!("{}{}", name_stem, text),
            };
            Ok(join_name_ext(&new_stem, ext))
        }

        // --- Trim: remove characters from stem ---
        RenameCommand::Trim { count, position } => {
            let chars: Vec<char> = name_stem.chars().collect();
            let len = chars.len();

            if *count >= len {
                return RenameResult {
                    path,
                    status: format!(
                        "Trim count ({}) exceeds name length ({})",
                        count, len
                    ),
                    new_name: None,
                };
            }

            let trimmed: String = match position {
                Position::Start => chars[*count..].iter().collect(),
                Position::End => chars[..len - *count].iter().collect(),
            };

            if trimmed.is_empty() {
                return RenameResult {
                    path,
                    status: "Resulting name is empty after trim".into(),
                    new_name: None,
                };
            }

            Ok(join_name_ext(&trimmed, ext))
        }

        // --- Extension: change file extension ---
        RenameCommand::Extension { new_ext } => {
            let clean_ext = new_ext.trim_start_matches('.');
            Ok(format!("{}.{}", name_stem, clean_ext))
        }

        // --- Case: upper/lower conversion (stem only, preserve extension) ---
        RenameCommand::Case { mode } => {
            let new_stem = match mode {
                CaseMode::Upper => name_stem.to_uppercase(),
                CaseMode::Lower => name_stem.to_lowercase(),
            };
            Ok(join_name_ext(&new_stem, ext))
        }

        // --- Convert: zenkaku/hankaku conversion (stem only, preserve extension) ---
        RenameCommand::Convert { mode } => {
            let new_stem = match mode {
                WidthMode::Zenkaku => to_zenkaku(name_stem),
                WidthMode::Hankaku => to_hankaku(name_stem),
            };
            Ok(join_name_ext(&new_stem, ext))
        }
    };

    // --- Execute rename ---
    match new_name_res {
        Ok(new_name) => {
            if new_name.is_empty() {
                return RenameResult {
                    path,
                    status: "Resulting name is empty".into(),
                    new_name: None,
                };
            }

            let new_path = parent.join(&new_name);

            // Prevent overwriting existing files
            if new_path.exists() {
                return RenameResult {
                    path,
                    status: format!("Target exists: {}", new_name),
                    new_name: None,
                };
            }

            match fs::rename(old_path, &new_path) {
                Ok(_) => RenameResult {
                    path,
                    status: "Success".into(),
                    new_name: Some(new_name),
                },
                Err(e) => RenameResult {
                    path,
                    status: e.to_string(),
                    new_name: None,
                },
            }
        }
        Err(e) => RenameResult {
            path,
            status: e,
            new_name: None,
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![handle_rename])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
