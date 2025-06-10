import { ModelStatic, Sequelize, BuildOptions, Model } from 'sequelize';
export interface AlbumAttributes {
    id: string;
    description: string;
    name: string;
    privacy: string;
    url: string;
    password: string;
}
export interface AlbumModel extends Model<AlbumAttributes>, AlbumAttributes {
}
export declare class Album extends Model {
    id: string;
    description: string;
    name: string;
    privacy: string;
    url: string;
    password: string;
}
export type AlbumStatic = ModelStatic<Album> & {
    new (values?: object, options?: BuildOptions): AlbumModel;
};
export declare function AlbumFactory(sequelize: Sequelize): AlbumStatic;
export interface ImageAttributes {
    id: string;
    caption: string;
    albumId: string;
    filename: string;
    url: string;
    originalSize: number;
    originalWidth: number;
    originalHeight: number;
    thumbnailUrl: string;
    archivedUri: string;
    archivedSize: number;
    archivedMD5: string;
    imageKey: string;
    preferredDisplayFileExtension: string;
    uri: string;
}
export interface ImageModel extends Model<ImageAttributes>, ImageAttributes {
}
export declare class Image extends Model {
    id: string;
    caption: string;
    albumId: string;
    filename: string;
    url: string;
    originalSize: number;
    originalWidth: number;
    originalHeight: number;
    thumbnailUrl: string;
    archivedUri: string;
    archivedSize: number;
    archivedMD5: string;
    imageKey: string;
    preferredDisplayFileExtension: string;
    uri: string;
}
export type ImageStatic = ModelStatic<Image> & {
    new (values?: object, options?: BuildOptions): ImageModel;
};
export declare function ImageFactory(sequelize: Sequelize): ImageStatic;
