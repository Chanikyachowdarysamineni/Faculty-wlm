const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'src', 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

let markdown = '# API Endpoints\n\nThis document lists all the API endpoints configured in the backend.\n\n';

for (const file of files) {
    const filePath = path.join(routesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // basic route name assumption based on filename
    let baseRoute = file.replace('.js', '');
    if (baseRoute === 'facultyCapacity') baseRoute = 'faculty'; // Based on index.js mount
    
    markdown += `## \`/deva/${baseRoute}\`\n\n`;
    markdown += `| Method | Endpoint | Description / Roles |\n`;
    markdown += `|--------|----------|---------------------|\n`;
    
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Match `router.get('/...',` or `router.post('/',`
        const match = line.match(/router\.(get|post|put|delete|patch)\(\s*['"`](.*?)['"`]/);
        if (match) {
            const method = match[1].toUpperCase();
            let endpoint = match[2];
            
            // Look for comments above the route to get descriptions
            let description = '';
            if (i > 0 && lines[i-1].includes('//')) {
                description = lines[i-1].split('//')[1].trim();
            } else if (i > 1 && lines[i-2].includes('//')) {
                description = lines[i-2].split('//')[1].trim();
            }
            
            markdown += `| \`${method}\` | \`${endpoint}\` | ${description} |\n`;
        }
    }
    
    markdown += '\n';
}

console.log(markdown);
