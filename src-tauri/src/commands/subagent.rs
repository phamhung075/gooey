use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubAgentInfo {
    pub parent_session_id: String,
    pub tool_id: String,
    pub task_description: String,
    pub subagent_type: Option<String>,
    pub process_id: Option<u32>,
    pub output_buffer: Vec<String>,
}

/// Global registry for tracking sub-agent sessions
pub struct SubAgentRegistry {
    active_subagents: Arc<Mutex<HashMap<String, SubAgentInfo>>>,
}

impl SubAgentRegistry {
    pub fn new() -> Self {
        Self {
            active_subagents: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Register a new sub-agent when Task tool is detected
    pub async fn register_subagent(
        &self,
        parent_session_id: String,
        tool_id: String,
        task_description: String,
        subagent_type: Option<String>,
    ) -> String {
        let subagent_id = format!("{}:{}", parent_session_id, tool_id);
        
        let info = SubAgentInfo {
            parent_session_id,
            tool_id,
            task_description,
            subagent_type,
            process_id: None,
            output_buffer: Vec::new(),
        };

        let mut registry = self.active_subagents.lock().await;
        registry.insert(subagent_id.clone(), info);
        
        info!("Registered sub-agent: {}", subagent_id);
        subagent_id
    }

    /// Add output to a sub-agent's buffer
    pub async fn add_output(&self, subagent_id: &str, output: String) {
        let mut registry = self.active_subagents.lock().await;
        if let Some(info) = registry.get_mut(subagent_id) {
            info.output_buffer.push(output);
        }
    }

    /// Get sub-agent info
    pub async fn get_subagent(&self, subagent_id: &str) -> Option<SubAgentInfo> {
        let registry = self.active_subagents.lock().await;
        registry.get(subagent_id).cloned()
    }

    /// Remove sub-agent when task completes
    pub async fn remove_subagent(&self, subagent_id: &str) {
        let mut registry = self.active_subagents.lock().await;
        registry.remove(subagent_id);
        info!("Removed sub-agent: {}", subagent_id);
    }
}

/// Monitor Claude output for Task tool usage and capture sub-agent output
pub async fn monitor_for_subagents(
    app: AppHandle,
    session_id: String,
    line: &str,
    registry: Arc<SubAgentRegistry>,
) {
    // Try to parse the line as JSON
    if let Ok(msg) = serde_json::from_str::<Value>(line) {
        // Check if this is a tool_use message for Task
        if msg["type"] == "assistant" {
            if let Some(content) = msg["message"]["content"].as_array() {
                for item in content {
                    if item["type"] == "tool_use" && item["name"] == "Task" {
                        // Found Task tool usage!
                        let tool_id = item["id"].as_str().unwrap_or("unknown").to_string();
                        let input = &item["input"];
                        
                        let task_description = input["description"]
                            .as_str()
                            .unwrap_or("Unknown task")
                            .to_string();
                        
                        let subagent_type = input["subagent_type"]
                            .as_str()
                            .map(|s| s.to_string());
                        
                        info!(
                            "Detected Task tool usage in session {}: {} (type: {:?})",
                            session_id, task_description, subagent_type
                        );

                        // Register the sub-agent
                        let subagent_id = registry
                            .register_subagent(
                                session_id.clone(),
                                tool_id.clone(),
                                task_description,
                                subagent_type,
                            )
                            .await;

                        // Emit event to frontend
                        let _ = app.emit(
                            &format!("subagent-started:{}", session_id),
                            serde_json::json!({
                                "subagent_id": subagent_id,
                                "tool_id": tool_id,
                                "description": input["description"],
                                "prompt": input["prompt"],
                                "subagent_type": input["subagent_type"],
                            }),
                        );

                        // Start monitoring for sub-agent output
                        tokio::spawn(capture_subagent_output(
                            app.clone(),
                            session_id.clone(),
                            subagent_id,
                            registry.clone(),
                        ));
                    }
                }
            }
        }

        // Check if this is a tool_result for a Task we're tracking
        if msg["type"] == "user" {
            if let Some(content) = msg["message"]["content"].as_array() {
                for item in content {
                    if item["type"] == "tool_result" {
                        if let Some(tool_use_id) = item["tool_use_id"].as_str() {
                            let subagent_id = format!("{}:{}", session_id, tool_use_id);
                            
                            // Check if we're tracking this sub-agent
                            if let Some(_info) = registry.get_subagent(&subagent_id).await {
                                info!("Task {} completed with result", subagent_id);
                                
                                // Emit completion event
                                let _ = app.emit(
                                    &format!("subagent-complete:{}", session_id),
                                    serde_json::json!({
                                        "subagent_id": subagent_id,
                                        "tool_id": tool_use_id,
                                        "result": item["content"],
                                    }),
                                );

                                // Clean up
                                registry.remove_subagent(&subagent_id).await;
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Capture output from a sub-agent process
async fn capture_subagent_output(
    app: AppHandle,
    parent_session_id: String,
    subagent_id: String,
    registry: Arc<SubAgentRegistry>,
) {
    // In reality, Claude spawns sub-agents as separate processes
    // We need to detect and capture their output
    
    // For now, we'll monitor the parent session's output for patterns
    // that indicate sub-agent activity
    
    info!("Starting sub-agent output capture for {}", subagent_id);
    
    // This is a simplified version - in production, we'd need to:
    // 1. Find the actual sub-process that Claude spawned
    // 2. Attach to its stdout/stderr
    // 3. Stream that output separately
    
    // Emit periodic status updates
    let mut counter = 0;
    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        
        // Check if sub-agent still exists
        if registry.get_subagent(&subagent_id).await.is_none() {
            break;
        }
        
        // Emit a heartbeat/status
        let _ = app.emit(
            &format!("subagent-output:{}", parent_session_id),
            serde_json::json!({
                "subagent_id": subagent_id,
                "type": "status",
                "message": format!("Sub-agent working... ({}s)", counter * 2),
            }),
        );
        
        counter += 1;
        if counter > 30 {
            // Timeout after 60 seconds
            break;
        }
    }
}

/// Enhanced spawn function that detects sub-agent spawning
pub async fn spawn_claude_with_subagent_detection(
    app: AppHandle,
    mut cmd: Command,
    session_id: String,
    registry: Arc<SubAgentRegistry>,
) -> Result<(), String> {
    use tokio::io::AsyncBufReadExt;

    // Spawn the process
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn Claude: {}", e))?;

    // Get stdout and stderr
    let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to get stderr")?;

    let stdout_reader = BufReader::new(stdout);
    let stderr_reader = BufReader::new(stderr);

    // Spawn task to read stdout with sub-agent detection
    let app_handle = app.clone();
    let session_id_clone = session_id.clone();
    let registry_clone = registry.clone();
    
    tokio::spawn(async move {
        let mut lines = stdout_reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            debug!("Claude stdout: {}", line);
            
            // Monitor for sub-agent Task tool usage
            monitor_for_subagents(
                app_handle.clone(),
                session_id_clone.clone(),
                &line,
                registry_clone.clone(),
            ).await;
            
            // Emit normal output
            let _ = app_handle.emit(&format!("claude-output:{}", session_id_clone), &line);
            let _ = app_handle.emit("claude-output", &line);
        }
    });

    // Handle stderr similarly
    let app_handle_stderr = app.clone();
    let session_id_stderr = session_id.clone();
    
    tokio::spawn(async move {
        let mut lines = stderr_reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            error!("Claude stderr: {}", line);
            let _ = app_handle_stderr.emit(&format!("claude-error:{}", session_id_stderr), &line);
            let _ = app_handle_stderr.emit("claude-error", &line);
        }
    });

    Ok(())
}