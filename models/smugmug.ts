import {
  Model,
  DataTypes,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from '@sequelize/core'

export class Album extends Model<InferAttributes<Album>, InferCreationAttributes<Album>> {
  declare id: string
  declare description: string
  declare name: string
  declare privacy: string
  declare url: string
  declare password: string
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export function AlbumFactory(sequelize: Sequelize): typeof Album {
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
  })
}

export class Image extends Model<InferAttributes<Image>, InferCreationAttributes<Image>> {
  declare id: string
  declare caption: string
  declare albumId: string
  declare filename: string
  declare url: string
  declare originalSize: number
  declare originalWidth: number
  declare originalHeight: number
  declare thumbnailUrl: string
  declare archivedUri: string
  declare archivedSize: number
  declare archivedMD5: string
  declare imageKey: string
  declare preferredDisplayFileExtension: string
  declare uri: string
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export function ImageFactory(sequelize: Sequelize): typeof Image {
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
  })
}
