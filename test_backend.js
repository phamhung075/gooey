#!/usr/bin/env node

/**
 * Backend Test Script for Sub-Agent Detection
 * This script tests the backend functions directly by making HTTP requests to the Tauri app
 */

const http = require('http');

// Function to make HTTP request to Tauri backend
async function callTauriCommand(command, payload = {}) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            cmd: command,
            ...payload
        });

        const options = {
            hostname: 'localhost',
            port: 1420, // Default Tauri dev port
            path: '/__tauri_invoke__',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result);
                } catch (e) {
                    resolve(data);
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.write(postData);
        req.end();
    });
}

// Test functions
async function testProcessRegistry() {
    console.log('\n🧪 Testing Process Registry...');
    console.log('=' .repeat(50));

    try {
        const result = await callTauriCommand('test_process_registry');
        console.log('✅ Process Registry Test Result:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Process Registry Test Failed:', error.message);
    }
}

async function testGetActiveSessions() {
    console.log('\n🔍 Testing Get Active Sessions...');
    console.log('=' .repeat(50));

    try {
        const result = await callTauriCommand('get_active_claude_sessions');
        console.log('✅ Active Sessions Result:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Get Active Sessions Test Failed:', error.message);
    }
}

async function testSubagentDetection() {
    console.log('\n🔍 Testing Sub-agent Detection...');
    console.log('=' .repeat(50));

    try {
        const result = await callTauriCommand('detect_subagent_activity');
        console.log('✅ Sub-agent Detection Result:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Sub-agent Detection Test Failed:', error.message);
    }
}

async function testTriggerRealEvents() {
    console.log('\n🚀 Testing Trigger Real Events...');
    console.log('=' .repeat(50));

    try {
        const result = await callTauriCommand('trigger_real_subagent_events');
        console.log('✅ Trigger Real Events Result:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Trigger Real Events Test Failed:', error.message);
    }
}

// Main test function
async function runAllTests() {
    console.log('🧪 Backend Sub-Agent Detection Test Suite');
    console.log('=' .repeat(60));

    // Wait a moment for Tauri app to be ready
    console.log('Waiting for Tauri app to be ready...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    await testProcessRegistry();
    await testGetActiveSessions();
    await testSubagentDetection();
    await testTriggerRealEvents();

    console.log('\n' + '=' .repeat(60));
    console.log('🏁 All tests completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = {
    callTauriCommand,
    testProcessRegistry,
    testGetActiveSessions,
    testSubagentDetection,
    testTriggerRealEvents,
    runAllTests
};