export interface SidecarData {
    imdb_id?: number;
    tmdb_id?: number;
    parent_imdb_id?: number;
    parent_tmdb_id?: number;
    type?: 'movie' | 'episode';
}
/** .myfile.opensubs next to myfile.mp4 */
export declare function sidecarPathForFile(videoFilePath: string): string;
/** .folder.opensubs inside the given directory */
export declare function sidecarPathForFolder(dirPath: string): string;
export declare function readFileSidecar(videoFilePath: string): SidecarData | null;
export declare function readFolderSidecar(dirPath: string): SidecarData | null;
export declare function writeSidecar(filePath: string, data: SidecarData): void;
