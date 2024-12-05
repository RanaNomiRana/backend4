const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const { exec } = require('child_process');

const app = express();

// Enable CORS
app.use(cors());

// Enable body parsing for JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Base directory for serving files
const basePath = 'C:\\';

// Endpoint to get the file list from a specific directory
app.get('/get-files', (req, res) => {
    const dirPath = req.query.path || basePath;

    // Check if the directory exists
    if (!fs.existsSync(dirPath)) {
        return res.status(404).json({ error: 'Directory not found' });
    }

    fs.readdir(dirPath, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Unable to read the directory', details: err.message });
        }

        // Build file items
        const fileItems = files.map((file) => {
            const fullPath = path.join(dirPath, file);
            try {
                const stat = fs.statSync(fullPath);
                return {
                    name: file,
                    isDirectory: stat.isDirectory(),
                    path: fullPath,
                };
            } catch (statErr) {
                // Log the error but continue processing other files
                console.warn(`Skipping ${file} due to error: ${statErr.message}`);
                return null;
            }
        }).filter(Boolean); // Remove null entries caused by errors

        res.json({ files: fileItems });
    });
});

// Serve files for preview (e.g., images, videos, etc.)
app.get('/files/:filePath', (req, res) => {
    const filePath = decodeURIComponent(req.params.filePath);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`Error serving file: ${err.message}`);
            res.status(500).send({ error: 'Error serving file', details: err.message });
        }
    });
});

// Endpoint to pull data from an SD card to a specified case directory
app.post('/pull-sd-card', (req, res) => {
    const { caseNumber } = req.body;

    if (!caseNumber) {
        return res.status(400).json({ error: 'Case number is required' });
    }

    const targetDir = path.join(basePath, caseNumber);

    // Create the directory if it doesn't exist
    try {
        fs.mkdirSync(targetDir, { recursive: true });
    } catch (err) {
        console.error(`Failed to create directory: ${err.message}`);
        return res.status(500).json({ error: 'Failed to create directory', details: err.message });
    }

    // Execute the `adb` command to pull files
    exec(`adb pull /sdcard/ ${targetDir}`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error executing adb pull: ${stderr || err.message}`);
            return res.status(500).json({ error: 'Failed to pull data', details: stderr || err.message });
        }

        console.log('Data pulled successfully:', stdout);
        return res.status(200).json({ message: 'Data pulled successfully', details: stdout });
    });
});

// Start the server
const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
