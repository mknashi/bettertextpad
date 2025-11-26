use std::process::{Command, Stdio};
use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct ErrorDetail {
    line: Option<u32>,
    column: Option<u32>,
    message: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ErrorDetails {
    #[serde(rename = "type")]
    error_type: String,
    message: String,
    #[serde(rename = "allErrors")]
    all_errors: Option<Vec<ErrorDetail>>,
}

// Check if Ollama is installed and running
#[tauri::command]
async fn check_ollama_status() -> Result<serde_json::Value, String> {
    // Try to run ollama list to check if it's installed
    let output = Command::new("ollama")
        .arg("list")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    match output {
        Ok(result) => {
            if result.status.success() {
                let stdout = String::from_utf8_lossy(&result.stdout);
                let models: Vec<String> = stdout
                    .lines()
                    .skip(1) // Skip header
                    .filter_map(|line| {
                        line.split_whitespace().next().map(|s| s.to_string())
                    })
                    .collect();

                Ok(serde_json::json!({
                    "available": true,
                    "models": models
                }))
            } else {
                Ok(serde_json::json!({
                    "available": false,
                    "models": []
                }))
            }
        }
        Err(_) => Ok(serde_json::json!({
            "available": false,
            "models": [],
            "error": "Ollama not installed"
        })),
    }
}

// Pull an Ollama model
#[tauri::command]
async fn pull_ollama_model(model: String) -> Result<String, String> {
    let output = Command::new("ollama")
        .args(&["pull", &model])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to pull model: {}", e))?;

    if output.status.success() {
        Ok(format!("Successfully pulled model: {}", model))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to pull model: {}", stderr))
    }
}

// Fix JSON/XML errors using Ollama
#[tauri::command]
async fn fix_with_ollama(
    content: String,
    error_details: String,
    model: String,
) -> Result<String, String> {
    // Parse error details
    let details: ErrorDetails = serde_json::from_str(&error_details)
        .map_err(|e| format!("Failed to parse error details: {}", e))?;

    // Build error list
    let error_list = if let Some(ref errors) = details.all_errors {
        errors
            .iter()
            .map(|e| {
                if let Some(line) = e.line {
                    format!("Line {}: {}", line, e.message)
                } else {
                    e.message.clone()
                }
            })
            .collect::<Vec<_>>()
            .join("\n")
    } else {
        details.message.clone()
    };

    // Build prompt - emphasize outputting complete content
    let prompt = format!(
        r#"Fix the syntax errors in this {}. Output ONLY the corrected {} with NO explanations.

Errors to fix:
{}

IMPORTANT: You MUST output the ENTIRE corrected content from start to finish. Do not truncate or summarize.

Content:
{}

Output the complete fixed {} now:"#,
        details.error_type,
        details.error_type,
        error_list,
        content,
        details.error_type
    );

    // Use Ollama API instead of CLI for better control over parameters
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(300))  // 5 minute timeout for large files
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let api_url = "http://localhost:11434/api/generate";

    let request_body = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "stream": false,
        "options": {
            "num_ctx": 32768,  // Increase context window to 32K tokens
            "num_predict": -1,  // Unlimited output - let model decide when to stop
            "temperature": 0.1,
            "top_p": 0.9,
            "repeat_penalty": 1.0,
            "stop": []  // No stop sequences
        }
    });

    let response = client
        .post(api_url)
        .json(&request_body)
        .send()
        .map_err(|e| format!("Failed to call Ollama API: {}", e))?;

    if response.status().is_success() {
        let response_json: serde_json::Value = response
            .json()
            .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

        let mut fixed = response_json["response"]
            .as_str()
            .unwrap_or("")
            .to_string();

        // DeepSeek R1 outputs reasoning in <think> tags - remove them
        // Find the last closing </think> tag and take everything after it
        if let Some(think_end) = fixed.rfind("</think>") {
            fixed = fixed[think_end + 8..].to_string();
        }

        // Remove markdown code block markers but preserve content
        // Handle cases like ```json\n{...}\n```
        if fixed.contains("```") {
            let mut in_code_block = false;
            let mut code_lines = Vec::new();

            for line in fixed.lines() {
                if line.trim().starts_with("```") {
                    in_code_block = !in_code_block;
                } else if in_code_block {
                    code_lines.push(line);
                }
            }

            // If we found code block content, use it; otherwise keep original
            if !code_lines.is_empty() {
                fixed = code_lines.join("\n");
            } else {
                // No code block markers found, just remove the ``` lines
                fixed = fixed
                    .lines()
                    .filter(|line| !line.trim().starts_with("```"))
                    .collect::<Vec<_>>()
                    .join("\n");
            }
        }

        // Try to extract JSON/XML content more intelligently
        // For JSON: find the outermost { or [ and matching closing brace
        // For XML: find the first < and last >
        let trimmed = fixed.trim();
        if details.error_type == "JSON" {
            // Find first { or [
            if let Some(start_idx) = trimmed.find(|c| c == '{' || c == '[') {
                let start_char = trimmed.chars().nth(start_idx).unwrap();
                let end_char = if start_char == '{' { '}' } else { ']' };

                // Find matching closing brace
                let mut depth = 0;
                let mut end_idx = start_idx;
                for (i, c) in trimmed[start_idx..].char_indices() {
                    if c == start_char {
                        depth += 1;
                    } else if c == end_char {
                        depth -= 1;
                        if depth == 0 {
                            end_idx = start_idx + i + 1;
                            break;
                        }
                    }
                }

                if end_idx > start_idx {
                    fixed = trimmed[start_idx..end_idx].to_string();
                }
            }
        } else if details.error_type == "XML" {
            // For XML, find first < and last >
            if let Some(start_idx) = trimmed.find('<') {
                if let Some(end_idx) = trimmed.rfind('>') {
                    if end_idx > start_idx {
                        fixed = trimmed[start_idx..=end_idx].to_string();
                    }
                }
            }
        }

        // Final trim
        fixed = fixed.trim().to_string();

        Ok(fixed)
    } else {
        Err(format!("Ollama API error: HTTP {}", response.status()))
    }
}

// Check if a specific model is available
#[tauri::command]
async fn check_model_available(model: String) -> Result<bool, String> {
    let output = Command::new("ollama")
        .arg("list")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to check models: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.contains(&model))
    } else {
        Ok(false)
    }
}

// Save file content to a specific path
#[tauri::command]
async fn save_file_to_path(file_path: String, content: String) -> Result<String, String> {
    let path = Path::new(&file_path);

    fs::write(path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(format!("Successfully saved to {}", file_path))
}

// Read file content from a specific path
#[tauri::command]
async fn read_file_from_path(file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);

    fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

// Get command line arguments (for file associations)
#[tauri::command]
async fn get_cli_args() -> Result<Vec<String>, String> {
    let args: Vec<String> = std::env::args().collect();
    // Skip the first argument (the executable path)
    Ok(args.into_iter().skip(1).collect())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
        .invoke_handler(tauri::generate_handler![
            check_ollama_status,
            pull_ollama_model,
            fix_with_ollama,
            check_model_available,
            save_file_to_path,
            read_file_from_path,
            get_cli_args
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
