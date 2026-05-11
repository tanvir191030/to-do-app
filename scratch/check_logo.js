import fs from 'fs';
import path from 'path';

const logoPath = path.join(process.cwd(), 'app-brand-logo.png');
console.log('Checking logo path:', logoPath);

if (fs.existsSync(logoPath)) {
    const stats = fs.statSync(logoPath);
    console.log('Logo exists! Size:', stats.size, 'bytes');
} else {
    console.log('Logo does NOT exist at this path.');
    console.log('Files in directory:', fs.readdirSync(process.cwd()));
}
