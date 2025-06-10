"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageFactory = exports.Image = exports.AlbumFactory = exports.Album = void 0;
const sequelize_1 = require("sequelize");
class Album extends sequelize_1.Model {
}
exports.Album = Album;
function AlbumFactory(sequelize) {
    return Album.init({
        id: {
            type: sequelize_1.DataTypes.STRING,
            primaryKey: true,
        },
        description: sequelize_1.DataTypes.STRING,
        name: sequelize_1.DataTypes.STRING,
        privacy: sequelize_1.DataTypes.STRING,
        url: sequelize_1.DataTypes.STRING,
        password: sequelize_1.DataTypes.STRING,
    }, {
        sequelize,
        tableName: 'albums',
    });
}
exports.AlbumFactory = AlbumFactory;
class Image extends sequelize_1.Model {
}
exports.Image = Image;
function ImageFactory(sequelize) {
    return Image.init({
        id: {
            type: sequelize_1.DataTypes.STRING,
            primaryKey: true,
        },
        caption: sequelize_1.DataTypes.STRING,
        albumId: sequelize_1.DataTypes.STRING,
        filename: sequelize_1.DataTypes.STRING,
        url: sequelize_1.DataTypes.STRING,
        originalSize: sequelize_1.DataTypes.INTEGER,
        originalWidth: sequelize_1.DataTypes.INTEGER,
        originalHeight: sequelize_1.DataTypes.INTEGER,
        thumbnailUrl: sequelize_1.DataTypes.STRING,
        archivedUri: sequelize_1.DataTypes.STRING,
        archivedSize: sequelize_1.DataTypes.INTEGER,
        archivedMD5: sequelize_1.DataTypes.STRING,
        imageKey: sequelize_1.DataTypes.STRING,
        preferredDisplayFileExtension: sequelize_1.DataTypes.STRING,
        uri: sequelize_1.DataTypes.STRING,
    }, {
        sequelize,
        tableName: 'images',
    });
}
exports.ImageFactory = ImageFactory;
//# sourceMappingURL=smugmug.js.map