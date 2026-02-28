export interface GuessitResult {
    title?: string;
    year?: number;
    type?: string;
    season?: number;
    episode?: number;
    screen_size?: string;
}
export declare function callGuessit(filename: string): Promise<GuessitResult>;
