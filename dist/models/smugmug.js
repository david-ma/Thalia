"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageFactory = exports.Image = exports.AlbumFactory = exports.Album = void 0;
const core_1 = require("@sequelize/core");
class Album extends core_1.Model {
}
exports.Album = Album;
function AlbumFactory(sequelize) {
    return Album.init({
        id: {
            type: core_1.DataTypes.STRING,
            primaryKey: true,
        },
        description: core_1.DataTypes.STRING,
        name: core_1.DataTypes.STRING,
        privacy: core_1.DataTypes.STRING,
        url: core_1.DataTypes.STRING,
        password: core_1.DataTypes.STRING,
    }, {
        sequelize,
        tableName: 'albums',
    });
}
exports.AlbumFactory = AlbumFactory;
class Image extends core_1.Model {
}
exports.Image = Image;
function ImageFactory(sequelize) {
    return Image.init({
        id: {
            type: core_1.DataTypes.STRING,
            primaryKey: true,
        },
        caption: core_1.DataTypes.STRING,
        albumId: core_1.DataTypes.STRING,
        filename: core_1.DataTypes.STRING,
        url: core_1.DataTypes.STRING,
        originalSize: core_1.DataTypes.INTEGER,
        originalWidth: core_1.DataTypes.INTEGER,
        originalHeight: core_1.DataTypes.INTEGER,
        thumbnailUrl: core_1.DataTypes.STRING,
        archivedUri: core_1.DataTypes.STRING,
        archivedSize: core_1.DataTypes.INTEGER,
        archivedMD5: core_1.DataTypes.STRING,
        imageKey: core_1.DataTypes.STRING,
        preferredDisplayFileExtension: core_1.DataTypes.STRING,
        uri: core_1.DataTypes.STRING,
    }, {
        sequelize,
        tableName: 'images',
    });
}
exports.ImageFactory = ImageFactory;
//# sourceMappingURL=smugmug.js.map