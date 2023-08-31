import { Thalia } from './thalia';
export declare function hello(): void;
export declare function checkPackage(): void;
declare function crud(options: {
    tableName: string;
}): (controller: Thalia.Controller) => void;
declare const _default: {
    crud: typeof crud;
    hello: typeof hello;
    checkPackage: typeof checkPackage;
};
export default _default;
