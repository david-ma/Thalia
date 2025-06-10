import {
  ModelStatic,
  DataTypes,
  Sequelize,
  BuildOptions,
  Model,
} from 'sequelize'

export interface AlbumAttributes {
  id: string
  description: string
  name: string
  privacy: string
  url: string
  password: string
}
export interface AlbumModel extends Model<AlbumAttributes>, AlbumAttributes {}
export class Album extends Model {
  public id!: string
  public description!: string
  public name!: string
  public privacy!: string
  public url!: string
  public password!: string
}

export type AlbumStatic = ModelStatic<Album> & {
  new (values?: object, options?: BuildOptions): AlbumModel
}

export function AlbumFactory(sequelize: Sequelize): AlbumStatic {
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

export interface ImageAttributes {
  id: string
  caption: string
  albumId: string
  filename: string
  url: string
  originalSize: number
  originalWidth: number
  originalHeight: number
  thumbnailUrl: string
  archivedUri: string
  archivedSize: number
  archivedMD5: string
  imageKey: string
  preferredDisplayFileExtension: string
  uri: string
}
export interface ImageModel extends Model<ImageAttributes>, ImageAttributes {}
export class Image extends Model {
  public id!: string
  public caption!: string
  public albumId!: string
  public filename!: string
  public url!: string
  public originalSize!: number
  public originalWidth!: number
  public originalHeight!: number
  public thumbnailUrl!: string
  public archivedUri!: string
  public archivedSize!: number
  public archivedMD5!: string
  public imageKey!: string
  public preferredDisplayFileExtension!: string
  public uri!: string
}
export type ImageStatic = ModelStatic<Image> & {
  new (values?: object, options?: BuildOptions): ImageModel
}

export function ImageFactory(sequelize: Sequelize): ImageStatic {
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
