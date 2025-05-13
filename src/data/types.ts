export namespace WebPosting {
    type TaxonomyEntry = {
        term_id: number;
    };

    type Taxonomies = {
        [key: string]: TaxonomyEntry;
    };

    type PostMetaPrepare = {
        gallery: string[];
        Year: string;
        Mileage: string;
        Price: string;
        Model: string;
        Trim: string;
    }

    type TaxonomiesPrepare = {
        make: number;
        bodytype: number;
        'fuel-type': number;
        transmission: number;
    }

    export type Car = {
        post_thumbnail: number;
        taxonomies: Taxonomies;
        post_meta: Record<string, string[] | number[]>;
    };

    export type DataPrepareType = {
        post_thumbnail: number;
        post_meta: PostMetaPrepare;
        taxonomies: TaxonomiesPrepare;
    }

    export type InputWebPosting = {
        photos: string[];
        "Body type": string;
        "Fuel type": string;
        Transmission: string;
        Year: string;
        Mileage: string;
        Price: string;
        Make: string;
        Model: string;
        Trim: string;
    }
}
