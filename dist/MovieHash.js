"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateMovieHash = calculateMovieHash;
const fs_1 = require("fs");
// OpenSubtitles hash algorithm
// Hash is based on Media Player Classic's implementation
function calculateMovieHash(filePath) {
    const fileStats = (0, fs_1.statSync)(filePath);
    const fileSize = fileStats.size;
    if (fileSize < 65536) {
        throw new Error("File too small to hash");
    }
    const chunkSize = 65536; // 64KB
    const fd = (0, fs_1.openSync)(filePath, 'r');
    try {
        let hash = BigInt(fileSize);
        // Read first 64KB
        const headBuffer = Buffer.alloc(chunkSize);
        (0, fs_1.readSync)(fd, headBuffer, 0, chunkSize, 0);
        hash = addBufferToHash(hash, headBuffer);
        // Read last 64KB
        const tailBuffer = Buffer.alloc(chunkSize);
        (0, fs_1.readSync)(fd, tailBuffer, 0, chunkSize, fileSize - chunkSize);
        hash = addBufferToHash(hash, tailBuffer);
        // Convert to hex string (16 characters, zero-padded)
        const hashHex = (hash & BigInt('0xFFFFFFFFFFFFFFFF')).toString(16).padStart(16, '0');
        return hashHex;
    }
    finally {
        (0, fs_1.closeSync)(fd);
    }
}
function addBufferToHash(hash, buffer) {
    for (let i = 0; i < buffer.length; i += 8) {
        // Read 8 bytes as little-endian uint64
        const chunk = buffer.readBigUInt64LE(i);
        hash = (hash + chunk) & BigInt('0xFFFFFFFFFFFFFFFF');
    }
    return hash;
}
//# sourceMappingURL=MovieHash.js.map