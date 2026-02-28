interface FeatureAttributes {
    title: string;
    year?: string | number;
    feature_type?: string;
    imdb_id?: number;
    tmdb_id?: number;
    url?: string;
}
interface FeatureResult {
    id: number | string;
    type: string;
    attributes: FeatureAttributes;
}
export declare function fetchFeaturesRaw(url: string): Promise<FeatureResult[]>;
export declare function fetchFeatures(query: string, type?: string): Promise<FeatureResult[]>;
export declare function handleLookupFeature(targetPath: string, typeOverride?: string, // 'movie' | 'episode'
queryOverride?: string, autoSelect?: number): Promise<void>;
export {};
