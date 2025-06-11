import { Model, Sequelize, InferAttributes, InferCreationAttributes, CreationOptional } from '@sequelize/core';
export declare class Album extends Model<InferAttributes<Album>, InferCreationAttributes<Album>> {
    id: string;
    description: string;
    name: string;
    privacy: string;
    url: string;
    password: string;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
}
export declare function AlbumFactory(sequelize: Sequelize): typeof Album;
export declare class Image extends Model<InferAttributes<Image>, InferCreationAttributes<Image>> {
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
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
}
export declare function ImageFactory(sequelize: Sequelize): typeof Image;
//# sourceMappingURL=smugmug.d.ts.map