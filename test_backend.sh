#!/bin/bash

# Backend Test Script for Sub-Agent Detection
# This script tests the backend by watching the logs and calling functions

echo "🧪 Backend Sub-Agent Detection Test Suite"
echo "=========================================="

# Make sure Tauri is running
if ! pgrep -f "target/debug/opcode" > /dev/null; then
    echo "❌ Tauri app is not running. Please start it with 'npm run tauri dev'"
    exit 1
fi

echo "✅ Tauri app is running"

# Function to test using browser console commands
test_with_browser() {
    echo ""
    echo "🔍 Testing backend functions..."
    echo "Open your browser console and run these commands:"
    echo ""
    echo "1. Test Process Registry:"
    echo "   window.__TAURI__.invoke('test_process_registry').then(console.log).catch(console.error)"
    echo ""
    echo "2. Test Get Active Sessions:"
    echo "   window.__TAURI__.invoke('get_active_claude_sessions').then(console.log).catch(console.error)"
    echo ""
    echo "3. Test Sub-agent Detection:"
    echo "   window.__TAURI__.invoke('detect_subagent_activity').then(console.log).catch(console.error)"
    echo ""
    echo "4. Test Trigger Real Events:"
    echo "   window.__TAURI__.invoke('trigger_real_subagent_events').then(console.log).catch(console.error)"
    echo ""
}

# Function to watch logs in real-time
watch_logs() {
    echo "📊 Watching Tauri logs for backend activity..."
    echo "Press Ctrl+C to stop watching"
    echo ""

    # Monitor the Tauri process logs
    journalctl -f --since="1 minute ago" 2>/dev/null | grep -E "(🔍|🧪|Registry|Detection|sub-agent|subagent)" || {
        echo "Note: journalctl not available, logs will appear in the terminal where you started 'npm run tauri dev'"
    }
}

# Function to create a test Claude session
create_test_session() {
    echo "🚀 To create a test Claude session for testing:"
    echo "1. Open Claude Code in a terminal"
    echo "2. Run a command that uses the Task tool (like asking me to search for something)"
    echo "3. This will create an active Claude session that can be detected"
    echo ""
}

# Main menu
echo ""
echo "Choose an option:"
echo "1) Show browser console commands for testing"
echo "2) Watch logs for backend activity"
echo "3) Show how to create test Claude session"
echo "4) All of the above"
echo ""

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        test_with_browser
        ;;
    2)
        watch_logs
        ;;
    3)
        create_test_session
        ;;
    4)
        test_with_browser
        create_test_session
        echo ""
        echo "Now watching logs (press Ctrl+C to stop):"
        watch_logs
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac