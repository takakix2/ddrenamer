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
        text: String,
        position: Position,
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
    /// Where the file actually ended up, absolute. Undo needs to name the file
    /// it is reversing, and the caller should not have to rebuild this from the
    /// old path and a bare filename -- that means guessing a separator and
    /// re-deriving something this function already computed.
    new_path: Option<String>,
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

/// Characters Windows refuses anywhere in a filename.
///
/// Checked on every platform, not only on Windows. Switching the rule per OS
/// would let this tool mint names on Linux that cannot be opened on Windows,
/// and the breakage would surface only after the file crossed a machine --
/// far away from the rename that caused it. The cost is that `a:b.txt` can no
/// longer be produced here; that was accepted deliberately.
///
/// `/` earns its place on Linux too: the new name is handed to
/// `parent.join(&new_name)`, so a slash would quietly move the file into
/// another directory instead of renaming it in place.
const FORBIDDEN_CHARS: [char; 9] = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];

/// Device names Windows still reserves, with or without an extension:
/// `CON.txt` is `CON`. Compared case-insensitively.
const RESERVED_DEVICE_NAMES: [&str; 22] = [
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Refuse names that some supported platform cannot store.
///
/// This runs on the *finished* name rather than inside `join_name_ext`,
/// because the join is not the only seam: `Fixed` with "keep extension" off
/// returns the name directly, and `Replace` rewrites the whole name without
/// ever splitting off a stem. Both would walk past a guard placed in the join.
fn check_portable_name(name: &str) -> Result<(), String> {
    if let Some(c) = name.chars().find(|c| FORBIDDEN_CHARS.contains(c)) {
        return Err(format!("Invalid character '{}'", c));
    }
    if name.chars().any(char::is_control) {
        return Err("Control character in name".into());
    }
    // Windows silently strips these, so a file written as "photo." opens as
    // "photo" -- two names for one file is worse than refusing.
    if name.ends_with('.') || name.ends_with(' ') {
        return Err("Name ends with a dot or space".into());
    }
    let device = name.split('.').next().unwrap_or(name);
    if RESERVED_DEVICE_NAMES
        .iter()
        .any(|r| r.eq_ignore_ascii_case(device))
    {
        return Err(format!("Reserved name '{}'", device));
    }
    Ok(())
}

/// Reconstruct a filename from a stem and an extension.
///
/// The one point where a stem and an extension meet.
///
/// Every mode that transforms the stem while preserving the extension goes
/// through here, so this is where an empty stem is refused. The check cannot
/// live after the join: `Path::new(".jpg").file_stem()` returns `Some(".jpg")`,
/// so a name that is nothing but an extension does not look empty once built.
/// Left unguarded it produced a hidden file that the log reported as a success.
fn join_name_ext(stem: &str, ext: &str) -> Result<String, String> {
    // Whitespace-only is refused too: "   .jpg" is legal here and illegal on
    // Windows, and nobody means it.
    if stem.trim().is_empty() {
        return Err("Name is empty".into());
    }
    Ok(if ext.is_empty() {
        stem.to_string()
    } else {
        format!("{}.{}", stem, ext)
    })
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
            new_path: None,
        };
    }

    let parent = match old_path.parent() {
        Some(p) => p,
        None => {
            return RenameResult {
                path,
                status: "Invalid path".into(),
                new_name: None,
                new_path: None,
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
                new_path: None,
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
                join_name_ext(name, ext)
            } else {
                Ok(name.clone())
            }
        }

        // --- Serial: text + number block, positioned relative to original ---
        RenameCommand::Serial {
            text,
            position,
            number,
            pad,
            keep_ext,
            keep_original,
        } => {
            let num_str = format!("{:0width$}", number, width = pad);
            let text_num = format!("{}{}", text, num_str);
            let generated = if *keep_original {
                match position {
                    Position::Start => format!("{}{}", text_num, name_stem),
                    Position::End => format!("{}{}", name_stem, text_num),
                }
            } else {
                text_num
            };

            if *keep_ext && !ext.is_empty() {
                join_name_ext(&generated, ext)
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
            if from.is_empty() {
                return RenameResult {
                    path,
                    status: "Search string is empty".into(),
                    new_name: None,
                    new_path: None,
                };
            }
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
            join_name_ext(&new_stem, ext)
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
                    new_path: None,
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
                    new_path: None,
                };
            }

            join_name_ext(&trimmed, ext)
        }

        // --- Extension: change file extension ---
        RenameCommand::Extension { new_ext } => {
            let clean_ext = new_ext.trim_start_matches('.');
            // Built by hand before, which skipped the guard and also produced a
            // trailing dot ("photo.") when the new extension was empty. Going
            // through the join drops the dot instead, and clearing the field now
            // means "remove the extension".
            join_name_ext(name_stem, clean_ext)
        }

        // --- Case: upper/lower conversion (stem only, preserve extension) ---
        RenameCommand::Case { mode } => {
            let new_stem = match mode {
                CaseMode::Upper => name_stem.to_uppercase(),
                CaseMode::Lower => name_stem.to_lowercase(),
            };
            join_name_ext(&new_stem, ext)
        }

        // --- Convert: zenkaku/hankaku conversion (stem only, preserve extension) ---
        RenameCommand::Convert { mode } => {
            let new_stem = match mode {
                WidthMode::Zenkaku => to_zenkaku(name_stem),
                WidthMode::Hankaku => to_hankaku(name_stem),
            };
            join_name_ext(&new_stem, ext)
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
                    new_path: None,
                };
            }

            // Every mode lands here, so this is the seam that holds for all of
            // them -- including the two that skip `join_name_ext`.
            if let Err(status) = check_portable_name(&new_name) {
                return RenameResult {
                    path,
                    status,
                    new_name: None,
                    new_path: None,
                };
            }

            let new_path = parent.join(&new_name);

            // If the name hasn't actually changed, return success immediately
            if old_path == new_path {
                return RenameResult {
                    path,
                    status: "Success".into(),
                    new_name: Some(new_name),
                    new_path: Some(new_path.to_string_lossy().into_owned()),
                };
            }

            // Prevent overwriting existing files.
            //
            // A case-only rename has to be allowed: on a case-insensitive
            // filesystem the target "already exists" because it IS the file
            // being renamed. Deciding that by lowercasing the two names was
            // wrong -- on a case-sensitive filesystem `photo.txt` and
            // `PHOTO.txt` are two different files that compare equal that way,
            // so the guard waved through an `fs::rename` that destroyed the
            // other one and reported "Success". Ask about identity instead:
            // dev+ino on Unix, the file index on Windows.
            if new_path.exists() {
                let is_self = same_file::is_same_file(old_path, &new_path).unwrap_or(false);
                if !is_self {
                    return RenameResult {
                        path,
                        status: format!("Target exists: {}", new_name),
                        new_name: None,
                        new_path: None,
                    };
                }
            }

            match fs::rename(old_path, &new_path) {
                Ok(_) => RenameResult {
                    path,
                    status: "Success".into(),
                    new_name: Some(new_name),
                    new_path: Some(new_path.to_string_lossy().into_owned()),
                },
                Err(e) => RenameResult {
                    path,
                    status: e.to_string(),
                    new_name: None,
                    new_path: None,
                },
            }
        }
        Err(e) => RenameResult {
            path,
            status: e,
            new_name: None,
            new_path: None,
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_x::init())
        .invoke_handler(tauri::generate_handler![handle_rename])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use tempfile::tempdir;

    #[test]
    fn test_rename_fixed() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        File::create(&file_path).unwrap();

        let cmd = RenameCommand::Fixed {
            name: "new_name".into(),
            keep_ext: true,
        };
        let res = handle_rename(file_path.to_str().unwrap().into(), cmd);

        assert_eq!(res.status, "Success");
        assert_eq!(res.new_name.unwrap(), "new_name.txt");
    }

    #[test]
    fn test_rename_serial_suffix() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        File::create(&file_path).unwrap();

        let cmd = RenameCommand::Serial {
            text: "_suffix".into(),
            position: Position::End,
            number: 1,
            pad: 3,
            keep_ext: true,
            keep_original: false,
        };
        let res = handle_rename(file_path.to_str().unwrap().into(), cmd);

        assert_eq!(res.status, "Success");
        assert_eq!(res.new_name.unwrap(), "_suffix001.txt");
    }

    #[test]
    fn test_rename_trim_end() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("abcde.txt");
        File::create(&file_path).unwrap();

        let cmd = RenameCommand::Trim {
            count: 2,
            position: Position::End,
        };
        let res = handle_rename(file_path.to_str().unwrap().into(), cmd);

        assert_eq!(res.status, "Success");
        assert_eq!(res.new_name.unwrap(), "abc.txt");
    }

    #[test]
    fn test_rename_replace() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("old_name_v1.txt");
        File::create(&file_path).unwrap();

        let cmd = RenameCommand::Replace {
            from: "v1".into(),
            to: "v2".into(),
            use_regex: false,
        };
        let res = handle_rename(file_path.to_str().unwrap().into(), cmd);

        assert_eq!(res.status, "Success");
        assert_eq!(res.new_name.unwrap(), "old_name_v2.txt");
    }

    #[test]
    fn test_rename_replace_regex() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("image_123_test.png");
        File::create(&file_path).unwrap();

        let cmd = RenameCommand::Replace {
            from: r"(\d+)".into(),
            to: "NUM".into(),
            use_regex: true,
        };
        let res = handle_rename(file_path.to_str().unwrap().into(), cmd);

        assert_eq!(res.status, "Success");
        assert_eq!(res.new_name.unwrap(), "image_NUM_test.png");
    }

    #[test]
    fn test_rename_add_start() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("file.txt");
        File::create(&file_path).unwrap();

        let cmd = RenameCommand::Add {
            text: "prefix_".into(),
            position: Position::Start,
        };
        let res = handle_rename(file_path.to_str().unwrap().into(), cmd);

        assert_eq!(res.status, "Success");
        assert_eq!(res.new_name.unwrap(), "prefix_file.txt");
    }

    #[test]
    fn test_rename_extension() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("photo.jpg");
        File::create(&file_path).unwrap();

        let cmd = RenameCommand::Extension {
            new_ext: "png".into(),
        };
        let res = handle_rename(file_path.to_str().unwrap().into(), cmd);

        assert_eq!(res.status, "Success");
        assert_eq!(res.new_name.unwrap(), "photo.png");
    }

    // --- Guards: the two bugs filed on 2026-07-30 ---

    /// The exact names the directory itself reports, sorted.
    ///
    /// 🚨 `Path::exists()` cannot answer "what is this file called" on a
    /// case-insensitive filesystem: it says yes for `photo.txt` while
    /// `PHOTO.txt` is what is stored. Neither can `RenameResult::new_name`,
    /// which is the name *we computed*, not the one that landed. Asking the
    /// directory is the only way to tell whether a case-only rename actually
    /// took effect.
    fn names_on_disk(dir: &Path) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        names
    }

    /// Does the filesystem under `dir` tell `a` and `A` apart?
    ///
    /// Deliberately not a `cfg(windows)` question. macOS is Unix and
    /// case-insensitive by default, and Linux can mount case-insensitive
    /// volumes, so the target triple does not answer it -- ask the filesystem
    /// that is actually in front of the test.
    fn filesystem_is_case_sensitive(dir: &Path) -> bool {
        let lower = dir.join("caseprobe.tmp");
        File::create(&lower).unwrap();
        let sensitive = !dir.join("CASEPROBE.TMP").exists();
        let _ = std::fs::remove_file(&lower);
        sensitive
    }

    /// A rename that only changes case must not be mistaken for a rename onto
    /// a distinct file. The old guard compared lowercased names, so on a
    /// case-sensitive filesystem it let `PHOTO.txt` overwrite an unrelated
    /// `photo.txt` and reported success.
    ///
    /// ⚠️ This scenario only exists where the filesystem is case-sensitive.
    /// Elsewhere the two names are one file, so there is no distinct victim to
    /// destroy and the rename is correctly allowed -- which is what
    /// `case_only_rename_of_the_same_file_succeeds` covers. Windows CI found
    /// this on 2026-08-01; the test had only ever run on ext4, and it would
    /// have failed on macOS for the same reason had anyone run it there.
    #[test]
    fn case_only_rename_does_not_destroy_a_distinct_file() {
        let dir = tempdir().unwrap();
        if !filesystem_is_case_sensitive(dir.path()) {
            eprintln!(
                "skipped: this filesystem is case-insensitive, so two files \
                 differing only in case cannot both exist"
            );
            return;
        }
        let victim = dir.path().join("photo.txt");
        let subject = dir.path().join("PHOTO.txt");
        std::fs::write(&victim, b"VICTIM").unwrap();
        std::fs::write(&subject, b"SUBJECT").unwrap();

        let cmd = RenameCommand::Case { mode: CaseMode::Lower };
        let res = handle_rename(subject.to_str().unwrap().into(), cmd);

        assert!(
            res.status.starts_with("Target exists"),
            "expected a refusal, got {:?}",
            res.status
        );
        assert_eq!(std::fs::read(&victim).unwrap(), b"VICTIM");
        assert_eq!(std::fs::read(&subject).unwrap(), b"SUBJECT");
    }

    /// The other direction: when nothing else is in the way, a case-only
    /// rename still has to go through. On a case-insensitive filesystem the
    /// target reports as existing because it is the same file.
    #[test]
    fn case_only_rename_of_the_same_file_succeeds() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("photo.txt");
        std::fs::write(&file_path, b"ONLY").unwrap();

        let cmd = RenameCommand::Case { mode: CaseMode::Upper };
        let res = handle_rename(file_path.to_str().unwrap().into(), cmd);

        assert_eq!(res.status, "Success");
        assert_eq!(res.new_name.unwrap(), "PHOTO.txt");
        // ⚠️ The two asserts above only say what we computed and reported.
        // Ask the directory what is actually stored -- on a case-insensitive
        // filesystem every other way of checking answers yes to both spellings.
        assert_eq!(
            names_on_disk(dir.path()),
            vec!["PHOTO.txt"],
            "the case-only rename did not reach the filesystem"
        );
    }

    /// An unrelated existing target is still refused.
    #[test]
    fn rename_onto_an_existing_file_is_refused() {
        let dir = tempdir().unwrap();
        let occupied = dir.path().join("taken.txt");
        let subject = dir.path().join("source.txt");
        std::fs::write(&occupied, b"OCCUPIED").unwrap();
        std::fs::write(&subject, b"SOURCE").unwrap();

        let cmd = RenameCommand::Fixed {
            name: "taken".into(),
            keep_ext: true,
        };
        let res = handle_rename(subject.to_str().unwrap().into(), cmd);

        assert!(res.status.starts_with("Target exists"), "got {:?}", res.status);
        assert_eq!(std::fs::read(&occupied).unwrap(), b"OCCUPIED");
    }

    /// An empty name with "keep extension" used to build `.jpg` -- a hidden
    /// file that the final `is_empty()` guard could not see, because the name
    /// was no longer empty by then.
    #[test]
    fn empty_name_with_keep_ext_is_refused() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("photo_a.jpg");
        File::create(&file_path).unwrap();

        let cmd = RenameCommand::Fixed {
            name: "".into(),
            keep_ext: true,
        };
        let res = handle_rename(file_path.to_str().unwrap().into(), cmd);

        assert_eq!(res.status, "Name is empty");
        assert!(file_path.exists(), "the original must be left alone");
        assert!(!dir.path().join(".jpg").exists(), "a hidden file was created");
    }

    /// The rule is the same on every platform on purpose: a name minted on
    /// Linux has to be openable on Windows, and the failure would otherwise
    /// only show up on the other machine.
    #[test]
    fn names_windows_cannot_store_are_refused() {
        for bad in ["a:b", "a<b", "a>b", "a\"b", "a|b", "a?b", "a*b", "a\\b"] {
            assert!(
                check_portable_name(bad).is_err(),
                "{bad:?} should be refused"
            );
        }
        for reserved in ["CON", "con.txt", "NUL", "com1.tar.gz", "LPT9.jpg"] {
            let err = check_portable_name(reserved).unwrap_err();
            assert!(err.starts_with("Reserved name"), "{reserved:?} -> {err}");
        }
        assert_eq!(
            check_portable_name("photo."),
            Err("Name ends with a dot or space".into())
        );
        assert_eq!(
            check_portable_name("photo "),
            Err("Name ends with a dot or space".into())
        );
        assert!(check_portable_name("a\u{7}b").is_err(), "control char");

        // Positive control: the ordinary cases must still pass, or the test
        // above would also pass with a guard that refuses everything.
        for good in ["photo.jpg", ".gitignore", "photo.tar.gz", "CONSOLE.txt", "日本語.txt"] {
            assert_eq!(check_portable_name(good), Ok(()), "{good:?} must pass");
        }
    }

    /// A slash is not just a Windows concern: the finished name is handed to
    /// `parent.join()`, so without the guard this renames the file into
    /// another directory -- and reports success.
    #[test]
    fn a_slash_cannot_move_the_file_out_of_its_directory() {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("sub");
        std::fs::create_dir(&sub).unwrap();
        let file_path = dir.path().join("photo.jpg");
        std::fs::write(&file_path, b"PAYLOAD").unwrap();

        let cmd = RenameCommand::Fixed {
            name: "sub/moved".into(),
            keep_ext: true,
        };
        let res = handle_rename(file_path.to_str().unwrap().into(), cmd);

        assert_eq!(res.status, "Invalid character '/'");
        assert!(file_path.exists(), "the original must stay put");
        assert!(
            !sub.join("moved.jpg").exists(),
            "the file escaped into a subdirectory"
        );
    }

    /// `Fixed` with "keep extension" off returns the name without going
    /// through `join_name_ext`, so a guard living in the join would miss it.
    /// This is why the check sits on the finished name instead.
    #[test]
    fn the_guard_covers_the_modes_that_skip_the_join() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("photo.jpg");
        File::create(&file_path).unwrap();

        let res = handle_rename(
            file_path.to_str().unwrap().into(),
            RenameCommand::Fixed {
                name: "bad:name".into(),
                keep_ext: false,
            },
        );
        assert_eq!(res.status, "Invalid character ':'");
        assert!(file_path.exists());

        // `Replace` rewrites the whole name and never splits off a stem.
        let res = handle_rename(
            file_path.to_str().unwrap().into(),
            RenameCommand::Replace {
                from: "photo".into(),
                to: "CON".into(),
                use_regex: false,
            },
        );
        assert_eq!(res.status, "Reserved name 'CON'");
        assert!(file_path.exists());
    }

    /// Whitespace is not a name either.
    #[test]
    fn whitespace_only_name_is_refused() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("photo_a.jpg");
        File::create(&file_path).unwrap();

        let cmd = RenameCommand::Fixed {
            name: "   ".into(),
            keep_ext: true,
        };
        let res = handle_rename(file_path.to_str().unwrap().into(), cmd);

        assert_eq!(res.status, "Name is empty");
        assert!(file_path.exists());
    }

    /// The guard lives on the join, so it holds for every stem-preserving mode
    /// at one place rather than per mode.
    ///
    /// Worth recording which modes can actually reach it today: only `Fixed`,
    /// because it takes the stem straight from the user. `Case` and `Convert`
    /// preserve length, `Add` builds on a non-empty stem, `Trim` refuses first
    /// with its own message, and `Serial` cannot produce an empty stem at all --
    /// `format!("{:0width$}", 0, width = 0)` is "0", never "". The guard is the
    /// invariant for the seam, not a patch on six live bugs.
    #[test]
    fn the_join_refuses_an_empty_stem() {
        assert_eq!(join_name_ext("", "jpg"), Err("Name is empty".into()));
        assert_eq!(join_name_ext("   ", "jpg"), Err("Name is empty".into()));
        assert_eq!(join_name_ext("", ""), Err("Name is empty".into()));
        assert_eq!(join_name_ext("photo", "jpg"), Ok("photo.jpg".into()));
        assert_eq!(join_name_ext("photo", ""), Ok("photo".into()));
    }

    /// Trim keeps its own message: it can say how far over the count was.
    #[test]
    fn trim_keeps_its_own_message() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("ab.jpg");
        File::create(&f).unwrap();

        let res = handle_rename(
            f.to_str().unwrap().into(),
            RenameCommand::Trim { count: 2, position: Position::End },
        );

        assert_eq!(res.status, "Trim count (2) exceeds name length (2)");
        assert!(f.exists());
    }

    /// Serial is the reason the guard is an invariant and not a fix: it routes
    /// through the join but always has at least one digit to stand on.
    #[test]
    fn serial_always_has_a_digit_so_it_never_hits_the_guard() {
        let dir = tempdir().unwrap();
        let g = dir.path().join("photo.jpg");
        File::create(&g).unwrap();

        let res = handle_rename(
            g.to_str().unwrap().into(),
            RenameCommand::Serial {
                text: "".into(),
                position: Position::End,
                number: 0,
                pad: 0,
                keep_ext: true,
                keep_original: false,
            },
        );

        assert_eq!(res.status, "Success");
        assert_eq!(res.new_name.unwrap(), "0.jpg");
    }

    /// Clearing the extension field now removes the extension instead of
    /// leaving a trailing dot, which is an illegal name on Windows.
    #[test]
    fn clearing_the_extension_drops_the_dot() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("photo.jpg");
        File::create(&file_path).unwrap();

        let cmd = RenameCommand::Extension { new_ext: "".into() };
        let res = handle_rename(file_path.to_str().unwrap().into(), cmd);

        assert_eq!(res.status, "Success");
        assert_eq!(res.new_name.unwrap(), "photo");
    }
    // --- Undo の契約 ---
    //
    // Undo does not get its own command. Reversing a rename is a rename back to
    // the original full name, which means it goes through the same guards --
    // the identity check and the refusal to overwrite -- without anyone having
    // to remember to apply them. These tests hold that arrangement in place.

    #[test]
    fn undo_is_just_a_fixed_rename_back() {
        let dir = tempdir().unwrap();
        let orig = dir.path().join("photo_a.jpg");
        std::fs::write(&orig, b"DATA").unwrap();

        // 1) 普通にリネーム
        let res = handle_rename(
            orig.to_str().unwrap().into(),
            RenameCommand::Fixed { name: "IMG_001".into(), keep_ext: true },
        );
        assert_eq!(res.status, "Success");
        let new_name = res.new_name.unwrap();
        assert_eq!(new_name, "IMG_001.jpg");
        let new_path = dir.path().join(&new_name);
        assert!(new_path.exists() && !orig.exists());

        // 2) 元の「フルネーム」を Fixed(keep_ext=false) で当てて戻す
        let back = handle_rename(
            new_path.to_str().unwrap().into(),
            RenameCommand::Fixed { name: "photo_a.jpg".into(), keep_ext: false },
        );
        assert_eq!(back.status, "Success");
        assert_eq!(back.new_name.unwrap(), "photo_a.jpg");
        assert!(orig.exists() && !new_path.exists());
        assert_eq!(std::fs::read(&orig).unwrap(), b"DATA");
    }

    #[test]
    fn undo_is_refused_when_the_old_name_got_taken() {
        let dir = tempdir().unwrap();
        let orig = dir.path().join("photo_a.jpg");
        std::fs::write(&orig, b"DATA").unwrap();

        let res = handle_rename(
            orig.to_str().unwrap().into(),
            RenameCommand::Fixed { name: "IMG_001".into(), keep_ext: true },
        );
        assert_eq!(res.status, "Success");
        let new_path = dir.path().join(res.new_name.unwrap());

        // 誰かが元の名前の場所に別のファイルを置いた
        std::fs::write(&orig, b"SOMEONE ELSE").unwrap();

        let back = handle_rename(
            new_path.to_str().unwrap().into(),
            RenameCommand::Fixed { name: "photo_a.jpg".into(), keep_ext: false },
        );
        assert!(back.status.starts_with("Target exists"), "got {:?}", back.status);
        assert_eq!(std::fs::read(&orig).unwrap(), b"SOMEONE ELSE", "他人のファイルを潰した");
        assert!(new_path.exists(), "戻せなかったのに元のファイルが消えた");
    }

    #[test]
    fn undo_of_a_case_only_rename_round_trips() {
        let dir = tempdir().unwrap();
        let orig = dir.path().join("photo.txt");
        std::fs::write(&orig, b"DATA").unwrap();

        let res = handle_rename(
            orig.to_str().unwrap().into(),
            RenameCommand::Case { mode: CaseMode::Upper },
        );
        assert_eq!(res.status, "Success");
        let new_path = dir.path().join(res.new_name.unwrap());
        assert_eq!(names_on_disk(dir.path()), vec!["PHOTO.txt"], "リネームが載っていない");

        let back = handle_rename(
            new_path.to_str().unwrap().into(),
            RenameCommand::Fixed { name: "photo.txt".into(), keep_ext: false },
        );
        assert_eq!(back.status, "Success", "大小だけ戻す Undo が通らない");
        assert_eq!(std::fs::read(&orig).unwrap(), b"DATA");
        // ⚠️ 中身の照合だけでは足りない。case-insensitive な FS では
        // `PHOTO.txt` のままでも `photo.txt` として読めてしまうので、
        // 「戻った」と誤読する。名前そのものを見る。
        assert_eq!(
            names_on_disk(dir.path()),
            vec!["photo.txt"],
            "内容は戻ったが名前の大小が戻っていない"
        );
    }

    // --- Case と Convert: 到達できないモードの契約（2026-08-19） ---
    //
    // 🚨 This section exists because these two modes have no caller.
    // `RenameCommand` has eight variants; the frontend sends six. `Case` and
    // `Convert` are reachable only from here, and until today not even from
    // here -- the `test_rename_*` block above covers exactly the six modes the
    // UI has tabs for. The tests were written against the tabs, not against
    // the enum, so the gap in the wiring left an identically shaped gap in the
    // tests, and neither one pointed at the other.
    //
    // Nothing warns about this. Rust sees both variants matched in
    // `handle_rename`, so `to_zenkaku` and `to_hankaku` count as used and
    // dead_code stays quiet. TypeScript never sees the two it fails to send,
    // because the seam between them is a JSON string tag. Both ends compile
    // green across a join that neither compiler owns.
    //
    // These run before the tabs are wired, so the width conversion is executed
    // here for the first time.

    /// Case converts the stem and leaves the extension alone.
    ///
    /// That asymmetry is the contract, not an oversight: `IMG_001.JPG`
    /// lowercased is `img_001.JPG`, because renaming is not the place to
    /// decide that `.JPG` should become `.jpg` -- the extension tab is.
    #[test]
    fn case_lower_converts_the_stem_and_spares_the_extension() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("IMG_001.JPG");
        File::create(&file_path).unwrap();

        let cmd = RenameCommand::Case { mode: CaseMode::Lower };
        let res = handle_rename(file_path.to_str().unwrap().into(), cmd);

        assert_eq!(res.status, "Success");
        assert_eq!(names_on_disk(dir.path()), vec!["img_001.JPG"]);
    }

    /// Widening touches the stem only, and the ASCII space becomes U+3000
    /// rather than staying half-width -- a name that is half widened reads as
    /// a bug, not as a choice.
    #[test]
    fn convert_to_zenkaku_widens_the_stem_only() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("photo 01.jpg");
        File::create(&file_path).unwrap();

        let cmd = RenameCommand::Convert { mode: WidthMode::Zenkaku };
        let res = handle_rename(file_path.to_str().unwrap().into(), cmd);

        assert_eq!(res.status, "Success");
        assert_eq!(
            names_on_disk(dir.path()),
            vec!["\u{ff50}\u{ff48}\u{ff4f}\u{ff54}\u{ff4f}\u{3000}\u{ff10}\u{ff11}.jpg"],
            "the extension must stay half-width"
        );
    }

    /// The other direction, including U+3000 back to a plain space.
    #[test]
    fn convert_to_hankaku_narrows_the_stem_only() {
        let dir = tempdir().unwrap();
        let file_path = dir
            .path()
            .join("\u{ff30}\u{ff28}\u{ff2f}\u{ff34}\u{ff2f}\u{3000}\u{ff10}\u{ff11}.JPG");
        File::create(&file_path).unwrap();

        let cmd = RenameCommand::Convert { mode: WidthMode::Hankaku };
        let res = handle_rename(file_path.to_str().unwrap().into(), cmd);

        assert_eq!(res.status, "Success");
        assert_eq!(names_on_disk(dir.path()), vec!["PHOTO 01.JPG"]);
    }

    /// Non-ASCII is left alone by both directions. Kana and kanji have no
    /// half-width counterpart in this mapping, and silently mangling them
    /// would be worse than doing nothing.
    #[test]
    fn width_conversion_leaves_japanese_text_untouched() {
        assert_eq!(to_zenkaku("\u{5199}\u{771f}a"), "\u{5199}\u{771f}\u{ff41}");
        assert_eq!(to_hankaku("\u{5199}\u{771f}\u{ff41}"), "\u{5199}\u{771f}a");
    }

    /// Every printable ASCII character survives a round trip.
    ///
    /// The two mappings are written as separate ranges (`'!'..='~'` one way,
    /// U+FF01..=U+FF5E the other), so nothing in the code forces them to stay
    /// each other's inverse. This is the assertion that does.
    #[test]
    fn width_conversion_round_trips_over_printable_ascii() {
        let ascii: String = (0x20u8..=0x7e).map(|b| b as char).collect();
        assert_eq!(to_hankaku(&to_zenkaku(&ascii)), ascii);
    }

    // 🚨 The three below are the reason this mode is not merely cosmetic.
    // Narrowing is the one transform in this tool that can *invent* a
    // character the user never typed: the full-width forms of `/`, `:` and the
    // rest are perfectly legal in a filename, and their half-width twins are
    // exactly what `check_portable_name` refuses. So the guard has to hold on
    // a name nobody wrote by hand.

    /// `\u{ff0f}` narrows to `/`, and `/` is not a character -- it is a
    /// directory boundary. The new name is handed to `parent.join()`, so
    /// letting this through would move the file instead of renaming it.
    #[test]
    fn hankaku_conversion_cannot_mint_a_path_separator() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("\u{ff41}\u{ff0f}\u{ff42}.jpg");
        std::fs::write(&file_path, b"KEEP").unwrap();

        let cmd = RenameCommand::Convert { mode: WidthMode::Hankaku };
        let res = handle_rename(file_path.to_str().unwrap().into(), cmd);

        assert_eq!(res.status, "Invalid character '/'");
        assert!(res.new_name.is_none());
        assert_eq!(
            names_on_disk(dir.path()),
            vec!["\u{ff41}\u{ff0f}\u{ff42}.jpg"],
            "the file moved or was renamed despite the refusal"
        );
    }

    /// `\u{ff23}\u{ff2f}\u{ff2e}.txt` is an ordinary name. `CON.txt` is a device.
    #[test]
    fn hankaku_conversion_cannot_mint_a_reserved_device_name() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("\u{ff23}\u{ff2f}\u{ff2e}.txt");
        File::create(&file_path).unwrap();

        let cmd = RenameCommand::Convert { mode: WidthMode::Hankaku };
        let res = handle_rename(file_path.to_str().unwrap().into(), cmd);

        assert_eq!(res.status, "Reserved name 'CON'");
        assert_eq!(names_on_disk(dir.path()), vec!["\u{ff23}\u{ff2f}\u{ff2e}.txt"]);
    }

    /// U+3000 at the end of a name is fine on Windows; a trailing ASCII space
    /// is silently stripped, which is how one file ends up with two names.
    /// Narrowing turns the first into the second.
    #[test]
    fn hankaku_conversion_cannot_mint_a_trailing_space() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("photo\u{3000}");
        File::create(&file_path).unwrap();

        let cmd = RenameCommand::Convert { mode: WidthMode::Hankaku };
        let res = handle_rename(file_path.to_str().unwrap().into(), cmd);

        assert_eq!(res.status, "Name ends with a dot or space");
        assert_eq!(names_on_disk(dir.path()), vec!["photo\u{3000}"]);
    }

    /// Widening never produces an empty stem, but it does produce a name that
    /// no longer matches what the user dropped, so the identity guard still
    /// has to see it as the same file when nothing changes.
    #[test]
    fn width_conversion_of_an_already_converted_name_is_a_no_op() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("\u{ff50}\u{ff48}\u{ff4f}\u{ff54}\u{ff4f}.jpg");
        File::create(&file_path).unwrap();

        let cmd = RenameCommand::Convert { mode: WidthMode::Zenkaku };
        let res = handle_rename(file_path.to_str().unwrap().into(), cmd);

        assert_eq!(res.status, "Success");
        assert_eq!(names_on_disk(dir.path()), vec!["\u{ff50}\u{ff48}\u{ff4f}\u{ff54}\u{ff4f}.jpg"]);
    }
}
