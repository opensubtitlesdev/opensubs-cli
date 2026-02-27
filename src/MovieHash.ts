import {statSync, openSync, readSync, closeSync} from "fs";

// OpenSubtitles hash algorithm
// Hash is based on Media Player Classic's implementation
export function calculateMovieHash(filePath: string): string {
    const fileStats = statSync(filePath);
    const fileSize = fileStats.size;

    if (fileSize < 65536) {
        throw new Error("File too small to hash");
    }

    const chunkSize = 65536; // 64KB
    const fd = openSync(filePath, 'r');

    try {
        let hash = BigInt(fileSize);

        // Read first 64KB
        const headBuffer = Buffer.alloc(chunkSize);
        readSync(fd, headBuffer, 0, chunkSize, 0);
        hash = addBufferToHash(hash, headBuffer);

        // Read last 64KB
        const tailBuffer = Buffer.alloc(chunkSize);
        readSync(fd, tailBuffer, 0, chunkSize, fileSize - chunkSize);
        hash = addBufferToHash(hash, tailBuffer);

        // Convert to hex string (16 characters, zero-padded)
        const hashHex = (hash & BigInt('0xFFFFFFFFFFFFFFFF')).toString(16).padStart(16, '0');

        return hashHex;
    } finally {
        closeSync(fd);
    }
}

function addBufferToHash(hash: bigint, buffer: Buffer): bigint {
    for (let i = 0; i < buffer.length; i += 8) {
        // Read 8 bytes as little-endian uint64
        const chunk = buffer.readBigUInt64LE(i);
        hash = (hash + chunk) & BigInt('0xFFFFFFFFFFFFFFFF');
    }
    return hash;
}
