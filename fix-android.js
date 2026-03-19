import fs from 'fs';
import path from 'path';

const gradlePath = path.join(process.cwd(), 'node_modules', 'capacitor-nodejs', 'android', 'build.gradle');
const manifestPath = path.join(process.cwd(), 'node_modules', 'capacitor-nodejs', 'android', 'src', 'main', 'AndroidManifest.xml');

console.log('🚀 Memulai perbaikan plugin capacitor-nodejs...');

// 1. Fix build.gradle
if (fs.existsSync(gradlePath)) {
    let content = fs.readFileSync(gradlePath, 'utf8');
    if (!content.includes('namespace')) {
        content = content.replace('android {', 'android {\n    namespace "net.hampoelz.capacitor.nodejs"');
        // Update versions for compatibility
        content = content.replace(/compileSdkVersion.*/, 'compileSdkVersion 34');
        content = content.replace(/targetSdkVersion.*/, 'targetSdkVersion 34');
        content = content.replace(/JavaVersion.VERSION_1_8/g, 'JavaVersion.VERSION_17');
        fs.writeFileSync(gradlePath, content);
        console.log('✅ build.gradle berhasil diperbaiki (Namespace & Java 17 added).');
    } else {
        console.log('ℹ️ build.gradle sudah diperbaiki sebelumnya.');
    }
} else {
    console.error('❌ File build.gradle tidak ditemukan! Pastikan sudah jalankan npm install.');
}

// 2. Fix AndroidManifest.xml
if (fs.existsSync(manifestPath)) {
    let content = fs.readFileSync(manifestPath, 'utf8');
    if (content.includes('package="net.hampoelz.capacitor.nodejs"')) {
        content = content.replace('package="net.hampoelz.capacitor.nodejs"', '');
        fs.writeFileSync(manifestPath, content);
        console.log('✅ AndroidManifest.xml berhasil diperbaiki (Package removed).');
    } else {
        console.log('ℹ️ AndroidManifest.xml sudah bersih.');
    }
} else {
    console.error('❌ File AndroidManifest.xml tidak ditemukan!');
}

console.log('✨ Perbaikan selesai. Sekarang jalankan: npx cap sync android');
