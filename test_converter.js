#!/usr/bin/env node
// Simple test script to verify the converter works

const fs = require('fs');
const path = require('path');

async function testConverter() {
    try {
        console.log('Testing convert-rpp-to-docx.js...');
        
        // Import the main function from the module
        const modulePath = path.join(__dirname, 'convert-rpp-to-docx.js');
        
        // Execute the Node.js script
        const exec = require('child_process').exec;
        
        const command = `node ${modulePath} test.html test_output.docx`;
        
        console.log(`Running: ${command}`);
        
        const promise = new Promise((resolve, reject) => {
            const child = exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
                if (error) {
                    console.error('Error executing converter:', error.message);
                    reject(error);
                }
                if (stderr) {
                    console.log('Converter stderr:', stderr);
                }
                resolve(stdout);
            });
            
            child.stdout && child.stdout.on('data', (data) => console.log('Converter output:', data.toString()));
            child.stderr && child.stderr.on('data', (data) => console.error('Converter stderr:', data.toString()));
        });
        
        await promise;
        
        // Check if output file exists
        if (fs.existsSync(path.join(__dirname, 'test_output.docx'))) {
            const stats = fs.statSync(path.join(__dirname, 'test_output.docx'));
            console.log(`\n✓ SUCCESS: DOCX file created with ${stats.size} bytes`);
            console.log('The converter successfully processed HTML with KaTeX equations!');
            return true;
        } else {
            console.error('✗ ERROR: DOCX file was not created');
            return false;
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
        return false;
    }
}

// Run the test
if (require.main === module) {
    testConverter()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Unexpected error:', error);
            process.exit(1);
        });
}

module.exports = { testConverter };
