
export interface ISubInfo {
    id: string;
    type: string;
    attributes: {
        subtitle_id: string;
        language: string;
        download_count: number;
        new_download_count: number;
        hearing_impaired: boolean;
        hd: boolean;
        fps: number;
        votes: number;
        points: number;
        ratings: number;
        from_trusted: boolean;
        foreign_parts_only: boolean;
        ai_translated: boolean;
        machine_translated: boolean;
        upload_date: string;
        release: string;
        comments: string;
        legacy_subtitle_id: number;
        uploader: {
            uploader_id: number;
            name: string;
            rank: string;
        };
        feature_details: {
            feature_id: number;
            feature_type: string;
            year: number;
            title: string;
            movie_name: string;
            imdb_id: number;
            tmdb_id: number;
        };
        url: string;
        related_links: {
            label: string;
            url: string;
            img_url: string;
        }[];
        files: {
            file_id: number;
            cd_number: number;
            file_name: string;
        }[];
    };
}

export interface IOpenSubtitles {
    login(auth: { username: string; password: string }): Promise<any>;
    subtitles(params: {
        languages?: string;
        moviehash?: string;
        query?: string;
        type?: string;
        [key: string]: any
    }): Promise<{ data: ISubInfo[] }>;
    download(params: { file_id: number; [key: string]: any }): Promise<{ link: string }>;
}

export interface ILanguage {
    name: string;
    alpha2: string;
    alpha3: string;
}

export interface IApiLanguage {
    language_code: string;
    language_name: string;
}

export interface IUserInfo {
    allowed_downloads: number;
    remaining_downloads?: number;
    downloads_count?: number;
    level: string;
    user_id: number;
    username?: string;
    ext_installed: boolean;
    vip: boolean;
}
