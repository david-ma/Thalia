import { Model, DataTypes, } from '@sequelize/core';
export class Album extends Model {
}
export function AlbumFactory(sequelize) {
    return Album.init({
        id: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        description: DataTypes.STRING,
        name: DataTypes.STRING,
        privacy: DataTypes.STRING,
        url: DataTypes.STRING,
        password: DataTypes.STRING,
    }, {
        sequelize,
        tableName: 'albums',
    });
}
export class Image extends Model {
}
export function ImageFactory(sequelize) {
    return Image.init({
        id: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        caption: DataTypes.STRING,
        albumId: DataTypes.STRING,
        filename: DataTypes.STRING,
        url: DataTypes.STRING,
        originalSize: DataTypes.INTEGER,
        originalWidth: DataTypes.INTEGER,
        originalHeight: DataTypes.INTEGER,
        thumbnailUrl: DataTypes.STRING,
        archivedUri: DataTypes.STRING,
        archivedSize: DataTypes.INTEGER,
        archivedMD5: DataTypes.STRING,
        imageKey: DataTypes.STRING,
        preferredDisplayFileExtension: DataTypes.STRING,
        uri: DataTypes.STRING,
    }, {
        sequelize,
        tableName: 'images',
    });
}
//# sourceMappingURL=smugmug.js.map