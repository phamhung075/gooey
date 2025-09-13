#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Backend Sub-Agent Detection Test');
console.log('=====================================');

// Function to execute Rust code directly to test the registry
function testProcessRegistry() {
    console.log('\n📋 Testing Process Registry...');

    const testCode = `
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

// Mock ProcessInfo structure
#[derive(Debug, Clone)]
struct ProcessInfo {
    run_id: i64,
    process_type: String,
    pid: u32,
    started_at: String,
}

fn main() {
    println!("🔍 Testing process registry functionality...");

    // Create mock registry data
    let mut processes = HashMap::new();

    // Add some test sessions
    processes.insert(1, ProcessInfo {
        run_id: 1,
        process_type: "ClaudeSession".to_string(),
        pid: 12345,
        started_at: "2023-01-01".to_string(),
    });

    processes.insert(2, ProcessInfo {
        run_id: 2,
        process_type: "AgentRun".to_string(),
        pid: 67890,
        started_at: "2023-01-02".to_string(),
    });

    println!("📊 Mock Registry Status:");
    println!("  - Total processes: {}", processes.len());

    for (id, info) in &processes {
        println!("  - Process {}: {:?}", id, info);
    }

    if processes.is_empty() {
        println!("⚠️  No active sessions found");
    } else {
        println!("✅ Found {} active sessions", processes.len());
    }
}
`;

    // Write test file
    fs.writeFileSync('/tmp/test_registry.rs', testCode);

    // Compile and run
    exec('rustc /tmp/test_registry.rs -o /tmp/test_registry && /tmp/test_registry', (error, stdout, stderr) => {
        if (error) {
            console.error('❌ Registry test failed:', error.message);
            return;
        }

        if (stderr) {
            console.error('⚠️  Warnings:', stderr);
        }

        console.log(stdout);

        // Cleanup
        try {
            fs.unlinkSync('/tmp/test_registry.rs');
            fs.unlinkSync('/tmp/test_registry');
        } catch (e) {}
    });
}

// Function to test the actual Tauri process
function testTauriProcess() {
    console.log('\n🔍 Checking Tauri Process...');

    exec('ps aux | grep opcode', (error, stdout, stderr) => {
        if (error) {
            console.error('❌ Failed to check processes:', error.message);
            return;
        }

        const lines = stdout.split('\n').filter(line =>
            line.includes('target/debug/opcode') && !line.includes('grep')
        );

        if (lines.length === 0) {
            console.log('❌ Tauri app (opcode) is not running');
        } else {
            console.log('✅ Tauri app is running:');
            lines.forEach(line => {
                const parts = line.trim().split(/\s+/);
                const pid = parts[1];
                console.log(`  - PID: ${pid}`);
            });
        }
    });
}

// Function to check if any Claude processes are running
function testClaudeProcesses() {
    console.log('\n🔍 Checking for Claude Processes...');

    exec('ps aux | grep -i claude', (error, stdout, stderr) => {
        if (error) {
            console.error('❌ Failed to check Claude processes:', error.message);
            return;
        }

        const lines = stdout.split('\n').filter(line =>
            line.includes('claude') && !line.includes('grep') && !line.includes('claudia')
        );

        if (lines.length === 0) {
            console.log('⚠️  No Claude CLI processes found running');
            console.log('💡 To test sub-agent detection, you need to:');
            console.log('   1. Open a terminal');
            console.log('   2. Run a Claude Code command that uses the Task tool');
            console.log('   3. This will create active sessions for detection');
        } else {
            console.log('✅ Found Claude processes:');
            lines.forEach(line => {
                const parts = line.trim().split(/\s+/);
                const pid = parts[1];
                const command = parts.slice(10).join(' ');
                console.log(`  - PID: ${pid}, Command: ${command}`);
            });
        }
    });
}

// Function to simulate the detection logic
function testDetectionLogic() {
    console.log('\n🧠 Testing Detection Logic...');

    // Mock session data
    const mockSessions = [
        { id: "2c84ea8d", type: "ClaudeSession", pid: 12345, hasTaskTool: true },
        { id: "abc12345", type: "AgentRun", pid: 67890, hasTaskTool: false },
        { id: "def67890", type: "ClaudeSession", pid: 54321, hasTaskTool: true }
    ];

    console.log(`📊 Mock Sessions (${mockSessions.length} total):`);
    mockSessions.forEach((session, i) => {
        console.log(`  ${i+1}. Session ${session.id} (${session.type})`);
        console.log(`     - PID: ${session.pid}`);
        console.log(`     - Has sub-agent activity: ${session.hasTaskTool ? '✅' : '❌'}`);
    });

    // Apply detection logic
    const detectedSessions = mockSessions.filter(session => {
        // Heuristic: session ID length >= 8 and alphanumeric
        return session.id.length >= 8 && /^[a-zA-Z0-9]+$/.test(session.id);
    });

    console.log(`\n🎯 Detection Results:`);
    if (detectedSessions.length === 0) {
        console.log('⚠️  No sub-agent activity detected');
    } else {
        console.log(`✅ Detected sub-agent activity in ${detectedSessions.length} sessions:`);
        detectedSessions.forEach(session => {
            console.log(`  - ${session.id} (${session.type})`);
        });
    }
}

// Function to check logs
function checkLogs() {
    console.log('\n📋 Checking Recent Logs...');

    // Check if log files exist
    const possibleLogPaths = [
        '/tmp/tauri.log',
        './target/debug/opcode.log',
        '~/.local/share/opcode/logs',
    ];

    let foundLogs = false;

    possibleLogPaths.forEach(logPath => {
        if (fs.existsSync(logPath)) {
            foundLogs = true;
            console.log(`📄 Found log file: ${logPath}`);
            try {
                const content = fs.readFileSync(logPath, 'utf8');
                const recentLines = content.split('\n').slice(-10);
                console.log('Recent entries:');
                recentLines.forEach(line => {
                    if (line.trim()) console.log(`  ${line}`);
                });
            } catch (e) {
                console.log(`  ❌ Could not read log file: ${e.message}`);
            }
        }
    });

    if (!foundLogs) {
        console.log('ℹ️  No log files found. Logs are likely output to stdout/stderr.');
        console.log('💡 Check the terminal where you started "npm run tauri dev"');
    }
}

// Main execution
async function runTests() {
    testTauriProcess();

    setTimeout(() => {
        testClaudeProcesses();
    }, 1000);

    setTimeout(() => {
        testProcessRegistry();
    }, 2000);

    setTimeout(() => {
        testDetectionLogic();
    }, 3000);

    setTimeout(() => {
        checkLogs();
    }, 4000);

    setTimeout(() => {
        console.log('\n' + '='.repeat(50));
        console.log('🏁 Backend testing completed!');
        console.log('\nNext steps:');
        console.log('1. Ensure Tauri app is running (✅ if PID shown above)');
        console.log('2. Start a Claude Code session with Task tool usage');
        console.log('3. The process registry should then detect active sessions');
        console.log('4. Sub-agent detection will automatically find and emit events');
    }, 5000);
}

// Run if executed directly
if (require.main === module) {
    runTests();
}